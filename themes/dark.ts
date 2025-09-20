const darkTheme = {
  // Enhanced rich, deep backgrounds for comfortable dark mode
  background: '#0d1117',
  backgroundGradient: ['#0d1117', '#161b22'],
  card: '#161b22',
  cardSecondary: '#21262d',
  cardTertiary: '#30363d',
  backgroundSecondary: '#1c2128',
  backgroundAccent: '#1a1f36',
  
  // High contrast text for excellent readability
  text: '#f0f6fc',
  textSecondary: '#8b949e',
  textTertiary: '#6e7681',
  textAccent: '#a78bfa',
  
  // Subtle borders that don't overpower
  border: '#30363d',
  borderLight: '#21262d',
  borderAccent: '#484f58',
  
  // Vibrant but not harsh colors for dark mode
  primary: '#7c3aed',        // Rich purple that pops on dark
  primaryDark: '#6d28d9',    // Darker variant for interactions
  primaryLight: '#1e1b4b',   // Very dark purple
  secondary: '#a78bfa',      // Lighter purple for accents
  secondaryLight: '#312e81', // Dark indigo
  accent: '#34d399',         // Bright green that's easy on eyes
  accentLight: '#064e3b',    // Very dark green
  
  // Enhanced status colors optimized for dark backgrounds
  success: '#22c55e',        // Vibrant green
  successLight: '#064e3b',   // Dark green background
  warning: '#f59e0b',        // Warm amber
  warningLight: '#451a03',   // Dark amber background
  error: '#ef4444',          // Clear red
  errorLight: '#450a0a',     // Dark red background
  trending: '#f472b6',       // Bright pink
  trendingLight: '#4c1d95',  // Dark pink background
  
  // Dynamic colors for different screens (dark mode variants)
  homeAccent: '#7c3aed',     // Purple for home
  profileAccent: '#06b6d4',  // Cyan for profile
  wardrobeAccent: '#f472b6', // Pink for wardrobe
  twinningAccent: '#fb7185', // Rose for twinning/date
  friendsAccent: '#3b82f6',  // Blue for friends
  makeOutfitAccent: '#a855f7', // Purple for make outfit
  
  // Deeper shadow for dark mode depth
  shadow: 'rgba(0, 0, 0, 0.6)',
  shadowMedium: 'rgba(0, 0, 0, 0.7)',
  shadowStrong: 'rgba(0, 0, 0, 0.8)',
  
  // Enhanced gradient combinations for dark mode
  gradientStart: '#7c3aed',
  gradientEnd: '#a78bfa',
  gradientHome: ['#7c3aed', '#a78bfa'],
  gradientProfile: ['#06b6d4', '#0891b2'],
  gradientWardrobe: ['#f472b6', '#ec4899'],
  gradientTwinning: ['#fb7185', '#f43f5e'],
  gradientFriends: ['#3b82f6', '#2563eb'],
  gradientMakeOutfit: ['#a855f7', '#9333ea'],
  
  // Additional colors for enhanced dark UI
  info: '#60a5fa',           // Bright blue for dark mode
  infoLight: '#1e3a8a',      // Dark blue background
  
  // Enhanced gray scale for dark mode
  gray50: '#f9fafb',
  gray100: '#f3f4f6',
  gray200: '#e5e7eb',
  gray300: '#d1d5db',
  gray400: '#9ca3af',
  gray500: '#6b7280',
  gray600: '#4b5563',
  gray700: '#374151',
  gray800: '#1f2937',
  gray900: '#111827',
  
  // Surface colors for layered UI
  surface: '#161b22',
  surfaceSecondary: '#21262d',
  surfaceTertiary: '#30363d',
  
  // Interactive states
  hover: 'rgba(124, 58, 237, 0.12)',
  pressed: 'rgba(124, 58, 237, 0.16)',
  focus: 'rgba(124, 58, 237, 0.20)',
  
  // Status bar colors for different screens (dark mode)
  statusBar: {
    home: '#7c3aed',
    profile: '#06b6d4',
    wardrobe: '#f472b6',
    twinning: '#fb7185',
    friends: '#3b82f6',
    makeOutfit: '#a855f7',
    default: '#7c3aed'
  }
};
export default darkTheme;
