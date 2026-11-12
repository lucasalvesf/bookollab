import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Platform, Pressable, ScrollView, View, type LayoutChangeEvent, type ScrollViewInstance } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';

import { makeStyles, radius } from '@/theme';

const EDGE = 64;
const SHOW_DELAY = 100;

/**
 * Horizontal row of pills that never gets cut off:
 * - the mouse wheel scrolls it sideways;
 * - resting the mouse on the invisible area at either end scrolls it by itself;
 * - after 0.1 s over the row, a styled scrollbar appears (click or drag to move).
 * On touch screens it is a plain swipeable row.
 */
export function PillScroller({ children, gap = 8 }: { children: ReactNode; gap?: number }) {
  const styles = useStyles();
  // The scroll view lives in state (callback ref) so gesture handlers can use it without touching refs during render.
  const [scroller, setScroller] = useState<ScrollViewInstance | null>(null);
  const [offset, setOffset] = useState(0);
  const [viewport, setViewport] = useState(0);
  const [content, setContent] = useState(0);
  const [showBar, setShowBar] = useState(false);
  const auto = useRef<ReturnType<typeof setInterval>>(undefined);
  const barTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const max = Math.max(0, content - viewport);
  const overflow = max > 2;
  const web = Platform.OS === 'web';

  const scrollTo = (x: number, animated = false) => scroller?.scrollTo({ x: Math.max(0, Math.min(max, x)), animated });

  // Vertical wheel → horizontal scroll (only when there is something to scroll).
  useEffect(() => {
    if (!web) return;
    const node = (scroller as unknown as { getScrollableNode?: () => HTMLElement } | null)?.getScrollableNode?.();
    if (!node) return;
    const onWheel = (e: WheelEvent) => {
      if (node.scrollWidth <= node.clientWidth || Math.abs(e.deltaX) > Math.abs(e.deltaY)) return;
      e.preventDefault();
      node.scrollLeft += e.deltaY;
    };
    node.addEventListener('wheel', onWheel, { passive: false });
    return () => node.removeEventListener('wheel', onWheel);
  }, [web, scroller]);

  useEffect(() => () => {
    clearInterval(auto.current);
    clearTimeout(barTimer.current);
  }, []);

  const startAuto = (dir: 1 | -1) => {
    clearInterval(auto.current);
    const node = (scroller as unknown as { getScrollableNode?: () => HTMLElement } | null)?.getScrollableNode?.();
    auto.current = setInterval(() => {
      if (node) node.scrollLeft += dir * 7;
    }, 16);
  };
  const stopAuto = () => clearInterval(auto.current);

  const enter = () => {
    clearTimeout(barTimer.current);
    barTimer.current = setTimeout(() => setShowBar(true), SHOW_DELAY);
  };
  const leave = () => {
    clearTimeout(barTimer.current);
    stopAuto();
    barTimer.current = setTimeout(() => setShowBar(false), 400);
  };

  const thumbWidth = overflow ? Math.max(40, (viewport / content) * viewport) : viewport;
  const thumbLeft = overflow ? (offset / max) * (viewport - thumbWidth) : 0;
  // Click or drag anywhere on the track: the thumb centers on the pointer.
  const toPointer = (x: number) => scrollTo(((x - thumbWidth / 2) / Math.max(1, viewport - thumbWidth)) * max);
  const drag = Gesture.Pan().runOnJS(true).minDistance(0).onBegin((e) => toPointer(e.x)).onUpdate((e) => toPointer(e.x));

  return (
    <View
      style={styles.wrap}
      onLayout={(e: LayoutChangeEvent) => setViewport(e.nativeEvent.layout.width)}
      {...(web ? ({ onMouseEnter: enter, onMouseLeave: leave } as object) : {})}>
      <ScrollView
        ref={setScroller}
        horizontal
        showsHorizontalScrollIndicator={false}
        onScroll={(e) => setOffset(e.nativeEvent.contentOffset.x)}
        onContentSizeChange={(w) => setContent(w)}
        scrollEventThrottle={16}
        contentContainerStyle={[styles.row, { gap }]}>
        {children}
      </ScrollView>
      {web && overflow && offset > 2 ? (
        <Pressable accessibilityElementsHidden onHoverIn={() => startAuto(-1)} onHoverOut={stopAuto} style={[styles.edge, styles.edgeLeft]} />
      ) : null}
      {web && overflow && offset < max - 2 ? (
        <Pressable accessibilityElementsHidden onHoverIn={() => startAuto(1)} onHoverOut={stopAuto} style={[styles.edge, styles.edgeRight]} />
      ) : null}
      {web && overflow ? (
        <GestureDetector gesture={drag}>
          <View accessibilityRole="scrollbar" accessibilityLabel="Rolar as seções" style={[styles.track, showBar ? styles.trackOn : styles.trackOff]}>
            <View pointerEvents="none" style={[styles.thumb, { width: thumbWidth, left: thumbLeft }]} />
          </View>
        </GestureDetector>
      ) : null}
    </View>
  );
}

const useStyles = makeStyles((colors) => ({
  wrap: { position: 'relative', paddingBottom: 12 },
  row: { paddingVertical: 4, paddingRight: 4, alignItems: 'center' },
  edge: { position: 'absolute', top: 0, bottom: 12, width: EDGE },
  edgeLeft: { left: 0 },
  edgeRight: { right: 0 },
  track: { position: 'absolute', left: 0, right: 0, bottom: 0, height: 8, borderRadius: radius.pill, backgroundColor: colors.surfaceAlt },
  trackOn: { opacity: 1 },
  trackOff: { opacity: 0 },
  thumb: { position: 'absolute', top: 1, height: 6, borderRadius: radius.pill, backgroundColor: colors.brand, opacity: 0.75 },
}));
