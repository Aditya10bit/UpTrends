import { generateOutfitSuggestions } from './geminiService';

export interface OutfitSuggestion {
  id: string;
  title: string;
  description: string;
  items: string[];
  occasion: string;
  season: string;
  colors: string[];
  price_range: string;
  style_tips: string[];
  image_description: string;
  shopping_links?: ShoppingLink[];
  reference_links?: ReferenceLink[];
}

export interface ShoppingLink {
  platform: string;
  url: string;
  description: string;
  icon: string;
}

export interface ReferenceLink {
  platform: string;
  url: string;
  description: string;
  icon: string;
}

export const getOutfitSuggestions = async (
  userProfile: any,
  category: string
): Promise<OutfitSuggestion[]> => {
  try {
    console.log('🔍 Generating outfit suggestions for:', { userProfile, category });

    // Skip twinning categories
    if (category.toLowerCase().includes('twinning')) {
      return [];
    }

    // ALWAYS prioritize user profile gender over everything else
    let finalGender = userProfile?.gender?.toLowerCase() || 'male';

    // Validate and ensure gender is properly set
    if (finalGender !== 'male' && finalGender !== 'female') {
      console.warn('⚠️ Invalid gender in user profile, defaulting to male');
      finalGender = 'male';
    }

    console.log('👤 USER PROFILE GENDER PRIORITY:', {
      userProfileGender: userProfile?.gender,
      finalGender,
      category,
      message: 'User profile gender takes absolute priority over category'
    });

    // Create detailed prompt for Gemini
    const prompt = createOutfitPrompt(userProfile, category);

    // Get suggestions from Gemini with retry logic
    console.log('🚀 SENDING TO AI - Category:', category, 'Gender in prompt:', finalGender);
    const suggestions = await generateOutfitSuggestions(prompt, category, userProfile);
    console.log('🤖 AI RETURNED:', suggestions.length, 'suggestions');

    // Log first suggestion to check gender
    if (suggestions.length > 0) {
      console.log('🔍 FIRST AI SUGGESTION:', {
        title: suggestions[0].title,
        description: suggestions[0].description,
        items: suggestions[0].items?.slice(0, 3)
      });
    }

    // If we got suggestions, enhance them with shopping and reference links
    if (suggestions && suggestions.length > 0) {
      // Validate that suggestions are gender-appropriate
      const userGender = userProfile?.gender?.toLowerCase();
      const expectedGender = userGender || 'male';

      console.log('🔍 Validating outfit suggestions for gender:', expectedGender);
      console.log('🔍 GENDER COMPARISON:', {
        promptGender: finalGender,
        expectedGender,
        userProfileGender: userGender,
        match: finalGender === expectedGender
      });

      // Check for potential cross-gender items in suggestions
      suggestions.forEach((outfit, index) => {
        const outfitText = JSON.stringify(outfit).toLowerCase();
        if (expectedGender === 'male') {
          if (outfitText.includes('dress') || outfitText.includes('skirt') || outfitText.includes('heels') ||
            outfitText.includes('blouse') || outfitText.includes('feminine') || outfitText.includes('women')) {
            console.warn(`⚠️ POTENTIAL CROSS-GENDER ITEM DETECTED in outfit ${index + 1} for MALE user:`, outfit);
          }
        } else if (expectedGender === 'female') {
          if (outfitText.includes('tie') || outfitText.includes('masculine') || outfitText.includes('men\'s')) {
            console.warn(`⚠️ POTENTIAL CROSS-GENDER ITEM DETECTED in outfit ${index + 1} for FEMALE user:`, outfit);
          }
        }
      });

      const enhancedSuggestions = await Promise.all(
        suggestions.map(async (outfit) => {
          // Pass the same finalGender that was used for the prompt to ensure consistency
          const links = await generateOutfitLinks(outfit, { ...userProfile, gender: finalGender }, category);
          return {
            ...outfit,
            shopping_links: links.shopping,
            reference_links: links.reference
          };
        })
      );
      return enhancedSuggestions;
    }

    // If no suggestions, return empty array (fallback will be handled in UI)
    return [];
  } catch (error: any) {
    console.error('Error getting outfit suggestions:', error);

    // If it's a 503 error, the fallback will be handled in generateOutfitSuggestions
    // For other errors, return empty array
    return [];
  }
};

