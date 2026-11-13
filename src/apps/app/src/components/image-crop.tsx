/**
 * Native: the system picker already crops (expo-image-picker `allowsEditing`), so there is no extra step.
 * The web version (image-crop.web.tsx) shows a crop dialog.
 */
export type CropOptions = { aspect?: number; round?: boolean; title?: string };

export function requestCrop(_src: string, _options: CropOptions = {}): Promise<Blob | null> {
  return Promise.resolve(null);
}

export function ImageCropHost() {
  return null;
}
