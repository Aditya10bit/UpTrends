export interface WeatherData {
  temperature: number;
  condition: string;
  description: string;
  humidity: number;
  windSpeed: number;
  location: string;
  icon: string;
  forecast: {
    morning: { temp: number; condition: string };
    afternoon: { temp: number; condition: string };
    evening: { temp: number; condition: string };
  };
}

// Cache to store weather data and prevent frequent API calls
interface WeatherCache {
  data: WeatherData;
  timestamp: number;
  coordinates: string;
}

let weatherCache: WeatherCache | null = null;
const CACHE_DURATION = 10 * 60 * 1000; // 10 minutes

export const getCurrentWeather = async (latitude?: number, longitude?: number): Promise<WeatherData> => {
  try {
    // Only use default coordinates if explicitly no coordinates provided
    // This prevents defaulting to Delhi when user location is being requested
    const lat = latitude ?? 28.6139; // Default to Delhi only if undefined
    const lon = longitude ?? 77.2090;
    const coordinateKey = `${lat.toFixed(4)},${lon.toFixed(4)}`;

    console.log('🌍 Getting weather for coordinates:', { lat, lon });

    // Check cache first
    if (weatherCache &&
      weatherCache.coordinates === coordinateKey &&
      Date.now() - weatherCache.timestamp < CACHE_DURATION) {
      console.log('📦 Using cached weather data');
      return weatherCache.data;
    }

    // Get location name first using reverse geocoding
    let locationName = 'Your Location';
    try {
      const geocodeResponse = await fetch(
        `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${lat}&longitude=${lon}&localityLanguage=en`
      );
      if (geocodeResponse.ok) {
        const geocodeData = await geocodeResponse.json();
        locationName = geocodeData.city || geocodeData.locality || geocodeData.principalSubdivision || 'Your Location';
        console.log('📍 Location name:', locationName);
      }
    } catch (geocodeError) {
      console.log('📍 Geocoding failed, using coordinate-based location name');
      locationName = getLocationFromCoordinates(lat, lon);
    }

    // Try Open-Meteo API (free, no key required)
    try {
      const openMeteoResponse = await fetch(
        `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current_weather=true&hourly=temperature_2m,weathercode,relative_humidity_2m&timezone=auto`
      );

      if (openMeteoResponse.ok) {
        const openMeteoData = await openMeteoResponse.json();
        console.log('🌤️ Open-Meteo API response:', openMeteoData);

        const currentTemp = Math.round(openMeteoData.current_weather.temperature);
        const weatherCode = openMeteoData.current_weather.weathercode;
        const condition = getConditionFromCode(weatherCode);
        const humidity = openMeteoData.hourly?.relative_humidity_2m?.[0] || 65;

        const weatherData = {
          temperature: currentTemp,
          condition: condition,
          description: `${condition.toLowerCase()} skies`,
          humidity: Math.round(humidity),
          windSpeed: Math.round(openMeteoData.current_weather.windspeed || 0),
          location: locationName,
          icon: getWeatherIcon(condition),
          forecast: {
            morning: { temp: currentTemp - 2, condition: condition },
            afternoon: { temp: currentTemp + 4, condition: condition },
            evening: { temp: currentTemp - 1, condition: condition },
          }
        };

        // Cache the weather data
        weatherCache = {
          data: weatherData,
          timestamp: Date.now(),
          coordinates: coordinateKey
        };

        console.log('✅ Weather data from Open-Meteo:', weatherData);
        return weatherData;
      }
    } catch (openMeteoError) {
      console.log('❌ Open-Meteo API failed:', openMeteoError);
    }

    // If API fails, return consistent location-aware mock data
    const mockData = getMockWeatherData(lat, lon, locationName);

    // Cache the mock data too
    weatherCache = {
      data: mockData,
      timestamp: Date.now(),
      coordinates: coordinateKey
    };

    return mockData;
  } catch (error) {
    console.error('Weather API error:', error);
    return getMockWeatherData(latitude, longitude);
  }
};

const getConditionFromCode = (code: number): string => {
  // WMO Weather interpretation codes
  if (code === 0) return 'Clear';
  if (code >= 1 && code <= 3) return 'Clouds';
  if (code >= 45 && code <= 48) return 'Fog';
  if (code >= 51 && code <= 67) return 'Rain';
  if (code >= 71 && code <= 77) return 'Snow';
  if (code >= 80 && code <= 82) return 'Rain';
  if (code >= 85 && code <= 86) return 'Snow';
  if (code >= 95 && code <= 99) return 'Thunderstorm';
  return 'Clear';
};