const createOutfitPrompt = (userProfile: any, category: string): string => {
  const { height, weight, bodyType, skinTone, gender } = userProfile;

  // Normalize body type
  const normalizedBodyType = normalizeBodyType(bodyType);
  const heightCategory = normalizeHeight(height);

  // ALWAYS prioritize user profile gender over category
  let finalGender = gender?.toLowerCase() || 'male';

  // Validate and ensure gender is properly set
  if (!finalGender || (finalGender !== 'male' && finalGender !== 'female')) {
    console.warn('⚠️ Invalid or missing gender, defaulting to male');
    finalGender = 'male';
  }

  // User profile gender is already prioritized above

  // Create category-specific context
  const categoryContext = getCategoryContext(category);

  console.log('🎯 Creating outfit prompt for:', {
    category,
    originalGender: gender,
    finalGender,
    bodyType: normalizedBodyType,
    height: heightCategory,
    skinTone,
    categoryContext
  });

  // Additional debugging for gender issues
  if (!gender) {
    console.error('❌ USER PROFILE GENDER IS MISSING!', userProfile);
  }
  if (finalGender === 'male' && gender === 'female') {
    console.warn('⚠️ GENDER MISMATCH: Profile says female but using male', { category, gender, finalGender });
  }
  if (finalGender === 'female' && gender === 'male') {
    console.warn('⚠️ GENDER MISMATCH: Profile says male but using female', { category, gender, finalGender });
  }

  // FINAL GENDER VALIDATION BEFORE PROMPT CREATION
  console.log(`🎯 FINAL GENDER CHECK: Creating prompt for ${finalGender.toUpperCase()} user`);
  console.log(`🎯 PROMPT CONTEXT:`, {
    category,
    userProfileGender: gender,
    finalGender,
    promptWillSay: `${finalGender.toUpperCase()}`
  });

  if (finalGender !== 'male' && finalGender !== 'female') {
    console.error('❌ CRITICAL ERROR: Invalid gender in prompt creation!', finalGender);
    finalGender = 'male'; // Emergency fallback
  }

  return `
You are a professional fashion stylist. Create 5 detailed outfit suggestions for a ${finalGender.toUpperCase()} with the following characteristics:

PHYSICAL ATTRIBUTES:
- Body Type: ${normalizedBodyType}
- Height: ${heightCategory} (${height}cm)
- Weight: ${weight}kg
- Skin Tone: ${skinTone}
- Gender: ${finalGender.toUpperCase()}

STYLE CATEGORY: ${category}
CATEGORY CONTEXT: ${categoryContext}

🚨 CRITICAL GENDER REQUIREMENTS - THIS IS MANDATORY:
- TARGET GENDER: ${finalGender.toUpperCase()}
- YOU ARE STYLING FOR A ${finalGender.toUpperCase()} PERSON ONLY
- ALL outfit suggestions MUST be appropriate for ${finalGender.toUpperCase()} gender ONLY
- Do NOT include any clothing items typically worn by other genders
- Ensure all accessories, shoes, and styling are gender-appropriate for ${finalGender.toUpperCase()}
- Use ${finalGender.toUpperCase()}-specific fashion terminology and styling advice
- NEVER suggest cross-gender clothing items under any circumstances

${finalGender.toUpperCase() === 'MALE' ? `
🚫 FOR MALES - ABSOLUTELY FORBIDDEN:
- NO dresses, skirts, heels, feminine jewelry, makeup, or women's accessories
- NO women's blouses, feminine tops, or ladies' clothing
- NO feminine colors like pink, purple, or pastel shades as primary colors
- NO women's handbags, purses, or feminine accessories
- ONLY suggest MEN'S clothing, MEN'S shoes, MEN'S accessories

✅ FOR MALES - REQUIRED:
- Men's shirts, t-shirts, polos, hoodies, jackets
- Men's pants, jeans, shorts, trousers
- Men's shoes: sneakers, boots, dress shoes, loafers
- Men's accessories: watches, belts, wallets, caps
- Masculine colors: navy, black, gray, brown, olive, burgundy
` : `
🚫 FOR FEMALES - ABSOLUTELY FORBIDDEN:
- NO men's suits, ties, masculine shoes, or men's accessories
- NO men's clothing or masculine-only items
- NO overly masculine styling or terminology

✅ FOR FEMALES - REQUIRED:
- Women's tops, blouses, dresses, skirts, pants
- Women's shoes: heels, flats, boots, sneakers
- Women's accessories: jewelry, handbags, scarves
- Feminine and versatile colors and styling
`}

- REMEMBER: You are styling for a ${finalGender.toUpperCase()} person - keep this in mind for EVERY suggestion

SPECIFIC REQUIREMENTS FOR ${category.toUpperCase()}:
1. All outfits MUST be appropriate for ${category} occasions/settings
2. Consider the specific clothing types needed for ${category}
3. Each outfit should be specifically tailored for ${normalizedBodyType} body type
4. Colors should complement ${skinTone} skin tone
5. Fit recommendations should consider ${heightCategory} height
6. Include ${category}-specific accessories and styling elements
7. ENSURE all recommendations are strictly ${finalGender}-appropriate

IMPORTANT: Make each outfit distinctly different and specifically designed for ${category}. Do NOT use generic outfits. NEVER suggest cross-gender clothing or accessories.

CRITICAL: Your response MUST be valid JSON only. Do not include any explanatory text, comments, or formatting outside the JSON array.

FORMAT YOUR RESPONSE AS A JSON ARRAY with exactly this structure:
[
  {
    "id": "${category}_${finalGender}_${normalizedBodyType}_1",
    "title": "${finalGender.toUpperCase()}'s Specific ${category} Outfit Name",
    "description": "Brief description focusing on ${category} appropriateness for ${finalGender.toUpperCase()}",
    "items": ["${category}-specific ${finalGender.toUpperCase()} item1", "${category}-specific ${finalGender.toUpperCase()} item2", "${finalGender.toUpperCase()} item3", "${finalGender.toUpperCase()} item4"],
    "occasion": "${category} specific occasion for ${finalGender.toUpperCase()}",
    "season": "best season for this ${category} outfit",
    "colors": ["color1 for ${skinTone} skin", "color2", "color3"],
    "price_range": "budget/mid-range/premium",
    "style_tips": ["${category}-specific tip for ${finalGender.toUpperCase()}", "tip for ${normalizedBodyType} ${finalGender.toUpperCase()} body", "tip for ${heightCategory} ${finalGender.toUpperCase()}"],
    "image_description": "detailed description of how this ${category} outfit would look on a ${normalizedBodyType} ${finalGender.toUpperCase()}"
  }
]

Examples for ${finalGender} context:
${finalGender === 'male' ? `
- If category is "gym-wear": Include men's athletic wear, tank tops, shorts, athletic shoes, sports watch
- If category is "formal-wear": Include men's suits, dress shirts, ties, formal shoes, cufflinks
- If category is "street-style": Include men's casual wear, sneakers, jeans, hoodies, caps
- If category is "ethnic-wear": Include traditional men's clothing like kurta, dhoti, sherwani
` : `
- If category is "gym-wear": Include women's activewear, sports bras, leggings, athletic shoes, fitness tracker
- If category is "formal-wear": Include women's blazers, blouses, dress pants/skirts, heels, professional accessories
- If category is "street-style": Include women's casual wear, sneakers, jeans, tops, bags
- If category is "ethnic-wear": Include traditional women's clothing like saree, lehenga, kurti
`}

Make sure each outfit is unique, practical, and specifically suited for ${category} activities/occasions for ${finalGender.toUpperCase()}.

🔥 FINAL REMINDER: You are creating outfits for a ${finalGender.toUpperCase()} person. Every single item, accessory, and styling tip must be appropriate for ${finalGender.toUpperCase()} gender. Double-check each suggestion before including it.
`;
};

