import type { RiskMetrics, EngagementMetrics } from '../core/types';

export interface Explanation {
  title: string;
  description: string;
  priority: 'high' | 'medium' | 'low';
  timestamp: number;
}

export function generateRiskExplanation(risk: RiskMetrics): Explanation[] {
  const explanations: Explanation[] = [];

  if (risk.riskLevel === 'critical') {
    explanations.push({
      title: 'Critical Risk Detected',
      description: 'Multiple risk factors detected. Consider pausing to reassess your strategy.',
      priority: 'high',
      timestamp: Date.now(),
    });
  }

  risk.factors.forEach(factor => {
    if (factor.includes('Hole')) {
      explanations.push({
        title: 'Hole Detected',
        description: 'Consider filling holes to improve board stability.',
        priority: 'medium',
        timestamp: Date.now(),
      });
    } else if (factor.includes('High stack')) {
      explanations.push({
        title: 'High Stack Warning',
        description: 'Your stack is getting high. Focus on clearing lines.',
        priority: 'high',
        timestamp: Date.now(),
      });
    }
  });

  return explanations;
}

export function generateEngagementExplanation(engagement: EngagementMetrics): Explanation[] {
  const explanations: Explanation[] = [];

  if (engagement.trend === 'falling') {
    explanations.push({
      title: 'Engagement Declining',
      description: 'Consider taking a short break or changing your approach.',
      priority: 'medium',
      timestamp: Date.now(),
    });
  }

  return explanations;
}
