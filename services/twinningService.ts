import { analyzeBodyImage, analyzePersonComprehensively, generateOutfitsFromPrompt } from './geminiService';

export interface PersonAnalysis {
  name: string;
  skinTone: string;
  bodyType: string;
  height: 'tall' | 'medium' | 'short';
  style: string;
  personalityTraits: string[];
  colorPreferences: string[];
  physicalFeatures: string[];
}


export interface PlaceAnalysis {
  venue: string;
  atmosphere: string;
  dressCode: string;
  weatherConsiderations: string;
  timeOfDay: string;
  occasion: string;
}

export interface TwinningAnalysis {
  person1: PersonAnalysis;
  person2: PersonAnalysis;
  place: PlaceAnalysis;
  relationship: {
    dynamic: string;
    compatibility: string;
    contrast: string;
    recommendations: string[];
  };
  outfitSuggestions: {
    person1: OutfitSuggestion[];
    person2: OutfitSuggestion[];
    coordination: CoordinationTips;
  };
}

export interface OutfitSuggestion {
  category: string;
  items: string[];
  colors: string[];
  accessories: string[];
  styling_tips: string[];
  why_this_works: string;
  shopping_links: Array<{
    platform: string;
    search_term: string;
    url: string;
    icon: string;
  }>;
}

export interface CoordinationTips {
  color_harmony: string[];
  style_balance: string[];
  proportion_tips: string[];
  accessory_coordination: string[];
  overall_theme: string;
}

export const analyzeTwinningPhotos = async (
  photos: {
    person1: string; // base64 image
    person2: string; // base64 image
    together?: string; // base64 image
    place: string; // base64 image
  },
  names: {
    person1: string;
    person2: string;
  },
  category: string,
  occasion?: string,
  context?: any
): Promise<TwinningAnalysis> => {
  console.log('🎯 Starting comprehensive twinning analysis for your perfect coordination...');

  try {
    // Validate input parameters
    if (!photos.person1 || !photos.person2 || !photos.place) {
      throw new Error('Missing required photos for analysis');
    }
    
    if (!names.person1 || !names.person2) {
      throw new Error('Missing required names for analysis');
    }

    // STEP 1: Analyze Person 1 - Get from user profile (no gender detection needed)
    console.log(`👤 Analyzing ${names.person1 || 'first person'}'s style and body type...`);
    const person1Analysis = await analyzeIndividualPerson(photos.person1, names.person1, null);

    // STEP 2: Analyze Person 2 - Use provided gender from UI toggle
    console.log(`👤 Scanning ${names.person2 || 'second person'}'s vibe and energy...`);
    console.log(`🎯 FRIEND GENDER FROM UI: ${context?.friendGender || 'not provided'}`);
    const person2Analysis = await analyzeIndividualPerson(photos.person2, names.person2, context?.friendGender);
    
    // CRITICAL DEBUG: Log friend's analysis results
    console.log('🔍 FRIEND ANALYSIS RESULTS:', {
      name: person2Analysis.name,
      gender: person2Analysis.gender,
      bodyType: person2Analysis.bodyType,
      skinTone: person2Analysis.skinTone,
      style: person2Analysis.style,
      confidence: person2Analysis.confidence
    });

    // STEP 3: Analyze Group Photo - Understand their dynamic and relationship
    console.log('👥 Understanding your dynamic and chemistry together...');
    const groupAnalysis = await analyzeGroupPhoto(photos.together, names, person1Analysis, person2Analysis);

    // STEP 4: Analyze Place/Setting - Extract venue details, atmosphere, colors
    console.log(`🏛️ Analyzing the ${category || 'venue'} setting and atmosphere...`);
    const placeAnalysis = await analyzeVenueFromPhoto(photos.place, category, context);

    // STEP 5: Create comprehensive prompt with all analyzed data
    console.log('🧠 Processing all data to create personalized recommendations...');
    const comprehensivePrompt = createComprehensiveTwinningPrompt(
      person1Analysis,
      person2Analysis,
      groupAnalysis,
      placeAnalysis,
      names,
      category,
      occasion,
      context
    );

    // STEP 6: Get AI recommendations using the best model efficiently
    console.log('✨ Generating your perfect coordinated outfits...');
    const aiRecommendations = await getAIFashionRecommendations(comprehensivePrompt);

    // STEP 7: Combine all data into final analysis
    console.log('🎨 Finalizing your personalized style recommendations...');
    const finalAnalysis = combineAnalysisData(
      person1Analysis,
      person2Analysis,
      groupAnalysis,
      placeAnalysis,
      aiRecommendations,
      names,
      category,
      context
    );

    console.log('🎉 Your perfect twinning analysis is ready!');
    return finalAnalysis;

  } catch (error) {
    console.error('❌ Analysis encountered an issue, creating backup recommendations...');
    console.error('Error details:', error);
    // Fallback to simplified analysis
    return await fallbackTwinningAnalysis(photos, names, category, context);
  }
};

// STEP 1: Comprehensive Individual Person Analysis
const analyzeIndividualPerson = async (photoUri: string, name: string, providedGender?: 'male' | 'female' | null): Promise<{
  name: string;
  gender: 'male' | 'female';
  bodyType: string;
  skinTone: string;
  style: string;
  traits: string[];
  physicalFeatures: string[];
  confidence: number;
  detailedAnalysis: string;
}> => {
  console.log(`🔍 Deep-diving into ${name || 'this person'}'s unique style profile...`);

  try {
    // Use the best model (gemini-1.5-flash) for comprehensive analysis with retry logic
    console.log(`📸 Processing ${name || 'the'} photo with advanced AI analysis...`);
    let comprehensiveAnalysis = '';
    let retryCount = 0;
    const maxRetries = 2;

    while (retryCount <= maxRetries) {
      try {
        comprehensiveAnalysis = await analyzePersonComprehensively(photoUri, name || 'Person');
        
            // Check if we got a real analysis or an error response
    if (comprehensiveAnalysis && 
        !comprehensiveAnalysis.includes('Analysis temporarily unavailable') && 
        !comprehensiveAnalysis.includes('high system demand') &&
        !comprehensiveAnalysis.includes('Rate limit') &&
        comprehensiveAnalysis.includes('Gender:')) {
      console.log(`✅ Got valid AI analysis on attempt ${retryCount + 1}`);
      break;
    } else if (retryCount < maxRetries) {
      console.log(`⚠️ Got fallback response on attempt ${retryCount + 1}, retrying...`);
      await new Promise(resolve => setTimeout(resolve, 2000)); // Wait 2 seconds
      retryCount++;
    } else {
      console.warn(`❌ All ${maxRetries + 1} attempts failed, using fallback`);
    }
      } catch (error) {
        if (retryCount < maxRetries) {
          console.log(`⚠️ Analysis failed on attempt ${retryCount + 1}, retrying...`);
          await new Promise(resolve => setTimeout(resolve, 2000));
          retryCount++;
        } else {
          throw error;
        }
      }
    }

    // Extract all information from the comprehensive analysis
    console.log(`🎯 Identifying ${name || 'their'} key characteristics and style preferences...`);
    
    // Ensure comprehensiveAnalysis is a string
    if (!comprehensiveAnalysis || typeof comprehensiveAnalysis !== 'string') {
      console.warn('⚠️ No analysis data received, using fallback analysis');
      comprehensiveAnalysis = 'Gender: unknown\nBody Type: Rectangle\nSkin Tone: Fair\nPhysical Features: Unable to analyze\nStyle: Analysis unavailable\nTraits: stylish, confident, modern\nConfidence: 0';
    }
    
    const gender = providedGender || extractGenderFromAnalysis(comprehensiveAnalysis) || analyzePersonFromName(name || 'Person').gender;
    const bodyType = extractBodyTypeFromAnalysis(comprehensiveAnalysis, gender);
    const skinTone = extractSkinToneFromAnalysis(comprehensiveAnalysis);
    const physicalFeatures = extractPhysicalFeatures(comprehensiveAnalysis);
    const style = extractStyleFromAnalysis(comprehensiveAnalysis, gender);
    const traits = extractTraitsFromAnalysis(comprehensiveAnalysis);
    const confidence = extractConfidenceFromAnalysis(comprehensiveAnalysis);

    console.log(`✅ Successfully analyzed ${name || 'person'} - ${bodyType || 'Average'} ${gender || 'person'} with ${skinTone || 'Fair'} skin tone`);
    console.log('🔍 Raw Analysis Data:', comprehensiveAnalysis.substring(0, 300) + '...'); // Debug log
    
    // CRITICAL DEBUG: Check if we're getting actual analysis or fallback
    if (comprehensiveAnalysis && (comprehensiveAnalysis.includes('Analysis temporarily unavailable') || 
        comprehensiveAnalysis.includes('high system demand') ||
        comprehensiveAnalysis.includes('Rate limit'))) {
      console.warn('⚠️ AI ANALYSIS FAILED - Using fallback data instead of real analysis!');
      console.warn('🔄 This means outfit recommendations will be generated');
    } else {
      console.log('✅ REAL AI ANALYSIS SUCCESS - Personalized recommendations will be generated');
    }

    // Ensure all required fields have valid values
    const finalAnalysis = {
      name: name || 'Person',
      gender: gender || 'male',
      bodyType: bodyType || 'Average',
      skinTone: skinTone || 'Fair',
      style: style || 'Modern and stylish',
      traits: traits && traits.length > 0 ? traits : ['Confident', 'Stylish', 'Modern'],
      physicalFeatures: physicalFeatures && physicalFeatures.length > 0 ? physicalFeatures : ['Natural features', 'Good proportions'],
      confidence: confidence || 75,
      detailedAnalysis: comprehensiveAnalysis || 'Analysis completed with fallback data'
    };

    console.log('✅ Final analysis result:', finalAnalysis);
    return finalAnalysis;

  } catch (error) {
    console.log(`⚠️ Switching to backup analysis for ${name || 'this person'}...`);
    console.error('Analysis error details:', error);
    return getFallbackPersonAnalysis(name || 'Person');
  }
};

