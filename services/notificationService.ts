// services/notificationService.ts
// Local notification engine (expo-notifications) — no FCM, no server needed.
//
// The engine schedules LOCAL notifications on the device itself. Because Android
// kills scheduled notifications when the app is force-closed, every nudge is
// re-armed while the app is open (the "snapshot" approach): the app reads the
// stored reminders on launch and reschedules anything still in the future.
//
// Supports two families of nudges:
//   1. EVENT reminders — a staggered countdown for a planned event
//      (prep 3 days out, buy-the-gap 2 days out, lay-out 1 day out, morning-of).
//   2. WEATHER-prep nudges — the user asked for "more than rainy weather", so we
//      handle a full set of real-world permutations: rain, storm, snow, fog/haze,
//      heat, cold, wind, and the "perfect day" positive nudge.

import * as Notifications from 'expo-notifications';
import AsyncStorage from '@react-native-async-storage/async-storage';

const CHANNEL_ID = 'uptrends-reminders';
const REMINDER_STORE_KEY = 'uptrends_reminders_v1';

export type ReminderKind =
  | 'event-prep-3d'
  | 'event-buy-gap'
  | 'event-layout-1d'
  | 'event-morning-of'
  | 'weather-prep';

export interface StoredReminder {
  id: string; // expo notification identifier
  eventId: string; // event id (or 'weather' for weather-prep nudges)
  kind: ReminderKind;
  title: string;
  body: string;
  fireDate: number; // epoch ms
}

let handlerConfigured = false;

// Handle notifications while the app is in the foreground so the banner still shows.
const configureHandler = () => {
  if (handlerConfigured) return;
  handlerConfigured = true;
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: false,
      shouldSetBadge: false,
    }),
  });
};

/** Creates the Android channel and asks for POST_NOTIFICATIONS permission (Android 13+). */
export const ensureNotificationSetup = async (): Promise<boolean> => {
  configureHandler();
  try {
    if (Notifications.setNotificationChannelAsync) {
      await Notifications.setNotificationChannelAsync(CHANNEL_ID, {
        name: 'Stylist Reminders',
        importance: Notifications.AndroidImportance.HIGH,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#7C3AED',
      });
    }
    const current = await Notifications.getPermissionsAsync();
    if (current.granted) return true;
    const asked = await Notifications.requestPermissionsAsync();
    return asked.granted;
  } catch (e) {
    console.error('🔔 Notification setup failed:', e);
    return false;
  }
};

// ---------- helpers ----------

/** Date at the given hour of a day offset from now (used for staggered reminders). */
const atDayOffset = (dayOffset: number, hour: number, minute = 0): Date => {
  const d = new Date();
  d.setDate(d.getDate() + dayOffset);
  d.setHours(hour, minute, 0, 0);
  return d;
};

const schedule = async (
  title: string,
  body: string,
  fireDate: Date,
  eventId: string,
  kind: ReminderKind
): Promise<StoredReminder | null> => {
  try {
    const id = await Notifications.scheduleNotificationAsync({
      content: {
        title,
        body,
        data: { eventId, kind },
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DATE,
        date: fireDate,
        channelId: CHANNEL_ID,
      },
    });
    return { id, eventId, kind, title, body, fireDate: fireDate.getTime() };
  } catch (e) {
    console.error('🔔 Failed to schedule notification:', e);
    return null;
  }
};

