import React, { useRef, useEffect } from 'react';
import type { GameState } from '../core/types';
import { drawGrid, getCellColor } from '../game/renderHelpers';
import { BOARD_HEIGHT, BOARD_WIDTH } from '../game/tetrisTypes';
import type { PlacementCandidate } from '../game/heatmap';

interface GameBoardProps {
  state: GameState;
  bestPlacement?: PlacementCandidate | null;
  showHeatmap?: boolean;
  ghostStrength?: 'normal' | 'strong';
}

export function GameBoard({ state, bestPlacement, showHeatmap = false, ghostStrength = 'normal' }: GameBoardProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const cellSize = 30;
    canvas.width = BOARD_WIDTH * cellSize;
    canvas.height = BOARD_HEIGHT * cellSize;

    ctx.fillStyle = '#0f0f1a';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    drawGrid(ctx, BOARD_WIDTH, BOARD_HEIGHT, cellSize);

    // Draw board
    for (let y = 0; y < BOARD_HEIGHT; y++) {
      for (let x = 0; x < BOARD_WIDTH; x++) {
        if (state.board[y][x]) {
          ctx.fillStyle = getCellColor(state.board[y][x]);
          ctx.fillRect(x * cellSize, y * cellSize, cellSize, cellSize);
          ctx.strokeStyle = '#0f0f1a';
          ctx.strokeRect(x * cellSize, y * cellSize, cellSize, cellSize);
        }
      }
    }

    // Draw best placement overlay (green ghost - shows where piece will land)
    // Ghost strength varies based on mode (stronger for MANUAL_CONFIRM)
    if (bestPlacement) {
      const isStrong = ghostStrength === 'strong';
      const alpha = isStrong ? 0.6 : 0.35;
      const strokeAlpha = isStrong ? 1.0 : 0.8;
      const lineWidth = isStrong ? 5 : 3;
      
      ctx.fillStyle = `rgba(0, 255, 102, ${alpha})`;
      ctx.strokeStyle = `rgba(0, 255, 102, ${strokeAlpha})`;
      ctx.lineWidth = lineWidth;
      
      bestPlacement.cells.forEach(({ x, y }) => {
        if (y >= 0 && y < BOARD_HEIGHT && x >= 0 && x < BOARD_WIDTH) {
          ctx.fillRect(x * cellSize, y * cellSize, cellSize, cellSize);
          ctx.strokeRect(x * cellSize, y * cellSize, cellSize, cellSize);
        }
      });
    }

    // Draw heatmap overlay (risk visualization) - separate from ghost
    if (showHeatmap) {
      for (let y = 0; y < BOARD_HEIGHT; y++) {
        for (let x = 0; x < BOARD_WIDTH; x++) {
          // Skip cells that are already occupied
          if (state.board[y][x]) continue;
          
          // Calculate risk score based on height and gaps
          let riskScore = 0;
          
          // Height-based risk (higher = more risk)
          const heightFromBottom = BOARD_HEIGHT - y;
          riskScore += (heightFromBottom / BOARD_HEIGHT) * 0.5;
          
          // Gap-based risk (holes below = more risk)
          let hasHoleBelow = false;
          for (let y2 = y + 1; y2 < BOARD_HEIGHT; y2++) {
            if (state.board[y2][x]) {
              hasHoleBelow = true;
              break;
            }
          }
          if (hasHoleBelow) riskScore += 0.3;
          
          // Bumpiness penalty (irregular surface)
          if (y > 0 && state.board[y-1][x] !== state.board[y][x]) {
            riskScore += 0.2;
          }
          
          // Normalize and colorize
          const normalizedRisk = Math.min(1, riskScore);
          if (normalizedRisk > 0.1) {
            // Red = high risk, Yellow = medium, Green = low
            let heatColor: string;
            if (normalizedRisk > 0.7) {
              heatColor = `rgba(255, 0, 85, ${normalizedRisk * 0.4})`;
            } else if (normalizedRisk > 0.4) {
              heatColor = `rgba(255, 165, 0, ${normalizedRisk * 0.35})`;
            } else {
              heatColor = `rgba(0, 255, 102, ${normalizedRisk * 0.25})`;
            }
            
            ctx.fillStyle = heatColor;
            ctx.fillRect(x * cellSize, y * cellSize, cellSize, cellSize);
          }
        }
      }
    }

    // Draw current piece
    if (state.currentPiece) {
      const { shape, position } = state.currentPiece;
      for (let row = 0; row < shape.length; row++) {
        for (let col = 0; col < shape[row].length; col++) {
          if (shape[row][col]) {
            const x = position.x + col;
            const y = position.y + row;
            if (y >= 0) {
              ctx.fillStyle = getCellColor(shape[row][col]);
              ctx.fillRect(x * cellSize, y * cellSize, cellSize, cellSize);
              ctx.strokeStyle = '#0f0f1a';
              ctx.strokeRect(x * cellSize, y * cellSize, cellSize, cellSize);
            }
          }
        }
      }
    }
  }, [state, bestPlacement, showHeatmap, ghostStrength]);

  return <canvas ref={canvasRef} />;
}
