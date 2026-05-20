import { ArtStyle, GeminiModel } from "../types";

// All Gemini calls are now proxied through the Go backend at /api/*
// The API key is stored encrypted server-side — never exposed to the client.

// Per-tab session ID so each browser tab gets its own Gemini conversation.
function getSessionId(): string {
  const key = 'svg-art-session-id';
  let id = sessionStorage.getItem(key);
  if (!id) {
    id = crypto.randomUUID();
    sessionStorage.setItem(key, id);
  }
  return id;
}

export const resetSession = async (): Promise<void> => {
  try {
    await fetch('/api/session/reset', {
      method: 'POST',
      headers: { 'X-Session-ID': getSessionId() },
    });
  } catch (e) {
    console.error("Failed to reset session:", e);
  }
};

export const enhancePrompt = async (originalPrompt: string): Promise<string> => {
  try {
    const response = await fetch('/api/enhance', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Session-ID': getSessionId(),
      },
      body: JSON.stringify({ prompt: originalPrompt }),
    });

    if (!response.ok) {
      const err = await response.json().catch(() => ({ error: 'Enhancement failed' }));
      throw new Error(err.error || 'Enhancement failed');
    }

    const data = await response.json();
    return data.enhanced_prompt || originalPrompt;
  } catch (e) {
    console.error("Enhancement failed", e);
    return originalPrompt;
  }
};

export const generateSvg = async (
  prompt: string,
  style: ArtStyle,
  model: GeminiModel = 'gemini-3.5-flash-preview',
  enableLayers: boolean = true,
  enableAnimation: boolean = false
): Promise<string> => {
  const response = await fetch('/api/generate', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Session-ID': getSessionId(),
    },
    body: JSON.stringify({
      prompt,
      style: style === ArtStyle.NO_STYLE ? 'None' : style,
      model,
      enable_layers: enableLayers,
      enable_animation: enableAnimation,
    }),
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({ error: 'Generation failed' }));
    throw new Error(err.error || 'Failed to generate SVG');
  }

  const data = await response.json();
  return data.svg;
};
