// Capa (poster) dos vídeos: sem ela, vários navegadores (principalmente o Safari do iPhone)
// mostram só um quadro preto com o símbolo de play até o vídeo começar.
//
// - Vídeos novos: no envio, o app tira um quadro do próprio vídeo e sobe "<nome>.poster.jpg"
//   ao lado do arquivo (mesma pasta do usuário no bucket public-media).
// - Vídeos antigos, sem capa: o endereço ganha "#t=0.1", que faz o navegador desenhar o primeiro quadro.
import React from 'react';
import { uploadPublicMedia } from './supabase';

const VIDEO_EXT = /\.(mp4|mov|webm)(?=$|[?#])/i;

/** Endereço da capa gerada no envio (só para vídeos do bucket público). */
export function posterOf(videoUrl: string | undefined | null): string | undefined {
  if (!videoUrl || !videoUrl.includes('/public-media/') || !VIDEO_EXT.test(videoUrl)) return undefined;
  return videoUrl.replace(/[?#].*$/, '').replace(VIDEO_EXT, '.poster.jpg');
}

/** O arquivo é vídeo? (publicações antigas podem ter sido gravadas como "imagem" mesmo sendo vídeo) */
export function isVideoUrl(url: string | undefined | null): boolean {
  return Boolean(url && VIDEO_EXT.test(url));
}

/** Endereço do vídeo que já mostra o primeiro quadro antes do play. */
export function withFirstFrame(videoUrl: string): string {
  return videoUrl.includes('#') ? videoUrl : `${videoUrl}#t=0.1`;
}

/** Tira um quadro do vídeo (no aparelho de quem envia) e devolve um JPEG de até 720 px. */
export function capturePoster(file: File, timeoutMs = 8000): Promise<Blob | null> {
  return new Promise(resolve => {
    const url = URL.createObjectURL(file);
    const video = document.createElement('video');
    let done = false;
    const finish = (blob: Blob | null) => {
      if (done) return;
      done = true;
      window.clearTimeout(timer);
      video.removeAttribute('src');
      video.load();
      URL.revokeObjectURL(url);
      resolve(blob);
    };
    const timer = window.setTimeout(() => finish(null), timeoutMs);
    video.muted = true;
    video.playsInline = true;
    video.preload = 'auto';
    video.onerror = () => finish(null);
    // pontos tentados: logo no início e, se o quadro vier escuro (abertura preta), mais adiante
    const finite = () => (Number.isFinite(video.duration) && video.duration > 0 ? video.duration : 0);
    const spots = () => {
      const d = finite();
      return d ? [Math.min(0.5, d / 10), Math.min(1.5, d * 0.3), d * 0.5] : [0.5, 1.5, 3];
    };
    let attempt = 0;
    const seekNext = () => {
      const s = spots();
      video.currentTime = s[Math.min(attempt, s.length - 1)];
    };
    const grab = () => {
      const w = video.videoWidth;
      const h = video.videoHeight;
      if (!w || !h) return finish(null);
      const scale = Math.min(1, 720 / Math.max(w, h));
      const canvas = document.createElement('canvas');
      canvas.width = Math.round(w * scale);
      canvas.height = Math.round(h * scale);
      const ctx = canvas.getContext('2d');
      if (!ctx) return finish(null);
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      // brilho médio de uma amostra 16×16: quadro quase preto → tenta outro ponto
      const probe = document.createElement('canvas');
      probe.width = probe.height = 16;
      const pctx = probe.getContext('2d');
      let dark = false;
      if (pctx) {
        pctx.drawImage(canvas, 0, 0, 16, 16);
        const d = pctx.getImageData(0, 0, 16, 16).data;
        let sum = 0;
        for (let i = 0; i < d.length; i += 4) sum += d[i] + d[i + 1] + d[i + 2];
        dark = sum / (d.length / 4) / 3 < 10;
      }
      if (dark && attempt < 2) {
        attempt++;
        return seekNext();
      }
      canvas.toBlob(b => finish(b), 'image/jpeg', 0.82);
    };
    video.onloadeddata = () => seekNext();
    video.onseeked = () => {
      // espera o quadro buscado ser realmente desenhado antes de copiar
      const v = video as HTMLVideoElement & { requestVideoFrameCallback?: (cb: () => void) => number };
      if (v.requestVideoFrameCallback) {
        v.requestVideoFrameCallback(() => grab());
        // alguns navegadores só entregam o quadro com o vídeo tocando
        video.play().then(() => video.pause()).catch(() => undefined);
      } else {
        window.setTimeout(grab, 120);
      }
    };
    video.src = url;
  });
}

/** Sobe a capa ao lado do vídeo já enviado. Falhar aqui não impede a publicação. */
export async function uploadPosterFor(file: File, videoPath: string): Promise<void> {
  try {
    const blob = await capturePoster(file);
    if (!blob) return;
    const posterPath = videoPath.replace(VIDEO_EXT, '.poster.jpg');
    await uploadPublicMedia(new File([blob], 'poster.jpg', { type: 'image/jpeg' }), posterPath, true);
  } catch {
    /* sem capa: o vídeo ainda mostra o primeiro quadro pelo #t */
  }
}

/** Miniatura de vídeo para grades (perfil, álbuns, painel): capa se houver, senão o primeiro quadro. */
export const VideoThumb: React.FC<{ url: string; className?: string }> = ({ url, className }) => {
  const [posterFailed, setPosterFailed] = React.useState(false);
  const [videoFailed, setVideoFailed] = React.useState(false);
  const poster = posterOf(url);
  if (poster && !posterFailed) {
    return React.createElement('img', { src: poster, alt: '', loading: 'lazy', className, onError: () => setPosterFailed(true) });
  }
  if (videoFailed) return React.createElement(MediaFallback, { className, video: true });
  return React.createElement('video', { src: withFirstFrame(url), muted: true, playsInline: true, preload: 'metadata', className, 'aria-hidden': true, onError: () => setVideoFailed(true) });
};

/** Quadro neutro quando a mídia não carrega (no lugar do ícone de imagem quebrada). */
const MediaFallback: React.FC<{ className?: string; video?: boolean }> = ({ className, video }) =>
  React.createElement(
    'span',
    { className: `${className ?? ''} flex items-center justify-center bg-[radial-gradient(120%_90%_at_20%_0%,#3b0764,#0a0612_70%)] text-white/60 text-[11px]`, role: 'img', 'aria-label': video ? 'Vídeo indisponível' : 'Mídia indisponível' },
    video ? '▶' : '•'
  );

/**
 * Miniatura de qualquer publicação na grade: foto, vídeo (pelo tipo gravado ou pela extensão)
 * e, se a foto falhar, tenta como vídeo antes de mostrar o quadro neutro.
 */
export const MediaThumb: React.FC<{ url: string; isVideo?: boolean; className?: string }> = ({ url, isVideo, className }) => {
  const [asVideo, setAsVideo] = React.useState(Boolean(isVideo) || isVideoUrl(url));
  if (asVideo) return React.createElement(VideoThumb, { url, className });
  return React.createElement('img', { src: url, alt: '', loading: 'lazy', className, onError: () => setAsVideo(true) });
};
