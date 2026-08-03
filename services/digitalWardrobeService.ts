// services/digitalWardrobeService.ts
// AI Digital Wardrobe — "My Closet" feature
// Stores clothing items with AI-powered metadata, generates outfits from real wardrobe

import AsyncStorage from '@react-native-async-storage/async-storage';
import { addDoc, collection, deleteDoc, doc, getDocs, orderBy, query, updateDoc, where } from 'firebase/firestore';
import { auth, db, isFirebaseInitialized, storage } from '../firebaseConfig';
import { getDownloadURL, ref, uploadBytes } from 'firebase/storage';
import * as FileSystem from 'expo-file-system';
import * as ImageManipulator from 'expo-image-manipulator';
import { genAI, validateImageContext } from './geminiService';
import { geminiRateLimiter } from '../config/security';

// ─── FileSystem Helpers ───────────────────────────────────────────────────────
const WARDROBE_DIR = `${FileSystem.documentDirectory}wardrobes/`;

const ensureDirExists = async (dirUri: string) => {
  try {
    const dirInfo = await FileSystem.getInfoAsync(dirUri);
    if (!dirInfo.exists) {
      await FileSystem.makeDirectoryAsync(dirUri, { intermediates: true });
    }
  } catch (error) {
    console.error('Failed to create directory:', dirUri, error);
  }
};

// ─── Firestore Helpers ────────────────────────────────────────────────────────
const cleanForFirestore = (obj: any): any => {
  const copy = { ...obj };
  Object.keys(copy).forEach(key => {
    if (copy[key] === undefined) {
      delete copy[key];
    } else if (copy[key] !== null && typeof copy[key] === 'object' && !(copy[key] instanceof Date)) {
      copy[key] = cleanForFirestore(copy[key]);
    }
  });
  return copy;
};

// ─── Types ────────────────────────────────────────────────────────────────────

export interface WardrobeItem {
  id: string;
  userId: string;
  imageUri: string;        // Local URI or Firebase Storage URL
  imageBase64?: string;     // Compressed base64 for offline use
  
  // AI-detected metadata
  type: ClothingType;
  subType: string;          // e.g., "polo shirt", "skinny jeans", "running shoes"
  colors: string[];         // ["Navy Blue", "White"]
  primaryColor: string;     // Dominant color
  pattern: string;          // "solid", "striped", "plaid", "floral", "graphic"
  fabric: string;           // "cotton", "denim", "silk", "polyester"
  brand?: string;           // If visible/detected
  
  // Style metadata
  formality: FormalityLevel;
  seasons: Season[];        // ["summer", "spring"]
  occasions: string[];      // ["casual", "office", "party"]
  condition: string;        // "excellent", "good", "fair", "worn"
  
  // User data
  name: string;             // User-editable name
  notes?: string;
  favorite: boolean;
  timesWorn: number;
  lastWorn?: Date;
  dateAdded: Date;
  purchasePrice?: number;
  
  // AI styling data
  pairsWellWith: string[];  // Types this pairs well with
  avoidWith: string[];      // Types to avoid pairing with
  stylePersonality: string; // "minimalist", "bold", "classic", "trendy"
}

export type ClothingType = 
  | 'top' | 'bottom' | 'outerwear' | 'footwear' 
  | 'accessory' | 'dress' | 'activewear' | 'innerwear'
  | 'ethnic' | 'formal_set';

export type FormalityLevel = 'very_casual' | 'casual' | 'smart_casual' | 'semi_formal' | 'formal' | 'black_tie';

export type Season = 'summer' | 'monsoon' | 'winter' | 'spring' | 'autumn' | 'all_season';

export interface WardrobeOutfitCombo {
  id: string;
  name: string;
  items: WardrobeItem[];
  occasion: string;
  rating: number;           // 1-100 how well these go together
  reasoning: string;
  stylingTips: string[];
  colorHarmony: string;     // "complementary", "analogous", "monochromatic"
  weatherSuitability: string;
}

export interface WardrobeStats {
  totalItems: number;
  byType: Record<string, number>;
  colorDistribution: { color: string; count: number; percentage: number }[];
  formalitySpread: Record<string, number>;
  seasonReadiness: { season: string; score: number; missing: string[] }[];
  versatilityScore: number;  // 0-100
  wardrobeScore: number;     // 0-100 overall
  gapAnalysis: string[];     // "You're missing a versatile navy blazer"
  duplicates: string[];      // "You have 4 similar white t-shirts"
  costPerWear: { itemName: string; cost: number; wears: number; cpw: number }[];
}

// ─── Constants ────────────────────────────────────────────────────────────────

const WARDROBE_COLLECTION = 'wardrobes';
const LOCAL_WARDROBE_KEY = '@uptrends_wardrobe';
const MAX_IMAGE_SIZE = 200 * 1024; // 200KB compressed

// ─── Image Helpers ────────────────────────────────────────────────────────────

const blobToBase64 = (blob: Blob): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
};

const compressAndConvertImage = async (imageUri: string): Promise<{ base64: string; mimeType: string }> => {
  try {
    const response = await fetch(imageUri);
    const blob = await response.blob();
    const base64Full = await blobToBase64(blob);
    
    return {
      base64: base64Full.split(',')[1] || base64Full,
      mimeType: blob.type || 'image/jpeg',
    };
  } catch (error) {
    console.error('Image conversion error:', error);
    throw new Error('Failed to process image');
  }
};

// ─── Gemini AI Clothing Analyzer ──────────────────────────────────────────────

