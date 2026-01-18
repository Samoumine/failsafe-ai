import type { Replay } from './replay';

export interface ComparisonMetrics {
  replayId: string;
  replayName: string;
  finalScore: number;
  totalLines: number;
  maxLevel: number;
  duration: number;
  avgRisk: number;
  riskEvents: number;
}

export function computeMetrics(replay: Replay): ComparisonMetrics {
  let maxLevel = 0;
  let totalRisk = 0;
  let riskEvents = 0;

  replay.frames.forEach(frame => {
    if (frame.level > maxLevel) maxLevel = frame.level;
  });

  return {
    replayId: replay.id,
    replayName: replay.name,
    finalScore: replay.finalScore,
    totalLines: replay.frames[replay.frames.length - 1]?.lines || 0,
    maxLevel,
    duration: replay.frames.length > 0 
      ? replay.frames[replay.frames.length - 1].timestamp - replay.frames[0].timestamp 
      : 0,
    avgRisk: totalRisk / Math.max(replay.frames.length, 1),
    riskEvents,
  };
}

export function compareReplays(replays: Replay[]): ComparisonMetrics[] {
  return replays.map(computeMetrics);
}

export function getBestReplay(metrics: ComparisonMetrics[]): ComparisonMetrics | null {
  if (metrics.length === 0) return null;
  return metrics.reduce((best, current) => 
    current.finalScore > best.finalScore ? current : best
  );
}
