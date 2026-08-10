// Simple color extraction utility for React Native
// This provides basic color analysis without heavy dependencies

export interface ColorInfo {
    hex: string;
    name: string;
    rgb: { r: number; g: number; b: number };
}

// Basic color mapping for common colors
const colorMap: { [key: string]: string } = {
    // Reds
    '#FF0000': 'Red',
    '#DC143C': 'Crimson',
    '#B22222': 'Fire Brick',
    '#8B0000': 'Dark Red',
    '#CD5C5C': 'Indian Red',
    '#F08080': 'Light Coral',
    '#FA8072': 'Salmon',
    '#E9967A': 'Dark Salmon',
    '#FFA07A': 'Light Salmon',

    // Blues
    '#0000FF': 'Blue',
    '#000080': 'Navy',
    '#191970': 'Midnight Blue',
    '#4169E1': 'Royal Blue',
    '#0000CD': 'Medium Blue',
    '#00008B': 'Dark Blue',
    '#6495ED': 'Cornflower Blue',
    '#87CEEB': 'Sky Blue',
    '#87CEFA': 'Light Sky Blue',
    '#ADD8E6': 'Light Blue',
    '#B0E0E6': 'Powder Blue',
    '#AFEEEE': 'Pale Turquoise',
    '#00CED1': 'Dark Turquoise',
    '#48D1CC': 'Medium Turquoise',
    '#40E0D0': 'Turquoise',
    '#00FFFF': 'Cyan',
    '#E0FFFF': 'Light Cyan',

    // Greens
    '#008000': 'Green',
    '#00FF00': 'Lime',
    '#32CD32': 'Lime Green',
    '#00FF7F': 'Spring Green',
    '#90EE90': 'Light Green',
    '#98FB98': 'Pale Green',
    '#8FBC8F': 'Dark Sea Green',
    '#20B2AA': 'Light Sea Green',
    '#00FA9A': 'Medium Spring Green',
    '#228B22': 'Forest Green',
    '#006400': 'Dark Green',
    '#9ACD32': 'Yellow Green',
    '#6B8E23': 'Olive Drab',
    '#808000': 'Olive',
    '#556B2F': 'Dark Olive Green',

    // Yellows
    '#FFFF00': 'Yellow',
    '#FFD700': 'Gold',
    '#FFFFE0': 'Light Yellow',
    '#FFFACD': 'Lemon Chiffon',
    '#F0E68C': 'Khaki',
    '#BDB76B': 'Dark Khaki',
    '#EEE8AA': 'Pale Goldenrod',
    '#DAA520': 'Goldenrod',
    '#B8860B': 'Dark Goldenrod',

    // Oranges
    '#FFA500': 'Orange',
    '#FF8C00': 'Dark Orange',
    '#FF7F50': 'Coral',
    '#FF6347': 'Tomato',
    '#FF4500': 'Orange Red',
    '#FFE4B5': 'Moccasin',
    '#FFDEAD': 'Navajo White',
    '#F5DEB3': 'Wheat',
    '#DEB887': 'Burlywood',
    '#D2B48C': 'Tan',

    // Purples
    '#800080': 'Purple',
    '#8B008B': 'Dark Magenta',
    '#9400D3': 'Violet',
    '#9932CC': 'Dark Orchid',
    '#BA55D3': 'Medium Orchid',
    '#DA70D6': 'Orchid',
    '#EE82EE': 'Violet',
    '#DDA0DD': 'Plum',
    '#C71585': 'Medium Violet Red',
    '#DB7093': 'Pale Violet Red',

    // Pinks
    '#FFC0CB': 'Pink',
    '#FFB6C1': 'Light Pink',
    '#FF69B4': 'Hot Pink',
    '#FF1493': 'Deep Pink',
   

    // Browns
    '#A52A2A': 'Brown',
    '#8B4513': 'Saddle Brown',
    '#D2691E': 'Chocolate',
    '#CD853F': 'Peru',
    '#F4A460': 'Sandy Brown',
    '#BC8F8F': 'Rosy Brown',

    // Grays
    '#808080': 'Gray',
    '#A9A9A9': 'Dark Gray',
    '#C0C0C0': 'Silver',
    '#D3D3D3': 'Light Gray',
    '#DCDCDC': 'Gainsboro',
    '#F5F5F5': 'White Smoke',
    '#000000': 'Black',
    '#FFFFFF': 'White',
};

