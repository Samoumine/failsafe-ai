export type SamMode = 'ASSIST' | 'EXPLAIN_ONLY' | 'MANUAL_CONFIRM';

export interface SamDecisionRequest {
  board: number[][];
  currentPiece: string;
  x: number;
  y: number;
  rotation: number;
  metrics: {
    engagementScore: number;
    blindAcceptStreak: number;
    overrideRate: number;
    hesitationRate: number;
  };
}

export interface SamDecisionResponse {
  riskScore: number;
  riskFactors: string[];
  mode: SamMode;
  reason: string;
  guardrails: string[];
  explanation: string;
  nextActions: string[];
  source: string;
}

export interface SamConnectionStatus {
  connected: boolean;
  lastError: string | null;
}

// Track connection status for UI
let connectionStatus: SamConnectionStatus = {
  connected: false,
  lastError: null,
};

export function getConnectionStatus(): SamConnectionStatus {
  return { ...connectionStatus };
}

export async function requestDecision(req: SamDecisionRequest): Promise<SamDecisionResponse | null> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 1500);

  try {
    const SAM_BASE_URL = import.meta.env.VITE_SAM_BASE_URL || 'http://localhost:8002';

    const endpoint = SAM_BASE_URL.includes('onrender.com')
      ? `${SAM_BASE_URL}/api/decision`
      : `${SAM_BASE_URL}/workflow/decision`;

    const response = await fetch(endpoint, {

      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(req),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      console.warn('SAM API returned non-OK status:', response.status);
      connectionStatus = { connected: false, lastError: `HTTP ${response.status}` };
      return null;
    }

    const data = await response.json();

    const normalized: SamDecisionResponse = {
      riskScore: typeof data?.riskScore === 'number' ? data.riskScore : 0.5,
      mode: (data?.mode as SamMode) ?? 'ASSIST',
      reason: typeof data?.reason === 'string' ? data.reason : '',
      explanation: typeof data?.explanation === 'string' ? data.explanation : '',

      // IMPORTANT: ensure arrays always exist
      riskFactors: Array.isArray(data?.riskFactors) ? data.riskFactors : [],
      guardrails: Array.isArray(data?.guardrails) ? data.guardrails : [],
      nextActions: Array.isArray(data?.nextActions) ? data.nextActions : [],

      // ensure source always exists
      source: typeof data?.source === 'string' ? data.source : 'sam',
    };

    connectionStatus = { connected: true, lastError: null };
    console.log('SAM decision received:', normalized);
    return normalized;

  } catch (error) {
    clearTimeout(timeoutId);
    if (error instanceof Error && error.name === 'AbortError') {
      console.warn('SAM API request timed out');
      connectionStatus = { connected: false, lastError: 'Request timeout' };
    } else {
      console.warn('SAM API request failed:', error);
      connectionStatus = { connected: false, lastError: error instanceof Error ? error.message : String(error) };
    }
    return null;
  }
}
