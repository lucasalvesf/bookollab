import 'react-native';

declare module 'react-native' {
  /** React Native Web adds hover state to Pressable (undefined on native). */
  interface PressableStateCallbackType {
    hovered?: boolean;
    focused?: boolean;
  }
}
