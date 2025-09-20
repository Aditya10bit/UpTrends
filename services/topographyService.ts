export interface TopographyData {
  location: string;
  region: string;
  climate: string;
  terrain: string;
  culturalStyle: string;
  seasonalConsiderations: string;
  localFashionTrends: string[];
  coordinates: {
    latitude: number;
    longitude: number;
  };
}

// Cache to store topography data
interface TopographyCache {
  data: TopographyData;
  timestamp: number;
  coordinates: string;
}

let topographyCache: TopographyCache | null = null;
const CACHE_DURATION = 60 * 60 * 1000; // 1 hour

export const getLocationTopography = async (latitude?: number, longitude?: number): Promise<TopographyData> => {
  try {
    // Default to Delhi coordinates if not provided
    const lat = latitude ?? 28.6139;
    const lon = longitude ?? 77.2090;
    const coordinateKey = `${lat.toFixed(4)},${lon.toFixed(4)}`;

    console.log('🌍 Getting topography for coordinates:', { lat, lon });

    // Check cache first
    if (topographyCache &&
      topographyCache.coordinates === coordinateKey &&
      Date.now() - topographyCache.timestamp < CACHE_DURATION) {
      console.log('📦 Using cached topography data');
      return topographyCache.data;
    }

    // Get location name using reverse geocoding
    let locationName = 'Your Location';
    let region = 'India';

    try {
      const geocodeResponse = await fetch(
        `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${lat}&longitude=${lon}&localityLanguage=en`
      );
      if (geocodeResponse.ok) {
        const geocodeData = await geocodeResponse.json();
        locationName = geocodeData.city || geocodeData.locality || geocodeData.principalSubdivision || 'Your Location';
        region = geocodeData.countryName || 'India';
        console.log('📍 Location details:', { locationName, region });
      }
    } catch (geocodeError) {
      console.log('📍 Geocoding failed, using coordinate-based location analysis');
      const locationData = analyzeLocationFromCoordinates(lat, lon);
      locationName = locationData.name;
      region = locationData.region;
    }

    // Analyze topography based on coordinates and location
    const topographyData = analyzeTopographyData(lat, lon, locationName, region);

    // Cache the topography data
    topographyCache = {
      data: topographyData,
      timestamp: Date.now(),
      coordinates: coordinateKey
    };

    console.log('✅ Topography data generated:', topographyData);
    return topographyData;
  } catch (error) {
    console.error('Topography analysis error:', error);
    return getDefaultTopographyData(latitude, longitude);
  }
};

const analyzeLocationFromCoordinates = (latitude: number, longitude: number): { name: string; region: string } => {
  // Comprehensive location mapping for major cities and regions
  const locations = [
    // Major Indian Cities with regional characteristics
    { lat: 28.6139, lon: 77.2090, name: 'Delhi', region: 'North India', radius: 0.5 },
    { lat: 19.0760, lon: 72.8777, name: 'Mumbai', region: 'West India', radius: 0.3 },
    { lat: 12.9716, lon: 77.5946, name: 'Bangalore', region: 'South India', radius: 0.3 },
    { lat: 13.0827, lon: 80.2707, name: 'Chennai', region: 'South India', radius: 0.3 },
    { lat: 22.5726, lon: 88.3639, name: 'Kolkata', region: 'East India', radius: 0.3 },
    { lat: 17.3850, lon: 78.4867, name: 'Hyderabad', region: 'South India', radius: 0.3 },
    { lat: 26.9124, lon: 75.7873, name: 'Jaipur', region: 'North India', radius: 0.3 },
    { lat: 21.1458, lon: 79.0882, name: 'Nagpur', region: 'Central India', radius: 0.3 },
    { lat: 23.0225, lon: 72.5714, name: 'Ahmedabad', region: 'West India', radius: 0.3 },
    { lat: 15.2993, lon: 74.1240, name: 'Goa', region: 'West India', radius: 0.2 },
    { lat: 30.7333, lon: 76.7794, name: 'Chandigarh', region: 'North India', radius: 0.2 },
    { lat: 25.5941, lon: 85.1376, name: 'Patna', region: 'East India', radius: 0.3 },
    { lat: 26.8467, lon: 80.9462, name: 'Lucknow', region: 'North India', radius: 0.3 },
    { lat: 18.5204, lon: 73.8567, name: 'Pune', region: 'West India', radius: 0.3 },
  ];

  // Find closest city within reasonable radius
  let minDistance = Infinity;
  let closestLocation = { name: 'Your Location', region: 'India' };

  locations.forEach(location => {
    const distance = Math.sqrt(
      Math.pow(latitude - location.lat, 2) + Math.pow(longitude - location.lon, 2)
    );

    if (distance <= location.radius && distance < minDistance) {
      minDistance = distance;
      closestLocation = { name: location.name, region: location.region };
    }
  });

  // If no specific city found, determine region based on coordinates
  if (closestLocation.name === 'Your Location') {
    if (latitude >= 8 && latitude <= 37 && longitude >= 68 && longitude <= 97) {
      // India region analysis
      if (latitude >= 28 && longitude >= 76 && longitude <= 78) {
        closestLocation = { name: 'Delhi NCR', region: 'North India' };
      } else if (latitude >= 18 && latitude <= 20 && longitude >= 72 && longitude <= 73) {
        closestLocation = { name: 'Mumbai Region', region: 'West India' };
      } else if (latitude >= 12 && latitude <= 13 && longitude >= 77 && longitude <= 78) {
        closestLocation = { name: 'Bangalore Region', region: 'South India' };
      } else if (latitude >= 25) {
        closestLocation = { name: 'Northern India', region: 'North India' };
      } else if (latitude <= 15) {
        closestLocation = { name: 'Southern India', region: 'South India' };
      } else if (longitude <= 75) {
        closestLocation = { name: 'Western India', region: 'West India' };
      } else {
        closestLocation = { name: 'Eastern India', region: 'East India' };
      }
    }
  }

  return closestLocation;
};

