import { Check, X, ZoomIn } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import Cropper, { type Area } from 'react-easy-crop';
import { Text, View } from 'react-native';

import { makeStyles, radius, shadow } from '@/theme';

import { blurBehind } from './notifications-panel';
import { Slider } from './slider';
import { Button } from './ui';

export type CropOptions = { aspect?: number; round?: boolean; title?: string };
type Request = { src: string; options: CropOptions; resolve: (blob: Blob | null) => void };

let open: ((r: Request) => void) | null = null;

/**
 * Shows the crop step for an image (web) and resolves with the cropped image, or null if cancelled.
 * The frame has the aspect (and round shape) of the place the image fills, so the user sees the result.
 */
export function requestCrop(src: string, options: CropOptions = {}): Promise<Blob | null> {
  return new Promise((resolve) => {
    if (!open) resolve(null);
    else open({ src, options, resolve });
  });
}

async function cropToBlob(src: string, area: Area): Promise<Blob | null> {
  const img = new Image();
  img.crossOrigin = 'anonymous';
  img.src = src;
  await img.decode();
  // Keep big images reasonable (max 2000px on the long side).
  const scale = Math.min(1, 2000 / Math.max(area.width, area.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(area.width * scale);
  canvas.height = Math.round(area.height * scale);
  canvas.getContext('2d')!.drawImage(img, area.x, area.y, area.width, area.height, 0, 0, canvas.width, canvas.height);
  return new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.9));
}

/** Mounted once at the root: hosts the crop dialog. */
export function ImageCropHost() {
  const styles = useStyles();
  const [request, setRequest] = useState<Request | null>(null);
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [area, setArea] = useState<Area | null>(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    open = (r) => {
      setCrop({ x: 0, y: 0 });
      setZoom(1);
      setArea(null);
      setRequest(r);
    };
    return () => {
      open = null;
    };
  }, []);
  if (!request) return null;
  const close = (blob: Blob | null) => {
    request.resolve(blob);
    setRequest(null);
    setBusy(false);
  };
  return (
    <View style={styles.backdrop} ref={blurBehind}>
      <View style={styles.dialog}>
        <Text style={styles.title}>{request.options.title ?? 'Ajustar imagem'}</Text>
        <Text style={styles.hint}>Arraste para posicionar e use o zoom. A moldura mostra como a imagem vai ficar.</Text>
        <View style={styles.area}>
          <Cropper
            image={request.src}
            crop={crop}
            zoom={zoom}
            aspect={request.options.aspect ?? 4 / 3}
            cropShape={request.options.round ? 'round' : 'rect'}
            showGrid={!request.options.round}
            onCropChange={setCrop}
            onZoomChange={setZoom}
            onCropComplete={(_, pixels) => setArea(pixels)}
          />
        </View>
        <View style={styles.zoomRow}>
          <ZoomIn size={18} color="#8A8799" />
          <View style={styles.flex}>
            <Slider value={(zoom - 1) / 2} onChange={(v) => setZoom(1 + v * 2)} label="Zoom" />
          </View>
        </View>
        <View style={styles.actions}>
          <Button title="Cancelar" icon={X} variant="ghost" size="sm" onPress={() => close(null)} />
          <Button
            title="Usar imagem"
            icon={Check}
            size="sm"
            loading={busy}
            disabled={!area}
            onPress={async () => {
              if (!area) return;
              setBusy(true);
              close(await cropToBlob(request.src, area));
            }}
          />
        </View>
      </View>
    </View>
  );
}

const useStyles = makeStyles((colors) => ({
  flex: { flex: 1 },
  backdrop: { position: 'fixed' as 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: colors.overlay, alignItems: 'center', justifyContent: 'center', padding: 24, zIndex: 1000 },
  dialog: { width: '100%', maxWidth: 640, backgroundColor: colors.surface, borderRadius: radius.xl, padding: 20, gap: 12, ...shadow(colors, 3) },
  title: { fontSize: 18, fontWeight: '700', color: colors.text },
  hint: { fontSize: 13, color: colors.textMuted },
  area: { position: 'relative', height: 380, borderRadius: radius.md, overflow: 'hidden', backgroundColor: '#111' },
  zoomRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  actions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 8 },
}));
