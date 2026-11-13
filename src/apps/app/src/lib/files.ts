import * as ImagePicker from 'expo-image-picker';
import { Platform } from 'react-native';

import { API_URL, problemMessage, validAccessToken } from '@/api/client';
import { requestCrop, type CropOptions } from '@/components/image-crop';

/** Public URL of an uploaded file. */
export function fileUrl(key: string | null | undefined): string | undefined {
  return key ? `${API_URL}/files/${key}` : undefined;
}

/** Opens the image library. Returns null if the user cancels. On native the system crop uses the aspect. */
export async function pickImage(options: CropOptions = {}): Promise<ImagePicker.ImagePickerAsset | null> {
  const crop = Platform.OS !== 'web' && options.aspect !== undefined;
  const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.85, allowsEditing: crop, aspect: crop ? [Math.round(options.aspect! * 100), 100] : undefined });
  return result.canceled ? null : (result.assets[0] ?? null);
}

/** Uploads an image to the API and returns its storage key. */
export async function uploadImage(asset: ImagePicker.ImagePickerAsset, cropped?: Blob | null): Promise<string> {
  const form = new FormData();
  const name = asset.fileName ?? 'imagem.jpg';
  if (cropped) {
    form.append('file', cropped, name.replace(/\.\w+$/, '') + '.jpg');
  } else if (Platform.OS === 'web') {
    const blob = await (await fetch(asset.uri)).blob();
    form.append('file', blob, name);
  } else {
    // React Native's FormData accepts { uri, name, type } for files.
    form.append('file', { uri: asset.uri, name, type: asset.mimeType ?? 'image/jpeg' } as unknown as Blob);
  }

  const token = await validAccessToken();
  const response = await fetch(`${API_URL}/uploads`, {
    method: 'POST',
    headers: token ? { Authorization: `Bearer ${token}` } : undefined,
    body: form,
  });
  const body = await response.json().catch(() => undefined);
  if (!response.ok) throw new Error(problemMessage(body) ?? 'Não foi possível enviar a imagem.');
  return (body as { key: string }).key;
}

/**
 * Pick, adjust (crop to the frame it fills) and upload. Returns null if cancelled.
 * spect is width/height of the destination (1 for avatars); ound previews a circle.
 * Animated GIFs skip the crop so they keep moving.
 */
export async function pickAndUploadImage(options: CropOptions = {}): Promise<string | null> {
  const asset = await pickImage(options);
  if (!asset) return null;
  if (Platform.OS === 'web' && !/gif/i.test(asset.mimeType ?? asset.fileName ?? '')) {
    const cropped = await requestCrop(asset.uri, options);
    if (!cropped) return null;
    return uploadImage(asset, cropped);
  }
  return uploadImage(asset);
}