export const analyzeClothingItem = async (
  imageUri: string,
  gender: string = 'male'
): Promise<Omit<WardrobeItem, 'id' | 'userId' | 'imageUri' | 'imageBase64' | 'favorite' | 'timesWorn' | 'dateAdded' | 'lastWorn' | 'notes' | 'purchasePrice'>> => {
  
  if (!geminiRateLimiter.canMakeCall()) {
    throw new Error('Rate limit reached. Please wait a moment.');
  }

  try {
    // 1. Validate image content before processing
    const validation = await validateImageContext(imageUri, 'a single clothing item or accessory');
    if (!validation.isValid) {
      throw new Error(`Invalid Image: ${validation.reasoning}`);
    }

    const { base64, mimeType } = await compressAndConvertImage(imageUri);
    
    const model = genAI.getGenerativeModel({ model: 'gemini-3.5-flash' });

    const prompt = `You are a professional fashion analyst. Analyze this clothing item photo with extreme detail.

USER GENDER: ${gender}

Identify and return a JSON object with these EXACT fields:

{
  "type": "top|bottom|outerwear|footwear|accessory|dress|activewear|innerwear|ethnic|formal_set",
  "subType": "specific item name (e.g., 'polo shirt', 'cargo pants', 'chelsea boots', 'kurta')",
  "colors": ["Color1", "Color2"],
  "primaryColor": "dominant color name",
  "pattern": "solid|striped|plaid|checkered|floral|graphic|abstract|camo|polka_dot|paisley|animal_print",
  "fabric": "cotton|denim|silk|polyester|linen|wool|leather|suede|satin|chiffon|knit|fleece|nylon|velvet|corduroy",
  "brand": "brand name if visible, otherwise null",
  "formality": "very_casual|casual|smart_casual|semi_formal|formal|black_tie",
  "seasons": ["summer", "winter", "spring", "autumn", "monsoon", "all_season"],
  "occasions": ["casual", "office", "party", "date_night", "wedding", "gym", "travel", "beach", "festival"],
  "condition": "excellent|good|fair|worn",
  "name": "A short, catchy name for this item (e.g., 'Classic Navy Polo', 'Distressed Black Jeans')",
  "pairsWellWith": ["types and colors that would pair well"],
  "avoidWith": ["types and colors to avoid pairing with"],
  "stylePersonality": "minimalist|bold|classic|trendy|bohemian|sporty|elegant|streetwear|preppy|grunge"
}

RULES:
- Be specific with colors (use "Navy Blue" not just "Blue", "Mustard Yellow" not just "Yellow")
- For Indian ethnic wear, use type "ethnic" (kurta, saree, sherwani, lehenga, etc.)
- Seasons should consider Indian climate (include "monsoon" where appropriate)
- Only return valid JSON, no extra text
- The name should be fashionable and specific`;

    const result = await model.generateContent([
      prompt,
      {
        inlineData: {
          data: base64,
          mimeType: mimeType,
        },
      },
    ]);

    const responseText = result.response.text();
    const cleaned = responseText.replace(/```json\n?|\n?```/g, '').trim();
    
    try {
      const parsed = JSON.parse(cleaned);
      return {
        type: parsed.type || 'top',
        subType: parsed.subType || 'Unknown Item',
        colors: parsed.colors || ['Unknown'],
        primaryColor: parsed.primaryColor || parsed.colors?.[0] || 'Unknown',
        pattern: parsed.pattern || 'solid',
        fabric: parsed.fabric || 'cotton',
        brand: parsed.brand || undefined,
        formality: parsed.formality || 'casual',
        seasons: parsed.seasons || ['all_season'],
        occasions: parsed.occasions || ['casual'],
        condition: parsed.condition || 'good',
        name: parsed.name || 'Clothing Item',
        pairsWellWith: parsed.pairsWellWith || [],
        avoidWith: parsed.avoidWith || [],
        stylePersonality: parsed.stylePersonality || 'classic',
      };
    } catch (parseError) {
      console.error('Failed to parse AI response:', parseError);
      return getDefaultClothingMetadata();
    }
  } catch (error) {
    console.error('Clothing analysis error:', error);
    throw error;
  }
};

const getDefaultClothingMetadata = () => ({
  type: 'top' as ClothingType,
  subType: 'Clothing Item',
  colors: ['Unknown'],
  primaryColor: 'Unknown',
  pattern: 'solid',
  fabric: 'cotton',
  formality: 'casual' as FormalityLevel,
  seasons: ['all_season' as Season],
  occasions: ['casual'],
  condition: 'good',
  name: 'New Item',
  pairsWellWith: [],
  avoidWith: [],
  stylePersonality: 'classic',
});

// ─── CRUD Operations ──────────────────────────────────────────────────────────

export const addWardrobeItem = async (
  imageUri: string,
  gender: string = 'male'
): Promise<WardrobeItem> => {
  const user = auth?.currentUser;
  if (!user) throw new Error('Not authenticated');

  // Step 1: AI analyze the clothing item
  const metadata = await analyzeClothingItem(imageUri, gender);

  // Generate ID beforehand to use for naming local files
  let itemId = `local_${Date.now()}`;
  if (isFirebaseInitialized && db) {
    try {
      // Create a reference to obtain a unique Firestore auto-id
      const dummyRef = doc(collection(db, WARDROBE_COLLECTION));
      itemId = dummyRef.id;
    } catch (e) {
      console.warn('Failed to pre-generate Firestore ID:', e);
    }
  }

  // Step 2: Persist image locally to phone's document directory (prevents OS cleaning temp files)
  let localImageUri = imageUri;
  try {
    const userDir = `${WARDROBE_DIR}${user.uid}/`;
    await ensureDirExists(userDir);
    localImageUri = `${userDir}${itemId}.jpg`;
    await FileSystem.copyAsync({ from: imageUri, to: localImageUri });
  } catch (fsError) {
    console.warn('Failed to save image locally to FileSystem:', fsError);
  }

  // Step 3: Upload image to Firebase Storage (compressed) if storage is online
  let storedImageUri = localImageUri;

  if (isFirebaseInitialized && storage) {
    try {
      // Compress image before upload (max width 800px, 70% quality)
      const compressedImage = await ImageManipulator.manipulateAsync(
        localImageUri,
        [{ resize: { width: 800 } }],
        { compress: 0.7, format: ImageManipulator.SaveFormat.JPEG }
      );

      const response = await fetch(compressedImage.uri);
      const blob = await response.blob();
      const imagePath = `wardrobes/${user.uid}/${itemId}.jpg`;
      const imageRef = ref(storage, imagePath);
      await uploadBytes(imageRef, blob);
      storedImageUri = await getDownloadURL(imageRef);
    } catch (uploadError) {
      console.warn('Firebase upload failed, using local filesystem fallback:', uploadError);
    }
  }

  // Step 4: Create the wardrobe item object
  const newItem: Omit<WardrobeItem, 'id'> = {
    userId: user.uid,
    imageUri: storedImageUri,
    ...metadata,
    favorite: false,
    timesWorn: 0,
    dateAdded: new Date(),
  };

  // Step 5: Save to Firestore
  if (isFirebaseInitialized && db && !itemId.startsWith('local_')) {
    try {
      const firestoreData = cleanForFirestore({
        ...newItem,
        dateAdded: new Date(),
      });

      await updateDoc(doc(db, WARDROBE_COLLECTION, itemId), firestoreData);
    } catch (firestoreError: any) {
      // If document doesn't exist yet (since we pre-generated id but didn't create doc),
      // we should use setDoc or addDoc. Let's use setDoc so we can specify the custom ID.
      try {
        const { setDoc } = require('firebase/firestore');
        const firestoreData = cleanForFirestore({
          ...newItem,
          dateAdded: new Date(),
        });
        await setDoc(doc(db, WARDROBE_COLLECTION, itemId), firestoreData);
        console.log(`✅ Successfully uploaded item ${itemId} to Firestore!`);
      } catch (innerError: any) {
        console.warn('Firestore setDoc failed, storing locally:', innerError.message || innerError);
      }
    }
  }

  const savedItem: WardrobeItem = { id: itemId, ...newItem };

  // Step 6: Also save to local storage as backup (without base64 since it points to local uri file)
  await saveToLocalStorage(savedItem);

  console.log(`🎉 Wardrobe item ${itemId} successfully added to your closet!`);
  return savedItem;
};

