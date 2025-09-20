import { LinearGradient } from 'expo-linear-gradient';
import React, { useEffect, useRef } from 'react';
import { Animated, Dimensions, Text, View } from 'react-native';
import Svg, { Circle } from 'react-native-svg';

const { width: screenWidth } = Dimensions.get('window');

interface StyleRatingCardProps {
  result: {
    overallRating: number;
    categoryRatings: {
      colorHarmony: number;
      fitAndSilhouette: number;
      occasionAppropriate: number;
      accessoriesBalance: number;
      styleCoherence: number;
    };
  };
  theme: any;
}

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

const CircularProgress: React.FC<{
  percentage: number;
  size: number;
  strokeWidth: number;
  color: string;
  backgroundColor: string;
}> = ({ percentage, size, strokeWidth, color, backgroundColor }) => {
  const animatedValue = useRef(new Animated.Value(0)).current;
  const radius = (size - strokeWidth) / 2;
  const circumference = radius * 2 * Math.PI;
  
  useEffect(() => {
    Animated.timing(animatedValue, {
      toValue: percentage,
      duration: 1500,
      useNativeDriver: false,
    }).start();
  }, [percentage]);

  const strokeDasharray = `${circumference} ${circumference}`;
  const strokeDashoffset = animatedValue.interpolate({
    inputRange: [0, 100],
    outputRange: [circumference, 0],
  });

  return (
    <Svg width={size} height={size} style={{ transform: [{ rotate: '-90deg' }] }}>
      <Circle
        stroke={backgroundColor}
        fill="none"
        cx={size / 2}
        cy={size / 2}
        r={radius}
        strokeWidth={strokeWidth}
      />
      <AnimatedCircle
        stroke={color}
        fill="none"
        cx={size / 2}
        cy={size / 2}
        r={radius}
        strokeWidth={strokeWidth}
        strokeDasharray={strokeDasharray}
        strokeDashoffset={strokeDashoffset}
        strokeLinecap="round"
      />
    </Svg>
  );
};

const StyleRatingCard: React.FC<StyleRatingCardProps> = ({ result, theme }) => {
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(30)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 800,
        useNativeDriver: true,
      }),
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 800,
        useNativeDriver: true,
      }),
    ]).start();
  }, []);

  const getRatingColor = (rating: number): string => {
    if (rating >= 80) return '#10B981'; // Green
    if (rating >= 60) return '#F59E0B'; // Yellow
    return '#EF4444'; // Red
  };

  const getRatingText = (rating: number): string => {
    if (rating >= 90) return 'Excellent';
    if (rating >= 80) return 'Great';
    if (rating >= 70) return 'Good';
    if (rating >= 60) return 'Fair';
    return 'Needs Work';
  };

  const categoryLabels = {
    colorHarmony: 'Color Harmony',
    fitAndSilhouette: 'Fit & Silhouette',
    occasionAppropriate: 'Occasion Match',
    accessoriesBalance: 'Accessories',
    styleCoherence: 'Style Coherence',
  };

  return (
    <Animated.View
      style={{
        marginHorizontal: 24,
        marginBottom: 24,
        opacity: fadeAnim,
        transform: [{ translateY: slideAnim }],
      }}
    >
      <LinearGradient
        colors={[theme.primary + '20', theme.secondary + '20']}
        style={{ borderRadius: 24, padding: 24 }}
      >
        {/* Overall Rating */}
        <View style={{ alignItems: 'center', marginBottom: 32 }}>
          <Text style={{ 
            fontSize: 24, 
            fontWeight: 'bold', 
            marginBottom: 16, 
            color: theme.text 
          }}>
            Overall Style Score
          </Text>
          
          <View style={{ position: 'relative', alignItems: 'center', justifyContent: 'center' }}>
            <CircularProgress
              percentage={result.overallRating}
              size={160}
              strokeWidth={12}
              color={getRatingColor(result.overallRating)}
              backgroundColor={theme.border}
            />
            <View style={{ position: 'absolute', alignItems: 'center' }}>
              <Text 
                style={{ 
                  fontSize: 36, 
                  fontWeight: 'bold', 
                  color: getRatingColor(result.overallRating) 
                }}
              >
                {result.overallRating}
              </Text>
              <Text style={{ 
                fontSize: 18, 
                fontWeight: '600', 
                color: theme.text 
              }}>
                {getRatingText(result.overallRating)}
              </Text>
            </View>
          </View>
        </View>

        {/* Category Ratings */}
        <View>
          <Text style={{ 
            fontSize: 20, 
            fontWeight: 'bold', 
            marginBottom: 16, 
            color: theme.text 
          }}>
            Category Breakdown
          </Text>
          
          <View style={{ gap: 16 }}>
            {Object.entries(result.categoryRatings).map(([key, value], index) => {
              const animatedWidth = useRef(new Animated.Value(0)).current;
              
              useEffect(() => {
                Animated.timing(animatedWidth, {
                  toValue: value,
                  duration: 1000 + (index * 200),
                  useNativeDriver: false,
                }).start();
              }, [value]);

              return (
                <View key={key} style={{ marginBottom: 12 }}>
                  <View style={{ 
                    flexDirection: 'row', 
                    justifyContent: 'space-between', 
                    alignItems: 'center', 
                    marginBottom: 8 
                  }}>
                    <Text style={{ fontWeight: '600', color: theme.text }}>
                      {categoryLabels[key as keyof typeof categoryLabels]}
                    </Text>
                    <Text 
                      style={{ 
                        fontWeight: 'bold', 
                        color: getRatingColor(value) 
                      }}
                    >
                      {value}/100
                    </Text>
                  </View>
                  
                  <View 
                    style={{ 
                      height: 12, 
                      borderRadius: 6, 
                      overflow: 'hidden', 
                      backgroundColor: theme.border 
                    }}
                  >
                    <Animated.View
                      style={{
                        height: '100%',
                        borderRadius: 6,
                        backgroundColor: getRatingColor(value),
                        width: animatedWidth.interpolate({
                          inputRange: [0, 100],
                          outputRange: ['0%', '100%'],
                        }),
                      }}
                    />
                  </View>
                </View>
              );
            })}
          </View>
        </View>
      </LinearGradient>
    </Animated.View>
  );
};

export default StyleRatingCard;