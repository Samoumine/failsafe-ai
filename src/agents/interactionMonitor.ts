import type { GameState, Tetromino } from '../core/types';

export interface InteractionMetrics {
  keyPressesPerMinute: number;
  averageMoveDuration: number;
  pauseFrequency: number;
  rotationCount: number;
  hardDropCount: number;
}

export class InteractionMonitor {
  private keyPresses: number = 0;
  private rotations: number = 0;
  private hardDrops: number = 0;
  private pauseCount: number = 0;
  private startTime: number = Date.now();
  private moveStartTime: number = Date.now();

  recordKeyPress(): void {
    this.keyPresses++;
  }

  recordRotation(): void {
    this.rotations++;
  }

  recordHardDrop(): void {
    this.hardDrops++;
  }

  recordPause(): void {
    this.pauseCount++;
  }

  recordMoveStart(): void {
    this.moveStartTime = Date.now();
  }

  recordMoveEnd(): void {
    // Track move duration for analysis
  }

  getMetrics(): InteractionMetrics {
    const elapsedMinutes = (Date.now() - this.startTime) / 60000;
    return {
      keyPressesPerMinute: Math.round(this.keyPresses / Math.max(elapsedMinutes, 0.1)),
      averageMoveDuration: 0,
      pauseFrequency: this.pauseCount,
      rotationCount: this.rotations,
      hardDropCount: this.hardDrops,
    };
  }

  reset(): void {
    this.keyPresses = 0;
    this.rotations = 0;
    this.hardDrops = 0;
    this.pauseCount = 0;
    this.startTime = Date.now();
  }
}

export const interactionMonitor = new InteractionMonitor();