const extractGenderFromCategory = (category: string): string | null => {
  const categoryLower = category.toLowerCase();

  if (categoryLower.includes('male-') || categoryLower.startsWith('male')) {
    return 'male';
  }

  if (categoryLower.includes('female-') || categoryLower.startsWith('female')) {
    return 'female';
  }

  return null;
};

const getCategoryContext = (category: string): string => {
  const categoryLower = category.toLowerCase();

  const contexts: { [key: string]: string } = {
    'gym': 'Athletic wear for workouts, sports activities, and fitness routines. Focus on breathable, flexible, moisture-wicking fabrics.',
    'gym-wear': 'Athletic wear for workouts, sports activities, and fitness routines. Focus on breathable, flexible, moisture-wicking fabrics.',
    'formal': 'Professional and formal occasions like business meetings, interviews, formal events, and corporate settings.',
    'formal-wear': 'Professional and formal occasions like business meetings, interviews, formal events, and corporate settings.',
    'street': 'Urban casual fashion for everyday wear, social outings, and trendy casual occasions.',
    'street-style': 'Urban casual fashion for everyday wear, social outings, and trendy casual occasions.',
    'ethnic': 'Traditional and cultural clothing for festivals, cultural events, and traditional occasions.',
    'ethnic-wear': 'Traditional and cultural clothing for festivals, cultural events, and traditional occasions.',
    'party': 'Festive and celebratory outfits for parties, celebrations, and social gatherings.',
    'party-wear': 'Festive and celebratory outfits for parties, celebrations, and social gatherings.',
    'office': 'Professional workplace attire that is comfortable for daily office work.',
    'office-wear': 'Professional workplace attire that is comfortable for daily office work.',
    'elegant': 'Sophisticated and refined clothing for upscale events and elegant occasions.',
    'elegant-wear': 'Sophisticated and refined clothing for upscale events and elegant occasions.',
    'date': 'Romantic and attractive outfits perfect for dates and special occasions with a partner.',
    'date-night': 'Romantic and attractive outfits perfect for dates and special occasions with a partner.',
    'old-money': 'Timeless, sophisticated, and understated luxury fashion with classic elegance.',
  };

  // Check for partial matches
  for (const [key, context] of Object.entries(contexts)) {
    if (categoryLower.includes(key)) {
      return context;
    }
  }

  return `Clothing appropriate for ${category} occasions and activities.`;
};

