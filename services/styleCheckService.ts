import { GoogleGenerativeAI } from '@google/generative-ai';

import { getSecureApiKey } from '../config/security';

const API_KEY = getSecureApiKey();

const genAI = new GoogleGenerativeAI(API_KEY);

// Enhanced rate limiter for better model usage
class StyleCheckRateLimiter {
  private calls: number[] = [];
  private readonly maxCalls = 20; // Increased for Gemini 1.5 Pro
  private readonly timeWindow = 60000; // 1 minute

  canMakeCall(): boolean {
    const now = Date.now();
    this.calls = this.calls.filter(time => now - time < this.timeWindow);
    return this.calls.length < this.maxCalls;
  }

  recordCall(): void {
    this.calls.push(Date.now());
  }

  getTimeUntilNextCall(): number {
    if (this.canMakeCall()) return 0;
    const oldestCall = Math.min(...this.calls);
    return this.timeWindow - (Date.now() - oldestCall);
  }
}

const styleCheckRateLimiter = new StyleCheckRateLimiter();

// Core interfaces for Style Check AI
export interface StyleCheckInput {
  outfitImage: string;
  venueImage?: string;
  userProfile: {
    gender: string;
    height: number;
    weight: number;
    bodyType: string;
    skinTone: string;
    age?: number;
  };
}

export interface StyleCheckResult {
  overallRating: number;
  categoryRatings: {
    colorHarmony: number;
    fitAndSilhouette: number;
    occasionAppropriate: number;
    accessoriesBalance: number;
    styleCoherence: number;
  };
  analysis: {
    strengths: string[];
    improvements: string[];
    recommendations: string[];
    missingItems: string[];
    colorSuggestions: string[];
  };
  venueMatch: {
    score: number;
    feedback: string;
    suggestions: string[];
  };
  shoppingLinks: ShoppingCategory[];
}

export interface ShoppingCategory {
  category: string;
  items: ShoppingItem[];
}

export interface ShoppingItem {
  name: string;
  url: string;
  platform: string;
  priceRange?: 'budget' | 'mid' | 'premium';
}

// Convert image to base64
const imageToBase64 = async (uri: string): Promise<string> => {
  const response = await fetch(uri);
  const blob = await response.blob();
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const base64 = reader.result as string;
      resolve(base64.split(',')[1]); // Remove data:image/jpeg;base64, prefix
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
};

