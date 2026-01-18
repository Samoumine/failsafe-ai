export interface AgentConfig {
  id: string;
  name: string;
  enabled: boolean;
  parameters: Record<string, number>;
}

export const DEFAULT_CONFIGS: AgentConfig[] = [
  {
    id: 'safety',
    name: 'Safety Policy',
    enabled: true,
    parameters: { riskThreshold: 0.5 },
  },
  {
    id: 'engagement',
    name: 'Engagement Policy',
    enabled: true,
    parameters: { engagementFloor: 0.3 },
  },
];

export function getConfig(id: string): AgentConfig | undefined {
  return DEFAULT_CONFIGS.find(c => c.id === id);
}

export function updateConfig(id: string, updates: Partial<AgentConfig>): AgentConfig | undefined {
  const index = DEFAULT_CONFIGS.findIndex(c => c.id === id);
  if (index !== -1) {
    DEFAULT_CONFIGS[index] = { ...DEFAULT_CONFIGS[index], ...updates };
    return DEFAULT_CONFIGS[index];
  }
  return undefined;
}
