import { GoogleGenerativeAI } from '@google/generative-ai';
import { geminiRateLimiter, getSecureApiKey } from '../config/security';

const API_KEY = getSecureApiKey();
const genAI = new GoogleGenerativeAI(API_KEY);

export interface UserProfile {
  height?: number;
  weight?: number;
  skinTone?: string;
  bodyType?: string;
  gender?: string;
}

export interface OutfitCombination {
  name: string;
  items: string[];
  colors: string[];
  styleRating: number;
  bodyTypeMatch: number;
  occasion: string;
  reasoning: string;
  stylingTips: string[];
}

export interface WardrobeAnalysis {
  totalItems: number;
  colorPalette: string[];
  styleCategories: string[];
  combinations: OutfitCombination[];
  bodyTypeRecommendations: string[];
  missingItems: string[];
  overallScore: number;
}

// Body type styling rules for better recommendations
const getBodyTypeStylingRules = (bodyType: string, height: number, weight: number): string => {
  const bmi = weight / ((height / 100) ** 2);
  let rules = '';

  switch (bodyType?.toLowerCase()) {
    case 'slim':
      rules = `
        - Add volume and layers to create curves
        - Horizontal stripes and patterns work well
        - Light colors and textures add dimension
        - Avoid overly tight clothing
        - Layer pieces to add visual weight
      `;
      break;

    case 'athletic':
      rules = `
        - Emphasize the waist with belts and fitted pieces
        - Softer fabrics balance muscular build
        - V-necks and scoop necks are flattering
        - Avoid boxy or oversized tops
        - Show off toned arms and legs appropriately
      `;
      break;

    case 'heavy':
      rules = `
        - Monochromatic outfits create a streamlined look
        - Dark colors are slimming and elegant
        - Vertical lines and patterns elongate the figure
        - Well-fitted clothing is more flattering than loose
        - Strategic layering can define the waist
        - Avoid horizontal stripes and busy patterns
      `;
      break;

    case 'average':
    default:
      rules = `
        - Most styles work well, focus on personal preference
        - Experiment with different silhouettes
        - Balance proportions with strategic styling
        - Mix textures and patterns confidently
        - Use accessories to add personality
      `;
      break;
  }

  // Height-specific adjustments
  if (height < 160) {
    rules += `
      HEIGHT ADJUSTMENTS (Petite):
      - Avoid oversized pieces that overwhelm
      - High-waisted bottoms elongate legs
      - Vertical lines and monochromatic looks add height
      - Cropped jackets and tops work well
      - Avoid long, flowing pieces
    `;
  } else if (height > 175) {
    rules += `
      HEIGHT ADJUSTMENTS (Tall):
      - Can wear longer pieces and maxi styles
      - Horizontal elements break up height nicely
      - Layering works exceptionally well
      - Wide-leg pants and longer tops are flattering
      - Can handle bold patterns and oversized pieces
    `;
  }

  // BMI-specific adjustments
  if (bmi > 25) {
    rules += `
      BODY COMPOSITION TIPS:
      - Focus on fit over size - well-tailored is key
      - Dark, solid colors are universally flattering
      - Strategic color blocking can define shape
      - Avoid clingy fabrics, choose structured pieces
      - Use accessories to draw attention to best features
    `;
  }

  return rules;
};

// Skin tone color recommendations
const getSkinToneColorRules = (skinTone: string): string => {
  switch (skinTone?.toLowerCase()) {
    case 'fair':
      return `
        BEST COLORS: Pastels, jewel tones, navy, burgundy, emerald green
        AVOID: Very bright colors, neon shades, colors that wash you out
        NEUTRALS: Cream, soft white, light gray, camel
      `;

    case 'wheatish':
      return `
        BEST COLORS: Earth tones, warm colors, coral, peach, golden yellow, olive green
        AVOID: Very pale colors, cool blues, stark white
        NEUTRALS: Warm beige, chocolate brown, warm gray, ivory
      `;

    case 'dusky':
      return `
        BEST COLORS: Rich, vibrant colors, jewel tones, bright blues, deep purples
        AVOID: Very pale pastels, colors that blend with skin tone
        NEUTRALS: Charcoal, deep brown, warm black, cream
      `;

    case 'dark':
      return `
        BEST COLORS: Bright, bold colors, white, electric blue, hot pink, emerald
        AVOID: Very dark colors that blend, muddy tones
        NEUTRALS: Pure white, bright gray, camel, navy
      `;

    default:
      return `
        UNIVERSAL COLORS: Navy, white, black, gray work for most skin tones
        EXPERIMENT: Try different shades to see what makes you glow
      `;
  }
};

