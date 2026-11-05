import * as ImagePicker from 'expo-image-picker';
import { Platform } from 'react-native';

import { API_URL, problemMessage, validAccessToken } from '@/api/client';

/** Public URL of an uploaded file. */
export function fileUrl(key: string | null | undefined): string | undefined {
  return key ? `${API_URL}/files/${key}` : undefined;
}

/** Opens the image library. Returns null if the user cancels. */
export async function pickImage(): Promise<ImagePicker.ImagePickerAsset | null> {
  const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.85 });
  return result.canceled ? null : (result.assets[0] ?? null);
}

/** Uploads an image to the API and returns its storage key. */
export async function uploadImage(asset: ImagePicker.ImagePickerAsset): Promise<string> {
  const form = new FormData();
  const name = asset.fileName ?? 'imagem.jpg';
  if (Platform.OS === 'web') {
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

/** Pick + upload in one step. Returns null if cancelled. */
export async function pickAndUploadImage(): Promise<string | null> {
  const asset = await pickImage();
  return asset ? uploadImage(asset) : null;
}
