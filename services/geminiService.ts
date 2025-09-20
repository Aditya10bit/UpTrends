import { GoogleGenerativeAI } from '@google/generative-ai';
import { geminiRateLimiter, getSecureApiKey } from '../config/security';
import { trackAIRequest } from './analyticsService';
import { TopographyData } from './topographyService';

const API_KEY = getSecureApiKey();
const genAI = new GoogleGenerativeAI(API_KEY);

export interface OutfitSuggestion {
  style: string;
  colors: string[];
  outfit: string;
  accessories: string;
  mood: string;
  reasoning: string;
  shoppingLinks?: OutfitLink[];
}

export interface OutfitLink {
  platform: string;
  searchQuery: string;
  url: string;
  description: string;
}

export interface StyleAnalysisResult {
  venue: string;
  ambiance: string;
  dominantColors: string[];
  recommendations: OutfitSuggestion[];
  tips: string[];
  weatherConsiderations?: string;
  locationConsiderations?: string;
}

export interface BodyAnalysisResult {
  bodyType: 'Slim' | 'Average' | 'Athletic' | 'Heavy';
  skinTone: 'Fair' | 'Wheatish' | 'Dusky' | 'Dark';
  confidence: number;
  reasoning: string;
}

export const analyzeImageAndGenerateOutfits = async (
  imageUri: string,
  prompt: string,
  userProfile?: any
): Promise<StyleAnalysisResult> => {
  // Check rate limit
  if (!geminiRateLimiter.canMakeCall()) {
    const waitTime = Math.ceil(geminiRateLimiter.getTimeUntilNextCall() / 1000);
    throw new Error(`Rate limit exceeded. Please wait ${waitTime} seconds before trying again.`);
  }

  // Track AI request at the start
  trackAIRequest();

  // Retry logic for API overload
  const maxRetries = 3;
  let lastError;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      console.log(`Attempt ${attempt} of ${maxRetries} for Gemini API call`);

      // Try different models based on attempt
      let model;
      if (attempt === 1) {
        model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });
      } else if (attempt === 2) {
        model = genAI.getGenerativeModel({ model: 'gemini-pro-vision' });
      } else {
        model = genAI.getGenerativeModel({ model: 'gemini-pro' });
      }

      // Convert image to base64
      const response = await fetch(imageUri);
      const blob = await response.blob();
      const base64 = await blobToBase64(blob);

      const imagePart = {
        inlineData: {
          data: base64.split(',')[1], // Remove data:image/jpeg;base64, prefix
          mimeType: blob.type,
        },
      };

      const safePrompt = sanitizeForPrompt(prompt);

      // Build user profile context for personalized recommendations
      const userContext = userProfile ? buildUserProfileContext(userProfile) : '';

      const analysisPrompt = `
Analyze this image and the user's description: "${safePrompt}"

${userContext ? `User Profile Information:
${userContext}

Please consider the user's body type, height, skin tone, and gender when making recommendations.` : ''}

Please provide a detailed style analysis in the following JSON format:
{
  "venue": "Brief description of the place/venue type",
  "ambiance": "Description of the atmosphere and mood",
  "dominantColors": ["color1", "color2", "color3"],
  "recommendations": [
    {
      "style": "Style name (e.g., Smart Casual)",
      "colors": ["color1", "color2", "color3"],
      "outfit": "Specific outfit description listing concrete items and colors (e.g., 'black shirt + beige shorts + white sneakers')",
      "accessories": "Recommended accessories",
      "mood": "Mood/vibe of this outfit",
      "reasoning": "Why this works for this venue",
      "shoppingLinks": [
        {
          "platform": "Pinterest",
          "searchQuery": "<derive from outfit items; avoid generic examples>",
          "url": "https://www.pinterest.com/search/pins/?q=<URL_ENCODED_QUERY>",
          "description": "Outfit inspiration and styling ideas"
        },
        {
          "platform": "Amazon",
          "searchQuery": "<use 1-2 key items from outfit; avoid generic examples>",
          "url": "https://www.amazon.com/s?k=<URL_ENCODED_QUERY>",
          "description": "Shop similar items"
        }
      ]
    }
  ],
  "tips": ["tip1", "tip2", "tip3", "tip4"]
}

Focus on:
1. Extract the dominant colors from the image
2. Consider the venue's lighting and atmosphere
3. Match outfit colors that complement the environment AND the user's skin tone
4. Provide 3-4 different style options suitable for the user's body type
5. Consider the occasion described in the prompt
6. Give practical styling tips specific to the user's body type and height
7. Ensure all recommendations flatter the user's specific body shape and proportions

Rules for shopping links:
- DO NOT reuse generic examples like "navy blazer white shirt". Always derive queries from the actual outfit and user's prompt.
- For Amazon/Myntra: Use ONLY 1-2 specific items from the outfit (e.g., "black shirt", "white sneakers", "olive pants")
- For Pinterest: Use the full outfit description for inspiration searches
- NEVER search for the entire outfit as one query - break it down into individual items
- Focus on the most important clothing pieces that users would actually search for

Make sure the response is valid JSON only, no additional text.
`;

      const result = await model.generateContent([analysisPrompt, imagePart]);
      const responseText = result.response.text();

      // Clean the response to ensure it's valid JSON
      const cleanedResponse = responseText.replace(/```json\n?|\n?```/g, '').trim();

      try {
        const parsedResult = JSON.parse(cleanedResponse);
        console.log(`Successfully got response on attempt ${attempt}`);
        return parsedResult;
      } catch (parseError) {
        console.error('JSON Parse Error:', parseError);
        // If JSON parsing fails, try next attempt or fallback
        if (attempt === maxRetries) {
          return generateFallbackResponse(prompt, userProfile);
        }
        continue;
      }

    } catch (error: any) {
      console.error(`Gemini API Error (attempt ${attempt}):`, error);
      lastError = error;

      // Check if it's a 503 (overloaded) or rate limit error
      if (error.message?.includes('overloaded') || error.message?.includes('503') || error.message?.includes('429')) {
        console.log(`Model overloaded/rate limited, waiting before retry...`);
        await new Promise(resolve => setTimeout(resolve, 2000 * attempt)); // Exponential backoff
        continue;
      }

      // If it's not a retryable error, break the loop
      break;
    }
  }

  // If all retries failed, return fallback response
  console.error('All Gemini API attempts failed, using fallback response');
  return generateFallbackResponse(prompt, userProfile);
};

export const generateOutfitsFromPrompt = async (prompt: string, userProfile?: any): Promise<StyleAnalysisResult> => {
  // Check rate limit
  if (!geminiRateLimiter.canMakeCall()) {
    const waitTime = Math.ceil(geminiRateLimiter.getTimeUntilNextCall() / 1000);
    throw new Error(`Rate limit exceeded. Please wait ${waitTime} seconds before trying again.`);
  }

  try {
    const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });

    const safePrompt = sanitizeForPrompt(prompt);

    // Build user profile context for personalized recommendations
    const userContext = userProfile ? buildUserProfileContext(userProfile) : '';

    const analysisPrompt = `
Based on this description: "${safePrompt}"

${userContext ? `User Profile Information:
${userContext}

Please consider the user's body type, height, skin tone, and gender when making recommendations.` : ''}

Please provide outfit suggestions in the following JSON format:
{
  "venue": "Inferred venue type from description",
  "ambiance": "Inferred atmosphere and mood",
  "dominantColors": ["color1", "color2", "color3"],
  "recommendations": [
    {
      "style": "Style name",
      "colors": ["color1", "color2", "color3"],
      "outfit": "Specific outfit description with concrete items (e.g., 'black shirt + beige shorts + white sneakers')",
      "accessories": "Recommended accessories",
      "mood": "Mood/vibe of this outfit",
      "reasoning": "Why this works for this occasion",
      "shoppingLinks": [
        {
          "platform": "Pinterest",
          "searchQuery": "<derive from outfit items; avoid generic examples>",
          "url": "https://www.pinterest.com/search/pins/?q=<URL_ENCODED_QUERY>",
          "description": "Outfit inspiration and styling ideas"
        },
        {
          "platform": "Amazon",
          "searchQuery": "<use 1-2 key items from outfit; avoid generic examples>",
          "url": "https://www.amazon.com/s?k=<URL_ENCODED_QUERY>",
          "description": "Shop similar items"
        }
      ]
    }
  ],
  "tips": ["tip1", "tip2", "tip3", "tip4"]
}

Rules:
- Provide 3-4 different outfit recommendations suitable for the described occasion AND the user's body type
- For each outfit, generate 2-3 shopping/inspiration links
- Include Pinterest for inspiration, Amazon/Myntra for purchasing
- Make search queries specific and URL-encoded
- Ensure all URLs are properly formatted
- DO NOT reuse generic examples like "navy blazer white shirt"; derive from the actual outfit
- For Amazon/Myntra: Use ONLY 1-2 specific items from the outfit (e.g., "black shirt", "white sneakers")
- For Pinterest: Use the full outfit description for inspiration searches
- NEVER search for the entire outfit as one query - break it down into individual items
- Consider the user's height, body type, and skin tone when making recommendations
- Ensure all outfits will be flattering for the user's specific body shape

Make sure the response is valid JSON only, no additional text.
`;

    const result = await model.generateContent(analysisPrompt);
    const responseText = result.response.text();

    const cleanedResponse = responseText.replace(/```json\n?|\n?```/g, '').trim();

    try {
      return JSON.parse(cleanedResponse);
    } catch (parseError) {
      console.error('JSON Parse Error:', parseError);
      return generateFallbackResponse(prompt, userProfile);
    }
  } catch (error) {
    console.error('Gemini API Error:', error);
    throw new Error('Failed to generate outfit suggestions');
  }
};

// Helper function to build user profile context for personalized recommendations
const buildUserProfileContext = (userProfile: any): string => {
  const context = [];

  if (userProfile.gender) {
    context.push(`Gender: ${userProfile.gender}`);
  }
  if (userProfile.bodyType) {
    context.push(`Body Type: ${userProfile.bodyType}`);
  }
  if (userProfile.height) {
    context.push(`Height: ${userProfile.height}cm`);
  }
  if (userProfile.weight) {
    context.push(`Weight: ${userProfile.weight}kg`);
  }
  if (userProfile.skinTone) {
    context.push(`Skin Tone: ${userProfile.skinTone}`);
  }

  return context.join(', ');
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

export const generateOutfitLinks = async (outfitDescription: string, userPrompt?: string): Promise<OutfitLink[]> => {
  // Build deterministic, specific search links based on the outfit items and the user's prompt
  const core = normalizeOutfitToSearch(outfitDescription);
  const promptPart = sanitizeForPrompt(userPrompt || '');

  // Extract 1-2 key item phrases from the outfit for product-oriented search (avoid searching full outfit)
  const keyItems = extractKeyItems(core, 2);

  // For product searches (Amazon/Myntra), use only the key items without the prompt
  const productQuery = keyItems.join(' ').trim();

  // For inspiration searches (Pinterest/Google Images), use the full outfit description
  const inspirationQuery = [core, 'outfit', limitPromptTerms(promptPart, 5)].filter(Boolean).join(' ').trim();
  const googleImagesQuery = [core, 'outfit', limitPromptTerms(promptPart, 8)].filter(Boolean).join(' ').trim();

  const links: OutfitLink[] = [
    {
      platform: 'Pinterest',
      searchQuery: inspirationQuery,
      url: `https://www.pinterest.com/search/pins/?q=${encodeURIComponent(inspirationQuery)}`,
      description: 'Outfit inspiration and styling ideas'
    },
    {
      platform: 'Amazon',
      searchQuery: productQuery,
      url: `https://www.amazon.com/s?k=${encodeURIComponent(productQuery)}`,
      description: 'Shop similar items'
    },
    {
      platform: 'Google Images',
      searchQuery: googleImagesQuery,
      url: `https://www.google.com/search?tbm=isch&q=${encodeURIComponent(googleImagesQuery)}`,
      description: 'Visual outfit references'
    }
  ];

  return links;
};