export const getWardrobe = async (): Promise<WardrobeItem[]> => {
  const user = auth?.currentUser;
  if (!user) return [];

  // Try Firestore first
  if (isFirebaseInitialized && db) {
    try {
      const q = query(
        collection(db, WARDROBE_COLLECTION),
        where('userId', '==', user.uid),
        orderBy('dateAdded', 'desc')
      );
      const snapshot = await getDocs(q);
      const items = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        dateAdded: doc.data().dateAdded?.toDate?.() || new Date(doc.data().dateAdded),
        lastWorn: doc.data().lastWorn?.toDate?.() || undefined,
      })) as WardrobeItem[];
      
      if (items.length > 0) {
        // Sync to local storage
        await AsyncStorage.setItem(
          `${LOCAL_WARDROBE_KEY}_${user.uid}`,
          JSON.stringify(items)
        );
        return items;
      }
    } catch (error) {
      console.warn('Firestore read failed, using local storage:', error);
    }
  }

  // Fallback to local storage
  return getFromLocalStorage(user.uid);
};

export const updateWardrobeItem = async (
  itemId: string,
  updates: Partial<WardrobeItem>
): Promise<void> => {
  // Update Firestore
  if (isFirebaseInitialized && db && !itemId.startsWith('local_')) {
    try {
      const itemRef = doc(db, WARDROBE_COLLECTION, itemId);
      const firestoreUpdates = cleanForFirestore({ ...updates });
      delete firestoreUpdates.imageBase64;
      await updateDoc(itemRef, { ...firestoreUpdates, updatedAt: new Date() });
    } catch (error) {
      console.warn('Firestore update failed:', error);
    }
  }

  // Update local storage
  const user = auth?.currentUser;
  if (user) {
    const items = await getFromLocalStorage(user.uid);
    const index = items.findIndex(i => i.id === itemId);
    if (index >= 0) {
      items[index] = { ...items[index], ...updates };
      await AsyncStorage.setItem(
        `${LOCAL_WARDROBE_KEY}_${user.uid}`,
        JSON.stringify(items)
      );
    }
  }
};

export const deleteWardrobeItem = async (itemId: string): Promise<void> => {
  // Delete from Firestore
  if (isFirebaseInitialized && db && !itemId.startsWith('local_')) {
    try {
      await deleteDoc(doc(db, WARDROBE_COLLECTION, itemId));
    } catch (error) {
      console.warn('Firestore delete failed:', error);
    }
  }

  // Delete from local storage & filesystem
  const user = auth?.currentUser;
  if (user) {
    try {
      const localFileUri = `${WARDROBE_DIR}${user.uid}/${itemId}.jpg`;
      const fileInfo = await FileSystem.getInfoAsync(localFileUri);
      if (fileInfo.exists) {
        await FileSystem.deleteAsync(localFileUri, { idempotent: true });
      }
    } catch (fsError) {
      console.warn('Failed to delete local file:', fsError);
    }

    const items = await getFromLocalStorage(user.uid);
    const filtered = items.filter(i => i.id !== itemId);
    await AsyncStorage.setItem(
      `${LOCAL_WARDROBE_KEY}_${user.uid}`,
      JSON.stringify(filtered)
    );
  }
};

export const markAsWorn = async (itemId: string): Promise<void> => {
  const user = auth?.currentUser;
  if (!user) return;

  const items = await getWardrobe();
  const item = items.find(i => i.id === itemId);
  if (!item) return;

  await updateWardrobeItem(itemId, {
    timesWorn: (item.timesWorn || 0) + 1,
    lastWorn: new Date(),
  });
};

export const toggleFavorite = async (itemId: string): Promise<boolean> => {
  const items = await getWardrobe();
  const item = items.find(i => i.id === itemId);
  if (!item) return false;

  const newFavorite = !item.favorite;
  await updateWardrobeItem(itemId, { favorite: newFavorite });
  return newFavorite;
};

// ─── Local Storage Helpers ────────────────────────────────────────────────────

const migrateLegacyBase64Items = async (items: WardrobeItem[], userId: string): Promise<WardrobeItem[]> => {
  let migrated = false;
  const migratedItems = await Promise.all(items.map(async item => {
    if (item.imageBase64) {
      try {
        const userDir = `${WARDROBE_DIR}${userId}/`;
        await ensureDirExists(userDir);
        const localFileUri = `${userDir}${item.id}.jpg`;
        
        // Write base64 string to file
        await FileSystem.writeAsStringAsync(localFileUri, item.imageBase64, {
          encoding: FileSystem.EncodingType.Base64,
        });
        
        const updatedItem = { ...item };
        updatedItem.imageUri = localFileUri;
        delete updatedItem.imageBase64;
        migrated = true;
        return updatedItem;
      } catch (error) {
        console.error('Migration failed for item:', item.id, error);
      }
    }
    return item;
  }));

  if (migrated) {
    try {
      console.log('Migrated legacy base64 wardrobe items to local file system.');
      // Save updated items back to local storage
      await AsyncStorage.setItem(
        `${LOCAL_WARDROBE_KEY}_${userId}`,
        JSON.stringify(migratedItems)
      );
    } catch (saveError) {
      console.error('Failed to save migrated wardrobe items:', saveError);
    }
  }
  return migratedItems;
};

const saveToLocalStorage = async (item: WardrobeItem): Promise<void> => {
  try {
    const items = await getFromLocalStorage(item.userId);
    items.unshift(item);
    await AsyncStorage.setItem(
      `${LOCAL_WARDROBE_KEY}_${item.userId}`,
      JSON.stringify(items)
    );
  } catch (error) {
    console.error('Local storage save failed:', error);
  }
};

const getFromLocalStorage = async (userId: string): Promise<WardrobeItem[]> => {
  try {
    const stored = await AsyncStorage.getItem(`${LOCAL_WARDROBE_KEY}_${userId}`);
    if (stored) {
      const items = JSON.parse(stored);
      return migrateLegacyBase64Items(items, userId);
    }
  } catch (error) {
    console.error('Local storage read failed:', error);
  }
  return [];
};