// STEP 2: Group Photo Analysis
const analyzeGroupPhoto = async (
  groupPhotoUri: string | undefined,
  names: { person1: string; person2: string },
  person1Data: any,
  person2Data: any
): Promise<{
  dynamic: string;
  chemistry: string;
  coordinationStyle: string;
  visualHarmony: string;
  recommendations: string[];
}> => {
  if (!groupPhotoUri) {
    return {
      dynamic: `${person1Data.style || 'Personal'} and ${person2Data.style || 'individual'} styles complement each other`,
      chemistry: 'Natural coordination between different personalities',
      coordinationStyle: 'Balanced and harmonious',
      visualHarmony: 'Complementary body types and skin tones',
      recommendations: ['Focus on color coordination', 'Balance different styles', 'Maintain individual identity']
    };
  }

  console.log(`👥 Studying how ${names.person1 || 'you'} and ${names.person2 || 'your partner'} look together...`);

  try {
    const groupAnalysis = await analyzeBodyImage(groupPhotoUri, `
      Analyze this photo of ${names.person1} and ${names.person2} together. Focus on:
      1. Their visual chemistry and how they look together
      2. Body language and comfort level
      3. How their styles currently complement or clash
      4. Overall visual harmony
      5. Suggestions for better coordination
      6. Their relationship dynamic (friends, couple, family, etc.)
      
      Person 1 (${names.person1}): ${person1Data.bodyType || 'Average'} body type, ${person1Data.skinTone || 'Fair'} skin tone
      Person 2 (${names.person2}): ${person2Data.bodyType || 'Average'} body type, ${person2Data.skinTone || 'Fair'} skin tone
      
      Provide insights for fashion coordination.
    `);

    return {
      dynamic: extractDynamicFromAnalysis(groupAnalysis),
      chemistry: extractChemistryFromAnalysis(groupAnalysis),
      coordinationStyle: extractCoordinationStyle(groupAnalysis),
      visualHarmony: extractVisualHarmony(groupAnalysis),
      recommendations: extractGroupRecommendations(groupAnalysis)
    };

  } catch (error) {
    console.log('⚠️ Creating coordination recommendations based on individual styles...');
    return {
      dynamic: 'Complementary personalities with great potential',
      chemistry: 'Natural coordination and balance',
      coordinationStyle: 'Harmonious and balanced approach',
      visualHarmony: 'Perfect pairing with individual flair',
      recommendations: ['Focus on color coordination', 'Balance different styles beautifully', 'Maintain your unique identities']
    };
  }
};

// STEP 3: Comprehensive Venue Analysis
const analyzeVenueFromPhoto = async (
  placePhotoUri: string,
  category: string,
  context?: any
): Promise<{
  venue: string;
  atmosphere: string;
  lighting: string;
  dominantColors: string[];
  style: string;
  dressCode: string;
  ambiance: string;
  recommendations: string[];
  detailedDescription: string;
}> => {
  console.log(`🏛️ Examining the ${category || 'venue'} to match your outfits perfectly...`);

  try {
    console.log('🔍 Starting venue analysis with advanced AI...');

    // Use the comprehensive venue analysis function
    const venueAnalysis = await analyzeBodyImage(placePhotoUri, `
      Analyze this venue/location photo for fashion coordination purposes. This is for a ${category || 'casual'} occasion.

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
    `);

    console.log('🏛️ Raw Venue Analysis:', venueAnalysis.substring(0, 200) + '...'); // Debug log

    return {
      venue: extractVenueType(venueAnalysis),
      atmosphere: extractAtmosphere(venueAnalysis),
      lighting: extractLighting(venueAnalysis),
      dominantColors: extractDominantColors(venueAnalysis),
      style: extractVenueStyle(venueAnalysis),
      dressCode: extractDressCode(venueAnalysis, category || 'casual'),
      ambiance: extractAmbiance(venueAnalysis),
      recommendations: extractVenueRecommendations(venueAnalysis),
      detailedDescription: venueAnalysis
    };

  } catch (error) {
    console.log(`⚠️ Creating venue recommendations based on ${category || 'the occasion'} context...`);
    return getFallbackVenueAnalysis(category || 'casual', context);
  }
};



// Helper functions for photo analysis
// These functions are now replaced by the new extraction functions above

const inferPhysicalFeatures = (bodyAnalysis: any): string[] => {
  const features = [`${bodyAnalysis?.bodyType || 'Natural'} build`];

  if (bodyAnalysis?.confidence && bodyAnalysis.confidence > 80) {
    features.push('Clear photo quality', 'Well-defined features');
  } else {
    features.push('Confident posture', 'Natural features');
  }

  return features;
};

const inferSkinToneFromBodyType = (bodyType: string): string => {
  // This is a fallback function since we don't have skin tone from body type analysis
  // In a real implementation, you might want to use a separate skin tone analysis
  const skinToneOptions = ['Fair', 'Wheatish', 'Dusky', 'Dark'];

  // For now, return a default that works well with most body types
  return 'Medium';
};

const inferLightingFromColors = (colors: string[]): string => {
  if (!colors || colors.length === 0) return 'Natural lighting';

  const warmColors = ['yellow', 'orange', 'red', 'gold', 'warm'];
  const coolColors = ['blue', 'green', 'purple', 'cool', 'silver'];

  const hasWarm = colors.some(color => warmColors.some(warm => color.toLowerCase().includes(warm)));
  const hasCool = colors.some(color => coolColors.some(cool => color.toLowerCase().includes(cool)));

  if (hasWarm && !hasCool) return 'Warm ambient lighting';
  if (hasCool && !hasWarm) return 'Cool natural lighting';
  return 'Balanced natural lighting';
};

const inferVenueStyle = (venue: string, ambiance: string): string => {
  const venueStr = (venue + ' ' + ambiance).toLowerCase();

  if (venueStr.includes('modern') || venueStr.includes('contemporary')) return 'Modern';
  if (venueStr.includes('classic') || venueStr.includes('traditional')) return 'Classic';
  if (venueStr.includes('rustic') || venueStr.includes('natural')) return 'Rustic';
  if (venueStr.includes('elegant') || venueStr.includes('sophisticated')) return 'Elegant';
  if (venueStr.includes('casual') || venueStr.includes('relaxed')) return 'Casual';

  return 'Contemporary';
};

const analyzePersonFromName = (name: string): { gender: 'male' | 'female', traits: string[] } => {
  const detectGender = (name: string): 'male' | 'female' => {
    const lowerName = name.toLowerCase().trim();

    const maleNames = [
      'aditya', 'suraj', 'rahul', 'amit', 'raj', 'arjun', 'dev', 'karan', 'rohan', 'vikash', 'aman', 'ravi', 'ajay', 'deepak', 'sanjay', 'abhishek', 'akash', 'ankit', 'ashish', 'gaurav', 'harsh', 'manish', 'nikhil', 'pradeep', 'sachin', 'shubham', 'varun', 'vishal', 'yash',
      'john', 'mike', 'david', 'alex', 'chris', 'james', 'robert', 'william', 'michael', 'daniel', 'matthew', 'andrew', 'joshua', 'ryan', 'brandon', 'jason', 'justin', 'kevin', 'thomas', 'anthony', 'mark', 'donald', 'steven', 'paul', 'kenneth', 'brian'
    ];

    const femaleNames = [
      'priya', 'anita', 'kavya', 'shreya', 'pooja', 'neha', 'riya', 'sara', 'meera', 'divya', 'anjali', 'sunita', 'rekha', 'aditi', 'aishwarya', 'deepika', 'ishita', 'jyoti', 'komal', 'manisha', 'nisha', 'pallavi', 'preeti', 'rashmi', 'shweta', 'simran', 'sneha', 'swati', 'tanvi', 'varsha',
      'mary', 'sarah', 'jessica', 'emily', 'jennifer', 'lisa', 'michelle', 'amanda', 'stephanie', 'nicole', 'elizabeth', 'helen', 'sandra', 'donna', 'carol', 'ruth', 'sharon', 'laura', 'kimberly', 'deborah', 'dorothy', 'nancy', 'karen', 'betty'
    ];

    if (maleNames.includes(lowerName) || maleNames.some(n => lowerName.includes(n))) return 'male';
    if (femaleNames.includes(lowerName) || femaleNames.some(n => lowerName.includes(n))) return 'female';

    // Fallback based on name endings
    if (lowerName.endsWith('a') || lowerName.endsWith('i') || lowerName.endsWith('ya')) return 'female';
    if (lowerName.endsWith('sh') || lowerName.endsWith('an') || lowerName.endsWith('ar')) return 'male';

    return Math.random() > 0.5 ? 'male' : 'female';
  };

  const gender = detectGender(name);
  const traits = gender === 'male'
    ? ['confident', 'modern', 'practical']
    : ['elegant', 'stylish', 'graceful'];

  return { gender, traits };
};

