import { ArtStyle } from '../types';

export interface Template {
  id: string;
  name: string;
  description: string;
  category: 'Icons' | 'Logos' | 'Patterns' | 'Illustrations' | 'UI Elements';
  prompt: string;
  style: ArtStyle;
}

export const templates: Template[] = [
  // Icons
  {
    id: 'icon-home',
    name: 'Home Icon',
    description: 'Clean minimal house icon with door and chimney',
    category: 'Icons',
    prompt: 'A clean, minimal home icon with a chimney and door, single color, centered',
    style: ArtStyle.ICON,
  },
  {
    id: 'icon-settings',
    name: 'Settings Gear',
    description: 'Gear/cog icon for settings',
    category: 'Icons',
    prompt: 'A gear/cog settings icon, smooth edges, centered, single color',
    style: ArtStyle.ICON,
  },
  {
    id: 'icon-notification',
    name: 'Bell Notification',
    description: 'Notification bell with alert dot',
    category: 'Icons',
    prompt: 'A notification bell icon with a small red alert dot in the top right, clean lines',
    style: ArtStyle.ICON,
  },
  {
    id: 'icon-search',
    name: 'Search Magnifier',
    description: 'Magnifying glass search icon',
    category: 'Icons',
    prompt: 'A magnifying glass search icon, round lens with handle, simple and bold',
    style: ArtStyle.ICON,
  },
  {
    id: 'icon-heart',
    name: 'Heart',
    description: 'Simple heart shape icon',
    category: 'Icons',
    prompt: 'A perfectly symmetric heart icon, filled, rounded, centered',
    style: ArtStyle.ICON,
  },
  // Logos
  {
    id: 'logo-mountain',
    name: 'Mountain Peak',
    description: 'Mountain landscape logo for outdoor brands',
    category: 'Logos',
    prompt: 'A mountain peak logo with sun rising behind it, clean geometric shapes, two-tone color',
    style: ArtStyle.LOGO,
  },
  {
    id: 'logo-tech',
    name: 'Tech Startup',
    description: 'Modern tech company logo with abstract geometry',
    category: 'Logos',
    prompt: 'An abstract geometric logo for a tech startup, interconnected triangles forming a letter T, gradient blue to purple',
    style: ArtStyle.LOGO,
  },
  {
    id: 'logo-coffee',
    name: 'Coffee Shop',
    description: 'Cozy coffee shop round logo',
    category: 'Logos',
    prompt: 'A round coffee shop logo with a steaming coffee cup in the center, vintage style, warm brown tones',
    style: ArtStyle.LOGO,
  },
  {
    id: 'logo-leaf',
    name: 'Eco Leaf',
    description: 'Green leaf logo for eco brands',
    category: 'Logos',
    prompt: 'A single elegant leaf logo, green gradient, curved stem, organic and clean',
    style: ArtStyle.LOGO,
  },
  // Patterns
  {
    id: 'pattern-waves',
    name: 'Ocean Waves',
    description: 'Repeating wave pattern',
    category: 'Patterns',
    prompt: 'A seamless repeating ocean wave pattern, Japanese ukiyo-e style, blue and white',
    style: ArtStyle.LINE_ART,
  },
  {
    id: 'pattern-geometric',
    name: 'Geometric Tiles',
    description: 'Tessellating geometric tile pattern',
    category: 'Patterns',
    prompt: 'A seamless geometric tessellation pattern with hexagons and triangles, modern flat colors',
    style: ArtStyle.FLAT,
  },
  {
    id: 'pattern-flora',
    name: 'Floral',
    description: 'Repeating flower and vine pattern',
    category: 'Patterns',
    prompt: 'A delicate floral pattern with small flowers and curving vines, pastel colors on white background',
    style: ArtStyle.LINE_ART,
  },
  // Illustrations
  {
    id: 'illust-rocket',
    name: 'Rocket Ship',
    description: 'Colorful cartoon rocket in space',
    category: 'Illustrations',
    prompt: 'A colorful cartoon rocket ship flying through space with stars and a planet in the background',
    style: ArtStyle.CARTOON,
  },
  {
    id: 'illust-city',
    name: 'City Skyline',
    description: 'Modern city skyline at sunset',
    category: 'Illustrations',
    prompt: 'A modern city skyline silhouette at sunset, gradient orange to purple sky, building reflections',
    style: ArtStyle.GRADIENT,
  },
  {
    id: 'illust-cat',
    name: 'Sitting Cat',
    description: 'Cute cartoon cat illustration',
    category: 'Illustrations',
    prompt: 'A cute cartoon cat sitting and looking up, big eyes, simple shapes, warm colors',
    style: ArtStyle.CARTOON,
  },
  {
    id: 'illust-tree',
    name: 'Abstract Tree',
    description: 'Artistic tree with swirling branches',
    category: 'Illustrations',
    prompt: 'An abstract tree of life with swirling colorful branches and leaves, vibrant gradient colors',
    style: ArtStyle.ABSTRACT,
  },
  // UI Elements
  {
    id: 'ui-button',
    name: 'Action Button',
    description: 'Rounded CTA button with gradient',
    category: 'UI Elements',
    prompt: 'A rounded call-to-action button with gradient from blue to purple, white text saying "Get Started", subtle shadow',
    style: ArtStyle.GRADIENT,
  },
  {
    id: 'ui-avatar',
    name: 'Avatar Placeholder',
    description: 'Default user avatar circle',
    category: 'UI Elements',
    prompt: 'A default user avatar placeholder, circular, gray silhouette of a person head and shoulders',
    style: ArtStyle.FLAT,
  },
  {
    id: 'ui-loading',
    name: 'Loading Spinner',
    description: 'Animated loading spinner',
    category: 'UI Elements',
    prompt: 'A circular loading spinner with a gradient trail, animated spinning motion, modern blue color',
    style: ArtStyle.GRADIENT,
  },
  {
    id: 'ui-badge',
    name: 'Status Badge',
    description: 'Green success status badge',
    category: 'UI Elements',
    prompt: 'A small rounded status badge with a green checkmark and the text "Active", pill shape',
    style: ArtStyle.FLAT,
  },
  // Pixel Art
  {
    id: 'pixel-sword',
    name: 'Pixel Sword',
    description: '8-bit style sword',
    category: 'Icons',
    prompt: 'An 8-bit pixel art sword, retro game style, silver blade with gold handle',
    style: ArtStyle.PIXEL,
  },
  {
    id: 'pixel-potion',
    name: 'Pixel Potion',
    description: '8-bit potion bottle',
    category: 'Icons',
    prompt: 'An 8-bit pixel art potion bottle, glowing red liquid, cork stopper, retro RPG style',
    style: ArtStyle.PIXEL,
  },
];

export const templateCategories = ['Icons', 'Logos', 'Patterns', 'Illustrations', 'UI Elements'] as const;
