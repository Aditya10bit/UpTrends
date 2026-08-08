import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import {
  Animated,
  BackHandler,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  useColorScheme,
  View
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { openExternalUrl } from '../utils/openExternalUrl';

type KeyUpgradeModalProps = {
  visible: boolean;
  onClose: () => void;
  theme: {
    card: string;
    background: string;
    primary: string;
    text: string;
    textSecondary: string;
    textTertiary: string;
    borderLight: string;
    dark?: boolean;
  };
};

export default function KeyUpgradeModal({
  visible,
  onClose,
  theme,
}: KeyUpgradeModalProps) {
  const insets = useSafeAreaInsets();
  const colorScheme = useColorScheme();
  const isDark = theme.dark ?? colorScheme === 'dark';

  const slideAnim = React.useRef(new Animated.Value(500)).current;
  const fadeAnim = React.useRef(new Animated.Value(0)).current;

  const handleClose = React.useCallback(() => {
    Animated.parallel([
      Animated.timing(slideAnim, {
        toValue: 500,
        duration: 220,
        useNativeDriver: true,
      }),
      Animated.timing(fadeAnim, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true,
      }),
    ]).start(() => onClose());
  }, [slideAnim, fadeAnim, onClose]);

  React.useEffect(() => {
    if (visible) {
      slideAnim.setValue(500);
      fadeAnim.setValue(0);
      Animated.parallel([
        Animated.spring(slideAnim, {
          toValue: 0,
          tension: 90,
          friction: 9,
          useNativeDriver: true,
        }),
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 220,
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [visible, slideAnim, fadeAnim]);

  // Hardware back button closes the modal
  React.useEffect(() => {
    if (visible) {
      const backHandler = BackHandler.addEventListener('hardwareBackPress', () => {
        handleClose();
        return true;
      });
      return () => backHandler.remove();
    }
  }, [visible, handleClose]);

  const openAIStudio = () => {
    handleClose();
    // Small delay so the modal fully closes before the browser opens
    setTimeout(() => {
      openExternalUrl('https://aistudio.google.com/apikey');
    }, 300);
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      onRequestClose={handleClose}
      statusBarTranslucent
    >
      <Animated.View style={[styles.modalOverlay, { opacity: fadeAnim }]}>
        <TouchableOpacity style={styles.backdrop} activeOpacity={1} onPress={handleClose} />
        <Animated.View
          style={[
            styles.sheet,
            {
              transform: [{ translateY: slideAnim }],
              backgroundColor: theme.card,
              paddingBottom: Math.max(insets.bottom, 20),
              borderTopColor: isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.08)',
            },
          ]}
        >
          {/* Grab handle */}
          <View
            style={[
              styles.grabHandle,
              { backgroundColor: isDark ? 'rgba(255,255,255,0.25)' : 'rgba(0,0,0,0.18)' },
            ]}
          />

          <ScrollView showsVerticalScrollIndicator={false} bounces={false}>
            {/* Header */}
            <View style={styles.header}>
              <View
                style={[
                  styles.iconBadge,
                  {
                    backgroundColor: isDark ? 'rgba(250,204,21,0.16)' : 'rgba(250,204,21,0.18)',
                    borderColor: isDark ? 'rgba(250,204,21,0.35)' : 'rgba(217,119,6,0.25)',
                  },
                ]}
              >
                <Ionicons name="key" size={26} color="#d97706" />
              </View>
              <View style={styles.headerText}>
                <Text style={[styles.title, { color: theme.text }]}>
                  Unlock the Full AI Experience
                </Text>
                <Text style={[styles.subtitle, { color: theme.textSecondary }]}>
                  You are on the shared default key right now. Your own Gemini key gives you a personal, faster pipeline.
                </Text>
              </View>
              <TouchableOpacity onPress={handleClose} style={styles.closeBtn} hitSlop={8}>
                <Ionicons name="close" size={26} color={theme.textTertiary} />
              </TouchableOpacity>
            </View>

            {/* Advantages */}
            <View
              style={[
                styles.section,
                { backgroundColor: isDark ? 'rgba(16,185,129,0.08)' : 'rgba(16,185,129,0.06)' },
              ]}
            >
              <View style={styles.sectionHeader}>
                <Ionicons name="checkmark-circle" size={18} color="#10b981" />
                <Text style={[styles.sectionTitle, { color: theme.text }]}>
                  Why add your own key?
                </Text>
              </View>
              {[
                'Your own private quota — never slowed down by other users',
                'Stays on the faster, more detailed model for longer',
                'No surprise drops to the lighter fallback model',
                'Works with your own Google account & billing',
              ].map((item) => (
                <View key={item} style={styles.bulletRow}>
                  <Ionicons name="checkmark" size={15} color="#10b981" style={styles.bulletIcon} />
                  <Text style={[styles.bullet, { color: theme.text }]}>{item}</Text>
                </View>
              ))}
            </View>

            {/* Free tier limits */}
            <View
              style={[
                styles.section,
                { backgroundColor: isDark ? 'rgba(245,158,11,0.08)' : 'rgba(245,158,11,0.07)' },
              ]}
            >
              <View style={styles.sectionHeader}>
                <Ionicons name="warning" size={18} color="#f59e0b" />
                <Text style={[styles.sectionTitle, { color: theme.text }]}>
                  Shared free-key limits
                </Text>
              </View>
              {[
                'Only ~20 fast AI requests per day (pool shared by everyone)',
                'Once the pool runs out, results switch to the lighter model',
                'Peak hours can feel slower or less detailed',
              ].map((item) => (
                <View key={item} style={styles.bulletRow}>
                  <Ionicons name="alert-circle" size={15} color="#f59e0b" style={styles.bulletIcon} />
                  <Text style={[styles.bullet, { color: theme.text }]}>{item}</Text>
                </View>
              ))}
            </View>

            {/* Upgrade message */}
            <View style={styles.tipBox}>
              <Ionicons name="sparkles" size={16} color="#8b5cf6" />
              <Text style={[styles.tipText, { color: theme.textSecondary }]}>
                <Text style={{ fontWeight: '700', color: '#8b5cf6' }}>Pro tip: </Text>
                A free Gemini key already gives you a big boost. For serious everyday use, upgrade your Google AI billing — you only pay for what you actually use.
              </Text>
            </View>

            {/* Actions */}
            <TouchableOpacity
              onPress={openAIStudio}
              style={[
                styles.primaryBtn,
                {
                  backgroundColor: theme.primary,
                  shadowColor: theme.primary,
                  opacity: isDark ? 0.95 : 1,
                },
              ]}
            >
              <Ionicons name="open-outline" size={18} color="#fff" />
              <Text style={styles.primaryBtnText}>Get Your Free API Key</Text>
            </TouchableOpacity>

            <TouchableOpacity onPress={handleClose} style={styles.secondaryBtn}>
              <Text style={[styles.secondaryBtnText, { color: theme.textSecondary }]}>
                Maybe Later
              </Text>
            </TouchableOpacity>
          </ScrollView>
        </Animated.View>
      </Animated.View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.55)',
  },
  backdrop: {
    flex: 1,
  },
  sheet: {
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    borderTopWidth: 1,
    paddingHorizontal: 22,
    paddingTop: 10,
    maxHeight: '82%',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.2,
    shadowRadius: 20,
    elevation: 24,
  },
  grabHandle: {
    alignSelf: 'center',
    width: 42,
    height: 5,
    borderRadius: 3,
    marginBottom: 14,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 16,
  },
  iconBadge: {
    width: 48,
    height: 48,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    marginRight: 12,
    marginTop: 2,
  },
  headerText: {
    flex: 1,
  },
  title: {
    fontSize: 19,
    fontWeight: '800',
    letterSpacing: 0.2,
    lineHeight: 24,
  },
  subtitle: {
    fontSize: 13,
    lineHeight: 18,
    marginTop: 5,
  },
  closeBtn: {
    marginLeft: 10,
    padding: 2,
    marginTop: 2,
  },
  section: {
    borderRadius: 14,
    padding: 14,
    marginBottom: 12,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 9,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: '700',
    marginLeft: 7,
  },
  bulletRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 7,
  },
  bulletIcon: {
    marginTop: 2,
    marginRight: 8,
  },
  bullet: {
    flex: 1,
    fontSize: 13.5,
    lineHeight: 19,
  },
  tipBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(139,92,246,0.25)',
    backgroundColor: 'rgba(139,92,246,0.08)',
    padding: 12,
    marginBottom: 14,
  },
  tipText: {
    flex: 1,
    fontSize: 12.5,
    lineHeight: 18,
    marginLeft: 8,
  },
  primaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 14,
    paddingVertical: 15,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.25,
    shadowRadius: 12,
    elevation: 5,
  },
  primaryBtnText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 15,
    marginLeft: 8,
  },
  secondaryBtn: {
    alignItems: 'center',
    paddingVertical: 13,
    marginTop: 4,
  },
  secondaryBtnText: {
    fontSize: 14,
    fontWeight: '600',
  },
});
