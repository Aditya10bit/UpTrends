const lightTheme = {
  // Ivory "paper" editorial backgrounds — warm, gallery-like, lets photos lead
  background: '#f4f1ec',
  backgroundGradient: ['#f4f1ec', '#efeae2', '#e9e3d8'],
  card: 'rgba(255, 255, 255, 0.82)',
  cardSecondary: 'rgba(250, 248, 244, 0.9)',
  cardTertiary: 'rgba(244, 241, 235, 0.92)',
  backgroundSecondary: '#ece7de',
  backgroundAccent: '#eeeaf4',
  surfaceElevated: '#ffffff',
  surfaceOverlay: 'rgba(255, 255, 255, 0.94)',

  // Ink text with warm undertones (magazine print, not pure black)
  text: '#1b1a17',
  textSecondary: '#4a463f',
  textTertiary: '#8a857c',
  textAccent: '#5653c8',
  textMuted: '#a49f94',

  // Hairline borders — thin, editorial, low-contrast
  border: 'rgba(27, 26, 23, 0.10)',
  borderLight: 'rgba(27, 26, 23, 0.06)',
  borderAccent: 'rgba(27, 26, 23, 0.14)',
  borderGlass: 'rgba(255, 255, 255, 0.5)',
  borderGlow: 'rgba(86, 83, 200, 0.30)', // the single "aura" accent

  // One restrained lavender accent (the AI/aura color) — every other accent
  // resolves here, killing the old rainbow.
  primary: '#5653c8',
  primaryDark: '#4441ab',
  primaryLight: '#e3e1f6',
  primaryGlow: 'rgba(86, 83, 200, 0.16)',
  secondary: '#6f6c66',
  secondaryLight: '#ece7de',
  accent: '#4a46b0',
  accentLight: '#e1def4',
  accentGlow: 'rgba(74, 70, 176, 0.15)',

  // Muted status colors — sage, amber, rose (no neon)
  success: '#5f8f7d',
  successLight: '#e3eee7',
  successGlow: 'rgba(95, 143, 125, 0.18)',
  warning: '#a8894f',
  warningLight: '#f2ead9',
  warningGlow: 'rgba(168, 137, 79, 0.18)',
  error: '#b06565',
  errorLight: '#f2e2e2',
  errorGlow: 'rgba(176, 101, 101, 0.18)',
  trending: '#8a76b3',
  trendingLight: '#ebe6f2',
  trendingGlow: 'rgba(138, 118, 179, 0.18)',

  // Screen accents — ALL resolve to the single lavender accent
  homeAccent: '#5653c8',
  profileAccent: '#5653c8',
  wardrobeAccent: '#5653c8',
  twinningAccent: '#5653c8',
  friendsAccent: '#5653c8',
  makeOutfitAccent: '#5653c8',
  fashionAccent: '#5653c8',
  styleCheckAccent: '#5653c8',

  // Warm shadows
  shadow: 'rgba(27, 26, 23, 0.08)',
  shadowMedium: 'rgba(27, 26, 23, 0.12)',
  shadowStrong: 'rgba(27, 26, 23, 0.18)',
  shadowGlow: 'rgba(86, 83, 200, 0.18)',
  shadowInset: 'inset 0 1px 0 rgba(255, 255, 255, 0.6)',

  // Gradients stay DARK (lavender family) so white text on headers keeps working
  gradientStart: '#5653c8',
  gradientEnd: '#4a46b0',
  gradientHome: ['#5653c8', '#4a46b0', '#3b3a9e'],
  gradientProfile: ['#5653c8', '#4a46b0', '#3b3a9e'],
  gradientWardrobe: ['#5653c8', '#4a46b0', '#3b3a9e'],
  gradientTwinning: ['#5653c8', '#4a46b0', '#3b3a9e'],
  gradientFriends: ['#5653c8', '#4a46b0', '#3b3a9e'],
  gradientMakeOutfit: ['#5653c8', '#4a46b0', '#3b3a9e'],
  gradientFashion: ['#5653c8', '#4a46b0', '#3b3a9e'],
  gradientStyleCheck: ['#5653c8', '#4a46b0', '#3b3a9e'],
  gradientGlass: ['rgba(255, 255, 255, 0.6)', 'rgba(255, 255, 255, 0.2)'],

  // Muted indigo-blue for information
  info: '#6b7bbd',
  infoLight: '#e6e9f6',

  // Warm neutral grays (avoiding cool slate)
  gray50: '#faf8f5',
  gray100: '#f3f0ea',
  gray200: '#e6e1d8',
  gray300: '#d4cec2',
  gray400: '#b3aca0',
  gray500: '#8a857c',
  gray600: '#6b675f',
  gray700: '#4a463f',
  gray800: '#2b2926',
  gray900: '#1b1a17',

  // Surface colors for layered UI
  surface: 'rgba(255, 255, 255, 0.85)',
  surfaceSecondary: 'rgba(250, 248, 244, 0.9)',
  surfaceTertiary: 'rgba(244, 241, 235, 0.85)',

  // Interactive states
  hover: 'rgba(86, 83, 200, 0.06)',
  pressed: 'rgba(86, 83, 200, 0.10)',
  focus: 'rgba(86, 83, 200, 0.14)',

  // Status bar colors for different screens (single ivory tone)
  statusBar: {
    home: '#f4f1ec',
    profile: '#f4f1ec',
    wardrobe: '#f4f1ec',
    twinning: '#f4f1ec',
    friends: '#f4f1ec',
    makeOutfit: '#f4f1ec',
    default: '#f4f1ec'
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
export default lightTheme;
