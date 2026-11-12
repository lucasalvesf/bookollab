/**
 * Community colors: from one main color (COR1) we derive the brand tokens of both themes.
 * Works in OKLCH (perceptual: same lightness looks equally light for every hue), then nudges the
 * lightness until each text/background pair passes WCAG AA (4.5:1). Results are cached per color.
 */
import type { Palette } from '@/theme';

type Rgb = [number, number, number];

export function isHex(v: string | null | undefined): v is string {
  return !!v && /^#[0-9a-f]{6}$/i.test(v);
}

export function hexToRgb(hex: string): Rgb {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

export function rgbToHex([r, g, b]: Rgb): string {
  const c = (v: number) => Math.round(Math.min(255, Math.max(0, v))).toString(16).padStart(2, '0');
  return `#${c(r)}${c(g)}${c(b)}`.toUpperCase();
}

const toLinear = (c: number) => {
  const v = c / 255;
  return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
};
const fromLinear = (v: number) => 255 * (v <= 0.0031308 ? 12.92 * v : 1.055 * v ** (1 / 2.4) - 0.055);

/** Relative luminance (WCAG). */
export function luminance(hex: string): number {
  const [r, g, b] = hexToRgb(hex).map(toLinear);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

export function contrast(a: string, b: string): number {
  const [x, y] = [luminance(a), luminance(b)].sort((m, n) => n - m);
  return (x + 0.05) / (y + 0.05);
}

/** sRGB hex → OKLCH [L 0-1, C, H degrees]. */
export function toOklch(hex: string): [number, number, number] {
  const [r, g, b] = hexToRgb(hex).map(toLinear);
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
  const L = 0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s;
  const A = 1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s;
  const B = 0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s;
  const C = Math.sqrt(A * A + B * B);
  const H = ((Math.atan2(B, A) * 180) / Math.PI + 360) % 360;
  return [L, C, H];
}

/** OKLCH → sRGB hex, reducing chroma until the color fits the sRGB gamut. */
export function fromOklch(L: number, C: number, H: number): string {
  for (let c = C; c >= 0; c -= 0.005) {
    const a = c * Math.cos((H * Math.PI) / 180);
    const b = c * Math.sin((H * Math.PI) / 180);
    const l = (L + 0.3963377774 * a + 0.2158037573 * b) ** 3;
    const m = (L - 0.1055613458 * a - 0.0638541728 * b) ** 3;
    const s = (L - 0.0894841775 * a - 1.291485548 * b) ** 3;
    const rgb = [
      4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
      -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
      -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s,
    ];
    if (rgb.every((v) => v >= -0.0005 && v <= 1.0005)) return rgbToHex(rgb.map(fromLinear) as Rgb);
  }
  return rgbToHex([L * 255, L * 255, L * 255]);
}

/** Moves the lightness (keeping hue/chroma) until `fg` on the result (or the result on `bg`) reaches the ratio. */
function fit(hex: string, other: string, ratio: number, direction: 'darker' | 'lighter'): string {
  const [L, C, H] = toOklch(hex);
  let current = hex;
  for (let l = L; l >= 0 && l <= 1; l += direction === 'darker' ? -0.01 : 0.01) {
    current = fromOklch(l, C, H);
    if (contrast(current, other) >= ratio) return current;
  }
  return current;
}

const cache = new Map<string, Palette>();

/**
 * Palette of a community: the base theme with brand tokens derived from `hex`.
 * - brand: buttons/active pills (text brandText on it ≥ 4.5:1);
 * - brandSoft / brandSoftText: tinted backgrounds and their text (≥ 4.5:1);
 * - accent stays the platform's (stars, highlights) so warnings never look like brand.
 */
export function communityPalette(base: Palette, scheme: 'light' | 'dark', hex: string): Palette {
  const key = `${scheme}${hex}`;
  const hit = cache.get(key);
  if (hit) return hit;
  const [, C, H] = toOklch(hex);
  let palette: Palette;
  if (scheme === 'light') {
    // White text on the brand color; darken only if needed.
    const brand = contrast(hex, '#FFFFFF') >= 4.5 ? hex.toUpperCase() : fit(hex, '#FFFFFF', 4.5, 'darker');
    const brandSoft = fromOklch(0.95, Math.min(C, 0.05), H);
    palette = { ...base, brand, brandText: '#FFFFFF', brandSoft, brandSoftText: fit(brand, brandSoft, 4.6, 'darker') };
  } else {
    // Light brand on dark surfaces, with dark text on it.
    const lifted = fromOklch(Math.max(toOklch(hex)[0], 0.72), C, H);
    const brand = contrast(lifted, base.surface) >= 4.5 ? lifted : fit(lifted, base.surface, 4.5, 'lighter');
    const brandSoft = fromOklch(0.3, Math.min(C, 0.08), H);
    const brandText = fromOklch(0.2, Math.min(C, 0.06), H);
    palette = { ...base, brand, brandText: contrast(brandText, brand) >= 4.5 ? brandText : '#000000', brandSoft, brandSoftText: fit(fromOklch(0.85, Math.min(C, 0.1), H), brandSoft, 4.6, 'lighter') };
  }
  cache.set(key, palette);
  return palette;
}

/** Curated starting points for the color picker (all pass AA in both themes after derivation). */
export const COLOR_PRESETS = ['#5B3DF5', '#2563EB', '#0891B2', '#059669', '#65A30D', '#CA8A04', '#EA580C', '#DC2626', '#DB2777', '#9333EA', '#7C5C3B', '#475569'];

export function hsvToHex(h: number, s: number, v: number): string {
  const f = (n: number) => {
    const k = (n + h / 60) % 6;
    return v - v * s * Math.max(0, Math.min(k, 4 - k, 1));
  };
  return rgbToHex([f(5) * 255, f(3) * 255, f(1) * 255]);
}

export function hexToHsv(hex: string): [number, number, number] {
  const [r, g, b] = hexToRgb(hex).map((v) => v / 255);
  const max = Math.max(r, g, b);
  const d = max - Math.min(r, g, b);
  let h = 0;
  if (d) h = max === r ? ((g - b) / d) % 6 : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return [((h * 60) + 360) % 360, max ? d / max : 0, max];
}
