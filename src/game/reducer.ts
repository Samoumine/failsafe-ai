import type { GameState } from '../core/types';
import type { SamDecisionResponse } from '../core/samClient';
import type { PlacementCandidate } from './heatmap';
import { createEmptyBoard, spawnPiece, isValidMove, mergePiece, clearLines, rotatePiece, hardDrop, checkGameOver } from './engine';

export type GameAction =
  | { type: 'START' }
  | { type: 'MOVE_LEFT' }
  | { type: 'MOVE_RIGHT' }
  | { type: 'MOVE_DOWN' }
  | { type: 'ROTATE' }
  | { type: 'HARD_DROP' }
  | { type: 'PAUSE' }
  | { type: 'RESUME' }
  | { type: 'RESTART' }
  | { type: 'TICK' }
  | { type: 'SAM_DECISION_UPDATED'; decision: SamDecisionResponse }
  | { type: 'SAM_APPROVE_MOVE' }
  | { type: 'SAM_REJECT' }
  | { type: 'APPLY_RECOMMENDED_PLACEMENT'; placement: PlacementCandidate };

// Helper to check if movement is blocked in MANUAL_CONFIRM
function isMovementBlocked(state: GameState): boolean {
  // Block only if: MANUAL_CONFIRM mode AND NOT approved AND NOT rejected
  return state.samDecision?.mode === 'MANUAL_CONFIRM' && !state.samApproved && !state.samRejected;
}

export function gameReducer(state: GameState, action: GameAction): GameState {
  switch (action.type) {
    case 'START': {
      if (state.currentPiece) return state;
      return spawnPiece({ ...state, currentPiece: null });
    }
    case 'MOVE_LEFT': {
      if (!state.currentPiece || state.isPaused || state.isGameOver) return state;
      if (isMovementBlocked(state)) return state;
      const newPiece = { ...state.currentPiece, position: { ...state.currentPiece.position, x: state.currentPiece.position.x - 1 } };
      if (isValidMove(state.board, newPiece)) {
        return { ...state, currentPiece: newPiece };
      }
      return state;
    }
    case 'MOVE_RIGHT': {
      if (!state.currentPiece || state.isPaused || state.isGameOver) return state;
      if (isMovementBlocked(state)) return state;
      const newPiece = { ...state.currentPiece, position: { ...state.currentPiece.position, x: state.currentPiece.position.x + 1 } };
      if (isValidMove(state.board, newPiece)) {
        return { ...state, currentPiece: newPiece };
      }
      return state;
    }
    case 'MOVE_DOWN': {
      if (!state.currentPiece || state.isPaused || state.isGameOver) return state;
      if (isMovementBlocked(state)) return state;
      const newPiece = { ...state.currentPiece, position: { ...state.currentPiece.position, y: state.currentPiece.position.y + 1 } };
      if (isValidMove(state.board, newPiece)) {
        return { ...state, currentPiece: newPiece };
      }
      return lockPiece(state);
    }
    case 'ROTATE': {
      if (!state.currentPiece || state.isPaused || state.isGameOver) return state;
      if (isMovementBlocked(state)) return state;
      const rotated = rotatePiece(state.currentPiece);
      if (isValidMove(state.board, rotated)) {
        return { ...state, currentPiece: rotated };
      }
      return state;
    }
    case 'HARD_DROP': {
      if (!state.currentPiece || state.isPaused || state.isGameOver) return state;
      // In MANUAL_CONFIRM mode before approval/rejection, hard drop is blocked
      if (isMovementBlocked(state)) {
        console.log('[SAM] Hard drop blocked - MANUAL_CONFIRM mode, use Approve or Reject');
        return state;
      }
      return lockPiece(hardDrop(state));
    }
    case 'PAUSE': {
      return { ...state, isPaused: true };
    }
    case 'RESUME': {
      return { ...state, isPaused: false };
    }
    case 'RESTART': {
      return createInitialState();
    }
    case 'SAM_DECISION_UPDATED': {
      const prevMode = state.samDecision?.mode;
      const newMode = action.decision.mode;
      
      // Log mode changes
      if (prevMode !== newMode) {
        console.log(`[SAM] Mode changed: ${prevMode || 'N/A'} → ${newMode} (risk: ${action.decision.riskScore.toFixed(2)})`);
      }
      
      // Pause game when entering MANUAL_CONFIRM mode
      const shouldPause = newMode === 'MANUAL_CONFIRM' && !state.samApproved && !state.samRejected;
      
      return { 
        ...state, 
        samDecision: action.decision,
        isPaused: shouldPause ? true : state.isPaused
      };
    }
    case 'SAM_APPROVE_MOVE': {
      // User approved the move - allow hard drop now
      console.log('[SAM] User approved move');
      return { ...state, samApproved: true, samRejected: false };
    }
    case 'SAM_REJECT': {
      // User rejected the suggestion - continue with manual play
      console.log('[SAM] User rejected suggestion, continuing with manual play');
      return { ...state, samRejected: true, samApproved: false, isPaused: false };
    }
    case 'APPLY_RECOMMENDED_PLACEMENT': {
      if (!state.currentPiece || state.isPaused || state.isGameOver) return state;
      
      const { placement } = action;
      console.log(`[SAM] Applying recommended placement: rot=${placement.rotation}, x=${placement.x}, y=${placement.y}`);
      
      // Create a new piece at the recommended position with the recommended rotation
      const rotatedShape = rotateShapeNTimes(state.currentPiece.shape, placement.rotation);
      const newPiece = {
        ...state.currentPiece,
        shape: rotatedShape,
        position: { x: placement.x, y: placement.y },
      };
      
      // Lock the piece immediately at the recommended position and resume game
      const lockedState = lockPiece({ ...state, currentPiece: newPiece });
      
      // Resume game after locking in MANUAL_CONFIRM mode
      if (lockedState.samDecision?.mode === 'MANUAL_CONFIRM') {
        return { ...lockedState, isPaused: false, samApproved: false, samRejected: false };
      }
      
      return { ...lockedState, samApproved: false, samRejected: false };
    }
    case 'TICK': {
      if (!state.currentPiece || state.isPaused || state.isGameOver) return state;
      // In MANUAL_CONFIRM before approval/rejection, pause the game (no automatic drops)
      if (isMovementBlocked(state)) {
        return state;
      }
      return gameReducer(state, { type: 'MOVE_DOWN' });
    }
    default:
      return state;
  }
}