// New function to create photo-based prompts
const createPhotoBasedTwinningPrompt = (
  person1Analysis: any,
  person2Analysis: any,
  placeAnalysis: any,
  names: { person1: string; person2: string },
  category: string,
  occasion?: string,
  context?: any
): string => {
  let contextDetails = '';

  if (context) {
    if (category === 'date') {
      contextDetails = `
DETAILED CONTEXT:
- Date Type: ${context.dateType || 'Not specified'}
- Venue: ${context.venue || 'Not specified'}
- Atmosphere: ${context.atmosphere || 'Not specified'}
- Duration: ${context.duration || 'Not specified'}
- Special Occasion: ${context.specialOccasion || 'None'}
- Style Preferences: ${context.stylePreferences || 'Not specified'}`;
    } else if (category === 'friends') {
      contextDetails = `
DETAILED CONTEXT:
- Hangout Type: ${context.hangoutType || 'Not specified'}
- Location: ${context.location || 'Not specified'}
- Vibe: ${context.vibe || 'Not specified'}
- Activities: ${context.activities || 'Not specified'}
- Group Dynamic: ${context.groupDynamic || 'Not specified'}
- Style Goals: ${context.styleGoals || 'Not specified'}`;
    } else if (category === 'wedding') {
      contextDetails = `
DETAILED CONTEXT:
- Ceremony Type: ${context.ceremonyType || 'Not specified'}
- Venue Style: ${context.venueStyle || 'Not specified'}
- Wedding Theme: ${context.weddingTheme || 'Not specified'}
- Season & Time: ${context.seasonTime || 'Not specified'}
- Formality Level: ${context.formalityLevel || 'Not specified'}
- Cultural Elements: ${context.culturalElements || 'Not specified'}`;
    } else if (category === 'party') {
      contextDetails = `
DETAILED CONTEXT:
- Party Type: ${context.partyType || 'Not specified'}
- Venue: ${context.venue || 'Not specified'}
- Music Genre: ${context.musicGenre || 'Not specified'}
- Duration: ${context.duration || 'Not specified'}
- Dress Code: ${context.dressCode || 'Not specified'}
- Party Vibes: ${context.partyVibes || 'Not specified'}`;
    } else if (category === 'business') {
      contextDetails = `
DETAILED CONTEXT:
- Meeting Type: ${context.meetingType || 'Not specified'}
- Industry: ${context.industry || 'Not specified'}
- Client Type: ${context.clientType || 'Not specified'}
- Seasonality: ${context.seasonality || 'Not specified'}
- Company Dress Code: ${context.companyDressCode || 'Not specified'}
- Professional Goals: ${context.professionalGoals || 'Not specified'}`;
    } else if (category === 'casual') {
      contextDetails = `
DETAILED CONTEXT:
- Activity Type: ${context.activityType || 'Not specified'}
- Location: ${context.location || 'Not specified'}
- Weather: ${context.weather || 'Not specified'}
- Time of Day: ${context.timeOfDay || 'Not specified'}
- Comfort Level: ${context.comfortLevel || 'Not specified'}
- Personal Style: ${context.personalStyle || 'Not specified'}`;
    } else if (category === 'travel') {
      contextDetails = `
DETAILED CONTEXT:
- Destination: ${context.destination || 'Not specified'}
- Travel Type: ${context.travelType || 'Not specified'}
- Climate: ${context.climate || 'Not specified'}
- Activities: ${context.activities || 'Not specified'}
- Duration: ${context.duration || 'Not specified'}
- Travel Style: ${context.travelStyle || 'Not specified'}`;
    } else if (category === 'festival') {
      contextDetails = `
DETAILED CONTEXT:
- Festival Type: ${context.festivalType || 'Not specified'}
- Cultural Theme: ${context.culturalTheme || 'Not specified'}
- Traditional Elements: ${context.traditionalElements || 'Not specified'}
- Modern Fusion: ${context.modernFusion || 'Not specified'}
- Celebration Style: ${context.celebrationStyle || 'Not specified'}
- Regional Customs: ${context.regionalCustoms || 'Not specified'}`;
    } else if (category === 'workout') {
      contextDetails = `
DETAILED CONTEXT:
- Workout Type: ${context.workoutType || 'Not specified'}
- Fitness Goals: ${context.fitnessGoals || 'Not specified'}
- Exercise Intensity: ${context.exerciseIntensity || 'Not specified'}
- Gym Environment: ${context.gymEnvironment || 'Not specified'}
- Activity Duration: ${context.activityDuration || 'Not specified'}
- Performance Needs: ${context.performanceNeeds || 'Not specified'}`;
    } else if (category === 'brunch') {
      contextDetails = `
DETAILED CONTEXT:
- Brunch Type: ${context.brunchType || 'Not specified'}
- Venue Style: ${context.venueStyle || 'Not specified'}
- Time of Day: ${context.timeOfDay || 'Not specified'}
- Social Setting: ${context.socialSetting || 'Not specified'}
- Weather: ${context.weather || 'Not specified'}
- Brunch Vibe: ${context.brunchVibe || 'Not specified'}`;
    } else if (category === 'photoshoot') {
      contextDetails = `
DETAILED CONTEXT:
- Shoot Type: ${context.shootType || 'Not specified'}
- Photography Style: ${context.photographyStyle || 'Not specified'}
- Location Setting: ${context.locationSetting || 'Not specified'}
- Theme/Concept: ${context.themeConcept || 'Not specified'}
- Lighting Conditions: ${context.lightingConditions || 'Not specified'}
- Final Usage: ${context.finalUsage || 'Not specified'}`;
    } else if (category === 'anniversary') {
      contextDetails = `
DETAILED CONTEXT:
- Anniversary Type: ${context.anniversaryType || 'Not specified'}
- Milestone Year: ${context.milestoneYear || 'Not specified'}
- Celebration Style: ${context.celebrationStyle || 'Not specified'}
- Venue Type: ${context.venueType || 'Not specified'}
- Romantic Theme: ${context.romanticTheme || 'Not specified'}
- Special Significance: ${context.specialSignificance || 'Not specified'}`;
    }
  }

  return `You are an expert fashion stylist specializing in coordinated styling for ${category} occasions.

TASK: Create personalized outfit recommendations for ${names.person1} and ${names.person2} based on REAL PHOTO ANALYSIS.

PERSON 1 ANALYSIS (${names.person1}):
- Gender: ${person1Analysis.gender}
- Body Type: ${person1Analysis.bodyType}
- Skin Tone: ${person1Analysis.skinTone}
- Style: ${person1Analysis.style}
- Traits: ${person1Analysis.traits.join(', ')}
- Physical Features: ${person1Analysis.physicalFeatures.join(', ')}

PERSON 2 ANALYSIS (${names.person2}):
- Gender: ${person2Analysis.gender}
- Body Type: ${person2Analysis.bodyType}
- Skin Tone: ${person2Analysis.skinTone}
- Style: ${person2Analysis.style}
- Traits: ${person2Analysis.traits.join(', ')}
- Physical Features: ${person2Analysis.physicalFeatures.join(', ')}

VENUE/PLACE ANALYSIS:
- Venue Type: ${placeAnalysis.venue}
- Atmosphere: ${placeAnalysis.atmosphere}
- Lighting: ${placeAnalysis.lighting}
- Dominant Colors: ${placeAnalysis.colors.join(', ')}
- Style: ${placeAnalysis.style}

${contextDetails}

REQUIREMENTS:
1. Use the REAL photo analysis data to create personalized recommendations
2. Consider each person's actual body type and skin tone from photo analysis
3. Match outfits to the actual venue colors and atmosphere analyzed from photos
4. Create 2-3 coordinated outfit options that work well together
5. Provide specific styling tips based on their real physical characteristics
6. Keep recommendations practical and achievable

Focus on creating outfits that:
- Complement each person's actual analyzed skin tone and body type
- Coordinate with the venue's actual analyzed colors and atmosphere
- Match the occasion and activities described
- Work harmoniously together without being too matchy
- Respect any cultural or formality requirements

Provide practical, specific recommendations with clear reasoning based on the REAL photo analysis data.`;
};

const createEnhancedTwinningPrompt = (
  names: { person1: string; person2: string },
  category: string,
  occasion?: string,
  context?: any
): string => {
  let contextDetails = '';

  if (context) {
    if (category === 'date') {
      contextDetails = `
DETAILED CONTEXT:
- Date Type: ${context.dateType || 'Not specified'}
- Venue: ${context.venue || 'Not specified'}
- Atmosphere: ${context.atmosphere || 'Not specified'}
- Duration: ${context.duration || 'Not specified'}
- Special Occasion: ${context.specialOccasion || 'None'}
- Style Preferences: ${context.stylePreferences || 'Not specified'}`;
    } else if (category === 'friends') {
      contextDetails = `
DETAILED CONTEXT:
- Hangout Type: ${context.hangoutType || 'Not specified'}
- Location: ${context.location || 'Not specified'}
- Vibe: ${context.vibe || 'Not specified'}
- Activities: ${context.activities || 'Not specified'}
- Group Dynamic: ${context.groupDynamic || 'Not specified'}
- Style Goals: ${context.styleGoals || 'Not specified'}`;
    } else if (category === 'wedding') {
      contextDetails = `
DETAILED CONTEXT:
- Ceremony Type: ${context.ceremonyType || 'Not specified'}
- Venue Style: ${context.venueStyle || 'Not specified'}
- Wedding Theme: ${context.weddingTheme || 'Not specified'}
- Season & Time: ${context.seasonTime || 'Not specified'}
- Formality Level: ${context.formalityLevel || 'Not specified'}
- Cultural Elements: ${context.culturalElements || 'Not specified'}`;
    } else if (category === 'party') {
      contextDetails = `
DETAILED CONTEXT:
- Party Type: ${context.partyType || 'Not specified'}
- Venue: ${context.venue || 'Not specified'}
- Music Genre: ${context.musicGenre || 'Not specified'}
- Duration: ${context.duration || 'Not specified'}
- Dress Code: ${context.dressCode || 'Not specified'}
- Party Vibes: ${context.partyVibes || 'Not specified'}`;
    } else if (category === 'business') {
      contextDetails = `
DETAILED CONTEXT:
- Meeting Type: ${context.meetingType || 'Not specified'}
- Industry: ${context.industry || 'Not specified'}
- Client Type: ${context.clientType || 'Not specified'}
- Seasonality: ${context.seasonality || 'Not specified'}
- Company Dress Code: ${context.companyDressCode || 'Not specified'}
- Professional Goals: ${context.professionalGoals || 'Not specified'}`;
    } else if (category === 'casual') {
      contextDetails = `
DETAILED CONTEXT:
- Activity Type: ${context.activityType || 'Not specified'}
- Location: ${context.location || 'Not specified'}
- Weather: ${context.weather || 'Not specified'}
- Time of Day: ${context.timeOfDay || 'Not specified'}
- Comfort Level: ${context.comfortLevel || 'Not specified'}
- Personal Style: ${context.personalStyle || 'Not specified'}`;
    } else if (category === 'travel') {
      contextDetails = `
DETAILED CONTEXT:
- Destination: ${context.destination || 'Not specified'}
- Travel Type: ${context.travelType || 'Not specified'}
- Climate: ${context.climate || 'Not specified'}
- Activities: ${context.activities || 'Not specified'}
- Duration: ${context.duration || 'Not specified'}
- Travel Style: ${context.travelStyle || 'Not specified'}`;
    } else if (category === 'festival') {
      contextDetails = `
DETAILED CONTEXT:
- Festival Type: ${context.festivalType || 'Not specified'}
- Cultural Theme: ${context.culturalTheme || 'Not specified'}
- Traditional Elements: ${context.traditionalElements || 'Not specified'}
- Modern Fusion: ${context.modernFusion || 'Not specified'}
- Celebration Style: ${context.celebrationStyle || 'Not specified'}
- Regional Customs: ${context.regionalCustoms || 'Not specified'}`;
    } else if (category === 'workout') {
      contextDetails = `
DETAILED CONTEXT:
- Workout Type: ${context.workoutType || 'Not specified'}
- Fitness Goals: ${context.fitnessGoals || 'Not specified'}
- Exercise Intensity: ${context.exerciseIntensity || 'Not specified'}
- Gym Environment: ${context.gymEnvironment || 'Not specified'}
- Activity Duration: ${context.activityDuration || 'Not specified'}
- Performance Needs: ${context.performanceNeeds || 'Not specified'}`;
    } else if (category === 'brunch') {
      contextDetails = `
DETAILED CONTEXT:
- Brunch Type: ${context.brunchType || 'Not specified'}
- Venue Style: ${context.venueStyle || 'Not specified'}
- Time of Day: ${context.timeOfDay || 'Not specified'}
- Social Setting: ${context.socialSetting || 'Not specified'}
- Weather: ${context.weather || 'Not specified'}
- Brunch Vibe: ${context.brunchVibe || 'Not specified'}`;
    } else if (category === 'photoshoot') {
      contextDetails = `
DETAILED CONTEXT:
- Shoot Type: ${context.shootType || 'Not specified'}
- Photography Style: ${context.photographyStyle || 'Not specified'}
- Location Setting: ${context.locationSetting || 'Not specified'}
- Theme/Concept: ${context.themeConcept || 'Not specified'}
- Lighting Conditions: ${context.lightingConditions || 'Not specified'}
- Final Usage: ${context.finalUsage || 'Not specified'}`;
    } else if (category === 'anniversary') {
      contextDetails = `
DETAILED CONTEXT:
- Anniversary Type: ${context.anniversaryType || 'Not specified'}
- Milestone Year: ${context.milestoneYear || 'Not specified'}
- Celebration Style: ${context.celebrationStyle || 'Not specified'}
- Venue Type: ${context.venueType || 'Not specified'}
- Romantic Theme: ${context.romanticTheme || 'Not specified'}
- Special Significance: ${context.specialSignificance || 'Not specified'}`;
    }
  }

  return `You are an expert fashion stylist specializing in coordinated styling for ${category} occasions.

TASK: Create personalized outfit recommendations for ${names.person1} and ${names.person2}.

${contextDetails}

REQUIREMENTS:
1. Analyze the context to understand the occasion, venue, and style needs
2. Consider gender-appropriate styling for each person based on their names
3. Create 2-3 coordinated outfit options that work well together
4. Provide specific styling tips and reasoning
5. Keep recommendations practical and achievable

Focus on creating outfits that:
- Match the venue and occasion described
- Coordinate well together without being too matchy
- Suit the atmosphere and activities mentioned
- Respect any cultural or formality requirements

Provide practical, specific recommendations with clear reasoning for each choice.`;
};