// Convert an outfit description like "Black shirt + shorts" or
// "Navy blazer with white shirt and dark jeans" into a concise search string
const normalizeOutfitToSearch = (outfitDescription: string): string => {
  const lower = (outfitDescription || '').toLowerCase();
  const replaced = lower
    .replace(/[+/,]/g, ' ')
    .replace(/\bwith\b/g, ' ')
    .replace(/\band\b/g, ' ')
    .replace(/\bpaired with\b/g, ' ')
    .replace(/\bcombo\b/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  // Remove trailing/leading words like 'outfit' that add noise
  const cleaned = replaced.replace(/\boutfit\b/g, '').replace(/\s+/g, ' ').trim();
  return cleaned;
};

// Sanitize freeform user text to be safely embedded inside JSON/quoted prompts and URLs
const sanitizeForPrompt = (value: string): string => {
  if (!value) return '';
  // Collapse excessive whitespace, strip control characters, and escape quotes
  const collapsed = value.replace(/\s+/g, ' ').trim();
  // Remove any non-printable control chars except common whitespace
  const noControls = collapsed.replace(/[\u0000-\u001F\u007F]/g, '');
  // Avoid breaking JSON/interpolation by replacing double quotes with single quotes
  const safeQuotes = noControls.replace(/"/g, '\'');
  return safeQuotes;
};

// Extract 1-3 key item phrases to search shops for products
const extractKeyItems = (searchableOutfit: string, maxItems: number = 3): string[] => {
  if (!searchableOutfit) return [];

  // Define clothing items and colors to prioritize
  const clothingItems = new Set([
    'shirt', 't-shirt', 'tshirt', 'blouse', 'top', 'dress', 'pants', 'jeans', 'shorts', 'skirt',
    'blazer', 'jacket', 'coat', 'sweater', 'hoodie', 'cardigan', 'suit', 'trouser', 'chinos',
    'shoes', 'sneakers', 'boots', 'heels', 'flats', 'sandals', 'loafers', 'oxfords',
    'gown', 'jumpsuit', 'romper', 'playsuit', 'bodysuit', 'tank', 'crop', 'tunic', 'kurti',
    'salwar', 'lehenga', 'sari', 'dupatta', 'kurta', 'dhoti', 'sherwani', 'bandhgala'
  ]);

  const colors = new Set([
    'black', 'white', 'red', 'blue', 'navy', 'green', 'yellow', 'purple', 'pink', 'orange',
    'brown', 'beige', 'cream', 'gray', 'grey', 'silver', 'gold', 'olive', 'burgundy',
    'maroon', 'coral', 'teal', 'turquoise', 'lavender', 'mint', 'peach', 'tan', 'mustard',
    'rust', 'sage', 'indigo', 'plum', 'rose', 'copper', 'bronze', 'champagne'
  ]);

  const tokens = searchableOutfit.split(' ').filter(Boolean);
  const keyPhrases: string[] = [];

  // Look for color + item combinations first
  for (let i = 0; i < tokens.length - 1; i++) {
    const current = tokens[i];
    const next = tokens[i + 1];

    // Check if current is color and next is clothing item
    if (colors.has(current) && clothingItems.has(next)) {
      keyPhrases.push(`${current} ${next}`);
      if (keyPhrases.length >= maxItems) break;
    }
    // Check if current is clothing item and next is color
    else if (clothingItems.has(current) && colors.has(next)) {
      keyPhrases.push(`${current} ${next}`);
      if (keyPhrases.length >= maxItems) break;
    }
  }

  // If we don't have enough color+item combinations, add individual clothing items
  if (keyPhrases.length < maxItems) {
    for (const token of tokens) {
      if (clothingItems.has(token) && !keyPhrases.some(phrase => phrase.includes(token))) {
        keyPhrases.push(token);
        if (keyPhrases.length >= maxItems) break;
      }
    }
  }

  // If still not enough, add color + generic terms
  if (keyPhrases.length < maxItems) {
    for (const token of tokens) {
      if (colors.has(token) && !keyPhrases.some(phrase => phrase.includes(token))) {
        keyPhrases.push(token);
        if (keyPhrases.length >= maxItems) break;
      }
    }
  }

  // Ensure we have at least one item
  if (keyPhrases.length === 0 && tokens.length > 0) {
    keyPhrases.push(tokens[0]);
  }

  return keyPhrases.slice(0, maxItems);
};

// Limit the number of terms included from a user prompt for inspiration searches
const limitPromptTerms = (value: string, maxTerms: number): string => {
  const parts = (value || '').split(/\s+/).filter(Boolean);
  return parts.slice(0, maxTerms).join(' ');
};



// Fallback response when API fails
const generateFallbackResponse = (prompt: string, userProfile?: any): StyleAnalysisResult => {
  // Extract keywords from the prompt to make fallback more relevant
  const promptLower = prompt.toLowerCase();

  // Determine venue type from prompt
  let venue = "Based on your description";
  let ambiance = "Stylish and appropriate for the occasion";

  if (promptLower.includes('restaurant') || promptLower.includes('dining') || promptLower.includes('cafe')) {
    venue = "Restaurant/Cafe";
    ambiance = "Elegant dining atmosphere";
  } else if (promptLower.includes('office') || promptLower.includes('work') || promptLower.includes('business')) {
    venue = "Office/Workplace";
    ambiance = "Professional and polished";
  } else if (promptLower.includes('party') || promptLower.includes('celebration') || promptLower.includes('event')) {
    venue = "Party/Event";
    ambiance = "Festive and celebratory";
  } else if (promptLower.includes('casual') || promptLower.includes('everyday') || promptLower.includes('daily')) {
    venue = "Casual/Everyday";
    ambiance = "Comfortable and relaxed";
  } else if (promptLower.includes('formal') || promptLower.includes('wedding') || promptLower.includes('ceremony')) {
    venue = "Formal Event";
    ambiance = "Elegant and sophisticated";
  }

  // Generate outfit suggestions based on prompt keywords and user profile
  const outfitSuggestions = generateDynamicOutfits(promptLower, userProfile);

  return {
    venue,
    ambiance,
    dominantColors: outfitSuggestions.dominantColors,
    recommendations: outfitSuggestions.recommendations,
    tips: generatePersonalizedTips(userProfile)
  };
};

// Helper function to generate dynamic outfit suggestions based on prompt
const generateDynamicOutfits = (promptLower: string, userProfile?: any): { dominantColors: string[], recommendations: OutfitSuggestion[] } => {
  // Define different outfit themes based on prompt keywords
  let outfitThemes: Array<{ style: string, colors: string[], outfit: string, accessories: string, mood: string, reasoning: string }> = [];

  if (promptLower.includes('summer') || promptLower.includes('hot') || promptLower.includes('warm')) {
    outfitThemes = [
      {
        style: "Summer Casual",
        colors: ["White", "Beige", "Coral"],
        outfit: "White linen shirt + Beige shorts + Sandals",
        accessories: "Sunglasses, straw hat, light scarf",
        mood: "Fresh and breezy",
        reasoning: "Light colors and breathable fabrics for hot weather"
      },
      {
        style: "Summer Elegant",
        colors: ["Coral", "White", "Gold"],
        outfit: "Coral sundress + White sandals + Gold jewelry",
        accessories: "Wide-brim hat, crossbody bag",
        mood: "Effortlessly chic",
        reasoning: "Bright summer colors with elegant accessories"
      }
    ];
  } else if (promptLower.includes('winter') || promptLower.includes('cold') || promptLower.includes('snow')) {
    outfitThemes = [
      {
        style: "Winter Warm",
        colors: ["Navy", "Cream", "Brown"],
        outfit: "Navy sweater + Cream pants + Brown boots",
        accessories: "Scarf, beanie, warm coat",
        mood: "Cozy and warm",
        reasoning: "Layered look for cold weather comfort"
      },
      {
        style: "Winter Elegant",
        colors: ["Black", "Silver", "Red"],
        outfit: "Black coat + Silver accessories + Red lip",
        accessories: "Leather gloves, statement bag",
        mood: "Sophisticated winter glamour",
        reasoning: "Classic winter colors with elegant touches"
      }
    ];
  } else if (promptLower.includes('casual') || promptLower.includes('everyday')) {
    outfitThemes = [
      {
        style: "Casual Comfort",
        colors: ["Olive", "Beige", "White"],
        outfit: "Olive t-shirt + Beige jeans + White sneakers",
        accessories: "Watch, simple necklace, crossbody bag",
        mood: "Relaxed and comfortable",
        reasoning: "Easy everyday styling that looks put-together"
      },
      {
        style: "Smart Casual",
        colors: ["Navy", "White", "Brown"],
        outfit: "Navy polo + White chinos + Brown loafers",
        accessories: "Leather belt, watch, minimal jewelry",
        mood: "Polished casual",
        reasoning: "Elevated casual look for smart-casual occasions"
      }
    ];
  } else if (promptLower.includes('formal') || promptLower.includes('business') || promptLower.includes('office')) {
    outfitThemes = [
      {
        style: "Business Professional",
        colors: ["Navy", "White", "Gray"],
        outfit: "Navy blazer + White shirt + Gray pants",
        accessories: "Leather shoes, watch, professional bag",
        mood: "Confident and authoritative",
        reasoning: "Classic business attire for professional settings"
      },
      {
        style: "Business Elegant",
        colors: ["Black", "Cream", "Gold"],
        outfit: "Black dress + Cream blazer + Gold accessories",
        accessories: "Pumps, statement jewelry, structured bag",
        mood: "Sophisticated and powerful",
        reasoning: "Elegant business look that commands respect"
      }
    ];
  } else {
    // Default versatile outfits
    outfitThemes = [
      {
        style: "Versatile Classic",
        colors: ["Black", "White", "Beige"],
        outfit: "Black top + White pants + Beige shoes",
        accessories: "Simple jewelry, crossbody bag",
        mood: "Timeless and elegant",
        reasoning: "Classic combination that works for most occasions"
      },
      {
        style: "Colorful Modern",
        colors: ["Olive", "Coral", "Navy"],
        outfit: "Olive shirt + Coral accessories + Navy pants",
        accessories: "Statement earrings, colorful bag",
        mood: "Fresh and contemporary",
        reasoning: "Modern color combination that's both stylish and versatile"
      }
    ];
  }

  // Apply user profile considerations if available
  if (userProfile) {
    outfitThemes = outfitThemes.map(theme => {
      let enhancedReasoning = theme.reasoning;

      // Add body type specific reasoning
      if (userProfile.bodyType) {
        switch (userProfile.bodyType.toLowerCase()) {
          case 'slim':
            enhancedReasoning += ` Perfect for slim figures as it adds visual weight and creates curves.`;
            break;
          case 'athletic':
            enhancedReasoning += ` Ideal for athletic builds, emphasizing your toned physique.`;
            break;
          case 'heavy':
            enhancedReasoning += ` Flattering for your body type with strategic color blocking and fit.`;
            break;
          case 'hourglass':
            enhancedReasoning += ` Highlights your natural curves and defined waist.`;
            break;
          case 'pear':
            enhancedReasoning += ` Balances proportions by drawing attention upward.`;
            break;
          case 'apple':
            enhancedReasoning += ` Creates a streamlined silhouette with strategic styling.`;
            break;
        }
      }

      // Add height considerations
      if (userProfile.height) {
        if (userProfile.height < 160) {
          enhancedReasoning += ` Petite-friendly styling that elongates your frame.`;
        } else if (userProfile.height > 175) {
          enhancedReasoning += ` Takes advantage of your height with proportional styling.`;
        }
      }

      // Add skin tone considerations
      if (userProfile.skinTone) {
        enhancedReasoning += ` Colors chosen to complement your ${userProfile.skinTone} skin tone.`;
      }

      return {
        ...theme,
        reasoning: enhancedReasoning
      };
    });
  }

  // Generate shopping links for each outfit
  const recommendations = outfitThemes.map(theme => {
    const shoppingLinks = generateFallbackShoppingLinks(theme.outfit);
    return {
      ...theme,
      shoppingLinks
    };
  });

  // Extract dominant colors from all outfits
  const allColors = outfitThemes.flatMap(theme => theme.colors);
  const dominantColors = Array.from(new Set(allColors)).slice(0, 4);

  return { dominantColors, recommendations };
};

// Helper function to generate topography-aware fashion tips
const generateTopographyAwareTips = (topography: TopographyData, userProfile?: any): string[] => {
  const baseTips = [
    "Choose colors that complement your skin tone",
    "Consider the local climate and cultural context",
    "Comfort is key - you'll look better when you feel good",
    "Respect local cultural sensitivities while expressing your style"
  ];

  const locationTips = [...baseTips];

  // Add climate-specific tips
  switch (topography.climate) {
    case 'Tropical':
    case 'Equatorial':
      locationTips.push("Choose breathable fabrics like cotton and linen");
      locationTips.push("Light colors reflect heat and keep you cool");
      break;
    case 'Semi-arid':
      locationTips.push("Layer for temperature variations throughout the day");
      locationTips.push("Earth tones work well with the natural landscape");
      break;
    case 'Temperate':
      locationTips.push("Invest in quality layering pieces");
      locationTips.push("Darker colors work well in cooler climates");
      break;
  }

  // Add regional tips for India
  if (topography.region.includes('India')) {
    switch (topography.region) {
      case 'North India':
        locationTips.push("Mix traditional kurtas with modern bottoms for fusion style");
        locationTips.push("Statement jewelry elevates simple outfits");
        break;
      case 'South India':
        locationTips.push("Cotton is king - prioritize comfort in humid weather");
        locationTips.push("Traditional temple jewelry adds cultural elegance");
        break;
      case 'West India':
        locationTips.push("Dress for both business and monsoon weather");
        locationTips.push("Bollywood-inspired glamour is always appreciated");
        break;
      case 'East India':
        locationTips.push("Handloom and handwoven fabrics show cultural appreciation");
        locationTips.push("Artistic and intellectual casual styles work well");
        break;
    }

    // Add local fashion trend tips
    if (topography.localFashionTrends.length > 0) {
      locationTips.push(`Local trends to try: ${topography.localFashionTrends.slice(0, 2).join(' and ')}`);
    }
  }

  // Add user profile specific tips
  if (userProfile) {
    if (userProfile.bodyType) {
      switch (userProfile.bodyType.toLowerCase()) {
        case 'slim':
          locationTips.push("Layer pieces to add visual weight and create curves");
          break;
        case 'athletic':
          locationTips.push("Show off your toned physique with well-fitted clothing");
          break;
        case 'heavy':
          locationTips.push("Monochromatic outfits create a streamlined look");
          break;
      }
    }

    if (userProfile.skinTone) {
      switch (userProfile.skinTone.toLowerCase()) {
        case 'fair':
          locationTips.push("Pastels and soft colors complement your fair complexion");
          break;
        case 'wheatish':
          locationTips.push("Earth tones and warm colors enhance your natural glow");
          break;
        case 'dusky':
          locationTips.push("Rich jewel tones and deep colors look stunning on you");
          break;
        case 'dark':
          locationTips.push("Bright colors and metallics create beautiful contrast");
          break;
      }
    }
  }

  return locationTips.slice(0, 6); // Limit to 6 tips max
};

// Helper function to generate location considerations
const generateLocationConsiderations = (topography: TopographyData): string => {
  const considerations = [];

  considerations.push(`For ${topography.location}'s ${topography.climate} climate`);

  if (topography.terrain) {
    considerations.push(`consider the ${topography.terrain} when choosing footwear`);
  }

  if (topography.culturalStyle) {
    considerations.push(`embrace the ${topography.culturalStyle} aesthetic`);
  }

  if (topography.localFashionTrends.length > 0) {
    considerations.push(`incorporate local trends like ${topography.localFashionTrends[0]}`);
  }

  considerations.push(`and respect cultural sensitivities while expressing your personal style`);

  return considerations.join(', ') + '.';
};

// Helper function to generate personalized fashion tips based on user profile
const generatePersonalizedTips = (userProfile?: any): string[] => {
  const baseTips = [
    "Choose colors that complement your skin tone",
    "Consider the weather and time of day",
    "Comfort is key - you'll look better when you feel good",
    "Add one statement piece to elevate your look"
  ];

  if (!userProfile) return baseTips;

  const personalizedTips = [...baseTips];

  // Add body type specific tips
  if (userProfile.bodyType) {
    switch (userProfile.bodyType.toLowerCase()) {
      case 'slim':
        personalizedTips.push("Layer pieces to add visual weight and create curves");
        personalizedTips.push("Horizontal stripes and patterns work well for your frame");
        break;
      case 'athletic':
        personalizedTips.push("Emphasize your waist with belts and fitted pieces");
        personalizedTips.push("Show off your toned physique with well-fitted clothing");
        break;
      case 'heavy':
        personalizedTips.push("Monochromatic outfits create a streamlined look");
        personalizedTips.push("Vertical lines and patterns elongate your figure");
        break;
      case 'hourglass':
        personalizedTips.push("Highlight your natural curves with fitted silhouettes");
        personalizedTips.push("Belts and waist-defining pieces are your best friends");
        break;
      case 'pear':
        personalizedTips.push("Draw attention upward with statement tops and accessories");
        personalizedTips.push("A-line skirts and wide-leg pants balance your proportions");
        break;
      case 'apple':
        personalizedTips.push("Create definition with strategic layering and belts");
        personalizedTips.push("V-necks and scoop necks are flattering for your shape");
        break;
    }
  }

  // Add height specific tips
  if (userProfile.height) {
    if (userProfile.height < 160) {
      personalizedTips.push("High-waisted bottoms elongate your legs");
      personalizedTips.push("Avoid oversized pieces that overwhelm your frame");
    } else if (userProfile.height > 175) {
      personalizedTips.push("Take advantage of your height with maxi styles");
      personalizedTips.push("Layering works exceptionally well on your frame");
    }
  }

  // Add skin tone specific tips
  if (userProfile.skinTone) {
    switch (userProfile.skinTone.toLowerCase()) {
      case 'fair':
        personalizedTips.push("Pastels and soft colors complement your fair complexion");
        break;
      case 'wheatish':
        personalizedTips.push("Earth tones and warm colors enhance your natural glow");
        break;
      case 'dusky':
        personalizedTips.push("Rich jewel tones and deep colors look stunning on you");
        break;
      case 'dark':
        personalizedTips.push("Bright colors and metallics create beautiful contrast");
        break;
    }
  }

  return personalizedTips.slice(0, 6); // Limit to 6 tips max
};

// Helper function to generate shopping links for fallback outfits
const generateFallbackShoppingLinks = (outfit: string): OutfitLink[] => {
  // Extract key items from the outfit description
  const keyItems = extractKeyItems(outfit, 2);
  const searchQuery = keyItems.join(' ');

  return [
    {
      platform: "Pinterest",
      searchQuery: `${outfit} outfit inspiration`,
      url: `https://www.pinterest.com/search/pins/?q=${encodeURIComponent(outfit + ' outfit inspiration')}`,
      description: "Outfit inspiration and styling ideas"
    },
    {
      platform: "Amazon",
      searchQuery: searchQuery,
      url: `https://www.amazon.com/s?k=${encodeURIComponent(searchQuery)}`,
      description: "Shop similar items"
    },
    {
      platform: "Myntra",
      searchQuery: searchQuery,
      url: `https://www.myntra.com/search/${encodeURIComponent(searchQuery)}`,
      description: "Shop similar items on Myntra"
    }
  ];
};

export const getChatbotResponse = async (prompt: string): Promise<string> => {
  // Check rate limit
  if (!geminiRateLimiter.canMakeCall()) {
    const waitTime = Math.ceil(geminiRateLimiter.getTimeUntilNextCall() / 1000);
    throw new Error(`Rate limit exceeded. Please wait ${waitTime} seconds before trying again.`);
  }

  try {
    const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });

    const chatPrompt = `
You are StyleBuddy, a friendly and knowledgeable fashion chatbot assistant. You help users understand their body type and provide personalized fashion advice.

User query: "${prompt}"

Please respond in a conversational, friendly, and encouraging tone. Use emojis appropriately to make the conversation engaging. Keep responses concise but informative.

Guidelines:
- Be supportive and positive
- Use simple, easy-to-understand language
- Include practical fashion tips
- Add relevant emojis to make it engaging
- If providing fashion advice, be specific about colors, styles, and combinations
- If analyzing body types, be respectful and focus on styling benefits
- Keep responses under 300 words for better readability

Respond naturally as StyleBuddy would.
`;

    const result = await model.generateContent(chatPrompt);
    const responseText = result.response.text();

    // Clean up any markdown formatting
    const cleanedResponse = responseText
      .replace(/\*\*(.*?)\*\*/g, '$1') // Remove **bold**
      .replace(/\*(.*?)\*/g, '$1')     // Remove *italic*
      .replace(/__(.*?)__/g, '$1')     // Remove __underline__
      .replace(/`(.*?)`/g, '$1')       // Remove `code`
      .trim();

    return cleanedResponse;
  } catch (error) {
    console.error('Gemini Chatbot API Error:', error);
    return "I'm having trouble processing your request right now. Please try again in a moment! 😊";
  }
};

export const analyzeBodyImage = async (imageUri: string, customPrompt?: string): Promise<string> => {
  // Check rate limit
  if (!geminiRateLimiter.canMakeCall()) {
    const waitTime = Math.ceil(geminiRateLimiter.getTimeUntilNextCall() / 1000);
    throw new Error(`Rate limit exceeded. Please wait ${waitTime} seconds before trying again.`);
  }

  try {
    const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });

    // Convert image to base64
    const response = await fetch(imageUri);
    const blob = await response.blob();
    const base64 = await blobToBase64(blob);

    const imagePart = {
      inlineData: {
        data: base64.split(',')[1], // Remove data:image/jpeg;base64, prefix
        mimeType: blob.type,
      },
    };

    const analysisPrompt = customPrompt || `
Analyze this photo to determine the person's skin tone for fashion styling purposes. Be respectful and focus only on styling-relevant characteristics.

Please provide a brief, friendly analysis mentioning:
1. The skin tone (Fair, Wheatish, Dusky, or Dark)
2. A brief explanation
3. Some color recommendations that would complement this skin tone

Keep the response conversational and encouraging, as if you're StyleBuddy, a friendly fashion assistant. Use emojis appropriately.

Example format:
"Based on your photo, I can see you have a [skin tone] complexion! ✨ This means colors like [color suggestions] would look amazing on you. [Brief styling tip] 💫"

Keep it under 150 words and be positive and supportive.
`;

    const result = await model.generateContent([analysisPrompt, imagePart]);
    const responseText = result.response.text();

    // Clean up any markdown formatting
    const cleanedResponse = responseText
      .replace(/\*\*(.*?)\*\*/g, '$1') // Remove **bold**
      .replace(/\*(.*?)\*/g, '$1')     // Remove *italic*
      .replace(/__(.*?)__/g, '$1')     // Remove __underline__
      .replace(/`(.*?)`/g, '$1')       // Remove `code`
      .trim();

    return cleanedResponse;
  } catch (error: any) {
    console.error('Gemini Body Image Analysis Error:', error);

    // Check if it's a 503 error (model overloaded)
    if (error.message?.includes('503') || error.message?.includes('overloaded')) {
      return "I'm currently experiencing high demand and can't analyze your photo right now. 😅 Please try again in a few minutes, or you can select your skin tone manually from the options below! ✨";
    }

    // Check if it's a rate limit error
    if (error.message?.includes('Rate limit')) {
      return "I need a moment to catch my breath! 😊 Please wait a few seconds and try uploading your photo again, or select your skin tone manually. 📸";
    }

    // Generic error fallback
    return "I'm having trouble analyzing the photo right now. Could you try uploading a clearer image or select your skin tone manually? 📸✨";
  }
};

