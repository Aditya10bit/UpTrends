import { Ionicons } from '@expo/vector-icons';
import React, { useEffect, useRef } from 'react';
import {
  ActivityIndicator,
  Animated,
  FlatList,
  Modal,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { SavedChatMeta } from '../services/chatHistoryService';

type SavedChatsSidebarProps = {
  visible: boolean;
  onClose: () => void;
  chats: SavedChatMeta[];
  loading: boolean;
  theme: any;
  onOpenChat: (id: string) => void;
  onNewChat: () => void;
  onDeleteChat: (id: string) => void;
};

const PANEL_WIDTH = 310;

const timeAgo = (ts: number): string => {
  const diff = Date.now() - ts;
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}d ago`;
  const weeks = Math.floor(days / 7);
  if (weeks < 5) return `${weeks}w ago`;
  const months = Math.floor(days / 30);
  return `${months}mo ago`;
};

export default function SavedChatsSidebar({
  visible,
  onClose,
  chats,
  loading,
  theme,
  onOpenChat,
  onNewChat,
  onDeleteChat,
}: SavedChatsSidebarProps) {
  const insets = useSafeAreaInsets();
  const slideAnim = useRef(new Animated.Value(PANEL_WIDTH)).current;

  useEffect(() => {
    if (visible) {
      Animated.spring(slideAnim, {
        toValue: 0,
        tension: 90,
        friction: 12,
        useNativeDriver: true,
      }).start();
    } else {
      slideAnim.setValue(PANEL_WIDTH);
    }
  }, [visible, slideAnim]);

  const handleClose = () => {
    Animated.timing(slideAnim, {
      toValue: PANEL_WIDTH,
      duration: 180,
      useNativeDriver: true,
    }).start(onClose);
  };

  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={handleClose}>
      <View style={styles.overlay}>
        <TouchableOpacity style={styles.backdrop} activeOpacity={1} onPress={handleClose} />
        <Animated.View
          style={[
            styles.panel,
            {
              backgroundColor: theme.card,
              paddingTop: insets.top + 12,
              paddingBottom: insets.bottom + 8,
              transform: [{ translateX: slideAnim }],
            },
          ]}
        >
          {/* Header */}
          <View style={styles.headerRow}>
            <View style={{ flex: 1 }}>
              <Text style={[styles.title, { color: theme.text }]}>Saved Chats</Text>
              <Text style={[styles.subtitle, { color: theme.textTertiary }]}>
                Up to 5 conversations, auto-saved
              </Text>
            </View>
            <TouchableOpacity style={styles.iconBtn} onPress={handleClose}>
              <Ionicons name="close" size={22} color={theme.textSecondary} />
            </TouchableOpacity>
          </View>

          {/* New Chat */}
          <TouchableOpacity
            style={[styles.newChatBtn, { backgroundColor: theme.primary + '15' }]}
            onPress={() => {
              handleClose();
              onNewChat();
            }}
          >
            <Ionicons name="add-circle" size={18} color={theme.primary} />
            <Text style={[styles.newChatText, { color: theme.primary }]}>New Chat</Text>
          </TouchableOpacity>

          {/* List */}
          {loading ? (
            <View style={styles.centerBox}>
              <ActivityIndicator size="large" color={theme.primary} />
            </View>
          ) : chats.length === 0 ? (
            <View style={styles.centerBox}>
              <Text style={{ fontSize: 34 }}>💬</Text>
              <Text style={[styles.emptyTitle, { color: theme.textSecondary }]}>
                No saved chats yet
              </Text>
              <Text style={[styles.emptySub, { color: theme.textTertiary }]}>
                Chat with Aria and your conversation is saved here automatically — up to 5.
              </Text>
            </View>
          ) : (
            <FlatList
              data={chats}
              keyExtractor={(c) => c.id}
              contentContainerStyle={{ paddingBottom: 12 }}
              showsVerticalScrollIndicator={false}
              renderItem={({ item, index }) => (
                <TouchableOpacity
                  style={[
                    styles.chatRow,
                    { backgroundColor: theme.background, borderColor: theme.borderLight },
                    index === 0 && { borderColor: theme.primary + '55' },
                  ]}
                  onPress={() => {
                    handleClose();
                    onOpenChat(item.id);
                  }}
                  activeOpacity={0.7}
                >
                  <View style={[styles.chatIcon, { backgroundColor: theme.primary + '15' }]}>
                    <Ionicons name="chatbubble-ellipses" size={16} color={theme.primary} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.chatTitle, { color: theme.text }]} numberOfLines={1}>
                      {item.title}
                    </Text>
                    {item.preview ? (
                      <Text style={[styles.chatPreview, { color: theme.textTertiary }]} numberOfLines={2}>
                        {item.preview}
                      </Text>
                    ) : null}
                    <Text style={[styles.chatMeta, { color: theme.textTertiary }]}>
                      {item.messageCount} messages • {timeAgo(item.updatedAt)}
                    </Text>
                  </View>
                  <TouchableOpacity
                    style={styles.deleteBtn}
                    onPress={() => onDeleteChat(item.id)}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  >
                    <Ionicons name="trash-outline" size={16} color={theme.textTertiary} />
                  </TouchableOpacity>
                </TouchableOpacity>
              )}
            />
          )}
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, flexDirection: 'row', backgroundColor: 'rgba(0,0,0,0.45)' },
  backdrop: { flex: 1 },
  panel: {
    width: PANEL_WIDTH,
    height: '100%',
    paddingHorizontal: 14,
    shadowColor: '#000',
    shadowOffset: { width: -4, height: 0 },
    shadowOpacity: 0.2,
    shadowRadius: 12,
    elevation: 12,
  },
  headerRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  title: { fontSize: 19, fontWeight: '800', letterSpacing: -0.3 },
  subtitle: { fontSize: 11, fontWeight: '500', marginTop: 2 },
  iconBtn: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center' },
  newChatBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 11,
    borderRadius: 12,
    marginBottom: 12,
  },
  newChatText: { fontSize: 14, fontWeight: '800' },
  centerBox: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 20 },
  emptyTitle: { fontSize: 15, fontWeight: '700', marginTop: 10 },
  emptySub: { fontSize: 12, textAlign: 'center', lineHeight: 18, marginTop: 6 },
  chatRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 12,
    borderWidth: 1,
    padding: 12,
    marginBottom: 8,
    gap: 10,
  },
  chatIcon: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center' },
  chatTitle: { fontSize: 14, fontWeight: '800' },
  chatPreview: { fontSize: 11, lineHeight: 15, marginTop: 2 },
  chatMeta: { fontSize: 10, fontWeight: '600', marginTop: 4 },
  deleteBtn: { padding: 4 },
});