// ─── AI Outfit Generation from Wardrobe ───────────────────────────────────────

export const generateOutfitsFromWardrobe = async (
  items: WardrobeItem[],
  occasion?: string,
  weather?: string,
  userProfile?: any
): Promise<WardrobeOutfitCombo[]> => {
  if (items.length < 2) {
    throw new Error('Add at least 2 items to your wardrobe to generate outfits');
  }

  if (!geminiRateLimiter.canMakeCall()) {
    throw new Error('Rate limit reached. Please wait a moment.');
  }

  try {
    const model = genAI.getGenerativeModel({ model: 'gemini-3.5-flash' });

    // Build wardrobe summary for the prompt
    const wardrobeSummary = items.map((item, i) => 
      `[${i + 1}] ${item.name} — Type: ${item.type}/${item.subType}, Colors: ${item.colors.join(', ')}, Pattern: ${item.pattern}, Fabric: ${item.fabric}, Formality: ${item.formality}, Seasons: ${item.seasons.join(', ')}`
    ).join('\n');

    const gender = userProfile?.gender || 'male';
    const bodyType = userProfile?.bodyType || 'average';
    const skinTone = userProfile?.skinTone || 'fair';

    const prompt = `You are a world-class fashion stylist. Create outfit combinations from this person's ACTUAL wardrobe items.

WARDROBE INVENTORY:
${wardrobeSummary}

USER PROFILE & STYLING CONTEXT:
- Gender: ${gender}
- Body Type: ${bodyType}
- Skin Tone: ${skinTone}
${occasion ? `- Style Vibe / Occasion / Activity Request: "${occasion}"` : ''}
${weather ? `- Weather Context: "${weather}"` : ''}

Create 3-5 outfit combinations using ONLY items from the wardrobe inventory above. Each combo should reference items by their inventory list number.
Make sure the recommendations strictly adhere to the Style Vibe / Occasion / Activity Request if one is provided.

Return JSON array:
[
  {
    "name": "Creative outfit name",
    "itemNumbers": [1, 3, 5],
    "occasion": "casual|office|date_night|party|gym|travel",
    "rating": 85,
    "reasoning": "Why these items work together — color harmony, style cohesion, body flattery, and how they match the requested vibe/occasion",
    "stylingTips": ["Tuck the shirt in for a cleaner look", "Roll sleeves to elbow for casual vibe"],
    "colorHarmony": "complementary|analogous|monochromatic|triadic|neutral",
    "weatherSuitability": "Description of weather this works for"
  }
]

RULES:
- Each outfit MUST have at least a top + bottom (or a dress/ethnic piece)
- Consider color theory and pattern mixing rules
- Rate based on how well the colors, patterns, and formality levels actually match
- Include at least one versatile casual option and one slightly dressier option
- Be creative with naming — make it fashionable and fun
- Only return valid JSON array, no extra text`;

    const result = await model.generateContent(prompt);
    const responseText = result.response.text();
    const cleaned = responseText.replace(/```json\n?|\n?```/g, '').trim();

    try {
      const parsed = JSON.parse(cleaned);
      return parsed.map((combo: any, index: number) => ({
        id: `combo_${Date.now()}_${index}`,
        name: combo.name || `Outfit ${index + 1}`,
        items: (combo.itemNumbers || [])
          .map((num: number) => items[num - 1])
          .filter(Boolean),
        occasion: combo.occasion || 'casual',
        rating: combo.rating || 75,
        reasoning: combo.reasoning || 'A great combination from your wardrobe',
        stylingTips: combo.stylingTips || [],
        colorHarmony: combo.colorHarmony || 'neutral',
        weatherSuitability: combo.weatherSuitability || 'Suitable for most weather',
      }));
    } catch (parseError) {
      console.error('Failed to parse outfit combos:', parseError);
      return getDefaultOutfitCombos(items);
    }
  } catch (error) {
    console.error('Outfit generation error:', error);
    throw error;
  }
};

// "What Goes With This?" — Single item pairing suggestions
export const getItemPairings = async (
  item: WardrobeItem,
  allItems: WardrobeItem[],
  userProfile?: any
): Promise<WardrobeOutfitCombo[]> => {
  const otherItems = allItems.filter(i => i.id !== item.id);
  if (otherItems.length === 0) {
    throw new Error('Add more items to your wardrobe to get pairing suggestions');
  }

  if (!geminiRateLimiter.canMakeCall()) {
    throw new Error('Rate limit reached. Please wait a moment.');
  }

  try {
    const model = genAI.getGenerativeModel({ model: 'gemini-3.5-flash' });

    const othersSummary = otherItems.map((i, idx) =>
      `[${idx + 1}] ${i.name} — ${i.type}/${i.subType}, Colors: ${i.colors.join(', ')}, Pattern: ${i.pattern}, Formality: ${i.formality}`
    ).join('\n');

    const prompt = `You are a fashion stylist. A user wants to know what items from their wardrobe pair well with:

SELECTED ITEM: ${item.name} — ${item.type}/${item.subType}, Colors: ${item.colors.join(', ')}, Pattern: ${item.pattern}, Fabric: ${item.fabric}, Formality: ${item.formality}

OTHER WARDROBE ITEMS:
${othersSummary}

Gender: ${userProfile?.gender || 'male'}

Create 3-4 outfit combinations that include the selected item. Reference other items by their number.

Return JSON array:
[
  {
    "name": "Outfit name",
    "itemNumbers": [2, 5],
    "occasion": "casual|office|date_night|party",
    "rating": 85,
    "reasoning": "Why this pairing works",
    "stylingTips": ["tip1", "tip2"],
    "colorHarmony": "complementary|analogous|monochromatic",
    "weatherSuitability": "weather description"
  }
]

Only return valid JSON, no extra text.`;

    const result = await model.generateContent(prompt);
    const responseText = result.response.text();
    const cleaned = responseText.replace(/```json\n?|\n?```/g, '').trim();

    const parsed = JSON.parse(cleaned);
    return parsed.map((combo: any, index: number) => ({
      id: `pair_${Date.now()}_${index}`,
      name: combo.name || `Pairing ${index + 1}`,
      items: [
        item,
        ...(combo.itemNumbers || [])
          .map((num: number) => otherItems[num - 1])
          .filter(Boolean),
      ],
      occasion: combo.occasion || 'casual',
      rating: combo.rating || 75,
      reasoning: combo.reasoning || 'A great combination',
      stylingTips: combo.stylingTips || [],
      colorHarmony: combo.colorHarmony || 'neutral',
      weatherSuitability: combo.weatherSuitability || 'Suitable for most weather',
    }));
  } catch (error) {
    console.error('Item pairing error:', error);
    return getDefaultOutfitCombos([item, ...otherItems.slice(0, 3)]);
  }
};