// New function specifically for venue analysis
export const analyzeVenueComprehensively = async (imageUri: string, category: string, context?: any): Promise<string> => {
  // Check rate limit
  if (!geminiRateLimiter.canMakeCall()) {
    const waitTime = Math.ceil(geminiRateLimiter.getTimeUntilNextCall() / 1000);
    throw new Error(`Rate limit exceeded. Please wait ${waitTime} seconds before trying again.`);
  }

  try {
    const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });

    // Convert image to base64
    const response = await fetch(imageUri);
    const blob = await response.blob();
    const base64 = await blobToBase64(blob);

    const imagePart = {
      inlineData: {
        data: base64.split(',')[1], // Remove data:image/jpeg;base64, prefix
        mimeType: blob.type,
      },
    };

    const analysisPrompt = `
Analyze this venue/location photo for fashion coordination purposes. This is for a ${category} occasion.

Context: ${JSON.stringify(context || {})}

REQUIRED ANALYSIS:
1. VENUE TYPE: Identify the type of location (restaurant, park, mall, home, office, hotel, etc.)
2. ATMOSPHERE: Describe the mood and ambiance (formal, casual, romantic, fun, elegant, etc.)
3. LIGHTING: Describe lighting conditions (natural daylight, warm ambient, cool bright, dim, etc.)
4. DOMINANT COLORS: List 3-4 main colors visible in the environment
5. STYLE: Interior/exterior design style (modern, classic, rustic, elegant, minimalist, etc.)
6. DRESS CODE: Appropriate formality level for this setting
7. AMBIANCE: Overall feel and energy of the space

FORMAT YOUR RESPONSE EXACTLY AS:
Venue Type: [specific venue type]
Atmosphere: [atmosphere description]
Lighting: [lighting description]
Dominant Colors: [color1, color2, color3, color4]
Style: [design style]
Dress Code: [appropriate dress code]
Ambiance: [overall ambiance]

Additional Analysis: [Provide detailed reasoning and fashion recommendations based on the venue analysis]

Focus on elements that will help coordinate outfits with the environment.
`;

    const result = await model.generateContent([analysisPrompt, imagePart]);
    const responseText = result.response.text();

    console.log('🏛️ Venue Analysis Response:', responseText); // Debug log

    return responseText.trim();
  } catch (error: any) {
    console.error('Gemini Venue Analysis Error:', error);

    // Check if it's a 503 error (model overloaded)
    if (error.message?.includes('503') || error.message?.includes('overloaded')) {
      return "I'm currently experiencing high demand and can't analyze the venue photo right now. 😅 Please try again in a few minutes or describe the venue manually!";
    }

    // Check if it's a rate limit error
    if (error.message?.includes('Rate limit')) {
      return "I need a moment to process! 😊 Please wait a few seconds and try uploading the venue photo again.";
    }

    // Generic error fallback
    return "I had trouble analyzing the venue photo. Please try uploading a clearer image or describe the venue manually for better recommendations!";
  }
};

// New function specifically for comprehensive body analysis
export const analyzePersonComprehensively = async (imageUri: string, name: string): Promise<string> => {
  // Check rate limit
  if (!geminiRateLimiter.canMakeCall()) {
    const waitTime = Math.ceil(geminiRateLimiter.getTimeUntilNextCall() / 1000);
    throw new Error(`Rate limit exceeded. Please wait ${waitTime} seconds before trying again.`);
  }

  try {
    const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });

    // Convert image to base64
    const response = await fetch(imageUri);
    const blob = await response.blob();
    const base64 = await blobToBase64(blob);

    const imagePart = {
      inlineData: {
        data: base64.split(',')[1], // Remove data:image/jpeg;base64, prefix
        mimeType: blob.type,
      },
    };

    const analysisPrompt = `
You are an expert fashion stylist and body type analyst. Analyze this person's photo comprehensively for fashion coordination purposes.

REQUIRED ANALYSIS:
1. GENDER: Identify if this person is male or female
2. BODY TYPE: 
   - For MALES: Athletic, Slim, Average, Heavy
   - For FEMALES: Hourglass, Pear, Apple, Rectangle, Inverted Triangle
3. SKIN TONE: Fair, Wheatish, Dusky, Dark
4. PHYSICAL FEATURES: Height impression, build, posture, notable features
5. STYLE ASSESSMENT: Current fashion sense and preferences visible in the photo
6. PERSONALITY TRAITS: Based on appearance, styling choices, and overall presentation

FORMAT YOUR RESPONSE EXACTLY AS:
Gender: [male/female]
Body Type: [specific body type from the list above]
Skin Tone: [Fair/Wheatish/Dusky/Dark]
Physical Features: [list 2-3 key physical features that affect clothing choices]
Style: [describe their current style in 1-2 sentences]
Traits: [list 3-4 personality traits separated by commas]
Confidence: [number from 1-100 based on photo quality and analysis certainty]

Additional Analysis: [Provide detailed reasoning for each assessment, explaining why you chose each classification]

Be professional, respectful, and focus only on fashion-relevant characteristics that will help with outfit coordination.
`;

    const result = await model.generateContent([analysisPrompt, imagePart]);
    const responseText = result.response.text();

    console.log('🔍 Gemini Analysis Response:', responseText); // Debug log

    return responseText.trim();
  } catch (error: any) {
    console.error('Gemini Comprehensive Analysis Error:', error);

    // Check if it's a 503 error (model overloaded)
    if (error.message?.includes('503') || error.message?.includes('overloaded')) {
      return `Gender: unknown
Body Type: Rectangle
Skin Tone: Fair
Physical Features: Unable to analyze due to high system demand
Style: Analysis temporarily unavailable
Traits: friendly, stylish, patient, understanding
Confidence: 0

Additional Analysis: I'm currently experiencing high demand and can't analyze your photo right now. 😅 Please try again in a few minutes, or you can provide this information manually. I've set some default values that you can update!`;
    }

    // Check if it's a rate limit error
    if (error.message?.includes('Rate limit')) {
      return `Gender: unknown
Body Type: Rectangle
Skin Tone: Fair
Physical Features: Analysis paused due to rate limiting
Style: Please try again shortly
Traits: patient, understanding, stylish, kind
Confidence: 0

Additional Analysis: I need a moment to process! 😊 Please wait a few seconds and try uploading your photo again, or provide the information manually.`;
    }

    // Generic error fallback
    return `Gender: unknown
Body Type: Rectangle
Skin Tone: Fair
Physical Features: Photo analysis unavailable
Style: Manual input recommended
Traits: stylish, unique, fashionable, confident
Confidence: 0

Additional Analysis: I had trouble analyzing your photo. Please try uploading a clearer image or provide your information manually for the best fashion recommendations!`;
  }
};

// Dedicated function for profile body type analysis with different categories
export const analyzeProfileBodyTypeFromImage = async (imageUri: string, gender?: string): Promise<{ bodyType: string, confidence: number, analysis: string }> => {
  // Check rate limit
  if (!geminiRateLimiter.canMakeCall()) {
    const waitTime = Math.ceil(geminiRateLimiter.getTimeUntilNextCall() / 1000);
    throw new Error(`Rate limit exceeded. Please wait ${waitTime} seconds before trying again.`);
  }

  // Ensure gender is properly handled (moved outside try block)
  const normalizedGender = gender ? gender.toLowerCase().trim() : 'unknown';

  try {
    const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });

    // Convert image to base64
    const response = await fetch(imageUri);
    const blob = await response.blob();
    const base64 = await blobToBase64(blob);

    const imagePart = {
      inlineData: {
        data: base64.split(',')[1],
        mimeType: blob.type,
      },
    };

    const genderSpecificPrompt = normalizedGender === 'male'
      ? `
      Analyze this male body type photo for personal styling purposes. Be respectful and professional.

      Male Body Types for Profile (choose from these exact options):
      - Rectangle: Shoulders and waist are similar width, minimal waist definition, straight silhouette
      - Triangle: Hips wider than shoulders, defined waist, fuller lower body (also called Pear)
      - Inverted Triangle: Shoulders wider than hips, athletic build, broader chest/shoulders
      - Oval: Fuller midsection, broader torso, less defined waist (also called Apple)

      Provide your analysis in this exact format:
      BODY_TYPE: [Rectangle/Triangle/Inverted Triangle/Oval]
      CONFIDENCE: [percentage from 70-95]%
      ANALYSIS: [Brief encouraging explanation focusing on styling advantages]

      Focus on positive styling opportunities for this body type.
      `
      : normalizedGender === 'female'
        ? `
        Analyze this female body type photo for personal styling purposes. Be respectful and professional.

        Female Body Types for Profile (choose from these exact options):
        - Hourglass: Balanced bust and hips with defined waist, curvy silhouette
        - Pear: Hips wider than bust, defined waist, fuller lower body
        - Apple: Fuller midsection, broader shoulders than hips, less defined waist
        - Rectangle: Similar bust and hip width, minimal waist definition, straight silhouette
        - Inverted Triangle: Shoulders/bust wider than hips, athletic build, broader shoulders

        Provide your analysis in this exact format:
        BODY_TYPE: [Hourglass/Pear/Apple/Rectangle/Inverted Triangle]
        CONFIDENCE: [percentage from 70-95]%
        ANALYSIS: [Brief encouraging explanation focusing on styling advantages]

        Focus on positive styling opportunities for this body type.
        `
        : `
        Analyze this body type photo for personal styling purposes. Be respectful and professional.

        General Body Types for Profile (choose from these exact options):
        - Rectangle: Shoulders and waist are similar width, straight silhouette
        - Pear: Hips wider than shoulders, fuller lower body
        - Apple: Fuller midsection, broader torso
        - Hourglass: Balanced proportions with defined waist
        - Triangle: Lower body wider than upper body
        - Inverted Triangle: Upper body wider than lower body

        Provide your analysis in this exact format:
        BODY_TYPE: [Rectangle/Pear/Apple/Hourglass/Triangle/Inverted Triangle]
        CONFIDENCE: [percentage from 70-95]%
        ANALYSIS: [Brief encouraging explanation focusing on styling advantages]

        Focus on positive styling opportunities for this body type.
        `;

    const result = await model.generateContent([genderSpecificPrompt, imagePart]);
    const responseText = result.response.text();

    console.log('🔍 Profile Body Type Analysis Response:', responseText); // Debug log

    // Parse the response
    const bodyTypeMatch = responseText.match(/BODY_TYPE:\s*([^\n]+)/i);
    const confidenceMatch = responseText.match(/CONFIDENCE:\s*(\d+)%/i);
    const analysisMatch = responseText.match(/ANALYSIS:\s*([^\n]+)/i);

    const bodyType = bodyTypeMatch ? bodyTypeMatch[1].trim() : (normalizedGender === 'female' ? 'Rectangle' : 'Rectangle');
    const confidence = confidenceMatch ? parseInt(confidenceMatch[1]) : 85;
    const analysis = analysisMatch ? analysisMatch[1].trim() : 'Body type analysis completed successfully with styling recommendations.';

    return { bodyType, confidence, analysis };
  } catch (error: any) {
    console.error('Gemini Profile Body Type Analysis Error:', error);

    // Check if it's a 503 error (model overloaded)
    if (error.message?.includes('503') || error.message?.includes('overloaded')) {
      // Return a fallback result instead of throwing
      return {
        bodyType: normalizedGender === 'female' ? 'Rectangle' : 'Rectangle',
        confidence: 0,
        analysis: "I'm currently experiencing high demand and can't analyze your photo right now. 😅 I've set a default body type for now - you can change this manually or try photo analysis again later!"
      };
    }

    // Check if it's a rate limit error
    if (error.message?.includes('Rate limit')) {
      return {
        bodyType: normalizedGender === 'female' ? 'Rectangle' : 'Rectangle',
        confidence: 0,
        analysis: "I need a moment to process! 😊 I've set a default body type for now - please try photo analysis again in a few seconds or select manually."
      };
    }

    // Generic error fallback
    return {
      bodyType: normalizedGender === 'female' ? 'Rectangle' : 'Rectangle',
      confidence: 0,
      analysis: "I had trouble analyzing your photo. I've set a default body type for now - you can change this manually or try uploading a different photo."
    };
  }
};

// Original function for twinning analysis (with different body type categories)
export const analyzeBodyTypeFromImage = async (imageUri: string, gender?: string): Promise<{ bodyType: string, confidence: number, analysis: string }> => {
  // Check rate limit
  if (!geminiRateLimiter.canMakeCall()) {
    const waitTime = Math.ceil(geminiRateLimiter.getTimeUntilNextCall() / 1000);
    throw new Error(`Rate limit exceeded. Please wait ${waitTime} seconds before trying again.`);
  }

  // Ensure gender is properly handled (moved outside try block)
  const normalizedGender = gender ? gender.toLowerCase().trim() : 'unknown';

  try {
    const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' }); // Use Flash for better reliability

    // Convert image to base64
    const response = await fetch(imageUri);
    const blob = await response.blob();
    const base64 = await blobToBase64(blob);

    const imagePart = {
      inlineData: {
        data: base64.split(',')[1],
        mimeType: blob.type,
      },
    };

    const genderSpecificPrompt = normalizedGender === 'male'
      ? `
      Analyze this male body type photo and determine the body shape. Be respectful and professional.

      Male Body Types to choose from:
      - Rectangle: Shoulders and waist are similar width, minimal waist definition, straight silhouette
      - Triangle (Pear): Hips wider than shoulders, defined waist, fuller lower body
      - Inverted Triangle: Shoulders wider than hips, athletic build, broader chest/shoulders
      - Oval (Apple): Fuller midsection, broader torso, less defined waist

      Provide your analysis in this exact format:
      BODY_TYPE: [Rectangle/Triangle/Inverted Triangle/Oval]
      CONFIDENCE: [percentage from 70-95]%
      ANALYSIS: [Brief explanation of why this body type fits, focusing on shoulder-waist-hip proportions]

      Be encouraging and focus only on styling-relevant observations.
      `
      : normalizedGender === 'female'
        ? `
        Analyze this female body type photo and determine the body shape. Be respectful and professional.

        Female Body Types to choose from:
        - Hourglass: Balanced shoulders and hips with defined waist, curvy silhouette
        - Pear: Hips wider than shoulders, defined waist, fuller lower body
        - Apple: Fuller midsection, broader shoulders than hips, less defined waist
        - Rectangle: Similar shoulder and hip width, minimal waist definition, straight silhouette
        - Inverted Triangle: Shoulders wider than hips, athletic build, broader shoulders

        Provide your analysis in this exact format:
        BODY_TYPE: [Hourglass/Pear/Apple/Rectangle/Inverted Triangle]
        CONFIDENCE: [percentage from 70-95]%
        ANALYSIS: [Brief explanation of why this body type fits, focusing on bust-waist-hip proportions]

        Be encouraging and focus only on styling-relevant observations.
        `
        : `
        Analyze this body type photo and determine the body shape. Be respectful and professional.

        Body Types to choose from:
        - Rectangle: Shoulders and waist are similar width, straight silhouette
        - Pear: Hips wider than shoulders, fuller lower body
        - Apple: Fuller midsection, broader torso
        - Hourglass: Balanced proportions with defined waist
        - Triangle: Lower body wider than upper body
        - Inverted Triangle: Upper body wider than lower body

        Provide your analysis in this exact format:
        BODY_TYPE: [Rectangle/Pear/Apple/Hourglass/Triangle/Inverted Triangle]
        CONFIDENCE: [percentage from 70-95]%
        ANALYSIS: [Brief explanation of why this body type fits]

        Be encouraging and focus only on styling-relevant observations.
        `;

    const result = await model.generateContent([genderSpecificPrompt, imagePart]);
    const responseText = result.response.text();

    // Parse the response
    const bodyTypeMatch = responseText.match(/BODY_TYPE:\s*([^\n]+)/i);
    const confidenceMatch = responseText.match(/CONFIDENCE:\s*(\d+)%/i);
    const analysisMatch = responseText.match(/ANALYSIS:\s*([^\n]+)/i);

    const bodyType = bodyTypeMatch ? bodyTypeMatch[1].trim() : 'Rectangle';
    const confidence = confidenceMatch ? parseInt(confidenceMatch[1]) : 85;
    const analysis = analysisMatch ? analysisMatch[1].trim() : 'Body type analysis completed successfully.';

    return { bodyType, confidence, analysis };
  } catch (error: any) {
    console.error('Gemini Body Type Analysis Error:', error);

    // Check if it's a 503 error (model overloaded)
    if (error.message?.includes('503') || error.message?.includes('overloaded')) {
      return {
        bodyType: normalizedGender === 'female' ? 'Rectangle' : 'Rectangle',
        confidence: 0,
        analysis: "I'm currently experiencing high demand and can't analyze your photo right now. 😅 I've set a default body type for now - you can change this manually or try photo analysis again later!"
      };
    }

    // Check if it's a rate limit error
    if (error.message?.includes('Rate limit')) {
      return {
        bodyType: normalizedGender === 'female' ? 'Rectangle' : 'Rectangle',
        confidence: 0,
        analysis: "I need a moment to process! 😊 I've set a default body type for now - please try photo analysis again in a few seconds or select manually."
      };
    }

    // Generic error fallback
    return {
      bodyType: normalizedGender === 'female' ? 'Rectangle' : 'Rectangle',
      confidence: 0,
      analysis: "I had trouble analyzing your photo. I've set a default body type for now - you can change this manually or try uploading a different photo."
    };
  }
};

