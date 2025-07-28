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
  View,
} from 'react-native';
import Modal from 'react-native-modal';

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

  const handleShare = async () => {
    if (!advice) return;
    try {
      await Share.share({
        message: advice.join('\n\n'),
      });
    } catch (e) {}
  };

  return (
    <Modal
      isVisible={visible}
      onBackdropPress={onClose}
      animationIn="slideInUp"
      animationOut="fadeOutDown"
      backdropOpacity={0.45}
      style={styles.modal}
      useNativeDriver
    >
      <LinearGradient
        colors={
          isDark
            ? ['#232336', '#181825']
            : ['#f9fafb', '#e0e7ff']
        }
        style={styles.gradient}
        start={{ x: 0.2, y: 0.1 }}
        end={{ x: 1, y: 1 }}
      />
      <View
        style={[
          styles.content,
          {
            backgroundColor: isDark
              ? 'rgba(30,32,40,0.85)'
              : 'rgba(255,255,255,0.85)',
            borderColor: isDark ? '#444' : '#e0e0e0',
            shadowColor: isDark ? '#222' : '#bbb',
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
          <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
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
    </Modal>
  );
}

const styles = StyleSheet.create({
  modal: {
    justifyContent: 'flex-end',
    margin: 0,
  },
  gradient: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 0,
  },
  content: {
    borderTopLeftRadius: 26,
    borderTopRightRadius: 26,
    padding: 22,
    borderWidth: 1.5,
    overflow: 'hidden',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.15,
    shadowRadius: 18,
    elevation: 10,
    position: 'relative',
    zIndex: 10,
    marginHorizontal: 0,
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
