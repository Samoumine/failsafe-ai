import React from 'react';
import type { Replay } from '../compare/replay';

interface CompareSelectorProps {
  replays: Replay[];
  selectedIds: string[];
  onToggle: (id: string) => void;
}

export function CompareSelector({ replays, selectedIds, onToggle }: CompareSelectorProps) {
  return (
    <div className="compare-selector">
      <h3>Select Replays to Compare</h3>
      <div className="replay-list">
        {replays.map(replay => (
          <label key={replay.id} className="replay-option">
            <input
              type="checkbox"
              checked={selectedIds.includes(replay.id)}
              onChange={() => onToggle(replay.id)}
            />
            <span className="replay-name">{replay.name}</span>
            <span className="replay-score">{replay.finalScore}</span>
          </label>
        ))}
      </div>
    </div>
  );
}
