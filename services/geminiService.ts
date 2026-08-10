// Temporarily disable to prevent startup crashes
// import { checkMemoryPressure } from '../utils/apiSafeguards';
import { GoogleGenerativeAI } from '@google/generative-ai';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { geminiRateLimiter, getSecureApiKey } from '../config/security';
import { trackAIRequest } from './analyticsService';
import { TopographyData } from './topographyService';
import { isModelExhaustedToday, markModelExhausted } from '../utils/aiQuotaTracker';

/**
 * Robust JSON extractor. Finds the first '{' or '[' and the last '}' or ']'
 * to safely parse JSON wrapped in markdown or conversational text.
 */
export const extractJSON = (text: string): string => {
  if (!text) return '';
  const str = text.trim();
  const firstBrace = str.indexOf('{');
  const firstBracket = str.indexOf('[');

  let startIdx = -1;
  if (firstBrace !== -1 && firstBracket !== -1) {
    startIdx = Math.min(firstBrace, firstBracket);
  } else if (firstBrace !== -1) {
    startIdx = firstBrace;
  } else if (firstBracket !== -1) {
    startIdx = firstBracket;
  }

  if (startIdx === -1) return str.replace(/```json\n?|\n?```/g, '').trim(); // Fallback

  const isObject = str[startIdx] === '{';
  const endChar = isObject ? '}' : ']';
  const endIdx = str.lastIndexOf(endChar);

  if (endIdx !== -1 && endIdx >= startIdx) {
    let jsonStr = str.substring(startIdx, endIdx + 1);
    // Remove trailing commas which break JSON.parse
    jsonStr = jsonStr.replace(/,\s*([}\]])/g, '$1');
    // Sanitize unescaped control characters inside strings using a safer method
    // Replacing ALL literal newlines with spaces fixes "Bad control character in string" 
    // errors without breaking JSON structure!
    jsonStr = jsonStr.replace(/[\r\n]+/g, ' ');
    jsonStr = jsonStr.replace(/\t/g, '  ');
    return jsonStr;
  }

  return str.replace(/```json\n?|\n?```/g, '').replace(/,\s*([}\]])/g, '$1').replace(/[\r\n]+/g, ' ').trim(); // Fallback
};

// --- Dynamic API Key Resolution ---
// Checks AsyncStorage for a user-provided custom key first,
// falls back to the developer's bundled key.
const CUSTOM_KEY_STORAGE_KEY = 'user_gemini_api_key';

let cachedCustomKey: string | null | undefined = undefined; // undefined = not yet checked
let cachedGenAIInstance: GoogleGenerativeAI | null = null;
let lastKeySource: 'custom' | 'default' = 'default';

const getGenAIInstance = async (): Promise<GoogleGenerativeAI> => {
  try {
    // Check AsyncStorage for a user-provided key (cache after first read)
    if (cachedCustomKey === undefined) {
      cachedCustomKey = await AsyncStorage.getItem(CUSTOM_KEY_STORAGE_KEY);
    }

    const trimmedKey = (cachedCustomKey || '').trim();
    if (trimmedKey && trimmedKey.length > 10) {
      // User has a valid custom key
      if (lastKeySource !== 'custom' || !cachedGenAIInstance) {
        console.log('[Gemini] Using user-provided custom API key');
        cachedGenAIInstance = new GoogleGenerativeAI(trimmedKey);
        lastKeySource = 'custom';
      }
      return cachedGenAIInstance;
    }
  } catch (err) {
    console.error('[Gemini] Error reading custom API key, falling back to default:', err);
  }

  // Fallback to developer's bundled key
  if (lastKeySource !== 'default' || !cachedGenAIInstance) {
    const defaultKey = getSecureApiKey();
    cachedGenAIInstance = new GoogleGenerativeAI(defaultKey);
    lastKeySource = 'default';
    console.log('[Gemini] Using default developer API key');
  }
  return cachedGenAIInstance!;
};

/**
 * Call this after the user saves or removes a custom API key
 * to force re-resolution on the next AI request.
 */
export const invalidateApiKeyCache = () => {
  cachedCustomKey = undefined;
  cachedGenAIInstance = null;
  lastKeySource = 'default';
  console.log('[Gemini] API key cache invalidated — will re-resolve on next request');
};

/**
 * Returns which key source is currently active: 'custom' or 'default'.
 */
export const getActiveKeySource = async (): Promise<'custom' | 'default'> => {
  try {
    const customKey = await AsyncStorage.getItem(CUSTOM_KEY_STORAGE_KEY);
    const trimmed = (customKey || '').trim();
    if (trimmed && trimmed.length > 10) {
      return 'custom';
    }
  } catch { }
  return 'default';
};

/**
 * Tests a Gemini API key by making a minimal request.
 * Returns { success: true } or { success: false, error: string }.
 */
export const testApiKey = async (apiKey: string): Promise<{ success: boolean; error?: string }> => {
  try {
    const trimmedKey = (apiKey || '').trim();
    if (!trimmedKey || trimmedKey.length < 15) {
      return { success: false, error: 'API key is too short. Please provide a valid Gemini API key.' };
    }
    const testGenAI = new GoogleGenerativeAI(trimmedKey);
    const testModel = testGenAI.getGenerativeModel({ model: 'gemini-3.5-flash' });
    const result = await testModel.generateContent('Respond with exactly one word: Ready');
    const text = result.response?.text?.();
    if (text) {
      return { success: true };
    }
    return { success: false, error: 'API key connected but returned an empty response.' };
  } catch (error: any) {
    const msg = error.message || 'Unknown error';
    if (msg.includes('API_KEY_INVALID') || msg.includes('400')) {
      return { success: false, error: 'This API key is invalid. Please check and try again.' };
    }
    if (msg.includes('403') || msg.includes('PERMISSION_DENIED')) {
      return { success: false, error: 'This API key does not have permission to access the Gemini API.' };
    }
    if (msg.includes('429') || msg.includes('Quota')) {
      return { success: false, error: 'This API key has exceeded its quota. Try again later or use a different key.' };
    }
    return { success: false, error: `Connection failed: ${msg.slice(0, 500)}` };
  }
};

// --- Dynamic genAI wrapper ---
// Fallback model chain — when a model hits its daily free-tier quota, retry the
// same request with its lighter counterpart (same API key, still multimodal).
// Add entries here as Google rolls out new flash/lite pairs. Verify the lite
// model ID in AI Studio before relying on it.
const FALLBACK_MODEL_MAP: Record<string, string> = {
  'gemini-3.5-flash': 'gemini-3.5-flash-lite',
  'gemini-2.5-flash': 'gemini-2.5-flash-lite',
  'gemini-flash-latest': 'gemini-flash-lite-latest',
};

