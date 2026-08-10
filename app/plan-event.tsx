import React, { useEffect, useRef, useState } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StatusBar,
  TextInput,
  ActivityIndicator,
  Alert,
  Animated,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../contexts/ThemeContext';
import { planEvent, EventPlanResult, saveEventPlan, loadEventPlan } from '../services/eventPlannerService';
import { scheduleEventReminders, cancelEventReminders, getScheduledReminders } from '../services/notificationService';
import { getCurrentWeather } from '../services/weatherService';
import { openExternalUrl } from '../utils/openExternalUrl';

const OCCASIONS = [
  'Diwali Dinner',
  'Wedding',
  'Office Party',
  'Date Night',
  'Birthday',
  'Casual Hangout',
  'Concert',
  'Job Interview',
  'Family Gathering',
  'Road Trip',
];

const DAY_MS = 86400000;

const toISO = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

export default function PlanEventScreen() {
  const { theme } = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { eventId: eventIdParam } = useLocalSearchParams<{ eventId?: string }>();

  const [occasion, setOccasion] = useState('');
  const [customOccasion, setCustomOccasion] = useState('');
  const [selectedDate, setSelectedDate] = useState(() => toISO(new Date(Date.now() + DAY_MS)));
  const [vibe, setVibe] = useState('');
  const [planning, setPlanning] = useState(false);
  const [plan, setPlan] = useState<EventPlanResult | null>(null);
  const [remindersScheduled, setRemindersScheduled] = useState(false);
  const [weather, setWeather] = useState<{ temp?: number; condition?: string; location?: string }>({});

  const resultFade = useRef(new Animated.Value(0)).current;

  // Opened from a reminder notification tap (carries ?eventId=...). Restore the
  // saved plan so the user lands on their event look instead of a blank form.
  useEffect(() => {
    if (!eventIdParam) return;
    loadEventPlan(eventIdParam).then((saved) => {
      if (saved) {
        setPlan(saved);
        resultFade.setValue(1); // show immediately, skip the entry animation
      }
    });
    getScheduledReminders().then((reminders) => {
      if (reminders.some((r) => r.eventId === eventIdParam)) setRemindersScheduled(true);
    });
  }, [eventIdParam, resultFade]);

  // Next 14 days for the date strip.
  const dateOptions = useRef(
    Array.from({ length: 14 }, (_, i) => {
      const d = new Date(Date.now() + (i + 1) * DAY_MS);
      return { iso: toISO(d), weekday: d.toLocaleDateString('en-US', { weekday: 'short' }), day: d.getDate(), month: d.toLocaleDateString('en-US', { month: 'short' }) };
    })
  ).current;

  useEffect(() => {
    loadWeather();
  }, []);

  const loadWeather = async () => {
    try {
      // Use the user's real location (Kolkata etc.), not the Delhi default.
      let lat: number | undefined;
      let lon: number | undefined;
      try {
        const { status } = await Location.getForegroundPermissionsAsync();
        if (status === 'granted') {
          const loc = await Location.getCurrentPositionAsync({
            accuracy: Location.Accuracy.Balanced,
          });
          lat = loc.coords.latitude;
          lon = loc.coords.longitude;
        } else {
          const asked = await Location.requestForegroundPermissionsAsync();
          if (asked.granted) {
            const loc = await Location.getCurrentPositionAsync({
              accuracy: Location.Accuracy.Balanced,
            });
            lat = loc.coords.latitude;
            lon = loc.coords.longitude;
          }
        }
      } catch (locErr) {
        // Location unavailable — fall back to default (Delhi) rather than crash.
      }
      const w = await getCurrentWeather(lat, lon);
      setWeather({ temp: w.temperature, condition: w.condition, location: w.location });
    } catch (e) {
      // Weather is a nice-to-have — planner works without it.
    }
  };

  const pickOccasion = (o: string) => {
    Haptics.selectionAsync();
    setOccasion(o === occasion ? '' : o);
    if (o === occasion) setCustomOccasion('');
  };

  const handlePlan = async () => {
    const event = (occasion || customOccasion.trim() || '').trim();
    if (!event) {
      Alert.alert('What is the event?', 'Pick an occasion chip or type your own.');
      return;
    }
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      setPlanning(true);
      setRemindersScheduled(false);
      const result = await planEvent({
        occasion: event,
        date: selectedDate,
        vibe: vibe.trim() || undefined,
        temperature: weather.temp,
        condition: weather.condition,
        location: weather.location,
      });
      setPlan(result);
      // Persist so a reminder notification tap can reopen this exact plan later.
      saveEventPlan(result);
      Animated.timing(resultFade, { toValue: 1, duration: 600, useNativeDriver: true }).start();
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (e: any) {
      Alert.alert('Planning failed', e.message || 'Could not plan this event right now.');
    } finally {
      setPlanning(false);
    }
  };

  const handleSetReminders = async () => {
    if (!plan) return;
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      const scheduled = await scheduleEventReminders({
        eventId: plan.eventId,
        eventName: plan.eventName,
        eventDate: new Date(plan.date + 'T12:00:00'),
        missingItems: plan.missingItems,
      });
      if (scheduled.length === 0) {
        Alert.alert('No reminders set', 'Enable notification permission in your device settings to get event reminders.');
        return;
      }
      setRemindersScheduled(true);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      const summary = scheduled
        .map((r) => {
          if (r.kind === 'event-prep-3d') return 'prep 3 days out';
          if (r.kind === 'event-buy-gap') return 'shop the gap';
          if (r.kind === 'event-layout-1d') return 'lay out the night before';
          return 'morning-of wake-up';
        })
        .join(', ');
      Alert.alert(
        '🔔 Reminders set!',
        `${scheduled.length} reminder${scheduled.length > 1 ? 's' : ''} scheduled: ${summary}.`,
        [{ text: 'Nice!' }]
      );
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Could not set reminders.');
    }
  };

  const handleCancelReminders = async () => {
    if (!plan) return;
    try {
      await cancelEventReminders(plan.eventId);
      setRemindersScheduled(false);
      Haptics.selectionAsync();
    } catch (e) {
      // Non-fatal — reminders may already be gone.
    }
  };

  const reset = () => {
    setPlan(null);
    setRemindersScheduled(false);
    resultFade.setValue(0);
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <Stack.Screen options={{ headerShown: false }} />
      <StatusBar barStyle="light-content" />

      {/* Header */}
      <LinearGradient colors={[theme.primary, theme.secondary]} style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <View style={styles.headerRow}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
            <Ionicons name="chevron-back" size={24} color="#fff" />
          </TouchableOpacity>
          <View style={{ flex: 1 }}>
            <Text style={styles.headerTitle}>Event Planner</Text>
            <Text style={styles.headerSubtitle}>Plan a look, get smart reminders</Text>
          </View>
        </View>
      </LinearGradient>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: insets.bottom + 40 }}
      >
        {!plan && !planning && (
          <View style={styles.formContainer}>
            {/* Occasion */}
            <Text style={[styles.label, { color: theme.text }]}>What is the event?</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipRow} contentContainerStyle={{ paddingRight: 8 }}>
              {OCCASIONS.map((o) => {
                const active = occasion === o;
                return (
                  <TouchableOpacity
                    key={o}
                    onPress={() => pickOccasion(o)}
                    style={[styles.chip, active ? { backgroundColor: theme.primary, borderColor: theme.primary } : { borderColor: theme.borderLight, backgroundColor: theme.card }]}
                  >
                    <Text style={[styles.chipText, { color: active ? '#fff' : theme.textSecondary }]}>{o}</Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
            <TextInput
              style={[styles.input, { color: theme.text, backgroundColor: theme.card, borderColor: theme.borderLight }]}
              placeholder="Or type a custom occasion..."
              placeholderTextColor={theme.textTertiary}
              value={customOccasion}
              onChangeText={setCustomOccasion}
            />

            {/* Date */}
            <Text style={[styles.label, { color: theme.text, marginTop: 8 }]}>When is it?</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipRow} contentContainerStyle={{ paddingRight: 8 }}>
              {dateOptions.map((d) => {
                const active = selectedDate === d.iso;
                const isTomorrow = d.iso === toISO(new Date(Date.now() + DAY_MS));
                return (
                  <TouchableOpacity
                    key={d.iso}
                    onPress={() => { Haptics.selectionAsync(); setSelectedDate(d.iso); }}
                    style={[styles.dateChip, active ? { backgroundColor: theme.primary, borderColor: theme.primary } : { borderColor: theme.borderLight, backgroundColor: theme.card }]}
                  >
                    <Text style={[styles.dateWeekday, { color: active ? 'rgba(255,255,255,0.85)' : theme.textTertiary }]}>
                      {isTomorrow ? 'TOMORROW' : d.weekday.toUpperCase()}
                    </Text>
                    <Text style={[styles.dateDay, { color: active ? '#fff' : theme.text }]}>{d.day}</Text>
                    <Text style={[styles.dateMonth, { color: active ? 'rgba(255,255,255,0.85)' : theme.textTertiary }]}>{d.month}</Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>

            {/* Vibe */}
            <Text style={[styles.label, { color: theme.text, marginTop: 8 }]}>Vibe / notes (optional)</Text>
            <TextInput
              style={[styles.input, { color: theme.text, backgroundColor: theme.card, borderColor: theme.borderLight }]}
              placeholder="e.g. elegant but comfortable, festive..."
              placeholderTextColor={theme.textTertiary}
              value={vibe}
              onChangeText={setVibe}
            />

            <TouchableOpacity style={styles.planBtn} onPress={handlePlan}>
              <LinearGradient colors={[theme.primary, theme.accent]} style={styles.btnGradient}>
                <Ionicons name="sparkles" size={20} color="#fff" />
                <Text style={styles.btnText}>Plan My Event</Text>
              </LinearGradient>
            </TouchableOpacity>
          </View>
        )}

        {/* Planning state */}
        {planning && (
          <View style={styles.planningContainer}>
            <View style={[styles.planningCard, { backgroundColor: theme.card }]}>
              <Ionicons name="calendar" size={44} color={theme.primary} />
              <ActivityIndicator size="large" color={theme.primary} style={{ marginTop: 20 }} />
              <Text style={[styles.planningTitle, { color: theme.text }]}>Stylist is planning your event...</Text>
              <Text style={[styles.planningSub, { color: theme.textTertiary }]}>
                Matching your closet with the occasion{weather.temp != null ? ` and ${weather.condition || 'forecast'} weather` : ''}
              </Text>
            </View>
          </View>
        )}

        {/* Result */}
        {plan && !planning && (
          <Animated.View style={[styles.resultContainer, { opacity: resultFade }]}>
            <View style={[styles.resultCard, { backgroundColor: theme.card }]}>
              <View style={styles.resultHeader}>
                <Text style={[styles.outfitName, { color: theme.text }]}>{plan.outfitName}</Text>
                <View style={[styles.daysBadge, { backgroundColor: theme.primary + '15' }]}>
                  <Text style={[styles.daysText, { color: theme.primary }]}>
                    {plan.daysUntil === 0 ? 'TODAY' : plan.daysUntil === 1 ? 'TOMORROW' : `IN ${plan.daysUntil} DAYS`}
                  </Text>
                </View>
              </View>

              <Text style={[styles.eventLine, { color: theme.textSecondary }]}>
                {plan.eventName} • {plan.date}
              </Text>

              {/* Items */}
              <Text style={[styles.sectionTitle, { color: theme.text }]}>The Look</Text>
              {plan.items.map((it, i) => (
                <View key={i} style={styles.itemRow}>
                  <Ionicons
                    name={it.owned ? 'checkmark-circle' : 'cart-outline'}
                    size={18}
                    color={it.owned ? '#10B981' : '#F59E0B'}
                  />
                  <Text style={[styles.itemName, { color: theme.text }]}>{it.name}</Text>
                  {it.color && it.color.toLowerCase() !== 'unknown' && (
                    <Text style={[styles.itemColor, { color: theme.textTertiary }]}>{it.color}</Text>
                  )}
                  <View
                    style={[
                      styles.ownedBadge,
                      { backgroundColor: it.owned ? '#10B98115' : '#F59E0B15' },
                    ]}
                  >
                    <Text style={[styles.ownedText, { color: it.owned ? '#10B981' : '#F59E0B' }]}>
                      {it.owned ? 'In your closet' : 'To buy'}
                    </Text>
                  </View>
                </View>
              ))}

              <Text style={[styles.reasoning, { color: theme.textSecondary }]}>{plan.reasoning}</Text>

              {/* Tips */}
              <View style={styles.tipsWrap}>
                {plan.styleTips.map((tip, i) => (
                  <View key={i} style={[styles.tipChip, { backgroundColor: theme.primary + '10' }]}>
                    <Text style={[styles.tipText, { color: theme.primary }]}>💡 {tip}</Text>
                  </View>
                ))}
              </View>
            </View>

            {/* Shopping links for gaps — one set of links per missing item */}
            {plan.gapLinks.length > 0 && (
              <View style={[styles.resultCard, { backgroundColor: theme.card }]}>
                <Text style={[styles.sectionTitle, { color: theme.text }]}>🛍️ Complete the look</Text>
                <Text style={[styles.missingLine, { color: theme.textSecondary }]}>
                  Each missing piece has its own shop links:
                </Text>
                {plan.gapLinks.map((group, gi) => (
                  <View key={gi} style={styles.gapGroup}>
                    <Text style={[styles.gapItem, { color: theme.text }]}>{group.item}</Text>
                    <View style={styles.linkRow}>
                      {group.links.map((link, i) => (
                        <TouchableOpacity
                          key={i}
                          style={[styles.linkBtn, { borderColor: theme.borderLight, backgroundColor: theme.background }]}
                          onPress={() => { Haptics.selectionAsync(); openExternalUrl(link.url); }}
                        >
                          <Text style={[styles.linkLabel, { color: theme.primary }]}>{link.platform}</Text>
                          <Text style={[styles.linkDesc, { color: theme.textTertiary }]} numberOfLines={1}>
                            {link.searchQuery}
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  </View>
                ))}
              </View>
            )}

            {/* Reminders */}
            <View style={[styles.resultCard, { backgroundColor: theme.card }]}>
              <Text style={[styles.sectionTitle, { color: theme.text }]}>🔔 Smart reminders</Text>
              <Text style={[styles.missingLine, { color: theme.textSecondary }]}>
                {plan.missingItems.length > 0
                  ? 'Prep 3 days out, shop the gap 2 days out, lay out the night before, morning-of wake-up.'
                  : 'Prep 3 days out, lay out the night before, morning-of wake-up.'}
              </Text>

              {remindersScheduled ? (
                <View style={styles.reminderRow}>
                  <View style={[styles.reminderOnBadge, { backgroundColor: '#10B98115' }]}>
                    <Ionicons name="checkmark-circle" size={16} color="#10B981" />
                    <Text style={[styles.reminderOnText, { color: '#10B981' }]}>Reminders on for this event</Text>
                  </View>
                  <TouchableOpacity onPress={handleCancelReminders}>
                    <Text style={[styles.cancelReminderText, { color: theme.textTertiary }]}>Turn off</Text>
                  </TouchableOpacity>
                </View>
              ) : (
                <TouchableOpacity style={styles.planBtn} onPress={handleSetReminders}>
                  <LinearGradient colors={[theme.primary, theme.secondary]} style={styles.btnGradient}>
                    <Ionicons name="notifications" size={20} color="#fff" />
                    <Text style={styles.btnText}>Set Reminders</Text>
                  </LinearGradient>
                </TouchableOpacity>
              )}
            </View>

            <TouchableOpacity style={[styles.planBtn, { borderColor: theme.borderLight, borderWidth: 1.5 }]} onPress={reset}>
              <View style={[styles.btnGradient, { backgroundColor: 'transparent' }]}>
                <Ionicons name="refresh" size={20} color={theme.textSecondary} />
                <Text style={[styles.btnText, { color: theme.textSecondary }]}>Plan Another Event</Text>
              </View>
            </TouchableOpacity>
          </Animated.View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { paddingHorizontal: 16, paddingBottom: 16 },
  headerRow: { flexDirection: 'row', alignItems: 'center' },
  backBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(255,255,255,0.15)', justifyContent: 'center', alignItems: 'center', marginRight: 12 },
  headerTitle: { color: '#fff', fontSize: 24, fontWeight: '800', letterSpacing: -0.5 },
  headerSubtitle: { color: 'rgba(255,255,255,0.7)', fontSize: 13, fontWeight: '500', marginTop: 2 },

  formContainer: { padding: 16 },
  label: { fontSize: 14, fontWeight: '800', marginBottom: 10 },
  chipRow: { marginBottom: 12 },
  chip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, borderWidth: 1.5, marginRight: 8 },
  chipText: { fontSize: 13, fontWeight: '700' },

  dateChip: { width: 68, alignItems: 'center', paddingVertical: 10, borderRadius: 14, borderWidth: 1.5, marginRight: 8 },
  dateWeekday: { fontSize: 9, fontWeight: '800', letterSpacing: 0.3 },
  dateDay: { fontSize: 20, fontWeight: '800', marginVertical: 2 },
  dateMonth: { fontSize: 10, fontWeight: '600' },

  input: { borderWidth: 1.5, borderRadius: 14, paddingHorizontal: 14, paddingVertical: 12, fontSize: 14, marginBottom: 8 },

  planBtn: { borderRadius: 14, overflow: 'hidden', marginTop: 16, width: '100%' },
  btnGradient: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 14, gap: 8, height: 48 },
  btnText: { color: '#fff', fontSize: 14, fontWeight: '800' },

  planningContainer: { padding: 16, alignItems: 'center', justifyContent: 'center' },
  planningCard: { borderRadius: 20, padding: 32, alignItems: 'center', width: '100%' },
  planningTitle: { fontSize: 17, fontWeight: '800', marginTop: 20 },
  planningSub: { fontSize: 13, marginTop: 6, textAlign: 'center' },

  resultContainer: { padding: 16 },
  resultCard: { borderRadius: 20, padding: 16, marginBottom: 16 },
  resultHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  outfitName: { fontSize: 19, fontWeight: '800', flex: 1, letterSpacing: -0.3 },
  daysBadge: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 12, marginLeft: 8 },
  daysText: { fontSize: 10, fontWeight: '800' },
  eventLine: { fontSize: 13, marginTop: 4, marginBottom: 12 },

  sectionTitle: { fontSize: 15, fontWeight: '800', marginBottom: 10, letterSpacing: -0.2 },
  itemRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 8, borderBottomWidth: 0.5, borderBottomColor: 'rgba(0,0,0,0.08)' },
  itemName: { fontSize: 14, fontWeight: '600', flexShrink: 1 },
  itemColor: { fontSize: 12, fontWeight: '500', flexShrink: 1 },
  ownedBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 10, marginLeft: 'auto' },
  ownedText: { fontSize: 10, fontWeight: '800' },

  reasoning: { fontSize: 13, lineHeight: 19, marginTop: 12 },
  tipsWrap: { gap: 6, marginTop: 12 },
  tipChip: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 10, alignSelf: 'flex-start' },
  tipText: { fontSize: 12, fontWeight: '500' },

  missingLine: { fontSize: 13, lineHeight: 19 },
  gapGroup: { marginTop: 12 },
  gapItem: { fontSize: 13, fontWeight: '800', marginBottom: 6 },
  linkRow: { gap: 8 },
  linkBtn: { borderRadius: 12, borderWidth: 1.5, paddingHorizontal: 14, paddingVertical: 10 },
  linkLabel: { fontSize: 13, fontWeight: '800' },
  linkDesc: { fontSize: 11, marginTop: 2 },

  reminderRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 8 },
  reminderOnBadge: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 7, borderRadius: 12 },
  reminderOnText: { fontSize: 12, fontWeight: '800' },
  cancelReminderText: { fontSize: 12, fontWeight: '700' },
});
