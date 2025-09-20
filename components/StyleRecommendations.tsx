import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import React, { useEffect, useRef } from 'react';
import { Animated, ScrollView, Text, TouchableOpacity, View } from 'react-native';

interface StyleRecommendationsProps {
  result: {
    analysis: {
      recommendations: string[];
      missingItems: string[];
    };
  };
  theme: any;
}

const RecommendationCard: React.FC<{
  title: string;
  description: string;
  icon: string;
  color: string;
  theme: any;
  onPress?: () => void;
  delay?: number;
}> = ({ title, description, icon, color, theme, onPress, delay = 0 }) => {
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0.9)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 600,
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
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (onPress) onPress();
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
        style={{ marginBottom: 16 }}
      >
        <LinearGradient
          colors={[color + '10', color + '05']}
          style={{ 
            borderRadius: 16, 
            padding: 16, 
            borderWidth: 1,
            borderColor: color + '30' 
          }}
        >
          <View style={{ flexDirection: 'row', alignItems: 'flex-start' }}>
            <View 
              style={{ 
                width: 48, 
                height: 48, 
                borderRadius: 12, 
                alignItems: 'center', 
                justifyContent: 'center', 
                marginRight: 16,
                backgroundColor: color + '20' 
              }}
            >
              <Ionicons name={icon as any} size={24} color={color} />
            </View>
            
            <View style={{ flex: 1 }}>
              <Text style={{ 
                fontSize: 18, 
                fontWeight: 'bold', 
                marginBottom: 8, 
                color: theme.text 
              }}>
                {title}
              </Text>
              <Text 
                style={{ 
                  fontSize: 16, 
                  lineHeight: 24, 
                  color: theme.textSecondary 
                }}
              >
                {description}
              </Text>
            </View>
            
            <Ionicons name="chevron-forward" size={20} color={theme.textTertiary} />
          </View>
        </LinearGradient>
      </TouchableOpacity>
    </Animated.View>
  );
};

const QuickTipCard: React.FC<{
  tip: string;
  theme: any;
  delay?: number;
}> = ({ tip, theme, delay = 0 }) => {
  const slideAnim = useRef(new Animated.Value(30)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 500,
        delay,
        useNativeDriver: true,
      }),
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 500,
        delay,
        useNativeDriver: true,
      }),
    ]).start();
  }, [delay]);

  return (
    <Animated.View
      style={{
        marginRight: 16,
        opacity: fadeAnim,
        transform: [{ translateX: slideAnim }],
      }}
    >
      <View 
        style={{ 
          borderRadius: 16, 
          padding: 16, 
          minWidth: 280,
          backgroundColor: theme.card 
        }}
      >
        <View style={{ flexDirection: 'row', alignItems: 'flex-start' }}>
          <View 
            style={{ 
              width: 32, 
              height: 32, 
              borderRadius: 16, 
              alignItems: 'center', 
              justifyContent: 'center', 
              marginRight: 12, 
              marginTop: 4,
              backgroundColor: theme.primary + '20' 
            }}
          >
            <Ionicons name="bulb" size={16} color={theme.primary} />
          </View>
          <Text 
            style={{ 
              flex: 1, 
              fontSize: 16, 
              lineHeight: 24, 
              color: theme.text 
            }}
          >
            {tip}
          </Text>
        </View>
      </View>
    </Animated.View>
  );
};

