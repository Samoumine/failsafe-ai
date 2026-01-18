import { BOARD_HEIGHT, BOARD_WIDTH, EMPTY_CELL } from './tetrisTypes';
import type { Tetromino } from '../core/types';

// DEBUG flag - set to true only when debugging
const DEBUG = true;

export interface PlacementCandidate {
  rotation: number;
  x: number;
  y: number;
  cells: { x: number; y: number }[];
  score: number;
  breakdown: {
    holes: number;
    maxHeight: number;
    bumpiness: number;
    linesCleared: number;
    riskBefore: number;   // Board risk before placement
    riskAfter: number;    // Board risk after placement + line clear
    deltaRisk: number;    // riskAfter - riskBefore (negative = better)
  };
  fallbackUnsafe?: boolean; // True if this is a fallback placement
}

export interface PlacementOptions {
  attempt?: number;  // Which candidate to return (0 = best, 1 = second best, etc.)
  debug?: boolean;
}

export interface PlacementResult {
  best: PlacementCandidate | null;       // Best candidate (lowest deltaRisk)
  alternatives: PlacementCandidate[];    // All valid candidates sorted best->worst
  debugInfo: {
    totalScanned: number;               // Total positions scanned
    validCount: number;                 // Valid placements found
    usedFallback: boolean;              // Whether fallback was needed
    maxXTested: number;                 // Maximum x value tested
    rightmostCandidateX: number;        // Rightmost candidate x
    theoreticalMaxX: number;            // Theoretical max x for reference
    rotationStats: Record<number, number>; // Count per rotation
  };
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

// Clamp a value between min and max
function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

// Get occupied bounds of a shape (based only on nonzero cells)
function getOccupiedBounds(shape: number[][]): { minCol: number; maxCol: number; minRow: number; maxRow: number } {
  let minCol = Infinity;
  let maxCol = -1;
  let minRow = Infinity;
  let maxRow = -1;
  
  for (let row = 0; row < shape.length; row++) {
    for (let col = 0; col < shape[row].length; col++) {
      if (shape[row][col]) {
        minCol = Math.min(minCol, col);
        maxCol = Math.max(maxCol, col);
        minRow = Math.min(minRow, row);
        maxRow = Math.max(maxRow, row);
      }
    }
  }
  
  // Handle case where shape has no occupied cells
  if (maxCol === -1) {
    return { minCol: 0, maxCol: 0, minRow: 0, maxRow: 0 };
  }
  
  return { minCol, maxCol, minRow, maxRow };
}

// Rotate shape N times
function rotateShapeN(shape: number[][], times: number): number[][] {
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

// Generate cells for a piece at position
function generateCells(shape: number[][], x: number, y: number): { x: number; y: number }[] {
  const cells: { x: number; y: number }[] = [];
  for (let row = 0; row < shape.length; row++) {
    for (let col = 0; col < shape[row].length; col++) {
      if (shape[row][col]) {
        cells.push({ x: x + col, y: y + row });
      }
    }
  }
  return cells;
}

// Clone a board (deep copy)
function cloneBoard(board: number[][]): number[][] {
  return board.map(row => [...row]);
}

// Place cells onto a board (for simulation)
function placeCells(board: number[][], cells: { x: number; y: number }[]): void {
  cells.forEach(({ x, y }) => {
    if (y >= 0 && y < board.length && x >= 0 && x < board[0]?.length) {
      board[y][x] = 1;
    }
  });
}

// Clear full lines from a board (returns new board state)
function clearFullLines(board: number[][]): { board: number[][]; linesCleared: number } {
  const boardH = board.length;
  const boardW = board[0]?.length || BOARD_WIDTH;
  const newBoard = board.map(row => [...row]);
  let linesCleared = 0;
  
  for (let y = boardH - 1; y >= 0; y--) {
    if (newBoard[y].every(cell => cell !== EMPTY_CELL)) {
      // This line is full - remove it
      newBoard.splice(y, 1);
      newBoard.unshift(Array(boardW).fill(EMPTY_CELL));
      linesCleared++;
      y++; // Re-check this position after shift
    }
  }
  
  return { board: newBoard, linesCleared };
}

// Compute board statistics (holes, maxHeight, bumpiness)
function computeBoardStats(board: number[][]): { holes: number; maxHeight: number; bumpiness: number; linesCleared: number } {
  const boardH = board.length;
  const boardW = board[0]?.length || BOARD_WIDTH;
  
  // Count holes
  let holes = 0;
  for (let x = 0; x < boardW; x++) {
    let foundBlock = false;
    for (let y = 0; y < boardH; y++) {
      if (board[y][x] !== EMPTY_CELL) {
        foundBlock = true;
      } else if (foundBlock) {
        holes++;
      }
    }
  }
  
  // Max height
  let maxHeight = 0;
  for (let y = 0; y < boardH; y++) {
    for (let x = 0; x < boardW; x++) {
      if (board[y][x] !== EMPTY_CELL) {
        maxHeight = Math.max(maxHeight, boardH - y);
        break;
      }
    }
  }
  
  // Bumpiness
  const heights: number[] = [];
  for (let x = 0; x < boardW; x++) {
    let h = 0;
    for (let y = 0; y < boardH; y++) {
      if (board[y][x] !== EMPTY_CELL) {
        h = boardH - y;
        break;
      }
    }
    heights.push(h);
  }
  let bumpiness = 0;
  for (let i = 0; i < heights.length - 1; i++) {
    bumpiness += Math.abs(heights[i] - heights[i + 1]);
  }
  
  // Lines cleared (not applicable for static board, but included for completeness)
  const linesCleared = 0;
  
  return { holes, maxHeight, bumpiness, linesCleared };
}

// Compute board risk using SAM formula
function computeBoardRisk(stats: { holes: number; maxHeight: number; bumpiness: number }): number {
  // SAM risk formula: raw = holes*3 + maxHeight*0.7 + bumpiness*0.4
  const raw = stats.holes * 3 + stats.maxHeight * 0.7 + stats.bumpiness * 0.4;
  // Normalize to [0, 1] range (assuming max risk ~60)
  return clamp(raw / 60, 0, 1);
}

// Validate placement is legal using actual board dimensions
function isLegalPlacement(board: number[][], shape: number[][], x: number, y: number): boolean {
  const boardH = board.length;
  const boardW = board[0]?.length || BOARD_WIDTH;
  
  for (let row = 0; row < shape.length; row++) {
    for (let col = 0; col < shape[row].length; col++) {
      if (shape[row][col]) {
        const boardX = x + col;
        const boardY = y + row;
        
        // Must be within bounds
        if (boardX < 0 || boardX >= boardW || boardY >= boardH) {
          return false;
        }
        
        // Must not collide with existing blocks (ignore above board)
        if (boardY >= 0 && board[boardY][boardX] !== EMPTY_CELL) {
          return false;
        }
      }
    }
  }
  return true;
}

// ============================================================================
// MAIN FUNCTION: Get placement recommendations with risk-based scoring
// ============================================================================

export function getPlacementRecommendations(
  board: number[][],
  piece: Tetromino,
  options?: PlacementOptions
): PlacementResult {
  const debug = options?.debug || DEBUG;
  const candidates: PlacementCandidate[] = [];
  const rotationStats: Record<number, number> = { 0: 0, 1: 0, 2: 0, 3: 0 };
  let usedFallback = false;
  let maxXTested = -999;
  let rightmostCandidateX = -999;
  
  // Compute baseline board risk BEFORE placement
  const statsBefore = computeBoardStats(board);
  const riskBefore = computeBoardRisk(statsBefore);
  
  if (DEBUG) {
    console.log('[HEATMAP] Baseline stats:', {
      holes: statsBefore.holes,
      maxHeight: statsBefore.maxHeight,
      bumpiness: statsBefore.bumpiness,
      riskBefore: riskBefore.toFixed(3),
    });
  }
  
  // Strategy 1: Try to find placements reachable from current position
  const strictResult = findAllValidPlacements(board, piece, false, debug);
  
  if (strictResult.candidates.length > 0) {
    candidates.push(...strictResult.candidates);
  } else {
    // Strategy 2: Fallback - try all possible placements
    if (debug) {
      console.log('[HEATMAP] No strict placements, trying fallback enumeration...');
    }
    
    const fallbackResult = findAllValidPlacements(board, piece, true, debug);
    
    if (fallbackResult.candidates.length > 0) {
      usedFallback = true;
      fallbackResult.candidates.forEach(c => {
        c.fallbackUnsafe = true;
      });
      candidates.push(...fallbackResult.candidates);
      
      if (debug) {
        console.log('[HEATMAP] Fallback placements found:', fallbackResult.candidates.length);
      }
    }
  }
  
  // Compute risk metrics for each candidate
  for (const candidate of candidates) {
    // Simulate placement + line clear
    const testBoard = cloneBoard(board);
    placeCells(testBoard, candidate.cells);
    const { board: clearedBoard } = clearFullLines(testBoard);
    
    // Compute stats and risk after placement
    const statsAfter = computeBoardStats(clearedBoard);
    const riskAfter = computeBoardRisk(statsAfter);
    
    // Update breakdown with risk metrics
    candidate.breakdown = {
      ...candidate.breakdown,
      riskBefore,
      riskAfter,
      deltaRisk: riskAfter - riskBefore,
    };
    
    // Score = deltaRisk (lower/negative = better risk reduction)
    candidate.score = candidate.breakdown.deltaRisk;
    
    // Track stats
    rotationStats[candidate.rotation]++;
    maxXTested = Math.max(maxXTested, candidate.x);
    rightmostCandidateX = Math.max(rightmostCandidateX, candidate.x);
  }
  
  // Sort by score (deltaRisk ascending - most negative first), with deterministic tie-breaking
  candidates.sort((a, b) => {
    if (a.score !== b.score) return a.score - b.score;  // Lower deltaRisk first
    if (a.breakdown.maxHeight !== b.breakdown.maxHeight) {
      return a.breakdown.maxHeight - b.breakdown.maxHeight;
    }
    return a.x - b.x;
  });
  
  // Get alternatives based on attempt
  const attempt = options?.attempt ?? 0;
  const alternatives = candidates;
  const index = Math.min(attempt, Math.max(0, alternatives.length - 1));
  const best = alternatives.length > 0 ? alternatives[index] : null;
  
  // Compute theoretical max X for this piece
  const boardW = board[0]?.length || BOARD_WIDTH;
  const shapeCols = piece.shape[0]?.length || 0;
  const theoreticalMaxX = boardW - shapeCols;
  
  // Debug output
  if (debug) {
    console.log('[HEATMAP] Recommendations:', {
      totalScanned: rotationStats[0] + rotationStats[1] + rotationStats[2] + rotationStats[3],
      validCount: candidates.length,
      usedFallback,
      attempt,
      selectedIndex: index,
      hasBest: !!best,
      bestRotation: best?.rotation,
      bestX: best?.x,
      bestXCell: best?.cells.map(c => c.x).sort((a, b) => b - a)[0] ?? 'none',
      bestScore: best?.score?.toFixed(4),
      bestDeltaRisk: best?.breakdown.deltaRisk?.toFixed(4),
      maxXTested,
      rightmostCandidateX,
      theoreticalMaxX,
      rotationStats,
    });
    
    // Regression check: verify rightmost positions were tested
    if (candidates.length > 0 && theoreticalMaxX >= 0) {
      const testedAtMaxX = candidates.some(c => c.x === theoreticalMaxX);
      if (!testedAtMaxX) {
        console.warn('[HEATMAP] REGRESSION: No candidate at theoretical maxX', {
          theoreticalMaxX,
          boardW,
          shapeCols,
          maxXTested,
          rightmostCandidateX,
        });
      } else {
        console.log('[HEATMAP] Rightmost position verified:', {
          theoreticalMaxX,
          maxXTested,
          rightmostCandidateX,
        });
      }
    }
    
    if (best) {
      console.log('[HEATMAP] Best candidate risk:', {
        riskBefore: best.breakdown.riskBefore.toFixed(3),
        riskAfter: best.breakdown.riskAfter.toFixed(3),
        deltaRisk: best.breakdown.deltaRisk.toFixed(4),
        holesAfter: best.breakdown.holes,
        maxHeightAfter: best.breakdown.maxHeight,
      });
    }
    
    if (candidates.length === 0) {
      console.warn('[HEATMAP] NO LEGAL PLACEMENTS FOUND - possible game over');
    }
  }
  
  return {
    best,
    alternatives,
    debugInfo: {
      totalScanned: rotationStats[0] + rotationStats[1] + rotationStats[2] + rotationStats[3],
      validCount: candidates.length,
      usedFallback,
      maxXTested,
      rightmostCandidateX,
      theoreticalMaxX,
      rotationStats,
    },
  };
}

// ============================================================================
// Find all valid placements (helper function)
// ============================================================================

interface FindPlacementsResult {
  candidates: PlacementCandidate[];
  maxXTested: number;
}

function findAllValidPlacements(
  board: number[][],
  piece: Tetromino,
  useFallback: boolean,
  debug: boolean
): FindPlacementsResult {
  const candidates: PlacementCandidate[] = [];
  const originalShape = piece.shape;
  const boardH = board.length;
  const boardW = board[0]?.length || BOARD_WIDTH;
  let maxXTested = -999;
  
  // Debug: log board dimensions
  if (DEBUG) {
    console.log('[HEATMAP] Board dims:', { boardH, boardW });
  }
  
  // Try all 4 rotations
  for (let rot = 0; rot < 4; rot++) {
    const shape = rotateShapeN(originalShape, rot);
    const shapeRows = shape.length;
    const shapeCols = shape[0].length;
    
    // Compute valid x range based on occupied bounds (not shape dimensions)
    const bounds = getOccupiedBounds(shape);
    
    // minX: leftmost occupied cell at x=0, so origin = -minCol
    const minX = -bounds.minCol;
    
    // maxX: rightmost occupied cell at x=boardW-1, so origin = (boardW-1) - maxCol
    const maxX = (boardW - 1) - bounds.maxCol;
    
    // Debug: log computed range with bounds
    if (DEBUG) {
      console.log('[HEATMAP] X-range:', {
        rot,
        bounds: { minCol: bounds.minCol, maxCol: bounds.maxCol },
        minX,
        maxX,
      });
    }
    
    // Enumerate all valid x positions
    for (let x = minX; x <= maxX; x++) {
      maxXTested = Math.max(maxXTested, x);
      
      // Find landing Y by hard-drop simulation
      let landingY = -shapeRows;
      
      // Drop until we hit something
      while (true) {
        const checkY = landingY + 1;
        
        // Check if we can move down one more
        let canDrop = true;
        for (let row = 0; row < shapeRows; row++) {
          for (let col = 0; col < shape[row].length; col++) {
            if (shape[row][col]) {
              const boardX = x + col;
              const boardY = checkY + row;
              
              // Guard against out-of-bounds
              if (boardX < 0 || boardX >= boardW) {
                canDrop = false;
              } else if (boardY >= boardH) {
                canDrop = false;
              } else if (boardY >= 0 && board[boardY][boardX] !== EMPTY_CELL) {
                canDrop = false;
              }
              
              if (!canDrop) break;
            }
          }
          if (!canDrop) break;
        }
        
        if (canDrop) {
          landingY = checkY;
        } else {
          break;
        }
      }
      
      // Validate the landing position
      if (isLegalPlacement(board, shape, x, landingY) && landingY > -shapeRows) {
        const cells = generateCells(shape, x, landingY);
        
        // Compute basic breakdown (risk metrics added later)
        const breakdown = {
          holes: 0,
          maxHeight: 0,
          bumpiness: 0,
          linesCleared: 0,
          riskBefore: 0,
          riskAfter: 0,
          deltaRisk: 0,
        };
        
        candidates.push({
          rotation: rot,
          x,
          y: landingY,
          cells,
          score: 0, // Will be set to deltaRisk later
          breakdown,
        });
      }
    }
  }
  
  if (DEBUG) {
    console.log('[HEATMAP] Scan complete:', {
      candidatesFound: candidates.length,
      maxXTested,
      rightmostCandidateX: candidates.length > 0 
        ? Math.max(...candidates.map(c => c.x))
        : 'none',
    });
  }
  
  return { candidates, maxXTested };
}

// ============================================================================
// Legacy functions for compatibility
// ============================================================================

export function getBestPlacement(
  board: number[][],
  piece: Tetromino
): PlacementCandidate | null {
  const result = getPlacementRecommendations(board, piece);
  return result.best;
}

export function getAlternativePlacement(
  board: number[][],
  piece: Tetromino,
  attempt: number = 0
): PlacementCandidate | null {
  const result = getPlacementRecommendations(board, piece, { attempt });
  return result.best;
}
