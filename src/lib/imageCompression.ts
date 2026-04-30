// Client-side image compression: resize to max 1600px (longer edge) and convert to WebP.
// Reduces typical phone photos from 3-8 MB to ~150-400 KB without visible quality loss.

const MAX_DIMENSION = 1600;
const QUALITY = 0.85;

export async function compressImage(file: File): Promise<File> {
  // Skip non-images and tiny files (already small)
  if (!file.type.startsWith('image/')) return file;
  if (file.size < 200 * 1024) return file; // < 200 KB — not worth compressing

  try {
    const bitmap = await createImageBitmap(file);
    const { width, height } = bitmap;

    const scale = Math.min(1, MAX_DIMENSION / Math.max(width, height));
    const targetW = Math.round(width * scale);
    const targetH = Math.round(height * scale);

    const canvas = document.createElement('canvas');
    canvas.width = targetW;
    canvas.height = targetH;
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      bitmap.close();
      return file;
    }
    ctx.drawImage(bitmap, 0, 0, targetW, targetH);
    bitmap.close();

    const blob: Blob | null = await new Promise((resolve) =>
      canvas.toBlob(resolve, 'image/webp', QUALITY)
    );
    if (!blob) return file;

    // If WebP somehow ended up larger (rare, very small images), keep original
    if (blob.size >= file.size) return file;

    const newName = file.name.replace(/\.[^.]+$/, '') + '.webp';
    return new File([blob], newName, { type: 'image/webp', lastModified: Date.now() });
  } catch (err) {
    console.warn('Image compression failed, uploading original:', err);
    return file;
  }
}
