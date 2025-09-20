import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import React, { useEffect, useRef } from 'react';
import { Alert, Animated, Linking, Text, TouchableOpacity, View } from 'react-native';

interface ShoppingLinksProps {
  result: {
    shoppingLinks: {
      category: string;
      items: {
        name: string;
        url: string;
        platform: string;
        priceRange?: 'budget' | 'mid' | 'premium';
      }[];
    }[];
  };
  theme: any;
}

const PlatformIcon: React.FC<{ platform: string; size?: number; color?: string }> = ({ 
  platform, 
  size = 20, 
  color = '#6366f1' 
}) => {
  const getPlatformIcon = (platformName: string): string => {
    const platform = platformName.toLowerCase();
    if (platform.includes('amazon')) return 'storefront';
    if (platform.includes('zara')) return 'shirt';
    if (platform.includes('h&m')) return 'bag';
    if (platform.includes('myntra')) return 'diamond';
    if (platform.includes('asos')) return 'glasses';
    if (platform.includes('nordstrom')) return 'star';
    if (platform.includes('pinterest')) return 'camera';
    if (platform.includes('google')) return 'search';
    return 'storefront';
  };

  return (
    <Ionicons 
      name={getPlatformIcon(platform) as any} 
      size={size} 
      color={color} 
    />
  );
};

const PriceRangeBadge: React.FC<{ 
  priceRange?: 'budget' | 'mid' | 'premium'; 
  theme: any; 
}> = ({ priceRange, theme }) => {
  if (!priceRange) return null;

  const getBadgeColor = (range: string): string => {
    switch (range) {
      case 'budget': return '#10B981';
      case 'mid': return '#F59E0B';
      case 'premium': return '#8B5CF6';
      default: return theme.primary;
    }
  };

  const getBadgeText = (range: string): string => {
    switch (range) {
      case 'budget': return '$';
      case 'mid': return '$$';
      case 'premium': return '$$$';
      default: return '$';
    }
  };

  return (
    <View 
      style={{ 
        paddingHorizontal: 8, 
        paddingVertical: 4, 
        borderRadius: 20,
        backgroundColor: getBadgeColor(priceRange) + '20' 
      }}
    >
      <Text 
        style={{ 
          fontSize: 12, 
          fontWeight: 'bold', 
          color: getBadgeColor(priceRange) 
        }}
      >
        {getBadgeText(priceRange)}
      </Text>
    </View>
  );
};

const ShoppingItemCard: React.FC<{
  item: {
    name: string;
    url: string;
    platform: string;
    priceRange?: 'budget' | 'mid' | 'premium';
  };
  theme: any;
  delay?: number;
}> = ({ item, theme, delay = 0 }) => {
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0.95)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 500,
        delay,
        useNativeDriver: true,
      }),
      Animated.spring(scaleAnim, {
        toValue: 1,
        tension: 100,
        friction: 8,
        delay,
        useNativeDriver: true,
      }),
    ]).start();
  }, [delay]);

  const handlePress = async () => {
    try {
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      const supported = await Linking.canOpenURL(item.url);
      
      if (supported) {
        await Linking.openURL(item.url);
      } else {
        Alert.alert('Error', 'Unable to open this link');
      }
    } catch (error) {
      console.error('Error opening link:', error);
      Alert.alert('Error', 'Unable to open this link');
    }
  };

  return (
    <Animated.View
      style={{
        opacity: fadeAnim,
        transform: [{ scale: scaleAnim }],
      }}
    >
      <TouchableOpacity
        onPress={handlePress}
        activeOpacity={0.8}
        style={{ marginBottom: 12 }}
      >
        <View 
          style={{ 
            borderRadius: 16, 
            padding: 16, 
            borderWidth: 1,
            backgroundColor: theme.card,
            borderColor: theme.border
          }}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
              <View 
                style={{ 
                  width: 40, 
                  height: 40, 
                  borderRadius: 12, 
                  alignItems: 'center', 
                  justifyContent: 'center', 
                  marginRight: 12,
                  backgroundColor: theme.primary + '20' 
                }}
              >
                <PlatformIcon 
                  platform={item.platform} 
                  size={20} 
                  color={theme.primary} 
                />
              </View>
              
              <View style={{ flex: 1 }}>
                <Text 
                  style={{ 
                    fontWeight: '600', 
                    fontSize: 16, 
                    color: theme.text 
                  }}
                  numberOfLines={1}
                >
                  {item.name}
                </Text>
                <Text 
                  style={{ 
                    fontSize: 14, 
                    marginTop: 4, 
                    color: theme.textSecondary 
                  }}
                >
                  {item.platform}
                </Text>
              </View>
            </View>
            
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <PriceRangeBadge priceRange={item.priceRange} theme={theme} />
              <Ionicons 
                name="chevron-forward" 
                size={20} 
                color={theme.textTertiary} 
                style={{ marginLeft: 8 }}
              />
            </View>
          </View>
        </View>
      </TouchableOpacity>
    </Animated.View>
  );
};