// ─── Wardrobe Analytics ───────────────────────────────────────────────────────

export const getWardrobeStats = (items: WardrobeItem[]): WardrobeStats => {
  if (items.length === 0) {
    return {
      totalItems: 0,
      byType: {},
      colorDistribution: [],
      formalitySpread: {},
      seasonReadiness: [],
      versatilityScore: 0,
      wardrobeScore: 0,
      gapAnalysis: ['Start building your wardrobe by adding your first item!'],
      duplicates: [],
      costPerWear: [],
    };
  }

  // Count by type
  const byType: Record<string, number> = {};
  items.forEach(item => {
    byType[item.type] = (byType[item.type] || 0) + 1;
  });

  // Color distribution
  const colorCounts: Record<string, number> = {};
  items.forEach(item => {
    const color = item.primaryColor || item.colors?.[0] || 'Unknown';
    colorCounts[color] = (colorCounts[color] || 0) + 1;
  });
  const colorDistribution = Object.entries(colorCounts)
    .map(([color, count]) => ({
      color,
      count,
      percentage: Math.round((count / items.length) * 100),
    }))
    .sort((a, b) => b.count - a.count);

  // Formality spread
  const formalitySpread: Record<string, number> = {};
  items.forEach(item => {
    const formality = item.formality || 'casual';
    formalitySpread[formality] = (formalitySpread[formality] || 0) + 1;
  });

  // Season readiness
  const allSeasons: Season[] = ['summer', 'monsoon', 'winter', 'spring', 'autumn'];
  const seasonReadiness = allSeasons.map(season => {
    const seasonItems = items.filter(i => 
      i.seasons?.includes(season) || i.seasons?.includes('all_season')
    );
    const hasTops = seasonItems.some(i => i.type === 'top' || i.type === 'dress' || i.type === 'ethnic');
    const hasBottoms = seasonItems.some(i => i.type === 'bottom' || i.type === 'dress' || i.type === 'ethnic');
    const hasOuterwear = season === 'winter' || season === 'monsoon' 
      ? seasonItems.some(i => i.type === 'outerwear')
      : true;
    const hasFootwear = seasonItems.some(i => i.type === 'footwear');

    const missing: string[] = [];
    if (!hasTops) missing.push(`${season} top`);
    if (!hasBottoms) missing.push(`${season} bottom`);
    if (!hasOuterwear && (season === 'winter' || season === 'monsoon')) missing.push(`${season} outerwear`);
    if (!hasFootwear) missing.push(`${season} footwear`);

    const score = Math.round(
      ((hasTops ? 30 : 0) + (hasBottoms ? 30 : 0) + (hasOuterwear ? 20 : 0) + (hasFootwear ? 20 : 0))
    );

    return { season, score, missing };
  });

  // Gap analysis
  const gapAnalysis: string[] = [];
  const essentialTypes = ['top', 'bottom', 'footwear'];
  essentialTypes.forEach(type => {
    if (!byType[type] || byType[type] < 2) {
      gapAnalysis.push(`You need more ${type}s — aim for at least 3-4 versatile options`);
    }
  });
  if (!byType['outerwear']) {
    gapAnalysis.push('Add a versatile jacket or blazer for layering options');
  }
  if (!byType['accessory']) {
    gapAnalysis.push('Accessories can transform basic outfits — add a watch, belt, or bag');
  }
  if (colorDistribution.length < 3) {
    gapAnalysis.push('Your color palette is limited — try adding neutral tones for versatility');
  }
  if (!formalitySpread['semi_formal'] && !formalitySpread['formal']) {
    gapAnalysis.push('Consider adding a semi-formal piece for events and occasions');
  }

  // Duplicate detection
  const duplicates: string[] = [];
  const subTypeCounts: Record<string, { count: number; color: string }[]> = {};
  items.forEach(item => {
    if (!subTypeCounts[item.subType]) subTypeCounts[item.subType] = [];
    subTypeCounts[item.subType].push({ count: 1, color: item.primaryColor });
  });
  Object.entries(subTypeCounts).forEach(([subType, instances]) => {
    if (instances.length >= 3) {
      duplicates.push(`You have ${instances.length} ${subType}s — consider diversifying`);
    }
  });

  // Versatility score
  const typeVariety = Math.min(Object.keys(byType).length / 6, 1) * 30;
  const colorVariety = Math.min(colorDistribution.length / 5, 1) * 25;
  const formalityVariety = Math.min(Object.keys(formalitySpread).length / 4, 1) * 20;
  const seasonCoverage = (seasonReadiness.reduce((sum, s) => sum + s.score, 0) / (allSeasons.length * 100)) * 25;
  const versatilityScore = Math.round(typeVariety + colorVariety + formalityVariety + seasonCoverage);

  // Overall wardrobe score
  const itemCountScore = Math.min(items.length / 15, 1) * 20;
  const wardrobeScore = Math.round(
    itemCountScore + (versatilityScore * 0.8)
  );

  // Cost per wear
  const costPerWear = items
    .filter(i => i.purchasePrice && i.timesWorn > 0)
    .map(i => ({
      itemName: i.name,
      cost: i.purchasePrice!,
      wears: i.timesWorn,
      cpw: Math.round((i.purchasePrice! / i.timesWorn) * 100) / 100,
    }))
    .sort((a, b) => a.cpw - b.cpw);

  return {
    totalItems: items.length,
    byType,
    colorDistribution,
    formalitySpread,
    seasonReadiness,
    versatilityScore,
    wardrobeScore,
    gapAnalysis,
    duplicates,
    costPerWear,
  };
};

// ─── Fallbacks ────────────────────────────────────────────────────────────────

const getDefaultOutfitCombos = (items: WardrobeItem[]): WardrobeOutfitCombo[] => {
  const tops = items.filter(i => i.type === 'top');
  const bottoms = items.filter(i => i.type === 'bottom');
  
  const combos: WardrobeOutfitCombo[] = [];
  const top = tops[0] || items[0];
  const bottom = bottoms[0] || items[1];

  if (top && bottom) {
    combos.push({
      id: `default_${Date.now()}`,
      name: 'Classic Combo',
      items: [top, bottom],
      occasion: 'casual',
      rating: 72,
      reasoning: 'A basic combination from your wardrobe. Add more items for better suggestions!',
      stylingTips: ['Keep accessories minimal', 'Ensure proper fit'],
      colorHarmony: 'neutral',
      weatherSuitability: 'Suitable for mild weather',
    });
  }

  return combos;
};

// ─── Shopping Match Scanner ──────────────────────────────────────────────────

