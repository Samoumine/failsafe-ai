export interface ReplayFrame {
  board: number[][];
  score: number;
  level: number;
  lines: number;
  timestamp: number;
}

export interface Replay {
  id: string;
  name: string;
  frames: ReplayFrame[];
  finalScore: number;
  date: number;
}

export function saveReplay(replay: Replay): void {
  const replays = loadReplays();
  replays.push(replay);
  localStorage.setItem('failsafe-replays', JSON.stringify(replays));
}

export function loadReplays(): Replay[] {
  try {
    return JSON.parse(localStorage.getItem('failsafe-replays') || '[]');
  } catch {
    return [];
  }
}

export function deleteReplay(id: string): void {
  const replays = loadReplays().filter(r => r.id !== id);
  localStorage.setItem('failsafe-replays', JSON.stringify(replays));
}

export function createReplay(name: string): Replay {
  return {
    id: crypto.randomUUID(),
    name,
    frames: [],
    finalScore: 0,
    date: Date.now(),
  };
}