const readStored = async (): Promise<StoredReminder[]> => {
  try {
    const raw = await AsyncStorage.getItem(REMINDER_STORE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (e) {
    return [];
  }
};

const writeStored = async (reminders: StoredReminder[]) => {
  try {
    await AsyncStorage.setItem(REMINDER_STORE_KEY, JSON.stringify(reminders));
  } catch (e) {
    console.error('🔔 Failed to persist reminders:', e);
  }
};

// ---------- EVENT reminders ----------

export interface EventReminderPlan {
  eventId: string;
  eventName: string;
  eventDate: Date; // the actual event day (used to anchor the staggered schedule)
  missingItems?: string[]; // gaps the planner found, used for the buy-gap nudge
}

/**
 * Schedules the full staggered reminder set for an event:
 *   T-3 days  09:00  "Start prepping your look"
 *   T-2 days  11:00  "Buy the gap" (only when the event needs items the user lacks)
 *   T-1 day   20:00  "Lay out your outfit"
 *   Event day 07:00  "It's your event day!"
 * Dates in the past are skipped (e.g. an event only 2 days away). Returns the
 * reminders actually scheduled so the UI can show a count.
 */
export const scheduleEventReminders = async (
  plan: EventReminderPlan
): Promise<StoredReminder[]> => {
  if (!(await ensureNotificationSetup())) return [];

  const now = Date.now();
  const eventTime = plan.eventDate.getTime();
  const scheduled: StoredReminder[] = [];

  const snap = (dayOffset: number, hour: number, minute: number): Date => {
    // For relative offsets always count back from today, not from event day —
    // this keeps e.g. "T-1" landing one day before the event even if the user
    // plans the event a week out but schedules reminders late.
    const d = atDayOffset(dayOffset, hour, minute);
    if (d.getTime() > eventTime) {
      // Clamp to morning-of (never schedule after the event).
      const morning = new Date(plan.eventDate);
      morning.setHours(7, 0, 0, 0);
      return morning;
    }
    return d;
  };

  const push = async (
    kind: ReminderKind,
    dayOffset: number,
    hour: number,
    minute: number,
    title: string,
    body: string
  ) => {
    const fire = snap(dayOffset, hour, minute);
    if (fire.getTime() <= now) return; // already passed
    const r = await schedule(title, body, fire, plan.eventId, kind);
    if (r) scheduled.push(r);
  };

  await push(
    'event-prep-3d',
    -3, 9, 0,
    `🎯 ${plan.eventName} is coming up`,
    `You've got 3 days. Start curating the perfect look so you're not scrambling later.`
  );

  const gaps = plan.missingItems?.filter((g) => g.trim().length > 0) ?? [];
  if (gaps.length > 0) {
    await push(
      'event-buy-gap',
      -2, 11, 0,
      `🛍️ Still need: ${gaps.slice(0, 2).join(' & ')}`,
      `Your closet is missing a piece for ${plan.eventName}. Tap to shop the gap before it's too late.`
    );
  }

  await push(
    'event-layout-1d',
    -1, 20, 0,
    `👔 Get ready for tomorrow: ${plan.eventName}`,
    `Lay out your full outfit tonight so tomorrow morning is a breeze.`
  );

  await push(
    'event-morning-of',
    0, 7, 0,
    `✨ It's ${plan.eventName} day!`,
    `Your stylist look is ready. Own the room today.`
  );

  if (scheduled.length > 0) {
    const stored = await readStored();
    const merged = [...stored.filter((r) => r.eventId !== plan.eventId), ...scheduled];
    await writeStored(merged);
  }
  return scheduled;
};

/** Cancels every scheduled reminder for an event (used if the user deletes/edits it). */
export const cancelEventReminders = async (eventId: string) => {
  const stored = await readStored();
  const toCancel = stored.filter((r) => r.eventId === eventId);
  await Promise.all(
    toCancel.map((r) =>
      Notifications.cancelScheduledNotificationAsync(r.id).catch(() => {})
    )
  );
  await writeStored(stored.filter((r) => r.eventId !== eventId));
};

// ---------- WEATHER-prep nudges (beyond rain) ----------

export interface WeatherNudge {
  title: string;
  body: string;
}

/**
 * Maps a weather condition + temperature to a practical "get dressed for this"
 * nudge. The condition string comes from `weatherService.getCurrentWeather()`
 * (already mapped from Open-Meteo weathercodes), so this covers the full set of
 * real-world permutations — not just rain.
 */
export const buildWeatherPrepNudge = (
  condition: string,
  temperature: number
): WeatherNudge => {
  const c = condition.toLowerCase();

  if (c.includes('thunder') || c.includes('storm')) {
    return {
      title: '⛈️ Storm on the way',
      body: 'Heavy rain + wind expected. Wear waterproof layers, skip light cottons, and carry a compact raincoat.',
    };
  }
  if (c.includes('snow') || (temperature <= 4 && c.includes('fog'))) {
    return {
      title: '❄️ Chilly and snowy',
      body: 'Layer up: thermal base, knit, and a padded jacket. Wool socks + waterproof boots will keep you dry.',
    };
  }
  if (c.includes('rain') || c.includes('shower')) {
    return {
      title: '🌧️ Rain in the forecast',
      body: 'Pick water-resistant fabrics (nylon, treated cotton). Dark bottoms hide splashes; finish with a jacket.',
    };
  }
  if (c.includes('fog') || c.includes('haze') || c.includes('smog') || c.includes('mist')) {
    return {
      title: '🌫️ Low visibility out there',
      body: 'Layer a jacket you can shed by midday. Neutral tones read better in flat light — keep it tonal.',
    };
  }
  if (temperature >= 33) {
    return {
      title: '🥵 Sweltering heat',
      body: 'Stick to breathable linen and cotton in light shades. Skip layers and go for open-weave knits.',
    };
  }
  if (temperature >= 27 && c.includes('clear') || (temperature >= 27 && c.includes('sun'))) {
    return {
      title: '☀️ Sunny and warm',
      body: 'Perfect for bright, airy looks. Light fabrics + UV-friendly hat or shades. Hydrate!',
    };
  }
  if (temperature <= 10) {
    return {
      title: '🥶 Bitter cold',
      body: 'Insulated coat, scarf, and gloves. Base layer first — a merino or fleece layer traps the heat.',
    };
  }
  if (c.includes('wind')) {
    return {
      title: '🌬️ Windy today',
      body: 'Avoid flowy maxi dresses and wide-leg trousers. Fitted silhouettes and a jacket that blocks wind win.',
    };
  }
  if (temperature >= 27) {
    return {
      title: '☀️ Warm day ahead',
      body: 'Light cottons and linen keep you cool. Perfect day for that breezy, summer-inspired look.',
    };
  }
  if (c.includes('cloud')) {
    return {
      title: '☁️ Overcast — but stylish',
      body: 'Mid tones and a light layer work well. A structured jacket keeps the outfit sharp under grey skies.',
    };
  }
  if (c.includes('clear') || c.includes('sun')) {
    return {
      title: '☀️ Perfect day out',
      body: 'The classic "perfect day" — wear that favourite outfit. Crisp whites and pastels will shine.',
    };
  }
  return {
    title: '🧥 Check the weather',
    body: 'Mixed conditions ahead — layer so you can adapt through the day.',
  };
};

/**
 * Schedules a single tomorrow-morning weather-prep nudge for the given condition.
 * Returns the stored reminder, or null if permission was denied / scheduling failed.
 */
export const scheduleWeatherPrep = async (
  condition: string,
  temperature: number,
  location?: string
): Promise<StoredReminder | null> => {
  if (!(await ensureNotificationSetup())) return null;
  const nudge = buildWeatherPrepNudge(condition, temperature);
  const where = location && location !== 'Your Location' ? ` in ${location}` : '';
  const fire = atDayOffset(1, 7, 15); // tomorrow morning, after the user wakes
  const r = await schedule(
    nudge.title,
    `${nudge.body}${where}`,
    fire,
    'weather',
    'weather-prep'
  );
  if (r) {
    const stored = await readStored();
    // Keep only the most recent weather nudge to avoid a growing pile.
    await writeStored([
      ...stored.filter((x) => x.kind !== 'weather-prep'),
      r,
    ]);
  }
  return r;
};

/**
 * Re-arms reminders on app launch. Android/OEMs sometimes drop scheduled
 * notifications when the app is force-closed; calling this every launch (from
 * the root layout, non-blocking) re-schedules any stored reminder that is still
 * in the future but no longer present on the OS. This is the "snapshot" approach
 * that makes local notifications reliable without a server.
 */
export const rearmReminders = async () => {
  configureHandler();
  try {
    const stored = await readStored();
    const now = Date.now();
    const future = stored.filter((r) => r.fireDate > now);
    if (future.length === 0) {
      if (stored.length) await writeStored([]);
      return;
    }
    const scheduled = await Notifications.getAllScheduledNotificationsAsync();
    const scheduledIds = new Set(scheduled.map((n) => n.identifier));
    const toRearm = future.filter((r) => !scheduledIds.has(r.id));
    for (const r of toRearm) {
      try {
        const id = await Notifications.scheduleNotificationAsync({
          content: { title: r.title, body: r.body, data: { eventId: r.eventId, kind: r.kind } },
          trigger: {
            type: Notifications.SchedulableTriggerInputTypes.DATE,
            date: new Date(r.fireDate),
            channelId: CHANNEL_ID,
          },
        });
        r.id = id; // track the fresh OS identifier so future cancels still work
      } catch (e) {
        console.error('🔔 rearm failed for one reminder:', e);
      }
    }
    await writeStored(future);
  } catch (e) {
    console.error('🔔 rearmReminders failed:', e);
  }
};

/** All reminders currently stored (for a "manage reminders" screen/debug). */
export const getScheduledReminders = async (): Promise<StoredReminder[]> => {
  const stored = await readStored();
  const now = Date.now();
  const fresh = stored.filter((r) => r.fireDate > now);
  if (fresh.length !== stored.length) await writeStored(fresh);
  return fresh;
};

/** Wipe everything (also cancels the actual OS notifications). */
export const clearAllReminders = async () => {
  const stored = await readStored();
  await Promise.all(
    stored.map((r) =>
      Notifications.cancelScheduledNotificationAsync(r.id).catch(() => {})
    )
  );
  await writeStored([]);
};
