// utils/openExternalUrl.ts
// Opens external https URLs in the user's DEFAULT browser app (e.g. Chrome) so
// their logged-in sessions and cookies are reused. The in-app browser overlay
// (expo-web-browser Custom Tabs / Safari view) has its own cookie jar, which
// forces re-login on every open — this helper fixes that.
//
// Fallback order: real browser (Linking) → in-app browser (WebBrowser) → Alert.
// The Alert path means no URL ever "silently does nothing" on Android APKs.
import { Alert, Linking } from 'react-native';
import * as WebBrowser from 'expo-web-browser';

export const openExternalUrl = async (url: string): Promise<void> => {
  try {
    // 1) Real browser app (Chrome) — reuses the user's saved login/sessions.
    await Linking.openURL(url);
    return;
  } catch (error) {
    console.warn('openExternalUrl: Linking.openURL failed, trying in-app browser:', error);
  }

  try {
    // 2) In-app browser overlay as a fallback.
    await WebBrowser.openBrowserAsync(url, {
      readerMode: false,
      enableBarCollapsing: true,
      dismissButtonStyle: 'close',
    });
  } catch (browserError) {
    console.error('openExternalUrl: WebBrowser failed:', browserError);
    // 3) Last resort.
    Alert.alert('Unable to open link', 'Could not open this link. Please try again.');
  }
};