export const generatePersonalizedFashionTips = async (
  height: number,
  skinTone: string,
  bodyType: string,
  gender: string,
  language: string = 'english'
): Promise<string> => {
  // Check rate limit
  if (!geminiRateLimiter.canMakeCall()) {
    const waitTime = Math.ceil(geminiRateLimiter.getTimeUntilNextCall() / 1000);
    throw new Error(`Rate limit exceeded. Please wait ${waitTime} seconds before trying again.`);
  }

  try {
    const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });

    const tipsPrompt = `
You are StyleBuddy, a friendly fashion assistant. Provide personalized fashion advice for this user:

User Details:
- Height: ${height}cm
- Skin Tone: ${skinTone}
- Body Type: ${bodyType}
- Gender: ${gender}
- Language: ${language}

IMPORTANT: Do NOT use markdown formatting like **text** or *text*. Use plain text with emojis only.

Please provide a comprehensive fashion analysis in ${language} language including:

1. Body Type Analysis 📏
   - Brief explanation of their body type
   - Key styling advantages

2. Color Palette 🎨
   - Best colors for their skin tone
   - Colors to avoid or use sparingly

3. Fashion Tips ✨
   - 5 specific styling tips for their body type
   - Clothing cuts and fits that work best
   - What to emphasize and what to balance

4. Style Recommendations 👗
   - Recommended clothing styles
   - Fabric suggestions
   - Pattern recommendations

5. Accessories & Styling 💎
   - Best accessories for their body type
   - Styling tricks to enhance their look

6. YouTube Video Recommendations 📺
   For ${bodyType} body type and ${skinTone} skin tone, here are specific YouTube videos:
   
   Video 1: "How to Dress ${bodyType} Body Type - Complete Guide"
   Creator: "Style Theory" or "Justine Leconte"
   Link: https://www.youtube.com/results?search_query=how+to+dress+${bodyType.toLowerCase()}+body+type+guide
   
   Video 2: "Best Colors for ${skinTone} Skin Tone - Fashion Tips"
   Creator: "Aly Art" or "Color Analysis Studio"
   Link: https://www.youtube.com/results?search_query=best+colors+${skinTone.toLowerCase()}+skin+tone+fashion
   
   Video 3: "Fashion Tips for ${height > 170 ? 'Tall' : 'Petite'} ${gender} - Styling Guide"
   Creator: "Extra Petite" or "Tall Girl Fashion"
   Link: https://www.youtube.com/results?search_query=${height > 170 ? 'tall' : 'petite'}+${gender.toLowerCase()}+fashion+styling+tips

Format the response with clear sections, use emojis, and keep it encouraging and positive. Make it comprehensive but easy to read.

REMEMBER: No markdown formatting like **bold** or *italic*. Use plain text with emojis only.

If language is 'hindi', respond in Hindi with Devanagari script.
If language is 'hinglish', mix Hindi and English naturally.
If language is 'english', respond in English.

Keep the tone friendly, supportive, and enthusiastic like StyleBuddy would be!
`;

    const result = await model.generateContent(tipsPrompt);
    const responseText = result.response.text();

    // Clean up any markdown formatting that might have slipped through
    const cleanedResponse = responseText
      .replace(/\*\*(.*?)\*\*/g, '$1') // Remove **bold**
      .replace(/\*(.*?)\*/g, '$1')     // Remove *italic*
      .replace(/__(.*?)__/g, '$1')     // Remove __underline__
      .replace(/`(.*?)`/g, '$1')       // Remove `code`
      .trim();

    return cleanedResponse;
  } catch (error) {
    console.error('Gemini Fashion Tips API Error:', error);
    return language === 'hindi'
      ? "मुझे अभी आपके लिए फैशन टिप्स तैयार करने में समस्या हो रही है। कृपया थोड़ी देर बाद कोशिश करें! 😊"
      : language === 'hinglish'
        ? "Mujhe abhi aapke liye fashion tips prepare karne mein problem ho rahi hai. Please thodi der baad try kariye! 😊"
        : "I'm having trouble preparing your personalized fashion tips right now. Please try again in a moment! 😊";
  }
};
export
  const generateOutfitSuggestions = async (prompt: string, category?: string, userProfile?: any): Promise<any[]> => {
    // Check rate limit
    if (!geminiRateLimiter.canMakeCall()) {
      const waitTime = Math.ceil(geminiRateLimiter.getTimeUntilNextCall() / 1000);
      throw new Error(`Rate limit exceeded. Please wait ${waitTime} seconds before trying again.`);
    }

    try {
      const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });

      const result = await model.generateContent(prompt);
      const responseText = result.response.text();

      // Enhanced JSON cleaning and parsing
      let cleanedResponse = responseText.replace(/```json\n?|\n?```/g, '').trim();

      // Remove common prefixes that Gemini sometimes adds
      const commonPrefixes = [
        'I\'ll create',
        'I\'ll provide',
        'Here are',
        'Here\'s',
        'I can help',
        'I\'ll help',
        'Let me create',
        'Based on',
        'I understand'
      ];

      for (const prefix of commonPrefixes) {
        if (cleanedResponse.toLowerCase().startsWith(prefix.toLowerCase())) {
          // Find the first '[' or '{' after the prefix
          const jsonStart = Math.min(
            cleanedResponse.indexOf('[') !== -1 ? cleanedResponse.indexOf('[') : Infinity,
            cleanedResponse.indexOf('{') !== -1 ? cleanedResponse.indexOf('{') : Infinity
          );

          if (jsonStart !== Infinity) {
            cleanedResponse = cleanedResponse.substring(jsonStart);
            console.log('🧹 Removed prefix and extracted JSON:', cleanedResponse.substring(0, 100) + '...');
            break;
          }
        }
      }

      // Remove any text before the first '[' or '{'
      const jsonStart = Math.min(
        cleanedResponse.indexOf('[') !== -1 ? cleanedResponse.indexOf('[') : Infinity,
        cleanedResponse.indexOf('{') !== -1 ? cleanedResponse.indexOf('{') : Infinity
      );

      if (jsonStart !== Infinity && jsonStart > 0) {
        cleanedResponse = cleanedResponse.substring(jsonStart);
        console.log('🧹 Cleaned response by removing text before JSON:', cleanedResponse.substring(0, 100) + '...');
      }

      // Remove any text after the last ']' or '}'
      const jsonEnd = Math.max(
        cleanedResponse.lastIndexOf(']'),
        cleanedResponse.lastIndexOf('}')
      );

      if (jsonEnd !== -1 && jsonEnd < cleanedResponse.length - 1) {
        cleanedResponse = cleanedResponse.substring(0, jsonEnd + 1);
      }

      try {
        const parsed = JSON.parse(cleanedResponse);
        return Array.isArray(parsed) ? parsed : [];
      } catch (parseError) {
        console.error('JSON Parse Error for outfit suggestions:', parseError);
        console.log('Raw response:', responseText);
        console.log('Cleaned response:', cleanedResponse);
        // Return category-specific fallback suggestions with proper gender context
        return generateFallbackOutfitSuggestions(category, userProfile);
      }
    } catch (error: any) {
      console.error('Gemini API Error for outfit suggestions:', error);

      // Check if it's a 503 error (model overloaded)
      if (error.message?.includes('503') || error.message?.includes('overloaded')) {
        console.log('🔄 Gemini model overloaded, using category-specific fallback suggestions');
        return generateFallbackOutfitSuggestions(category, userProfile);
      }

      // For other errors, return category-specific fallback as well
      return generateFallbackOutfitSuggestions(category, userProfile);
    }
  };

