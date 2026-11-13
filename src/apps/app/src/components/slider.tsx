import { useState } from 'react';
import { View, type LayoutChangeEvent } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';

import { makeStyles, radius, shadow } from '@/theme';

/**
 * Horizontal slider 0..1 (like a radio dial): click or drag anywhere. `ticks` draws marks along the track.
 * Works with mouse and touch (RNGH).
 */
export function Slider({ value, onChange, label, ticks = 0 }: { value: number; onChange: (v: number) => void; label: string; ticks?: number }) {
  const styles = useStyles();
  const [width, setWidth] = useState(1);
  const at = (x: number) => onChange(Math.min(1, Math.max(0, x / width)));
  const pan = Gesture.Pan().runOnJS(true).minDistance(0).onBegin((e) => at(e.x)).onUpdate((e) => at(e.x));
  const v = Math.min(1, Math.max(0, value));
  return (
    <GestureDetector gesture={pan}>
      <View style={styles.hit} onLayout={(e: LayoutChangeEvent) => setWidth(e.nativeEvent.layout.width)} accessibilityRole="adjustable" accessibilityLabel={label} accessibilityValue={{ min: 0, max: 100, now: Math.round(v * 100) }}>
        <View style={styles.track}>
          <View style={[styles.fill, { width: `${v * 100}%` }]} />
        </View>
        {ticks > 1
          ? Array.from({ length: ticks }, (_, i) => <View key={i} pointerEvents="none" style={[styles.tick, { left: (i / (ticks - 1)) * (width - 2) }]} />)
          : null}
        <View pointerEvents="none" style={[styles.knob, { left: v * width - 10 }]} />
      </View>
    </GestureDetector>
  );
}

const useStyles = makeStyles((colors) => ({
  hit: { height: 28, justifyContent: 'center' },
  track: { height: 6, borderRadius: radius.pill, backgroundColor: colors.surfaceAlt, overflow: 'hidden' },
  fill: { height: 6, backgroundColor: colors.brand },
  tick: { position: 'absolute', top: 20, width: 2, height: 6, borderRadius: 1, backgroundColor: colors.borderStrong },
  knob: { position: 'absolute', top: 4, width: 20, height: 20, borderRadius: 10, backgroundColor: colors.surface, borderWidth: 3, borderColor: colors.brand, ...shadow(colors, 2) },
}));