// Helper function to rotate shape N times
function rotateShapeNTimes(shape: number[][], times: number): number[][] {
  let result = shape;
  for (let i = 0; i < times; i++) {
    const rows = result.length;
    const cols = result[0].length;
    const rotated: number[][] = [];
    for (let col = 0; col < cols; col++) {
      rotated[col] = [];
      for (let row = rows - 1; row >= 0; row--) {
        rotated[col][rows - 1 - row] = result[row][col];
      }
    }
    result = rotated;
  }
  return result;
}

function lockPiece(state: GameState): GameState {
  if (!state.currentPiece) return state;
  const newBoard = mergePiece(state.board, state.currentPiece);
  const { board, linesCleared } = clearLines(newBoard);
  const newScore = state.score + linesCleared * 100;
  const newLines = state.lines + linesCleared;
  const newLevel = Math.floor(newLines / 10) + 1;
  
  // Create state without piece, reset SAM flags on piece lock
  const stateAfterLock = {
    ...state,
    board,
    score: newScore,
    lines: newLines,
    level: newLevel,
    currentPiece: null,
    samApproved: false,   // Reset approval on piece lock
    samRejected: false,   // Reset rejection on piece lock (fresh decision for new piece)
  };
  
  // Spawn new piece
  const stateWithNewPiece = spawnPiece(stateAfterLock);
  
  // Check if the newly spawned piece has valid position (game over check)
  if (stateWithNewPiece.currentPiece && !isValidMove(stateWithNewPiece.board, stateWithNewPiece.currentPiece)) {
    return { ...stateWithNewPiece, isGameOver: true };
  }
  
  return stateWithNewPiece;
}

export function createInitialState(): GameState {
  return {
    board: createEmptyBoard(),
    currentPiece: null,
    score: 0,
    level: 1,
    lines: 0,
    isGameOver: false,
    isPaused: false,
    samDecision: null,
    samApproved: false,
    samRejected: false,
  };
}
