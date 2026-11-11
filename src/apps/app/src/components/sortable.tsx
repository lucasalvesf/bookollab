import { GripVertical } from 'lucide-react-native';
import { useState, type ReactNode } from 'react';
import { View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, { runOnJS, useAnimatedStyle, useSharedValue, withTiming, type SharedValue } from 'react-native-reanimated';

import { makeStyles, shadow, useTheme } from '@/theme';

/**
 * Drag-and-drop list: grab the handle (⋮⋮) and drop the row in its new place. Works with mouse and touch.
 * Rows are assumed to have the same height (measured from the first one).
 */
export function SortableList<T>({ items, keyOf, renderItem, onReorder, disabled }: {
  items: T[];
  keyOf: (item: T) => string;
  renderItem: (item: T, index: number) => ReactNode;
  onReorder: (items: T[]) => void;
  disabled?: boolean;
}) {
  const [rowHeight, setRowHeight] = useState(56);
  const active = useSharedValue(-1);
  const target = useSharedValue(-1);
  const dy = useSharedValue(0);

  const drop = (from: number, to: number) => {
    if (from !== to && from >= 0 && to >= 0) {
      const next = [...items];
      const [moved] = next.splice(from, 1);
      next.splice(to, 0, moved);
      onReorder(next);
    }
    // Reset after React has rendered the new order, so rows don't jump back for a frame.
    requestAnimationFrame(() => {
      active.set(-1);
      target.set(-1);
      dy.set(0);
    });
  };

  return (
    <View onLayout={() => undefined}>
      {items.map((item, index) => (
        <SortableRow
          key={keyOf(item)}
          index={index}
          count={items.length}
          rowHeight={rowHeight}
          onMeasure={index === 0 ? setRowHeight : undefined}
          active={active}
          target={target}
          dy={dy}
          disabled={disabled}
          onDrop={drop}>
          {renderItem(item, index)}
        </SortableRow>
      ))}
    </View>
  );
}

function SortableRow({ index, count, rowHeight, onMeasure, active, target, dy, disabled, onDrop, children }: {
  index: number;
  count: number;
  rowHeight: number;
  onMeasure?: (h: number) => void;
  active: SharedValue<number>;
  target: SharedValue<number>;
  dy: SharedValue<number>;
  disabled?: boolean;
  onDrop: (from: number, to: number) => void;
  children: ReactNode;
}) {
  const styles = useStyles();
  const { colors } = useTheme();

  const pan = Gesture.Pan()
    .enabled(!disabled)
    .minDistance(2)
    .onStart(() => {
      active.set(index);
      target.set(index);
      dy.set(0);
    })
    .onUpdate((e) => {
      dy.set(e.translationY);
      target.set(Math.max(0, Math.min(count - 1, Math.round(index + e.translationY / rowHeight))));
    })
    .onEnd(() => {
      runOnJS(onDrop)(index, target.get());
    });

  const style = useAnimatedStyle(() => {
    const dragging = active.get() === index;
    if (dragging) return { transform: [{ translateY: dy.get() }], zIndex: 10, opacity: 0.95 };
    let shift = 0;
    if (active.get() >= 0) {
      if (active.get() < index && index <= target.get()) shift = -rowHeight;
      else if (target.get() <= index && index < active.get()) shift = rowHeight;
    }
    return { transform: [{ translateY: withTiming(shift, { duration: 140 }) }], zIndex: 0, opacity: 1 };
  });
  const lifted = useAnimatedStyle(() => (active.get() === index ? shadow(colors, 3) : {}));

  return (
    <Animated.View style={[style]} onLayout={onMeasure ? (e) => onMeasure(e.nativeEvent.layout.height) : undefined}>
      <Animated.View style={[styles.row, lifted]}>
        {!disabled ? (
          <GestureDetector gesture={pan}>
            <View style={styles.handle} accessibilityLabel="Arrastar para reordenar" accessibilityHint="Segure e arraste para mudar a posição">
              <GripVertical size={18} color={colors.textSubtle} />
            </View>
          </GestureDetector>
        ) : null}
        <View style={styles.content}>{children}</View>
      </Animated.View>
    </Animated.View>
  );
}

const useStyles = makeStyles((colors) => ({
  row: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.surface },
  handle: { paddingHorizontal: 10, paddingVertical: 14, cursor: 'grab' } as object,
  content: { flex: 1 },
}));
