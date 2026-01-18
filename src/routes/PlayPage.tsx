import { useReducer, useEffect, useCallback, useMemo, useState, useRef } from 'react';
import { gameReducer, createInitialState } from '../game/reducer';
import { GameBoard } from '../components/GameBoard';
import { bindControls, type GameControlsState } from '../game/controls';
import type { GameAction } from '../game/reducer';
import { getPlacementRecommendations, type PlacementCandidate } from '../game/heatmap';
import { requestDecision, getConnectionStatus, type SamDecisionResponse } from '../core/samClient';
import { Topics } from '../core/topics';
import { eventBus } from '../core/eventBus';

// Development mode flag for logging
const DEV = true;

const TICK_INTERVAL = 500; // ms between gravity drops
const APPROVE_COOLDOWN_MS = 800; // Cooldown after approve before SAM can pause again
const MANUAL_CONFIRM_BACKOFF_MS = 2000; // Backoff for SAM polling in MANUAL_CONFIRM

export function PlayPage() {
  const [state, dispatch] = useReducer(gameReducer, createInitialState());
  const [showHeatmap, setShowHeatmap] = useState(true);
  const [useSam, setUseSam] = useState(false);
  const [boardHash, setBoardHash] = useState<string>('');
  
  // Manual confirm UI state
  const [manualAttempt, setManualAttempt] = useState(0);
  const [manualCooldownUntil, setManualCooldownUntil] = useState(0);
  
  // Connection status
  const [connectionStatus, setConnectionStatus] = useState(getConnectionStatus());
  
  // Metrics tracking
  const metricsRef = useRef({
    engagementScore: 0.5,
    blindAcceptStreak: 0,
    overrideRate: 0,
    hesitationRate: 0,
    totalDecisions: 0,
    samOverrides: 0,
    hesitationEvents: 0,
    lastBoardHash: '',
    lastPieceType: '',
  });
  
  // Track previous response for update detection
  const prevResponseRef = useRef<SamDecisionResponse | null>(null);
  
  // Cooldown ref to prevent pause loop after approve
  const approveCooldownRef = useRef<number>(0);
  
  // SAM polling backoff ref
  const samBackoffRef = useRef<number>(0);
  
  // Best placement cache to prevent flickering
  const placementCacheRef = useRef<Map<string, PlacementCandidate>>(new Map());
  
  // Game state ref for controls to read
  const gameStateRef = useRef<GameControlsState>({
    samDecision: null,
    currentPiece: null,
  });

  // Sync state to ref for controls
  useEffect(() => {
    gameStateRef.current = {
      samDecision: state.samDecision ? {
        mode: state.samDecision.mode,
        riskScore: state.samDecision.riskScore,
      } : null,
      currentPiece: state.currentPiece ? { type: state.currentPiece.type } : null,
    };
  }, [state.samDecision, state.currentPiece]);

  // Compute effectiveMode based on risk thresholds (override backend if needed)
  const samRisk = state.samDecision?.riskScore ?? 0;
  const backendMode = state.samDecision?.mode || 'EXPLAIN_ONLY';
  
  // Effective mode: use risk-based thresholds even if backend returns different mode
  const effectiveMode: 'EXPLAIN_ONLY' | 'ASSIST' | 'MANUAL_CONFIRM' = !useSam
    ? 'EXPLAIN_ONLY'
    : samRisk < 0.5 ? 'EXPLAIN_ONLY'
    : samRisk < 0.75 ? 'ASSIST'
    : 'MANUAL_CONFIRM';
  
  const isConnected = useSam && connectionStatus.connected;
  // Pause only if: MANUAL_CONFIRM AND not approved AND not rejected
  const isManualHold = isConnected && effectiveMode === 'MANUAL_CONFIRM' && !state.samApproved && !state.samRejected;
  const isAssist = isConnected && effectiveMode === 'ASSIST';
  const isManualConfirm = isConnected && effectiveMode === 'MANUAL_CONFIRM';
  const isManualRejected = state.samRejected;
  
  // Mode-based visibility
  const allowGhost = isAssist || isManualConfirm; // Ghost in ASSIST and MANUAL_CONFIRM
  const autoHeatmap = isAssist; // Heatmap auto ON in ASSIST
  const ghostStrength = isManualConfirm ? 'strong' : 'normal';
  
  // Check cooldown
  const now = Date.now();
  const inCooldown = now < approveCooldownRef.current;
  const inManualCooldown = now < manualCooldownUntil;

  // Game loop
  useEffect(() => {
    if (state.isPaused || state.isGameOver || !state.currentPiece) return;
    
    // In MANUAL_CONFIRM before approval/rejection, pause the game
    // But allow if we're in cooldown OR if user rejected (allowing manual play)
    if (isManualHold && !inCooldown && !inManualCooldown) {
      if (DEV) console.log('[DEV] MANUAL_CONFIRM pausing game');
      return;
    }

    const interval = setInterval(() => {
      dispatch({ type: 'TICK' });
    }, TICK_INTERVAL);

    return () => clearInterval(interval);
  }, [state.isPaused, state.isGameOver, state.currentPiece, isManualHold, inCooldown, inManualCooldown]);

  // Compute board hash for debug and caching
  useEffect(() => {
    const hash = state.board.map(row => row.join('')).join('|');
    setBoardHash(hash);
  }, [state.board]);

  // Keyboard controls with metrics tracking
  useEffect(() => {
    const getState: () => GameControlsState = () => gameStateRef.current;
    const unsubscribe = bindControls(
      (action: GameAction) => {
        // In MANUAL_CONFIRM before approval, block hard drop
        if (action.type === 'HARD_DROP') {
          const currentState = getState();
          if (currentState.samDecision?.mode === 'MANUAL_CONFIRM' && !state.samApproved) {
            if (DEV) console.log('[DEV] Enter blocked in MANUAL_CONFIRM');
            return; // Block hard drop
          }
        }
        
        dispatch(action);
        const metrics = metricsRef.current;
        if (action.type === 'MOVE_LEFT' || action.type === 'MOVE_RIGHT' || action.type === 'ROTATE') {
          metrics.hesitationRate = Math.min(1.0, metrics.hesitationRate + 0.02);
        }
        if (action.type === 'MOVE_LEFT' || action.type === 'MOVE_RIGHT' || 
            action.type === 'ROTATE' || action.type === 'HARD_DROP') {
          metrics.totalDecisions++;
        }
      },
      getState
    );
    return unsubscribe;
  }, [state.samApproved]);

  // Update connection status periodically
  useEffect(() => {
    const interval = setInterval(() => {
      setConnectionStatus(getConnectionStatus());
    }, 500);
    return () => clearInterval(interval);
  }, []);

  // Compute board hash for caching
  const boardHashRef = useRef<string>('');
  useEffect(() => {
    boardHashRef.current = state.board.map(row => row.join('')).join('|') || '';
  }, [state.board]);

  // Cached best placement computation - depends on manualAttempt for "Think More"
  // NOTE: bestPlacement is computed when allowGhost is true, regardless of showHeatmap
  const bestPlacement = useMemo((): PlacementCandidate | null => {
    if (!state.currentPiece) return null;
    if (!allowGhost) return null;
    
    // Debug log
    if (DEV && isManualConfirm) {
      console.log(`[DEV] MANUAL_CONFIRM: computing placement (attempt=${manualAttempt}, allowGhost=${allowGhost})`);
    }
    
    // Create cache key including attempt number
    const pieceType = state.currentPiece.type;
    const currentHash = boardHashRef.current || '';
    const cacheKey = `${currentHash}:${pieceType}:${manualAttempt}`;
    
    // Check cache first
    const cached = placementCacheRef.current.get(cacheKey);
    if (cached) {
      if (DEV && isManualConfirm) {
        console.log('[DEV] MANUAL_CONFIRM: using cached placement');
      }
      return cached;
    }
    
    // Use getPlacementRecommendations with debug enabled
    const result = getPlacementRecommendations(
      state.board, 
      state.currentPiece, 
      { attempt: manualAttempt, debug: isManualConfirm }
    );
    
    if (result?.best) {
      // Cache it
      placementCacheRef.current.set(cacheKey, result.best);
      
      // Limit cache size
      if (placementCacheRef.current.size > 100) {
        const firstKey = placementCacheRef.current.keys().next().value;
        if (firstKey !== undefined) {
          placementCacheRef.current.delete(firstKey);
        }
      }
      
      if (DEV && isManualConfirm) {
        console.log(`[DEV] MANUAL_CONFIRM: computed placement at attempt ${manualAttempt}:`, {
          rotation: result.best.rotation,
          x: result.best.x,
          score: result.best.score.toFixed(2),
          totalAlternatives: result.alternatives.length,
          fallbackUnsafe: result.best.fallbackUnsafe
        });
      }
    } else if (DEV && isManualConfirm) {
      console.log('[DEV] MANUAL_CONFIRM: no placement found at attempt', manualAttempt);
    }
    
    return result?.best ?? null;
  }, [state.board, state.currentPiece, allowGhost, manualAttempt, isManualConfirm]);

  // Debug: log when isManualConfirm and placement status
  useEffect(() => {
    if (isManualConfirm && DEV) {
      console.log(`[DEV] MANUAL_CONFIRM active: hasSuggestion=${!!bestPlacement}, attempt=${manualAttempt}`);
    }
  }, [isManualConfirm, bestPlacement, manualAttempt]);

  // SAM polling loop - stops when paused, manual hold, game over, or no piece
  useEffect(() => {
    // Don't poll if:
    // 1. SAM is disabled
    // 2. Game is paused
    // 3. In MANUAL_CONFIRM before approval (with backoff)
    // 4. Game over
    // 5. No current piece
    // 6. In manual cooldown after approving
    if (!useSam || state.isPaused || (isManualHold && !inCooldown && !inManualCooldown) || state.isGameOver || !state.currentPiece) {
      if (DEV && useSam) {
        if (state.isPaused) console.log('[DEV] SAM polling paused: game paused');
        else if (isManualHold && !inCooldown && !inManualCooldown) console.log('[DEV] SAM polling paused: MANUAL_CONFIRM');
        else if (!state.currentPiece) console.log('[DEV] SAM polling paused: no piece');
      }
      return;
    }

    // Check backoff
    if (now < samBackoffRef.current) {
      if (DEV) console.log('[DEV] SAM polling in backoff');
      return;
    }

    const piece = state.currentPiece;
    const currentMetrics = metricsRef.current;

    const pollSam = async () => {
      const request = {
        board: state.board,
        currentPiece: piece.type,
        x: piece.position.x,
        y: piece.position.y,
        rotation: 0,
        metrics: {
          engagementScore: currentMetrics.engagementScore,
          blindAcceptStreak: currentMetrics.blindAcceptStreak,
          overrideRate: currentMetrics.overrideRate,
          hesitationRate: currentMetrics.hesitationRate,
        },
      };

      const response = await requestDecision(request);
      
      if (response) {
        // Log mode changes
        const prevMode = prevResponseRef.current?.mode;
        
        if (prevMode !== response.mode && DEV) {
          console.log(`[DEV] Mode changed: ${prevMode || 'N/A'} → ${response.mode} (risk: ${response.riskScore.toFixed(2)})`);
        }
        
        // Set backoff if entering MANUAL_CONFIRM
        if (response.mode === 'MANUAL_CONFIRM' && prevMode !== 'MANUAL_CONFIRM') {
          samBackoffRef.current = now + MANUAL_CONFIRM_BACKOFF_MS;
          if (DEV) console.log('[DEV] SAM backoff set for MANUAL_CONFIRM:', MANUAL_CONFIRM_BACKOFF_MS, 'ms');
        }
        
        prevResponseRef.current = response;
        dispatch({ type: 'SAM_DECISION_UPDATED', decision: response });
        eventBus.emit(Topics.FAILSAFE_RISK, {
          riskScore: response.riskScore,
          riskFactors: response.riskFactors,
          reasons: [response.reason],
        });
        eventBus.emit(Topics.FAILSAFE_MODE, {
          mode: response.mode,
          reason: response.reason,
        });
      }
    };

    pollSam();
    const interval = setInterval(pollSam, 1000);
    return () => clearInterval(interval);
  }, [useSam, state.isPaused, isManualHold, inCooldown, inManualCooldown, state.isGameOver, state.currentPiece, state.board]);

  // Handle approve action
  const handleApprove = useCallback(() => {
    if (!bestPlacement || !state.currentPiece) return;
    
    if (DEV) {
      console.log('[DEV] User approved move:', {
        rotation: bestPlacement.rotation,
        x: bestPlacement.x,
        y: bestPlacement.y
      });
    }
    
    // Set cooldowns to prevent immediate re-pause
    approveCooldownRef.current = Date.now() + APPROVE_COOLDOWN_MS;
    setManualCooldownUntil(Date.now() + APPROVE_COOLDOWN_MS);
    if (DEV) console.log('[DEV] Approve cooldown set:', APPROVE_COOLDOWN_MS, 'ms');
    
    // Approve then apply
    dispatch({ type: 'SAM_APPROVE_MOVE' });
    dispatch({ type: 'APPLY_RECOMMENDED_PLACEMENT', placement: bestPlacement });
    dispatch({ type: 'RESUME' }); // Ensure game continues
    
    if (DEV) console.log('[DEV] Move applied, game resuming');
  }, [bestPlacement, state.currentPiece]);

  // Handle "Think More" action - get alternative suggestion
  const handleThinkMore = useCallback(() => {
    if (DEV) {
      console.log('[DEV] User clicked Think More, incrementing attempt');
    }
    setManualAttempt(prev => prev + 1);
  }, []);

  // Handle "Reject" action - continue with manual play
  const handleReject = useCallback(() => {
    if (DEV) {
      console.log('[DEV] User rejected suggestion, continuing with manual play');
    }
    // Reset cooldowns
    approveCooldownRef.current = Date.now() + APPROVE_COOLDOWN_MS;
    setManualCooldownUntil(Date.now() + APPROVE_COOLDOWN_MS);
    // Dispatch reject action (resumes game in reducer)
    dispatch({ type: 'SAM_REJECT' });
  }, []);

  const handleStart = useCallback(() => {
    if (state.isGameOver) {
      dispatch({ type: 'RESTART' });
    }
    dispatch({ type: 'START' });
  }, [state.isGameOver]);

  const handlePause = useCallback(() => {
    if (state.isPaused) {
      dispatch({ type: 'RESUME' });
    } else {
      dispatch({ type: 'PAUSE' });
    }
  }, [state.isPaused]);

  const handleRestart = useCallback(() => {
    dispatch({ type: 'RESTART' });
    metricsRef.current = {
      engagementScore: 0.5, blindAcceptStreak: 0, overrideRate: 0,
      hesitationRate: 0, totalDecisions: 0, samOverrides: 0,
      hesitationEvents: 0, lastBoardHash: '', lastPieceType: '',
    };
    prevResponseRef.current = null;
    approveCooldownRef.current = 0;
    samBackoffRef.current = 0;
    manualAttempt;
    setManualAttempt(0);
    setManualCooldownUntil(0);
    placementCacheRef.current.clear();
  }, []);

  return (
    <div className="play-page">
      <div className="play-page-container">
      {/* New 3-column layout */}
      <div className="game-layout">
        
        {/* LEFT COLUMN: Buttons */}
        <div className="left-column">
          <div className="button-panel vertical">
            {!state.currentPiece || state.isGameOver ? (
              <button className="btn-primary" onClick={handleStart}>
                {state.isGameOver ? 'Play Again' : 'Start'}
              </button>
            ) : (
              <button className="btn-secondary" onClick={handlePause}>
                {state.isPaused ? 'Resume' : 'Pause'}
              </button>
            )}
            
            {state.currentPiece && !state.isGameOver && (
              <button className="btn-danger" onClick={handleRestart}>Restart</button>
            )}
          </div>
          
          {/* Controls below buttons */}
          <div className="controls-panel compact">
            <h4>Controls</h4>
            <ul className="controls-list">
              <li><kbd>←</kbd> / <kbd>A</kbd> Left</li>
              <li><kbd>→</kbd> / <kbd>D</kbd> Right</li>
              <li><kbd>↓</kbd> / <kbd>S</kbd> Down</li>
              <li><kbd>↑</kbd> / <kbd>W</kbd> Rotate</li>
              <li><kbd>Space</kbd> Hard Drop</li>
              <li><kbd>P</kbd> Pause</li>
            </ul>
            {isManualConfirm && (
              <div className="controls-note warning">
                Use action buttons
              </div>
            )}
          </div>
        </div>

        {/* CENTER COLUMN: Game Board with Score/Lines/Label on top */}
        <div className="center-column">
          <div className="game-board-container">
            {/* Score/Level/Lines header above board */}
            <div className="game-stats-header">
              <div className="stat-item">
                <span className="stat-label">Score</span>
                <span className="stat-value">{state.score}</span>
              </div>
              <div className="stat-item">
                <span className="stat-label">Level</span>
                <span className="stat-value">{state.level}</span>
              </div>
              <div className="stat-item">
                <span className="stat-label">Lines</span>
                <span className="stat-value">{state.lines}</span>
              </div>
            </div>
            
            <div className="game-board-wrapper">
              <GameBoard 
                state={state} 
                bestPlacement={bestPlacement}
                showHeatmap={autoHeatmap || showHeatmap}
                ghostStrength={ghostStrength}
              />
              
              {state.isGameOver && (
                <div className="game-over-overlay">
                  <h2>Game Over</h2>
                  <p>Score: {state.score}</p>
                  <button onClick={handleRestart}>Play Again</button>
                </div>
              )}
              
              {!state.currentPiece && !state.isGameOver && (
                <div className="start-overlay">
                  <button onClick={handleStart}>Start Game</button>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* RIGHT COLUMN: SAM Panel */}
        <div className="right-column">
          {/* Heatmap Toggle */}
          <div className="heatmap-panel compact">
            <label className="toggle-label">
              <input
                type="checkbox"
                checked={showHeatmap}
                onChange={(e) => setShowHeatmap(e.target.checked)}
                disabled={useSam}
              />
              <span>Risk Map</span>
            </label>
            {useSam && <span className="auto-label">(auto)</span>}
          </div>

          {/* SAM Panel */}
          <div className="sam-panel">
            <div className="sam-header">
              <h3>SAM Decision</h3>
              <label className="toggle-label compact">
                <input
                  type="checkbox"
                  checked={useSam}
                  onChange={(e) => setUseSam(e.target.checked)}
                />
                <span>Enable</span>
              </label>
            </div>
            
            {useSam && (
              <div className="sam-content">
                {!connectionStatus.connected ? (
                  <div className="sam-offline">
                    <span className="offline-badge">SAM offline</span>
                  </div>
                ) : state.samDecision ? (
                  <>
                    {/* Mode - Most Dominant */}
                    <div className="sam-mode-row">
                      <span className="label">Mode</span>
                      <span className={`mode-value mode-${state.samDecision.mode.toLowerCase().replace('_', '-')}`}>
                        {state.samDecision.mode}
                      </span>
                    </div>
                    
                    {/* Risk Bar */}
                    <div className="risk-indicator compact">
                      <div className="risk-header">
                        <span className="risk-label">Risk</span>
                        <span className="risk-value">{state.samDecision.riskScore.toFixed(2)}</span>
                      </div>
                      <div className="risk-bar-container small">
                        <div 
                          className={`risk-bar-fill ${
                            state.samDecision.riskScore >= 0.75 ? 'risk-high'
                            : state.samDecision.riskScore >= 0.5 ? 'risk-medium'
                            : 'risk-low'
                          }`}
                          style={{ width: `${state.samDecision.riskScore * 100}%` }}
                        />
                      </div>
                      <div className="risk-labels">
                        <span>Low</span>
                        <span className={state.samDecision.riskScore >= 0.75 ? 'high' : state.samDecision.riskScore >= 0.5 ? 'medium' : ''}>
                          {state.samDecision.riskScore < 0.5 ? 'LOW' 
                           : state.samDecision.riskScore < 0.75 ? 'MEDIUM' 
                           : 'HIGH'}
                        </span>
                        <span>High</span>
                      </div>
                    </div>
                    
                    {/* Factors */}
                    {state.samDecision.riskFactors.length > 0 && (
                      <div className="sam-section">
                        <span className="label">Factors</span>
                        <ul className="risk-factor-list">
                          {state.samDecision.riskFactors.map((factor, i) => (
                            <li key={i}>{factor}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                    
                    {/* Reason */}
                    <div className="sam-reason">
                      <span className="label">Reason</span>
                      <span className="reason-text">{state.samDecision.reason}</span>
                    </div>
                    
                    {/* Guardrails */}
                    {state.samDecision.guardrails.length > 0 && (
                      <div className="sam-section">
                        <span className="label">Guardrails</span>
                        <ul className="guardrail-list">
                          {state.samDecision.guardrails.map((guardrail, i) => (
                            <li key={i}>{guardrail}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                    
                    {/* MANUAL_CONFIRM Action Buttons */}
                    {isManualConfirm && (
                      <div className="sam-manual-actions">
                        <button 
                          className="btn-approve"
                          disabled={!bestPlacement}
                          onClick={handleApprove}
                        >
                          Approve
                        </button>
                        <button 
                          className="btn-think"
                          onClick={handleThinkMore}
                        >
                          Think More
                        </button>
                        <button 
                          className="btn-reject"
                          onClick={handleReject}
                        >
                          Reject
                        </button>
                        {!bestPlacement && (
                          <div className="sam-hint">
                            No safe placement — Reject to play manually
                          </div>
                        )}
                        {bestPlacement && !isManualRejected && (
                          <div className="sam-placement-info">
                            rot={bestPlacement.rotation} @ x={bestPlacement.x}
                          </div>
                        )}
                        {isManualRejected && (
                          <div className="sam-rejected-info">
                            Playing manually
                          </div>
                        )}
                      </div>
                    )}
                    
                    {isManualConfirm && !bestPlacement && (
                      <div className="sam-calculating">Calculating...</div>
                    )}
                  </>
                ) : (
                  <div className="sam-calculating">Calculating...</div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
      </div>
    </div>
  );
}