const ShoppingCategorySection: React.FC<{
  category: {
    category: string;
    items: {
      name: string;
      url: string;
      platform: string;
      priceRange?: 'budget' | 'mid' | 'premium';
    }[];
  };
  theme: any;
  delay?: number;
}> = ({ category, theme, delay = 0 }) => {
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(20)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 600,
        delay,
        useNativeDriver: true,
      }),
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 600,
        delay,
        useNativeDriver: true,
      }),
    ]).start();
  }, [delay]);

  const getCategoryIcon = (categoryName: string): string => {
    const cat = categoryName.toLowerCase();
    if (cat.includes('accessories')) return 'diamond';
    if (cat.includes('footwear') || cat.includes('shoes')) return 'footsteps';
    if (cat.includes('clothing') || cat.includes('apparel')) return 'shirt';
    if (cat.includes('jewelry')) return 'diamond';
    if (cat.includes('bags')) return 'bag';
    return 'storefront';
  };

  const getCategoryColor = (categoryName: string): string => {
    const cat = categoryName.toLowerCase();
    if (cat.includes('accessories')) return '#8B5CF6';
    if (cat.includes('footwear')) return '#F59E0B';
    if (cat.includes('clothing')) return '#10B981';
    if (cat.includes('jewelry')) return '#EF4444';
    return theme.primary;
  };

  return (
    <Animated.View
      style={{
        marginBottom: 32,
        opacity: fadeAnim,
        transform: [{ translateY: slideAnim }],
      }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 16 }}>
        <View 
          style={{ 
            width: 48, 
            height: 48, 
            borderRadius: 16, 
            alignItems: 'center', 
            justifyContent: 'center', 
            marginRight: 16,
            backgroundColor: getCategoryColor(category.category) + '20' 
          }}
        >
          <Ionicons 
            name={getCategoryIcon(category.category) as any} 
            size={24} 
            color={getCategoryColor(category.category)} 
          />
        </View>
        <Text style={{ 
          fontSize: 20, 
          fontWeight: 'bold', 
          flex: 1, 
          color: theme.text 
        }}>
          {category.category}
        </Text>
        <Text 
          style={{ 
            fontSize: 14, 
            fontWeight: '500', 
            color: theme.textSecondary 
          }}
        >
          {category.items.length} items
        </Text>
      </View>
      
      <View>
        {category.items.map((item, index) => (
          <ShoppingItemCard
            key={index}
            item={item}
            theme={theme}
            delay={delay + (index * 100)}
          />
        ))}
      </View>
    </Animated.View>
  );
};

const ShoppingLinks: React.FC<ShoppingLinksProps> = ({ result, theme }) => {
  const headerFadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(headerFadeAnim, {
      toValue: 1,
      duration: 600,
      useNativeDriver: true,
    }).start();
  }, []);

  if (!result.shoppingLinks || result.shoppingLinks.length === 0) {
    return null;
  }

  return (
    <View style={{ paddingHorizontal: 24 }}>
      <Animated.View style={{ opacity: headerFadeAnim }}>
        <Text style={{ 
          fontSize: 24, 
          fontWeight: 'bold', 
          marginBottom: 8, 
          color: theme.text 
        }}>
          Shopping Recommendations
        </Text>
        <Text style={{ 
          fontSize: 16, 
          marginBottom: 24, 
          color: theme.textSecondary 
        }}>
          Find the perfect pieces to complete your look
        </Text>
      </Animated.View>

      {/* Shopping Categories */}
      {result.shoppingLinks.map((category, index) => (
        <ShoppingCategorySection
          key={index}
          category={category}
          theme={theme}
          delay={index * 200}
        />
      ))}

      {/* Shopping Tips */}
      <Animated.View 
        style={{ marginBottom: 24, opacity: headerFadeAnim }}
      >
        <LinearGradient
          colors={[theme.success + '20', theme.accent + '20']}
          style={{ borderRadius: 16, padding: 20 }}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 12 }}>
            <Ionicons name="bulb" size={24} color={theme.success} style={{ marginRight: 12 }} />
            <Text style={{ fontSize: 18, fontWeight: 'bold', color: theme.text }}>
              Smart Shopping Tips
            </Text>
          </View>
          
          <View style={{ gap: 8 }}>
            {[
              "Compare prices across different platforms before purchasing",
              "Check size guides and return policies before ordering",
              "Look for similar items at different price points",
              "Consider versatile pieces that work with multiple outfits"
            ].map((tip, index) => (
              <View key={index} style={{ flexDirection: 'row', alignItems: 'flex-start' }}>
                <View 
                  style={{ 
                    width: 8, 
                    height: 8, 
                    borderRadius: 4, 
                    marginTop: 8, 
                    marginRight: 12,
                    backgroundColor: theme.success 
                  }}
                />
                <Text 
                  style={{ 
                    flex: 1, 
                    fontSize: 14, 
                    lineHeight: 20, 
                    color: theme.textSecondary 
                  }}
                >
                  {tip}
                </Text>
              </View>
            ))}
          </View>
        </LinearGradient>
      </Animated.View>
    </View>
  );
};

export default ShoppingLinks;