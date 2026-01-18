import React from 'react';
import type { RiskMetrics } from '../core/types';

interface RiskGaugeProps {
  risk: RiskMetrics;
}

export function RiskGauge({ risk }: RiskGaugeProps) {
  const getColor = () => {
    switch (risk.riskLevel) {
      case 'low': return '#00ff66';
      case 'medium': return '#ffdd00';
      case 'high': return '#ff6600';
      case 'critical': return '#ff0055';
    }
  };

  return (
    <div className="risk-gauge">
      <h3>Risk Level</h3>
      <div className="risk-meter">
        <div 
          className="risk-fill"
          style={{ 
            width: `${risk.riskScore}%`,
            backgroundColor: getColor()
          }}
        />
      </div>
      <span className="risk-label" style={{ color: getColor() }}>
        {risk.riskLevel.toUpperCase()}
      </span>
      {risk.factors.length > 0 && (
        <ul className="risk-factors">
          {risk.factors.map((factor, i) => (
            <li key={i}>{factor}</li>
          ))}
        </ul>
      )}
    </div>
  );
}
