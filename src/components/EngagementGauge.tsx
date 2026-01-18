import React from 'react';
import type { EngagementMetrics } from '../core/types';

interface EngagementGaugeProps {
  engagement: EngagementMetrics;
}

export function EngagementGauge({ engagement }: EngagementGaugeProps) {
  const getColor = () => {
    if (engagement.engagementScore >= 70) return '#00ff66';
    if (engagement.engagementScore >= 40) return '#ffdd00';
    return '#ff6600';
  };

  return (
    <div className="engagement-gauge">
      <h3>Engagement</h3>
      <div className="engagement-meter">
        <div 
          className="engagement-fill"
          style={{ 
            width: `${engagement.engagementScore}%`,
            backgroundColor: getColor()
          }}
        />
      </div>
      <span className="engagement-label" style={{ color: getColor() }}>
        {engagement.engagementScore}%
      </span>
      <span className="engagement-trend">
        Trend: {engagement.trend}
      </span>
    </div>
  );
}