const getLocationFromCoordinates = (latitude: number, longitude: number): string => {
  // Comprehensive location mapping for major cities and regions
  const cities = [
    // Major Indian Cities
    { lat: 28.6139, lon: 77.2090, name: 'Delhi', radius: 0.5 },
    { lat: 19.0760, lon: 72.8777, name: 'Mumbai', radius: 0.3 },
    { lat: 12.9716, lon: 77.5946, name: 'Bangalore', radius: 0.3 },
    { lat: 13.0827, lon: 80.2707, name: 'Chennai', radius: 0.3 },
    { lat: 22.5726, lon: 88.3639, name: 'Kolkata', radius: 0.3 },
    { lat: 17.3850, lon: 78.4867, name: 'Hyderabad', radius: 0.3 },
    { lat: 26.9124, lon: 75.7873, name: 'Jaipur', radius: 0.3 },
    { lat: 21.1458, lon: 79.0882, name: 'Nagpur', radius: 0.3 },
    { lat: 23.0225, lon: 72.5714, name: 'Ahmedabad', radius: 0.3 },
    { lat: 15.2993, lon: 74.1240, name: 'Goa', radius: 0.2 },
    { lat: 30.7333, lon: 76.7794, name: 'Chandigarh', radius: 0.2 },
    { lat: 25.5941, lon: 85.1376, name: 'Patna', radius: 0.3 },
    { lat: 26.8467, lon: 80.9462, name: 'Lucknow', radius: 0.3 },
    { lat: 18.5204, lon: 73.8567, name: 'Pune', radius: 0.3 },
    { lat: 22.3072, lon: 73.1812, name: 'Vadodara', radius: 0.2 },
    { lat: 21.1702, lon: 72.8311, name: 'Surat', radius: 0.2 },
    { lat: 28.4595, lon: 77.0266, name: 'Gurgaon', radius: 0.2 },
    { lat: 28.5355, lon: 77.3910, name: 'Noida', radius: 0.2 },

    // International Cities (for users abroad)
    { lat: 40.7128, lon: -74.0060, name: 'New York', radius: 0.5 },
    { lat: 51.5074, lon: -0.1278, name: 'London', radius: 0.3 },
    { lat: 35.6762, lon: 139.6503, name: 'Tokyo', radius: 0.5 },
    { lat: 1.3521, lon: 103.8198, name: 'Singapore', radius: 0.2 },
    { lat: 25.2048, lon: 55.2708, name: 'Dubai', radius: 0.3 },
    { lat: 37.7749, lon: -122.4194, name: 'San Francisco', radius: 0.3 },
  ];

  // Find closest city within reasonable radius
  let minDistance = Infinity;
  let closestCity = 'Your Location';

  cities.forEach(city => {
    const distance = Math.sqrt(
      Math.pow(latitude - city.lat, 2) + Math.pow(longitude - city.lon, 2)
    );

    // Only consider cities within their radius
    if (distance <= city.radius && distance < minDistance) {
      minDistance = distance;
      closestCity = city.name;
    }
  });

  // If no city found within radius, try to determine region
  if (closestCity === 'Your Location') {
    if (latitude >= 8 && latitude <= 37 && longitude >= 68 && longitude <= 97) {
      // India region
      if (latitude >= 28 && longitude >= 76 && longitude <= 78) return 'Delhi NCR';
      if (latitude >= 18 && latitude <= 20 && longitude >= 72 && longitude <= 73) return 'Mumbai Region';
      if (latitude >= 12 && latitude <= 13 && longitude >= 77 && longitude <= 78) return 'Bangalore Region';
      return 'India';
    } else if (latitude >= 24 && latitude <= 49 && longitude >= -125 && longitude <= -66) {
      return 'United States';
    } else if (latitude >= 49 && latitude <= 61 && longitude >= -141 && longitude <= -52) {
      return 'Canada';
    } else if (latitude >= 35 && latitude <= 71 && longitude >= -10 && longitude <= 40) {
      return 'Europe';
    }
  }

  return closestCity;
};

