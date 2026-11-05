import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

/**
 * Persistent key/value storage for the session.
 * Native: encrypted SecureStore. Web: localStorage (SecureStore is not available on web).
 */
export const storage = {
  async get(key: string): Promise<string | null> {
    if (Platform.OS === 'web') return typeof localStorage === 'undefined' ? null : localStorage.getItem(key);
    return SecureStore.getItemAsync(key);
  },
  async set(key: string, value: string | null): Promise<void> {
    if (Platform.OS === 'web') {
      if (typeof localStorage === 'undefined') return;
      if (value === null) localStorage.removeItem(key);
      else localStorage.setItem(key, value);
      return;
    }
    if (value === null) await SecureStore.deleteItemAsync(key);
    else await SecureStore.setItemAsync(key, value);
  },
};
