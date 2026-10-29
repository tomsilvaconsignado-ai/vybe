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

// Fotos do feed e dos stories saem sempre em 1080x1920 (9:16, tela cheia do celular).
// 'fill' corta as sobras pelo centro; 'fit' mostra a foto inteira sobre um fundo desfocado dela mesma.
export const FRAME_WIDTH = 1080;
export const FRAME_HEIGHT = 1920;
export type FrameMode = 'fill' | 'fit';

export async function fitToFrame(file: File, mode: FrameMode): Promise<File> {
  if (!REENCODED_TYPES.includes(file.type)) {
    throw new MediaProcessingError(`"${file.name}" não é uma foto compatível. Use JPG, PNG ou WebP.`);
  }

  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
  } catch {
    throw new MediaProcessingError(`Não foi possível processar "${file.name}". Use uma imagem JPG, PNG ou WebP.`);
  }

  const canvas = document.createElement('canvas');
  canvas.width = FRAME_WIDTH;
  canvas.height = FRAME_HEIGHT;
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    bitmap.close();
    throw new MediaProcessingError('Seu navegador não conseguiu processar a imagem.');
  }

  const draw = (scale: number) => {
    const w = bitmap.width * scale;
    const h = bitmap.height * scale;
    ctx.drawImage(bitmap, (FRAME_WIDTH - w) / 2, (FRAME_HEIGHT - h) / 2, w, h);
  };
  const cover = Math.max(FRAME_WIDTH / bitmap.width, FRAME_HEIGHT / bitmap.height);
  const contain = Math.min(FRAME_WIDTH / bitmap.width, FRAME_HEIGHT / bitmap.height);

  ctx.imageSmoothingQuality = 'high';
  if (mode === 'fill') {
    draw(cover);
  } else {
    // Fundo: a própria foto reduzida a poucos pixels e ampliada (desfoque que funciona também no Safari)
    const tiny = document.createElement('canvas');
    tiny.width = 27;
    tiny.height = 48;
    const tinyScale = cover * tiny.width / FRAME_WIDTH;
    const tw = bitmap.width * tinyScale;
    const th = bitmap.height * tinyScale;
    tiny.getContext('2d')?.drawImage(bitmap, (tiny.width - tw) / 2, (tiny.height - th) / 2, tw, th);
    ctx.drawImage(tiny, 0, 0, FRAME_WIDTH, FRAME_HEIGHT);
    ctx.fillStyle = 'rgba(0, 0, 0, 0.45)';
    ctx.fillRect(0, 0, FRAME_WIDTH, FRAME_HEIGHT);
    draw(contain);
  }
  bitmap.close();

  const blob = await new Promise<Blob | null>(resolve => canvas.toBlob(resolve, 'image/jpeg', 0.9));
  if (!blob) throw new MediaProcessingError('Seu navegador não conseguiu processar a imagem.');
  const name = file.name.replace(/\.[^.]+$/, '') + '.jpg';
  return new File([blob], name, { type: 'image/jpeg', lastModified: Date.now() });
}
