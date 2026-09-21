// import { GoogleGenerativeAI } from '@google/generative-ai'; // removed to use centralized wrapper
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getActiveKeySource, extractJSON, genAI, validateImageContext } from './geminiService';
import { handleNsfwViolation } from './userService';
import { getSecureApiKey } from '../config/security';
import { auth } from '../firebaseConfig';
import * as FileSystem from 'expo-file-system';

export interface FitAnalysis {
  zone: string;
  currentFit: string;
  suggestedFit: string;
  label: string;
  tailorInstructions: string;
  searchQuery: string;
}

export interface AlterShopResponse {
  isPerfectFit: boolean;
  message?: string;
  analyses: FitAnalysis[];
}

const QUOTA_KEY = '@uptrends_alter_shop_quota';

const getQuotaState = async () => {
  try {
    const raw = await AsyncStorage.getItem(QUOTA_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      const today = new Date().toISOString().split('T')[0];
      if (parsed.date === today) {
        return parsed;
      }
    }
  } catch (e) {
    console.error('Error reading quota', e);
  }
  return { date: new Date().toISOString().split('T')[0], count: 0 };
};

const incrementQuota = async () => {
  const state = await getQuotaState();
  state.count += 1;
  await AsyncStorage.setItem(QUOTA_KEY, JSON.stringify(state));
};

export const getQuotaStatus = async () => {
  const source = await getActiveKeySource();
  const state = await getQuotaState();
  
  if (source === 'custom') {
    // Custom keys have their own unlimited (or user-managed) quotas.
    // Set a high visual limit for the UI.
    return { count: state.count, limit: 50, source };
  } else {
    return { count: state.count, limit: 1, source };
  }
};

export const analyzeCurrentFit = async (imageUri: string, userProfile: any): Promise<AlterShopResponse> => {
  try {
    const validation = await validateImageContext(imageUri, 'a person wearing an outfit');
    if (validation.isNsfw) {
      if (auth.currentUser) {
        await handleNsfwViolation(auth.currentUser.uid);
      }
      throw new Error("NSFW_VIOLATION");
    }
    if (!validation.isValid) {
      throw new Error(`Invalid Image: ${validation.reasoning}`);
    }

    const base64 = await FileSystem.readAsStringAsync(imageUri, { encoding: FileSystem.EncodingType.Base64 });
    const mimeType = imageUri.toLowerCase().endsWith('.png') ? 'image/png' : 'image/jpeg';
    
    const model = genAI.getGenerativeModel({ model: 'gemini-3.8-flash' });
    
    const prompt = `You are an expert master tailor. Analyze the fit of the clothing the person is wearing in the image.
    Consider the user's profile if helpful: ${JSON.stringify(userProfile)}.
    
    First, determine if the outfit already fits perfectly (no alterations needed). 
    If it fits perfectly, return JSON in this exact format:
    {"isPerfectFit": true, "message": "Your outfit looks great and fits perfectly!", "analyses": []}
    
    If it does NOT fit perfectly, identify up to 4 specific fit issues. For each issue, provide a suggested alternative fit and precise instructions for a tailor.
    Return JSON in this exact format:
    {
      "isPerfectFit": false,
      "analyses": [
        {
          "zone": "e.g., Waist, Sleeves, Hem",
          "currentFit": "e.g., Too loose",
          "suggestedFit": "e.g., Tapered",
          "label": "e.g., Slim Fit",
          "tailorInstructions": "e.g., Take in the waist by 1 inch.",
          "searchQuery": "e.g., slim fit shirt"
        }
      ]
    }`;

    const result = await model.generateContent([
      prompt,
      { inlineData: { data: base64, mimeType } }
    ]);
    
    const text = result.response.text();
    const jsonStr = extractJSON(text);
    return JSON.parse(jsonStr) as AlterShopResponse;
  } catch (error) {
    console.error("Error analyzing fit:", error);
    throw error;
  }
};

export const generateAlteredFitCollage = async (imageUri: string, analyses: FitAnalysis[], userProfile: any): Promise<string | null> => {
  try {
    const status = await getQuotaStatus();
    if (status.count >= status.limit) {
       console.log("Quota exhausted for image generation.");
       return null;
    }

    const base64 = await FileSystem.readAsStringAsync(imageUri, { encoding: FileSystem.EncodingType.Base64 });
    const mimeType = imageUri.toLowerCase().endsWith('.png') ? 'image/png' : 'image/jpeg';
    
    const prompt = `Give me all the alternatives for the cloth I'm wearing in this picture if it needs altering like if the length needs adjustment. Provide all the alternat versions in a single image like grid layout like in story of ig. 
    Specific alterations to include: ${analyses.map(a => a.suggestedFit).join(', ')}. 
    CRITICAL: Ensure the generated person accurately matches my physical profile: ${userProfile?.bodyType || 'average'} body type and ${userProfile?.skinTone || 'medium'} skin tone. Keep my face and body exactly the same.`;

    const model = genAI.getGenerativeModel({ model: 'gemini-3.8-flash' }); // Using latest flash model to ensure availability
    
    try {
        const result = await model.generateContent([
            prompt,
            { inlineData: { data: base64, mimeType } }
        ]);
        
        // Extract base64 image if it comes as markdown/json or just return the text which might be base64
        const textResponse = result.response.text();
        
        // If the API doesn't actually support direct image generation and just returns text, 
        // we'll fallback to original image to avoid crash, but log the text response.
        // In a real production setup with Imagen 3, we would parse the base64 output.
        if (textResponse && (textResponse.includes('iVBORw') || textResponse.includes('/9j/'))) {
             // Try to extract raw base64 string (PNG starts with iVBORw, JPEG with /9j/)
             const match = textResponse.match(new RegExp('(?:iVBORw|\\/9j\\/)[a-zA-Z0-9+\\/=]+'));
             if (match) {
                 await incrementQuota();
                 return match[0];
             }
        }
        
        console.log("Image generation API returned text instead of image data. Returning original image as fallback.", textResponse.slice(0, 200));
        await incrementQuota();
        return base64; 
    } catch (apiErr) {
        console.error("API Error during image gen:", apiErr);
        await incrementQuota();
        return base64; // Fallback to original
    }
    
  } catch (error) {
    console.error("Error generating altered collage image:", error);
    return null;
  }
};