const analyzeTopographyData = (latitude: number, longitude: number, locationName: string, region: string): TopographyData => {
  // Analyze climate based on latitude and known regional characteristics
  let climate = 'Tropical';
  let terrain = 'Plains';
  let culturalStyle = 'Contemporary Indian';
  let seasonalConsiderations = 'Year-round warm weather';
  let localFashionTrends: string[] = [];

  // Regional analysis for India
  if (region.includes('India')) {
    // Climate analysis based on latitude and region
    if (latitude > 30) {
      climate = 'Temperate';
      seasonalConsiderations = 'Distinct seasons with cold winters and warm summers';
    } else if (latitude > 25) {
      climate = 'Semi-arid to Subtropical';
      seasonalConsiderations = 'Hot summers, mild winters, monsoon season';
    } else if (latitude > 15) {
      climate = 'Tropical';
      seasonalConsiderations = 'Warm year-round with monsoon seasons';
    } else {
      climate = 'Equatorial';
      seasonalConsiderations = 'Consistently warm and humid';
    }

    // Terrain analysis based on coordinates
    if (latitude > 28 && longitude > 76 && longitude < 78) {
      terrain = 'Plains with urban landscape';
    } else if (latitude > 25 && latitude < 30) {
      terrain = 'Desert and semi-arid plains';
    } else if (latitude < 15 && longitude > 74 && longitude < 78) {
      terrain = 'Coastal plains and hills';
    } else if (longitude > 88) {
      terrain = 'River delta and plains';
    } else {
      terrain = 'Mixed plains and plateaus';
    }

    // Cultural style based on region
    switch (region) {
      case 'North India':
        culturalStyle = 'North Indian Contemporary';
        localFashionTrends = ['Kurta-jeans fusion', 'Ethnic-western mix', 'Layered looks', 'Statement accessories'];
        break;
      case 'South India':
        culturalStyle = 'South Indian Modern';
        localFashionTrends = ['Cotton comfort wear', 'Traditional-modern blend', 'Bright colors', 'Handloom fabrics'];
        break;
      case 'West India':
        culturalStyle = 'Western Indian Chic';
        localFashionTrends = ['Business casual', 'Coastal comfort', 'Vibrant prints', 'Designer fusion'];
        break;
      case 'East India':
        culturalStyle = 'East Indian Artistic';
        localFashionTrends = ['Intellectual casual', 'Handwoven textiles', 'Cultural motifs', 'Artistic expressions'];
        break;
      default:
        culturalStyle = 'Contemporary Indian';
        localFashionTrends = ['Fusion wear', 'Comfortable casuals', 'Seasonal adaptability', 'Cultural elements'];
    }

    // City-specific adjustments
    switch (locationName.toLowerCase()) {
      case 'mumbai':
        localFashionTrends = ['Business chic', 'Monsoon-ready', 'Bollywood inspired', 'Coastal casual'];
        break;
      case 'delhi':
        localFashionTrends = ['Power dressing', 'Seasonal layers', 'Designer labels', 'Political chic'];
        break;
      case 'bangalore':
        localFashionTrends = ['Tech casual', 'Weather adaptive', 'International styles', 'Startup chic'];
        break;
      case 'kolkata':
        localFashionTrends = ['Intellectual style', 'Cultural fusion', 'Handloom appreciation', 'Artistic flair'];
        break;
      case 'chennai':
        localFashionTrends = ['Traditional modern', 'Cotton comfort', 'Temple jewelry', 'South Indian elegance'];
        break;
      case 'hyderabad':
        localFashionTrends = ['Nizami elegance', 'Tech professional', 'Pearl accessories', 'Royal inspired'];
        break;
      case 'pune':
        localFashionTrends = ['Student casual', 'Cultural blend', 'Comfortable chic', 'Educational elegance'];
        break;
      case 'jaipur':
        localFashionTrends = ['Royal heritage', 'Rajasthani prints', 'Jewelry focus', 'Desert colors'];
        break;
      case 'goa':
        localFashionTrends = ['Beach casual', 'Bohemian style', 'Tropical prints', 'Vacation vibes'];
        break;
    }
  }

  return {
    location: locationName,
    region: region,
    climate: climate,
    terrain: terrain,
    culturalStyle: culturalStyle,
    seasonalConsiderations: seasonalConsiderations,
    localFashionTrends: localFashionTrends,
    coordinates: {
      latitude: latitude,
      longitude: longitude
    }
  };
};