const generateFallbackOutfitSuggestions = (category?: string, userProfile?: any): any[] => {
  const categoryLower = category?.toLowerCase() || '';

  // Extract gender from category first, then fallback to profile gender
  let gender = userProfile?.gender?.toLowerCase() || 'male';
  if (categoryLower.includes('male-')) {
    gender = 'male';
  } else if (categoryLower.includes('female-')) {
    gender = 'female';
  }

  console.log(`🎯 Generating ${gender}-specific fallback suggestions for ${category}`, {
    categoryLower,
    userProfileGender: userProfile?.gender,
    extractedGender: gender,
    categoryHasMale: categoryLower.includes('male-'),
    categoryHasFemale: categoryLower.includes('female-')
  });

  // Category-specific fallback suggestions with strict gender filtering
  if (categoryLower.includes('gym')) {
    if (gender === 'male') {
      return [
        {
          id: "fallback_gym_male_1",
          title: "Men's Athletic Performance Set",
          description: "High-performance workout outfit designed for men's intense training sessions.",
          items: ["Men's moisture-wicking tank top", "Athletic shorts", "Men's running shoes", "Sports watch"],
          occasion: "Gym workouts, cardio sessions",
          season: "All seasons",
          colors: ["Black", "Gray", "Neon accents"],
          price_range: "mid-range",
          style_tips: [
            "Choose breathable, moisture-wicking fabrics",
            "Ensure proper fit for unrestricted movement",
            "Layer with a light jacket for warm-up"
          ],
          image_description: "A sleek men's athletic look with black moisture-wicking tank and gray shorts, perfect for high-intensity workouts.",
          shopping_links: [
            {
              platform: "Amazon",
              url: "https://www.amazon.com/s?k=men+athletic+performance+workout+outfit&ref=nb_sb_noss",
              description: "Shop men's athletic wear on Amazon",
              icon: "bag"
            },
            {
              platform: "Pinterest",
              url: "https://www.pinterest.com/search/pins/?q=men+gym+workout+outfit+athletic",
              description: "Find men's gym outfit inspiration",
              icon: "camera"
            }
          ],
          reference_links: [
            {
              platform: "Style Guide",
              url: "https://www.google.com/search?q=men+gym+workout+outfit+style+guide",
              description: "Learn men's gym styling tips",
              icon: "book"
            }
          ]
        },
        {
          id: "fallback_gym_male_2",
          title: "Men's Strength Training Outfit",
          description: "Comfortable and supportive outfit perfect for weightlifting and strength training.",
          items: ["Fitted compression shirt", "Athletic shorts", "Cross-training shoes", "Lifting gloves"],
          occasion: "Weight training, strength workouts",
          season: "All seasons",
          colors: ["Navy", "Black", "White"],
          price_range: "mid-range",
          style_tips: [
            "Choose supportive, form-fitting materials",
            "Avoid loose clothing that might interfere with equipment",
            "Opt for shoes with good lateral support"
          ],
          image_description: "A practical men's strength training ensemble with navy compression shirt and black shorts, ideal for weightlifting.",
          shopping_links: [
            {
              platform: "Amazon",
              url: "https://www.amazon.com/s?k=men+strength+training+workout+outfit&ref=nb_sb_noss",
              description: "Shop men's strength training gear on Amazon",
              icon: "bag"
            },
            {
              platform: "Pinterest",
              url: "https://www.pinterest.com/search/pins/?q=men+strength+training+gym+outfit",
              description: "Find men's strength training outfit ideas",
              icon: "camera"
            }
          ],
          reference_links: [
            {
              platform: "Style Guide",
              url: "https://www.google.com/search?q=men+strength+training+outfit+guide",
              description: "Learn men's strength training styling",
              icon: "book"
            }
          ]
        }
      ];
    } else {
      return [
        {
          id: "fallback_gym_female_1",
          title: "Women's Athletic Performance Set",
          description: "High-performance workout outfit designed for women's intense training sessions.",
          items: ["Women's sports bra", "High-waisted leggings", "Women's running shoes", "Fitness tracker"],
          occasion: "Gym workouts, cardio sessions",
          season: "All seasons",
          colors: ["Pink", "Black", "White"],
          price_range: "mid-range",
          style_tips: [
            "Choose supportive sports bra for high-impact activities",
            "High-waisted leggings provide comfort and coverage",
            "Layer with a light jacket for warm-up"
          ],
          image_description: "A stylish women's athletic look with pink sports bra and black high-waisted leggings, perfect for high-intensity workouts.",
          shopping_links: [
            {
              platform: "Amazon",
              url: "https://www.amazon.com/s?k=women+athletic+performance+workout+outfit&ref=nb_sb_noss",
              description: "Shop women's athletic wear on Amazon",
              icon: "bag"
            },
            {
              platform: "Pinterest",
              url: "https://www.pinterest.com/search/pins/?q=women+gym+workout+outfit+athletic",
              description: "Find women's gym outfit inspiration",
              icon: "camera"
            }
          ],
          reference_links: [
            {
              platform: "Style Guide",
              url: "https://www.google.com/search?q=women+gym+workout+outfit+style+guide",
              description: "Learn women's gym styling tips",
              icon: "book"
            }
          ]
        },
        {
          id: "fallback_gym_female_2",
          title: "Women's Yoga & Flexibility Wear",
          description: "Comfortable and flexible outfit perfect for yoga and stretching exercises.",
          items: ["Fitted yoga top", "Yoga leggings", "Yoga mat", "Lightweight sneakers"],
          occasion: "Yoga classes, pilates, stretching",
          season: "All seasons",
          colors: ["Purple", "Black", "White"],
          price_range: "mid-range",
          style_tips: [
            "Choose stretchy, form-fitting materials",
            "Avoid loose clothing that might get in the way",
            "Opt for seamless designs to prevent chafing"
          ],
          image_description: "A comfortable women's yoga ensemble with purple fitted top and black leggings, ideal for flexibility training.",
          shopping_links: [
            {
              platform: "Amazon",
              url: "https://www.amazon.com/s?k=women+yoga+flexibility+workout+outfit&ref=nb_sb_noss",
              description: "Shop women's yoga wear on Amazon",
              icon: "bag"
            },
            {
              platform: "Pinterest",
              url: "https://www.pinterest.com/search/pins/?q=women+yoga+outfit+flexibility+wear",
              description: "Find women's yoga outfit inspiration",
              icon: "camera"
            }
          ],
          reference_links: [
            {
              platform: "Style Guide",
              url: "https://www.google.com/search?q=women+yoga+outfit+style+guide",
              description: "Learn women's yoga styling tips",
              icon: "book"
            }
          ]
        }
      ];
    }
  }

  if (categoryLower.includes('formal')) {
    if (gender === 'male') {
      return [
        {
          id: "fallback_formal_male_1",
          title: "Men's Classic Business Suit",
          description: "Timeless professional attire perfect for men's business meetings and formal events.",
          items: ["Men's tailored suit jacket", "Matching trousers", "Men's dress shirt", "Men's leather dress shoes", "Silk tie"],
          occasion: "Business meetings, formal events",
          season: "All seasons",
          colors: ["Navy", "White", "Brown"],
          price_range: "premium",
          style_tips: [
            "Ensure proper fit at shoulders and waist",
            "Choose quality fabrics for better drape",
            "Match belt with shoe color"
          ],
          image_description: "A sharp men's navy business suit with crisp white shirt and brown leather accessories, exuding professional confidence.",
          ...generateGenderSpecificLinks('male', 'formal business', ['suit', 'professional', 'business'])
        },
        {
          id: "fallback_formal_male_2",
          title: "Men's Evening Formal Wear",
          description: "Elegant formal attire perfect for evening events and special occasions.",
          items: ["Black tuxedo jacket", "Formal trousers", "White dress shirt", "Black bow tie", "Patent leather shoes"],
          occasion: "Evening events, galas, weddings",
          season: "All seasons",
          colors: ["Black", "White"],
          price_range: "premium",
          style_tips: [
            "Classic black tie ensemble never goes out of style",
            "Ensure crisp white shirt with proper collar",
            "Polish shoes to a high shine"
          ],
          image_description: "An elegant men's black tuxedo with white shirt and bow tie, perfect for formal evening events.",
          ...generateGenderSpecificLinks('male', 'evening formal', ['tuxedo', 'black tie', 'formal'])
        }
      ];
    } else {
      return [
        {
          id: "fallback_formal_female_1",
          title: "Women's Professional Business Suit",
          description: "Sophisticated professional attire perfect for women's business meetings and formal events.",
          items: ["Women's tailored blazer", "Matching pencil skirt", "Silk blouse", "Women's heels", "Professional handbag"],
          occasion: "Business meetings, formal events",
          season: "All seasons",
          colors: ["Navy", "White", "Black"],
          price_range: "premium",
          style_tips: [
            "Ensure blazer fits well at shoulders",
            "Choose appropriate heel height for comfort",
            "Keep accessories minimal and professional"
          ],
          image_description: "A sophisticated women's navy business suit with white silk blouse and black heels, projecting professional authority.",
          ...generateGenderSpecificLinks('female', 'professional business', ['suit', 'blazer', 'professional'])
        },
        {
          id: "fallback_formal_female_2",
          title: "Women's Evening Formal Dress",
          description: "Elegant formal attire perfect for evening events and special occasions.",
          items: ["Elegant evening dress", "Women's formal heels", "Clutch purse", "Statement jewelry"],
          occasion: "Evening events, galas, formal dinners",
          season: "All seasons",
          colors: ["Black", "Navy", "Burgundy"],
          price_range: "premium",
          style_tips: [
            "Choose a dress that flatters your body type",
            "Keep jewelry elegant but not overwhelming",
            "Select comfortable heels for long events"
          ],
          image_description: "An elegant women's evening dress in black with sophisticated heels and minimal jewelry, perfect for formal occasions.",
          ...generateGenderSpecificLinks('female', 'evening formal', ['dress', 'formal', 'evening'])
        }
      ];
    }
  }

  if (categoryLower.includes('street')) {
    if (gender === 'male') {
      return [
        {
          id: "fallback_street_male_1",
          title: "Men's Urban Streetwear",
          description: "Trendy men's street style perfect for casual urban adventures.",
          items: ["Men's oversized hoodie", "Distressed jeans", "High-top sneakers", "Baseball cap"],
          occasion: "Casual outings, street photography",
          season: "Fall, Winter",
          colors: ["Gray", "Black", "White"],
          price_range: "budget",
          style_tips: [
            "Layer different textures for visual interest",
            "Mix high and low-end pieces",
            "Accessorize with statement sneakers"
          ],
          image_description: "A relaxed men's street style with gray oversized hoodie and distressed black jeans, perfect for urban exploration.",
          ...generateGenderSpecificLinks('male', 'urban streetwear', ['hoodie', 'streetwear', 'casual'])
        },
        {
          id: "fallback_street_male_2",
          title: "Men's Smart Casual Street",
          description: "Elevated men's street style that's both trendy and refined.",
          items: ["Men's bomber jacket", "Slim-fit jeans", "White sneakers", "Crossbody bag"],
          occasion: "Casual meetups, weekend outings",
          season: "Spring, Summer",
          colors: ["Olive", "Blue", "White"],
          price_range: "mid-range",
          style_tips: [
            "Balance casual and smart elements",
            "Choose well-fitted pieces",
            "Add subtle accessories"
          ],
          image_description: "A stylish men's street look with olive bomber jacket and slim blue jeans, perfect for casual sophistication.",
          ...generateGenderSpecificLinks('male', 'smart casual street', ['bomber', 'casual', 'street'])
        }
      ];
    } else {
      return [
        {
          id: "fallback_street_female_1",
          title: "Women's Urban Streetwear",
          description: "Trendy women's street style perfect for casual urban adventures.",
          items: ["Women's oversized sweatshirt", "High-waisted jeans", "Platform sneakers", "Crossbody bag"],
          occasion: "Casual outings, street photography",
          season: "Fall, Winter",
          colors: ["Pink", "Black", "White"],
          price_range: "budget",
          style_tips: [
            "Balance oversized tops with fitted bottoms",
            "Add feminine touches to streetwear",
            "Choose comfortable yet stylish footwear"
          ],
          image_description: "A trendy women's street style with pink oversized sweatshirt and black high-waisted jeans, perfect for urban exploration.",
          ...generateGenderSpecificLinks('female', 'urban streetwear', ['sweatshirt', 'streetwear', 'casual'])
        },
        {
          id: "fallback_street_female_2",
          title: "Women's Chic Street Style",
          description: "Elevated women's street style that's both trendy and feminine.",
          items: ["Denim jacket", "Midi skirt", "White sneakers", "Tote bag"],
          occasion: "Casual meetups, weekend outings",
          season: "Spring, Summer",
          colors: ["Blue", "White", "Beige"],
          price_range: "mid-range",
          style_tips: [
            "Mix casual and feminine elements",
            "Choose flattering silhouettes",
            "Add practical accessories"
          ],
          image_description: "A chic women's street look with denim jacket and midi skirt, perfect for casual sophistication.",
          ...generateGenderSpecificLinks('female', 'chic street style', ['denim', 'street', 'chic'])
        }
      ];
    }
  }

  if (categoryLower.includes('ethnic')) {
    if (gender === 'male') {
      return [
        {
          id: "fallback_ethnic_male_1",
          title: "Men's Traditional Elegance",
          description: "Classic traditional men's outfit perfect for cultural celebrations.",
          items: ["Men's kurta", "Matching pajama", "Traditional vest", "Leather mojaris"],
          occasion: "Festivals, cultural events",
          season: "All seasons",
          colors: ["Maroon", "Gold", "Cream"],
          price_range: "mid-range",
          style_tips: [
            "Choose fabrics appropriate for the occasion",
            "Ensure proper fit for comfort",
            "Add traditional accessories like watch or bracelet"
          ],
          image_description: "A handsome men's traditional outfit in rich maroon kurta with gold accents, perfect for cultural celebrations.",
          ...generateGenderSpecificLinks('male', 'traditional ethnic', ['kurta', 'traditional', 'ethnic'])
        },
        {
          id: "fallback_ethnic_male_2",
          title: "Men's Festive Sherwani",
          description: "Elegant men's sherwani perfect for weddings and special occasions.",
          items: ["Embroidered sherwani", "Matching churidar", "Traditional shoes", "Pocket square"],
          occasion: "Weddings, special celebrations",
          season: "All seasons",
          colors: ["Navy", "Gold", "Ivory"],
          price_range: "premium",
          style_tips: [
            "Choose rich fabrics with subtle embroidery",
            "Ensure sherwani length is appropriate",
            "Keep accessories minimal and elegant"
          ],
          image_description: "An elegant men's navy sherwani with gold embroidery, perfect for wedding celebrations.",
          ...generateGenderSpecificLinks('male', 'festive sherwani', ['sherwani', 'wedding', 'festive'])
        }
      ];
    } else {
      return [
        {
          id: "fallback_ethnic_female_1",
          title: "Women's Traditional Elegance",
          description: "Classic traditional women's outfit perfect for cultural celebrations.",
          items: ["Elegant kurti", "Matching dupatta", "Traditional jewelry", "Comfortable flats"],
          occasion: "Festivals, cultural events",
          season: "All seasons",
          colors: ["Maroon", "Gold", "Cream"],
          price_range: "mid-range",
          style_tips: [
            "Choose fabrics that drape well",
            "Balance traditional and modern elements",
            "Accessorize with cultural jewelry"
          ],
          image_description: "A beautiful women's traditional outfit in rich maroon kurti with gold accents, perfect for cultural celebrations.",
          ...generateGenderSpecificLinks('female', 'traditional ethnic', ['kurti', 'traditional', 'ethnic'])
        },
        {
          id: "fallback_ethnic_female_2",
          title: "Women's Festive Saree",
          description: "Elegant women's saree perfect for weddings and special occasions.",
          items: ["Silk saree", "Matching blouse", "Traditional jewelry", "Heeled sandals"],
          occasion: "Weddings, special celebrations",
          season: "All seasons",
          colors: ["Red", "Gold", "Burgundy"],
          price_range: "premium",
          style_tips: [
            "Choose saree fabric that complements body type",
            "Ensure blouse fits perfectly",
            "Add statement jewelry for elegance"
          ],
          image_description: "An elegant women's red silk saree with gold border, perfect for wedding celebrations.",
          ...generateGenderSpecificLinks('female', 'festive saree', ['saree', 'wedding', 'festive'])
        }
      ];
    }
  }

  if (categoryLower.includes('party')) {
    if (gender === 'male') {
      return [
        {
          id: "fallback_party_male_1",
          title: "Men's Party Ready",
          description: "Stylish men's outfit perfect for parties and celebrations.",
          items: ["Men's dress shirt", "Blazer", "Dress pants", "Dress shoes"],
          occasion: "Parties, celebrations, nightouts",
          season: "All seasons",
          colors: ["Black", "White", "Silver"],
          price_range: "mid-range",
          style_tips: [
            "Choose a well-fitted blazer",
            "Add a stylish watch for sophistication",
            "Consider the party venue and dress code"
          ],
          image_description: "A sharp men's party outfit in black blazer with white shirt, designed to make a statement at any celebration.",
          ...generateGenderSpecificLinks('male', 'party ready', ['blazer', 'party', 'formal'])
        },
        {
          id: "fallback_party_male_2",
          title: "Men's Casual Party Look",
          description: "Trendy men's outfit perfect for casual parties and social gatherings.",
          items: ["Stylish polo shirt", "Dark jeans", "Casual blazer", "Loafers"],
          occasion: "Casual parties, social gatherings",
          season: "All seasons",
          colors: ["Navy", "White", "Brown"],
          price_range: "mid-range",
          style_tips: [
            "Balance casual and smart elements",
            "Choose quality fabrics",
            "Add subtle accessories"
          ],
          image_description: "A trendy men's casual party look with navy polo and dark jeans, perfect for social gatherings.",
          ...generateGenderSpecificLinks('male', 'casual party', ['polo', 'casual', 'party'])
        }
      ];
    } else {
      return [
        {
          id: "fallback_party_female_1",
          title: "Women's Party Ready",
          description: "Glamorous women's outfit perfect for parties and celebrations.",
          items: ["Cocktail dress", "Statement heels", "Clutch bag", "Bold jewelry"],
          occasion: "Parties, celebrations, nightouts",
          season: "All seasons",
          colors: ["Black", "Gold", "Silver"],
          price_range: "mid-range",
          style_tips: [
            "Choose a dress that flatters your figure",
            "Add statement accessories for glamour",
            "Select comfortable heels for dancing"
          ],
          image_description: "A stunning women's party outfit in black cocktail dress with gold accessories, designed to make a statement at any celebration.",
          ...generateGenderSpecificLinks('female', 'party ready', ['cocktail dress', 'party', 'glamorous'])
        },
        {
          id: "fallback_party_female_2",
          title: "Women's Chic Party Look",
          description: "Elegant women's outfit perfect for sophisticated parties.",
          items: ["Silk blouse", "High-waisted skirt", "Heeled boots", "Statement earrings"],
          occasion: "Sophisticated parties, cocktail events",
          season: "All seasons",
          colors: ["Burgundy", "Black", "Gold"],
          price_range: "mid-range",
          style_tips: [
            "Mix textures for visual interest",
            "Choose one statement piece",
            "Keep makeup elegant"
          ],
          image_description: "An elegant women's party look with burgundy silk blouse and black skirt, perfect for sophisticated celebrations.",
          ...generateGenderSpecificLinks('female', 'chic party', ['silk blouse', 'party', 'elegant'])
        }
      ];
    }
  }

  // Default fallback for other categories
  if (gender === 'male') {
    return [
      {
        id: "fallback_general_male_1",
        title: "Men's Versatile Smart Casual",
        description: "A flexible men's outfit that works for various occasions and settings.",
        items: ["Men's button-up shirt", "Chinos", "Casual blazer", "Loafers"],
        occasion: "Multiple occasions",
        season: "All seasons",
        colors: ["Navy", "Khaki", "White"],
        price_range: "mid-range",
        style_tips: [
          "Mix formal and casual elements",
          "Choose neutral colors for versatility",
          "Focus on fit and quality basics"
        ],
        image_description: "A balanced men's smart casual look that transitions well from day to evening activities.",
        ...generateGenderSpecificLinks('male', 'smart casual', ['button-up', 'chinos', 'versatile'])
      }
    ];
  } else {
    return [
      {
        id: "fallback_general_female_1",
        title: "Women's Versatile Smart Casual",
        description: "A flexible women's outfit that works for various occasions and settings.",
        items: ["Women's blouse", "Tailored pants", "Cardigan", "Flats"],
        occasion: "Multiple occasions",
        season: "All seasons",
        colors: ["Navy", "Beige", "White"],
        price_range: "mid-range",
        style_tips: [
          "Mix professional and casual elements",
          "Choose neutral colors for versatility",
          "Focus on fit and comfort"
        ],
        image_description: "A balanced women's smart casual look that transitions well from day to evening activities.",
        ...generateGenderSpecificLinks('female', 'smart casual', ['blouse', 'tailored', 'versatile'])
      }
    ];
  }
};

export const generateTodaysOutfit = async (userProfile: any, weather: any): Promise<any> => {
  // Check rate limit
  if (!geminiRateLimiter.canMakeCall()) {
    const waitTime = Math.ceil(geminiRateLimiter.getTimeUntilNextCall() / 1000);
    throw new Error(`Rate limit exceeded. Please wait ${waitTime} seconds before trying again.`);
  }

  try {
    const model = genAI.getGenerativeModel({ model: 'gemini-1.5-pro' }); // Using Pro model for better results

    const prompt = `
You are a professional fashion stylist and weather expert. Create the perfect outfit recommendation for today based on the weather and user's profile.

USER PROFILE:
- Gender: ${userProfile.gender}
- Height: ${userProfile.height}cm
- Body Type: ${userProfile.bodyType}
- Skin Tone: ${userProfile.skinTone}
- Weight: ${userProfile.weight}kg

WEATHER CONDITIONS:
- Current Temperature: ${weather.temperature}°C
- Weather Condition: ${weather.condition}
- Description: ${weather.description}
- Humidity: ${weather.humidity}%
- Wind Speed: ${weather.windSpeed} km/h
- Location: ${weather.location}
- Morning Temperature: ${weather.forecast.morning.temp}°C
- Afternoon Temperature: ${weather.forecast.afternoon.temp}°C
- Evening Temperature: ${weather.forecast.evening.temp}°C

REQUIREMENTS:
1. Create ONE perfect outfit specifically for a ${userProfile.gender}
2. Consider the weather conditions and temperature changes throughout the day
3. Ensure the outfit is appropriate for their body type and skin tone
4. Include practical weather-appropriate items
5. Provide a daily inspirational quote that matches the outfit mood
6. Generate shopping links for popular platforms

FORMAT YOUR RESPONSE AS JSON:
{
  "id": "todays_outfit_${Date.now()}",
  "title": "Weather-appropriate outfit name",
  "description": "Brief description of why this outfit is perfect for today",
  "items": [
    "Specific clothing item 1 (e.g., 'Light cotton t-shirt')",
    "Specific clothing item 2 (e.g., 'Comfortable jeans')",
    "Specific clothing item 3 (e.g., 'Lightweight jacket')",
    "Footwear recommendation",
    "Accessories if needed"
  ],
  "colors": [
    "Primary color that suits ${userProfile.skinTone} skin tone",
    "Secondary color",
    "Accent color"
  ],
  "style_tips": [
    "Weather-specific styling tip",
    "Body type specific tip for ${userProfile.bodyType}",
    "Color coordination tip for ${userProfile.skinTone} skin tone"
  ],
  "weather_reason": "Detailed explanation of why this outfit is perfect for ${weather.temperature}°C and ${weather.condition} weather",
  "shopping_links": [
    {
      "platform": "Pinterest",
      "url": "https://www.pinterest.com/search/pins/?q=${encodeURIComponent('outfit for ' + weather.condition + ' weather ' + userProfile.gender)}",
      "description": "Find similar outfit inspiration",
      "icon": "camera"
    },
    {
      "platform": "Amazon Fashion",
      "url": "https://www.amazon.com/s?k=${encodeURIComponent(userProfile.gender + ' clothing ' + weather.condition + ' weather')}&rh=n%3A7141123011",
      "description": "Shop weather-appropriate clothing",
      "icon": "bag"
    },
    {
      "platform": "Style Guide",
      "url": "https://www.google.com/search?q=${encodeURIComponent('how to dress for ' + weather.condition + ' weather ' + userProfile.gender + ' style guide')}",
      "description": "Learn weather dressing tips",
      "icon": "book"
    },
    {
      "platform": "Color Matching",
      "url": "https://www.google.com/search?q=${encodeURIComponent(userProfile.skinTone + ' skin tone best colors fashion ' + userProfile.gender)}",
      "description": "Colors that suit your skin tone",
      "icon": "color-palette"
    }
  ],
  "daily_quote": "An inspirational quote that matches the outfit mood and weather (e.g., 'Dress like you're already famous' or 'Style is a way to say who you are without having to speak')",
  "mood": "The mood/vibe of this outfit (e.g., 'Confident & Comfortable', 'Chic & Weather-Ready')"
}

IMPORTANT GUIDELINES:
- Make the outfit gender-specific (${userProfile.gender} clothing only)
- Consider temperature fluctuations throughout the day
- Include layering options if temperature varies significantly
- Ensure colors complement ${userProfile.skinTone} skin tone
- Make style tips specific to ${userProfile.bodyType} body type
- Keep the daily quote inspiring and relevant to fashion/confidence
- Make shopping URLs functional and properly encoded

Return ONLY the JSON object, no additional text.
`;

    const result = await model.generateContent(prompt);
    const responseText = result.response.text();

    // Clean the response to ensure it's valid JSON
    const cleanedResponse = responseText.replace(/```json\n?|\n?```/g, '').trim();

    try {
      const parsed = JSON.parse(cleanedResponse);
      return parsed;
    } catch (parseError) {
      console.error('JSON Parse Error for today\'s outfit:', parseError);
      console.log('Raw response:', responseText);
      // Return fallback outfit
      return generateFallbackTodaysOutfit(userProfile, weather);
    }
  } catch (error: any) {
    console.error('Gemini API Error for today\'s outfit:', error);

    // Check if it's a 503 error (model overloaded)
    if (error.message?.includes('503') || error.message?.includes('overloaded')) {
      console.log('🔄 Gemini model overloaded, using fallback outfit');
      return generateFallbackTodaysOutfit(userProfile, weather);
    }

    // For other errors, return fallback as well
    return generateFallbackTodaysOutfit(userProfile, weather);
  }
};

