import { BOARD_HEIGHT, BOARD_WIDTH, EMPTY_CELL, TETROMINO_SHAPES, type TetrominoType } from './tetrisTypes';
import type { Tetromino, GameState } from '../core/types';
import { rng } from './rng';

export function createEmptyBoard(): number[][] {
  return Array(BOARD_HEIGHT).fill(null).map(() => Array(BOARD_WIDTH).fill(EMPTY_CELL));
}

export function createPiece(type: TetrominoType): Tetromino {
  return {
    type,
    shape: TETROMINO_SHAPES[type],
    position: { x: Math.floor(BOARD_WIDTH / 2) - 2, y: 0 },
  };
}

export function spawnPiece(state: GameState): GameState {
  const newPiece = createPiece(rng.nextPiece());
  return {
    ...state,
    currentPiece: newPiece,
  };
}

export function isValidMove(board: number[][], piece: Tetromino): boolean {
  for (let row = 0; row < piece.shape.length; row++) {
    for (let col = 0; col < piece.shape[row].length; col++) {
      if (piece.shape[row][col]) {
        const x = piece.position.x + col;
        const y = piece.position.y + row;
        if (x < 0 || x >= BOARD_WIDTH || y >= BOARD_HEIGHT) {
          return false;
        }
        if (y >= 0 && board[y][x]) {
          return false;
        }
      }
    }
  }
  return true;
}

export function rotatePiece(piece: Tetromino): Tetromino {
  const rows = piece.shape.length;
  const cols = piece.shape[0].length;
  const rotated: number[][] = [];
  for (let col = 0; col < cols; col++) {
    rotated[col] = [];
    for (let row = rows - 1; row >= 0; row--) {
      rotated[col][rows - 1 - row] = piece.shape[row][col];
    }
  }
  return { ...piece, shape: rotated };
}

export function mergePiece(board: number[][], piece: Tetromino): number[][] {
  const newBoard = board.map(row => [...row]);
  for (let row = 0; row < piece.shape.length; row++) {
    for (let col = 0; col < piece.shape[row].length; col++) {
      if (piece.shape[row][col]) {
        const y = piece.position.y + row;
        const x = piece.position.x + col;
        if (y >= 0 && y < BOARD_HEIGHT && x >= 0 && x < BOARD_WIDTH) {
          newBoard[y][x] = piece.shape[row][col];
        }
      }
    }
  }
  return newBoard;
}

export function clearLines(board: number[][]): { board: number[][], linesCleared: number } {
  const newBoard = board.filter(row => row.some(cell => cell === EMPTY_CELL));
  const linesCleared = BOARD_HEIGHT - newBoard.length;
  while (newBoard.length < BOARD_HEIGHT) {
    newBoard.unshift(Array(BOARD_WIDTH).fill(EMPTY_CELL));
  }
  return { board: newBoard, linesCleared };
}

export function hardDrop(state: GameState): GameState {
  if (!state.currentPiece) return state;
  let newPiece = { ...state.currentPiece };
  let dropDistance = 0;
  
  while (isValidMove(state.board, { ...newPiece, position: { ...newPiece.position, y: newPiece.position.y + 1 } })) {
    newPiece = { ...newPiece, position: { ...newPiece.position, y: newPiece.position.y + 1 } };
    dropDistance++;
  }
  
  return { ...state, currentPiece: newPiece };
}

export function checkGameOver(state: GameState): boolean {
  return state.currentPiece !== null && !isValidMove(state.board, state.currentPiece);
}
