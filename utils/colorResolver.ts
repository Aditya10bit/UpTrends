// utils/colorResolver.ts

export const colorMap: { [key: string]: string } = {
  // Primaries & Basics
  red: '#ef4444',
  blue: '#3b82f6',
  green: '#10b981',
  yellow: '#f59e0b',
  purple: '#8b5cf6',
  pink: '#ec4899',
  orange: '#f97316',
  black: '#1f2937',
  white: '#f9fafb',
  gray: '#6b7280',
  grey: '#6b7280',
  brown: '#92400e',
  navy: '#1e3a8a',
  
  // Earthy / Tonal / Pastel neutrals
  beige: '#d2b48c',
  cream: '#fffdd0',
  ivory: '#fffff0',
  sand: '#e2caaa',
  camel: '#c19a6b',
  tan: '#d2b48c',
  khaki: '#c3b091',
  taupe: '#b9a896',
  wheat: '#f5deb3',
  charcoal: '#36454f',
  slate: '#708090',

  // Greens
  olive: '#808000',
  'olive green': '#556b2f',
  'forest green': '#228b22',
  'sage green': '#9cac9a',
  'mint green': '#a0ffe6',
  'emerald green': '#50c878',
  'moss green': '#8a9a5b',
  'pine green': '#01796f',
  lime: '#00ff00',
  mint: '#98ff98',
  emerald: '#50c878',

  // Yellows & Golds
  'mustard yellow': '#e1ad01',
  mustard: '#e1ad01',
  gold: '#ffd700',
  'rose gold': '#b76e79',
  bronze: '#cd7f32',
  copper: '#b87333',
  champagne: '#f7e7ce',

  // Blues
  'sky blue': '#87ceeb',
  'baby blue': '#89cff0',
  'powder blue': '#b0e0e6',
  'royal blue': '#4169e1',
  'electric blue': '#7df9ff',
  indigo: '#4b0082',
  turquoise: '#40e0d0',
  cyan: '#00ffff',
  teal: '#008080',

  // Reds / Pinks / Purples
  maroon: '#800000',
  burgundy: '#800020',
  crimson: '#dc143c',
  ruby: '#e0115f',
  coral: '#ff7f50',
  salmon: '#fa8072',
  peach: '#ffdab9',
  apricot: '#fbceb1',
  terracotta: '#e2725b',
  lavender: '#e6e6fa',
  lilac: '#c8a2c8',
  plum: '#8e4585',
  mauve: '#e0b0ff',
  fuchsia: '#ff00ff',
  magenta: '#ff00ff',
  violet: '#ee82ee',
};

export const getColorCode = (colorName: string): string => {
  if (!colorName) return '#6b7280';
  
  const normalized = colorName.toLowerCase().trim();
  
  // 1. Direct match
  if (colorMap[normalized]) {
    return colorMap[normalized];
  }

  // 2. Hex code match (e.g. "#ff0000" or "ff0000")
  if (normalized.startsWith('#') && (normalized.length === 7 || normalized.length === 4)) {
    return colorName;
  }
  if (normalized.length === 6 && /^[0-9a-f]{6}$/.test(normalized)) {
    return `#${colorName}`;
  }

  // 3. Substring matching (e.g. "dark mustard yellow" -> matches "mustard")
  for (const [name, code] of Object.entries(colorMap)) {
    if (normalized.includes(name) || (normalized.length >= 3 && name.includes(normalized))) {
      return code;
    }
  }

  // 4. Broad category fallback matching (e.g. if name contains "green")
  const categories = [
    { key: 'navy', color: '#1e3a8a' },
    { key: 'blue', color: '#3b82f6' },
    { key: 'green', color: '#10b981' },
    { key: 'red', color: '#ef4444' },
    { key: 'yellow', color: '#f59e0b' },
    { key: 'pink', color: '#ec4899' },
    { key: 'orange', color: '#f97316' },
    { key: 'purple', color: '#8b5cf6' },
    { key: 'violet', color: '#ee82ee' },
    { key: 'lavender', color: '#e6e6fa' },
    { key: 'brown', color: '#92400e' },
    { key: 'gold', color: '#ffd700' },
    { key: 'silver', color: '#9ca3af' },
    { key: 'gray', color: '#6b7280' },
    { key: 'grey', color: '#6b7280' },
    { key: 'white', color: '#f9fafb' },
    { key: 'black', color: '#1f2937' },
    { key: 'cream', color: '#fffdd0' },
    { key: 'beige', color: '#d2b48c' },
    { key: 'khaki', color: '#c3b091' },
    { key: 'olive', color: '#808000' }
  ];

  for (const cat of categories) {
    if (normalized.includes(cat.key)) {
      return cat.color;
    }
  }

  return '#6b7280'; // default gray
};