export interface ShoppingMatchResult {
  detectedItem: {
    name: string;
    type: string;
    subType: string;
    primaryColor: string;
    stylePersonality: string;
  };
  compatibilityScore: number;
  recommendation: 'BUY' | 'CONSIDER' | 'SKIP';
  verdictReason: string;
  matchingOutfits: {
    outfitName: string;
    closetItems: WardrobeItem[];
    reasoning: string;
    stylingTips: string[];
  }[];
}

export const checkShoppingItemMatch = async (
  imageUri: string,
  wardrobeItems: WardrobeItem[],
  userProfile?: any
): Promise<ShoppingMatchResult> => {
  if (!geminiRateLimiter.canMakeCall()) {
    throw new Error('Rate limit reached. Please wait a moment.');
  }

  try {
    const { base64, mimeType } = await compressAndConvertImage(imageUri);
    const model = genAI.getGenerativeModel({ model: 'gemini-3.5-flash' });

    // Build wardrobe inventory summary for prompt
    const wardrobeSummary = wardrobeItems.length > 0
      ? wardrobeItems.map((item, i) =>
          `[${i + 1}] ${item.name} — Type: ${item.type}/${item.subType}, Colors: ${item.colors.join(', ')}, Pattern: ${item.pattern}, Formality: ${item.formality}, Style: ${item.stylePersonality}`
        ).join('\n')
      : 'User wardrobe is currently empty.';

    const gender = userProfile?.gender || 'male';
    const bodyType = userProfile?.bodyType || 'average';
    const skinTone = userProfile?.skinTone || 'fair';

    const prompt = `You are a world-class fashion stylist. A user is shopping and wants to know if this potential new clothing purchase matches their current digital wardrobe.

WARDROBE INVENTORY:
${wardrobeSummary}

USER PROFILE:
- Gender: ${gender}
- Body Type: ${bodyType}
- Skin Tone: ${skinTone}

Analyze the photo of this new potential purchase item, determine what clothing type it is, and then compare it with their wardrobe inventory.
Determine the compatibility score (1 to 100), choose a verdict recommendation (BUY, CONSIDER, or SKIP), provide a styling rationale, and create 2-3 outfit combinations matching the new item with their actual wardrobe items (referencing wardrobe list numbers).

Return JSON format:
{
  "detectedItem": {
    "name": "Catchy fashionable name for the scanned item",
    "type": "top|bottom|outerwear|footwear|accessory|dress|activewear|ethnic",
    "subType": "specific item name (e.g. distressed denim jacket, brown leather boots)",
    "primaryColor": "primary color name",
    "stylePersonality": "minimalist|bold|classic|trendy|grunge|streetwear"
  },
  "compatibilityScore": 85,
  "recommendation": "BUY|CONSIDER|SKIP",
  "verdictReason": "Detailed explanation of why they should buy/consider/skip it, based on versatility, color harmony, and style match.",
  "matchingOutfits": [
    {
      "outfitName": "Outfit name",
      "itemNumbers": [2, 4],
      "reasoning": "Why these items match well",
      "stylingTips": ["tip1", "tip2"]
    }
  ]
}

RULES:
- RECOMMENDATION RULES:
  - BUY: Scanned item matches 3+ wardrobe items beautifully, highly versatile.
  - CONSIDER: Scanned item matches 1 or 2 wardrobe items, or matches style but has color/type overlap.
  - SKIP: Scanned item matches nothing, overlaps with too many duplicates, or doesn't suit user profile.
- Only return JSON, no markdown blocks, no extra text.`;

    const result = await model.generateContent([
      prompt,
      {
        inlineData: {
          data: base64,
          mimeType: mimeType,
        },
      },
    ]);

    const responseText = result.response.text();
    const cleaned = responseText.replace(/```json\n?|\n?```/g, '').trim();
    const parsed = JSON.parse(cleaned);

    const matchingOutfits = (parsed.matchingOutfits || []).map((combo: any) => {
      const closetItems = (combo.itemNumbers || [])
        .map((num: number) => wardrobeItems[num - 1])
        .filter(Boolean);

      return {
        outfitName: combo.outfitName || 'Outfit Match',
        closetItems,
        reasoning: combo.reasoning || 'A great combination.',
        stylingTips: combo.stylingTips || [],
      };
    });

    return {
      detectedItem: {
        name: parsed.detectedItem?.name || 'Scanned Item',
        type: parsed.detectedItem?.type || 'top',
        subType: parsed.detectedItem?.subType || 'Clothing Item',
        primaryColor: parsed.detectedItem?.primaryColor || 'Unknown',
        stylePersonality: parsed.detectedItem?.stylePersonality || 'classic',
      },
      compatibilityScore: parsed.compatibilityScore || 50,
      recommendation: parsed.recommendation || 'CONSIDER',
      verdictReason: parsed.verdictReason || 'Check the details to see styling fits.',
      matchingOutfits,
    };
  } catch (error) {
    console.error('Shopping match scanner error:', error);
    throw error;
  }
};

// ─── Stylist Chat Service ────────────────────────────────────────────────────

export interface PackingData {
  selectedClosetItemNames: string[];
  outfitCombinations: string[];
  missingItems: { name: string; reason: string }[];
}

export interface ChatMessage {
  id: string;
  text: string;
  isUser: boolean;
  timestamp: Date;
  attachedItem?: WardrobeItem;
  packingData?: PackingData;
}

export interface StylistResponse {
  text: string;
  packingData?: PackingData;
}

// Helper to fetch coordinates for a city name via Open-Meteo geocoding
const fetchCityCoordinates = async (city: string): Promise<{ lat: number; lon: number } | null> => {
  try {
    const res = await fetch(
      `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(city)}&count=1&language=en&format=json`
    );
    if (!res.ok) return null;
    const data = await res.json();
    if (data.results && data.results.length > 0) {
      return { lat: data.results[0].latitude, lon: data.results[0].longitude };
    }
    return null;
  } catch {
    return null;
  }
};

