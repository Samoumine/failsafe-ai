import React from 'react';
import type { ComparisonMetrics } from '../compare/metrics';

interface CompareResultsProps {
  metrics: ComparisonMetrics[];
}

export function CompareResults({ metrics }: CompareResultsProps) {
  if (metrics.length === 0) {
    return (
      <div className="compare-results">
        <h3>Comparison Results</h3>
        <p>Select replays to compare</p>
      </div>
    );
  }

  return (
    <div className="compare-results">
      <h3>Comparison Results</h3>
      <table className="results-table">
        <thead>
          <tr>
            <th>Name</th>
            <th>Score</th>
            <th>Lines</th>
            <th>Level</th>
            <th>Duration</th>
          </tr>
        </thead>
        <tbody>
          {metrics.map(m => (
            <tr key={m.replayId}>
              <td>{m.replayName}</td>
              <td>{m.finalScore}</td>
              <td>{m.totalLines}</td>
              <td>{m.maxLevel}</td>
              <td>{Math.round(m.duration / 1000)}s</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