const getMockWeatherData = (latitude?: number, longitude?: number, locationName?: string): WeatherData => {
  // Use consistent weather based on location to avoid random changes
  const lat = latitude || 28.6139;
  const lon = longitude || 77.2090;

  const finalLocationName = locationName || getLocationFromCoordinates(lat, lon);

  // Generate consistent weather based on coordinates and current date
  const today = new Date();
  const dayOfYear = Math.floor((today.getTime() - new Date(today.getFullYear(), 0, 0).getTime()) / (1000 * 60 * 60 * 24));
  const locationSeed = Math.floor((Math.abs(lat) + Math.abs(lon)) * 1000) % 100;
  const dateSeed = dayOfYear % 10;

  // More realistic weather patterns based on location
  let baseTemp = 25; // Default temperature
  let conditions = ['Clear', 'Sunny', 'Partly Cloudy'];

  // Adjust based on latitude (climate zones)
  if (lat > 30) {
    // Northern regions - cooler
    baseTemp = 15 + (locationSeed % 15); // 15-30°C
    conditions = ['Clear', 'Clouds', 'Partly Cloudy'];
  } else if (lat > 20) {
    // Temperate regions
    baseTemp = 20 + (locationSeed % 15); // 20-35°C
    conditions = ['Clear', 'Sunny', 'Partly Cloudy', 'Clouds'];
  } else if (lat > 0) {
    // Tropical regions - warmer
    baseTemp = 25 + (locationSeed % 10); // 25-35°C
    conditions = ['Sunny', 'Clear', 'Partly Cloudy'];
  } else {
    // Southern hemisphere - adjust for seasons
    baseTemp = 18 + (locationSeed % 17); // 18-35°C
    conditions = ['Clear', 'Clouds', 'Partly Cloudy'];
  }

  // Add seasonal variation (simplified)
  const month = today.getMonth();
  if (month >= 11 || month <= 2) {
    // Winter months - cooler
    baseTemp -= 5;
  } else if (month >= 3 && month <= 5) {
    // Spring - moderate
    baseTemp += 0;
  } else if (month >= 6 && month <= 8) {
    // Summer - hotter
    baseTemp += 5;
  } else {
    // Autumn - moderate
    baseTemp -= 2;
  }

  // Ensure temperature is within reasonable bounds
  baseTemp = Math.max(10, Math.min(45, baseTemp));

  const condition = conditions[(locationSeed + dateSeed) % conditions.length];

  return {
    temperature: Math.round(baseTemp),
    condition: condition,
    description: `${condition.toLowerCase()} skies`,
    humidity: 45 + (locationSeed % 35), // 45-80% range
    windSpeed: 3 + (locationSeed % 12), // 3-15 km/h range
    location: finalLocationName,
    icon: getWeatherIcon(condition),
    forecast: {
      morning: { temp: Math.round(baseTemp - 4), condition: condition },
      afternoon: { temp: Math.round(baseTemp + 3), condition: condition },
      evening: { temp: Math.round(baseTemp - 2), condition: condition },
    }
  };
};

const getWeatherIcon = (condition: string): string => {
  const iconMap: { [key: string]: string } = {
    'Clear': 'sunny',
    'Sunny': 'sunny',
    'Clouds': 'cloudy',
    'Rain': 'rainy',
    'Drizzle': 'rainy',
    'Thunderstorm': 'thunderstorm',
    'Snow': 'snow',
    'Mist': 'cloudy',
    'Fog': 'cloudy',
  };

  return iconMap[condition] || 'partly-sunny';
};

export const clearWeatherCache = () => {
  weatherCache = null;
  console.log('🗑️ Weather cache cleared');
};

export const getWeatherBasedTheme = (condition: string, temperature: number) => {
  const themes = {
    sunny: {
      primary: '#FF6B35',
      secondary: '#F7931E',
      background: ['#FFE082', '#FFCC02'],
      accent: '#FF8F00',
      textColor: '#BF360C',
    },
    cloudy: {
      primary: '#607D8B',
      secondary: '#90A4AE',
      background: ['#CFD8DC', '#B0BEC5'],
      accent: '#455A64',
      textColor: '#263238',
    },
    rainy: {
      primary: '#3F51B5',
      secondary: '#5C6BC0',
      background: ['#C5CAE9', '#9FA8DA'],
      accent: '#303F9F',
      textColor: '#1A237E',
    },
    cold: {
      primary: '#00BCD4',
      secondary: '#26C6DA',
      background: ['#B2EBF2', '#80DEEA'],
      accent: '#0097A7',
      textColor: '#006064',
    },
    hot: {
      primary: '#FF5722',
      secondary: '#FF7043',
      background: ['#FFCCBC', '#FFAB91'],
      accent: '#D84315',
      textColor: '#BF360C',
    }
  };

  if (temperature > 30) return themes.hot;
  if (temperature < 15) return themes.cold;
  if (condition.toLowerCase().includes('rain')) return themes.rainy;
  if (condition.toLowerCase().includes('cloud')) return themes.cloudy;
  return themes.sunny;
};