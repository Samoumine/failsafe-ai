import type { GameAction } from './reducer';

export type KeyHandler = () => void;

export interface ControlBindings {
  moveLeft: KeyHandler;
  moveRight: KeyHandler;
  moveDown: KeyHandler;
  rotate: KeyHandler;
  hardDrop: KeyHandler;
  pause: KeyHandler;
}

// Lightweight state selector for controls (kept for potential future use)
export interface GameControlsState {
  samDecision: { mode: string; riskScore: number } | null;
  currentPiece: { type: string } | null;
}

export type GetGameState = () => GameControlsState;

export function bindControls(
  dispatch: (action: GameAction) => void,
  _getState: GetGameState  // Kept for API compatibility, not currently used
): () => void {
  const handleKeyDown = (e: KeyboardEvent) => {
    switch (e.key) {
      case 'ArrowLeft':
      case 'a':
      case 'A':
        e.preventDefault();
        dispatch({ type: 'MOVE_LEFT' });
        break;
      case 'ArrowRight':
      case 'd':
      case 'D':
        e.preventDefault();
        dispatch({ type: 'MOVE_RIGHT' });
        break;
      case 'ArrowDown':
      case 's':
      case 'S':
        e.preventDefault();
        dispatch({ type: 'MOVE_DOWN' });
        break;
      case 'ArrowUp':
      case 'w':
      case 'W':
      case ' ':
        e.preventDefault();
        dispatch({ type: 'ROTATE' });
        break;
      // Enter key is removed for placement - MANUAL_CONFIRM requires button click
      case 'p':
      case 'P':
      case 'Escape':
        e.preventDefault();
        dispatch({ type: 'PAUSE' });
        break;
    }
  };
  
  window.addEventListener('keydown', handleKeyDown);
  return () => window.removeEventListener('keydown', handleKeyDown);
}
