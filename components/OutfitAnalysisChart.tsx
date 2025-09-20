import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import React, { useEffect, useRef } from 'react';
import { Animated, ScrollView, Text, View } from 'react-native';

interface OutfitAnalysisChartProps {
  result: {
    analysis: {
      strengths: string[];
      improvements: string[];
      recommendations: string[];
      missingItems: string[];
      colorSuggestions: string[];
    };
    venueMatch: {
      score: number;
      feedback: string;
      suggestions: string[];
    };
  };
  theme: any;
}

const AnalysisSection: React.FC<{
  title: string;
  items: string[];
  icon: string;
  color: string;
  theme: any;
  delay?: number;
}> = ({ title, items, icon, color, theme, delay = 0 }) => {
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

  return (
    <Animated.View
      style={{
        marginBottom: 24,
        opacity: fadeAnim,
        transform: [{ translateY: slideAnim }],
      }}
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
              backgroundColor: color + '20' 
            }}
          >
            <Ionicons name={icon as any} size={20} color={color} />
          </View>
          <Text style={{ 
            fontSize: 18, 
            fontWeight: 'bold', 
            flex: 1, 
            color: theme.text 
          }}>
            {title}
          </Text>
        </View>
        
        <View style={{ gap: 12 }}>
          {items.map((item, index) => {
            const itemFadeAnim = useRef(new Animated.Value(0)).current;
            
            useEffect(() => {
              Animated.timing(itemFadeAnim, {
                toValue: 1,
                duration: 400,
                delay: delay + (index * 100),
                useNativeDriver: true,
              }).start();
            }, [delay, index]);

            return (
              <Animated.View
                key={index}
                style={{ 
                  flexDirection: 'row', 
                  alignItems: 'flex-start', 
                  opacity: itemFadeAnim 
                }}
              >
                <View 
                  style={{ 
                    width: 8, 
                    height: 8, 
                    borderRadius: 4, 
                    marginTop: 8, 
                    marginRight: 12,
                    backgroundColor: color 
                  }}
                />
                <Text 
                  style={{ 
                    flex: 1, 
                    fontSize: 16, 
                    lineHeight: 24, 
                    color: theme.textSecondary 
                  }}
                >
                  {item}
                </Text>
              </Animated.View>
            );
          })}
        </View>
      </View>
    </Animated.View>
  );
};