const parseGeminiTwinningResponse = (
  response: any,
  names: { person1: string; person2: string },
  category: string,
  context?: any,
  person1Analysis?: any,
  person2Analysis?: any,
  placeAnalysis?: any
): TwinningAnalysis => {
  // Extract useful information from Gemini response
  const geminiInsights = response.recommendations?.[0]?.reasoning || '';
  const geminiOutfit = response.recommendations?.[0]?.outfit || '';

  // If we have photo analysis, use it; otherwise fall back to name-based
  if (person1Analysis && person2Analysis && placeAnalysis) {
    return getPhotoBasedMockAnalysis(
      person1Analysis,
      person2Analysis,
      placeAnalysis,
      names,
      category,
      context,
      geminiInsights,
      geminiOutfit
    );
  } else {
    return getMockTwinningAnalysis(names, category, context, geminiInsights, geminiOutfit);
  }
};

// New function that uses real photo analysis data
const getPhotoBasedMockAnalysis = (
  person1Analysis: any,
  person2Analysis: any,
  placeAnalysis: any,
  names: { person1: string; person2: string },
  category: string,
  context?: any,
  geminiInsights?: string,
  geminiOutfit?: string
): TwinningAnalysis => {
  return {
    person1: {
      name: person1Analysis.name,
      skinTone: person1Analysis.skinTone,
      bodyType: person1Analysis.bodyType,
      height: "medium" as const,
      style: person1Analysis.style,
      personalityTraits: person1Analysis.traits,
      colorPreferences: getColorsForSkinTone(person1Analysis.skinTone),
      physicalFeatures: person1Analysis.physicalFeatures
    },
    person2: {
      name: person2Analysis.name,
      skinTone: person2Analysis.skinTone,
      bodyType: person2Analysis.bodyType,
      height: "medium" as const,
      style: person2Analysis.style,
      personalityTraits: person2Analysis.traits,
      colorPreferences: getColorsForSkinTone(person2Analysis.skinTone),
      physicalFeatures: person2Analysis.physicalFeatures
    },
    place: {
      venue: placeAnalysis.venue,
      atmosphere: placeAnalysis.atmosphere,
      dressCode: inferDressCodeFromVenue(placeAnalysis.venue, category),
      weatherConsiderations: placeAnalysis.lighting,
      timeOfDay: context?.duration || context?.timeOfDay || "Evening",
      occasion: context?.dateType || context?.hangoutType || context?.ceremonyType || category
    },
    relationship: {
      dynamic: geminiInsights ||
        `Perfect coordination between ${person1Analysis.style} and ${person2Analysis.style} styles`,
      compatibility: `${person1Analysis.bodyType} and ${person2Analysis.bodyType} builds complement each other beautifully`,
      contrast: `${person1Analysis.skinTone} and ${person2Analysis.skinTone} skin tones create harmonious balance`,
      recommendations: [
        `Leverage ${placeAnalysis.colors.join(' and ')} colors from the venue`,
        `Balance ${person1Analysis.traits[0]} and ${person2Analysis.traits[0]} personalities`,
        `Coordinate with the ${placeAnalysis.atmosphere} atmosphere`
      ]
    },
    outfitSuggestions: {
      person1: createOutfitSuggestions(person1Analysis, placeAnalysis, category, context, geminiOutfit),
      person2: createOutfitSuggestions(person2Analysis, placeAnalysis, category, context, geminiOutfit),
      coordination: {
        color_harmony: [
          `Use ${placeAnalysis.colors[0]} as a connecting color between both outfits`,
          `${person1Analysis.skinTone} and ${person2Analysis.skinTone} skin tones work well with ${placeAnalysis.colors.join(', ')} palette`
        ],
        style_balance: [
          `Balance ${person1Analysis.bodyType} and ${person2Analysis.bodyType} silhouettes`,
          `Coordinate ${person1Analysis.style} with ${person2Analysis.style} approaches`
        ],
        proportion_tips: [
          `Consider the ${placeAnalysis.lighting} lighting for fabric choices`,
          `Match formality to the ${placeAnalysis.venue} setting`
        ],
        accessory_coordination: [
          `Choose accessories that complement the ${placeAnalysis.style} venue style`,
          `Coordinate metal tones with the venue's ${placeAnalysis.colors.join(' and ')} color scheme`
        ],
        overall_theme: `${placeAnalysis.atmosphere} coordination that highlights both personalities`
      }
    }
  };
};

// Helper functions for photo-based analysis
const getColorsForSkinTone = (skinTone: string): string[] => {
  const colorMap: Record<string, string[]> = {
    'Fair': ['Cool blues', 'Soft pinks', 'Classic navy', 'Crisp whites'],
    'Wheatish': ['Warm earth tones', 'Rich browns', 'Golden yellows', 'Deep greens'],
    'Dusky': ['Jewel tones', 'Deep purples', 'Rich burgundy', 'Emerald green'],
    'Dark': ['Bright whites', 'Bold colors', 'Vibrant blues', 'Rich golds'],
    // Legacy support for old values
    'Medium': ['Warm earth tones', 'Rich browns', 'Golden yellows', 'Deep greens'],
    'Olive': ['Jewel tones', 'Deep purples', 'Rich burgundy', 'Emerald green'],
    
  };

  return colorMap[skinTone] || ['Neutral tones', 'Classic colors', 'Versatile shades'];
};

const inferDressCodeFromVenue = (venue: string, category: string): string => {
  const venueStr = venue.toLowerCase();

  if (category === 'business') return 'Business professional to business casual';
  if (category === 'wedding') return 'Formal to semi-formal';
  if (category === 'party') return 'Party chic to glamorous';
  if (category === 'festival') return 'Traditional to modern fusion';
  if (category === 'workout') return 'Athletic and performance-focused';
  if (category === 'brunch') return 'Chic casual to smart casual';
  if (category === 'photoshoot') return 'Camera-ready and stylish';
  if (category === 'anniversary') return 'Romantic and special occasion';
  if (category === 'travel') return 'Comfortable yet stylish';
  if (category === 'casual') return 'Relaxed and comfortable';

  if (venueStr.includes('formal') || venueStr.includes('elegant')) return 'Semi-formal to formal';
  if (venueStr.includes('casual') || venueStr.includes('relaxed')) return 'Smart casual';
  if (venueStr.includes('modern') || venueStr.includes('contemporary')) return 'Modern casual to smart casual';

  return 'Smart casual to semi-formal';
};

const createOutfitSuggestions = (
  personAnalysis: any,
  placeAnalysis: any,
  category: string,
  context?: any,
  geminiOutfit?: string
): OutfitSuggestion[] => {
  const isMale = personAnalysis.gender === 'male';
  const bodyType = personAnalysis.bodyType;
  const skinTone = personAnalysis.skinTone;

  // Create outfit based on real analysis
  const baseOutfit = isMale ? {
    category: `${bodyType} ${category} Style`,
    items: getItemsForBodyType(bodyType, isMale, category),
    colors: getColorsForSkinTone(skinTone).slice(0, 3),
    accessories: getAccessoriesForBodyType(bodyType, isMale),
    styling_tips: getStyleTipsForBodyType(bodyType, isMale),
    why_this_works: geminiOutfit ||
      `Perfect for ${bodyType} build with ${skinTone} skin tone in ${placeAnalysis.venue || 'this'} setting`,
    shopping_links: generateSpecificShoppingLinks(
      getItemsForBodyType(bodyType, isMale, category),
      getColorsForSkinTone(skinTone).slice(0, 3),
      personAnalysis.gender
    )
  } : {
    category: `${bodyType} ${category} Style`,
    items: getItemsForBodyType(bodyType, isMale, category),
    colors: getColorsForSkinTone(skinTone).slice(0, 3),
    accessories: getAccessoriesForBodyType(bodyType, isMale),
    styling_tips: getStyleTipsForBodyType(bodyType, isMale),
    why_this_works: geminiOutfit ||
      `Flattering for ${bodyType} figure with ${skinTone} complexion in ${placeAnalysis.venue || 'this'} atmosphere`,
    shopping_links: generateSpecificShoppingLinks(
      getItemsForBodyType(bodyType, isMale, category),
      getColorsForSkinTone(skinTone).slice(0, 3),
      personAnalysis.gender
    )
  };

  return [baseOutfit];
};

const getItemsForBodyType = (bodyType: string, isMale: boolean, category: string): string[] => {
  const maleItemMap: Record<string, string[]> = {
    'Athletic': ['Fitted polo shirt', 'Tailored chinos', 'Structured blazer', 'Clean sneakers'],
    'Slim': ['Slim-fit shirt', 'Skinny jeans', 'Fitted jacket', 'Dress shoes'],
    'Average': ['Classic shirt', 'Chinos', 'Casual jacket', 'Loafers'],
    'Heavy': ['Relaxed-fit shirt', 'Comfortable trousers', 'Open cardigan', 'Comfortable shoes']
  };

  const femaleItemMap: Record<string, string[]> = {
    'Hourglass': ['Fitted wrap top', 'High-waisted jeans', 'Belted blazer', 'Heeled boots'],
    'Pear': ['Statement blouse', 'A-line skirt', 'Cropped jacket', 'Ankle boots'],
    'Apple': ['Empire waist top', 'Straight-leg pants', 'Long cardigan', 'Pointed flats'],
    'Rectangle': ['Peplum top', 'Skinny jeans', 'Structured blazer', 'Block heels'],
    'Inverted Triangle': ['Soft blouse', 'Wide-leg pants', 'Flowy cardigan', 'Comfortable flats']
  };

  if (isMale) {
    return maleItemMap[bodyType] || maleItemMap['Average'];
  } else {
    return femaleItemMap[bodyType] || femaleItemMap['Rectangle'];
  }
};