// Tracks the last model that actually served a request, so a screen/log can show
// "running on flash-lite" when the free-tier fallback kicked in.
let lastServedModel: string | null = null;
let lastServedAt: number | null = null;
export const getLastServedModel = (): { model: string | null; at: number | null } => ({
  model: lastServedModel,
  at: lastServedAt,
});

// Resolves the correct GoogleGenerativeAI instance (custom or default)
// at call-time, not at import-time.
export const genAI = {
  getGenerativeModel: (params: any) => {
    // Return a model-like object whose generateContent resolves the key dynamically
    return {
      generateContent: async (request: any, options?: any) => {
        const instance = await getGenAIInstance();
        const primaryModel = instance.getGenerativeModel(params);
        const primaryName = params?.model || '';

        // Ordered fallback chain for this request: [primary, lite]
        const fallbackName = FALLBACK_MODEL_MAP[primaryName];
        const chainNames = fallbackName ? [primaryName, fallbackName] : [primaryName];
        const attempted: string[] = [];

        for (const modelName of chainNames) {
          // Skip models whose daily quota is already exhausted (efficiency: no wasted retries)
          if (await isModelExhaustedToday(modelName)) {
            console.warn(`[AI] Skipping ${modelName} — daily quota already exhausted`);
            attempted.push(modelName);
            continue;
          }

          const model = modelName === primaryName
            ? primaryModel
            : instance.getGenerativeModel({ ...params, model: modelName });

          // Exponential backoff retry logic (per model)
          // On 503/overloaded: ONE quick retry (1s), then immediately skip to next model.
          // The user experiences6-7 min waits when we retry overloaded servers multiple times.
          let delay = 1000;
          const maxRetries = 2;
          for (let attempt = 1; attempt <= maxRetries; attempt++) {
            try {
              const result = await model.generateContent(request, options);
              lastServedModel = modelName;
              lastServedAt = Date.now();
              if (modelName !== primaryName) {
                console.warn(`[AI] ⚠️ FLASH QUOTA HIT — served by fallback model: ${modelName} (500 RPD, use is free)`);
              } else {
                console.log(`[AI] ✅ Served by model: ${modelName}`);
              }
              return result;
            } catch (error: any) {
              const msg = error.message || String(error);
              const lower = msg.toLowerCase();
              const isQuota = msg.includes('429') || lower.includes('quota') || msg.includes('Too Many Requests') || msg.includes('RESOURCE_EXHAUSTED');
              const isOverloaded = msg.includes('503') || lower.includes('overloaded') || msg.includes('UNAVAILABLE') || msg.includes('500');

              if (isQuota) {
                // Daily quota hit — don't keep hammering this model; mark it and move on
                await markModelExhausted(modelName);
                console.warn(`[AI] ${modelName} daily quota exhausted (${msg}). Marking for today.`);
                break; // next model in chain
              }

              if (isOverloaded) {
                if (attempt < maxRetries) {
                  console.warn(`[AI] ${modelName} overloaded (Attempt ${attempt}/${maxRetries}). Quick retry in ${delay}ms...`);
                  await new Promise(resolve => setTimeout(resolve, delay));
                  delay *= 2;
                  continue;
                }
                // Overloaded after quick retry → skip to next model immediately
                console.warn(`[AI] ${modelName} still overloaded after ${maxRetries} attempts — switching to next model`);
                break;
              }

              throw error;
            }
          }
          attempted.push(modelName);
        }

        throw new Error(`All AI models failed. Tried: ${attempted.join(', ')}`);
      }
    };
  }
};

// Performance optimization: Lazy model getters (re-resolve key on each call)
const getModel = (config: any) => genAI.getGenerativeModel(config);

const models = {
  get fast() {
    return getModel({
      model: 'gemini-3.5-flash',
      generationConfig: {
        temperature: 0.7,
        topK: 40,
        topP: 0.95,
        maxOutputTokens: 2048,
      }
    });
  },
  get balanced() {
    return getModel({
      model: 'gemini-3.5-flash',
      generationConfig: {
        temperature: 0.8,
        topK: 40,
        topP: 0.95,
        maxOutputTokens: 4096,
      }
    });
  },
  get quality() {
    return getModel({
      model: 'gemini-3.5-flash',
      generationConfig: {
        temperature: 0.9,
        topK: 40,
        topP: 0.95,
        maxOutputTokens: 8192,
      }
    });
  }
};

// Performance optimization: Cache for frequently used responses
const responseCache = new Map<string, { data: any; timestamp: number; ttl: number }>();
const CACHE_TTL = 30 * 60 * 1000; // 30 minutes
const MAX_CACHE_SIZE = 100;

// Performance optimization: Request queue for batching
interface QueuedRequest {
  id: string;
  resolve: (value: any) => void;
  reject: (error: any) => void;
  prompt: string;
  model: string;
  priority: number;
}

const requestQueue: QueuedRequest[] = [];
let isProcessingQueue = false;

// Cache management functions
const getCacheKey = (prompt: string, model: string): string => {
  return `${model}:${prompt.slice(0, 100)}:${prompt.length}`;
};

const getFromCache = (key: string): any | null => {
  const cached = responseCache.get(key);
  if (cached && Date.now() - cached.timestamp < cached.ttl) {
    return cached.data;
  }
  if (cached) {
    responseCache.delete(key);
  }
  return null;
};

const setCache = (key: string, data: any, ttl: number = CACHE_TTL): void => {
  if (responseCache.size >= MAX_CACHE_SIZE) {
    const oldestKey = responseCache.keys().next().value;
    if (oldestKey) {
      responseCache.delete(oldestKey);
    }
  }
  responseCache.set(key, { data, timestamp: Date.now(), ttl });
};

// Queue processing for batched requests
const processQueue = async (): Promise<void> => {
  if (isProcessingQueue || requestQueue.length === 0) return;

  isProcessingQueue = true;

  // Sort by priority (higher number = higher priority)
  requestQueue.sort((a, b) => b.priority - a.priority);

  const batch = requestQueue.splice(0, 3); // Process up to 3 requests at once

  await Promise.all(batch.map(async (request) => {
    try {
      const cacheKey = getCacheKey(request.prompt, request.model);
      const cached = getFromCache(cacheKey);

      if (cached) {
        console.log('[AI] 🗄️ Cache hit — served without calling Gemini (saved free-tier quota)');
        request.resolve(cached);
        return;
      }

      const model = models[request.model as keyof typeof models] || models.balanced;
      const result = await model.generateContent(request.prompt);
      const response = result.response.text();

      setCache(cacheKey, response);
      request.resolve(response);
    } catch (error) {
      request.reject(error);
    }
  }));

  isProcessingQueue = false;

  // Continue processing if there are more requests
  if (requestQueue.length > 0) {
    setTimeout(processQueue, 100);
  }
};