const ColorPalette: React.FC<{
  colors: string[];
  theme: any;
}> = ({ colors, theme }) => {
  const colorMap: { [key: string]: string } = {
    // Blues
    'deep blue': '#1e40af',
    'navy blue': '#1e3a8a',
    'royal blue': '#2563eb',
    'sky blue': '#0ea5e9',
    'light blue': '#38bdf8',
    'powder blue': '#7dd3fc',
    'teal': '#0d9488',
    'turquoise': '#06b6d4',
    
    // Reds
    'deep red': '#dc2626',
    'crimson': '#dc143c',
    'burgundy': '#7f1d1d',
    'wine': '#881337',
    'coral': '#f97316',
    'salmon': '#fb7185',
    'rose': '#f43f5e',
    'pink': '#ec4899',
    'hot pink': '#e11d48',
    'magenta': '#c026d3',
    
    // Greens
    'forest green': '#166534',
    'emerald': '#059669',
    'sage green': '#84cc16',
    'olive green': '#65a30d',
    'mint green': '#10b981',
    'lime green': '#84cc16',
    'seafoam': '#6ee7b7',
    
    // Yellows/Golds
    'golden yellow': '#eab308',
    'mustard yellow': '#ca8a04',
    'lemon yellow': '#fde047',
    'amber': '#f59e0b',
    'gold': '#d97706',
    'bronze': '#92400e',
    'copper': '#ea580c',
    
    // Purples
    'deep purple': '#7c3aed',
    'royal purple': '#6d28d9',
    'lavender': '#a78bfa',
    'plum': '#8b5cf6',
    'violet': '#7c3aed',
    'indigo': '#4f46e5',
    'amethyst': '#9333ea',
    
    // Earth Tones
    'warm earth tones': '#92400e',
    'terracotta': '#ea580c',
    'rust': '#dc2626',
    'clay': '#c2410c',
    'sand': '#d97706',
    'camel': '#ca8a04',
    'chocolate': '#7c2d12',
    'coffee': '#451a03',
    'taupe': '#78716c',
    'beige': '#a8a29e',
    
    // Neutrals
    'classic neutrals': '#6b7280',
    'charcoal': '#374151',
    'slate': '#475569',
    'stone': '#78716c',
    'cream': '#fef7ed',
    'ivory': '#fffbeb',
    'pearl': '#f8fafc',
    'silver': '#94a3b8',
    'platinum': '#e2e8f0',
    
    // Blacks and Whites
    'black': '#000000',
    'white': '#ffffff',
    'off white': '#fafafa',
    'jet black': '#0f172a',
    'charcoal black': '#1f2937',
    
    // Pastels
    'soft pastels': '#f472b6',
    'baby blue': '#bfdbfe',
    'baby pink': '#fbcfe8',
    'mint': '#bbf7d0',
    'peach': '#fed7aa',
    'lilac': '#e9d5ff',
    
    // Bold/Bright
    'bold colors': '#dc2626',
    'neon': '#10b981',
    'electric blue': '#0ea5e9',
    'bright red': '#ef4444',
    'vibrant': '#8b5cf6',
    
    // Metallics
    'metallics': '#d97706',
    'rose gold': '#f59e0b',
    'champagne': '#fbbf24',
    
    // Monochrome
    'monochrome': '#374151',
    'grayscale': '#6b7280',
  };

  const getColorCode = (colorName: string): string => {
    const lowerColorName = colorName.toLowerCase();
    
    // First try exact match
    if (colorMap[lowerColorName]) {
      return colorMap[lowerColorName];
    }
    
    // Then try partial matches
    const found = Object.keys(colorMap).find(key => 
      lowerColorName.includes(key.toLowerCase()) || key.toLowerCase().includes(lowerColorName)
    );
    
    if (found) {
      return colorMap[found];
    }
    
    // Fallback to basic color detection
    if (lowerColorName.includes('blue')) return '#3b82f6';
    if (lowerColorName.includes('red')) return '#ef4444';
    if (lowerColorName.includes('green')) return '#10b981';
    if (lowerColorName.includes('yellow')) return '#eab308';
    if (lowerColorName.includes('purple') || lowerColorName.includes('violet')) return '#8b5cf6';
    if (lowerColorName.includes('pink')) return '#ec4899';
    if (lowerColorName.includes('orange')) return '#f97316';
    if (lowerColorName.includes('brown')) return '#92400e';
    if (lowerColorName.includes('gray') || lowerColorName.includes('grey')) return '#6b7280';
    if (lowerColorName.includes('black')) return '#1f2937';
    if (lowerColorName.includes('white')) return '#f8fafc';
    
    // Final fallback - generate a color based on the string hash
    let hash = 0;
    for (let i = 0; i < colorName.length; i++) {
      hash = colorName.charCodeAt(i) + ((hash << 5) - hash);
    }
    const hue = Math.abs(hash) % 360;
    return `hsl(${hue}, 65%, 55%)`;
  };

  return (
    <View style={{ marginBottom: 24 }}>
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
              backgroundColor: theme.primary + '20' 
            }}
          >
            <Ionicons name="color-palette" size={20} color={theme.primary} />
          </View>
          <Text style={{ fontSize: 18, fontWeight: 'bold', color: theme.text }}>
            Recommended Colors
          </Text>
        </View>
        
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          <View style={{ flexDirection: 'row', gap: 12 }}>
            {colors.map((color, index) => {
              const colorCode = getColorCode(color);
              return (
                <View key={index} style={{ alignItems: 'center' }}>
                  <View 
                    style={{ 
                      width: 64, 
                      height: 64, 
                      borderRadius: 16, 
                      marginBottom: 8, 
                      borderWidth: 2,
                      backgroundColor: colorCode,
                      borderColor: theme.border
                    }}
                  />
                  <Text 
                    style={{ 
                      fontSize: 12, 
                      textAlign: 'center', 
                      fontWeight: '500', 
                      color: theme.textSecondary, 
                      maxWidth: 60 
                    }}
                    numberOfLines={2}
                  >
                    {color}
                  </Text>
                </View>
              );
            })}
          </View>
        </ScrollView>
      </View>
    </View>
  );
};