export const generateWardrobeOutfits = async (
  clothingImages: string[],
  userProfile: UserProfile
): Promise<WardrobeAnalysis> => {
  // Check rate limit
  if (!geminiRateLimiter.canMakeCall()) {
    const waitTime = Math.ceil(geminiRateLimiter.getTimeUntilNextCall() / 1000);
    throw new Error(`Rate limit exceeded. Please wait ${waitTime} seconds before trying again.`);
  }

  try {
    const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });

    // Convert images to base64
    const imageParts = await Promise.all(
      clothingImages.map(async (imageUri) => {
        const response = await fetch(imageUri);
        const blob = await response.blob();
        const base64 = await blobToBase64(blob);

        return {
          inlineData: {
            data: base64.split(',')[1],
            mimeType: blob.type,
          },
        };
      })
    );

    // Get styling rules based on user profile
    const bodyTypeRules = getBodyTypeStylingRules(
      userProfile.bodyType || 'average',
      userProfile.height || 170,
      userProfile.weight || 65
    );

    const skinToneRules = getSkinToneColorRules(userProfile.skinTone || 'fair');

    const analysisPrompt = `
Analyze these clothing items and create personalized outfit combinations.

USER PROFILE:
- Height: ${userProfile.height || 170}cm
- Weight: ${userProfile.weight || 65}kg  
- Body Type: ${userProfile.bodyType || 'Average'}
- Skin Tone: ${userProfile.skinTone || 'Fair'}
- Gender: ${userProfile.gender || 'Male'}

CRITICAL GENDER REQUIREMENTS:
- ALL outfit combinations MUST be appropriate for ${userProfile.gender || 'Male'} gender ONLY
- Do NOT suggest any clothing combinations that include items typically worn by other genders
- Ensure all styling advice and recommendations are gender-appropriate for ${userProfile.gender || 'Male'}
- Use ${userProfile.gender || 'Male'}-specific fashion terminology and styling advice
- NEVER suggest cross-gender clothing items under any circumstances
- If gender is "male": NO dresses, skirts, heels, feminine jewelry, makeup, or women's accessories
- If gender is "female": NO men's suits, ties, masculine shoes, or men's accessories

BODY TYPE STYLING RULES:
${bodyTypeRules}

SKIN TONE COLOR RULES:
${skinToneRules}

Please analyze the clothing items and provide recommendations in this JSON format:
{
  "totalItems": number,
  "colorPalette": ["color1", "color2", "color3"],
  "styleCategories": ["category1", "category2"],
  "combinations": [
    {
      "name": "Outfit name",
      "items": ["item1", "item2", "item3"],
      "colors": ["color1", "color2"],
      "styleRating": 85,
      "bodyTypeMatch": 90,
      "occasion": "casual/formal/party",
      "reasoning": "Why this works for the user's body type and style",
      "stylingTips": ["tip1", "tip2"]
    }
  ],
  "bodyTypeRecommendations": ["recommendation1", "recommendation2"],
  "missingItems": ["item1", "item2"],
  "overallScore": 88
}

IMPORTANT GUIDELINES:
1. Create 4-6 outfit combinations maximum
2. Consider the user's body type, height, and weight for each recommendation
3. Suggest colors that complement their skin tone
4. Provide specific styling tips for their body type
5. Rate each outfit's suitability for their body type (1-100)
6. Suggest missing wardrobe items that would enhance their options
7. Focus on flattering silhouettes and proportions
8. Consider the user's gender and style preferences

Make sure the response is valid JSON only, no additional text.
`;

    const result = await model.generateContent([analysisPrompt, ...imageParts]);
    const responseText = result.response.text();

    const cleanedResponse = responseText.replace(/```json\n?|\n?```/g, '').trim();

    try {
      return JSON.parse(cleanedResponse);
    } catch (parseError) {
      console.error('JSON Parse Error:', parseError);
      return generateFallbackWardrobeAnalysis(userProfile);
    }
  } catch (error) {
    console.error('Wardrobe Analysis Error:', error);
    throw new Error('Failed to analyze wardrobe and generate outfits');
  }
};

// Helper function to convert blob to base64
const blobToBase64 = (blob: Blob): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
};

// Helper function to categorize body types for styling recommendations
const categorizeBodyType = (bodyType: string, height?: number): { isSlimType: boolean, isHeavyType: boolean, isBalancedType: boolean } => {
  const type = bodyType?.toLowerCase() || '';

  // Slim/narrow body types
  const slimTypes = ['slim', 'rectangle', 'inverted triangle'];
  const isSlimType = slimTypes.includes(type) || (height !== undefined && height < 160);

  // Fuller/heavier body types  
  const heavyTypes = ['heavy', 'apple', 'oval'];
  const isHeavyType = heavyTypes.includes(type) || (height !== undefined && height > 175);

  // Balanced/curvy body types
  const balancedTypes = ['average', 'athletic', 'hourglass', 'pear', 'triangle'];
  const isBalancedType = balancedTypes.includes(type);

  return { isSlimType, isHeavyType, isBalancedType };
};

