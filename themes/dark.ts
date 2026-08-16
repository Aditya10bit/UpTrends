const darkTheme = {
  // Obsidian near-black backgrounds — moody, editorial, warm (not slate)
  background: '#0e0e0e',
  backgroundGradient: ['#0e0e0e', '#141313', '#191818'],
  card: 'rgba(32, 31, 31, 0.55)',
  cardSecondary: 'rgba(43, 42, 42, 0.6)',
  cardTertiary: 'rgba(53, 52, 52, 0.5)',
  backgroundSecondary: '#1c1b1b',
  backgroundAccent: '#171620',
  surfaceElevated: '#2b2a2a',
  surfaceOverlay: 'rgba(20, 19, 19, 0.95)',

  // Warm off-white text (paper on obsidian)
  text: '#e5e2e1',
  textSecondary: '#c4c7c7',
  textTertiary: '#8e9192',
  textAccent: '#a8a6ff',
  textMuted: '#6a6b6b',

  // Hairline borders — thin, editorial
  border: '#3a3939',
  borderLight: '#2b2a2a',
  borderAccent: '#454747',
  borderGlass: 'rgba(255, 255, 255, 0.10)',
  borderGlow: 'rgba(138, 132, 255, 0.30)', // the single "aura" accent

  // One restrained lavender accent (the AI/aura color) — every other accent
  // resolves here, killing the old rainbow.
  primary: '#a8a6ff',
  primaryDark: '#8b89e8',
  primaryLight: '#2a2840',
  primaryGlow: 'rgba(138, 132, 255, 0.22)',
  secondary: '#c9c6c5', // warm silver
  secondaryLight: '#2b2a2a',
  accent: '#7d7fe0',
  accentLight: '#262541',
  accentGlow: 'rgba(125, 127, 224, 0.22)',

  // Muted status colors — sage, amber, rose (no neon)
  success: '#8fbc9f',
  successLight: '#1f2b23',
  successGlow: 'rgba(143, 188, 159, 0.22)',
  warning: '#cfa05a',
  warningLight: '#2c2416',
  warningGlow: 'rgba(207, 160, 90, 0.22)',
  error: '#c97a7a',
  errorLight: '#2e1d1d',
  errorGlow: 'rgba(201, 122, 122, 0.22)',
  trending: '#b6a3d9',
  trendingLight: '#282135',
  trendingGlow: 'rgba(182, 163, 217, 0.22)',

  // Screen accents — ALL resolve to the single lavender accent
  homeAccent: '#a8a6ff',
  profileAccent: '#a8a6ff',
  wardrobeAccent: '#a8a6ff',
  twinningAccent: '#a8a6ff',
  friendsAccent: '#a8a6ff',
  makeOutfitAccent: '#a8a6ff',
  fashionAccent: '#a8a6ff',
  styleCheckAccent: '#a8a6ff',

  // Deep obsidian shadows
  shadow: 'rgba(0, 0, 0, 0.6)',
  shadowMedium: 'rgba(0, 0, 0, 0.7)',
  shadowStrong: 'rgba(0, 0, 0, 0.8)',
  shadowGlow: 'rgba(138, 132, 255, 0.35)',
  shadowInset: 'inset 0 1px 0 rgba(255, 255, 255, 0.05)',

  // Gradients — dark lavender-tinted obsidian (white text stays readable)
  gradientStart: '#a8a6ff',
  gradientEnd: '#7d7fe0',
  gradientHome: ['#232230', '#16151e', '#0e0e0e'],
  gradientProfile: ['#232230', '#16151e', '#0e0e0e'],
  gradientWardrobe: ['#232230', '#16151e', '#0e0e0e'],
  gradientTwinning: ['#232230', '#16151e', '#0e0e0e'],
  gradientFriends: ['#232230', '#16151e', '#0e0e0e'],
  gradientMakeOutfit: ['#232230', '#16151e', '#0e0e0e'],
  gradientFashion: ['#232230', '#16151e', '#0e0e0e'],
  gradientStyleCheck: ['#232230', '#16151e', '#0e0e0e'],
  gradientGlass: ['rgba(255, 255, 255, 0.10)', 'rgba(255, 255, 255, 0.05)'],

  // Muted indigo-blue for information
  info: '#7f8ec9',
  infoLight: '#1a2033',

  // Warm neutral grays (obsidian ramp)
  gray50: '#f5f2ee',
  gray100: '#e5e2e1',
  gray200: '#c4c7c7',
  gray300: '#9a9c9c',
  gray400: '#6a6b6b',
  gray500: '#4a4a4a',
  gray600: '#3a3939',
  gray700: '#2b2a2a',
  gray800: '#1c1b1b',
  gray900: '#0e0e0e',

  // Surface colors for layered UI
  surface: '#1c1b1b',
  surfaceSecondary: '#2b2a2a',
  surfaceTertiary: '#353434',

  // Interactive states
  hover: 'rgba(138, 132, 255, 0.08)',
  pressed: 'rgba(138, 132, 255, 0.12)',
  focus: 'rgba(138, 132, 255, 0.16)',

  // Status bar colors for different screens (single obsidian tone)
  statusBar: {
    home: '#0e0e0e',
    profile: '#0e0e0e',
    wardrobe: '#0e0e0e',
    twinning: '#0e0e0e',
    friends: '#0e0e0e',
    makeOutfit: '#0e0e0e',
    default: '#0e0e0e'
  },

  // ---- NEW: typography + shape tokens (same in both modes) ----
  fonts: {
    display: 'PlayfairDisplay_700Bold',
    displaySemibold: 'PlayfairDisplay_600SemiBold',
    body: 'Inter_400Regular',
    bodyMedium: 'Inter_500Medium',
    bodySemiBold: 'Inter_600SemiBold',
    bodyBold: 'Inter_700Bold',
    label: 'Inter_500Medium',
    labelCaps: 'Inter_600SemiBold',
  },
  radius: {
    sm: 8,
    md: 12,
    lg: 16,
    pill: 999,
  },
};
export default darkTheme;