const getAccessoriesForBodyType = (bodyType: string, isMale: boolean): string[] => {
  if (isMale) {
    return ['Watch', 'Belt', 'Wallet', 'Sunglasses'];
  } else {
    return ['Earrings', 'Necklace', 'Handbag', 'Bracelet'];
  }
};

const getStyleTipsForBodyType = (bodyType: string, isMale: boolean): string[] => {
  const maleTipMap: Record<string, string[]> = {
    'Athletic': ['Highlight your build with fitted clothes', 'Choose structured pieces', 'Balance proportions well'],
    'Slim': ['Add layers for dimension', 'Choose structured pieces', 'Avoid overly loose fits'],
    'Average': ['Versatile styling options', 'Focus on proper fit', 'Experiment with colors'],
    'Heavy': ['Choose comfortable fits', 'Use vertical lines', 'Focus on quality fabrics']
  };

  const femaleTipMap: Record<string, string[]> = {
    'Hourglass': ['Emphasize your waist', 'Choose fitted silhouettes', 'Balance top and bottom'],
    'Pear': ['Draw attention to your upper body', 'Choose A-line bottoms', 'Add volume on top'],
    'Apple': ['Create a defined waistline', 'Choose empire waist styles', 'Use strategic layering'],
    'Rectangle': ['Create curves with belts', 'Add volume with layers', 'Define your waist'],
    'Inverted Triangle': ['Balance with wider bottoms', 'Choose soft, flowing tops', 'Add volume to hips']
  };

  if (isMale) {
    return maleTipMap[bodyType] || ['Focus on comfort and confidence', 'Choose quality pieces', 'Highlight your best features'];
  } else {
    return femaleTipMap[bodyType] || ['Focus on comfort and confidence', 'Choose quality pieces', 'Highlight your best features'];
  }
};

const getMockTwinningAnalysis = (
  names: { person1: string; person2: string },
  category: string,
  context?: any,
  geminiInsights?: string,
  geminiOutfit?: string
): TwinningAnalysis => {
  // Use the enhanced analysis function
  const person1Analysis = analyzePersonFromName(names.person1);
  const person2Analysis = analyzePersonFromName(names.person2);

  // Create detailed analysis based on context and names
  const createPersonAnalysis = (name: string, analysis: { gender: 'male' | 'female', traits: string[] }, isFirst: boolean): PersonAnalysis => {
    const skinTones: Record<'male' | 'female', string[]> = {
      male: ['Warm golden undertones with medium complexion', 'Cool undertones with fair complexion', 'Neutral undertones with balanced tone'],
      female: ['Fair complexion with cool undertones', 'Warm golden undertones', 'Medium complexion with neutral undertones']
    };

    const bodyTypes: Record<'male' | 'female', string[]> = {
      male: ['Athletic build with broad shoulders', 'Lean build with good proportions', 'Medium build with balanced frame'],
      female: ['Slender build with elegant posture', 'Petite frame with graceful lines', 'Medium build with balanced proportions']
    };

    const styles: Record<'male' | 'female', string[]> = {
      male: ['Smart-casual with modern touches', 'Classic with contemporary elements', 'Trendy with practical approach'],
      female: ['Chic and contemporary', 'Elegant and sophisticated', 'Modern with feminine touches']
    };

    const personalityTraits: Record<'male' | 'female', string[][]> = {
      male: [['Confident', 'Outgoing', 'Practical'], ['Thoughtful', 'Reliable', 'Trendy'], ['Creative', 'Energetic', 'Modern']],
      female: [['Graceful', 'Creative', 'Stylish'], ['Elegant', 'Thoughtful', 'Sophisticated'], ['Vibrant', 'Fashionable', 'Confident']]
    };

    const colorPrefs: Record<'male' | 'female', string[][]> = {
      male: [['Navy', 'Charcoal', 'Earth tones'], ['Blues', 'Grays', 'Burgundy'], ['Black', 'White', 'Accent colors']],
      female: [['Pastels', 'Jewel tones', 'Neutrals'], ['Cool blues', 'Pastels', 'Classic neutrals'], ['Warm tones', 'Soft colors', 'Metallics']]
    };

    const features: Record<'male' | 'female', string[][]> = {
      male: [['Strong jawline', 'Athletic build'], ['Clean features', 'Good posture'], ['Expressive eyes', 'Confident stance']],
      female: [['Delicate features', 'Expressive eyes'], ['Graceful posture', 'Bright smile'], ['Elegant features', 'Natural beauty']]
    };

    const index = isFirst ? 0 : Math.min(1, skinTones[analysis.gender].length - 1);

    return {
      name,
      skinTone: skinTones[analysis.gender][index] || skinTones[analysis.gender][0],
      bodyType: bodyTypes[analysis.gender][index] || bodyTypes[analysis.gender][0],
      height: "medium" as const,
      style: styles[analysis.gender][index] || styles[analysis.gender][0],
      personalityTraits: personalityTraits[analysis.gender][index] || personalityTraits[analysis.gender][0],
      colorPreferences: colorPrefs[analysis.gender][index] || colorPrefs[analysis.gender][0],
      physicalFeatures: features[analysis.gender][index] || features[analysis.gender][0]
    };
  };

  return {
    person1: createPersonAnalysis(names.person1, person1Analysis, true),
    person2: createPersonAnalysis(names.person2, person2Analysis, false),
    place: {
      venue: context?.venue || context?.location || context?.venueStyle || `${category} venue`,
      atmosphere: context?.atmosphere || context?.vibe || "Stylish and welcoming",
      dressCode: context?.formalityLevel || "Smart casual to semi-formal",
      weatherConsiderations: context?.seasonTime || "Indoor climate controlled",
      timeOfDay: context?.duration || "Evening",
      occasion: context?.dateType || context?.hangoutType || context?.ceremonyType || category
    },
    relationship: {
      dynamic: geminiInsights ||
        (context?.groupDynamic ? `${context.groupDynamic} with great coordination potential` :
          context?.specialOccasion ? `Perfect partnership for ${context.specialOccasion}` :
            "Complementary personalities with great chemistry"),
      compatibility: context?.styleGoals || context?.stylePreferences || "Different styles that harmonize beautifully",
      contrast: "Coordinated yet individual styling approach",
      recommendations: [
        context?.stylePreferences ? `Focus on ${context.stylePreferences}` : "Balance warm and cool elements",
        context?.activities ? `Ensure comfort for ${context.activities}` : "Use complementary colors",
        context?.culturalElements ? `Incorporate ${context.culturalElements}` : "Mix textures for depth"
      ]
    },
    outfitSuggestions: {
      person1: [
        {
          category: person1Analysis.gender === 'male' ? "Smart Casual" : "Chic Coordination",
          items: person1Analysis.gender === 'male'
            ? ["Tailored blazer", "Fitted chinos", "Clean sneakers"]
            : ["Silk blouse", "High-waisted trousers", "Block heels"],
          colors: person1Analysis.gender === 'male'
            ? ["Navy blue", "White", "Tan accents"]
            : ["Soft blue", "Cream", "Gold accents"],
          accessories: person1Analysis.gender === 'male'
            ? ["Leather watch", "Minimalist wallet"]
            : ["Delicate earrings", "Structured handbag"],
          styling_tips: person1Analysis.gender === 'male'
            ? ["Roll up blazer sleeves", "Keep fit tailored"]
            : ["Tuck blouse into trousers", "Add a belt for definition"],
          why_this_works: geminiOutfit ||
            (context?.venue ? `Perfect for ${context.venue} setting` :
              context?.atmosphere ? `Matches the ${context.atmosphere} vibe` :
                person1Analysis.gender === 'male'
                  ? "Balances casual and polished elements for modern men"
                  : "Creates elegant silhouette with contemporary flair"),
          shopping_links: generateSpecificShoppingLinks(
            person1Analysis.gender === 'male'
              ? ["Tailored blazer", "Fitted chinos", "Clean sneakers"]
              : ["Silk blouse", "High-waisted trousers", "Block heels"],
            person1Analysis.gender === 'male'
              ? ["Navy", "Khaki", "White"]
              : ["Blush", "Cream", "Gold"],
            person1Analysis.gender
          )
        }
      ],
      person2: [
        {
          category: person2Analysis.gender === 'male' ? "Modern Casual" : "Elegant Coordination",
          items: person2Analysis.gender === 'male'
            ? ["Cotton shirt", "Dark jeans", "Casual loafers"]
            : ["Flowy top", "Midi skirt", "Comfortable flats"],
          colors: person2Analysis.gender === 'male'
            ? ["Light blue", "Charcoal", "Brown accents"]
            : ["Soft pink", "Beige", "Rose gold accents"],
          accessories: person2Analysis.gender === 'male'
            ? ["Simple watch", "Canvas bag"]
            : ["Statement necklace", "Crossbody bag"],
          styling_tips: person2Analysis.gender === 'male'
            ? ["Keep shirt untucked", "Roll sleeves for casual look"]
            : ["Let top flow naturally", "Add layers for depth"],
          why_this_works: context?.activities ? `Great for ${context.activities} activities` :
            context?.styleGoals ? `Achieves your ${context.styleGoals} goals` :
              person2Analysis.gender === 'male'
                ? "Comfortable yet put-together for any occasion"
                : "Feminine and graceful while staying coordinated",
          shopping_links: generateSpecificShoppingLinks(
            person2Analysis.gender === 'male'
              ? ["Cotton shirt", "Dark jeans", "Casual loafers"]
              : ["Flowy top", "Midi skirt", "Comfortable flats"],
            person2Analysis.gender === 'male'
              ? ["Light blue", "Charcoal", "Brown"]
              : ["Soft pink", "Beige", "Rose gold"],
            person2Analysis.gender
          )
        }
      ],
      coordination: {
        color_harmony: [
          context?.weddingTheme ? `Incorporate ${context.weddingTheme} color scheme` : "Use navy and blue as connecting colors",
          context?.culturalElements ? `Honor ${context.culturalElements} traditions` : "Add metallic accents for cohesion"
        ],
        style_balance: [
          context?.formalityLevel ? `Maintain ${context.formalityLevel} dress code` : "Mix casual and formal elements",
          context?.activities ? `Ensure comfort for ${context.activities}` : "Balance proportions"
        ],
        proportion_tips: [
          "Consider height differences",
          context?.seasonTime ? `Adapt for ${context.seasonTime} conditions` : "Use vertical lines"
        ],
        accessory_coordination: [
          "Match metal tones",
          context?.styleGoals ? `Focus on ${context.styleGoals}` : "Coordinate bag styles"
        ],
        overall_theme: context?.atmosphere || context?.vibe || context?.weddingTheme || "Modern sophistication with personal flair"
      }
    },
  };
};

