import { BOARD_HEIGHT, BOARD_WIDTH, EMPTY_CELL } from './tetrisTypes';
import type { Tetromino } from '../core/types';
import { isValidMove } from './engine';

interface PieceState {
  x: number;
  y: number;
  rotation: number;
}

interface LandingState {
  rotation: number;
  x: number;
  y: number;
}

function rotateShape(shape: number[][], times: number): number[][] {
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

function getPieceAtState(piece: Tetromino, state: PieceState): Tetromino {
  const shape = rotateShape(piece.shape, state.rotation % 4);
  return {
    ...piece,
    shape,
    position: { x: state.x, y: state.y },
  };
}

function computeLandingY(board: number[][], piece: Tetromino): number {
  let y = piece.position.y;
  while (true) {
    const belowPiece = { ...piece, position: { ...piece.position, y: y + 1 } };
    if (isValidMove(board, belowPiece)) {
      y++;
    } else {
      break;
    }
  }
  return y;
}

function landingToString(landing: LandingState): string {
  return `${landing.rotation},${landing.x},${landing.y}`;
}

export function getReachableLandingStates(
  board: number[][],
  piece: Tetromino
): Set<string> {
  const reachableLandings = new Set<string>();
  const maxVisited = 5000;
  
  // BFS starting from CURRENT falling state (not landing)
  const startState: PieceState = {
    x: piece.position.x,
    y: piece.position.y,
    rotation: 0, // Current piece shape is already at rotation 0 relative to itself
  };
  
  const bfsQueue: PieceState[] = [startState];
  const bfsVisited = new Set<string>();
  bfsVisited.add(`${startState.x},${startState.y},${startState.rotation}`);
  
  let visitedCount = 0;
  
  while (bfsQueue.length > 0 && visitedCount < maxVisited) {
    visitedCount++;
    const current = bfsQueue.shift()!;
    
    // Get piece at current state
    const currentPiece = getPieceAtState(piece, current);
    
    // Check if this state is valid (it should be, but verify)
    if (!isValidMove(board, currentPiece)) {
      continue;
    }
    
    // Compute landing from this state (hard drop)
    const landingY = computeLandingY(board, currentPiece);
    
    const landing: LandingState = {
      rotation: current.rotation,
      x: current.x,
      y: landingY,
    };
    
    reachableLandings.add(landingToString(landing));
    
    // Explore neighbors from current state (not landing)
    // Moves: LEFT, RIGHT, ROTATE, DOWN
    const neighbors: PieceState[] = [
      { ...current, x: current.x - 1 }, // Left
      { ...current, x: current.x + 1 }, // Right
      { ...current, y: current.y + 1 }, // Down (soft drop position)
      { ...current, rotation: (current.rotation + 1) % 4 }, // Rotate
    ];
    
    for (const neighbor of neighbors) {
      const neighborKey = `${neighbor.x},${neighbor.y},${neighbor.rotation}`;
      
      if (bfsVisited.has(neighborKey)) continue;
      
      const neighborPiece = getPieceAtState(piece, neighbor);
      
      // Only add if the move is valid from current position
      if (isValidMove(board, neighborPiece)) {
        bfsVisited.add(neighborKey);
        bfsQueue.push(neighbor);
      }
    }
  }
  
  return reachableLandings;
}
