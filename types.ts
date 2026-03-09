export enum ArtStyle {
  NO_STYLE = 'None',
  ICON = 'Icon',
  FLAT = 'Flat Design',
  CARTOON = 'Cartoon',
  LINE_ART = 'Line Art',
  LOGO = 'Logo',
  ABSTRACT = 'Abstract',
  GRADIENT = 'Gradient',
  PIXEL = 'Pixel Art'
}

export type GeminiModel = 'gemini-3-flash-preview' | 'gemini-3-pro-preview';

export interface ChatMessage {
  role: 'user' | 'model';
  content: string;
  isSvg?: boolean;
}

export interface GenerationConfig {
  prompt: string;
  style: ArtStyle;
}

export interface Layer {
  id: string;      // Unique internal ID for React keys
  elementId: string; // The actual SVG id attribute
  type: string;    // tag name (g, path, rect...)
  name: string;    // Display name
  visible: boolean;
  isSelected?: boolean;
}