// Optimized request function
const queueRequest = (prompt: string, modelType: string = 'balanced', priority: number = 1): Promise<string> => {
  return new Promise((resolve, reject) => {
    const request: QueuedRequest = {
      id: Date.now().toString() + Math.random().toString(36).substr(2, 9),
      resolve,
      reject,
      prompt,
      model: modelType,
      priority
    };

    requestQueue.push(request);
    processQueue();
  });
};

export interface OutfitSuggestion {
  style: string;
  colors: string[];
  outfit: string;
  accessories: string;
  mood: string;
  reasoning: string;
  shoppingLinks?: OutfitLink[];
  /** Per-item link groups (one per outfit piece). Populated by
   *  generateOutfitItemLinks so each NOT-owned piece gets its own shop searches
   *  instead of one combined query that matches nothing. */
  itemLinks?: OutfitItemLinkGroup[];
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
  colorPalette?: string[];
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
  // 1. Validate image content before processing
  const validation = await validateImageContext(imageUri, 'an outfit, a fashion moodboard, or an aesthetic venue');
  if (!validation.isValid) {
    throw new Error(`Invalid Image: ${validation.reasoning}`);
  }

  // Check memory pressure before making API call (temporarily disabled)
  // if (checkMemoryPressure()) {
  //   console.warn('High memory usage detected, using fallback response');
  //   return generateFallbackResponse(prompt, userProfile);
  // }

  // Check rate limit
  if (!geminiRateLimiter.canMakeCall()) {
    const waitTime = Math.ceil(geminiRateLimiter.getTimeUntilNextCall() / 1000);
    console.warn(`Rate limit exceeded, using fallback response`);
    return generateFallbackResponse(prompt, userProfile);
  }

  // Track AI request at the start
  trackAIRequest();

  try {
    // Convert image to base64 (optimized)
    const response = await fetch(imageUri);
    const blob = await response.blob();
    const base64 = await blobToBase64(blob);

    const imagePart = {
      inlineData: {
        data: base64.split(',')[1],
        mimeType: blob.type,
      },
    };

    const safePrompt = sanitizeForPrompt(prompt);
    const userContext = userProfile ? buildUserProfileContext(userProfile) : '';

    // Optimized prompt for faster processing
    const analysisPrompt = `
Analyze image + description: "${safePrompt}"
${userContext ? `User: ${userContext}` : ''}

Return JSON only:
{
  "venue": "venue type",
  "ambiance": "atmosphere",
  "dominantColors": ["color1", "color2", "color3"],
  "recommendations": [
    {
      "style": "style name",
      "colors": ["color1", "color2"],
      "outfit": "specific items (e.g., 'black shirt + beige shorts')",
      "accessories": "accessories",
      "mood": "mood",
      "reasoning": "why this works",
      "shoppingLinks": [
        {
          "platform": "Pinterest",
          "searchQuery": "outfit description",
          "url": "Generate a Pinterest search URL using the specific clothing items from this outfit separated by +, for example: https://www.pinterest.com/search/pins/?q=beige+polo+shirt+white+trousers",
          "description": "Outfit inspiration"
        },
        {
          "platform": "Amazon",
          "searchQuery": "key item",
          "url": "https://www.amazon.com/s?k=<URL_ENCODED_QUERY>",
          "description": "Shop items"
        }
      ]
    }
  ],
  "tips": ["tip1", "tip2", "tip3"]
}

Focus: Extract colors, match user's body type (${userProfile?.bodyType || 'N/A'}), provide 3 style options, practical tips.
`;

    // Use optimized model selection based on complexity
    const modelType = userProfile && Object.keys(userProfile).length > 3 ? 'balanced' : 'fast';

    // Try with image first (high priority)
    try {
      const model = models[modelType];
      const result = await model.generateContent([analysisPrompt, imagePart]);
      const responseText = result.response.text();
      const cleanedResponse = responseText.replace(/```json\n?|\n?```/g, '').trim();

      const parsedResult = JSON.parse(cleanedResponse);
      console.log('✅ Fast image analysis successful');
      return parsedResult;
    } catch (error) {
      console.log('⚠️ Fast model failed, trying balanced model');

      // Fallback to balanced model
      const model = models.balanced;
      const result = await model.generateContent([analysisPrompt, imagePart]);
      const responseText = result.response.text();
      const cleanedResponse = responseText.replace(/```json\n?|\n?```/g, '').trim();

      try {
        const parsedResult = JSON.parse(cleanedResponse);
        console.log('✅ Balanced model analysis successful');
        return parsedResult;
      } catch (parseError) {
        console.log('⚠️ JSON parse failed, using fallback');
        return generateFallbackResponse(prompt, userProfile);
      }
    }

  } catch (error: any) {
    console.error('🚨 Image analysis failed:', error);
    return generateFallbackResponse(prompt, userProfile);
  }
};