export const generateShoppingLinks = (searchTerm: string, items?: string[], category?: string) => {
  // Create targeted search queries for different platforms
  const itemsQuery = items && items.length > 0 ? items.join(' ') : searchTerm;
  const categorySpecificTerm = category ? `${category} ${searchTerm}` : searchTerm;

  const platforms = [
    {
      platform: "Pinterest",
      search_term: searchTerm,
      url: `https://pinterest.com/search/pins/?q=${encodeURIComponent(searchTerm)}`,
      icon: "logo-pinterest"
    },
    {
      platform: "Amazon Fashion",
      search_term: itemsQuery,
      url: `https://amazon.com/s?k=${encodeURIComponent(itemsQuery)}&rh=n%3A7141123011`,
      icon: "logo-amazon"
    },
    {
      platform: "Myntra",
      search_term: categorySpecificTerm,
      url: `https://myntra.com/search?q=${encodeURIComponent(categorySpecificTerm)}`,
      icon: "shirt"
    },
    {
      platform: "Zara",
      search_term: searchTerm,
      url: `https://zara.com/search?searchTerm=${encodeURIComponent(searchTerm)}`,
      icon: "storefront"
    }
  ];

  return platforms;
};

// New function to generate specific shopping links based on actual outfit items and colors
export const generateSpecificShoppingLinks = (
  outfitItems: string[], 
  colors: string[], 
  gender: 'male' | 'female',
  coordinationColors?: string[]
) => {
  // Clean and prepare items for search
  const cleanItems = outfitItems.map(item => 
    item.toLowerCase()
      .replace(/[^\w\s]/g, '') // Remove special characters
      .trim()
  ).filter(item => item.length > 0);

  // Prepare colors for search (use coordination colors if available)
  const searchColors = coordinationColors && coordinationColors.length > 0 
    ? coordinationColors 
    : colors;
  
  const cleanColors = searchColors.map(color => 
    color.toLowerCase()
      .replace(/[^\w\s]/g, '')
      .trim()
  ).filter(color => color.length > 0);

  // Create specific search terms for each platform
  const genderTerm = gender === 'male' ? 'men' : 'women';
  
  // Main items search (e.g., "men classic shirt chinos")
  const mainItemsSearch = `${genderTerm} ${cleanItems.slice(0, 3).join(' ')}`;
  
  // Color-specific search (e.g., "navy blue men shirt")
  const colorItemsSearch = cleanColors.length > 0 
    ? `${cleanColors[0]} ${genderTerm} ${cleanItems[0] || 'outfit'}`
    : mainItemsSearch;
  
  // Specific item search (e.g., "men chinos loafers")
  const specificItemsSearch = cleanItems.length > 1 
    ? `${genderTerm} ${cleanItems.slice(0, 2).join(' ')}`
    : mainItemsSearch;

  console.log('🔗 Generating specific shopping links:', {
    items: cleanItems,
    colors: cleanColors,
    mainSearch: mainItemsSearch,
    colorSearch: colorItemsSearch,
    specificSearch: specificItemsSearch
  });

  const platforms = [
    {
      platform: "Amazon Fashion",
      search_term: mainItemsSearch,
      url: `https://amazon.com/s?k=${encodeURIComponent(mainItemsSearch)}&rh=n%3A7141123011`,
      icon: "logo-amazon"
    },
    {
      platform: "Myntra",
      search_term: colorItemsSearch,
      url: `https://myntra.com/search?q=${encodeURIComponent(colorItemsSearch)}`,
      icon: "shirt"
    },
    {
      platform: "Zara",
      search_term: specificItemsSearch,
      url: `https://zara.com/search?searchTerm=${encodeURIComponent(specificItemsSearch)}`,
      icon: "storefront"
    },
    {
      platform: "Pinterest Style",
      search_term: `${mainItemsSearch} ${cleanColors.slice(0, 2).join(' ')} outfit`,
      url: `https://pinterest.com/search/pins/?q=${encodeURIComponent(`${mainItemsSearch} ${cleanColors.slice(0, 2).join(' ')} outfit`)}`,
      icon: "logo-pinterest"
    }
  ];

  return platforms;
};
// Helper functions for extracting information from AI analysis
const extractGenderFromAnalysis = (analysis: string): 'male' | 'female' | null => {
  const genderMatch = analysis.match(/gender[:\s]*([^.!,\n]+)/i);
  if (genderMatch) {
    const gender = genderMatch[1].trim().toLowerCase();
    if (gender.includes('male') && !gender.includes('female')) return 'male';
    if (gender.includes('female')) return 'female';
  }

  // Look for other gender indicators
  if (analysis.toLowerCase().includes('he ') || analysis.toLowerCase().includes('his ') || analysis.toLowerCase().includes('man ')) return 'male';
  if (analysis.toLowerCase().includes('she ') || analysis.toLowerCase().includes('her ') || analysis.toLowerCase().includes('woman ')) return 'female';

  return null;
};

const extractBodyTypeFromAnalysis = (analysis: string, gender: 'male' | 'female'): string => {
  if (!analysis || typeof analysis !== 'string') {
    console.warn('⚠️ No analysis data for body type extraction');
    return gender === 'male' ? 'Average' : 'Rectangle';
  }

  // Try multiple patterns to extract body type
  const patterns = [
    /body type[:\s]*([^.!,\n]+)/i,
    /body[:\s]*([^.!,\n]*(?:athletic|slim|heavy|average|hourglass|pear|apple|rectangle|inverted triangle)[^.!,\n]*)/i,
    /(athletic|slim|heavy|average|hourglass|pear|apple|rectangle|inverted triangle)/i
  ];

  let bodyType = '';
  for (const pattern of patterns) {
    const match = analysis.match(pattern);
    if (match) {
      bodyType = match[1].trim().toLowerCase();
      break;
    }
  }

  console.log(`🔍 Extracted body type: "${bodyType}" for ${gender} from analysis`);

  if (gender === 'male') {
    if (bodyType.includes('athletic') || bodyType.includes('muscular') || bodyType.includes('fit')) return 'Athletic';
    if (bodyType.includes('slim') || bodyType.includes('lean') || bodyType.includes('thin')) return 'Slim';
    if (bodyType.includes('heavy') || bodyType.includes('large') || bodyType.includes('broad')) return 'Heavy';
    if (bodyType.includes('average') || bodyType.includes('normal') || bodyType.includes('medium')) return 'Average';
    return 'Average';
  } else {
    if (bodyType.includes('hourglass') || bodyType.includes('curvy')) return 'Hourglass';
    if (bodyType.includes('pear') || bodyType.includes('bottom-heavy')) return 'Pear';
    if (bodyType.includes('apple') || bodyType.includes('top-heavy')) return 'Apple';
    if (bodyType.includes('rectangle') || bodyType.includes('straight') || bodyType.includes('athletic')) return 'Rectangle';
    if (bodyType.includes('inverted triangle') || bodyType.includes('broad shoulder')) return 'Inverted Triangle';
    return 'Rectangle';
  }
};

const extractStyleFromAnalysis = (analysis: string, gender: 'male' | 'female'): string => {
  if (!analysis || typeof analysis !== 'string') {
    return gender === 'male' ? 'Smart-casual and confident' : 'Chic and contemporary';
  }

  const styleMatch = analysis.match(/style[:\s]*([^.!,\n]+)/i);
  if (styleMatch) {
    return styleMatch[1].trim() || (gender === 'male' ? 'Smart-casual and confident' : 'Chic and contemporary');
  }

  return gender === 'male' ? 'Smart-casual and confident' : 'Chic and contemporary';
};

const extractTraitsFromAnalysis = (analysis: string): string[] => {
  if (!analysis || typeof analysis !== 'string') {
    return ['Confident', 'Stylish', 'Modern', 'Approachable'];
  }

  const traitsMatch = analysis.match(/traits[:\s]*([^.!,\n]+)/i);
  if (traitsMatch) {
    const traits = traitsMatch[1].split(',').map(trait => trait.trim()).filter(trait => trait.length > 0);
    return traits.length > 0 ? traits.slice(0, 4) : ['Confident', 'Stylish', 'Modern', 'Approachable'];
  }

  return ['Confident', 'Stylish', 'Modern', 'Approachable'];
};

const extractConfidenceFromAnalysis = (analysis: string): number => {
  const confidenceMatch = analysis.match(/confidence[:\s]*(\d+)/i);
  if (confidenceMatch) {
    return parseInt(confidenceMatch[1]);
  }

  return 85;
};

const extractSkinToneFromAnalysis = (analysis: string): string => {
  if (!analysis || typeof analysis !== 'string') {
    console.warn('⚠️ No analysis data for skin tone extraction');
    return 'Fair';
  }

  // Try multiple patterns to extract skin tone
  const patterns = [
    /skin tone[:\s]*([^.!,\n]+)/i,
    /skin[:\s]*([^.!,\n]*(?:fair|light|pale|wheatish|wheat|medium|olive|dusky|brown|tan|dark|deep|rich)[^.!,\n]*)/i,
    /(fair|light|pale|wheatish|wheat|medium|olive|dusky|brown|tan|dark|deep|rich)\s*(?:skin|tone|complexion)/i
  ];

  let tone = '';
  for (const pattern of patterns) {
    const match = analysis.match(pattern);
    if (match) {
      tone = match[1].trim().toLowerCase();
      break;
    }
  }

  console.log(`🔍 Extracted skin tone: "${tone}" from analysis`);

  if (tone.includes('fair') || tone.includes('light') || tone.includes('pale') || tone.includes('white')) return 'Fair';
  if (tone.includes('wheatish') || tone.includes('wheat') || tone.includes('medium') || tone.includes('olive') || tone.includes('yellow')) return 'Wheatish';
  if (tone.includes('dusky') || tone.includes('brown') || tone.includes('tan') || tone.includes('caramel')) return 'Dusky';
  if (tone.includes('dark') || tone.includes('deep') || tone.includes('rich') || tone.includes('black')) return 'Dark';
  
  return 'Fair';
};

const extractPhysicalFeatures = (analysis: string): string[] => {
  if (!analysis || typeof analysis !== 'string') {
    return ['Natural features', 'Good proportions', 'Confident presence'];
  }

  const features = [];
  if (analysis.includes('tall') || analysis.includes('height')) features.push('Tall stature');
  if (analysis.includes('athletic') || analysis.includes('fit')) features.push('Athletic build');
  if (analysis.includes('elegant') || analysis.includes('graceful')) features.push('Elegant posture');
  if (analysis.includes('confident') || analysis.includes('strong')) features.push('Confident presence');
  if (analysis.includes('slim') || analysis.includes('lean')) features.push('Lean build');
  if (analysis.includes('balanced') || analysis.includes('proportioned')) features.push('Well-proportioned');

  if (features.length === 0) features.push('Natural features', 'Good proportions', 'Confident presence');
  return features;
};

const extractDynamicFromAnalysis = (analysis: string): string => {
  if (analysis.includes('couple') || analysis.includes('romantic')) return 'Romantic couple dynamic';
  if (analysis.includes('friends') || analysis.includes('friendly')) return 'Close friends dynamic';
  if (analysis.includes('family') || analysis.includes('sibling')) return 'Family dynamic';
  if (analysis.includes('professional') || analysis.includes('business')) return 'Professional partnership';
  return 'Complementary personalities with natural chemistry';
};

