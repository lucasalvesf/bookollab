import { Check } from 'lucide-react-native';
import { useState } from 'react';
import { Pressable, TextInput, View, type LayoutChangeEvent } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg';

import { COLOR_PRESETS, contrast, hexToHsv, hsvToHex, isHex } from '@/lib/color';
import { makeStyles, radius, shadow, useTheme } from '@/theme';

const clamp = (v: number, min = 0, max = 1) => Math.min(max, Math.max(min, v));

/**
 * Color picker: saturation/brightness square, hue bar, hex field and curated presets.
 * Drag or click anywhere; works with mouse and touch (RNGH). Calls onChange with "#RRGGBB".
 */
export function ColorPicker({ value, onChange }: { value: string; onChange: (hex: string) => void }) {
  const styles = useStyles();
  const { colors } = useTheme();
  const [hsv, setHsv] = useState(() => hexToHsv(isHex(value) ? value : '#5B3DF5'));
  const [hex, setHex] = useState(value);
  const [box, setBox] = useState({ w: 1, h: 1 });
  const [bar, setBar] = useState(1);
  // Outside changes (e.g. "voltar à cor padrão") move the knobs.
  const [seen, setSeen] = useState(value);
  if (value !== seen) {
    setSeen(value);
    if (isHex(value) && value.toUpperCase() !== hsvToHex(...hsv)) {
      setHsv(hexToHsv(value));
      setHex(value.toUpperCase());
    }
  }

  const commit = (next: [number, number, number]) => {
    setHsv(next);
    const h = hsvToHex(...next);
    setHex(h);
    onChange(h);
  };
  const pickSv = (x: number, y: number) => commit([hsv[0], clamp(x / box.w), 1 - clamp(y / box.h)]);
  const pickHue = (x: number) => commit([clamp(x / bar) * 359.9, hsv[1], hsv[2]]);
  const sv = Gesture.Pan().runOnJS(true).minDistance(0).onBegin((e) => pickSv(e.x, e.y)).onUpdate((e) => pickSv(e.x, e.y));
  const hue = Gesture.Pan().runOnJS(true).minDistance(0).onBegin((e) => pickHue(e.x)).onUpdate((e) => pickHue(e.x));
  const pure = hsvToHex(hsv[0], 1, 1);
  const current = hsvToHex(...hsv);

  return (
    <View style={styles.wrap}>
      <GestureDetector gesture={sv}>
        <View style={styles.square} onLayout={(e: LayoutChangeEvent) => setBox({ w: e.nativeEvent.layout.width, h: e.nativeEvent.layout.height })} accessibilityLabel="Saturação e brilho">
          <Svg width="100%" height="100%">
            <Defs>
              <LinearGradient id="white" x1="0" y1="0" x2="1" y2="0">
                <Stop offset="0" stopColor="#FFFFFF" stopOpacity="1" />
                <Stop offset="1" stopColor="#FFFFFF" stopOpacity="0" />
              </LinearGradient>
              <LinearGradient id="black" x1="0" y1="0" x2="0" y2="1">
                <Stop offset="0" stopColor="#000000" stopOpacity="0" />
                <Stop offset="1" stopColor="#000000" stopOpacity="1" />
              </LinearGradient>
            </Defs>
            <Rect width="100%" height="100%" fill={pure} />
            <Rect width="100%" height="100%" fill="url(#white)" />
            <Rect width="100%" height="100%" fill="url(#black)" />
          </Svg>
          <View pointerEvents="none" style={[styles.knob, { left: hsv[1] * box.w - 10, top: (1 - hsv[2]) * box.h - 10, backgroundColor: current }]} />
        </View>
      </GestureDetector>
      <GestureDetector gesture={hue}>
        <View style={styles.hue} onLayout={(e: LayoutChangeEvent) => setBar(e.nativeEvent.layout.width)} accessibilityLabel="Matiz">
          <Svg width="100%" height="100%">
            <Defs>
              <LinearGradient id="hue" x1="0" y1="0" x2="1" y2="0">
                {[0, 60, 120, 180, 240, 300, 360].map((h) => (
                  <Stop key={h} offset={String(h / 360)} stopColor={hsvToHex(h % 360, 1, 1)} />
                ))}
              </LinearGradient>
            </Defs>
            <Rect width="100%" height="100%" rx="8" fill="url(#hue)" />
          </Svg>
          <View pointerEvents="none" style={[styles.hueKnob, { left: (hsv[0] / 360) * bar - 9, backgroundColor: pure }]} />
        </View>
      </GestureDetector>
      <View style={styles.row}>
        <View style={[styles.swatch, { backgroundColor: current }]} />
        <TextInput
          value={hex}
          onChangeText={(t) => {
            const v = (t.startsWith('#') ? t : `#${t}`).slice(0, 7).toUpperCase();
            setHex(v);
            if (isHex(v)) {
              setHsv(hexToHsv(v));
              onChange(v);
            }
          }}
          autoCapitalize="characters"
          maxLength={7}
          style={styles.hexInput}
          accessibilityLabel="Cor em hexadecimal"
        />
      </View>
      <View style={styles.presets}>
        {COLOR_PRESETS.map((p) => (
          <Pressable key={p} accessibilityRole="radio" accessibilityLabel={p} accessibilityState={{ checked: p === current }} onPress={() => commit(hexToHsv(p))} style={[styles.preset, { backgroundColor: p }]}>
            {p === current ? <Check size={14} color={contrast(p, '#FFFFFF') >= 3 ? '#FFFFFF' : colors.text} strokeWidth={3} /> : null}
          </Pressable>
        ))}
      </View>
    </View>
  );
}

const useStyles = makeStyles((colors) => ({
  wrap: { gap: 12, width: '100%', maxWidth: 360 },
  square: { height: 180, borderRadius: radius.md, overflow: 'hidden', borderWidth: 1, borderColor: colors.border },
  knob: { position: 'absolute', width: 20, height: 20, borderRadius: 10, borderWidth: 3, borderColor: '#FFFFFF', ...shadow(colors, 2) },
  hue: { height: 16, borderRadius: 8 },
  hueKnob: { position: 'absolute', top: -3, width: 18, height: 22, borderRadius: 6, borderWidth: 3, borderColor: '#FFFFFF', ...shadow(colors, 2) },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  swatch: { width: 40, height: 40, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border },
  hexInput: { flex: 1, fontSize: 16, fontWeight: '600', letterSpacing: 1, color: colors.text, backgroundColor: colors.surfaceAlt, borderRadius: radius.md, paddingHorizontal: 12, paddingVertical: 9 },
  presets: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  preset: { width: 30, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: 'rgba(0,0,0,0.08)' },
}));
