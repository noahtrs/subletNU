// Resize and re-encode photos in the browser before upload. Phone photos are
// often 3-8 MB / 4000px+; listing cards and the lightbox never need more than
// ~1600px, so this typically cuts each file to a few hundred KB.

const MAX_DIMENSION = 1600;
const JPEG_QUALITY = 0.82;

const loadImage = (file: File): Promise<HTMLImageElement> =>
  new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error(`Could not read image ${file.name}`));
    };
    img.src = url;
  });

/**
 * Returns a resized JPEG version of `file`, or the original file if it can't be
 * processed (e.g. animated GIF, unsupported format) or compression wouldn't help.
 * Modern browsers apply EXIF orientation when drawing an <img> to a canvas, so
 * rotated phone photos come out upright.
 */
export async function compressImage(file: File): Promise<File> {
  if (!file.type.startsWith("image/") || file.type === "image/gif" || file.type === "image/svg+xml") {
    return file;
  }

  try {
    const img = await loadImage(file);
    const { naturalWidth: width, naturalHeight: height } = img;
    if (!width || !height) return file;

    const scale = Math.min(1, MAX_DIMENSION / Math.max(width, height));
    const targetWidth = Math.round(width * scale);
    const targetHeight = Math.round(height * scale);

    const canvas = document.createElement("canvas");
    canvas.width = targetWidth;
    canvas.height = targetHeight;
    const ctx = canvas.getContext("2d");
    if (!ctx) return file;

    // JPEG has no alpha; paint white so transparent PNGs don't turn black.
    ctx.fillStyle = "#fff";
    ctx.fillRect(0, 0, targetWidth, targetHeight);
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(img, 0, 0, targetWidth, targetHeight);

    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, "image/jpeg", JPEG_QUALITY)
    );
    if (!blob || blob.size >= file.size) return file;

    const baseName = file.name.replace(/\.[^.]+$/, "") || "photo";
    return new File([blob], `${baseName}.jpg`, { type: "image/jpeg", lastModified: Date.now() });
  } catch (error) {
    console.warn("Image compression failed, uploading original:", error);
    return file;
  }
}
