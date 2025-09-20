import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import {
  Animated,
  BackHandler,
  Linking,
  Modal,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  TouchableOpacity,
  useColorScheme,
  View
} from 'react-native';

type AIAdviceModalProps = {
  visible: boolean;
  onClose: () => void;
  advice: string[] | null;
  sources?: string[];
  theme: {
    card: string;
    primary: string;
    text: string;
    dark?: boolean;
  };
};

export default function AIAdviceModal({
  visible,
  onClose,
  advice,
  sources = [],
  theme,
}: AIAdviceModalProps) {
  const colorScheme = useColorScheme();
  const isDark = theme?.dark ?? colorScheme === 'dark';

  // Animation values - start with modal hidden
  const slideAnim = React.useRef(new Animated.Value(300)).current;

  const handleClose = () => {
    // Animate out first, then close
    Animated.timing(slideAnim, {
      toValue: 300,
      duration: 250,
      useNativeDriver: true,
    }).start(() => {
      onClose();
    });
  };

  // Handle modal animations
  React.useEffect(() => {
    console.log('🔍 Modal animation effect - visible:', visible);
    if (visible) {
      // Start from bottom and slide up
      slideAnim.setValue(300);
      Animated.spring(slideAnim, {
        toValue: 0,
        tension: 100,
        friction: 8,
        useNativeDriver: true,
      }).start();
    }
  }, [visible]);

  // Handle hardware back button
  React.useEffect(() => {
    if (visible) {
      const backHandler = BackHandler.addEventListener('hardwareBackPress', () => {
        handleClose();
        return true; // Prevent default behavior
      });
      return () => backHandler.remove();
    }
  }, [visible, handleClose]);

  const handleShare = async () => {
    if (!advice) return;
    try {
      await Share.share({
        message: advice.join('\n\n'),
      });
    } catch (e) { }
  };

  // Debug logging
  React.useEffect(() => {
    console.log('🔍 AIAdviceModal - visible:', visible);
    console.log('🔍 AIAdviceModal - advice:', advice);
  }, [visible, advice]);

  return (
    <Modal
      visible={visible}
      transparent={true}
      animationType="none"
      onRequestClose={handleClose}
      statusBarTranslucent={false}
    >
      <View style={styles.modalOverlay}>
        <TouchableOpacity
          style={styles.backdrop}
          activeOpacity={1}
          onPress={handleClose}
        />
        <Animated.View 
          style={[
            styles.modalContainer,
            {
              transform: [{ translateY: slideAnim }],
            },
          ]}
        >
          <View
            style={[
              styles.content,
              {
                backgroundColor: '#ffffff',
                borderColor: '#e0e0e0',
                shadowColor: '#bbb',
              },
            ]}
          >
            <View style={styles.headerRow}>
              <Text style={styles.glowBulb}>💡</Text>
              <Text
                style={[
                  styles.title,
                  { color: isDark ? '#ffd700' : '#6d28d9' },
                ]}
              >
                AI Style Advice
              </Text>
              <TouchableOpacity onPress={handleClose} style={styles.closeBtn}>
                <Ionicons name="close-circle" size={28} color={isDark ? '#ffd700' : '#6366f1'} />
              </TouchableOpacity>
            </View>
            <ScrollView style={{ maxHeight: 330 }}>
              {advice && advice.length > 0 ? (
                advice.map((line, i) => (
                  <Text
                    key={i}
                    style={[
                      styles.advice,
                      { color: isDark ? '#fff' : '#2d2d2d' },
                    ]}
                  >{`\u2022 ${line}`}</Text>
                ))
              ) : (
                <Text style={[styles.advice, { color: isDark ? '#fff' : '#2d2d2d' }]}>
                  No advice found for your profile.
                </Text>
              )}
            </ScrollView>
            {sources && sources.length > 0 && (
              <View style={styles.sourcesBox}>
                <Text style={[styles.sourcesTitle, { color: isDark ? '#ffd700' : '#6366f1' }]}>
                  Sources:
                </Text>
                {sources.map((url, idx) => (
                  <TouchableOpacity
                    key={idx}
                    onPress={() => Linking.openURL(url)}
                    style={styles.sourceLink}
                  >
                    <Ionicons name="link" size={16} color={isDark ? '#ffd700' : '#6366f1'} />
                    <Text
                      style={{
                        color: isDark ? '#ffd700' : '#6366f1',
                        marginLeft: 5,
                        fontSize: 13,
                      }}
                      numberOfLines={1}
                      ellipsizeMode="middle"
                    >
                      {url.replace(/^https?:\/\//, '').slice(0, 40)}...
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            )}
            <View style={styles.footerRow}>
              <TouchableOpacity style={styles.shareBtn} onPress={handleShare}>
                <Ionicons name="share-social" size={20} color="#fff" />
                <Text style={{ color: '#fff', marginLeft: 7, fontWeight: 'bold' }}>
                  Share
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  backdrop: {
    flex: 1,
  },
  modalContainer: {
    maxHeight: '70%',
    minHeight: 300,
    borderTopLeftRadius: 26,
    borderTopRightRadius: 26,
    overflow: 'hidden',
    backgroundColor: '#ff0000', // Bright red for debugging
  },
  gradient: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  content: {
    padding: 22,
    borderWidth: 1.5,
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.15,
    shadowRadius: 18,
    elevation: 10,
    minHeight: 210,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
    justifyContent: 'space-between',
  },
  glowBulb: {
    fontSize: 32,
    marginRight: 10,
    textShadowColor: '#ffe066',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 16,
    shadowOpacity: 0.7,
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    letterSpacing: 1,
    flex: 1,
  },
  closeBtn: {
    marginLeft: 10,
    padding: 2,
  },
  advice: {
    fontSize: 15.5,
    marginBottom: 8,
    marginTop: 2,
    fontWeight: '500',
  },
  sourcesBox: {
    marginTop: 16,
    marginBottom: 2,
  },
  sourcesTitle: {
    fontWeight: 'bold',
    fontSize: 14,
    marginBottom: 2,
  },
  sourceLink: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 2,
    marginBottom: 2,
    paddingVertical: 2,
  },
  footerRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginTop: 18,
  },
  shareBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#6366f1',
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 9,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.18,
    shadowRadius: 6,
    elevation: 2,
  },
});
