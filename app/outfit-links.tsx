import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Dimensions,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { WebView } from 'react-native-webview';
import { useTheme } from '../contexts/ThemeContext';

const { width: screenWidth } = Dimensions.get('window');
const getResponsiveSize = (size: number) => (screenWidth / 375) * size;

export default function OutfitLinksScreen() {
  const { theme } = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams();

  const [loading, setLoading] = useState(true);
  const [currentUrl, setCurrentUrl] = useState('');

  // Parse the outfit links from params
  const outfitLinks = params.links ? JSON.parse(params.links as string) : [];
  const outfitName = params.outfitName as string || 'Outfit Inspiration';
  const initialUrl = params.url as string || outfitLinks[0]?.url;

  React.useEffect(() => {
    if (initialUrl) {
      setCurrentUrl(initialUrl);
    }
  }, [initialUrl]);

  const handleLinkPress = (url: string) => {
    setLoading(true);
    setCurrentUrl(url);
  };

  const handleShare = () => {
    Alert.alert(
      'Share Outfit',
      'Share this outfit inspiration with friends!',
      [
        {
          text: 'Copy Link', onPress: () => {
            // In a real app, you'd copy to clipboard
            Alert.alert('Link Copied', 'Outfit link copied to clipboard!');
          }
        },
        { text: 'Cancel', style: 'cancel' }
      ]
    );
  };

  if (!currentUrl) {
    return (
      <View style={[styles.container, { backgroundColor: theme.background }]}>
        <StatusBar barStyle={theme.background === '#18181b' ? "light-content" : "dark-content"} />
        <View style={[styles.header, { paddingTop: insets.top }]}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <Ionicons name="arrow-back" size={24} color={theme.text} />
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { color: theme.text }]}>Outfit Links</Text>
          <View style={styles.placeholder} />
        </View>
        <View style={styles.errorContainer}>
          <Ionicons name="link-outline" size={64} color={theme.textTertiary} />
          <Text style={[styles.errorText, { color: theme.textSecondary }]}>
            No outfit links available
          </Text>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <StatusBar barStyle={theme.background === '#18181b' ? "light-content" : "dark-content"} />

      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top, backgroundColor: theme.card }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color={theme.text} />
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <Text style={[styles.headerTitle, { color: theme.text }]} numberOfLines={1}>
            {outfitName}
          </Text>
          <Text style={[styles.headerSubtitle, { color: theme.textSecondary }]} numberOfLines={1}>
            Outfit Inspiration
          </Text>
        </View>
        <TouchableOpacity onPress={handleShare} style={styles.shareButton}>
          <Ionicons name="share-outline" size={24} color={theme.primary} />
        </TouchableOpacity>
      </View>

      {/* Link Tabs */}
      {outfitLinks.length > 1 && (
        <View style={[styles.tabsContainer, { backgroundColor: theme.background }]}>
          {outfitLinks.map((link: any, index: number) => (
            <TouchableOpacity
              key={index}
              style={[
                styles.tab,
                {
                  backgroundColor: currentUrl === link.url ? theme.primary : theme.card,
                  borderColor: theme.borderLight
                }
              ]}
              onPress={() => handleLinkPress(link.url)}
            >
              <Text style={[
                styles.tabText,
                { color: currentUrl === link.url ? '#fff' : theme.text }
              ]}>
                {link.platform}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      )}

      {/* WebView */}
      <View style={styles.webViewContainer}>
        <WebView
          source={{ uri: currentUrl }}
          style={styles.webView}
          onLoadStart={() => setLoading(true)}
          onLoadEnd={() => setLoading(false)}
          onError={(error) => {
            console.error('WebView error:', error);
            setLoading(false);
            Alert.alert('Error', 'Failed to load the page. Please try again.');
          }}
          startInLoadingState={true}
          renderLoading={() => (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color={theme.primary} />
              <Text style={[styles.loadingText, { color: theme.textSecondary }]}>
                Loading outfit inspiration...
              </Text>
            </View>
          )}
        />

        {loading && (
          <View style={styles.loadingOverlay}>
            <ActivityIndicator size="large" color={theme.primary} />
            <Text style={[styles.loadingText, { color: theme.textSecondary }]}>
              Loading...
            </Text>
          </View>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: getResponsiveSize(16),
    paddingBottom: getResponsiveSize(12),
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 4,
  },
  backButton: {
    padding: getResponsiveSize(8),
  },
  headerCenter: {
    flex: 1,
    alignItems: 'center',
    marginHorizontal: getResponsiveSize(16),
  },
  headerTitle: {
    fontSize: getResponsiveSize(18),
    fontWeight: 'bold',
  },
  headerSubtitle: {
    fontSize: getResponsiveSize(12),
    marginTop: 2,
  },
  shareButton: {
    padding: getResponsiveSize(8),
  },
  placeholder: {
    width: getResponsiveSize(40),
  },
  tabsContainer: {
    flexDirection: 'row',
    paddingHorizontal: getResponsiveSize(16),
    paddingVertical: getResponsiveSize(8),
    gap: getResponsiveSize(8),
  },
  tab: {
    paddingHorizontal: getResponsiveSize(16),
    paddingVertical: getResponsiveSize(8),
    borderRadius: getResponsiveSize(20),
    borderWidth: 1,
  },
  tabText: {
    fontSize: getResponsiveSize(14),
    fontWeight: '600',
  },
  webViewContainer: {
    flex: 1,
    position: 'relative',
  },
  webView: {
    flex: 1,
  },
  loadingContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
  },
  loadingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.8)',
  },
  loadingText: {
    marginTop: getResponsiveSize(12),
    fontSize: getResponsiveSize(14),
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: getResponsiveSize(32),
  },
  errorText: {
    fontSize: getResponsiveSize(16),
    textAlign: 'center',
    marginTop: getResponsiveSize(16),
  },
});