// Fallback response when API fails
const generateFallbackWardrobeAnalysis = (userProfile: UserProfile): WardrobeAnalysis => {
  const { isSlimType, isHeavyType, isBalancedType } = categorizeBodyType(userProfile.bodyType || 'average', userProfile.height);
  const gender = userProfile.gender?.toLowerCase() || 'male';

  if (gender === 'male') {
    return {
      totalItems: 8,
      colorPalette: ["Navy", "White", "Beige", "Black"],
      styleCategories: ["Casual", "Smart Casual"],
      combinations: [
        {
          name: isHeavyType ? "Men's Streamlined Monochrome" : isSlimType ? "Men's Layered Dimension" : "Men's Balanced Casual",
          items: isHeavyType ?
            ["Men's dark blazer", "Black pants", "White dress shirt"] :
            isSlimType ?
              ["Men's light cardigan", "Striped polo", "Jeans"] :
              ["Men's fitted shirt", "Chinos", "Casual blazer"],
          colors: isHeavyType ? ["Black", "White"] : isSlimType ? ["Navy", "White", "Beige"] : ["Navy", "Gray", "White"],
          styleRating: 85,
          bodyTypeMatch: 90,
          occasion: "casual",
          reasoning: isHeavyType ?
            "Monochromatic dark colors create a sleek, elongated silhouette for men" :
            isSlimType ?
              "Layering adds visual interest and dimension to your masculine frame" :
              "Balanced proportions allow for versatile styling options",
          stylingTips: isHeavyType ?
            ["Keep colors in the same family", "Choose well-fitted men's pieces"] :
            isSlimType ?
              ["Mix textures for depth", "Use horizontal stripes to add width"] :
              ["Emphasize your natural proportions", "Mix casual and smart elements"]
        },
        {
          name: "Men's Smart Professional",
          items: ["Men's tailored shirt", "Dress pants", "Men's leather shoes", "Belt"],
          colors: ["Navy", "White", "Brown"],
          styleRating: 88,
          bodyTypeMatch: 85,
          occasion: "formal",
          reasoning: "Classic men's combination that works for your body type",
          stylingTips: ["Ensure proper fit", "Match belt with shoe color", "Keep accessories minimal"]
        }
      ],
      bodyTypeRecommendations: [
        `For your ${userProfile.bodyType || 'average'} male body type, focus on well-fitted pieces`,
        "Consider masculine proportions when choosing silhouettes",
        "Use colors that complement your skin tone"
      ],
      missingItems: ["Men's versatile blazer", "Quality jeans", "Men's watch"],
      overallScore: 82
    };
  } else {
    return {
      totalItems: 8,
      colorPalette: ["Navy", "Pink", "Beige", "Black"],
      styleCategories: ["Casual", "Smart Casual"],
      combinations: [
        {
          name: isHeavyType ? "Women's Streamlined Elegance" : isSlimType ? "Women's Layered Dimension" : "Women's Balanced Chic",
          items: isHeavyType ?
            ["Women's dark blazer", "Black pants", "White blouse"] :
            isSlimType ?
              ["Women's light cardigan", "Striped top", "High-waisted jeans"] :
              ["Women's fitted blouse", "A-line skirt", "Statement jewelry"],
          colors: isHeavyType ? ["Black", "White"] : isSlimType ? ["Navy", "White", "Pink"] : ["Burgundy", "Cream", "Gold"],
          styleRating: 85,
          bodyTypeMatch: 90,
          occasion: "casual",
          reasoning: isHeavyType ?
            "Monochromatic dark colors create a sleek, elongated silhouette for women" :
            isSlimType ?
              "Layering adds visual interest and dimension to your feminine frame" :
              "Balanced proportions allow for versatile and flattering styling options",
          stylingTips: isHeavyType ?
            ["Keep colors in the same family", "Choose well-fitted women's pieces"] :
            isSlimType ?
              ["Mix textures for depth", "Use accessories to add personality"] :
              ["Emphasize your natural curves", "Play with proportions and silhouettes"]
        },
        {
          name: "Women's Smart Professional",
          items: ["Women's tailored blouse", "Dress pants", "Women's heels", "Handbag"],
          colors: ["Navy", "White", "Black"],
          styleRating: 88,
          bodyTypeMatch: 85,
          occasion: "formal",
          reasoning: "Classic women's combination that works for your body type",
          stylingTips: ["Ensure proper fit", "Choose comfortable heel height", "Keep accessories coordinated"]
        }
      ],
      bodyTypeRecommendations: [
        `For your ${userProfile.bodyType || 'average'} female body type, focus on well-fitted pieces`,
        "Consider feminine proportions when choosing silhouettes",
        "Use colors that complement your skin tone"
      ],
      missingItems: ["Women's versatile blazer", "Quality jeans", "Statement jewelry"],
      overallScore: 82
    };
  }
};