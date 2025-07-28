// polyfills.js - Fix for BackHandler removeEventListener compatibility issue
import { BackHandler } from 'react-native';

// Add the removeEventListener method if it doesn't exist (React Native 0.60+)
if (!BackHandler.removeEventListener) {
  BackHandler.removeEventListener = function(eventName, handler) {
    // In newer versions of React Native, this is handled by the return value of addEventListener
    // For backward compatibility, we'll just log a warning
    console.warn('BackHandler.removeEventListener is deprecated. Use the return value of addEventListener instead.');
    return true;
  };
}

export default BackHandler;
