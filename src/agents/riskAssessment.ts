import type { GameState, RiskMetrics } from '../core/types';
import { BOARD_HEIGHT, BOARD_WIDTH } from '../game/tetrisTypes';

export function assessRisk(state: GameState): RiskMetrics {
  const factors: string[] = [];
  let riskScore = 0;

  if (!state.currentPiece) {
    return { riskLevel: 'low', riskScore: 0, factors: [] };
  }

  let holes = 0;
  for (let x = 0; x < BOARD_WIDTH; x++) {
    let foundBlock = false;
    for (let y = 0; y < BOARD_HEIGHT; y++) {
      if (state.board[y][x]) {
        foundBlock = true;
      } else if (foundBlock) {
        holes++;
        factors.push('Hole detected');
      }
    }
  }
  riskScore += holes * 10;

  let maxHeight = 0;
  for (let x = 0; x < BOARD_WIDTH; x++) {
    for (let y = 0; y < BOARD_HEIGHT; y++) {
      if (state.board[y][x]) {
        maxHeight = Math.max(maxHeight, BOARD_HEIGHT - y);
        break;
      }
    }
  }
  if (maxHeight > 15) {
    factors.push('High stack');
    riskScore += 20;
  }

  let gaps = 0;
  for (let x = 0; x < BOARD_WIDTH; x++) {
    let inGap = false;
    for (let y = BOARD_HEIGHT - 1; y >= 0; y--) {
      if (!state.board[y][x] && !inGap) {
        inGap = true;
        gaps++;
      } else if (state.board[y][x]) {
        inGap = false;
      }
    }
  }
  riskScore += gaps * 5;

  let riskLevel: RiskMetrics['riskLevel'];
  if (riskScore >= 80) {
    riskLevel = 'critical';
  } else if (riskScore >= 50) {
    riskLevel = 'high';
  } else if (riskScore >= 25) {
    riskLevel = 'medium';
  } else {
    riskLevel = 'low';
  }

  return {
    riskLevel,
    riskScore: Math.min(riskScore, 100),
    factors,
  };
}
