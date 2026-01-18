import React from 'react';

interface TraceEntry {
  id: string;
  timestamp: number;
  action: string;
  state: string;
  reasoning: string;
}

interface TracePanelProps {
  trace: TraceEntry[];
}

export function TracePanel({ trace }: TracePanelProps) {
  return (
    <div className="trace-panel">
      <h3>AI Trace</h3>
      <div className="trace-list">
        {trace.slice(-100).reverse().map(entry => (
          <div key={entry.id} className="trace-entry">
            <span className="trace-time">
              {new Date(entry.timestamp).toLocaleTimeString()}
            </span>
            <span className="trace-action">{entry.action}</span>
            <span className="trace-state">{entry.state}</span>
            <p className="trace-reasoning">{entry.reasoning}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
