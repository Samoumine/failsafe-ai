import type { SamDecisionResponse } from './samClient';

export interface Position {
  x: number;
  y: number;
}

export interface Tetromino {
  shape: number[][];
  position: Position;
  type: string;
}

export interface GameState {
  board: number[][];
  currentPiece: Tetromino | null;
  score: number;
  level: number;
  lines: number;
  isGameOver: boolean;
  isPaused: boolean;
  // SAM integration
  samDecision: SamDecisionResponse | null;
  samApproved: boolean; // True after user approves in MANUAL_CONFIRM
  samRejected: boolean; // True after user rejects suggestion and wants to play manually
}

export interface RiskMetrics {
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
  riskScore: number;
  factors: string[];
}

export interface EngagementMetrics {
  engagementScore: number;
  trend: 'rising' | 'stable' | 'falling';
  factors: string[];
}
