import React from 'react';

interface ModeIndicatorProps {
  mode: 'play' | 'compare';
}

export function ModeIndicator({ mode }: ModeIndicatorProps) {
  return (
    <div className="mode-indicator">
      <span className={`mode-badge ${mode}`}>
        {mode === 'play' ? 'Playing' : 'Comparing'}
      </span>
    </div>
  );
}