const VenueMatchCard: React.FC<{
  venueMatch: {
    score: number;
    feedback: string;
    suggestions: string[];
  };
  theme: any;
}> = ({ venueMatch, theme }) => {
  const progressAnim = useRef(new Animated.Value(0)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(progressAnim, {
        toValue: venueMatch.score,
        duration: 1200,
        useNativeDriver: false,
      }),
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 800,
        useNativeDriver: true,
      }),
    ]).start();
  }, []);

  const getScoreColor = (score: number): string => {
    if (score >= 80) return '#10B981';
    if (score >= 60) return '#F59E0B';
    return '#EF4444';
  };

  return (
    <Animated.View
      style={{ marginBottom: 24, opacity: fadeAnim }}
    >
      <LinearGradient
        colors={[theme.accent + '20', theme.primary + '20']}
        style={{ borderRadius: 16, padding: 20 }}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <Ionicons name="location" size={24} color={theme.accent} style={{ marginRight: 12 }} />
            <Text style={{ fontSize: 18, fontWeight: 'bold', color: theme.text }}>
              Venue Match
            </Text>
          </View>
          <Text 
            style={{ 
              fontSize: 24, 
              fontWeight: 'bold', 
              color: getScoreColor(venueMatch.score) 
            }}
          >
            {venueMatch.score}%
          </Text>
        </View>
        
        <View 
          style={{ 
            height: 12, 
            borderRadius: 6, 
            marginBottom: 16, 
            overflow: 'hidden',
            backgroundColor: theme.border 
          }}
        >
          <Animated.View
            style={{
              height: '100%',
              borderRadius: 6,
              backgroundColor: getScoreColor(venueMatch.score),
              width: progressAnim.interpolate({
                inputRange: [0, 100],
                outputRange: ['0%', '100%'],
              }),
            }}
          />
        </View>
        
        <Text 
          style={{ 
            fontSize: 16, 
            marginBottom: 16, 
            lineHeight: 24, 
            color: theme.textSecondary 
          }}
        >
          {venueMatch.feedback}
        </Text>
        
        {venueMatch.suggestions.length > 0 && (
          <View>
            <Text style={{ fontWeight: '600', marginBottom: 8, color: theme.text }}>
              Suggestions:
            </Text>
            {venueMatch.suggestions.map((suggestion, index) => (
              <View key={index} style={{ flexDirection: 'row', alignItems: 'flex-start', marginBottom: 8 }}>
                <View 
                  style={{ 
                    width: 8, 
                    height: 8, 
                    borderRadius: 4, 
                    marginTop: 8, 
                    marginRight: 12,
                    backgroundColor: theme.accent 
                  }}
                />
                <Text 
                  style={{ 
                    flex: 1, 
                    fontSize: 14, 
                    color: theme.textSecondary 
                  }}
                >
                  {suggestion}
                </Text>
              </View>
            ))}
          </View>
        )}
      </LinearGradient>
    </Animated.View>
  );
};

const OutfitAnalysisChart: React.FC<OutfitAnalysisChartProps> = ({ result, theme }) => {
  return (
    <View style={{ paddingHorizontal: 24 }}>
      <Text style={{ 
        fontSize: 24, 
        fontWeight: 'bold', 
        marginBottom: 24, 
        color: theme.text 
      }}>
        Detailed Analysis
      </Text>
      
      <AnalysisSection
        title="What's Working Well"
        items={result.analysis.strengths}
        icon="checkmark-circle"
        color="#10B981"
        theme={theme}
        delay={0}
      />
      
      <AnalysisSection
        title="Areas for Improvement"
        items={result.analysis.improvements}
        icon="alert-circle"
        color="#F59E0B"
        theme={theme}
        delay={200}
      />
      
      <AnalysisSection
        title="Style Recommendations"
        items={result.analysis.recommendations}
        icon="bulb"
        color="#6366F1"
        theme={theme}
        delay={400}
      />
      
      <AnalysisSection
        title="Missing Items"
        items={result.analysis.missingItems}
        icon="add-circle"
        color="#EF4444"
        theme={theme}
        delay={600}
      />
      
      <ColorPalette colors={result.analysis.colorSuggestions} theme={theme} />
      
      <VenueMatchCard venueMatch={result.venueMatch} theme={theme} />
    </View>
  );
};

export default OutfitAnalysisChart;