const generateFallbackWardrobeAnalysis = (clothingImages: string[], userProfile: any): any => {
  const isMale = userProfile?.gender?.toLowerCase() === 'male';
  
  return {
    availableOutfits: [
      {
        name: isMale ? "Smart Casual Mix" : "Versatile Chic",
        items: ["Available top from your wardrobe", "Available bottom from your wardrobe"],
        colors: ["Navy", "White"],
        occasion: "Daily wear, casual meetings",
        completeness: 70,
        missingItems: [
          {
            item: isMale ? "Casual blazer" : "Statement accessories",
            reason: "Would elevate the look and add versatility",
            shoppingLinks: [
              {
                platform: "Amazon",
                searchQuery: isMale ? "men casual blazer" : "women statement accessories",
                url: `https://www.amazon.com/s?k=${encodeURIComponent(isMale ? 'men casual blazer' : 'women statement accessories')}`,
                description: "Shop to complete this look"
              },
              {
                platform: "Myntra",
                searchQuery: isMale ? "casual blazer men" : "accessories women",
                url: `https://www.myntra.com/search/${encodeURIComponent(isMale ? 'casual blazer men' : 'accessories women')}`,
                description: "Find similar items on Myntra"
              }
            ]
          }
        ],
        outfitLinks: [
          {
            platform: "Pinterest",
            searchQuery: isMale ? "smart casual outfit men" : "versatile chic outfit women",
            url: `https://www.pinterest.com/search/pins/?q=${encodeURIComponent(isMale ? 'smart casual outfit men' : 'versatile chic outfit women')}`,
            description: "Get outfit inspiration"
          }
        ]
      }
    ],
    suggestions: [
      {
        item: isMale ? "White dress shirt" : "Little black dress",
        reason: "Essential versatile piece that works with multiple combinations",
        priority: "high" as const,
        shoppingLinks: [
          {
            platform: "Amazon",
            searchQuery: isMale ? "white dress shirt men" : "little black dress women",
            url: `https://www.amazon.com/s?k=${encodeURIComponent(isMale ? 'white dress shirt men' : 'little black dress women')}`,
            description: "Shop this essential piece"
          }
        ]
      }
    ],
    wardrobeAnalysis: {
      totalItems: clothingImages.length,
      categories: ["tops", "bottoms"],
      missingCategories: isMale ? ["blazers", "formal shoes"] : ["dresses", "heels"],
      completenessScore: 65
    }
  };
};

const generateFallbackTodaysOutfit = (userProfile: any, weather: any): any => {
  const isCold = weather.temperature < 15;
  const isHot = weather.temperature > 30;
  const isRainy = weather.condition.toLowerCase().includes('rain');
  const isMale = userProfile.gender?.toLowerCase() === 'male';

  let outfit;

  if (isCold) {
    outfit = {
      title: isMale ? "Cozy Winter Layers" : "Warm & Stylish",
      items: isMale
        ? ["Warm sweater", "Dark jeans", "Winter jacket", "Boots", "Scarf"]
        : ["Cozy cardigan", "Leggings", "Long coat", "Ankle boots", "Warm scarf"],
      colors: ["Navy", "Gray", "Brown"],
      mood: "Warm & Comfortable"
    };
  } else if (isHot) {
    outfit = {
      title: isMale ? "Cool Summer Vibes" : "Breezy & Fresh",
      items: isMale
        ? ["Light cotton t-shirt", "Shorts", "Sneakers", "Cap", "Sunglasses"]
        : ["Flowy top", "Light dress", "Sandals", "Sun hat", "Light cardigan"],
      colors: ["White", "Light Blue", "Beige"],
      mood: "Cool & Refreshed"
    };
  } else if (isRainy) {
    outfit = {
      title: isMale ? "Rain-Ready Style" : "Chic Rain Day",
      items: isMale
        ? ["Water-resistant jacket", "Dark jeans", "Waterproof shoes", "Umbrella"]
        : ["Trench coat", "Jeans", "Rain boots", "Umbrella", "Crossbody bag"],
      colors: ["Navy", "Black", "Gray"],
      mood: "Weather-Ready & Stylish"
    };
  } else {
    outfit = {
      title: isMale ? "Perfect Day Casual" : "Effortlessly Chic",
      items: isMale
        ? ["Casual shirt", "Chinos", "Sneakers", "Light jacket"]
        : ["Blouse", "Jeans", "Comfortable flats", "Light cardigan"],
      colors: ["Blue", "White", "Khaki"],
      mood: "Relaxed & Confident"
    };
  }

  return {
    id: `fallback_${Date.now()}`,
    title: outfit.title,
    description: `Perfect outfit for ${weather.temperature}°C ${weather.condition.toLowerCase()} weather`,
    items: outfit.items,
    colors: outfit.colors,
    style_tips: [
      `Dress in layers for ${weather.temperature}°C weather`,
      `Choose breathable fabrics for comfort`,
      `Colors that complement your ${userProfile.skinTone} skin tone`
    ],
    weather_reason: `This outfit is designed for ${weather.temperature}°C ${weather.condition} weather, ensuring comfort throughout the day.`,
    shopping_links: [
      {
        platform: "Pinterest",
        url: `https://www.pinterest.com/search/pins/?q=${encodeURIComponent(outfit.title + ' outfit ' + userProfile.gender)}`,
        description: "Find similar outfit inspiration",
        icon: "camera"
      },
      {
        platform: "Amazon Fashion",
        url: `https://www.amazon.com/s?k=${encodeURIComponent(userProfile.gender + ' clothing')}`,
        description: "Shop similar items",
        icon: "bag"
      }
    ],
    daily_quote: "Style is a way to say who you are without having to speak.",
    mood: outfit.mood
  };
};

// Helper function to generate gender-specific shopping and reference links
const generateGenderSpecificLinks = (
  gender: string,
  category: string,
  searchTerms: string[]
): {
  shopping_links: Array<{ platform: string, url: string, description: string, icon: string }>,
  reference_links: Array<{ platform: string, url: string, description: string, icon: string }>
} => {
  const genderTerm = gender === 'male' ? 'men' : 'women';
  const mainSearchTerm = `${genderTerm} ${category} ${searchTerms.join(' ')}`;

  return {
    shopping_links: [
      {
        platform: "Amazon",
        url: `https://www.amazon.com/s?k=${encodeURIComponent(mainSearchTerm)}&ref=nb_sb_noss`,
        description: `Shop ${genderTerm}'s ${category} items on Amazon`,
        icon: "bag"
      },
      {
        platform: "Pinterest",
        url: `https://www.pinterest.com/search/pins/?q=${encodeURIComponent(mainSearchTerm + ' outfit')}`,
        description: `Find ${genderTerm}'s ${category} outfit inspiration`,
        icon: "camera"
      }
    ],
    reference_links: [
      {
        platform: "Style Guide",
        url: `https://www.google.com/search?q=${encodeURIComponent(mainSearchTerm + ' style guide')}`,
        description: `Learn ${genderTerm}'s ${category} styling tips`,
        icon: "book"
      }
    ]
  };
};

export const generateTopographyAwareOutfits = async (
  imageUri: string,
  prompt: string,
  topography: TopographyData,
  userProfile?: any
): Promise<StyleAnalysisResult> => {
  // Check rate limit
  if (!geminiRateLimiter.canMakeCall()) {
    const waitTime = Math.ceil(geminiRateLimiter.getTimeUntilNextCall() / 1000);
    throw new Error(`Rate limit exceeded. Please wait ${waitTime} seconds before trying again.`);
  }

  // Track AI request at the start
  trackAIRequest();

  // Retry logic for API overload
  const maxRetries = 3;
  let lastError;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      console.log(`Attempt ${attempt} of ${maxRetries} for Gemini API call`);

      // Try different models based on attempt
      let model;
      if (attempt === 1) {
        model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });
      } else if (attempt === 2) {
        model = genAI.getGenerativeModel({ model: 'gemini-pro-vision' });
      } else {
        model = genAI.getGenerativeModel({ model: 'gemini-pro' });
      }

      // Convert image to base64
      const response = await fetch(imageUri);
      const blob = await response.blob();
      const base64 = await blobToBase64(blob);

      const imagePart = {
        inlineData: {
          data: base64.split(',')[1], // Remove data:image/jpeg;base64, prefix
          mimeType: blob.type,
        },
      };

      const safePrompt = sanitizeForPrompt(prompt);

      // Build user profile context for personalized recommendations
      const userContext = userProfile ? buildUserProfileContext(userProfile) : '';

      // Build topography context
      const topographyContext = buildTopographyContext(topography);

      const analysisPrompt = `
Analyze this image and the user's description: "${safePrompt}"

${userContext ? `User Profile Information:
${userContext}

Please consider the user's body type, height, skin tone, and gender when making recommendations.` : ''}

${topographyContext ? `Location & Cultural Context:
${topographyContext}

IMPORTANT: The outfit recommendations MUST be appropriate for the location's climate, cultural style, and local fashion trends. Consider the regional preferences, terrain, and cultural sensitivities when suggesting clothing items.` : ''}

Please provide a detailed style analysis in the following JSON format:
{
  "venue": "Brief description of the place/venue type",
  "ambiance": "Description of the atmosphere and mood",
  "dominantColors": ["color1", "color2", "color3"],
  "recommendations": [
    {
      "style": "Style name (e.g., Smart Casual)",
      "colors": ["color1", "color2", "color3"],
      "outfit": "Specific outfit description listing concrete items and colors (e.g., 'black shirt + beige shorts + white sneakers')",
      "accessories": "Recommended accessories",
      "mood": "Mood/vibe of this outfit",
      "reasoning": "Why this works for this venue AND location/cultural context",
      "culturallyAppropriate": true,
      "shoppingLinks": [
        {
          "platform": "Pinterest",
          "searchQuery": "<derive from outfit items; avoid generic examples>",
          "url": "https://www.pinterest.com/search/pins/?q=<URL_ENCODED_QUERY>",
          "description": "Outfit inspiration and styling ideas"
        },
        {
          "platform": "Amazon",
          "searchQuery": "<use 1-2 key items from outfit; avoid generic examples>",
          "url": "https://www.amazon.com/s?k=<URL_ENCODED_QUERY>",
          "description": "Shop similar items"
        }
      ]
    }
  ],
  "tips": ["tip1", "tip2", "tip3", "tip4"],
  "locationConsiderations": "Specific advice on how to adapt the outfit for the local climate, culture, and fashion trends"
}

Focus on:
1. Extract the dominant colors from the image
2. Consider the venue's lighting and atmosphere
3. Match outfit colors that complement the environment AND the user's skin tone
4. Provide 3-4 different style options suitable for the user's body type
5. Consider the occasion described in the prompt
6. Give practical styling tips specific to the user's body type and height
7. Ensure all recommendations flatter the user's specific body shape and proportions
8. CRITICAL: Make sure all outfit recommendations are appropriate for the location's climate and cultural context
9. Incorporate local fashion trends and cultural elements where appropriate
10. Consider the terrain and lifestyle of the location

Rules for shopping links:
- DO NOT reuse generic examples like "navy blazer white shirt". Always derive queries from the actual outfit and user's prompt.
- For Amazon/Myntra: Use ONLY 1-2 specific items from the outfit (e.g., "black shirt", "white sneakers", "olive pants")
- For Pinterest: Use the full outfit description for inspiration searches
- NEVER search for the entire outfit as one query - break it down into individual items
- Focus on the most important clothing pieces that users would actually search for

Make sure the response is valid JSON only, no additional text.
`;

      const result = await model.generateContent([analysisPrompt, imagePart]);
      const responseText = result.response.text();

      // Clean the response to ensure it's valid JSON
      const cleanedResponse = responseText.replace(/```json\n?|\n?```/g, '').trim();

      try {
        const parsedResult = JSON.parse(cleanedResponse);
        console.log(`Successfully got response on attempt ${attempt}`);
        return parsedResult;
      } catch (parseError) {
        console.error('JSON Parse Error:', parseError);
        // If JSON parsing fails, try next attempt or fallback
        if (attempt === maxRetries) {
          return generateTopographyAwareFallbackResponse(prompt, topography, userProfile);
        }
        continue;
      }

    } catch (error: any) {
      console.error(`Gemini API Error (attempt ${attempt}):`, error);
      lastError = error;

      // Check if it's a 503 (overloaded) or rate limit error
      if (error.message?.includes('overloaded') || error.message?.includes('503') || error.message?.includes('429')) {
        console.log(`Model overloaded/rate limited, waiting before retry...`);
        await new Promise(resolve => setTimeout(resolve, 2000 * attempt)); // Exponential backoff
        continue;
      }

      // If it's not a retryable error, break the loop
      break;
    }
  }

  // If all retries failed, return fallback response
  console.error('All Gemini API attempts failed, using fallback response');
  return generateTopographyAwareFallbackResponse(prompt, topography, userProfile);
};

export const generateWeatherAwareOutfits = async (
  imageUri: string,
  prompt: string,
  weather: any,
  userProfile?: any
): Promise<StyleAnalysisResult> => {
  // Check rate limit
  if (!geminiRateLimiter.canMakeCall()) {
    const waitTime = Math.ceil(geminiRateLimiter.getTimeUntilNextCall() / 1000);
    throw new Error(`Rate limit exceeded. Please wait ${waitTime} seconds before trying again.`);
  }

  // Retry logic for API overload
  const maxRetries = 3;
  let lastError;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      console.log(`Attempt ${attempt} of ${maxRetries} for Gemini API call`);

      // Try different models based on attempt
      let model;
      if (attempt === 1) {
        model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });
      } else if (attempt === 2) {
        model = genAI.getGenerativeModel({ model: 'gemini-pro-vision' });
      } else {
        model = genAI.getGenerativeModel({ model: 'gemini-pro' });
      }

      // Convert image to base64
      const response = await fetch(imageUri);
      const blob = await response.blob();
      const base64 = await blobToBase64(blob);

      const imagePart = {
        inlineData: {
          data: base64.split(',')[1], // Remove data:image/jpeg;base64, prefix
          mimeType: blob.type,
        },
      };

      const safePrompt = sanitizeForPrompt(prompt);

      // Build user profile context for personalized recommendations
      const userContext = userProfile ? buildUserProfileContext(userProfile) : '';

      // Build weather context
      const weatherContext = weather ? buildWeatherContext(weather) : '';

      const analysisPrompt = `
Analyze this image and the user's description: "${safePrompt}"

${userContext ? `User Profile Information:
${userContext}

Please consider the user's body type, height, skin tone, and gender when making recommendations.` : ''}

${weatherContext ? `Current Weather Conditions:
${weatherContext}

IMPORTANT: The outfit recommendations MUST be appropriate for the current weather conditions. Consider temperature, humidity, wind, and weather conditions when suggesting clothing items.` : ''}

Please provide a detailed style analysis in the following JSON format:
{
  "venue": "Brief description of the place/venue type",
  "ambiance": "Description of the atmosphere and mood",
  "dominantColors": ["color1", "color2", "color3"],
  "recommendations": [
    {
      "style": "Style name (e.g., Smart Casual)",
      "colors": ["color1", "color2", "color3"],
      "outfit": "Specific outfit description listing concrete items and colors (e.g., 'black shirt + beige shorts + white sneakers')",
      "accessories": "Recommended accessories",
      "mood": "Mood/vibe of this outfit",
      "reasoning": "Why this works for this venue AND weather conditions",
      "weatherAppropriate": true,
      "shoppingLinks": [
        {
          "platform": "Pinterest",
          "searchQuery": "<derive from outfit items; avoid generic examples>",
          "url": "https://www.pinterest.com/search/pins/?q=<URL_ENCODED_QUERY>",
          "description": "Outfit inspiration and styling ideas"
        },
        {
          "platform": "Amazon",
          "searchQuery": "<use 1-2 key items from outfit; avoid generic examples>",
          "url": "https://www.amazon.com/s?k=<URL_ENCODED_QUERY>",
          "description": "Shop similar items"
        }
      ]
    }
  ],
  "tips": ["tip1", "tip2", "tip3", "tip4"],
  "weatherConsiderations": "Specific advice on how to adapt the outfit for current weather conditions"
}

Focus on:
1. Extract the dominant colors from the image
2. Consider the venue's lighting and atmosphere
3. Match outfit colors that complement the environment AND the user's skin tone
4. Provide 3-4 different style options suitable for the user's body type
5. Consider the occasion described in the prompt
6. Give practical styling tips specific to the user's body type and height
7. Ensure all recommendations flatter the user's specific body shape and proportions
8. CRITICAL: Make sure all outfit recommendations are weather-appropriate for the current conditions

Rules for shopping links:
- DO NOT reuse generic examples like "navy blazer white shirt". Always derive queries from the actual outfit and user's prompt.
- For Amazon/Myntra: Use ONLY 1-2 specific items from the outfit (e.g., "black shirt", "white sneakers", "olive pants")
- For Pinterest: Use the full outfit description for inspiration searches
- NEVER search for the entire outfit as one query - break it down into individual items
- Focus on the most important clothing pieces that users would actually search for

