// components/NotificationTapHandler.tsx
// Listens for taps on local reminder notifications and deep-links to the
// matching event plan. Without this, tapping a notification just opens the
// app on whatever screen was last shown — the user asked for the tap to take
// them to the actual event.
//
// Reminder notifications carry `data: { eventId, kind }` (see notificationService).
// Event reminders navigate to /plan-event?eventId=...; weather nudges (eventId
// 'weather') have no plan behind them and are ignored.

import { useEffect, useState } from 'react';
import * as Notifications from 'expo-notifications';
import { useRouter } from 'expo-router';
import { useAuth } from '../contexts/AuthContext';

interface NotificationData {
  eventId?: string;
  kind?: string;
}

export default function NotificationTapHandler() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [eventId, setEventId] = useState<string | null>(null);

  const handleResponse = (response: Notifications.NotificationResponse) => {
    const data = (response.notification.request.content.data ?? {}) as NotificationData;
    const { eventId: id, kind } = data;
    if (id && kind && kind.startsWith('event')) {
      setEventId(id);
    }
  };

  // Once auth is ready (and the auth gate has done its router.replace), take the
  // pending tap and open the event plan on top of the dashboard. State (not a
  // ref) so a response arriving after auth resolves still triggers navigation.
  useEffect(() => {
    if (!user || loading || !eventId) return;
    const id = eventId;
    setEventId(null); // consume — each tap navigates at most once
    // The auth gate navigates via a ~100ms timeout; wait it out so our push
    // doesn't get replaced by the redirect to '/' or '/auth'.
    const t = setTimeout(() => {
      router.push({ pathname: '/plan-event', params: { eventId: id } });
    }, 400);
    return () => clearTimeout(t);
  }, [user, loading, eventId, router]);

  useEffect(() => {
    // Cold start: the notification that launched the app isn't delivered through
    // the listener, it's fetched with getLastNotificationResponseAsync.
    Notifications.getLastNotificationResponseAsync()
      .then((response) => {
        if (response) handleResponse(response);
      })
      .catch(() => {});

    // Warm tap: app already running, user taps the banner.
    const sub = Notifications.addNotificationResponseReceivedListener((response) => {
      handleResponse(response);
    });
    return () => sub.remove();
  }, []);

  return null;
}