const getDefaultTopographyData = (latitude?: number, longitude?: number): TopographyData => {
  const lat = latitude || 28.6139;
  const lon = longitude || 77.2090;

  return {
    location: 'Delhi',
    region: 'North India',
    climate: 'Semi-arid',
    terrain: 'Plains with urban landscape',
    culturalStyle: 'North Indian Contemporary',
    seasonalConsiderations: 'Hot summers, mild winters, monsoon season',
    localFashionTrends: ['Kurta-jeans fusion', 'Ethnic-western mix', 'Layered looks', 'Statement accessories'],
    coordinates: {
      latitude: lat,
      longitude: lon
    }
  };
};

export const clearTopographyCache = () => {
  topographyCache = null;
  console.log('🗑️ Topography cache cleared');
};

export const getTopographyBasedStyling = (topography: TopographyData, userProfile?: any) => {
  const styling = {
    recommendedColors: [] as string[],
    fabricSuggestions: [] as string[],
    styleTips: [] as string[],
    culturalElements: [] as string[]
  };

  // Color recommendations based on climate and region
  switch (topography.climate) {
    case 'Tropical':
    case 'Equatorial':
      styling.recommendedColors = ['White', 'Light Blue', 'Coral', 'Mint', 'Beige', 'Pastel Pink'];
      styling.fabricSuggestions = ['Cotton', 'Linen', 'Bamboo', 'Modal', 'Breathable synthetics'];
      break;
    case 'Semi-arid':
      styling.recommendedColors = ['Earth tones', 'Khaki', 'Rust', 'Olive', 'Cream', 'Terracotta'];
      styling.fabricSuggestions = ['Cotton', 'Linen', 'Lightweight wool', 'Silk blends'];
      break;
    case 'Temperate':
      styling.recommendedColors = ['Navy', 'Burgundy', 'Forest Green', 'Charcoal', 'Mustard', 'Deep Purple'];
      styling.fabricSuggestions = ['Wool', 'Cotton blends', 'Cashmere', 'Denim', 'Flannel'];
      break;
    default:
      styling.recommendedColors = ['Versatile neutrals', 'Seasonal colors', 'Regional favorites'];
      styling.fabricSuggestions = ['Adaptive fabrics', 'Seasonal materials'];
  }

  // Regional styling tips
  if (topography.region.includes('India')) {
    styling.culturalElements = [
      'Incorporate traditional prints',
      'Mix ethnic and western elements',
      'Consider local jewelry styles',
      'Respect cultural sensitivities'
    ];

    // Region-specific tips
    switch (topography.region) {
      case 'North India':
        styling.styleTips = [
          'Layer for temperature variations',
          'Embrace bold colors and patterns',
          'Mix traditional kurtas with modern bottoms',
          'Accessorize with statement pieces'
        ];
        break;
      case 'South India':
        styling.styleTips = [
          'Prioritize comfort in humid weather',
          'Choose breathable cotton fabrics',
          'Incorporate temple jewelry',
          'Opt for traditional-modern fusion'
        ];
        break;
      case 'West India':
        styling.styleTips = [
          'Dress for business and leisure',
          'Choose monsoon-appropriate fabrics',
          'Embrace coastal casual styles',
          'Mix international and local trends'
        ];
        break;
      case 'East India':
        styling.styleTips = [
          'Appreciate handwoven textiles',
          'Choose intellectual casual styles',
          'Incorporate cultural motifs',
          'Balance tradition with modernity'
        ];
        break;
    }
  }

  return styling;
};