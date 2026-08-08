// services/chatHistoryService.ts
// Saves stylist chats to Firestore so the user can reopen up to MAX_SAVED_CHATS
// past conversations from a sidebar.
//
// Design notes:
// - Lean serialization: messages are stored WITHOUT image base64 / wardrobe
//   payloads — just id, text, isUser, timestamp, and the attached item's name.
//   Restoring a chat shows the conversation; rich cards (packing list, closet
//   previews) are rebuilt live from the user's current wardrobe, not replayed.
// - Cap: keeps the newest MAX_SAVED_CHATS per user, oldest deleted.
// - Degraded mode: same guard pattern as the rest of the app — when Firebase is
//   not initialized / no signed-in user, every call is a safe no-op (returns []).
//   Auto-save simply doesn't happen; the chat still works locally.

import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  query,
  updateDoc,
  where,
} from 'firebase/firestore';
import { auth, db, isFirebaseInitialized } from '../firebaseConfig';
import { ChatMessage } from './digitalWardrobeService';

const CHAT_COLLECTION = 'stylist_chats';
export const MAX_SAVED_CHATS = 5;

export interface SavedChatMeta {
  id: string;
  title: string;
  preview: string;
  updatedAt: number; // epoch ms
  messageCount: number;
}

export interface StoredChatMessage {
  id: string;
  text: string;
  isUser: boolean;
  timestamp: number; // epoch ms
  attachedItemName?: string;
}

const toEpoch = (t: any): number => {
  if (t?.toDate) return t.toDate().getTime(); // Firestore Timestamp
  if (t instanceof Date) return t.getTime();
  if (typeof t === 'number') return t;
  return new Date(t).getTime();
};

/** Short title derived from the first real user message. */
const buildTitle = (messages: ChatMessage[]): string => {
  const first = messages.find((m) => m.isUser && m.text.trim().length > 0);
  const t = (first?.text || 'New Chat').trim();
  return t.length > 34 ? `${t.slice(0, 34)}…` : t;
};

const serializeMessages = (messages: ChatMessage[]): StoredChatMessage[] =>
  messages.map((m) => ({
    id: m.id,
    text: m.text,
    isUser: m.isUser,
    timestamp: toEpoch(m.timestamp),
    ...(m.attachedItem?.name ? { attachedItemName: m.attachedItem.name } : {}),
  }));

/** All saved chats for the signed-in user, newest first. */
export const getSavedChats = async (): Promise<SavedChatMeta[]> => {
  const user = auth?.currentUser;
  if (!user || !isFirebaseInitialized || !db) return [];
  try {
    const q = query(collection(db, CHAT_COLLECTION), where('userId', '==', user.uid));
    const snap = await getDocs(q);
    const list = snap.docs.map((d) => {
      const data = d.data();
      return {
        id: d.id,
        title: data.title || 'Chat',
        preview: data.preview || '',
        updatedAt: toEpoch(data.updatedAt),
        messageCount: Array.isArray(data.messages) ? data.messages.length : 0,
      } as SavedChatMeta;
    });
    list.sort((a, b) => b.updatedAt - a.updatedAt);
    return list;
  } catch (e) {
    console.error('💬 chatHistory getSavedChats:', e);
    return [];
  }
};

/**
 * Saves (or updates) a conversation.
 * - chatId provided → update that existing chat.
 * - chatId null → create a new chat doc and return its id.
 * Returns the chat id, or null if nothing was persisted (degraded mode /
 * conversation too trivial to save). Enforces the MAX_SAVED_CHATS cap by
 * deleting the oldest excess chats.
 */
export const saveChat = async (
  messages: ChatMessage[],
  chatId: string | null = null
): Promise<string | null> => {
  const user = auth?.currentUser;
  if (!user || !isFirebaseInitialized || !db) return null;
  if (messages.length <= 1) return chatId; // only the welcome message — nothing to save
  try {
    const data = {
      userId: user.uid,
      title: buildTitle(messages),
      preview: messages[messages.length - 1]?.text?.slice(0, 90) || '',
      messages: serializeMessages(messages),
      updatedAt: new Date(),
      messageCount: messages.length,
    };

    let chatIdOut = chatId;
    if (chatId) {
      await updateDoc(doc(db, CHAT_COLLECTION, chatId), data);
    } else {
      const ref = await addDoc(collection(db, CHAT_COLLECTION), data);
      chatIdOut = ref.id;
    }

    // Enforce the cap — keep the newest MAX_SAVED_CHATS.
    const all = await getSavedChats();
    const excess = all.filter((c) => c.id !== chatIdOut).slice(MAX_SAVED_CHATS - 1);
    await Promise.all(
      excess.map((c) => deleteDoc(doc(db, CHAT_COLLECTION, c.id)).catch(() => {}))
    );

    return chatIdOut;
  } catch (e) {
    console.error('💬 chatHistory saveChat:', e);
    return null;
  }
};

/** Full message history for a saved chat (empty array if missing/not owned). */
export const loadChat = async (chatId: string): Promise<ChatMessage[]> => {
  const user = auth?.currentUser;
  if (!user || !isFirebaseInitialized || !db) return [];
  try {
    const snap = await getDoc(doc(db, CHAT_COLLECTION, chatId));
    const data = snap.data();
    if (!data || data.userId !== user.uid) return [];
    const stored = (data.messages || []) as StoredChatMessage[];
    return stored.map((m) => ({
      id: m.id,
      text: m.text,
      isUser: m.isUser,
      timestamp: new Date(m.timestamp),
    }));
  } catch (e) {
    console.error('💬 chatHistory loadChat:', e);
    return [];
  }
};

/** Deletes a saved chat. Returns true if removed. */
export const deleteChat = async (chatId: string): Promise<boolean> => {
  const user = auth?.currentUser;
  if (!user || !isFirebaseInitialized || !db) return false;
  try {
    await deleteDoc(doc(db, CHAT_COLLECTION, chatId));
    return true;
  } catch (e) {
    console.error('💬 chatHistory deleteChat:', e);
    return false;
  }
};
