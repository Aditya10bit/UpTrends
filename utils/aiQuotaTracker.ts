// utils/aiQuotaTracker.ts
// Tracks which AI models have exhausted their daily free-tier quota so the
// fallback chain in geminiService can skip them and avoid wasting retries.
// State is persisted per-day to AsyncStorage so it survives app restarts.
import AsyncStorage from '@react-native-async-storage/async-storage';

const QUOTA_STORAGE_KEY = '@uptrends_ai_quota';

interface QuotaState {
  date: string; // 'YYYY-MM-DD' local date
  exhausted: string[]; // model IDs exhausted on that date
}

let cachedState: QuotaState | null = null;

const todayKey = (): string => {
  const d = new Date();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${mm}-${dd}`;
};

const loadState = async (): Promise<QuotaState> => {
  if (cachedState && cachedState.date === todayKey()) return cachedState;
  try {
    const raw = await AsyncStorage.getItem(QUOTA_STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : null;
    if (parsed && parsed.date === todayKey()) {
      cachedState = {
        date: parsed.date,
        exhausted: Array.isArray(parsed.exhausted) ? parsed.exhausted : [],
      };
    } else {
      // Stale or missing state — start a fresh day
      cachedState = { date: todayKey(), exhausted: [] };
    }
  } catch {
    cachedState = { date: todayKey(), exhausted: [] };
  }
  return cachedState;
};

const persist = async (state: QuotaState) => {
  cachedState = state;
  try {
    await AsyncStorage.setItem(QUOTA_STORAGE_KEY, JSON.stringify(state));
  } catch (err) {
    console.warn('[QuotaTracker] Failed to persist quota state:', err);
  }
};

/** Mark a model as having exhausted its daily quota (sticky until tomorrow). */
export const markModelExhausted = async (modelId: string): Promise<void> => {
  const state = await loadState();
  if (!state.exhausted.includes(modelId)) {
    state.exhausted.push(modelId);
    await persist(state);
  }
};

/** True if this model has already exhausted its daily quota today. */
export const isModelExhaustedToday = async (modelId: string): Promise<boolean> => {
  const state = await loadState();
  return state.exhausted.includes(modelId);
};

/** For debugging / a future "running on Lite" indicator. */
export const getExhaustedModelsToday = async (): Promise<string[]> => {
  const state = await loadState();
  return [...state.exhausted];
};