// Main Style Check AI Analysis Function
export const analyzeOutfitRating = async (input: StyleCheckInput): Promise<StyleCheckResult> => {
  // Check rate limit
  if (!styleCheckRateLimiter.canMakeCall()) {
    const waitTime = Math.ceil(styleCheckRateLimiter.getTimeUntilNextCall() / 1000);
    throw new Error(`Rate limit exceeded. Please wait ${waitTime} seconds before trying again.`);
  }

  try {
    // Use Gemini 1.5 Pro for superior analysis
    const model = genAI.getGenerativeModel({ model: 'gemini-1.5-pro' });

    styleCheckRateLimiter.recordCall();

    // Convert images to base64
    const outfitImageBase64 = await imageToBase64(input.outfitImage);
    const venueImageBase64 = input.venueImage ? await imageToBase64(input.venueImage) : null;

    // Create image parts for the model
    const imageParts = [
      {
        inlineData: {
          data: outfitImageBase64,
          mimeType: 'image/jpeg',
        },
      },
    ];

    if (venueImageBase64) {
      imageParts.push({
        inlineData: {
          data: venueImageBase64,
          mimeType: 'image/jpeg',
        },
      });
    }

    const analysisPrompt = `You are a world-class fashion stylist and image consultant with expertise in color theory, body proportions, occasion dressing, and style analysis. Analyze the provided outfit photo${input.venueImage ? ' and venue photo' : ''} for a comprehensive style assessment.

USER PROFILE:
- Gender: ${input.userProfile.gender}
- Height: ${input.userProfile.height}cm
- Weight: ${input.userProfile.weight}kg
- Body Type: ${input.userProfile.bodyType}
- Skin Tone: ${input.userProfile.skinTone}
${input.userProfile.age ? `- Age: ${input.userProfile.age}` : ''}

ANALYSIS REQUIREMENTS:

1. OVERALL RATING (0-100): Comprehensive style score based on all factors

2. CATEGORY RATINGS (0-100 each):
   - Color Harmony: How well colors work together and with skin tone
   - Fit & Silhouette: How well clothes fit the body type and proportions
   - Occasion Appropriate: ${input.venueImage ? 'How suitable for the venue shown' : 'General appropriateness and versatility'}
   - Accessories Balance: Jewelry, bags, shoes coordination and proportion
   - Style Coherence: Overall style consistency and aesthetic unity

3. DETAILED ANALYSIS:
   - Strengths: What's working exceptionally well (4-6 specific points)
   - Improvements: Areas that need refinement (3-5 constructive points)
   - Recommendations: Specific actionable styling advice (6-8 detailed points)
   - Missing Items: What accessories/pieces would complete or elevate the look
   - Color Suggestions: Better color choices that complement the skin tone and outfit

4. VENUE MATCH ANALYSIS${input.venueImage ? ' (based on venue photo)' : ' (general assessment)'}:
   - Score: 0-100 appropriateness rating for the setting
   - Feedback: Detailed venue-outfit compatibility analysis
   - Suggestions: Specific ways to better match the occasion/venue

5. SHOPPING RECOMMENDATIONS:
   Generate specific shopping categories with targeted item suggestions:
   - Accessories (jewelry, bags, belts, scarves)
   - Footwear (specific shoe types and styles)
   - Clothing (complementary pieces, layering options)
   - Color-specific items (pieces in recommended colors)
   - Styling tools (belts, hair accessories, etc.)

CRITICAL INSTRUCTIONS:
- Be constructive and encouraging, never harsh or negative
- Consider the user's body type and skin tone in all recommendations
- Provide specific, actionable advice rather than generic suggestions
- Focus on achievable improvements and realistic styling goals
- Include both immediate fixes and longer-term style development
- IMPORTANT: ALL recommendations must be appropriate for ${input.userProfile.gender} gender ONLY
- Do NOT suggest clothing, accessories, or styling that is typically associated with other genders
- Ensure all shopping recommendations are gender-appropriate for ${input.userProfile.gender} individuals

CRITICAL: Return ONLY valid JSON without any markdown formatting, code blocks, or additional text. Do not use backticks or markdown markers.

FORMAT YOUR RESPONSE AS VALID JSON:
{
  "overallRating": number,
  "categoryRatings": {
    "colorHarmony": number,
    "fitAndSilhouette": number,
    "occasionAppropriate": number,
    "accessoriesBalance": number,
    "styleCoherence": number
  },
  "analysis": {
    "strengths": ["strength1", "strength2", "strength3", "strength4"],
    "improvements": ["improvement1", "improvement2", "improvement3"],
    "recommendations": ["rec1", "rec2", "rec3", "rec4", "rec5", "rec6"],
    "missingItems": ["item1", "item2", "item3"],
    "colorSuggestions": ["color1", "color2", "color3", "color4"]
  },
  "venueMatch": {
    "score": number,
    "feedback": "detailed feedback about venue appropriateness",
    "suggestions": ["suggestion1", "suggestion2", "suggestion3"]
  },
  "shoppingLinks": [
    {
      "category": "Accessories",
      "items": [
        {"name": "Statement Necklace", "url": "placeholder", "platform": "Amazon", "priceRange": "mid"},
        {"name": "Leather Belt", "url": "placeholder", "platform": "Zara", "priceRange": "mid"}
      ]
    },
    {
      "category": "Footwear", 
      "items": [
        {"name": "Block Heel Sandals", "url": "placeholder", "platform": "H&M", "priceRange": "budget"},
        {"name": "Classic Loafers", "url": "placeholder", "platform": "Nordstrom", "priceRange": "premium"}
      ]
    }
  ]
}

IMPORTANT: Return pure JSON only. No markdown, no code blocks, no additional text. Be specific, professional, and focus on actionable advice.`;

    const result = await model.generateContent([analysisPrompt, ...imageParts]);
    const responseText = result.response.text();

    // Clean and parse JSON response
    let cleanedResponse = responseText
      .replace(/```json\n?/g, '')
      .replace(/```\n?/g, '')
      .replace(/```/g, '')
      .trim();

    // Remove any markdown formatting and extra characters
    cleanedResponse = cleanedResponse
      .replace(/\*\*(.*?)\*\*/g, '$1')
      .replace(/\*(.*?)\*/g, '$1')
      .replace(/`(.*?)`/g, '$1');

    try {
      // Try to extract JSON from the response if it's embedded in text
      const jsonMatch = cleanedResponse.match(/\{[\s\S]*\}/);
      const jsonString = jsonMatch ? jsonMatch[0] : cleanedResponse;

      const parsedResult = JSON.parse(jsonString);

      // Validate and enhance the result
      const enhancedResult = enhanceShoppingLinks(parsedResult);

      return enhancedResult;
    } catch (parseError) {
      console.error('JSON Parse Error:', parseError);
      console.log('Raw response:', responseText);
      console.log('Cleaned response:', cleanedResponse);

      // Try one more time with a different approach
      try {
        // Remove everything before the first { and after the last }
        const startIndex = responseText.indexOf('{');
        const endIndex = responseText.lastIndexOf('}');

        if (startIndex !== -1 && endIndex !== -1 && endIndex > startIndex) {
          const extractedJson = responseText.substring(startIndex, endIndex + 1);
          const parsedResult = JSON.parse(extractedJson);
          const enhancedResult = enhanceShoppingLinks(parsedResult);
          return enhancedResult;
        }
      } catch (secondParseError) {
        console.error('Second JSON Parse attempt failed:', secondParseError);
      }

      // Fallback response
      return createFallbackResponse(input.userProfile);
    }
  } catch (error) {
    console.error('Style Check Analysis Error:', error);
    throw new Error('Unable to analyze your style. Please try again.');
  }
};

// Enhance shopping links with real URLs
const enhanceShoppingLinks = (result: any): StyleCheckResult => {
  const enhancedShoppingLinks = result.shoppingLinks?.map((category: any) => ({
    ...category,
    items: category.items?.map((item: any) => ({
      ...item,
      url: generateShoppingUrl(item.name, item.platform),
    })) || [],
  })) || [];

  return {
    ...result,
    shoppingLinks: enhancedShoppingLinks,
  };
};

// Generate actual shopping URLs
const generateShoppingUrl = (itemName: string, platform: string): string => {
  const encodedItem = encodeURIComponent(itemName);

  const platformUrls: { [key: string]: string } = {
    'Amazon': `https://www.amazon.com/s?k=${encodedItem}`,
    'Myntra': `https://www.myntra.com/search/${encodedItem}`,
    'Zara': `https://www.zara.com/search?searchTerm=${encodedItem}`,
    'H&M': `https://www2.hm.com/en_us/search-results.html?q=${encodedItem}`,
    'ASOS': `https://www.asos.com/search/?q=${encodedItem}`,
    'Nordstrom': `https://www.nordstrom.com/sr?keyword=${encodedItem}`,
    'Uniqlo': `https://www.uniqlo.com/us/en/search?q=${encodedItem}`,
    'Pinterest': `https://www.pinterest.com/search/pins/?q=${encodedItem}%20fashion`,
    'Google Shopping': `https://www.google.com/search?tbm=shop&q=${encodedItem}`,
    'Google Images': `https://www.google.com/search?tbm=isch&q=${encodedItem}%20fashion`,
  };

  return platformUrls[platform] || platformUrls['Google Shopping'];
};

// Fallback response when AI fails
const createFallbackResponse = (userProfile: any): StyleCheckResult => {
  return {
    overallRating: 75,
    categoryRatings: {
      colorHarmony: 70,
      fitAndSilhouette: 80,
      occasionAppropriate: 75,
      accessoriesBalance: 70,
      styleCoherence: 75,
    },
    analysis: {
      strengths: [
        'Good basic outfit foundation',
        'Colors complement your skin tone',
        'Appropriate fit for your body type',
        'Well-coordinated overall look',
      ],
      improvements: [
        'Consider adding statement accessories',
        'Experiment with different textures',
        'Try layering for more visual interest',
      ],
      recommendations: [
        'Add a structured blazer for polish',
        'Include a statement necklace or watch',
        'Consider shoes that complement the outfit color',
        'Try a belt to define your waist',
        'Add a pop of color with accessories',
        'Experiment with different silhouettes',
      ],
      missingItems: [
        'Statement jewelry',
        'Structured outerwear',
        'Complementary footwear',
      ],
      colorSuggestions: [
        'Deep blues for sophistication',
        'Warm earth tones for your skin',
        'Classic neutrals for versatility',
        'Jewel tones for special occasions',
      ],
    },
    venueMatch: {
      score: 75,
      feedback: 'Your outfit has good versatility and can work for various occasions with minor adjustments.',
      suggestions: [
        'Add formal accessories for business settings',
        'Include casual elements for relaxed environments',
        'Consider the venue dress code and atmosphere',
      ],
    },
    shoppingLinks: [
      {
        category: 'Accessories',
        items: [
          { name: 'Statement Necklace', url: 'https://www.amazon.com/s?k=statement+necklace', platform: 'Amazon' },
          { name: 'Classic Watch', url: 'https://www.amazon.com/s?k=classic+watch', platform: 'Amazon' },
        ],
      },
      {
        category: 'Outerwear',
        items: [
          { name: 'Structured Blazer', url: 'https://www.zara.com/search?searchTerm=blazer', platform: 'Zara' },
          { name: 'Cardigan', url: 'https://www2.hm.com/en_us/search-results.html?q=cardigan', platform: 'H&M' },
        ],
      },
    ],
  };
};

// Additional utility functions for style analysis
export const getStyleTips = (bodyType: string, skinTone: string): string[] => {
  const tips: string[] = [];

  // Body type specific tips
  switch (bodyType.toLowerCase()) {
    case 'hourglass':
      tips.push('Emphasize your waist with belts and fitted styles');
      tips.push('Choose clothes that follow your natural silhouette');
      break;
    case 'pear':
      tips.push('Draw attention upward with statement tops');
      tips.push('Choose A-line skirts and wide-leg pants');
      break;
    case 'apple':
      tips.push('Create vertical lines with long cardigans');
      tips.push('Choose empire waist dresses and tops');
      break;
    case 'rectangle':
      tips.push('Create curves with peplum tops and belts');
      tips.push('Add volume with ruffles and textures');
      break;
    case 'athletic':
      tips.push('Soften your silhouette with flowing fabrics');
      tips.push('Add feminine details like lace or florals');
      break;
  }

  // Skin tone specific tips
  switch (skinTone.toLowerCase()) {
    case 'fair':
      tips.push('Cool blues and soft pinks complement your skin');
      tips.push('Avoid colors that wash you out');
      break;
    case 'wheatish':
      tips.push('Warm earth tones and jewel colors look great');
      tips.push('Golden yellows and rich browns enhance your glow');
      break;
    case 'dusky':
      tips.push('Bold colors and deep jewel tones are perfect');
      tips.push('Rich purples and emerald greens are stunning');
      break;
    case 'dark':
      tips.push('Bright colors and metallics look amazing');
      tips.push('Pure whites and vibrant hues create beautiful contrast');
      break;
  }

  return tips;
};

export const generateColorPalette = (skinTone: string): string[] => {
  const palettes: { [key: string]: string[] } = {
    fair: ['#E8F4FD', '#B8E6B8', '#FFB6C1', '#E6E6FA', '#F0F8FF'],
    wheatish: ['#DEB887', '#CD853F', '#DAA520', '#B8860B', '#F4A460'],
    dusky: ['#8B4513', '#A0522D', '#CD853F', '#D2691E', '#BC8F8F'],
    dark: ['#FFFFFF', '#FFD700', '#FF6347', '#00CED1', '#9370DB'],
  };

  return palettes[skinTone.toLowerCase()] || palettes.fair;
};

// Image quality validation
export const validateImageQuality = (imageUri: string): Promise<{ isValid: boolean; message?: string }> => {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');

      if (!ctx) {
        resolve({ isValid: false, message: 'Unable to process image' });
        return;
      }

      canvas.width = img.width;
      canvas.height = img.height;
      ctx.drawImage(img, 0, 0);

      // Basic quality checks
      const minWidth = 300;
      const minHeight = 400;

      if (img.width < minWidth || img.height < minHeight) {
        resolve({
          isValid: false,
          message: `Image too small. Please use an image at least ${minWidth}x${minHeight} pixels.`
        });
        return;
      }

      resolve({ isValid: true });
    };

    img.onerror = () => {
      resolve({ isValid: false, message: 'Invalid image format' });
    };

    img.src = imageUri;
  });
};