Make sure the response is valid JSON only, no additional text.
`;

      const result = await model.generateContent([analysisPrompt, imagePart]);
      const responseText = result.response.text();

      // Clean the response to ensure it's valid JSON
      const cleanedResponse = responseText.replace(/```json\n?|\n?```/g, '').trim();

      try {
        const parsedResult = JSON.parse(cleanedResponse);
        console.log(`Successfully got response on attempt ${attempt}`);
        return parsedResult;
      } catch (parseError) {
        console.error('JSON Parse Error:', parseError);
        // If JSON parsing fails, try next attempt or fallback
        if (attempt === maxRetries) {
          return generateWeatherAwareFallbackResponse(prompt, weather, userProfile);
        }
        continue;
      }

    } catch (error: any) {
      console.error(`Gemini API Error (attempt ${attempt}):`, error);
      lastError = error;

      // Check if it's a 503 (overloaded) or rate limit error
      if (error.message?.includes('overloaded') || error.message?.includes('503') || error.message?.includes('429')) {
        console.log(`Model overloaded/rate limited, waiting before retry...`);
        await new Promise(resolve => setTimeout(resolve, 2000 * attempt)); // Exponential backoff
        continue;
      }

      // If it's not a retryable error, break the loop
      break;
    }
  }

  // If all retries failed, return fallback response
  console.error('All Gemini API attempts failed, using fallback response');
  return generateWeatherAwareFallbackResponse(prompt, weather, userProfile);
};

// Helper function to build topography context for outfit recommendations
const buildTopographyContext = (topography: TopographyData): string => {
  const context = [];

  if (topography.location) {
    context.push(`Location: ${topography.location}`);
  }
  if (topography.region) {
    context.push(`Region: ${topography.region}`);
  }
  if (topography.climate) {
    context.push(`Climate: ${topography.climate}`);
  }
  if (topography.terrain) {
    context.push(`Terrain: ${topography.terrain}`);
  }
  if (topography.culturalStyle) {
    context.push(`Cultural Style: ${topography.culturalStyle}`);
  }
  if (topography.seasonalConsiderations) {
    context.push(`Seasonal Notes: ${topography.seasonalConsiderations}`);
  }
  if (topography.localFashionTrends && topography.localFashionTrends.length > 0) {
    context.push(`Local Trends: ${topography.localFashionTrends.join(', ')}`);
  }

  return context.join(', ');
};

// Helper function to build weather context for outfit recommendations
const buildWeatherContext = (weather: any): string => {
  const context = [];

  if (weather.temperature !== undefined) {
    context.push(`Temperature: ${weather.temperature}°C`);
  }
  if (weather.condition) {
    context.push(`Weather: ${weather.condition}`);
  }
  if (weather.description) {
    context.push(`Description: ${weather.description}`);
  }
  if (weather.humidity !== undefined) {
    context.push(`Humidity: ${weather.humidity}%`);
  }
  if (weather.windSpeed !== undefined) {
    context.push(`Wind Speed: ${weather.windSpeed} km/h`);
  }
  if (weather.location) {
    context.push(`Location: ${weather.location}`);
  }
  if (weather.forecast) {
    if (weather.forecast.morning?.temp) {
      context.push(`Morning: ${weather.forecast.morning.temp}°C`);
    }
    if (weather.forecast.afternoon?.temp) {
      context.push(`Afternoon: ${weather.forecast.afternoon.temp}°C`);
    }
    if (weather.forecast.evening?.temp) {
      context.push(`Evening: ${weather.forecast.evening.temp}°C`);
    }
  }

  return context.join(', ');
};

// Topography-aware fallback response
const generateTopographyAwareFallbackResponse = (prompt: string, topography: TopographyData, userProfile?: any): StyleAnalysisResult => {
  // Extract keywords from the prompt to make fallback more relevant
  const promptLower = prompt.toLowerCase();

  // Determine venue type from prompt
  let venue = "Based on your description";
  let ambiance = "Stylish and appropriate for the occasion";

  if (promptLower.includes('restaurant') || promptLower.includes('dining') || promptLower.includes('cafe')) {
    venue = "Restaurant/Cafe";
    ambiance = "Elegant dining atmosphere";
  } else if (promptLower.includes('office') || promptLower.includes('work') || promptLower.includes('business')) {
    venue = "Office/Workplace";
    ambiance = "Professional and polished";
  } else if (promptLower.includes('party') || promptLower.includes('celebration') || promptLower.includes('event')) {
    venue = "Party/Event";
    ambiance = "Festive and celebratory";
  } else if (promptLower.includes('casual') || promptLower.includes('everyday') || promptLower.includes('daily')) {
    venue = "Casual/Everyday";
    ambiance = "Comfortable and relaxed";
  } else if (promptLower.includes('formal') || promptLower.includes('wedding') || promptLower.includes('ceremony')) {
    venue = "Formal Event";
    ambiance = "Elegant and sophisticated";
  }

  // Generate topography-appropriate outfit suggestions
  const outfitSuggestions = generateTopographyAwareOutfitSuggestions(promptLower, topography, userProfile);

  return {
    venue,
    ambiance,
    dominantColors: outfitSuggestions.dominantColors,
    recommendations: outfitSuggestions.recommendations,
    tips: generateTopographyAwareTips(topography, userProfile),
    locationConsiderations: generateLocationConsiderations(topography)
  };
};

// Weather-aware fallback response
const generateWeatherAwareFallbackResponse = (prompt: string, weather: any, userProfile?: any): StyleAnalysisResult => {
  // Extract keywords from the prompt to make fallback more relevant
  const promptLower = prompt.toLowerCase();

  // Determine venue type from prompt
  let venue = "Based on your description";
  let ambiance = "Stylish and appropriate for the occasion";

  if (promptLower.includes('restaurant') || promptLower.includes('dining') || promptLower.includes('cafe')) {
    venue = "Restaurant/Cafe";
    ambiance = "Elegant dining atmosphere";
  } else if (promptLower.includes('office') || promptLower.includes('work') || promptLower.includes('business')) {
    venue = "Office/Workplace";
    ambiance = "Professional and polished";
  } else if (promptLower.includes('party') || promptLower.includes('celebration') || promptLower.includes('event')) {
    venue = "Party/Event";
    ambiance = "Festive and celebratory";
  } else if (promptLower.includes('casual') || promptLower.includes('everyday') || promptLower.includes('daily')) {
    venue = "Casual/Everyday";
    ambiance = "Comfortable and relaxed";
  } else if (promptLower.includes('formal') || promptLower.includes('wedding') || promptLower.includes('ceremony')) {
    venue = "Formal Event";
    ambiance = "Elegant and sophisticated";
  }

  // Generate weather-appropriate outfit suggestions
  const outfitSuggestions = generateWeatherAwareOutfitSuggestions(promptLower, weather, userProfile);

  return {
    venue,
    ambiance,
    dominantColors: outfitSuggestions.dominantColors,
    recommendations: outfitSuggestions.recommendations,
    tips: generateWeatherAwareTips(weather, userProfile),
    weatherConsiderations: generateWeatherConsiderations(weather)
  };
};

// Helper function to generate topography-appropriate outfit suggestions
const generateTopographyAwareOutfitSuggestions = (promptLower: string, topography: TopographyData, userProfile?: any): { dominantColors: string[], recommendations: OutfitSuggestion[] } => {
  const isMale = userProfile?.gender?.toLowerCase() === 'male';
  const isIndian = topography.region.includes('India');

  let outfitThemes: Array<{ style: string, colors: string[], outfit: string, accessories: string, mood: string, reasoning: string, culturallyAppropriate: boolean }> = [];

  // Generate outfits based on location and cultural context
  if (isIndian) {
    // Indian regional styling
    switch (topography.region) {
      case 'North India':
        outfitThemes = [
          {
            style: isMale ? "North Indian Contemporary" : "Delhi Chic",
            colors: ["Navy", "Cream", "Gold"],
            outfit: isMale ? "Kurta + Dark jeans + Leather shoes" : "Kurti + Palazzo pants + Statement jewelry",
            accessories: isMale ? "Watch, leather belt, minimal chain" : "Jhumkas, bangles, ethnic bag",
            mood: "Cultural Modern",
            reasoning: `Perfect for ${topography.location}'s contemporary culture that blends tradition with modernity`,
            culturallyAppropriate: true
          },
          {
            style: isMale ? "Business Casual Delhi" : "Professional Elegance",
            colors: ["Charcoal", "White", "Burgundy"],
            outfit: isMale ? "Blazer + Shirt + Chinos + Formal shoes" : "Blazer + Blouse + Trousers + Heels",
            accessories: isMale ? "Tie, watch, leather bag" : "Pearl jewelry, structured bag, scarf",
            mood: "Professional Power",
            reasoning: `Ideal for ${topography.location}'s business environment with cultural sophistication`,
            culturallyAppropriate: true
          }
        ];
        break;

      case 'South India':
        outfitThemes = [
          {
            style: isMale ? "South Indian Comfort" : "Traditional Modern",
            colors: ["White", "Gold", "Maroon"],
            outfit: isMale ? "Cotton shirt + Lungi/Dhoti + Sandals" : "Cotton saree + Blouse + Temple jewelry",
            accessories: isMale ? "Gold chain, watch, traditional footwear" : "Gold jewelry, flowers, silk bag",
            mood: "Cultural Comfort",
            reasoning: `Embraces ${topography.location}'s traditional values with comfortable, climate-appropriate fabrics`,
            culturallyAppropriate: true
          },
          {
            style: isMale ? "Tech Professional" : "Modern South Indian",
            colors: ["Light Blue", "Beige", "Coral"],
            outfit: isMale ? "Linen shirt + Cotton pants + Loafers" : "Cotton dress + Cardigan + Flats",
            accessories: isMale ? "Minimal jewelry, leather bag" : "Simple gold jewelry, crossbody bag",
            mood: "Contemporary Comfort",
            reasoning: `Perfect for ${topography.location}'s tech-savvy culture with breathable fabrics for the climate`,
            culturallyAppropriate: true
          }
        ];
        break;

      case 'West India':
        outfitThemes = [
          {
            style: isMale ? "Mumbai Business" : "Bollywood Inspired",
            colors: ["Black", "Silver", "Royal Blue"],
            outfit: isMale ? "Formal shirt + Trousers + Dress shoes" : "Designer dress + Statement accessories + Heels",
            accessories: isMale ? "Watch, cufflinks, leather briefcase" : "Designer jewelry, clutch, sunglasses",
            mood: "Glamorous Professional",
            reasoning: `Captures ${topography.location}'s glamorous business culture and entertainment industry influence`,
            culturallyAppropriate: true
          },
          {
            style: isMale ? "Coastal Casual" : "Monsoon Ready",
            colors: ["Olive", "Cream", "Teal"],
            outfit: isMale ? "Linen shirt + Shorts + Canvas shoes" : "Flowy top + Palazzo + Sandals",
            accessories: isMale ? "Sunglasses, canvas bag" : "Light scarf, waterproof bag, minimal jewelry",
            mood: "Relaxed Coastal",
            reasoning: `Ideal for ${topography.location}'s coastal climate with monsoon-appropriate, breathable fabrics`,
            culturallyAppropriate: true
          }
        ];
        break;

      case 'East India':
        outfitThemes = [
          {
            style: isMale ? "Intellectual Casual" : "Bengali Elegance",
            colors: ["White", "Red", "Gold"],
            outfit: isMale ? "Kurta + Pajama + Leather sandals" : "Handloom saree + Blouse + Traditional jewelry",
            accessories: isMale ? "Jhola bag, simple watch" : "Conch shell bangles, handwoven bag, flowers",
            mood: "Cultural Intellectual",
            reasoning: `Reflects ${topography.location}'s rich cultural heritage and intellectual traditions`,
            culturallyAppropriate: true
          },
          {
            style: isMale ? "Modern Bengali" : "Artistic Expression",
            colors: ["Indigo", "Cream", "Mustard"],
            outfit: isMale ? "Cotton shirt + Khadi pants + Kolhapuri chappals" : "Handloom dress + Jacket + Ethnic accessories",
            accessories: isMale ? "Handwoven bag, minimal jewelry" : "Artistic jewelry, handcrafted bag, scarf",
            mood: "Artistic Modern",
            reasoning: `Perfect for ${topography.location}'s appreciation of handloom and artistic expression`,
            culturallyAppropriate: true
          }
        ];
        break;

      default:
        // General Indian styling
        outfitThemes = [
          {
            style: isMale ? "Indian Fusion" : "Contemporary Indian",
            colors: ["Navy", "Cream", "Orange"],
            outfit: isMale ? "Kurta + Jeans + Sneakers" : "Indo-western top + Leggings + Flats",
            accessories: isMale ? "Watch, minimal chain" : "Ethnic jewelry, crossbody bag",
            mood: "Modern Fusion",
            reasoning: `Versatile Indian fusion style perfect for ${topography.location}'s contemporary culture`,
            culturallyAppropriate: true
          }
        ];
    }
  } else {
    // International styling (fallback for non-Indian locations)
    outfitThemes = [
      {
        style: isMale ? "International Casual" : "Global Chic",
        colors: ["Black", "White", "Gray"],
        outfit: isMale ? "T-shirt + Jeans + Sneakers" : "Blouse + Pants + Flats",
        accessories: isMale ? "Watch, backpack" : "Simple jewelry, handbag",
        mood: "Universal Style",
        reasoning: `Versatile international style appropriate for ${topography.location}`,
        culturallyAppropriate: true
      }
    ];
  }

  // Apply user profile considerations if available
  if (userProfile) {
    outfitThemes = outfitThemes.map(theme => {
      let enhancedReasoning = theme.reasoning;

      // Add body type specific reasoning
      if (userProfile.bodyType) {
        switch (userProfile.bodyType.toLowerCase()) {
          case 'slim':
            enhancedReasoning += ` Perfect for slim figures as it adds visual weight and creates curves.`;
            break;
          case 'athletic':
            enhancedReasoning += ` Ideal for athletic builds, emphasizing your toned physique.`;
            break;
          case 'heavy':
            enhancedReasoning += ` Flattering for your body type with strategic color blocking and fit.`;
            break;
        }
      }

      // Add skin tone considerations
      if (userProfile.skinTone) {
        enhancedReasoning += ` Colors chosen to complement your ${userProfile.skinTone} skin tone.`;
      }

      return {
        ...theme,
        reasoning: enhancedReasoning
      };
    });
  }

  // Generate shopping links for each outfit
  const recommendations = outfitThemes.map(theme => {
    const shoppingLinks = generateFallbackShoppingLinks(theme.outfit);
    return {
      ...theme,
      shoppingLinks
    };
  });

  // Extract dominant colors from all outfits
  const allColors = outfitThemes.flatMap(theme => theme.colors);
  const dominantColors = Array.from(new Set(allColors)).slice(0, 4);

  return { dominantColors, recommendations };
};

// Helper function to generate weather-appropriate outfit suggestions
const generateWeatherAwareOutfitSuggestions = (promptLower: string, weather: any, userProfile?: any): { dominantColors: string[], recommendations: OutfitSuggestion[] } => {
  const isCold = weather?.temperature < 15;
  const isHot = weather?.temperature > 30;
  const isRainy = weather?.condition?.toLowerCase().includes('rain');
  const isHumid = weather?.humidity > 70;
  const isMale = userProfile?.gender?.toLowerCase() === 'male';

  let outfitThemes: Array<{ style: string, colors: string[], outfit: string, accessories: string, mood: string, reasoning: string, weatherAppropriate: boolean }> = [];

  if (isCold) {
    outfitThemes = [
      {
        style: isMale ? "Men's Winter Warmth" : "Women's Cozy Winter",
        colors: ["Navy", "Cream", "Brown"],
        outfit: isMale ? "Warm sweater + Dark jeans + Winter jacket + Boots" : "Cozy cardigan + Leggings + Long coat + Ankle boots",
        accessories: isMale ? "Scarf, beanie, warm coat" : "Warm scarf, gloves, statement bag",
        mood: "Warm & Comfortable",
        reasoning: "Layered look for cold weather comfort with proper insulation",
        weatherAppropriate: true
      }
    ];
  } else if (isHot && isHumid) {
    outfitThemes = [
      {
        style: isMale ? "Men's Humid Weather Comfort" : "Women's Breezy Summer",
        colors: ["White", "Light Blue", "Beige"],
        outfit: isMale ? "Light cotton t-shirt + Linen shorts + Breathable sneakers" : "Flowy cotton top + Light dress + Sandals",
        accessories: isMale ? "Cap, sunglasses, light scarf" : "Sun hat, light cardigan, crossbody bag",
        mood: "Cool & Refreshed",
        reasoning: "Light, breathable fabrics perfect for hot and humid conditions",
        weatherAppropriate: true
      }
    ];
  } else if (isHot) {
    outfitThemes = [
      {
        style: isMale ? "Men's Summer Cool" : "Women's Summer Fresh",
        colors: ["White", "Coral", "Gold"],
        outfit: isMale ? "Light cotton t-shirt + Shorts + Sandals" : "Coral sundress + White sandals + Gold jewelry",
        accessories: isMale ? "Sunglasses, straw hat, light scarf" : "Wide-brim hat, crossbody bag",
        mood: "Fresh and breezy",
        reasoning: "Light colors and breathable fabrics for hot weather",
        weatherAppropriate: true
      }
    ];
  } else if (isRainy) {
    outfitThemes = [
      {
        style: isMale ? "Men's Rain-Ready Style" : "Women's Chic Rain Day",
        colors: ["Navy", "Black", "Gray"],
        outfit: isMale ? "Water-resistant jacket + Dark jeans + Waterproof shoes" : "Trench coat + Jeans + Rain boots",
        accessories: isMale ? "Umbrella, waterproof bag" : "Umbrella, crossbody bag",
        mood: "Weather-Ready & Stylish",
        reasoning: "Water-resistant materials and practical footwear for rainy conditions",
        weatherAppropriate: true
      }
    ];
  } else {
    // Moderate weather - versatile outfits
    outfitThemes = [
      {
        style: isMale ? "Men's Perfect Day Casual" : "Women's Effortlessly Chic",
        colors: ["Blue", "White", "Khaki"],
        outfit: isMale ? "Casual shirt + Chinos + Sneakers" : "Blouse + Jeans + Comfortable flats",
        accessories: isMale ? "Light jacket, watch" : "Light cardigan, statement jewelry",
        mood: "Relaxed & Confident",
        reasoning: "Versatile outfit perfect for moderate weather conditions",
        weatherAppropriate: true
      }
    ];
  }

  // Apply user profile considerations if available
  if (userProfile) {
    outfitThemes = outfitThemes.map(theme => {
      let enhancedReasoning = theme.reasoning;

      // Add body type specific reasoning
      if (userProfile.bodyType) {
        switch (userProfile.bodyType.toLowerCase()) {
          case 'slim':
            enhancedReasoning += ` Perfect for slim figures as it adds visual weight and creates curves.`;
            break;
          case 'athletic':
            enhancedReasoning += ` Ideal for athletic builds, emphasizing your toned physique.`;
            break;
          case 'heavy':
            enhancedReasoning += ` Flattering for your body type with strategic color blocking and fit.`;
            break;
          case 'hourglass':
            enhancedReasoning += ` Highlights your natural curves and defined waist.`;
            break;
          case 'pear':
            enhancedReasoning += ` Balances proportions by drawing attention upward.`;
            break;
          case 'apple':
            enhancedReasoning += ` Creates a streamlined silhouette with strategic styling.`;
            break;
        }
      }

      // Add height considerations
      if (userProfile.height) {
        if (userProfile.height < 160) {
          enhancedReasoning += ` Petite-friendly styling that elongates your frame.`;
        } else if (userProfile.height > 175) {
          enhancedReasoning += ` Takes advantage of your height with proportional styling.`;
        }
      }

      // Add skin tone considerations
      if (userProfile.skinTone) {
        enhancedReasoning += ` Colors chosen to complement your ${userProfile.skinTone} skin tone.`;
      }

      return {
        ...theme,
        reasoning: enhancedReasoning
      };
    });
  }

  // Generate shopping links for each outfit
  const recommendations = outfitThemes.map(theme => {
    const shoppingLinks = generateFallbackShoppingLinks(theme.outfit);
    return {
      ...theme,
      shoppingLinks
    };
  });

  // Extract dominant colors from all outfits
  const allColors = outfitThemes.flatMap(theme => theme.colors);
  const dominantColors = Array.from(new Set(allColors)).slice(0, 4);

  return { dominantColors, recommendations };
};

