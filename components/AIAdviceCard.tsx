import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import React from 'react';
import {
    Linking,
    ScrollView,
    Share,
    StyleSheet,
    Text,
    TouchableOpacity,
    useColorScheme,
    View
} from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';

type AIAdviceCardProps = {
  advice: string[] | null;
  sources?: string[];
  isProfileComplete: boolean;
  theme: {
    card: string;
    primary: string;
    text: string;
    dark?: boolean;
  };
};

export default function AIAdviceCard({
  advice,
  sources = [],
  isProfileComplete,
  theme,
}: AIAdviceCardProps) {
  const colorScheme = useColorScheme();
  const isDark = theme?.dark ?? colorScheme === 'dark';
  const [isExpanded, setIsExpanded] = React.useState(false);

  const handleShare = async () => {
    if (!advice) return;
    try {
      await Share.share({
        message: advice.join('\n\n'),
      });
    } catch (e) { }
  };

  return (
    <Animated.View
      entering={FadeInDown.duration(700)}
      style={[
        styles.card,
        {
          backgroundColor: isDark
            ? 'rgba(30, 41, 59, 0.9)'
            : 'rgba(255, 255, 255, 0.95)',
          borderColor: isDark ? '#475569' : '#cbd5e1',
          shadowColor: isDark ? '#000' : '#64748b',
        },
      ]}
    >
      <LinearGradient
        colors={
          isDark
            ? ['#1e293b', '#334155']
            : ['#f8fafc', '#eef2ff']
        }
        style={StyleSheet.absoluteFill}
        start={{ x: 0.1, y: 0.1 }}
        end={{ x: 1, y: 1 }}
      />

      {/* Header */}
      <View style={styles.headerRow}>
        <View style={styles.iconRow}>
          <Text style={styles.glowBulb}>💡</Text>
          <Text
            style={[
              styles.title,
              { color: isDark ? '#ffd700' : '#6d28d9' },
            ]}
          >
            AI Style Advice
          </Text>
        </View>
        {isExpanded && (
          <TouchableOpacity
            onPress={() => setIsExpanded(false)}
            style={styles.closeBtn}
          >
            <Ionicons name="close-circle" size={24} color={isDark ? '#ffd700' : '#6366f1'} />
          </TouchableOpacity>
        )}
      </View>

      {/* Content */}
      {!isExpanded ? (
        // Collapsed view
        <>
          <Text
            style={[
              styles.text,
              { color: isDark ? '#fff' : '#2d2d2d' },
            ]}
            numberOfLines={2}
          >
            {isProfileComplete
              ? advice?.slice(0, 2).join(' ') ||
              'No advice found for your profile.'
              : 'Please fill your profile for personalized AI advice.'}
          </Text>
          <TouchableOpacity
            style={[
              styles.button,
              {
                backgroundColor: isDark ? '#7c3aed' : '#4f46e5',
                shadowColor: isDark ? '#7c3aed' : '#4f46e5',
              },
            ]}
            activeOpacity={0.85}
            onPress={() => setIsExpanded(true)}
          >
            <Ionicons
              name="arrow-forward-circle"
              size={20}
              color="#fff"
              style={{ marginRight: 6 }}
            />
            <Text style={{ color: '#fff', fontWeight: 'bold', fontSize: 15 }}>
              See More
            </Text>
          </TouchableOpacity>
        </>
      ) : (
        // Expanded view
        <>
          <ScrollView 
            style={styles.expandedContent} 
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={true}
            nestedScrollEnabled={true}
            bounces={true}
            scrollEnabled={true}
          >
            {advice && advice.length > 0 ? (
              advice.map((line, i) => (
                <Text
                  key={i}
                  style={[
                    styles.adviceItem,
                    { color: isDark ? '#fff' : '#2d2d2d' },
                  ]}
                >{`• ${line}`}</Text>
              ))
            ) : (
              <Text style={[styles.adviceItem, { color: isDark ? '#fff' : '#2d2d2d' }]}>
                No advice found for your profile.
              </Text>
            )}
          </ScrollView>

          {/* Sources */}
          {sources && sources.length > 0 && (
            <View style={styles.sourcesBox}>
              <Text style={[styles.sourcesTitle, { color: isDark ? '#ffd700' : '#6366f1' }]}>
                Sources:
              </Text>
              {sources.slice(0, 2).map((url, idx) => (
                <TouchableOpacity
                  key={idx}
                  onPress={() => Linking.openURL(url)}
                  style={styles.sourceLink}
                >
                  <Ionicons name="link" size={14} color={isDark ? '#ffd700' : '#6366f1'} />
                  <Text
                    style={[
                      styles.sourceText,
                      { color: isDark ? '#ffd700' : '#6366f1' }
                    ]}
                    numberOfLines={1}
                    ellipsizeMode="middle"
                  >
                    {url.replace(/^https?:\/\//, '').slice(0, 30)}...
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          )}

          {/* Action buttons */}
          <View style={styles.actionRow}>
            <TouchableOpacity style={styles.shareBtn} onPress={handleShare}>
              <Ionicons name="share-social" size={18} color="#fff" />
              <Text style={styles.shareText}>Share</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.collapseBtn, { borderColor: isDark ? '#ffd700' : '#6366f1' }]}
              onPress={() => setIsExpanded(false)}
            >
              <Ionicons name="chevron-up" size={18} color={isDark ? '#ffd700' : '#6366f1'} />
              <Text style={[styles.collapseText, { color: isDark ? '#ffd700' : '#6366f1' }]}>
                Show Less
              </Text>
            </TouchableOpacity>
          </View>
        </>
      )}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  card: {
    marginHorizontal: 16,
    marginTop: 12,
    marginBottom: 16,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 6,
    position: 'relative',
    zIndex: 10,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  iconRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  glowBulb: {
    fontSize: 24,
    marginRight: 8,
    textShadowColor: '#ffe066',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 12,
    shadowOpacity: 0.5,
  },
  title: {
    fontSize: 18,
    fontWeight: 'bold',
    letterSpacing: 0.5,
  },
  closeBtn: {
    padding: 4,
  },
  text: {
    fontSize: 14,
    marginBottom: 12,
    marginTop: 2,
    fontWeight: '500',
    lineHeight: 20,
  },
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-end',
    borderRadius: 16,
    paddingHorizontal: 18,
    paddingVertical: 9,
    marginTop: 2,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.18,
    shadowRadius: 6,
    elevation: 2,
  },
  expandedContent: {
    maxHeight: 180,
    marginBottom: 12,
    flexGrow: 0,
    flexShrink: 1,
  },
  scrollContent: {
    paddingVertical: 4,
    flexGrow: 1,
  },
  adviceItem: {
    fontSize: 15,
    marginBottom: 8,
    marginTop: 2,
    fontWeight: '500',
    lineHeight: 22,
  },
  sourcesBox: {
    marginBottom: 16,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.1)',
  },
  sourcesTitle: {
    fontWeight: 'bold',
    fontSize: 14,
    marginBottom: 8,
  },
  sourceLink: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
    paddingVertical: 2,
  },
  sourceText: {
    marginLeft: 6,
    fontSize: 12,
    fontWeight: '500',
  },
  actionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  shareBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#6366f1',
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 8,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.18,
    shadowRadius: 6,
    elevation: 2,
  },
  shareText: {
    color: '#fff',
    marginLeft: 6,
    fontWeight: 'bold',
    fontSize: 14,
  },
  collapseBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1.5,
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  collapseText: {
    marginLeft: 6,
    fontWeight: 'bold',
    fontSize: 14,
  },
});