export const generateOutfitsFromPrompt = async (prompt: string, userProfile?: any): Promise<StyleAnalysisResult> => {
  // Check rate limit
  if (!geminiRateLimiter.canMakeCall()) {
    const waitTime = Math.ceil(geminiRateLimiter.getTimeUntilNextCall() / 1000);
    throw new Error(`Rate limit exceeded. Please wait ${waitTime} seconds before trying again.`);
  }

  try {
    const safePrompt = sanitizeForPrompt(prompt);
    const userContext = userProfile ? buildUserProfileContext(userProfile) : '';

    // Create cache key for this request
    const cacheKey = getCacheKey(`${safePrompt}${userContext}`, 'prompt');
    const cached = getFromCache(cacheKey);

    if (cached) {
      console.log('✅ Using cached response for prompt');
      return JSON.parse(cached);
    }

    // Optimized prompt for faster processing
    const analysisPrompt = `
Description: "${safePrompt}"
${userContext ? `User: ${userContext}` : ''}

JSON only:
{
  "venue": "venue type",
  "ambiance": "atmosphere", 
  "dominantColors": ["color1", "color2", "color3"],
  "colorPalette": ["#HEX1", "#HEX2", "#HEX3", "#HEX4"],
  "recommendations": [
    {
      "style": "style name",
      "colors": ["color1", "color2"],
      "outfit": "specific items",
      "accessories": "accessories",
      "mood": "mood",
      "reasoning": "why this works",
      "shoppingLinks": [
        {
          "platform": "Pinterest",
          "searchQuery": "outfit description",
          "url": "Generate a Pinterest search URL using the specific clothing items from this outfit separated by +, for example: https://www.pinterest.com/search/pins/?q=beige+polo+shirt+white+trousers",
          "description": "Outfit inspiration"
        },
        {
          "platform": "Amazon", 
          "searchQuery": "key item",
          "url": "https://www.amazon.com/s?k=<URL_ENCODED_QUERY>",
          "description": "Shop items"
        }
      ]
    }
  ],
  "tips": ["tip1", "tip2", "tip3"]
}

Provide 3 outfits for ${userProfile?.bodyType || 'average'} body type, ${userProfile?.gender || 'person'}.
`;

    // Use queued request for better performance - Twinning needs more tokens so use 'balanced'
    const responseText = await queueRequest(analysisPrompt, 'balanced', 2);
    const cleanedResponse = extractJSON(responseText);

    try {
      const result = JSON.parse(cleanedResponse);
      setCache(cacheKey, cleanedResponse, CACHE_TTL);
      console.log('✅ Prompt analysis successful');
      return result;
    } catch (parseError) {
      console.error('⚠️ JSON parse failed, logging raw string:', cleanedResponse);
      console.log('⚠️ retrying with quality model');

      // Fallback to quality model if balanced fails
      const fallbackResponse = await queueRequest(analysisPrompt, 'quality', 1);
      const fallbackCleaned = extractJSON(fallbackResponse);
      try {
        const result = JSON.parse(fallbackCleaned);
        setCache(cacheKey, fallbackCleaned, CACHE_TTL);
        return result;
      } catch (fallbackError) {
        console.log('⚠️ Fallback failed, using generated response');
        return generateFallbackResponse(prompt, userProfile);
      }
    }
  } catch (error) {
    console.error('🚨 Prompt analysis failed:', error);
    return generateFallbackResponse(prompt, userProfile);
  }
};

// Twinning-specific outfit generation with per-person separation
export const generateTwinningOutfits = async (
  twinningPrompt: string,
  person1Name: string,
  person2Name: string
): Promise<any> => {
  if (!geminiRateLimiter.canMakeCall()) {
    throw new Error('Rate limit exceeded. Please wait before trying again.');
  }

  try {
    const safePrompt = sanitizeForPrompt(twinningPrompt);

    const analysisPrompt = `${safePrompt}

  "colorPalette": ["#HEX1", "#HEX2", "#HEX3", "#HEX4", "#HEX5"],Each person gets their OWN separate outfit array with items specific to THEIR gender and body type.
Do NOT combine both people into one outfit string.

{
  "colorPalette": ["#HEX1", "##HEX2", "#HEX3", "#HEX4", "#HEX5"],
  "coordinationTheme": "Overall coordination theme name",
  "person1Outfits": [
    {
      "styleName": "style theme name",
      "items": ["specific item 1 for ${person1Name}", "specific item 2", "specific item 3"],
      "colors": ["color1", "color2"],
      "accessories": ["accessory1", "accessory2"],
      "reasoning": "Why this outfit works specifically for ${person1Name}'s body type and skin tone",
      "mood": "mood description"
    }
  ],
  "person2Outfits": [
    {
      "styleName": "style theme name",
      "items": ["specific item 1 for ${person2Name}", "specific item 2", "specific item 3"],
      "colors": ["color1", "color2"],
      "accessories": ["accessory1", "accessory2"],
      "reasoning": "Why this outfit works specifically for ${person2Name}'s body type and skin tone",
      "mood": "mood description"
    }
  ],
  "coordinationTips": ["tip about how the outfits complement each other"]
}

Provide 2 outfit options per person. Each outfit must be SPECIFIC to that person's gender, body type, and skin tone.
${person1Name}'s items should be completely different from ${person2Name}'s items.
Respond with ONLY the JSON object, no other text.`;

    const model = genAI.getGenerativeModel({
      model: 'gemini-3.5-flash',
      generationConfig: {
        temperature: 0.8,
        topK: 40,
        topP: 0.95,
        maxOutputTokens: 4096,
      }
    });

    const result = await model.generateContent(analysisPrompt);
    const responseText = result.response.text();
    const cleanedResponse = extractJSON(responseText);

    try {
      const parsed = JSON.parse(cleanedResponse);
      console.log('✅ Twinning per-person outfit generation successful');
      return parsed;
    } catch (parseError) {
      console.error('⚠️ Twinning JSON parse failed, trying quality model...');

      // Retry with quality model
      const qualityModel = genAI.getGenerativeModel({
        model: 'gemini-3.5-flash',
        generationConfig: {
          temperature: 0.8,
          topK: 40,
          topP: 0.95,
          maxOutputTokens: 8192,
        }
      });
      const retryResult = await qualityModel.generateContent(analysisPrompt);
      const retryText = retryResult.response.text();
      const retryCleaned = extractJSON(retryText);
      const retryParsed = JSON.parse(retryCleaned);
      console.log('✅ Twinning retry successful');
      return retryParsed;
    }
  } catch (error) {
    console.error('🚨 Twinning outfit generation failed:', error);
    throw error;
  }
};