const extractChemistryFromAnalysis = (analysis: string): string => {
  if (analysis.includes('great chemistry') || analysis.includes('perfect match')) return 'Excellent visual chemistry';
  if (analysis.includes('complement') || analysis.includes('balance')) return 'Balanced and complementary';
  if (analysis.includes('contrast') || analysis.includes('different')) return 'Beautiful contrast that works well';
  return 'Natural coordination and harmony';
};

const extractCoordinationStyle = (analysis: string): string => {
  if (analysis.includes('formal') || analysis.includes('elegant')) return 'Elegant and sophisticated';
  if (analysis.includes('casual') || analysis.includes('relaxed')) return 'Relaxed and comfortable';
  if (analysis.includes('trendy') || analysis.includes('modern')) return 'Modern and stylish';
  return 'Balanced and harmonious';
};

const extractVisualHarmony = (analysis: string): string => {
  if (analysis.includes('perfect harmony') || analysis.includes('excellent balance')) return 'Perfect visual harmony';
  if (analysis.includes('complement') || analysis.includes('work well')) return 'Complementary and balanced';
  return 'Harmonious pairing with good balance';
};

const extractGroupRecommendations = (analysis: string): string[] => {
  const recommendations = [];
  if (analysis.includes('color')) recommendations.push('Coordinate colors for better harmony');
  if (analysis.includes('style')) recommendations.push('Balance different style preferences');
  if (analysis.includes('formal')) recommendations.push('Match formality levels');
  if (analysis.includes('accessory') || analysis.includes('accessories')) recommendations.push('Coordinate accessories');
  if (recommendations.length === 0) {
    recommendations.push('Focus on color coordination', 'Balance individual styles', 'Maintain personal identity');
  }
  return recommendations;
};

const extractVenueType = (analysis: string): string => {
  if (!analysis || typeof analysis !== 'string') {
    return 'Modern venue';
  }

  // First try to extract from structured format
  const venueMatch = analysis.match(/venue type[:\s]*([^.!,\n]+)/i);
  if (venueMatch) {
    return venueMatch[1].trim();
  }

  // Fallback to keyword detection
  if (analysis.includes('restaurant') || analysis.includes('dining')) return 'Restaurant/Dining venue';
  if (analysis.includes('park') || analysis.includes('outdoor')) return 'Outdoor/Park setting';
  if (analysis.includes('mall') || analysis.includes('shopping')) return 'Shopping/Mall venue';
  if (analysis.includes('home') || analysis.includes('house')) return 'Home/Private setting';
  if (analysis.includes('office') || analysis.includes('business')) return 'Business/Office venue';
  if (analysis.includes('hotel') || analysis.includes('resort')) return 'Hotel/Resort venue';
  return 'Modern venue';
};

const extractAtmosphere = (analysis: string): string => {
  if (!analysis || typeof analysis !== 'string') {
    return 'Welcoming and stylish';
  }

  // First try to extract from structured format
  const atmosphereMatch = analysis.match(/atmosphere[:\s]*([^.!,\n]+)/i);
  if (atmosphereMatch) {
    return atmosphereMatch[1].trim();
  }

  // Fallback to keyword detection
  if (analysis.includes('romantic') || analysis.includes('intimate')) return 'Romantic and intimate';
  if (analysis.includes('casual') || analysis.includes('relaxed')) return 'Casual and relaxed';
  if (analysis.includes('formal') || analysis.includes('elegant')) return 'Formal and elegant';
  if (analysis.includes('fun') || analysis.includes('lively')) return 'Fun and energetic';
  return 'Welcoming and stylish';
};

const extractLighting = (analysis: string): string => {
  if (!analysis || typeof analysis !== 'string') {
    return 'Balanced natural lighting';
  }

  // First try to extract from structured format
  const lightingMatch = analysis.match(/lighting[:\s]*([^.!,\n]+)/i);
  if (lightingMatch) {
    return lightingMatch[1].trim();
  }

  // Fallback to keyword detection
  if (analysis.includes('natural light') || analysis.includes('daylight')) return 'Natural daylight';
  if (analysis.includes('warm light') || analysis.includes('golden')) return 'Warm ambient lighting';
  if (analysis.includes('cool light') || analysis.includes('bright')) return 'Cool bright lighting';
  if (analysis.includes('dim') || analysis.includes('soft')) return 'Soft dim lighting';
  return 'Balanced natural lighting';
};

const extractDominantColors = (analysis: string): string[] => {
  if (!analysis || typeof analysis !== 'string') {
    return ['Neutral', 'Warm', 'Modern', 'Elegant'];
  }

  // First try to extract from structured format
  const colorsMatch = analysis.match(/dominant colors[:\s]*([^.!,\n]+)/i);
  if (colorsMatch) {
    const colorsList = colorsMatch[1].split(',').map(color => color.trim()).filter(color => color.length > 0);
    if (colorsList.length > 0) {
      return colorsList.slice(0, 4);
    }
  }

  // Fallback to keyword detection
  const colors = [];
  const colorWords = ['red', 'blue', 'green', 'yellow', 'orange', 'purple', 'pink', 'brown', 'black', 'white', 'gray', 'beige', 'gold', 'silver', 'cream', 'navy', 'maroon'];

  colorWords.forEach(color => {
    if (analysis.toLowerCase().includes(color)) {
      colors.push(color.charAt(0).toUpperCase() + color.slice(1));
    }
  });

  if (colors.length === 0) colors.push('Neutral', 'Warm', 'Modern', 'Elegant');
  return colors.slice(0, 4); // Limit to 4 colors
};

const extractVenueStyle = (analysis: string): string => {
  if (analysis.includes('modern') || analysis.includes('contemporary')) return 'Modern';
  if (analysis.includes('classic') || analysis.includes('traditional')) return 'Classic';
  if (analysis.includes('rustic') || analysis.includes('vintage')) return 'Rustic';
  if (analysis.includes('elegant') || analysis.includes('luxury')) return 'Elegant';
  if (analysis.includes('minimalist') || analysis.includes('simple')) return 'Minimalist';
  return 'Contemporary';
};

const extractDressCode = (analysis: string, category: string): string => {
  if (analysis.includes('formal') || analysis.includes('dress up')) return 'Formal';
  if (analysis.includes('business') || analysis.includes('professional')) return 'Business casual';
  if (analysis.includes('casual') || analysis.includes('relaxed')) return 'Smart casual';
  if (analysis.includes('party') || analysis.includes('celebration')) return 'Party attire';

  // Category-based fallback
  const categoryDressCode: Record<string, string> = {
    'business': 'Business professional',
    'wedding': 'Formal/Semi-formal',
    'party': 'Party chic',
    'casual': 'Smart casual',
    'date': 'Smart casual',
    'festival': 'Cultural/Traditional',
    'workout': 'Athletic wear',
    'brunch': 'Chic casual',
    'travel': 'Comfortable chic'
  };

  return categoryDressCode[category] || 'Smart casual';
};

const extractAmbiance = (analysis: string): string => {
  if (analysis.includes('cozy') || analysis.includes('comfortable')) return 'Cozy and comfortable';
  if (analysis.includes('sophisticated') || analysis.includes('upscale')) return 'Sophisticated and upscale';
  if (analysis.includes('vibrant') || analysis.includes('energetic')) return 'Vibrant and energetic';
  if (analysis.includes('peaceful') || analysis.includes('serene')) return 'Peaceful and serene';
  return 'Welcoming and stylish';
};

const extractVenueRecommendations = (analysis: string): string[] => {
  const recommendations = [];
  if (analysis.includes('formal')) recommendations.push('Dress appropriately for formal setting');
  if (analysis.includes('color')) recommendations.push('Match venue color scheme');
  if (analysis.includes('lighting')) recommendations.push('Consider lighting for fabric choices');
  if (analysis.includes('weather') || analysis.includes('outdoor')) recommendations.push('Consider weather conditions');
  if (recommendations.length === 0) {
    recommendations.push('Match venue formality', 'Coordinate with environment', 'Consider comfort and style');
  }
  return recommendations;
};

const getFallbackPersonAnalysis = (name: string) => {
  const nameAnalysis = analyzePersonFromName(name || 'Person');
  return {
    name: name || 'Person',
    gender: nameAnalysis.gender,
    bodyType: nameAnalysis.gender === 'male' ? 'Average' : 'Rectangle',
    skinTone: 'Fair',
    style: nameAnalysis.gender === 'male' ? 'Smart-casual and confident' : 'Chic and contemporary',
    traits: nameAnalysis.traits || ['Confident', 'Stylish', 'Modern'],
    physicalFeatures: ['Natural build', 'Good proportions', 'Confident presence'],
    confidence: 75,
    detailedAnalysis: 'Backup analysis created for reliable recommendations'
  };
};

const getFallbackVenueAnalysis = (category: string, context?: any) => {
  return {
    venue: context?.venue || context?.location || 'Modern venue',
    atmosphere: context?.atmosphere || 'Stylish and welcoming',
    lighting: 'Natural lighting',
    dominantColors: ['Neutral', 'Warm', 'Modern'],
    style: 'Contemporary',
    dressCode: category === 'business' ? 'Business casual' : 'Smart casual',
    ambiance: 'Comfortable and stylish',
    recommendations: ['Match occasion formality', 'Consider venue style', 'Coordinate colors'],
    detailedDescription: 'Standard venue analysis based on category'
  };
};