const normalizeBodyType = (bodyType: string): string => {
  if (!bodyType) return 'average build';
  const type = bodyType.toLowerCase();
  switch (type) {
    case 'slim':
    case 'thin':
    case 'skinny':
      return 'slim build';
    case 'athletic':
    case 'muscular':
    case 'fit':
      return 'athletic build';
    case 'heavy':
    case 'chubby':
    case 'plus':
      return 'fuller figure';
    case 'obese':
      return 'plus size';
    default:
      return 'average build';
  }
};

const normalizeHeight = (height: string | number): string => {
  const num = Number(height);
  if (!isNaN(num)) {
    if (num < 165) return 'shorter stature';
    if (num <= 180) return 'average height';
    return 'tall stature';
  }
  return 'average height';
};

const generateOutfitLinks = async (
  outfit: OutfitSuggestion,
  userProfile: any,
  category: string
): Promise<{
  shopping: ShoppingLink[];
  reference: ReferenceLink[];
}> => {
  try {
    // ALWAYS prioritize user profile gender over category
    let finalGender = userProfile?.gender?.toLowerCase() || 'male';

    // Ensure gender is valid
    if (finalGender !== 'male' && finalGender !== 'female') {
      console.warn('⚠️ Invalid gender in link generation, defaulting to male:', finalGender);
      finalGender = 'male';
    }

    // FINAL VALIDATION: Ensure we have the right gender for links
    console.log(`🎯 FINAL LINK GENDER: ${finalGender} (will generate ${finalGender === 'male' ? 'men' : 'women'}'s links)`);

    const genderTerm = finalGender === 'male' ? 'men' : 'women';

    // Create gender-specific search queries
    const mainQuery = `${genderTerm} ${outfit.title} ${outfit.items.join(' ')}`;
    const colorQuery = `${genderTerm} ${outfit.colors.join(' ')} ${outfit.title}`;
    const occasionQuery = `${genderTerm} ${outfit.occasion} ${outfit.title} outfit`;
    const categoryQuery = `${genderTerm} ${category.replace('male-', '').replace('female-', '')} outfit`;

    console.log('🔗 Generating gender-specific links for:', {
      category,
      userProfileGender: userProfile?.gender,
      finalGender,
      genderTerm,
      mainQuery,
      categoryQuery
    });

    // CRITICAL DEBUG: Log the actual shopping link descriptions
    console.log('🛍️ SHOPPING LINK DESCRIPTIONS WILL BE:', {
      amazon: `Shop similar ${genderTerm}'s items on Amazon`,
      pinterest: `Find ${genderTerm}'s outfit inspiration`,
      googleShopping: `Compare prices for ${genderTerm}'s items`
    });

    const shopping: ShoppingLink[] = [
      {
        platform: "Amazon",
        url: `https://www.amazon.com/s?k=${encodeURIComponent(mainQuery)}&ref=nb_sb_noss`,
        description: `Shop similar ${genderTerm}'s items on Amazon`,
        icon: "bag"
      },
      {
        platform: "Myntra",
        url: `https://www.myntra.com/search/${encodeURIComponent(mainQuery)}`,
        description: `Shop similar ${genderTerm}'s items on Myntra`,
        icon: "bag"
      },
      {
        platform: "Pinterest",
        url: `https://www.pinterest.com/search/pins/?q=${encodeURIComponent(mainQuery + ' outfit')}`,
        description: `Find ${genderTerm}'s outfit inspiration`,
        icon: "camera"
      },
      {
        platform: "Google Shopping",
        url: `https://www.google.com/search?tbm=shop&q=${encodeURIComponent(mainQuery)}`,
        description: `Compare prices for ${genderTerm}'s items`,
        icon: "pricetag"
      }
    ];

    const reference: ReferenceLink[] = [
      {
        platform: "Style Guide",
        url: `https://www.google.com/search?q=${encodeURIComponent(occasionQuery + ' style guide')}`,
        description: `Learn ${genderTerm}'s styling tips`,
        icon: "book"
      },
      {
        platform: "Color Matching",
        url: `https://www.google.com/search?q=${encodeURIComponent(colorQuery + ' color combination fashion')}`,
        description: `${genderTerm}'s color coordination ideas`,
        icon: "color-palette"
      },
      {
        platform: "Outfit Ideas",
        url: `https://www.google.com/search?tbm=isch&q=${encodeURIComponent(categoryQuery + ' ideas')}`,
        description: `Visual ${genderTerm}'s outfit references`,
        icon: "images"
      }
    ];

    return { shopping, reference };
  } catch (error) {
    console.error('Error generating outfit links:', error);
    return { shopping: [], reference: [] };
  }
};