export const sendMessageToStylist = async (
  message: string,
  history: ChatMessage[],
  attachedItem?: WardrobeItem,
  userProfile?: any,
  wardrobeItems?: WardrobeItem[]
): Promise<StylistResponse> => {
  if (!geminiRateLimiter.canMakeCall()) {
    throw new Error('Rate limit reached. Please wait a moment.');
  }

  try {
    const model = genAI.getGenerativeModel({ model: 'gemini-3.5-flash' });

    // Format chat history for Gemini
    const historyPrompt = history.map(msg =>
      `${msg.isUser ? 'User' : 'Stylist'}: ${msg.text}${msg.attachedItem ? ` (Attached Item: ${msg.attachedItem.name} — ${msg.attachedItem.type}/${msg.attachedItem.subType})` : ''}`
    ).join('\n');

    const gender = userProfile?.gender || 'male';
    const bodyType = userProfile?.bodyType || 'average';
    const skinTone = userProfile?.skinTone || 'fair';
    const stylePersonality = userProfile?.stylePersonality || 'classic';
    const height = userProfile?.height ? `${userProfile.height} ${userProfile.heightUnit || 'cm'}` : 'Not specified';
    const weight = userProfile?.weight ? `${userProfile.weight} kg` : 'Not specified';
    const favColors = userProfile?.favColors ? userProfile.favColors.join(', ') : 'Not specified';
    const lifestyle = userProfile?.lifestyle || 'Not specified';
    const city = userProfile?.city || 'Not specified';

    let itemContext = '';
    if (attachedItem) {
      itemContext = `The user has attached their wardrobe item: "${attachedItem.name}". Details: Type: ${attachedItem.type}/${attachedItem.subType}, Colors: ${attachedItem.colors.join(', ')}, Pattern: ${attachedItem.pattern}, Fabric: ${attachedItem.fabric}, Formality: ${attachedItem.formality}, Seasons: ${attachedItem.seasons.join(', ')}.`;
    }

    // ── STEP 1: Detect if message is a travel/packing intent ──────────────────
    // Broad pre-filter list including common travel questions, weather actions, and destinations
    const travelKeywords = [
      'trip', 'pack', 'travel', 'vacation', 'holiday', 'tour', 'visit', 'going to', 'go to', 
      'journey', 'destination', 'flight', 'weather in', 'wear in', 'suit for', 'pack for', 
      'banaras', 'shimla', 'delhi', 'mumbai', 'kolkata', 'paris', 'london', 'tokyo', 'milan', 'new york',
      'rome', 'switzerland', 'goa', 'manali', 'kashmir', 'beach', 'mountain', 'hill station'
    ];
    const messageLower = message.toLowerCase();
    const hasTravelKeywords = travelKeywords.some(keyword => messageLower.includes(keyword));

    let intentData = { isTravelRequest: false, destinationCity: null as string | null };

    if (hasTravelKeywords) {
      try {
        const intentDetectPrompt = `You are a fashion assistant intent classifier.
Given this user message: "${message}"
Determine:
1. Is this a travel, trip, packing list, or vacation request? Reply with YES or NO.
2. If YES, extract the destination city name. Reply with just the city name.

Reply in this exact JSON format, nothing else:
{"isTravelRequest": true, "destinationCity": "city name or null"}`;

        const intentResult = await model.generateContent(intentDetectPrompt);
        const rawIntent = intentResult.response.text().trim().replace(/```json|```/g, '').trim();
        const parsed = JSON.parse(rawIntent);
        if (parsed && typeof parsed.isTravelRequest === 'boolean') {
          intentData = {
            isTravelRequest: parsed.isTravelRequest,
            destinationCity: parsed.destinationCity || null
          };
        }
      } catch (err) {
        console.warn('⚠️ Intent detection failed, falling back to regular chat:', err);
      }
    }

    // ── STEP 2: If travel intent, fetch weather & build packing prompt ─────────
    if (intentData.isTravelRequest && intentData.destinationCity && wardrobeItems && wardrobeItems.length > 0) {
      console.log(`✈️ Travel intent detected! Destination: ${intentData.destinationCity}`);

      // Fetch coordinates for the destination city
      const coords = await fetchCityCoordinates(intentData.destinationCity);
      let weatherContext = `Weather data for ${intentData.destinationCity} is currently unavailable.`;

      if (coords) {
        try {
          const meteoRes = await fetch(
            `https://api.open-meteo.com/v1/forecast?latitude=${coords.lat}&longitude=${coords.lon}&current_weather=true&hourly=temperature_2m,weathercode,relative_humidity_2m&timezone=auto`
          );
          if (meteoRes.ok) {
            const meteoData = await meteoRes.json();
            const cw = meteoData.current_weather;
            const hourlyHumidities = meteoData.hourly?.relative_humidity_2m || [];
            const avgHumidity = hourlyHumidities.length > 0
              ? Math.round(hourlyHumidities.slice(0, 8).reduce((a: number, b: number) => a + b, 0) / Math.min(8, hourlyHumidities.length))
              : 'Unknown';
            const weatherCode = cw?.weathercode;
            const isRainy = weatherCode >= 51 && weatherCode <= 99;
            const isHot = cw?.temperature >= 28;
            const isCold = cw?.temperature <= 15;
            weatherContext = `Current weather in ${intentData.destinationCity}: ${cw?.temperature}°C, ${isRainy ? 'Rainy/Wet' : isHot ? 'Hot and Sunny' : isCold ? 'Cool/Cold' : 'Mild'}. Average humidity: ${avgHumidity}%. Wind: ${cw?.windspeed} km/h.`;
            console.log(`🌦️ Fetched weather for ${intentData.destinationCity}:`, weatherContext);
          }
        } catch (e) {
          console.warn('Weather fetch failed for city:', e);
        }
      }

      // Build wardrobe snapshot for AI (limit to 30 items to stay within context)
      // NOTE: Deliberately exclude id/imageUri/imageBase64 — AI doesn't need internal DB IDs
      //       and was accidentally echoing them back in chat responses.
      const wardrobeSnapshot = wardrobeItems.slice(0, 30).map(item => ({
        name: item.name,
        type: item.type,
        subType: item.subType,
        colors: item.colors,
        fabric: item.fabric,
        seasons: item.seasons,
        formality: item.formality,
      }));

      const packingPrompt = `You are Aria, a world-class personal fashion stylist and travel packing expert.

USER PROFILE:
- Gender: ${gender}, Body Type: ${bodyType}, Skin Tone: ${skinTone}, Style: ${stylePersonality}

DESTINATION & WEATHER:
${weatherContext}

USER'S AVAILABLE WARDROBE (scan carefully for suitable items):
${JSON.stringify(wardrobeSnapshot, null, 2)}

USER'S REQUEST: "${message}"

TASK: Create a smart, minimalist travel packing list that covers the entire trip using only items from the wardrobe above where possible. Every item you pick should be justified by the weather and occasion.

INSTRUCTIONS:
1. Select the MINIMUM items from the wardrobe that provide MAXIMUM outfit combinations. Prioritize versatile, mix-and-match pieces.
2. For each outfit combination, describe specifically which items are worn together and for what occasion (sightseeing, dinner, temple visit, etc.).
3. Identify MISSING items the user doesn't have in their closet but genuinely needs for this trip. Be specific (e.g., "A lightweight waterproof jacket for rain showers in ${intentData.destinationCity}"). Only add truly needed items, not nice-to-haves.
4. Write a warm, friendly intro paragraph as Aria.

Return your response as valid JSON ONLY in this exact format:
{
  "ariaText": "Your warm, conversational intro message here as Aria. Mention the weather and the destination. Do not repeat outfit details here, just a friendly overview.",
  "selectedClosetItemNames": ["Name 1", "Name 2"],
  "outfitCombinations": [
    "Day 1 - Sightseeing: [Item Name] + [Item Name] — Light and comfortable for the heat.",
    "Day 2 - Evening Dinner: [Item Name] + [Item Name] — Polished yet breathable."
  ],
  "missingItems": [
    {"name": "Lightweight waterproof jacket", "reason": "Rainy season in ${intentData.destinationCity} means sudden showers."},
    {"name": "Comfortable walking sandals", "reason": "Temple and street exploration requires easy-on footwear."}
  ]
}`;

      const packingResult = await model.generateContent(packingPrompt);
      let packingRaw = packingResult.response.text().trim().replace(/```json|```/g, '').trim();
      
      try {
        const parsed = JSON.parse(packingRaw);
        const packingData: PackingData = {
          selectedClosetItemNames: parsed.selectedClosetItemNames || parsed.selectedClosetItemIds || [],
          outfitCombinations: parsed.outfitCombinations || [],
          missingItems: parsed.missingItems || [],
        };
        return {
          text: parsed.ariaText || `Here's your packing plan for ${intentData.destinationCity}!`,
          packingData,
        };
      } catch (parseErr) {
        console.warn('Packing JSON parse failed, falling back to text response:', parseErr);
        // Fall through to normal text response with the raw text
        return { text: packingResult.response.text().trim() };
      }
    }

    // ── STEP 3: Regular conversation (non-travel) ─────────────────────────────
    const systemPrompt = `You are a world-class friendly personal fashion stylist and image consultant named "Aria". 
You help users with styling advice, choosing colors, packing lists, wardrobe coordination, and figuring out what suits their body shape.

USER STYLE DNA PROFILE:
- Gender: ${gender}
- Body Type/Shape: ${bodyType}
- Skin Tone: ${skinTone}
- Style Personality: ${stylePersonality}
- Height: ${height}
- Weight: ${weight}
- Favorite Colors: ${favColors}
- Lifestyle/Vibe: ${lifestyle}
- City/Location: ${city}

${itemContext}

CHAT HISTORY:
${historyPrompt}

User's new message: "${message}"

Write a highly personalized, warm, and professional response advising the user as their personal stylist. Keep the tone helpful, encouraging, and stylish.

FORMATTING RULES:
1. Do NOT use markdown heading tags (e.g., #, ##, ###, etc.).
2. Do NOT use bold markdown tags (**text**) or italics (*text*). Use standard capitalization and plain text for emphasis.
3. For lists, use simple bullet points starting with a hyphen (e.g., "- First item") followed by a space.
4. Separate sections or paragraphs with double line breaks for beautiful, spacious readability.
This is critical for mobile text display. Output clean, conversational plain text following these rules.`;

    const result = await model.generateContent(systemPrompt);
    return { text: result.response.text().trim() };
  } catch (error) {
    console.error('Stylist chat error:', error);
    throw error;
  }
};