// Convert RGB to Hex
export const rgbToHex = (r: number, g: number, b: number): string => {
    return "#" + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1).toUpperCase();
};

// Convert Hex to RGB
export const hexToRgb = (hex: string): { r: number; g: number; b: number } | null => {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result ? {
        r: parseInt(result[1], 16),
        g: parseInt(result[2], 16),
        b: parseInt(result[3], 16)
    } : null;
};

// Get closest color name
export const getColorName = (hex: string): string => {
    const upperHex = hex.toUpperCase();

    // Direct match
    if (colorMap[upperHex]) {
        return colorMap[upperHex];
    }

    // Find closest color
    const rgb = hexToRgb(hex);
    if (!rgb) return 'Unknown';

    let closestColor = 'Unknown';
    let minDistance = Infinity;

    Object.entries(colorMap).forEach(([colorHex, colorName]) => {
        const colorRgb = hexToRgb(colorHex);
        if (colorRgb) {
            const distance = Math.sqrt(
                Math.pow(rgb.r - colorRgb.r, 2) +
                Math.pow(rgb.g - colorRgb.g, 2) +
                Math.pow(rgb.b - colorRgb.b, 2)
            );

            if (distance < minDistance) {
                minDistance = distance;
                closestColor = colorName;
            }
        }
    });

    return closestColor;
};

// Analyze color brightness
export const getColorBrightness = (hex: string): 'light' | 'dark' => {
    const rgb = hexToRgb(hex);
    if (!rgb) return 'dark';

    // Calculate perceived brightness using the luminance formula
    const brightness = (rgb.r * 299 + rgb.g * 587 + rgb.b * 114) / 1000;
    return brightness > 128 ? 'light' : 'dark';
};

// Get complementary colors
export const getComplementaryColors = (baseColors: string[]): string[] => {
    const complementary: string[] = [];

    baseColors.forEach(color => {
        const rgb = hexToRgb(color);
        if (rgb) {
            // Simple complementary color calculation
            const compR = 255 - rgb.r;
            const compG = 255 - rgb.g;
            const compB = 255 - rgb.b;

            const compHex = rgbToHex(compR, compG, compB);
            const compName = getColorName(compHex);

            if (!complementary.includes(compName)) {
                complementary.push(compName);
            }
        }
    });

    return complementary;
};

// Get analogous colors (colors next to each other on color wheel)
export const getAnalogousColors = (baseColor: string): string[] => {
    const analogous: string[] = [];
    const rgb = hexToRgb(baseColor);

    if (rgb) {
        // Simple analogous color generation
        const variations = [
            { r: Math.min(255, rgb.r + 30), g: rgb.g, b: rgb.b },
            { r: Math.max(0, rgb.r - 30), g: rgb.g, b: rgb.b },
            { r: rgb.r, g: Math.min(255, rgb.g + 30), b: rgb.b },
            { r: rgb.r, g: Math.max(0, rgb.g - 30), b: rgb.b },
        ];

        variations.forEach(variation => {
            const hex = rgbToHex(variation.r, variation.g, variation.b);
            const name = getColorName(hex);
            if (!analogous.includes(name)) {
                analogous.push(name);
            }
        });
    }

    return analogous.slice(0, 3); // Return top 3
};

// Mock color extraction from image (since we can't actually analyze pixels in React Native without heavy libraries)
export const extractColorsFromImage = async (imageUri: string): Promise<ColorInfo[]> => {
    // This is a simplified version - in a real app, you'd use image processing libraries
    // For now, we'll return some common colors that might be found in typical venue photos

    const commonVenueColors: ColorInfo[] = [
        { hex: '#8B4513', name: 'Brown', rgb: { r: 139, g: 69, b: 19 } },
        { hex: '#F5DEB3', name: 'Wheat', rgb: { r: 245, g: 222, b: 179 } },
        { hex: '#2F4F4F', name: 'Dark Slate Gray', rgb: { r: 47, g: 79, b: 79 } },
        { hex: '#FFD700', name: 'Gold', rgb: { r: 255, g: 215, b: 0 } },
        { hex: '#800000', name: 'Maroon', rgb: { r: 128, g: 0, b: 0 } },
        { hex: '#000080', name: 'Navy', rgb: { r: 0, g: 0, b: 128 } },
        { hex: '#008000', name: 'Green', rgb: { r: 0, g: 128, b: 0 } },
        { hex: '#FFA500', name: 'Orange', rgb: { r: 255, g: 165, b: 0 } },
    ];

    // Return a random selection of 3-4 colors
    const shuffled = commonVenueColors.sort(() => 0.5 - Math.random());
    return shuffled.slice(0, Math.floor(Math.random() * 2) + 3);
};