export interface HSL {
  h: number; // 0-360
  s: number; // 0-100
  l: number; // 0-100
}

export const hexToHSL = (hex: string): HSL => {
  let r = 0, g = 0, b = 0;
  let cleanHex = hex.replace('#', '').trim();
  if (cleanHex.length === 3) {
    cleanHex = cleanHex.split('').map(char => char + char).join('');
  }
  if (cleanHex.length === 6) {
    r = parseInt(cleanHex.substring(0, 2), 16) / 255;
    g = parseInt(cleanHex.substring(2, 4), 16) / 255;
    b = parseInt(cleanHex.substring(4, 6), 16) / 255;
  } else {
    return { h: 0, s: 0, l: 50 };
  }

  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  let h = 0;
  let s = 0;
  const l = (max + min) / 2;

  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r: h = (g - b) / d + (g < b ? 6 : 0); break;
      case g: h = (b - r) / d + 2; break;
      case b: h = (r - g) / d + 4; break;
    }
    h /= 6;
  }

  return {
    h: Math.round(h * 360),
    s: Math.round(s * 100),
    l: Math.round(l * 100)
  };
};

export const detectHarmony = (colors: string[]): { type: string; description: string } => {
  const hslList = colors.map(c => hexToHSL(getColorCode(c)));
  
  // Filter out neutral/grayscale colors (saturation < 15 or lightness < 15 or lightness > 85)
  const vibrantHues = hslList
    .filter(hsl => hsl.s > 15 && hsl.l > 15 && hsl.l < 85)
    .map(hsl => hsl.h)
    .sort((a, b) => a - b);

  if (vibrantHues.length === 0) {
    return { 
      type: 'Neutral Harmony', 
      description: 'Sophisticated, classic look styled with clean, timeless neutrals (black, white, gray, or soft earthy beige).' 
    };
  }

  if (vibrantHues.length === 1) {
    return { 
      type: 'Minimalist Pop', 
      description: 'A clean neutral palette anchored by a single vibrant accent color to focus visual attention.' 
    };
  }

  // 2 Vibrant colors
  if (vibrantHues.length === 2) {
    const diff = Math.abs(vibrantHues[0] - vibrantHues[1]);
    const shortestDiff = Math.min(diff, 360 - diff);
    if (shortestDiff > 140 && shortestDiff < 220) {
      return { 
        type: 'Complementary Harmony', 
        description: 'Opposite colors on the wheel, creating a high-energy, high-contrast look that highlights both shades.' 
      };
    }
    if (shortestDiff < 60) {
      return { 
        type: 'Analogous Harmony', 
        description: 'Adjacent colors on the wheel, offering a highly harmonious, naturally cohesive, and calming look.' 
      };
    }
  }

  // 3 or more vibrant colors
  if (vibrantHues.length >= 3) {
    // Check triadic (roughly 120 deg apart)
    const diff1 = Math.abs(vibrantHues[0] - vibrantHues[1]);
    const diff2 = Math.abs(vibrantHues[1] - vibrantHues[2]);
    const shortestDiff1 = Math.min(diff1, 360 - diff1);
    const shortestDiff2 = Math.min(diff2, 360 - diff2);
    if (shortestDiff1 > 90 && shortestDiff1 < 150 && shortestDiff2 > 90 && shortestDiff2 < 150) {
      return { 
        type: 'Triadic Harmony', 
        description: 'Three vibrant colors spaced evenly around the wheel, creating a bold, playful, and balanced outfit.' 
      };
    }
    // Check analogous
    let maxInterval = 0;
    for (let i = 0; i < vibrantHues.length; i++) {
      const next = vibrantHues[(i + 1) % vibrantHues.length];
      const diff = Math.abs(vibrantHues[i] - next);
      const interval = Math.min(diff, 360 - diff);
      maxInterval = Math.max(maxInterval, interval);
    }
    if (maxInterval < 75) {
      return { 
        type: 'Analogous Harmony', 
        description: 'Adjacent shades blending smoothly together for a sophisticated, unified aesthetic.' 
      };
    }
  }

  return { 
    type: 'Tonal Contrast Harmony', 
    description: 'A carefully curated contrast of warm and cool shades that balance and elevate each other.' 
  };
};
