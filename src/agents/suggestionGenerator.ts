import type { GameState } from '../core/types';
import type { Action } from './controlPolicy';

export interface Suggestion {
  action: Action;
  reason: string;
  confidence: number;
}

export function generateSuggestion(state: GameState): Suggestion | null {
  if (!state.currentPiece) return null;

  return {
    action: 'NONE',
    reason: 'Continue current strategy',
    confidence: 0.5,
  };
}

export function evaluateMove(state: GameState, action: Action): { score: number; reason: string } {
  return { score: 0, reason: 'Move evaluation' };
}

export function findBestMove(state: GameState): Suggestion | null {
  if (!state.currentPiece) return null;
  return {
    action: 'NONE',
    reason: 'No optimal move found',
    confidence: 0.3,
  };
}
