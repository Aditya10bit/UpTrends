type Category = {
  title: string;
  icon: string;
  colors: [string, string];
  trend: string;
  description: string;
};

const categoryData : Record<string, Category> = {
  'todays-outfit': {
    title: "Today's Outfit",
    icon: '🌤️',
    colors: ['#FF6B35', '#F7931E'] as const,
    trend: 'Weather',
    description: 'Perfect outfit recommendations based on today\'s weather'
  },
  'male-street-style': {
    title: 'Street Style',
    icon: '🕶️',
    colors: ['#6366f1', '#8b5cf6'] as const,
    trend: 'Hot',
    description: 'Urban vibes that define modern masculinity'
  },
  'male-formal-wear': {
    title: 'Formal Wear',
    icon: '👔',
    colors: ['#2c3e50', '#34495e'] as const,
    trend: 'Classic',
    description: 'Professional elegance for the modern gentleman'
  },
  'male-gym-wear': {
    title: 'Gym Wear',
    icon: '💪',
    colors: ['#ff6b6b', '#ee5a24'] as const,
    trend: 'Trending',
    description: 'Performance meets style in every workout'
  },
  'male-date-night': {
    title: 'Date Night',
    icon: '💕',
    colors: ['#ff9ff3', '#f368e0'] as const,
    trend: 'Popular',
    description: 'Romance-ready looks that impress'
  },
  'male-party-wear': {
    title: 'Party Wear',
    icon: '🎉',
    colors: ['#feca57', '#ff9ff3'] as const,
    trend: 'Hot',
    description: 'Party-perfect outfits that steal the show'
  },
  'male-old-money': {
    title: 'Old Money',
    icon: '💎',
    colors: ['#3c6382', '#40739e'] as const,
    trend: 'Luxury',
    description: 'Timeless elegance with aristocratic charm'
  },
  'male-twinning': {
    title: 'Twinning',
    icon: '👫',
    colors: ['#ff6b9d', '#c44569'] as const,
    trend: 'New',
    description: 'Couple goals with coordinated style'
  },
  
  // Female categories
  'female-street-style': {
    title: 'Street Style',
    icon: '👗',
    colors: ['#667eea', '#764ba2'] as const,
    trend: 'Hot',
    description: 'Chic & edgy looks for the modern woman'
  },
  'female-office-wear': {
    title: 'Office Wear',
    icon: '👩‍💼',
    colors: ['#2c3e50', '#34495e'] as const,
    trend: 'Classic',
    description: 'Boss babe looks for professional success'
  },
  'female-gym-wear': {
    title: 'Gym Wear',
    icon: '🏃‍♀️',
    colors: ['#ff6b6b', '#ee5a24'] as const,
    trend: 'Trending',
    description: 'Fit & fabulous workout essentials'
  },
  'female-date-night': {
    title: 'Date Night',
    icon: '💃',
    colors: ['#ff9ff3', '#f368e0'] as const,
    trend: 'Popular',
    description: 'Date-ready looks that captivate'
  },
  'female-party-wear': {
    title: 'Party Wear',
    icon: '✨',
    colors: ['#feca57', '#ff9ff3'] as const,
    trend: 'Hot',
    description: 'Sparkle & shine at every celebration'
  },
  'female-elegant': {
    title: 'Elegant',
    icon: '👑',
    colors: ['#3c6382', '#40739e'] as const,
    trend: 'Luxury',
    description: 'Royal vibes with sophisticated grace'
  },
  'female-twinning': {
    title: 'Twinning',
    icon: '👫',
    colors: ['#ff6b9d', '#c44569'] as const,
    trend: 'New',
    description: 'Match made in fashion heaven'
  }
};

export default categoryData;