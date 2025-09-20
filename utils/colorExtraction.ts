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