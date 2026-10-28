// Fotos tiradas no celular carregam metadados EXIF (GPS, modelo do aparelho, data).
// Redesenhar a imagem num canvas gera um arquivo novo só com os pixels, sem esses dados.
// GIFs ficam como estão (o canvas perderia a animação e o formato raramente tem GPS);
// vídeos também, pois não há como reprocessá-los no navegador sem uma biblioteca pesada.

const MAX_DIMENSION = 2560;
const REENCODED_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

export class MediaProcessingError extends Error {}

export async function stripImageMetadata(file: File): Promise<File> {
  if (!REENCODED_TYPES.includes(file.type)) return file;

  let bitmap: ImageBitmap;
  try {
    // 'from-image' aplica a rotação do EXIF antes de descartá-lo
    bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
  } catch {
    throw new MediaProcessingError(`Não foi possível processar "${file.name}". Use uma imagem JPG, PNG ou WebP.`);
  }

  const scale = Math.min(1, MAX_DIMENSION / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    bitmap.close();
    throw new MediaProcessingError('Seu navegador não conseguiu processar a imagem.');
  }
  ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();

  const blob = await new Promise<Blob | null>(resolve => canvas.toBlob(resolve, file.type, 0.9));
  if (!blob) throw new MediaProcessingError('Seu navegador não conseguiu processar a imagem.');
  return new File([blob], file.name, { type: file.type, lastModified: Date.now() });
}