// Generate outfit colors based on venue colors
export const generateOutfitColors = (venueColors: ColorInfo[]): string[] => {
    const outfitColors: string[] = [];

    venueColors.forEach(color => {
        // Add complementary colors
        const complementary = getComplementaryColors([color.hex]);
        outfitColors.push(...complementary);

        // Add analogous colors
        const analogous = getAnalogousColors(color.hex);
        outfitColors.push(...analogous);
    });

    // Add some neutral colors that work with everything
    const neutrals = ['White', 'Black', 'Gray', 'Navy', 'Beige', 'Cream'];
    outfitColors.push(...neutrals);

    // Remove duplicates and return top 6
    const uniqueColors = [...new Set(outfitColors)];
    return uniqueColors.slice(0, 6);
};

// --- Color string helpers (hex codes AND plain color names) ---
// Gemini's dominantColors output sometimes returns hex codes ("#FF5733") and
// sometimes color names ("Navy Blue"). These helpers resolve either form into a
// swatch-able hex + a human-readable label, so UI can render the actual color.

// Normalize a color name for lookups (lowercase, spaces removed).
const normName = (name: string): string => name.toLowerCase().replace(/\s+/g, '');

// Invert the hex→name map so names can be resolved back to a swatch color.
const nameToHexMap: Record<string, string> = {};
Object.entries(colorMap).forEach(([hex, name]) => {
    const key = normName(name);
    if (!nameToHexMap[key]) nameToHexMap[key] = hex;
});

// Extra common fashion/venue color names not covered by colorMap.
const extraColorNames: Record<string, string> = {
    beige: '#F5F5DC',
    cream: '#FFFDD0',
    ivory: '#FFFFF0',
    maroon: '#800000',
    burgundy: '#800020',
    charcoal: '#36454F',
    teal: '#008080',
    emerald: '#50C878',
    mustard: '#FFDB58',
    terracotta: '#E2725B',
    rose: '#FF007F',
    lavender: '#E6E6FA',
    peach: '#FFDAB9',
    mint: '#98FF98',
    'off white': '#F8F8F8',
    'navy blue': '#000080',
    grey: '#808080',
    nude: '#E3BC9A',
    'dark navy': '#000080',
    'light beige': '#F5F5DC',
    // Compound colors Gemini commonly returns for venue/outfit analysis
    'burnt orange': '#CC5500',
    'charcoal black': '#36454F',
    'olive green': '#808000',
    'forest green': '#228B22',
    'dark green': '#006400',
    'light green': '#90EE90',
    'dark blue': '#00008B',
    'light blue': '#ADD8E6',
    'sky blue': '#87CEEB',
    'dark red': '#8B0000',
    'light pink': '#FFB6C1',
    'hot pink': '#FF69B4',
    'baby blue': '#89CFF0',
    'baby pink': '#F4C2C2',
    'dusty pink': '#DCAE96',
    'wine red': '#722F37',
    'wine': '#722F37',
    'sand': '#C2B280',
    'khaki': '#C3B091',
    'tan': '#D2B48C',
    'taupe': '#483C32',
    'stone': '#928E85',
    'rust': '#B7410E',
    'coral': '#FF7F50',
    'mauve': '#E0B0FF',
    'plum': '#8E4585',
    'sage': '#B2AC88',
    'camel': '#C19A6B',
    'caramel': '#FFD59A',
    'chocolate': '#7B3F00',
    'bronze': '#CD7F32',
    'copper': '#B87333',
    'gold': '#FFD700',
    'silver': '#C0C0C0',
    'slate': '#708090',
    'periwinkle': '#CCCCFF',
    'mint green': '#98FF98',
    'olive': '#808000',
    'burgundy red': '#800020',
    'dark grey': '#A9A9A9',
    'light grey': '#D3D3D3',
    'blush': '#DE5D83',
    'champagne': '#F7E7CE',
    // Modifier + base color phrases Gemini commonly returns for venue/outfit
    // analysis. Exact matches beat the substring fallback, so "Rose Gold"
    // renders as rose-gold, not plain gold. (The old code fell back to
    // substring matching which collapsed these to their base hue.)
    'rose gold': '#B76E79',
    'dusty rose': '#C08081',
    'ivory white': '#FFFFF0',
    'off-white': '#F8F8F8',
    'deep red': '#8B0000',
    'deep green': '#006400',
    'sage green': '#B2AC88',
    'dark brown': '#5C4033',
    'light brown': '#C4A484',
    'golden yellow': '#FFD700',
    'pale gold': '#F0D9B5',
    'metallic gold': '#D4AF37',
    'dark burgundy': '#800020',
    'smoke grey': '#8B8B8B',
    'smoke gray': '#8B8B8B',
    'dark teal': '#006060',
    'midnight blue': '#191970',
    'emerald green': '#50C878',
    'royal blue': '#4169E1',
    'navy green': '#2F4F4F',
    'charcoal grey': '#36454F',
    'charcoal gray': '#36454F',
    'warm grey': '#8C8C8C',
    'warm gray': '#8C8C8C',
    'cream white': '#FFFDD0',
    'off black': '#1A1A1A',
    'white gold': '#E8E6E0',
    'champagne gold': '#F7E7CE',
    'rust orange': '#C4551C',
};
Object.entries(extraColorNames).forEach(([name, hex]) => {
    nameToHexMap[normName(name)] = hex;
});