// STEP 4: Create comprehensive prompt for AI
const createComprehensiveTwinningPrompt = (
  person1Analysis: any,
  person2Analysis: any,
  groupAnalysis: any,
  placeAnalysis: any,
  names: { person1: string; person2: string },
  category: string,
  occasion?: string,
  context?: any
): string => {
  let contextDetails = '';

  if (context) {
    const contextEntries = Object.entries(context)
      .filter(([key, value]) => value && value !== 'Not specified')
      .map(([key, value]) => `${key}: ${value}`)
      .join('\n- ');

    if (contextEntries) {
      contextDetails = `\nCONTEXT DETAILS:\n- ${contextEntries}`;
    }
  }

  return `You are an expert fashion stylist creating coordinated outfits for ${names.person1} and ${names.person2}.

COMPREHENSIVE ANALYSIS DATA:

PERSON 1 - ${person1Analysis.name}:
- Gender: ${person1Analysis.gender}
- Body Type: ${person1Analysis.bodyType}
- Skin Tone: ${person1Analysis.skinTone}
- Style: ${person1Analysis.style}
- Traits: ${person1Analysis.traits.join(', ')}
- Physical Features: ${person1Analysis.physicalFeatures.join(', ')}
- Analysis Confidence: ${person1Analysis.confidence}%

PERSON 2 - ${person2Analysis.name}:
- Gender: ${person2Analysis.gender}
- Body Type: ${person2Analysis.bodyType}
- Skin Tone: ${person2Analysis.skinTone}
- Style: ${person2Analysis.style}
- Traits: ${person2Analysis.traits.join(', ')}
- Physical Features: ${person2Analysis.physicalFeatures.join(', ')}
- Analysis Confidence: ${person2Analysis.confidence}%

GROUP DYNAMICS:
- Relationship Dynamic: ${groupAnalysis.dynamic}
- Visual Chemistry: ${groupAnalysis.chemistry}
- Coordination Style: ${groupAnalysis.coordinationStyle}
- Visual Harmony: ${groupAnalysis.visualHarmony}
- Group Recommendations: ${groupAnalysis.recommendations.join(', ')}

VENUE ANALYSIS:
- Venue Type: ${placeAnalysis.venue}
- Atmosphere: ${placeAnalysis.atmosphere}
- Lighting: ${placeAnalysis.lighting}
- Dominant Colors: ${placeAnalysis.dominantColors.join(', ')}
- Style: ${placeAnalysis.style}
- Dress Code: ${placeAnalysis.dressCode}
- Ambiance: ${placeAnalysis.ambiance}
- Venue Recommendations: ${placeAnalysis.recommendations.join(', ')}

OCCASION: ${category}${occasion ? ` - ${occasion}` : ''}${contextDetails}

TASK: Create 2-3 coordinated outfit options for each person that:
1. Complement their individual body types and skin tones
2. Work harmoniously together based on their group dynamic
3. Match the venue's atmosphere and dress code
4. Incorporate the venue's dominant colors appropriately
5. Respect the occasion and any cultural considerations
6. Provide specific styling tips for each person
7. Include shopping recommendations

Focus on creating outfits that enhance their natural features, coordinate beautifully together, and are perfect for the analyzed venue and occasion.

Provide detailed, practical recommendations with clear reasoning based on the comprehensive analysis data.`;
};

// STEP 5: Get AI recommendations using efficient model usage
const getAIFashionRecommendations = async (prompt: string): Promise<any> => {
  console.log('🤖 Getting AI fashion recommendations...');

  try {
    // Use the most efficient model for best results with free usage
    const response = await generateOutfitsFromPrompt(prompt);
    return response;
  } catch (error) {
    console.log('⚠️ AI recommendations failed, using structured fallback');
    return {
      recommendations: [{
        style: 'Coordinated Smart Casual',
        outfit: 'Complementary outfits based on analysis',
        reasoning: 'Based on comprehensive photo analysis and venue assessment',
        mood: 'Confident and coordinated'
      }]
    };
  }
};

// STEP 6: Combine all analysis data into final result
const combineAnalysisData = (
  person1Analysis: any,
  person2Analysis: any,
  groupAnalysis: any,
  placeAnalysis: any,
  aiRecommendations: any,
  names: { person1: string; person2: string },
  category: string,
  context?: any
): TwinningAnalysis => {
  return {
    person1: {
      name: person1Analysis.name,
      skinTone: person1Analysis.skinTone,
      bodyType: person1Analysis.bodyType,
      height: "medium" as const,
      style: person1Analysis.style,
      personalityTraits: person1Analysis.traits,
      colorPreferences: getColorsForSkinTone(person1Analysis.skinTone),
      physicalFeatures: person1Analysis.physicalFeatures
    },
    person2: {
      name: person2Analysis.name,
      skinTone: person2Analysis.skinTone,
      bodyType: person2Analysis.bodyType,
      height: "medium" as const,
      style: person2Analysis.style,
      personalityTraits: person2Analysis.traits,
      colorPreferences: getColorsForSkinTone(person2Analysis.skinTone),
      physicalFeatures: person2Analysis.physicalFeatures
    },
    place: {
      venue: placeAnalysis.venue,
      atmosphere: placeAnalysis.atmosphere,
      dressCode: placeAnalysis.dressCode,
      weatherConsiderations: placeAnalysis.lighting,
      timeOfDay: context?.timeOfDay || "Day",
      occasion: category
    },
    relationship: {
      dynamic: groupAnalysis.dynamic,
      compatibility: groupAnalysis.chemistry,
      contrast: groupAnalysis.visualHarmony,
      recommendations: groupAnalysis.recommendations
    },
    outfitSuggestions: {
      person1: createEnhancedOutfitSuggestions(person1Analysis, placeAnalysis, category, context, aiRecommendations),
      person2: createEnhancedOutfitSuggestions(person2Analysis, placeAnalysis, category, context, aiRecommendations),
      coordination: {
        color_harmony: [
          `Use ${placeAnalysis.dominantColors.join(' and ')} from the venue`,
          `${person1Analysis.skinTone} and ${person2Analysis.skinTone} skin tones work beautifully together`
        ],
        style_balance: [
          `Balance ${person1Analysis.bodyType} and ${person2Analysis.bodyType} silhouettes`,
          `Coordinate ${person1Analysis.style} with ${person2Analysis.style}`
        ],
        proportion_tips: [
          `Consider ${placeAnalysis.lighting} for fabric choices`,
          `Match ${placeAnalysis.dressCode} requirements`
        ],
        accessory_coordination: [
          `Complement the ${placeAnalysis.style} venue style`,
          `Use ${placeAnalysis.dominantColors[0]} as accent color`
        ],
        overall_theme: `${placeAnalysis.atmosphere} coordination highlighting both personalities`
      }
    }
  };
};

// Enhanced outfit suggestions based on comprehensive analysis
const createEnhancedOutfitSuggestions = (
  personAnalysis: any,
  placeAnalysis: any,
  category: string,
  context?: any,
  aiRecommendations?: any
): OutfitSuggestion[] => {
  const isMale = personAnalysis.gender === 'male';
  const baseColors = getColorsForSkinTone(personAnalysis.skinTone);
  const venueColors = placeAnalysis.dominantColors;

  return [
    {
      category: `${category} Perfect`,
      items: getItemsForBodyType(personAnalysis.bodyType, isMale, category),
      colors: [...baseColors.slice(0, 2), ...venueColors.slice(0, 1)],
      accessories: getAccessoriesForBodyType(personAnalysis.bodyType, isMale),
      styling_tips: [
        ...getStyleTipsForBodyType(personAnalysis.bodyType, isMale),
        `Perfect for ${placeAnalysis.atmosphere || 'this'} atmosphere`,
        `Coordinates with ${placeAnalysis.venue || 'the'} setting`
      ],
      why_this_works: `Tailored for ${personAnalysis.bodyType || 'your'} body type, ${personAnalysis.skinTone || 'your'} skin tone, and ${placeAnalysis.venue || 'this'} venue. ${aiRecommendations?.recommendations?.[0]?.reasoning || 'Based on comprehensive analysis.'}`,
      shopping_links: generateSpecificShoppingLinks(
        getItemsForBodyType(personAnalysis.bodyType, isMale, category),
        [...baseColors.slice(0, 2), ...venueColors.slice(0, 1)],
        personAnalysis.gender,
        placeAnalysis.dominantColors
      )
    },
    {
      category: `Alternative ${category}`,
      items: getAlternativeItems(personAnalysis.bodyType, isMale, category),
      colors: [...baseColors.slice(1, 3), ...venueColors.slice(1, 2)],
      accessories: getAlternativeAccessories(personAnalysis.bodyType, isMale),
      styling_tips: [
        `Emphasize ${personAnalysis.traits?.[0] || 'your'} personality`,
        `Work with ${placeAnalysis.lighting || 'natural'} lighting`,
        `Complement ${placeAnalysis.style || 'the'} venue style`
      ],
      why_this_works: `Alternative option that maintains coordination while expressing individual ${personAnalysis.style || 'personal'} style in ${placeAnalysis.venue || 'this'} setting.`,
      shopping_links: generateSpecificShoppingLinks(
        getAlternativeItems(personAnalysis.bodyType, isMale, category),
        [...baseColors.slice(1, 3), ...venueColors.slice(1, 2)],
        personAnalysis.gender,
        placeAnalysis.dominantColors
      )
    }
  ];
};

// Fallback analysis for when comprehensive analysis fails
const fallbackTwinningAnalysis = async (
  photos: any,
  names: { person1: string; person2: string },
  category: string,
  context?: any
): Promise<TwinningAnalysis> => {
  console.log('🔄 Using fallback analysis...');

  const person1Analysis = getFallbackPersonAnalysis(names.person1);
  const person2Analysis = getFallbackPersonAnalysis(names.person2);
  const placeAnalysis = getFallbackVenueAnalysis(category, context);

  const groupAnalysis = {
    dynamic: 'Complementary personalities',
    chemistry: 'Natural coordination',
    coordinationStyle: 'Balanced approach',
    visualHarmony: 'Harmonious pairing',
    recommendations: ['Coordinate colors', 'Balance styles', 'Maintain individuality']
  };

  return combineAnalysisData(
    person1Analysis,
    person2Analysis,
    groupAnalysis,
    placeAnalysis,
    null,
    names,
    category,
    context
  );
};

const getAlternativeItems = (bodyType: string, isMale: boolean, category: string): string[] => {
  const maleAlternatives: Record<string, string[]> = {
    'Athletic': ['Casual polo', 'Dark jeans', 'Leather jacket', 'White sneakers'],
    'Slim': ['Layered shirt', 'Textured pants', 'Denim jacket', 'Statement shoes'],
    'Average': ['Henley shirt', 'Khaki pants', 'Cardigan', 'Canvas shoes'],
    'Heavy': ['Comfortable sweater', 'Relaxed jeans', 'Zip hoodie', 'Comfortable sneakers']
  };

  const femaleAlternatives: Record<string, string[]> = {
    'Hourglass': ['Wrap dress', 'Fitted blazer', 'Heeled boots', 'Statement belt'],
    'Pear': ['Statement top', 'A-line skirt', 'Cropped jacket', 'Ankle boots'],
    'Apple': ['Flowy blouse', 'High-waisted pants', 'Long vest', 'Pointed flats'],
    'Rectangle': ['Peplum top', 'Skinny jeans', 'Structured cardigan', 'Block heels'],
    'Inverted Triangle': ['Soft sweater', 'Wide-leg pants', 'Flowy cardigan', 'Comfortable flats']
  };

  if (isMale) {
    return maleAlternatives[bodyType] || ['Versatile top', 'Comfortable bottom', 'Stylish shoes'];
  } else {
    return femaleAlternatives[bodyType] || ['Versatile top', 'Comfortable bottom', 'Stylish shoes'];
  }
};

const getAlternativeAccessories = (bodyType: string, isMale: boolean): string[] => {
  if (isMale) {
    return ['Casual watch', 'Leather belt', 'Sunglasses'];
  } else {
    return ['Delicate jewelry', 'Structured bag', 'Scarf'];
  }
};