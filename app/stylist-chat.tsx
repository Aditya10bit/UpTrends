import React, { useState, useEffect, useRef } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  Image,
  TextInput,
  FlatList,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  StatusBar,
  Modal,
  Dimensions,
  ScrollView,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import { Stack, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../contexts/ThemeContext';
import { useAuth } from '../contexts/AuthContext';
import { openExternalUrl } from '../utils/openExternalUrl';
import {
  getWardrobe,
  sendMessageToStylist,
  WardrobeItem,
  ChatMessage,
  PackingData,
} from '../services/digitalWardrobeService';
import { getUserProfile } from '../services/userService';

const { width: screenWidth } = Dimensions.get('window');

const PRESET_PROMPTS = [
  'What matches my black dress from my closet?',
  'Make a non-ethnic casual outfit for a pooja — no red',
  'Packing list for a 3-day Paris trip',
  'Style advice for athletic bodies',
];

export default function StylistChatScreen() {
  const { theme, mode } = useTheme();
  const isDark = mode === 'dark';
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputText, setInputText] = useState('');
  const [loading, setLoading] = useState(false);
  const [wardrobeItems, setWardrobeItems] = useState<WardrobeItem[]>([]);
  const [userProfile, setUserProfile] = useState<any>(null);
  
  // Closet Attachment modal & selection
  const [showClosetModal, setShowClosetModal] = useState(false);
  const [attachedItem, setAttachedItem] = useState<WardrobeItem | null>(null);

  const flatListRef = useRef<FlatList>(null);

  useEffect(() => {
    loadData();
    // Initial welcome message
    setMessages([
      {
        id: 'welcome',
        text: "Hello! I'm Aria, your personal AI fashion stylist. I can see everything in your closet — ask what matches a specific item (like your black dress or kurta), build an outfit for any occasion with the colors you want, or pack for a trip. Ask away! ✨",
        isUser: false,
        timestamp: new Date(),
      },
    ]);
  }, []);

  const loadData = async () => {
    try {
      const [items, profile] = await Promise.all([
        getWardrobe(),
        getUserProfile(),
      ]);
      setWardrobeItems(items);
      setUserProfile(profile);
    } catch (error) {
      console.error('Failed to load chat data:', error);
    }
  };

  const handleSend = async (textToSend: string) => {
    const trimmed = textToSend.trim();
    if (!trimmed && !attachedItem) return;

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    const userMsg: ChatMessage = {
      id: `msg_${Date.now()}`,
      text: trimmed || `Styling this item: ${attachedItem?.name}`,
      isUser: true,
      timestamp: new Date(),
      attachedItem: attachedItem || undefined,
    };

    setMessages(prev => [...prev, userMsg]);
    setInputText('');
    setAttachedItem(null);
    setLoading(true);

    setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 100);

    try {
      const response = await sendMessageToStylist(
        userMsg.text,
        messages.concat(userMsg),
        userMsg.attachedItem,
        userProfile,
        wardrobeItems
      );

      const stylistMsg: ChatMessage = {
        id: `msg_${Date.now()}_reply`,
        text: response.text,
        isUser: false,
        timestamp: new Date(),
        packingData: response.packingData,
        closetItemNames: response.closetItemNames,
      };

      setMessages(prev => [...prev, stylistMsg]);
    } catch (e: any) {
      const errorMsg: ChatMessage = {
        id: `msg_${Date.now()}_err`,
        text: 'Sorry, I encountered an issue analyzing your style request. Please try again.',
        isUser: false,
        timestamp: new Date(),
      };
      setMessages(prev => [...prev, errorMsg]);
    } finally {
      setLoading(false);
      setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 100);
    }
  };

  const resolveImageSource = (item: WardrobeItem) => {
    if (item.imageUri && (item.imageUri.startsWith('http') || item.imageUri.startsWith('file:') || item.imageUri.startsWith('content:'))) {
      return { uri: item.imageUri };
    }
    if (item.imageBase64) {
      return { uri: `data:image/jpeg;base64,${item.imageBase64}` };
    }
    return { uri: item.imageUri };
  };

  // Open a URL in the real browser (Chrome) so the user's saved login/cookies
  // are reused — the in-app browser forces re-login on every open.
  const openLink = async (url: string) => {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    await openExternalUrl(url);
  };

  // Map a URL to a shopping platform (icon + brand color) — matches the platform
  // icons used on the outfit/style-check screens (Myntra=diamond, Google=search…).
  const getShoppingPlatform = (url: string): { name: string; icon: any; color: string } => {
    const lower = url.toLowerCase();
    if (lower.includes('amazon.')) return { name: 'Amazon', icon: 'storefront', color: '#FF9900' };
    if (lower.includes('myntra')) return { name: 'Myntra', icon: 'diamond', color: '#FF3F6C' };
    if (lower.includes('google.com')) return { name: 'Google', icon: 'search', color: '#4285F4' };
    if (lower.includes('pinterest')) return { name: 'Pinterest', icon: 'camera', color: '#E60023' };
    return { name: 'Shop', icon: 'storefront', color: '#6366f1' };
  };

  // Render message text with shopping URLs converted to platform icon buttons
  // (stylist messages only). The raw URL is stripped from the text so the bubble
  // reads cleanly and the links look like the other category screens.
  const renderMessageText = (text: string, isUser: boolean) => {
    const baseStyle = isUser
      ? [styles.messageText, { color: '#fff' }]
      : [styles.messageText, { color: theme.text }];
    if (isUser) return <Text style={baseStyle}>{text}</Text>;

    const urlRegex = /https?:\/\/[^\s<>"']+/g;
    const urls = (text.match(urlRegex) || [])
      .map(u => u.replace(/[.,;:!?)\]}]+$/, ''))
      .filter((u, i, arr) => arr.indexOf(u) === i); // dedupe repeated links
    const cleanText = text
      .replace(urlRegex, '')
      .replace(/\s{2,}/g, ' ')
      .replace(/\s+([.,;:!?])/g, '$1')
      .trim();

    return (
      <>
        {cleanText.length > 0 && <Text style={baseStyle}>{cleanText}</Text>}
        {urls.length > 0 && (
          <View style={styles.shoppingLinksRow}>
            {urls.map((url, idx) => {
              const platform = getShoppingPlatform(url);
              return (
                <TouchableOpacity
                  key={idx}
                  style={[styles.shoppingLinkBtn, { backgroundColor: platform.color }]}
                  onPress={() => openLink(url)}
                  activeOpacity={0.8}
                >
                  <Ionicons name={platform.icon} size={14} color="#fff" />
                  <Text style={styles.shoppingLinkBtnText}>{platform.name}</Text>
                  <Ionicons name="open-outline" size={11} color="rgba(255,255,255,0.8)" />
                </TouchableOpacity>
              );
            })}
          </View>
        )}
      </>
    );
  };

  const renderPackingCard = (packingData: PackingData) => {
    const selectedItems = wardrobeItems.filter(w => packingData.selectedClosetItemNames.includes(w.name));
    return (
      <View style={[styles.packingCard, { backgroundColor: isDark ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.04)', borderColor: theme.primary + '40' }]}>
        <View style={styles.packingCardHeader}>
          <Text style={{ fontSize: 16 }}>🧳</Text>
          <Text style={[styles.packingCardTitle, { color: theme.primary }]}>Your Packing List</Text>
        </View>
        {selectedItems.length > 0 && (
          <View style={styles.packingSection}>
            <Text style={[styles.packingSectionTitle, { color: theme.text }]}>From Your Closet</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              {selectedItems.map(item => (
                <View key={item.id} style={[styles.packingItemThumb, { backgroundColor: theme.card }]}>
                  <Image source={resolveImageSource(item)} style={styles.packingThumbImage as any} />
                  <Text style={[styles.packingThumbName, { color: theme.text }]} numberOfLines={2}>{item.name}</Text>
                </View>
              ))}
            </ScrollView>
          </View>
        )}
        {packingData.outfitCombinations.length > 0 && (
          <View style={styles.packingSection}>
            <Text style={[styles.packingSectionTitle, { color: theme.text }]}>Outfit Combos</Text>
            {packingData.outfitCombinations.map((combo, idx) => (
              <View key={idx} style={[styles.comboRow, { borderLeftColor: theme.primary }]}>
                <Text style={[styles.comboText, { color: theme.textSecondary }]}>{combo}</Text>
              </View>
            ))}
          </View>
        )}
        {packingData.missingItems.length > 0 && (
          <View style={styles.packingSection}>
            <Text style={[styles.packingSectionTitle, { color: theme.text }]}>{'You\'ll Need to Buy'}</Text>
            {packingData.missingItems.map((item, idx) => (
              <TouchableOpacity
                key={idx}
                style={[styles.missingItemRow, { backgroundColor: isDark ? 'rgba(255,100,100,0.1)' : 'rgba(255,50,50,0.06)', borderColor: '#ff6b6b30' }]}
                onPress={() => openExternalUrl(
                  `https://www.google.com/search?tbm=shop&q=${encodeURIComponent(item.name)}`
                )}
              >
                <View style={{ flex: 1 }}>
                  <Text style={[styles.missingItemName, { color: theme.text }]}>🛒 {item.name}</Text>
                  <Text style={[styles.missingItemReason, { color: theme.textSecondary }]}>{item.reason}</Text>
                </View>
                <Ionicons name="open-outline" size={14} color={theme.textSecondary} />
              </TouchableOpacity>
            ))}
          </View>
        )}
      </View>
    );
  };

  const renderClosetCard = (closetItemNames: string[]) => {
    const matchedItems = wardrobeItems.filter(w => closetItemNames.includes(w.name));
    if (matchedItems.length === 0) return null;
    return (
      <View style={[styles.packingCard, { backgroundColor: isDark ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.04)', borderColor: theme.primary + '40' }]}>
        <View style={styles.packingCardHeader}>
          <Text style={{ fontSize: 16 }}>👗</Text>
          <Text style={[styles.packingCardTitle, { color: theme.primary }]}>From Your Closet</Text>
        </View>
        <View style={styles.packingSection}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            {matchedItems.map(item => (
              <View key={item.id} style={[styles.packingItemThumb, { backgroundColor: theme.card }]}>
                <Image source={resolveImageSource(item)} style={styles.packingThumbImage as any} />
                <Text style={[styles.packingThumbName, { color: theme.text }]} numberOfLines={2}>{item.name}</Text>
              </View>
            ))}
          </ScrollView>
        </View>
      </View>
    );
  };

  const renderMessageItem = ({ item }: { item: ChatMessage }) => {
    return (
      <View style={[styles.messageRow, item.isUser ? styles.userRow : styles.stylistRow]}>
        {!item.isUser && (
          <View style={[styles.avatarCircle, { backgroundColor: theme.primary }]}>
            <Text style={{ color: '#fff', fontSize: 13, fontWeight: '800' }}>A</Text>
          </View>
        )}
        <View style={{ flex: 1, alignItems: item.isUser ? 'flex-end' : 'flex-start' }}>
          <View
            style={[
              styles.chatBubble,
              item.isUser
                ? { backgroundColor: theme.primary }
                : { backgroundColor: theme.card, borderColor: theme.borderLight, borderWidth: 1 },
            ]}
          >
            {item.attachedItem && (
              <View style={styles.attachedPreviewCard}>
                <Image source={resolveImageSource(item.attachedItem)} style={styles.attachedPreviewImage as any} />
                <View style={{ marginLeft: 8, flex: 1 }}>
                  <Text style={styles.attachedPreviewName} numberOfLines={1}>
                    {item.attachedItem.name}
                  </Text>
                  <Text style={styles.attachedPreviewType}>
                    {item.attachedItem.subType} • {item.attachedItem.primaryColor}
                  </Text>
                </View>
              </View>
            )}
            {renderMessageText(item.text, item.isUser)}
            {!item.isUser && item.packingData && renderPackingCard(item.packingData)}
            {!item.isUser && item.closetItemNames && item.closetItemNames.length > 0 && renderClosetCard(item.closetItemNames)}
          </View>
          <Text style={styles.timestampText}>
            {item.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </Text>
        </View>
      </View>
    );
  };

  return (
    <KeyboardAvoidingView
      style={[styles.container, { backgroundColor: theme.background }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
    >
      <Stack.Screen options={{ headerShown: false }} />
      <StatusBar barStyle="light-content" />

      {/* Header */}
      <LinearGradient
        colors={[theme.primary, theme.secondary]}
        style={[styles.header, { paddingTop: insets.top + 8 }]}
      >
        <View style={styles.headerRow}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
            <Ionicons name="chevron-back" size={24} color="#fff" />
          </TouchableOpacity>
          <View style={{ flex: 1 }}>
            <Text style={styles.headerTitle}>Aria Stylist Chat</Text>
            <Text style={styles.headerSubtitle}>Personal Styling Consultation</Text>
          </View>
        </View>
      </LinearGradient>

      {/* Message List */}
      <FlatList
        ref={flatListRef}
        data={messages}
        renderItem={renderMessageItem}
        keyExtractor={item => item.id}
        contentContainerStyle={[styles.chatList, { paddingBottom: 24 }]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        onContentSizeChange={() => {
          if (messages.length > 0) {
            requestAnimationFrame(() => flatListRef.current?.scrollToEnd({ animated: true }));
          }
        }}
        ListFooterComponent={
          loading ? (
            <View style={styles.stylistRow}>
              <View style={[styles.avatarCircle, { backgroundColor: theme.primary }]}>
                <Text style={{ color: '#fff', fontSize: 13, fontWeight: '800' }}>A</Text>
              </View>
              <View style={[styles.chatBubble, { backgroundColor: theme.card, paddingVertical: 14 }]}>
                <ActivityIndicator size="small" color={theme.primary} />
              </View>
            </View>
          ) : null
        }
      />

      {/* Quick Prompt Suggester Chips */}
      {messages.length === 1 && !loading && (
        <View style={styles.promptSection}>
          <Text style={[styles.promptLabel, { color: theme.textSecondary }]}>Ask Aria about:</Text>
          <View style={styles.chipsContainer}>
            {PRESET_PROMPTS.map((prompt, idx) => (
              <TouchableOpacity
                key={idx}
                style={[styles.promptChip, { backgroundColor: theme.card, borderColor: theme.borderLight }]}
                onPress={() => handleSend(prompt)}
              >
                <Text style={[styles.promptChipText, { color: theme.primary }]}>✨ {prompt}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      )}

      {/* Input Bar */}
      <View style={[styles.inputBarContainer, { backgroundColor: theme.card, borderTopColor: theme.borderLight, paddingBottom: insets.bottom + 8 }]}>
        {attachedItem && (
          <View style={[styles.attachmentIndicator, { backgroundColor: theme.background }]}>
            <Image source={resolveImageSource(attachedItem)} style={styles.attachedMiniThumb as any} />
            <Text style={[styles.attachmentText, { color: theme.text }]} numberOfLines={1}>
              Attached: {attachedItem.name}
            </Text>
            <TouchableOpacity onPress={() => setAttachedItem(null)} style={styles.attachmentClose}>
              <Ionicons name="close-circle" size={20} color={theme.textTertiary} />
            </TouchableOpacity>
          </View>
        )}

        <View style={styles.inputRow}>
          <TouchableOpacity
            style={[styles.attachButton, { backgroundColor: theme.primary + '15' }]}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              setShowClosetModal(true);
            }}
          >
            <Ionicons name="shirt-outline" size={20} color={theme.primary} />
          </TouchableOpacity>

          <TextInput
            style={[styles.textInput, { color: theme.text, backgroundColor: theme.background, maxHeight: 100 }]}
            placeholder="Ask about styling or a trip.."
            placeholderTextColor={theme.textTertiary}
            value={inputText}
            onChangeText={setInputText}
            multiline
            onFocus={() => {
              setTimeout(() => {
                flatListRef.current?.scrollToEnd({ animated: true });
              }, 200);
            }}
          />

          <TouchableOpacity
            style={[styles.sendButton, { backgroundColor: theme.primary }]}
            onPress={() => handleSend(inputText)}
            disabled={loading}
          >
            <Ionicons name="send" size={18} color="#fff" />
          </TouchableOpacity>
        </View>
      </View>

      {/* Closet Selection Modal */}
      <Modal
        visible={showClosetModal}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowClosetModal(false)}
      >
        <View style={[styles.modalContainer, { backgroundColor: theme.background }]}>
          <View style={styles.modalHeader}>
            <Text style={[styles.modalTitle, { color: theme.text }]}>Attach Item from Closet</Text>
            <TouchableOpacity onPress={() => setShowClosetModal(false)}>
              <Ionicons name="close" size={24} color={theme.text} />
            </TouchableOpacity>
          </View>

          {wardrobeItems.length === 0 ? (
            <View style={styles.emptyClosetModal}>
              <Text style={{ fontSize: 32 }}>👕</Text>
              <Text style={[styles.emptyClosetText, { color: theme.textSecondary }]}>Your closet is empty.</Text>
            </View>
          ) : (
            <FlatList
              data={wardrobeItems}
              numColumns={3}
              keyExtractor={item => item.id}
              contentContainerStyle={{ padding: 12 }}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={[styles.closetGridItem, { backgroundColor: theme.card }]}
                  onPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    setAttachedItem(item);
                    setShowClosetModal(false);
                  }}
                >
                  <Image source={resolveImageSource(item)} style={styles.closetGridImage as any} />
                  <Text style={[styles.closetGridName, { color: theme.text }]} numberOfLines={1}>
                    {item.name}
                  </Text>
                </TouchableOpacity>
              )}
            />
          )}
        </View>
      </Modal>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { paddingHorizontal: 16, paddingBottom: 16 },
  headerRow: { flexDirection: 'row', alignItems: 'center' },
  backBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(255,255,255,0.15)', justifyContent: 'center', alignItems: 'center', marginRight: 12 },
  headerTitle: { color: '#fff', fontSize: 24, fontWeight: '800', letterSpacing: -0.5 },
  headerSubtitle: { color: 'rgba(255,255,255,0.7)', fontSize: 13, fontWeight: '500', marginTop: 2 },

  chatList: { padding: 16 },
  messageRow: { flexDirection: 'row', marginBottom: 16, gap: 10, maxWidth: '85%' },
  userRow: { alignSelf: 'flex-end', justifyContent: 'flex-end' },
  stylistRow: { alignSelf: 'flex-start', justifyContent: 'flex-start' },
  
  avatarCircle: { width: 30, height: 30, borderRadius: 15, justifyContent: 'center', alignItems: 'center', marginTop: 2 },
  chatBubble: { borderRadius: 18, paddingHorizontal: 16, paddingVertical: 10, maxWidth: '100%' },
  messageText: { fontSize: 14, lineHeight: 20 },
  timestampText: { fontSize: 9, color: '#aaa', marginTop: 4, marginHorizontal: 6 },

  attachedPreviewCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.06)', borderRadius: 10, padding: 8, marginBottom: 8, width: 220 },
  attachedPreviewImage: { width: 44, height: 55, borderRadius: 6, resizeMode: 'cover' },
  attachedPreviewName: { fontSize: 12, fontWeight: '700' },
  attachedPreviewType: { fontSize: 10, color: '#666', marginTop: 2 },

  promptSection: { padding: 16 },
  promptLabel: { fontSize: 12, fontWeight: '700', marginBottom: 8 },
  chipsContainer: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  promptChip: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 14, borderWidth: 1 },
  promptChipText: { fontSize: 12, fontWeight: '600' },

  inputBarContainer: { borderTopWidth: 1, padding: 12 },
  inputRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  attachButton: { width: 42, height: 42, borderRadius: 21, justifyContent: 'center', alignItems: 'center' },
  textInput: { flex: 1, borderRadius: 20, paddingHorizontal: 16, paddingVertical: 10, fontSize: 14, minHeight: 40, maxHeight: 100 },
  sendButton: { width: 42, height: 42, borderRadius: 21, justifyContent: 'center', alignItems: 'center' },

  attachmentIndicator: { flexDirection: 'row', alignItems: 'center', padding: 6, borderRadius: 12, marginBottom: 8, alignSelf: 'flex-start', gap: 8, paddingRight: 12 },
  attachedMiniThumb: { width: 24, height: 30, borderRadius: 4, resizeMode: 'cover' },
  attachmentText: { fontSize: 11, fontWeight: '600', maxWidth: 180 },
  attachmentClose: { marginLeft: 4 },

  // Shopping platform link buttons (below AI messages)
  shoppingLinksRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 10 },
  shoppingLinkBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 7, borderRadius: 20 },
  shoppingLinkBtnText: { color: '#fff', fontSize: 12, fontWeight: '700' },

  // Packing card styles
  packingCard: { marginTop: 12, borderRadius: 14, borderWidth: 1, overflow: 'hidden' },
  packingCardHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, padding: 12, paddingBottom: 8 },
  packingCardTitle: { fontSize: 15, fontWeight: '800' },
  packingSection: { paddingHorizontal: 12, paddingBottom: 12 },
  packingSectionTitle: { fontSize: 12, fontWeight: '700', letterSpacing: 0.5, textTransform: 'uppercase', marginBottom: 8, opacity: 0.7 },
  packingItemThumb: { width: 70, height: 95, borderRadius: 10, marginRight: 8, overflow: 'hidden', alignItems: 'center', paddingBottom: 4 },
  packingThumbImage: { width: '100%', height: 70, resizeMode: 'cover' },
  packingThumbName: { fontSize: 9, fontWeight: '600', textAlign: 'center', paddingHorizontal: 2, marginTop: 4 },
  comboRow: { borderLeftWidth: 3, paddingLeft: 10, marginBottom: 8 },
  comboText: { fontSize: 12, lineHeight: 18 },
  missingItemRow: { flexDirection: 'row', alignItems: 'center', borderRadius: 10, borderWidth: 1, padding: 10, marginBottom: 6 },
  missingItemName: { fontSize: 13, fontWeight: '700', marginBottom: 2 },
  missingItemReason: { fontSize: 11, lineHeight: 16 },

  // Modal styling
  modalContainer: { flex: 1 },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16, borderBottomWidth: 0.5, borderBottomColor: 'rgba(0,0,0,0.1)' },
  modalTitle: { fontSize: 17, fontWeight: '800' },
  emptyClosetModal: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 8 },
  emptyClosetText: { fontSize: 14, fontWeight: '500' },

  closetGridItem: { width: (screenWidth - 40) / 3, margin: 6, borderRadius: 12, overflow: 'hidden', paddingBottom: 6 },
  closetGridImage: { width: '100%', height: 110, resizeMode: 'cover' },
  closetGridName: { fontSize: 10, fontWeight: '600', textAlign: 'center', marginTop: 4, paddingHorizontal: 4 },
});
