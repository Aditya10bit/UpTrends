type Outfit = {
  id: number;
  name: string;
  price: string;
  items: string;
  popularity: number;
  trending: boolean;
  tags: string[];
};

type Category = {
  title: string;
  icon: string;
  colors: [string, string];
  trend: string;
  description: string;
  outfits: Outfit[];
};

const categoryData : Record<string, Category> = {
  'male-street-style': {
    title: 'Street Style',
    icon: '🕶️',
    colors: ['#6366f1', '#8b5cf6'] as const,
    trend: 'Hot',
    description: 'Urban vibes that define modern masculinity',
    outfits: [
      { 
        id: 1, 
        name: 'Casual Denim Look', 
        price: '₹800-1200', 
        items: 'Jeans + T-shirt + Sneakers',
        popularity: 95,
        trending: true,
        tags: ['Casual', 'Weekend', 'Comfortable']
      },
      { 
        id: 2, 
        name: 'Oversized Hoodie', 
        price: '₹600-1000', 
        items: 'Hoodie + Joggers + Caps',
        popularity: 88,
        trending: true,
        tags: ['Cozy', 'Streetwear', 'Urban']
      },
      { 
        id: 3, 
        name: 'Layered Style', 
        price: '₹1000-1500', 
        items: 'Jacket + Shirt + Pants',
        popularity: 92,
        trending: false,
        tags: ['Stylish', 'Layered', 'Modern']
      },
    ]
  },
  'male-formal-wear': {
    title: 'Formal Wear',
    icon: '👔',
    colors: ['#2c3e50', '#34495e'] as const,
    trend: 'Classic',
    description: 'Professional elegance for the modern gentleman',
    outfits: [
      { 
        id: 1, 
        name: 'Business Suit', 
        price: '₹2000-3000', 
        items: 'Suit + Shirt + Tie + Shoes',
        popularity: 90,
        trending: false,
        tags: ['Professional', 'Meetings', 'Formal']
      },
      { 
        id: 2, 
        name: 'Smart Casual', 
        price: '₹1200-1800', 
        items: 'Blazer + Chinos + Shirt',
        popularity: 85,
        trending: true,
        tags: ['Smart', 'Versatile', 'Office']
      },
      { 
        id: 3, 
        name: 'Meeting Ready', 
        price: '₹1500-2200', 
        items: 'Formal Shirt + Trousers + Belt',
        popularity: 87,
        trending: false,
        tags: ['Corporate', 'Clean', 'Sharp']
      },
    ]
  },
  'male-gym-wear': {
    title: 'Gym Wear',
    icon: '💪',
    colors: ['#ff6b6b', '#ee5a24'] as const,
    trend: 'Trending',
    description: 'Performance meets style in every workout',
    outfits: [
      { 
        id: 1, 
        name: 'Workout Essentials', 
        price: '₹500-800', 
        items: 'Tank Top + Shorts + Sneakers',
        popularity: 93,
        trending: true,
        tags: ['Fitness', 'Performance', 'Breathable']
      },
      { 
        id: 2, 
        name: 'Cardio Ready', 
        price: '₹600-900', 
        items: 'Dri-fit Tee + Track Pants',
        popularity: 89,
        trending: true,
        tags: ['Cardio', 'Moisture-wicking', 'Flexible']
      },
      { 
        id: 3, 
        name: 'Gym Beast Mode', 
        price: '₹700-1000', 
        items: 'Compression Wear + Gloves',
        popularity: 91,
        trending: false,
        tags: ['Strength', 'Compression', 'Beast']
      },
    ]
  },
  'male-date-night': {
    title: 'Date Night',
    icon: '💕',
    colors: ['#ff9ff3', '#f368e0'] as const,
    trend: 'Popular',
    description: 'Romance-ready looks that impress',
    outfits: [
      { 
        id: 1, 
        name: 'Romantic Dinner', 
        price: '₹1200-1800', 
        items: 'Shirt + Chinos + Loafers',
        popularity: 94,
        trending: true,
        tags: ['Romantic', 'Dinner', 'Elegant']
      },
      { 
        id: 2, 
        name: 'Casual Date', 
        price: '₹800-1200', 
        items: 'Polo + Jeans + Casual Shoes',
        popularity: 86,
        trending: false,
        tags: ['Casual', 'Comfortable', 'Relaxed']
      },
      { 
        id: 3, 
        name: 'Special Evening', 
        price: '₹1500-2500', 
        items: 'Blazer + Shirt + Dark Jeans',
        popularity: 92,
        trending: true,
        tags: ['Special', 'Evening', 'Sophisticated']
      },
    ]
  },
  'male-party-wear': {
    title: 'Party Wear',
    icon: '🎉',
    colors: ['#feca57', '#ff9ff3'] as const,
    trend: 'Hot',
    description: 'Party-perfect outfits that steal the show',
    outfits: [
      { 
        id: 1, 
        name: 'Club Night', 
        price: '₹1000-1500', 
        items: 'Printed Shirt + Black Jeans',
        popularity: 88,
        trending: true,
        tags: ['Club', 'Night', 'Vibrant']
      },
      { 
        id: 2, 
        name: 'House Party', 
        price: '₹800-1200', 
        items: 'Graphic Tee + Shorts + Sneakers',
        popularity: 84,
        trending: false,
        tags: ['House Party', 'Casual', 'Fun']
      },
      { 
        id: 3, 
        name: 'Birthday Bash', 
        price: '₹1200-1800', 
        items: 'Colorful Shirt + Chinos',
        popularity: 90,
        trending: true,
        tags: ['Birthday', 'Celebration', 'Colorful']
      },
    ]
  },
  'male-old-money': {
    title: 'Old Money',
    icon: '💎',
    colors: ['#3c6382', '#40739e'] as const,
    trend: 'Luxury',
    description: 'Timeless elegance with aristocratic charm',
    outfits: [
      { 
        id: 1, 
        name: 'Classic Elegance', 
        price: '₹2000-3000', 
        items: 'Polo + Chinos + Loafers',
        popularity: 91,
        trending: false,
        tags: ['Classic', 'Elegant', 'Timeless']
      },
      { 
        id: 2, 
        name: 'Preppy Style', 
        price: '₹1500-2200', 
        items: 'Sweater + Shirt + Trousers',
        popularity: 87,
        trending: true,
        tags: ['Preppy', 'Academic', 'Refined']
      },
      { 
        id: 3, 
        name: 'Timeless Look', 
        price: '₹1800-2500', 
        items: 'Blazer + Turtleneck + Pants',
        popularity: 89,
        trending: false,
        tags: ['Timeless', 'Sophisticated', 'Heritage']
      },
    ]
  },
  'male-twinning': {
    title: 'Twinning',
    icon: '👫',
    colors: ['#ff6b9d', '#c44569'] as const,
    trend: 'New',
    description: 'Couple goals with coordinated style',
    outfits: [
      { 
        id: 1, 
        name: 'Casual Couple', 
        price: '₹700-1100', 
        items: 'Matching T-shirts + Jeans + Sneakers',
        popularity: 86,
        trending: true,
        tags: ['Couple', 'Matching', 'Casual']
      },
      { 
        id: 2, 
        name: 'Date Night Duo', 
        price: '₹1400-2000', 
        items: 'Coordinated Shirts + Chinos + Loafers',
        popularity: 92,
        trending: true,
        tags: ['Date', 'Coordinated', 'Romantic']
      },
      { 
        id: 3, 
        name: 'Party Pair', 
        price: '₹1100-1600', 
        items: 'Theme Shirts + Dark Jeans + Casual Shoes',
        popularity: 88,
        trending: false,
        tags: ['Party', 'Theme', 'Fun']
      },
    ]
  },
  // Female categories (same structure)
  'female-street-style': {
    title: 'Street Style',
    icon: '👗',
    colors: ['#667eea', '#764ba2'] as const,
    trend: 'Hot',
    description: 'Chic & edgy looks for the modern woman',
    outfits: [
      { 
        id: 1, 
        name: 'Casual Chic Look', 
        price: '₹900-1400', 
        items: 'High-waist Jeans + Crop Top + White Sneakers',
        popularity: 95,
        trending: true,
        tags: ['Chic', 'Casual', 'Trendy']
      },
      { 
        id: 2, 
        name: 'Oversized Comfort', 
        price: '₹700-1100', 
        items: 'Oversized Hoodie + Leggings + Chunky Sneakers',
        popularity: 89,
        trending: true,
        tags: ['Comfort', 'Oversized', 'Cozy']
      },
      { 
        id: 3, 
        name: 'Layered Boho', 
        price: '₹1200-1700', 
        items: 'Denim Jacket + Flowy Top + Skinny Jeans',
        popularity: 87,
        trending: false,
        tags: ['Boho', 'Layered', 'Artistic']
      },
    ]
  },
  'female-office-wear': {
    title: 'Office Wear',
    icon: '👩‍💼',
    colors: ['#2c3e50', '#34495e'] as const,
    trend: 'Classic',
    description: 'Boss babe looks for professional success',
    outfits: [
      { 
        id: 1, 
        name: 'Power Suit', 
        price: '₹2500-3500', 
        items: 'Blazer + Matching Trousers + Silk Blouse + Heels',
        popularity: 93,
        trending: true,
        tags: ['Power', 'Professional', 'Authority']
      },
      { 
        id: 2, 
        name: 'Smart Professional', 
        price: '₹1500-2200', 
        items: 'Pencil Skirt + Button-down Shirt + Blazer',
        popularity: 88,
        trending: false,
        tags: ['Smart', 'Classic', 'Professional']
      },
      { 
        id: 3, 
        name: 'Modern Executive', 
        price: '₹1800-2600', 
        items: 'Shift Dress + Cardigan + Pointed Flats',
        popularity: 90,
        trending: true,
        tags: ['Modern', 'Executive', 'Elegant']
      },
    ]
  },
  'female-gym-wear': {
    title: 'Gym Wear',
    icon: '🏃‍♀️',
    colors: ['#ff6b6b', '#ee5a24'] as const,
    trend: 'Trending',
    description: 'Fit & fabulous workout essentials',
    outfits: [
      { 
        id: 1, 
        name: 'Yoga Essentials', 
        price: '₹600-900', 
        items: 'Sports Bra + High-waist Leggings + Training Shoes',
        popularity: 94,
        trending: true,
        tags: ['Yoga', 'Flexible', 'Comfortable']
      },
      { 
        id: 2, 
        name: 'Cardio Ready', 
        price: '₹700-1000', 
        items: 'Moisture-wicking Tank + Shorts + Running Shoes',
        popularity: 91,
        trending: true,
        tags: ['Cardio', 'Performance', 'Breathable']
      },
      { 
        id: 3, 
        name: 'Strength Training', 
        price: '₹800-1200', 
        items: 'Compression Top + Capri Leggings + Cross-trainers',
        popularity: 89,
        trending: false,
        tags: ['Strength', 'Support', 'Durable']
      },
    ]
  },
  'female-date-night': {
    title: 'Date Night',
    icon: '💃',
    colors: ['#ff9ff3', '#f368e0'] as const,
    trend: 'Popular',
    description: 'Date-ready looks that captivate',
    outfits: [
      { 
        id: 1, 
        name: 'Romantic Dinner', 
        price: '₹1500-2200', 
        items: 'Little Black Dress + Heels + Statement Jewelry',
        popularity: 96,
        trending: true,
        tags: ['Romantic', 'Elegant', 'Classic']
      },
      { 
        id: 2, 
        name: 'Casual Coffee Date', 
        price: '₹900-1400', 
        items: 'Midi Skirt + Cute Top + Ankle Boots',
        popularity: 85,
        trending: false,
        tags: ['Casual', 'Cute', 'Comfortable']
      },
      { 
        id: 3, 
        name: 'Special Evening', 
        price: '₹2000-3000', 
        items: 'Cocktail Dress + Clutch + Strappy Heels',
        popularity: 93,
        trending: true,
        tags: ['Special', 'Glamorous', 'Evening']
      },
    ]
  },
  'female-party-wear': {
    title: 'Party Wear',
    icon: '✨',
    colors: ['#feca57', '#ff9ff3'] as const,
    trend: 'Hot',
    description: 'Sparkle & shine at every celebration',
    outfits: [
      { 
        id: 1, 
        name: 'Club Night', 
        price: '₹1200-1800', 
        items: 'Bodycon Dress + Statement Earrings + Heels',
        popularity: 92,
        trending: true,
        tags: ['Club', 'Sexy', 'Bold']
      },
      { 
        id: 2, 
        name: 'House Party', 
        price: '₹800-1300', 
        items: 'Crop Top + High-waist Jeans + Sneakers',
        popularity: 87,
        trending: false,
        tags: ['House Party', 'Fun', 'Casual']
      },
      { 
        id: 3, 
        name: 'Birthday Celebration', 
        price: '₹1400-2000', 
        items: 'Sequin Top + Mini Skirt + Boots',
        popularity: 90,
        trending: true,
        tags: ['Birthday', 'Sparkly', 'Celebration']
      },
    ]
  },
  'female-elegant': {
    title: 'Elegant',
    icon: '👑',
    colors: ['#3c6382', '#40739e'] as const,
    trend: 'Luxury',
    description: 'Royal vibes with sophisticated grace',
    outfits: [
      { 
        id: 1, 
        name: 'Classic Sophistication', 
        price: '₹2200-3200', 
        items: 'Silk Blouse + Tailored Trousers + Loafers',
        popularity: 88,
        trending: false,
        tags: ['Classic', 'Sophisticated', 'Timeless']
      },
      { 
        id: 2, 
        name: 'Timeless Grace', 
        price: '₹1800-2600', 
        items: 'Wrap Dress + Cardigan + Pearl Accessories',
        popularity: 91,
        trending: true,
        tags: ['Graceful', 'Timeless', 'Elegant']
      },
      { 
        id: 3, 
        name: 'Refined Style', 
        price: '₹2000-2800', 
        items: 'Cashmere Sweater + Pleated Skirt + Flats',
        popularity: 89,
        trending: false,
        tags: ['Refined', 'Luxury', 'Sophisticated']
      },
    ]
  },
  'female-twinning': {
    title: 'Twinning',
    icon: '👫',
    colors: ['#ff6b9d', '#c44569'] as const,
    trend: 'New',
    description: 'Match made in fashion heaven',
    outfits: [
      { 
        id: 1, 
        name: 'Casual Couple', 
        price: '₹800-1200', 
        items: 'Matching Color Tops + Denim + White Sneakers',
        popularity: 87,
        trending: true,
        tags: ['Couple', 'Matching', 'Casual']
      },
      { 
        id: 2, 
        name: 'Date Night Duo', 
        price: '₹1500-2200', 
        items: 'Coordinated Formal Wear + Complementary Colors',
        popularity: 93,
        trending: true,
        tags: ['Date', 'Coordinated', 'Elegant']
      },
      { 
        id: 3, 
        name: 'Party Pair', 
        price: '₹1200-1800', 
        items: 'Theme-based Outfits + Matching Accessories',
        popularity: 89,
        trending: false,
        tags: ['Party', 'Theme', 'Fun']
      },
    ]
  },
};
export default categoryData;