// ─── AR Try-On Service ────────────────────────────────────────────────────────

export interface ArTryonResult {
  fitScore: number;
  vibeScore: number;
  verdict: 'BUY' | 'KEEP' | 'SKIP' | 'ADJUST';
  reasoning: string;
}

export const analyzeArTryon = async (
  imageUri: string,
  attachedItem: WardrobeItem,
  userProfile?: any
): Promise<ArTryonResult> => {
  if (!geminiRateLimiter.canMakeCall()) {
    throw new Error('Rate limit reached. Please wait a moment.');
  }

  try {
    const { base64, mimeType } = await compressAndConvertImage(imageUri);
    const model = genAI.getGenerativeModel({ model: 'gemini-3.5-flash' });

    const gender = userProfile?.gender || 'male';
    const bodyType = userProfile?.bodyType || 'average';
    const skinTone = userProfile?.skinTone || 'fair';
    const stylePersonality = userProfile?.stylePersonality || 'classic';

    const prompt = `You are a world-class digital fashion stylist. The user has overlayed a digital wardrobe clothing item onto a live preview photo of themselves in an AR Try-On Mirror.
    
OVERLAID CLOTHING ITEM DETAILS:
- Name: ${attachedItem.name}
- Type: ${attachedItem.type}/${attachedItem.subType}
- Colors: ${attachedItem.colors.join(', ')}
- Pattern: ${attachedItem.pattern}
- Fabric: ${attachedItem.fabric}
- Formality: ${attachedItem.formality}
- Seasons: ${attachedItem.seasons.join(', ')}

USER STYLE PROFILE:
- Gender: ${gender}
- Body Type/Shape: ${bodyType}
- Skin Tone: ${skinTone}
- Style Personality: ${stylePersonality}

Evaluate the try-on image, which contains the user standing in front of the camera with the clothing item overlaid on top of them.
Determine:
1. "fitScore": 0-100 rating of how well the overlay size, length, and positioning aligns with their physical proportions in the snapshot.
2. "vibeScore": 0-100 style compatibility rating of how well this clothing item complements what they are wearing underneath or the general environment/vibe in the picture.
3. "verdict": Recommendation (BUY, KEEP, SKIP, ADJUST).
4. "reasoning": Conversational stylist advice summarizing the fit, drape, vibe coordination, and quick advice on adjusting the position or styling it differently.

Return JSON format strictly:
{
  "fitScore": number,
  "vibeScore": number,
  "verdict": "BUY|KEEP|SKIP|ADJUST",
  "reasoning": "stylist advice summary"
}
Do NOT wrap the output in markdown code blocks like \`\`\`json, just return raw JSON text.`;

    const result = await model.generateContent([
      {
        inlineData: {
          data: base64,
          mimeType,
        },
      },
      prompt,
    ]);

    const text = result.response.text().trim();
    const cleanText = text.replace(/```json/g, '').replace(/```/g, '').trim();
    const parsed = JSON.parse(cleanText);

    return {
      fitScore: parsed.fitScore || 70,
      vibeScore: parsed.vibeScore || 70,
      verdict: parsed.verdict || 'KEEP',
      reasoning: parsed.reasoning || 'Looks like a good start! Match overlay position for better alignment.',
    };
  } catch (error) {
    console.error('AR tryon analysis error:', error);
    throw error;
  }
};
