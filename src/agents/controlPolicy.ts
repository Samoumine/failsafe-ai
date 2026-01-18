import type { GameState } from '../core/types';

export type Action = 'MOVE_LEFT' | 'MOVE_RIGHT' | 'MOVE_DOWN' | 'ROTATE' | 'HARD_DROP' | 'NONE';

export interface ControlPolicy {
  getAction(state: GameState): Action;
  getConfidence(): number;
  isActive(): boolean;
  setActive(active: boolean): void;
}

export class SafetyPolicy implements ControlPolicy {
  private active: boolean = true;
  private confidence: number = 0.85;

  getAction(state: GameState): Action {
    if (!this.active || !state.currentPiece) return 'NONE';
    return 'NONE';
  }

  getConfidence(): number {
    return this.confidence;
  }

  isActive(): boolean {
    return this.active;
  }

  setActive(active: boolean): void {
    this.active = active;
  }
}

export class EngagementPolicy implements ControlPolicy {
  private active: boolean = true;
  private confidence: number = 0.75;

  getAction(state: GameState): Action {
    if (!this.active || !state.currentPiece) return 'NONE';
    return 'NONE';
  }

  getConfidence(): number {
    return this.confidence;
  }

  isActive(): boolean {
    return this.active;
  }

  setActive(active: boolean): void {
    this.active = active;
  }
}

export const safetyPolicy = new SafetyPolicy();
export const engagementPolicy = new EngagementPolicy();
