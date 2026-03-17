// Backend API client for design history and API key management.

export interface DesignItem {
  id: number;
  prompt: string;
  style: string;
  model: string;
  svg_content: string;
  layers_enabled: boolean;
  animation_enabled: boolean;
  created_at: string;
}

export interface DesignList {
  designs: DesignItem[];
  total: number;
  limit: number;
  offset: number;
}

export interface APIKeyInfo {
  id: number;
  name: string;
  provider: string;
  created_at: string;
  updated_at: string;
}

// Design History API

export const fetchDesigns = async (limit = 50, offset = 0, style?: string, query?: string): Promise<DesignList> => {
  const params = new URLSearchParams({ limit: String(limit), offset: String(offset) });
  if (style) params.set('style', style);
  if (query) params.set('q', query);
  const response = await fetch(`/api/designs?${params}`);
  if (!response.ok) {
    throw new Error('Failed to fetch designs');
  }
  return response.json();
};

export const createDesign = async (design: {
  prompt: string;
  style: string;
  model: string;
  svg_content: string;
  layers_enabled: boolean;
  animation_enabled: boolean;
}): Promise<DesignItem> => {
  const response = await fetch('/api/designs', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(design),
  });
  if (!response.ok) {
    throw new Error('Failed to save design');
  }
  return response.json();
};

export const deleteDesign = async (id: number): Promise<void> => {
  const response = await fetch(`/api/designs/${id}`, { method: 'DELETE' });
  if (!response.ok) {
    throw new Error('Failed to delete design');
  }
};

export const clearAllDesigns = async (): Promise<void> => {
  const response = await fetch('/api/designs', { method: 'DELETE' });
  if (!response.ok) {
    throw new Error('Failed to clear designs');
  }
};

// API Key Management

export const fetchAPIKeys = async (): Promise<APIKeyInfo[]> => {
  const response = await fetch('/api/keys');
  if (!response.ok) {
    throw new Error('Failed to fetch API keys');
  }
  const data = await response.json();
  return data.keys;
};

export const storeAPIKey = async (name: string, apiKey: string, provider = 'google'): Promise<void> => {
  const response = await fetch('/api/keys', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, api_key: apiKey, provider }),
  });
  if (!response.ok) {
    throw new Error('Failed to store API key');
  }
};

export const deleteAPIKey = async (name: string): Promise<void> => {
  const response = await fetch(`/api/keys/${encodeURIComponent(name)}`, { method: 'DELETE' });
  if (!response.ok) {
    throw new Error('Failed to delete API key');
  }
};