// Enhanced body analysis with comprehensive body types
export const analyzePersonComprehensively = async (imageUri: string, userName: string = 'User'): Promise<string> => {
  try {
    const response = await fetch(imageUri);
    const blob = await response.blob();
    const base64 = await blobToBase64(blob);

    const imagePart = {
      inlineData: {
        data: base64.split(',')[1],
        mimeType: blob.type,
      },
    };

    // Enhanced body type analysis with more options
    const analysisPrompt = `
Analyze this person's body type and characteristics. Provide detailed analysis:

For MALES, choose from these body types:
- Slim/Ectomorph: Naturally thin, fast metabolism, narrow shoulders
- Average/Mesomorph: Balanced proportions, moderate muscle mass
- Athletic/Muscular: Well-defined muscles, broad shoulders
- Heavy/Endomorph: Larger frame, slower metabolism, rounder shape
- Rectangle/Straight: Shoulders and hips similar width, minimal waist definition
- Triangle/Pear: Hips wider than shoulders, weight in lower body
- Inverted Triangle/V-Shape: Broad shoulders, narrow hips
- Oval/Round: Weight distributed around midsection
- Trapezoid/Broad: Wide shoulders tapering to narrower waist
- Diamond/Rhomboid: Widest at midsection, narrower at shoulders and hips
- Lean Muscular: Defined muscles with low body fat
- Stocky/Compact: Short and sturdy build, dense muscle
- Tall & Lanky: Very tall with thin frame
- Short & Sturdy: Shorter height with solid build

For FEMALES, choose from these body types:
- Slim/Petite: Naturally thin, small frame
- Average/Balanced: Proportional measurements
- Athletic/Toned: Muscular definition, fit appearance
- Curvy/Full: Fuller figure with curves
- Hourglass: Balanced bust and hips, defined waist
- Pear/Bottom Heavy: Hips wider than bust
- Apple/Top Heavy: Bust larger than hips, weight in upper body
- Rectangle/Straight: Similar bust, waist, and hip measurements
- Inverted Triangle: Broad shoulders, narrow hips
- Spoon/Hip Dip: Similar to pear but with hip dips
- Top Hourglass: Larger bust than hips, defined waist
- Bottom Hourglass: Larger hips than bust, defined waist
- Oval/Round: Weight distributed around midsection

Skin tone options: Fair, Wheatish, Dusky, Dark

Format response as:
Gender: [Male/Female]
Body Type: [specific type from above]
Skin Tone: [Fair/Wheatish/Dusky/Dark]
Confidence: [85-95]%
Analysis: [2-3 sentences explaining the assessment and styling recommendations]

Be precise and choose the most accurate body type from the comprehensive list above.
`;

    // Use fast model for body analysis
    const model = models.fast;
    const result = await model.generateContent([analysisPrompt, imagePart]);
    return result.response.text();

  } catch (error) {
    console.error('Body analysis error:', error);
    throw new Error('Unable to analyze body type from image');
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

export const generateOutfitLinks = async (
  outfitDescription: string,
  userPrompt?: string,
  options?: { exactItem?: boolean }
): Promise<OutfitLink[]> => {
  // Build deterministic, specific search links based on the outfit items and the user's prompt
  const core = normalizeOutfitToSearch(outfitDescription);
  const promptPart = sanitizeForPrompt(userPrompt || '');

  // For a single already-specific item (per-item links), the whole description IS
  // the key item — extractKeyItems would collapse "Light Blue Oxford Cotton
  // Button-Down Shirt" down to just "shirt". Only extract key phrases from a
  // full multi-piece outfit string.
  const keyItems = options?.exactItem ? [core] : extractKeyItems(core, 2);

  // For product searches (Amazon/Myntra), use only the key items
  const productQuery = keyItems.join(' ').trim();

  // For inspiration searches (Pinterest/Google Images), use the full outfit description
  // We explicitly avoid the userPrompt here because it's usually a venue or vibe description which confuses Pinterest
  const inspirationQuery = [core].filter(Boolean).join(' ').trim();
  const googleImagesQuery = [core, 'outfit'].filter(Boolean).join(' ').trim();

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

// ---------------------------------------------------------------------------
// Per-item outfit links — mirrors the event-planner's gap-links pattern.
// ---------------------------------------------------------------------------

export interface OutfitItemLinkGroup {
  item: string;   // readable piece, e.g. "Slim Navy Trousers"
  owned: boolean; // true = already in the user's closet (no links needed)
  links: OutfitLink[];
}

// Owned-item markers Gemini appends when it reuses a closet piece, e.g.
// "Cricket Sweater (from closet)". Any item carrying one is already owned.
const OWNED_MARKER_RE =
  /\s*\(?\s*(from\s+(your\s+|my\s+)?(closet|wardrobe)|you\s+already\s+own|already\s+(owned|have)|you\s+(own|have)|owned|have\s+it)\s*\)?\s*$/i;

// Split a Gemini outfit string — e.g. "Cricket Sweater (from closet) + Light
// Blue Oxford Cotton Button-Down Shirt + Slim Navy Trousers" — into individual
// pieces, flagging which ones the user already owns. Gemini separates items
// with " + " (per the prompt's own format example), so that's the primary
// separator; commas are accepted as a fallback.
export const splitOutfitItems = (outfit: string): OutfitItemLinkGroup[] => {
  const parts = (outfit || '')
    .split(/\s*\+\s*|\s*,\s*/)
    .map((part) => part.replace(/\s+/g, ' ').trim())
    .filter(Boolean);

  return parts.map((part) => {
    const owned = OWNED_MARKER_RE.test(part);
    // Drop the owned marker itself so the label stays clean.
    const item = owned ? part.replace(OWNED_MARKER_RE, '').trim() : part;
    return { item, owned, links: [] };
  });
};

// Build a per-item link set for every NOT-owned piece in an outfit. A single
// call across the whole outfit collapses into a nonsense query like
// "sweater shirt" — giving each missing piece its own generateOutfitLinks call
// keeps the store searches specific (same fix as the event planner's gaps).
export const generateOutfitItemLinks = async (
  outfit: string,
  userPrompt?: string
): Promise<OutfitItemLinkGroup[]> => {
  const groups = splitOutfitItems(outfit);
  await Promise.all(
    groups.map(async (group) => {
      if (group.owned || !group.item.trim()) return;
      try {
        // exactItem: the piece is already a single specific item, so don't let
        // extractKeyItems collapse it to a bare token like "shirt".
        group.links = await generateOutfitLinks(group.item, userPrompt, { exactItem: true });
      } catch (e) {
        group.links = [];
      }
    })
  );
  return groups;
};

// Convert an outfit description like "Black shirt + shorts" or
// "Navy blazer with white shirt and dark jeans" into a concise search string
const normalizeOutfitToSearch = (outfitDescription: string): string => {
  const lower = (outfitDescription || '').toLowerCase();
  let replaced = lower
    .replace(/[+/,:()]/g, ' ')
    .replace(/\bwith\b/g, ' ')
    .replace(/\band\b/g, ' ')
    .replace(/\bpaired with\b/g, ' ')
    .replace(/\bcombo\b/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  // Strip closet-context / meta words that leak from AI prompts (e.g. "you already
  // own the navy blazer from your closet"). Without this, closet/venue words pollute
  // the Pinterest + store searches and wreck the results. Word-boundary only, so
  // "own" never matches inside "button-down" or "t-shirt".
  const CLOSET_META_WORDS = [
    'closet', 'wardrobe', 'your', 'my', 'you', 'already', 'own', 'have', 'has',
    'from', 'using', 'use', 'used', 'item', 'items', 'piece', 'pieces', 'user',
    'profile', 'based', 'available', 'empty', 'currently', 'the', 'a', 'an', 'this',
    'these', 'those', 'that', 'also', 'please', 'here', 'there', 'not', 'no',
    'instead', 'only', 'also', 'goes', 'match', 'matches', 'perfect', 'ideal',
  ];
  const stopwordPattern = new RegExp(`\\b(${CLOSET_META_WORDS.join('|')})\\b`, 'g');
  replaced = replaced.replace(stopwordPattern, ' ').replace(/\s+/g, ' ').trim();

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
      searchQuery: searchQuery,
      url: `https://www.pinterest.com/search/pins/?q=${encodeURIComponent(searchQuery)}`,
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
      url: `https://www.myntra.com/${encodeURIComponent(searchQuery)}`,
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
    const model = genAI.getGenerativeModel({ model: 'gemini-3.5-flash' });

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
    const model = genAI.getGenerativeModel({ model: 'gemini-3.5-flash' });

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
    const model = genAI.getGenerativeModel({ model: 'gemini-3.5-flash' });

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
    const model = genAI.getGenerativeModel({ model: 'gemini-3.5-flash' });

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
    const model = genAI.getGenerativeModel({ model: 'gemini-3.5-flash' }); // Use Flash for better reliability

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
    const model = genAI.getGenerativeModel({ model: 'gemini-3.5-flash' });

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
      const model = genAI.getGenerativeModel({ model: 'gemini-3.5-flash' });

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
    const model = genAI.getGenerativeModel({ model: 'gemini-3.5-flash' }); // Using Pro model for better results

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
1. Create ONE perfect outfit specifically for a ${userProfile.gender} — ONLY ${userProfile.gender === 'male' ? 'menswear: shirts, t-shirts, trousers, chinos, jeans, shorts, blazers, jackets, sneakers, loafers, boots' : 'womenswear: dresses, skirts, blouses, tops, jeans, leggings, heels, sandals'}
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
    "Specific ${userProfile.gender === 'male' ? 'menswear' : 'womenswear'} item 1 (e.g., ${userProfile.gender === 'male' ? "'Navy polo shirt', 'White button-down shirt', 'Light blue linen shirt'" : "'Floral summer dress', 'Silk blouse', 'Cotton midi skirt'"})",
    "Specific clothing item 2 (e.g., ${userProfile.gender === 'male' ? "'Khaki chinos', 'Dark slim-fit jeans', 'Beige linen trousers'" : "'High-waist jeans', 'Pleated trousers', 'Denim skirt'"})",
    "Specific clothing item 3 (e.g., ${userProfile.gender === 'male' ? "'Lightweight bomber jacket', 'Cotton blazer', 'Denim jacket'" : "'Cardigan', 'Cropped jacket', 'Trench coat'"})",
    "Footwear recommendation (e.g., ${userProfile.gender === 'male' ? "'White leather sneakers', 'Suede loafers', 'Desert boots'" : "'Block heel sandals', 'White sneakers', 'Ankle boots'"})",
    "Accessories if needed (e.g., ${userProfile.gender === 'male' ? "'Leather watch', 'Sunglasses', 'Belt'" : "'Tote bag', 'Gold earrings', 'Scarf'"})"
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
      "item": "First clothing item name from items array above",
      "platform": "Amazon Fashion",
      "url": "https://www.amazon.com/s?k=<URL_ENCODED: ${userProfile.gender === 'male' ? 'men' : 'women'} + first item name>",
      "description": "Shop this specific item",
      "icon": "bag"
    },
    {
      "item": "Second clothing item name from items array above",
      "platform": "Amazon Fashion",
      "url": "https://www.amazon.com/s?k=<URL_ENCODED: ${userProfile.gender === 'male' ? 'men' : 'women'} + second item name>",
      "description": "Shop this specific item",
      "icon": "bag"
    },
    {
      "item": "Third clothing item name (generate one per item in the items array)",
      "platform": "Amazon Fashion",
      "url": "https://www.amazon.com/s?k=<URL_ENCODED: ${userProfile.gender === 'male' ? 'men' : 'women'} + third item name>",
      "description": "Shop this specific item",
      "icon": "bag"
    },
    {
      "item": "Complete Look Inspiration",
      "platform": "Pinterest",
      "url": "https://www.pinterest.com/search/pins/?q=<URL_ENCODED: all clothing items combined + ${userProfile.gender} outfit>",
      "description": "See the full look on Pinterest",
      "icon": "camera"
    }
  ],
  "daily_quote": "An inspirational quote that matches the outfit mood and weather (e.g., 'Dress like you're already famous' or 'Style is a way to say who you are without having to speak')",
  "mood": "The mood/vibe of this outfit (e.g., 'Confident & Comfortable', 'Chic & Weather-Ready')"
}

IMPORTANT GUIDELINES:
- ABSOLUTELY CRITICAL: This outfit is for a ${userProfile.gender}. Every clothing item MUST be ${userProfile.gender === 'male' ? 'a menswear item (no dresses, skirts, heels, women\'s blouses, women\'s accessories)' : 'a womenswear item'}. For a MALE user, think: polo shirts, button-downs, chinos, jeans, blazers, sneakers, loafers. NEVER generate feminine clothing for a male user.
- Consider temperature fluctuations throughout the day
- Include layering options if temperature varies significantly
- Ensure colors complement ${userProfile.skinTone} skin tone
- Make style tips specific to ${userProfile.bodyType} body type
- Keep the daily quote inspiring and relevant to fashion/confidence
- Make shopping URLs functional and properly encoded
- CRITICAL: Generate ONE Amazon link for EACH clothing item in the items array. Use the SPECIFIC item name (e.g., "men light blue linen shirt", "women black ankle boots"). Do NOT use generic terms like "men clothing rainy weather".
- For Pinterest, combine ALL items into one search URL for the complete look.
- URL encode all search terms properly (spaces become + or %20).

Return ONLY the JSON object, no additional text.
`;

    const result = await model.generateContent(prompt);
    const responseText = result.response.text();

    // Clean the response to ensure it's valid JSON
    const cleanedResponse = responseText.replace(/```json\n?|\n?```/g, '').trim();

    try {
      const parsed = JSON.parse(cleanedResponse);

      // Programmatically override shopping links to guarantee correctness
      const genderTerm = userProfile?.gender === 'male' ? 'men' : 'women';
      const itemsQuery = parsed.items?.join(' ') || '';

      const amazonLinks = (parsed.items || []).map((item: string) => ({
        item: item,
        platform: "Amazon Fashion",
        url: `https://amazon.com/s?k=${encodeURIComponent(`${genderTerm} ${item}`)}&rh=n%3A7141123011`,
        description: `Shop for ${item}`,
        icon: "bag"
      }));

      const pinterestLink = {
        item: "Complete Look Inspiration",
        platform: "Pinterest",
        url: `https://www.pinterest.com/search/pins/?q=${encodeURIComponent(`${itemsQuery} ${genderTerm} outfit`)}`,
        description: "See the full look on Pinterest",
        icon: "camera"
      };

      parsed.shopping_links = [...amazonLinks, pinterestLink];

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
        completeness: 80,
        missingItems: [
          {
            item: isMale ? "Casual blazer" : "Statement accessories",
            reason: "Would elevate the look and add versatility for different occasions",
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
                url: `https://www.myntra.com/${encodeURIComponent(isMale ? 'casual blazer men' : 'accessories women')}`,
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
      },
      {
        name: isMale ? "Weekend Casual" : "Relaxed Style",
        items: ["Casual top from your wardrobe", "Comfortable bottom from your wardrobe"],
        colors: ["Blue", "Beige"],
        occasion: "Weekend outings, casual hangouts",
        completeness: 85,
        missingItems: [
          {
            item: isMale ? "Comfortable sneakers" : "Casual flats",
            reason: "Perfect footwear to complete this relaxed look",
            shoppingLinks: [
              {
                platform: "Amazon",
                searchQuery: isMale ? "men casual sneakers" : "women casual flats",
                url: `https://www.amazon.com/s?k=${encodeURIComponent(isMale ? 'men casual sneakers' : 'women casual flats')}`,
                description: "Shop comfortable footwear"
              }
            ]
          }
        ],
        outfitLinks: [
          {
            platform: "Pinterest",
            searchQuery: isMale ? "weekend casual outfit men" : "relaxed style outfit women",
            url: `https://www.pinterest.com/search/pins/?q=${encodeURIComponent(isMale ? 'weekend casual outfit men' : 'relaxed style outfit women')}`,
            description: "Weekend outfit inspiration"
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
      ...outfit.items.map((item: string) => ({
        item: item,
        platform: "Amazon Fashion",
        url: `https://www.amazon.com/s?k=${encodeURIComponent((isMale ? 'men ' : 'women ') + item)}`,
        description: `Shop ${item}`,
        icon: "bag"
      })),
      {
        item: "Complete Look Inspiration",
        platform: "Pinterest",
        url: `https://www.pinterest.com/search/pins/?q=${encodeURIComponent(outfit.items.join(' ') + ' ' + (isMale ? 'men' : 'women') + ' outfit')}`,
        description: "See the full look on Pinterest",
        icon: "camera"
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
        model = genAI.getGenerativeModel({ model: 'gemini-3.5-flash' });
      } else if (attempt === 2) {
        model = genAI.getGenerativeModel({ model: 'gemini-3.5-flash' });
      } else {
        model = genAI.getGenerativeModel({ model: 'gemini-3.5-flash' });
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
          "searchQuery": "<specific clothing items from outfit>",
          "url": "Generate a Pinterest search URL using the specific clothing items from this outfit separated by +, for example: https://www.pinterest.com/search/pins/?q=beige+polo+shirt+white+trousers",
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

      // 503/overloaded — the genAI wrapper already retries & switches models.
      // No point retrying here; jump to fallback immediately.
      if (error.message?.includes('overloaded') || error.message?.includes('503')) {
        console.warn('[AI] Overloaded — using fallback response immediately');
        return generateTopographyAwareFallbackResponse(prompt, topography, userProfile);
      }

      // Rate limit (429) — retry once with short delay, then fallback
      if (error.message?.includes('429')) {
        console.warn('[AI] Rate limited — retrying once...');
        await new Promise(resolve => setTimeout(resolve, 2000));
        continue;
      }

      // Non-retryable error — break and use fallback
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
        model = genAI.getGenerativeModel({ model: 'gemini-3.5-flash' });
      } else if (attempt === 2) {
        model = genAI.getGenerativeModel({ model: 'gemini-3.5-flash' });
      } else {
        model = genAI.getGenerativeModel({ model: 'gemini-3.5-flash' });
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
          "searchQuery": "<specific clothing items from outfit>",
          "url": "Generate a Pinterest search URL using the specific clothing items from this outfit separated by +, for example: https://www.pinterest.com/search/pins/?q=beige+polo+shirt+white+trousers",
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

      // 503/overloaded — the genAI wrapper already retries & switches models.
      // No point retrying here; jump to fallback immediately.
      if (error.message?.includes('overloaded') || error.message?.includes('503')) {
        console.warn('[AI] Overloaded — using fallback response immediately');
        return generateWeatherAwareFallbackResponse(prompt, weather, userProfile);
      }

      // Rate limit (429) — retry once with short delay, then fallback
      if (error.message?.includes('429')) {
        console.warn('[AI] Rate limited — retrying once...');
        await new Promise(resolve => setTimeout(resolve, 2000));
        continue;
      }

      // Non-retryable error — break and use fallback
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

export const validateImageContext = async (imageUri: string, expectedContext: string): Promise<{ isValid: boolean; confidence: number; reasoning: string; suggestedItems?: string[] }> => {
  // Check rate limit
  if (!geminiRateLimiter.canMakeCall()) {
    const waitTime = Math.ceil(geminiRateLimiter.getTimeUntilNextCall() / 1000);
    throw new Error(`Rate limit exceeded. Please wait ${waitTime} seconds before trying again.`);
  }

  try {
    const model = genAI.getGenerativeModel({ model: 'gemini-3.5-flash' });

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
Analyze this image to determine if it matches the expected context.

EXPECTED CONTEXT: ${expectedContext}

REQUIRED ANALYSIS:
1. Does this image clearly represent the expected context? (Yes/No)
2. What is visible in the image? (List key elements)
3. Confidence level (1-100%)
4. Reasoning for your assessment

FORMAT YOUR RESPONSE EXACTLY AS:
VALID_IMAGE: [Yes/No]
CONFIDENCE: [percentage]%
REASONING: [Brief explanation of why this does or doesn't match the expected context]
ITEMS: [List of key visible items, or "None"]

IMPORTANT GUIDELINES:
- Be strict - if unsure, classify as invalid.
- Reject images of: screenshots of text, completely unrelated objects, or blank screens.
- Focus on whether the image matches the EXPECTED CONTEXT.

Make sure the response is in the exact format specified above, no additional text.
`;

    const result = await model.generateContent([validationPrompt, imagePart]);
    const responseText = result.response.text();

    // Parse the response
    const validMatch = responseText.match(/VALID_IMAGE:\s*(Yes|No)/i);
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
      reasoning: "Unable to validate image due to processing error. Please upload a clear photo matching the required context."
    };
  }
};

export const validateMultipleImagesContext = async (imageUris: string[], expectedContext: string): Promise<{
  validImages: string[];
  invalidImages: Array<{ uri: string; reason: string }>;
  validationResults: Array<{ uri: string; isValid: boolean; confidence: number; reasoning: string }>;
}> => {
  const validationResults = await Promise.all(
    imageUris.map(async (uri) => {
      try {
        const result = await validateImageContext(uri, expectedContext);
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
    const model = genAI.getGenerativeModel({ model: 'gemini-3.5-flash' });

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
2. Create 3-4 stylish outfits using the available items (show outfits even if not 100% complete)
3. For each outfit, suggest what additional items would enhance or complete the look
4. Provide shopping links and styling tips for each outfit
5. Suggest priority items to buy that would unlock more outfit combinations

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
          "item": "brown leather belt",
          "reason": "would add a polished finishing touch and define the waistline",
          "shoppingLinks": [
            {
              "platform": "Amazon",
              "searchQuery": "brown leather belt men",
              "url": "https://www.amazon.com/s?k=brown+leather+belt+men",
              "description": "Shop brown leather belts"
            },
            {
              "platform": "Pinterest",
              "searchQuery": "how to style brown leather belt",
              "url": "https://www.pinterest.com/search/pins/?q=how+to+style+brown+leather+belt",
              "description": "Belt styling inspiration"
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
- Create outfits using available items, even if some pieces are missing
- Always show outfit suggestions with Pinterest inspiration and Amazon shopping links
- Be specific about colors and styles you observe in the images
- In missingItems, suggest 1-2 key pieces that would enhance each outfit (not mandatory items)
- Make missing items helpful suggestions, not strict requirements
- Consider the user's location and cultural context if provided
- Generate proper shopping URLs for all suggested items
- Focus on versatile pieces that unlock multiple outfit combinations
- Set completeness to 70-90% even for good outfits with minor missing pieces

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
    const model = genAI.getGenerativeModel({ model: 'gemini-3.5-flash' });

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
- Focus ONLY on major clothing categories: tops, bottoms, dresses, jackets
- IGNORE accessories like belts, socks, jewelry, bags when determining if outfits can be formed
- Only mark as "No" if missing essential items like shirts, pants, or dresses
- If user has basic tops and bottoms, answer "Yes" even if accessories are missing
- Consider the user's body type and proportions
- Be lenient - prioritize showing outfits over being restrictive

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

    // Return a lenient result on error - assume they can form outfits
    return {
      canFormOutfits: true,
      outfitTypes: ['casual', 'smart casual'],
      missingCategories: [],
      recommendations: [
        "Upload clear photos for better analysis",
        "Mix and match your current items"
      ],
      compatibilityScore: 70
    };
  }
};

export interface StyleComponent {
  category: 'top' | 'bottom' | 'outerwear' | 'shoes' | 'accessory';
  description: string;
  matchStatus: 'exact' | 'similar' | 'missing';
  matchedItemId?: string;
  searchQuery?: string;
}

export const analyzeStyleInspiration = async (
  imageUri: string,
  wardrobeItems: any[],
  userProfile: any
): Promise<StyleComponent[]> => {
  try {
    const canCall = geminiRateLimiter.canMakeCall();
    if (!canCall) {
      throw new Error('Rate limit exceeded. Please wait a moment.');
    }

    const genAI = await getGenAIInstance();
    const model = genAI.getGenerativeModel({ model: 'gemini-3.5-flash' });

    let imagePart;
    if (imageUri.startsWith('data:')) {
      const mimeType = imageUri.split(';')[0].split(':')[1];
      const base64Data = imageUri.split(',')[1];
      imagePart = {
        inlineData: { data: base64Data, mimeType }
      };
    } else {
      const fileExt = imageUri.split('.').pop()?.toLowerCase();
      let mimeType = 'image/jpeg';
      if (fileExt === 'png') mimeType = 'image/png';
      else if (fileExt === 'webp') mimeType = 'image/webp';

      const response = await fetch(imageUri);
      const blob = await response.blob();
      const base64Data = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve((reader.result as string).split(',')[1]);
        reader.onerror = reject;
        reader.readAsDataURL(blob);
      });

      imagePart = {
        inlineData: { data: base64Data, mimeType }
      };
    }

    const wardrobeJson = JSON.stringify(wardrobeItems.map(item => ({
      id: item.id,
      name: item.name,
      type: item.type,
      colors: item.colors,
      pattern: item.pattern,
      fabric: item.fabric
    })));

    const prompt = `You are an elite fashion AI ("Aria"). I am providing you with an inspiration photo of an outfit.
Your goal is to break down this outfit into its core components and see if I can recreate this exact look using ONLY the clothes in my digital closet.

My current wardrobe items:
${wardrobeJson}

My profile:
Gender: ${userProfile?.gender || 'unspecified'}

Instructions:
1. Identify each distinct clothing component in the photo (top, bottom, outerwear, shoes, accessory).
2. For each component, search my wardrobe for the closest match.
3. If a match is extremely close, set matchStatus to "exact" and provide the matchedItemId.
4. If a match is passable but not perfect (e.g. they have grey jeans instead of white trousers), set matchStatus to "similar" and provide the matchedItemId.
5. If I do NOT own anything close to it, set matchStatus to "missing". DO NOT provide a matchedItemId. Instead, generate a highly detailed, SEO-friendly \`searchQuery\` that I can plug straight into Google Shopping, Amazon, or Myntra to buy the exact item (e.g., "men's relaxed fit beige linen trousers").

Respond ONLY with a valid JSON array of objects, with no markdown formatting. Each object must have:
{
  "category": "top" | "bottom" | "outerwear" | "shoes" | "accessory",
  "description": "Detailed description of the item in the photo",
  "matchStatus": "exact" | "similar" | "missing",
  "matchedItemId": "id from wardrobe (if exact or similar)",
  "searchQuery": "detailed search string to buy it (if missing)"
}`;

    const result = await model.generateContent([prompt, imagePart]);
    const responseText = result.response.text();
    const cleaned = responseText.replace(/```json\n?|\n?```/g, '').trim();

    return JSON.parse(cleaned) as StyleComponent[];

  } catch (error) {
    console.error('Style Inspiration error:', error);
    throw error;
  }
};