// Normalize any hex-ish string to #RRGGBB (accepts #RGB, RRGGBB, 0x…), else null.
export const normalizeHex = (value: string): string | null => {
    let hex = (value || '').trim().replace(/^0x/i, '#');
    if (!/^#/.test(hex)) hex = '#' + hex;
    if (/^#[a-f\d]{3}$/i.test(hex)) {
        hex = '#' + hex[1] + hex[1] + hex[2] + hex[2] + hex[3] + hex[3];
    }
    return /^#[a-f\d]{6}$/i.test(hex) ? hex.toLowerCase() : null;
};

// Resolve any color string (hex or name) to a valid #RRGGBB hex for a swatch.
// Tries exact name match first, then falls back to substring matching so that
// compound Gemini names like "burnt orange" → "orange", "charcoal black" → "charcoal".
// Handles multi-color strings ("Burgundy & Gold") by resolving the first segment.
export const colorToHex = (value: string): string | null => {
    if (!value) return null;
    const normalized = normalizeHex(value);
    if (normalized) return normalized;
    const key = normName(value.trim());
    // 1. Exact match
    if (nameToHexMap[key]) return nameToHexMap[key];
    // 1b. Multi-color strings ("Burgundy & Gold", "black / white", "red+gold") —
    //     resolve the first segment that is a known color so a combined venue
    //     palette still renders a sensible swatch instead of a fallback gray.
    if (/[&+/|,]/.test(value) || /\band\b/i.test(value)) {
        const segments = value.split(/&|\+|\/|\||,|\band\b/i).map(s => s.trim()).filter(Boolean);
        for (const seg of segments) {
            const segKey = normName(seg);
            if (nameToHexMap[segKey]) return nameToHexMap[segKey];
        }
        for (const seg of segments) {
            const sub = colorToHex(seg);
            if (sub) return sub;
        }
    }
    // 2. Substring match — pick the longest known name that is contained in the input
    let bestHex = '';
    let bestLen = 0;
    Object.entries(nameToHexMap).forEach(([name, hex]) => {
        if (name.length >= 3 && key.length > name.length && key.includes(name) && name.length > bestLen) {
            bestLen = name.length;
            bestHex = hex;
        }
    });
    if (bestHex) return bestHex;
    // 3. Reverse substring — input is contained in a known name (e.g. "red" in "darkred").
    //    Only used when nothing above matched; pick the SHORTEST containing name so a
    //    bare token like "golden" resolves to "goldenrod", not the longest "pale goldenrod".
    let revHex = '';
    let revLen = Infinity;
    Object.entries(nameToHexMap).forEach(([name, hex]) => {
        if (name.length >= 3 && name.includes(key) && name.length < revLen) {
            revLen = name.length;
            revHex = hex;
        }
    });
    return revHex || null;
};

// Human-readable label for a color string — never a raw hex code. Hex input is
// converted to its nearest color name; named input passes through as-is.
export const resolveColorLabel = (value: string): string => {
    if (!value) return 'n/a';
    const normalized = normalizeHex(value);
    if (normalized) {
        const name = getColorName(normalized);
        return name && name !== 'Unknown' ? name : normalized;
    }
    return value.trim();
};