const MissingItemsGrid: React.FC<{
  items: string[];
  theme: any;
}> = ({ items, theme }) => {
  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 800,
      delay: 400,
      useNativeDriver: true,
    }).start();
  }, []);

  const getItemIcon = (item: string): string => {
    const itemLower = item.toLowerCase();
    if (itemLower.includes('jewelry') || itemLower.includes('necklace') || itemLower.includes('earring')) return 'diamond';
    if (itemLower.includes('belt')) return 'remove';
    if (itemLower.includes('bag') || itemLower.includes('purse')) return 'bag';
    if (itemLower.includes('shoe') || itemLower.includes('footwear')) return 'footsteps';
    if (itemLower.includes('watch')) return 'time';
    if (itemLower.includes('scarf')) return 'ribbon';
    if (itemLower.includes('hat') || itemLower.includes('cap')) return 'hat';
    return 'add-circle';
  };

  return (
    <Animated.View
      style={{ marginBottom: 24, opacity: fadeAnim }}
    >
      <View 
        style={{ 
          borderRadius: 16, 
          padding: 20, 
          backgroundColor: theme.card 
        }}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 16 }}>
          <View 
            style={{ 
              width: 40, 
              height: 40, 
              borderRadius: 20, 
              alignItems: 'center', 
              justifyContent: 'center', 
              marginRight: 12,
              backgroundColor: theme.error + '20' 
            }}
          >
            <Ionicons name="add-circle" size={20} color={theme.error} />
          </View>
          <Text style={{ fontSize: 18, fontWeight: 'bold', color: theme.text }}>
            Complete Your Look
          </Text>
        </View>
        
        <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
          {items.map((item, index) => (
            <View 
              key={index}
              style={{ 
                flexDirection: 'row', 
                alignItems: 'center', 
                borderRadius: 12, 
                padding: 12, 
                marginRight: 12, 
                marginBottom: 12,
                backgroundColor: theme.primary + '10' 
              }}
            >
              <Ionicons 
                name={getItemIcon(item) as any} 
                size={16} 
                color={theme.primary} 
                style={{ marginRight: 8 }}
              />
              <Text 
                style={{ 
                  fontSize: 14, 
                  fontWeight: '500', 
                  color: theme.text 
                }}
              >
                {item}
              </Text>
            </View>
          ))}
        </View>
      </View>
    </Animated.View>
  );
};

const StyleRecommendations: React.FC<StyleRecommendationsProps> = ({ result, theme }) => {
  const headerFadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(headerFadeAnim, {
      toValue: 1,
      duration: 600,
      useNativeDriver: true,
    }).start();
  }, []);

  return (
    <View style={{ paddingHorizontal: 24 }}>
      <Animated.View style={{ opacity: headerFadeAnim }}>
        <Text style={{ 
          fontSize: 24, 
          fontWeight: 'bold', 
          marginBottom: 24, 
          color: theme.text 
        }}>
          Style Recommendations
        </Text>
      </Animated.View>
      
      {/* Main Recommendations */}
      <View style={{ marginBottom: 32 }}>
        {result.analysis.recommendations.map((recommendation, index) => (
          <RecommendationCard
            key={index}
            title={`Tip ${index + 1}`}
            description={recommendation}
            icon="checkmark-circle"
            color={theme.primary}
            theme={theme}
            delay={index * 100}
          />
        ))}
      </View>

      {/* Missing Items */}
      {result.analysis.missingItems.length > 0 && (
        <MissingItemsGrid 
          items={result.analysis.missingItems} 
          theme={theme} 
        />
      )}

      {/* Quick Tips Carousel */}
      <Animated.View style={{ opacity: headerFadeAnim }}>
        <Text style={{ 
          fontSize: 20, 
          fontWeight: 'bold', 
          marginBottom: 16, 
          color: theme.text 
        }}>
          Quick Styling Tips
        </Text>
      </Animated.View>
      
      <ScrollView 
        horizontal 
        showsHorizontalScrollIndicator={false}
        style={{ marginBottom: 24 }}
        contentContainerStyle={{ paddingRight: 24 }}
      >
        {[
          "Accessories can make or break an outfit - choose wisely",
          "Color coordination is key to a polished look",
          "Fit is more important than following trends",
          "Confidence is your best accessory",
          "Mix textures for visual interest",
          "Know your body type and dress accordingly"
        ].map((tip, index) => (
          <QuickTipCard
            key={index}
            tip={tip}
            theme={theme}
            delay={index * 150}
          />
        ))}
      </ScrollView>

      {/* Style Goals Section */}
      <Animated.View 
        style={{ marginBottom: 24, opacity: headerFadeAnim }}
      >
        <LinearGradient
          colors={[theme.accent + '20', theme.secondary + '20']}
          style={{ borderRadius: 16, padding: 20 }}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 12 }}>
            <Ionicons name="trophy" size={24} color={theme.accent} style={{ marginRight: 12 }} />
            <Text style={{ fontSize: 18, fontWeight: 'bold', color: theme.text }}>
              Your Style Goals
            </Text>
          </View>
          <Text 
            style={{ 
              fontSize: 16, 
              lineHeight: 24, 
              color: theme.textSecondary 
            }}
          >
            Keep experimenting with your style! Every outfit is an opportunity to express your personality and feel confident. Remember, the best outfit is one that makes you feel like the best version of yourself.
          </Text>
        </LinearGradient>
      </Animated.View>
    </View>
  );
};

export default StyleRecommendations;