// Helper function to generate weather-aware fashion tips
const generateWeatherAwareTips = (weather: any, userProfile?: any): string[] => {
  const baseTips = [
    "Choose colors that complement your skin tone",
    "Consider the weather and time of day",
    "Comfort is key - you'll look better when you feel good",
    "Add one statement piece to elevate your look"
  ];

  if (!weather) return baseTips;

  const weatherTips = [...baseTips];

  // Add weather-specific tips
  if (weather.temperature < 15) {
    weatherTips.push("Layer your clothing for warmth and style");
    weatherTips.push("Choose insulating fabrics like wool and fleece");
  } else if (weather.temperature > 30) {
    weatherTips.push("Opt for breathable, lightweight fabrics");
    weatherTips.push("Light colors help reflect heat");
  }

  if (weather.humidity > 70) {
    weatherTips.push("Avoid heavy fabrics that trap moisture");
    weatherTips.push("Choose quick-drying materials");
  }

  if (weather.condition?.toLowerCase().includes('rain')) {
    weatherTips.push("Water-resistant materials are your friend");
    weatherTips.push("Practical footwear is essential");
  }

  // Add user profile specific tips
  if (userProfile) {
    if (userProfile.bodyType) {
      switch (userProfile.bodyType.toLowerCase()) {
        case 'slim':
          weatherTips.push("Layer pieces to add visual weight and create curves");
          break;
        case 'athletic':
          weatherTips.push("Emphasize your waist with belts and fitted pieces");
          break;
        case 'heavy':
          weatherTips.push("Monochromatic outfits create a streamlined look");
          break;
      }
    }

    if (userProfile.height) {
      if (userProfile.height < 160) {
        weatherTips.push("High-waisted bottoms elongate your legs");
      } else if (userProfile.height > 175) {
        weatherTips.push("Take advantage of your height with maxi styles");
      }
    }
  }

  return weatherTips.slice(0, 6); // Limit to 6 tips max
};

// Helper function to generate weather considerations
const generateWeatherConsiderations = (weather: any): string => {
  if (!weather) return "Consider the current weather when choosing your outfit.";

  let considerations = "Weather-appropriate styling: ";

  if (weather.temperature < 15) {
    considerations += "Dress warmly with layers for cold weather.";
  } else if (weather.temperature > 30) {
    considerations += "Choose light, breathable fabrics for hot weather.";
  } else {
    considerations += "Moderate temperatures allow for versatile styling.";
  }

  if (weather.humidity > 70) {
    considerations += " High humidity calls for moisture-wicking materials.";
  }

  if (weather.condition?.toLowerCase().includes('rain')) {
    considerations += " Rainy weather requires water-resistant materials and practical footwear.";
  }

  return considerations;
};

export const validateClothingImage = async (imageUri: string): Promise<{ isValid: boolean; confidence: number; reasoning: string; suggestedItems?: string[] }> => {
  // Check rate limit
  if (!geminiRateLimiter.canMakeCall()) {
    const waitTime = Math.ceil(geminiRateLimiter.getTimeUntilNextCall() / 1000);
    throw new Error(`Rate limit exceeded. Please wait ${waitTime} seconds before trying again.`);
  }

  try {
    const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });

    // Convert image to base64
    const response = await fetch(imageUri);
    const blob = await response.blob();
    const base64 = await blobToBase64(blob);

    const imagePart = {
      inlineData: {
        data: base64.split(',')[1],
        mimeType: blob.type,
      },
    };

    const validationPrompt = `
Analyze this image to determine if it contains clothing items that can be used for outfit generation.

REQUIRED ANALYSIS:
1. Is this image of clothing items? (Yes/No)
2. What type of clothing items are visible? (List specific items)
3. Confidence level (1-100%)
4. Reasoning for your assessment

FORMAT YOUR RESPONSE EXACTLY AS:
VALID_CLOTHING: [Yes/No]
CONFIDENCE: [percentage]%
REASONING: [Brief explanation of why this is or isn't clothing]
ITEMS: [List of visible clothing items, or "None" if not clothing]

IMPORTANT GUIDELINES:
- Only classify as clothing if you can clearly see wearable garments
- Reject images of: screenshots, text, food, landscapes, people without visible clothing, objects, etc.
- Accept images of: individual clothing items, outfits on hangers, clothing laid out, etc.
- Be strict - if unsure, classify as invalid
- Focus on whether the image can be used for fashion styling

Make sure the response is in the exact format specified above, no additional text.
`;

    const result = await model.generateContent([validationPrompt, imagePart]);
    const responseText = result.response.text();

    // Parse the response
    const validMatch = responseText.match(/VALID_CLOTHING:\s*(Yes|No)/i);
    const confidenceMatch = responseText.match(/CONFIDENCE:\s*(\d+)%/i);
    const reasoningMatch = responseText.match(/REASONING:\s*([^\n]+)/i);
    const itemsMatch = responseText.match(/ITEMS:\s*([^\n]+)/i);

    const isValid = validMatch ? validMatch[1].toLowerCase() === 'yes' : false;
    const confidence = confidenceMatch ? parseInt(confidenceMatch[1]) : 0;
    const reasoning = reasoningMatch ? reasoningMatch[1].trim() : 'Unable to determine image content';
    const suggestedItems = itemsMatch && itemsMatch[1] !== 'None' ?
      itemsMatch[1].split(',').map(item => item.trim()) : [];

    return {
      isValid,
      confidence,
      reasoning,
      suggestedItems: suggestedItems.length > 0 ? suggestedItems : undefined
    };

  } catch (error: any) {
    console.error('Image validation error:', error);

    // Return a conservative result on error
    return {
      isValid: false,
      confidence: 0,
      reasoning: "Unable to validate image due to processing error. Please upload a clear photo of clothing items."
    };
  }
};

export const validateMultipleClothingImages = async (imageUris: string[]): Promise<{
  validImages: string[];
  invalidImages: Array<{ uri: string; reason: string }>;
  validationResults: Array<{ uri: string; isValid: boolean; confidence: number; reasoning: string }>;
}> => {
  const validationResults = await Promise.all(
    imageUris.map(async (uri) => {
      try {
        const result = await validateClothingImage(uri);
        return {
          uri,
          isValid: result.isValid,
          confidence: result.confidence,
          reasoning: result.reasoning
        };
      } catch (error) {
        console.error(`Error validating image ${uri}:`, error);
        return {
          uri,
          isValid: false,
          confidence: 0,
          reasoning: "Validation failed due to processing error"
        };
      }
    })
  );

  const validImages = validationResults
    .filter(result => result.isValid)
    .map(result => result.uri);

  const invalidImages = validationResults
    .filter(result => !result.isValid)
    .map(result => ({ uri: result.uri, reason: result.reasoning }));

  return {
    validImages,
    invalidImages,
    validationResults
  };
};

export const generateWardrobeBasedOutfits = async (
  clothingImages: string[],
  userProfile: any,
  topography?: any
): Promise<{
  availableOutfits: Array<{
    name: string;
    items: string[];
    colors: string[];
    occasion: string;
    completeness: number;
    missingItems?: Array<{
      item: string;
      reason: string;
      shoppingLinks: OutfitLink[];
    }>;
    outfitLinks: OutfitLink[];
  }>;
  suggestions: Array<{
    item: string;
    reason: string;
    priority: 'high' | 'medium' | 'low';
    shoppingLinks: OutfitLink[];
  }>;
  wardrobeAnalysis: {
    totalItems: number;
    categories: string[];
    missingCategories: string[];
    completenessScore: number;
  };
}> => {
  // Check rate limit
  if (!geminiRateLimiter.canMakeCall()) {
    const waitTime = Math.ceil(geminiRateLimiter.getTimeUntilNextCall() / 1000);
    throw new Error(`Rate limit exceeded. Please wait ${waitTime} seconds before trying again.`);
  }

  // Track AI request at the start
  trackAIRequest();

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

    const locationContext = topography ? buildTopographyContext(topography) : '';

    const analysisPrompt = `
Analyze these wardrobe images and create specific outfits from the available items. Also suggest missing pieces to complete better outfits.

USER PROFILE:
- Gender: ${userProfile.gender || 'Male'}
- Body Type: ${userProfile.bodyType || 'Average'}
- Height: ${userProfile.height || 170}cm
- Skin Tone: ${userProfile.skinTone || 'Fair'}

${locationContext ? `LOCATION CONTEXT: ${locationContext}` : ''}

TASK:
1. Identify all clothing items in the images
2. Create 3-4 complete outfits using ONLY the available items
3. For each outfit, identify what's missing to make it even better
4. Suggest priority items to buy that would unlock more outfit combinations

RESPONSE FORMAT (JSON):
{
  "availableOutfits": [
    {
      "name": "Outfit name (e.g., 'Casual Weekend Look')",
      "items": ["specific item 1 from images", "specific item 2 from images"],
      "colors": ["primary color", "secondary color"],
      "occasion": "when to wear this",
      "completeness": 85,
      "missingItems": [
        {
          "item": "specific missing item (e.g., 'brown leather belt')",
          "reason": "why this would improve the outfit",
          "shoppingLinks": [
            {
              "platform": "Amazon",
              "searchQuery": "brown leather belt men",
              "url": "https://www.amazon.com/s?k=brown+leather+belt+men",
              "description": "Shop brown leather belts"
            }
          ]
        }
      ],
      "outfitLinks": [
        {
          "platform": "Pinterest",
          "searchQuery": "casual weekend outfit men",
          "url": "https://www.pinterest.com/search/pins/?q=casual+weekend+outfit+men",
          "description": "Similar outfit inspiration"
        }
      ]
    }
  ],
  "suggestions": [
    {
      "item": "white dress shirt",
      "reason": "would unlock 3 more formal outfit combinations",
      "priority": "high",
      "shoppingLinks": [
        {
          "platform": "Amazon",
          "searchQuery": "white dress shirt men",
          "url": "https://www.amazon.com/s?k=white+dress+shirt+men",
          "description": "Shop white dress shirts"
        }
      ]
    }
  ],
  "wardrobeAnalysis": {
    "totalItems": 8,
    "categories": ["shirts", "pants", "shoes"],
    "missingCategories": ["blazers", "formal shoes"],
    "completenessScore": 75
  }
}

IMPORTANT RULES:
- Only use items you can clearly see in the images
- Be specific about colors and styles you observe
- Suggest realistic missing pieces that would genuinely improve outfits
- Consider the user's location and cultural context if provided
- Generate proper shopping URLs for suggested items
- Focus on versatile pieces that unlock multiple outfit combinations

Return ONLY the JSON object, no additional text.
`;

    const result = await model.generateContent([analysisPrompt, ...imageParts]);
    const responseText = result.response.text();

    // Clean the response to ensure it's valid JSON
    const cleanedResponse = responseText.replace(/```json\n?|\n?```/g, '').trim();

    try {
      const parsedResult = JSON.parse(cleanedResponse);
      return parsedResult;
    } catch (parseError) {
      console.error('JSON Parse Error for wardrobe analysis:', parseError);
      console.log('Raw response:', responseText);
      // Return fallback result
      return generateFallbackWardrobeAnalysis(clothingImages, userProfile);
    }

  } catch (error: any) {
    console.error('Wardrobe analysis error:', error);
    return generateFallbackWardrobeAnalysis(clothingImages, userProfile);
  }
};

export const analyzeOutfitCompatibility = async (
  clothingImages: string[],
  userProfile: any
): Promise<{
  canFormOutfits: boolean;
  outfitTypes: string[];
  missingCategories: string[];
  recommendations: string[];
  compatibilityScore: number;
}> => {
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

    const analysisPrompt = `
Analyze these clothing items to determine if they can form complete, wearable outfits.

USER PROFILE:
- Gender: ${userProfile.gender || 'Male'}
- Body Type: ${userProfile.bodyType || 'Average'}
- Height: ${userProfile.height || 170}cm
- Skin Tone: ${userProfile.skinTone || 'Fair'}

REQUIRED ANALYSIS:
1. Can these items form complete outfits? (Yes/No)
2. What types of outfits can be created? (List specific outfit types)
3. What clothing categories are missing for complete outfits?
4. Specific recommendations for additional items needed
5. Compatibility score (1-100%)

FORMAT YOUR RESPONSE EXACTLY AS:
CAN_FORM_OUTFITS: [Yes/No]
OUTFIT_TYPES: [List of possible outfit types, separated by commas]
MISSING_CATEGORIES: [List of missing clothing categories, separated by commas]
RECOMMENDATIONS: [Specific recommendations for additional items, separated by semicolons]
COMPATIBILITY_SCORE: [percentage]%

IMPORTANT GUIDELINES:
- Consider gender-appropriate clothing combinations for ${userProfile.gender || 'Male'}
- Focus on creating balanced, wearable outfits
- Identify missing essential pieces (tops, bottoms, footwear, etc.)
- Consider the user's body type and proportions
- Suggest specific items that would complete the outfits
- Be realistic about what can be achieved with the current items

Make sure the response is in the exact format specified above, no additional text.
`;

    const result = await model.generateContent([analysisPrompt, ...imageParts]);
    const responseText = result.response.text();

    // Parse the response
    const canFormMatch = responseText.match(/CAN_FORM_OUTFITS:\s*(Yes|No)/i);
    const outfitTypesMatch = responseText.match(/OUTFIT_TYPES:\s*([^\n]+)/i);
    const missingCategoriesMatch = responseText.match(/MISSING_CATEGORIES:\s*([^\n]+)/i);
    const recommendationsMatch = responseText.match(/RECOMMENDATIONS:\s*([^\n]+)/i);
    const compatibilityScoreMatch = responseText.match(/COMPATIBILITY_SCORE:\s*(\d+)%/i);

    const canFormOutfits = canFormMatch ? canFormMatch[1].toLowerCase() === 'yes' : false;
    const outfitTypes = outfitTypesMatch ?
      outfitTypesMatch[1].split(',').map(type => type.trim()) : [];
    const missingCategories = missingCategoriesMatch ?
      missingCategoriesMatch[1].split(',').map(cat => cat.trim()) : [];
    const recommendations = recommendationsMatch ?
      recommendationsMatch[1].split(';').map(rec => rec.trim()) : [];
    const compatibilityScore = compatibilityScoreMatch ?
      parseInt(compatibilityScoreMatch[1]) : 0;

    return {
      canFormOutfits,
      outfitTypes,
      missingCategories,
      recommendations,
      compatibilityScore
    };

  } catch (error: any) {
    console.error('Outfit compatibility analysis error:', error);

    // Return a conservative result on error
    return {
      canFormOutfits: false,
      outfitTypes: [],
      missingCategories: ['tops', 'bottoms', 'footwear'],
      recommendations: [
        "Please upload clear photos of clothing items",
        "Ensure you have a mix of tops and bottoms",
        "Include footwear for complete outfits"
      ],
      compatibilityScore: 0
    };
  }
};