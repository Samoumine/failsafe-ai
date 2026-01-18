import React from 'react';
import type { GameState } from '../core/types';

interface HUDProps {
  state: GameState;
}

export function HUD({ state }: HUDProps) {
  return (
    <div className="hud">
      <div className="hud-item">
        <span className="hud-label">Score</span>
        <span className="hud-value">{state.score}</span>
      </div>
      <div className="hud-item">
        <span className="hud-label">Level</span>
        <span className="hud-value">{state.level}</span>
      </div>
      <div className="hud-item">
        <span className="hud-label">Lines</span>
        <span className="hud-value">{state.lines}</span>
      </div>
      {state.isPaused && <div className="pause-indicator">PAUSED</div>}
    </div>
  );
}
