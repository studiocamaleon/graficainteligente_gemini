export type ConnectionState = 'disconnected' | 'connecting' | 'open' | 'error';

export interface EvolutionConfig {
  hasConfig: boolean;
  instanceId?: string;
  baseUrl?: string;
  hasApiKey?: boolean;
  connectionState?: ConnectionState;
  lastConnectedAt?: string | null;
}

export interface EvolutionConfigForm {
  instanceId: string;
  apiKey?: string;
  baseUrl?: string;
}

export interface EvolutionQRData {
  base64: string;
  pairingCode?: string | null;
}

export interface EvolutionConnectionState {
  state: string;
}

export interface EvolutionErrorResponse {
  error: string;
}
