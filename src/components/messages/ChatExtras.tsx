// Recursos do chat: "digitando…" (transmissão do Realtime, nada gravado no banco), gravação de áudio
// (MediaRecorder) e exibição de foto, vídeo e áudio nas mensagens.
import React, { useEffect, useRef, useState } from 'react';
import { Mic, Square, X } from 'lucide-react';
import { supabase } from '../../lib/supabase';

/** "Digitando…": avisa a conversa enquanto a pessoa escreve (no máximo a cada 2 s) e mostra quando o outro lado escreve */
export function useDigitando(conversaId: string | null, eu: string) {
  const [outroDigitando, setOutroDigitando] = useState(false);
  const canal = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const ultimoEnvio = useRef(0);
  const apagar = useRef<number | undefined>(undefined);

  useEffect(() => {
    setOutroDigitando(false);
    if (!conversaId || !eu) return;
    const c = supabase.channel(`digitando:${conversaId}`, { config: { broadcast: { self: false } } });
    c.on('broadcast', { event: 'digitando' }, ({ payload }) => {
      if ((payload as { quem?: string })?.quem === eu) return;
      setOutroDigitando(true);
      window.clearTimeout(apagar.current);
      apagar.current = window.setTimeout(() => setOutroDigitando(false), 4000);
    });
    c.on('broadcast', { event: 'parou' }, () => setOutroDigitando(false));
    c.subscribe();
    canal.current = c;
    return () => { window.clearTimeout(apagar.current); supabase.removeChannel(c); canal.current = null; };
  }, [conversaId, eu]);

  const avisarDigitando = () => {
    const agora = Date.now();
    if (agora - ultimoEnvio.current < 2000) return;
    ultimoEnvio.current = agora;
    canal.current?.send({ type: 'broadcast', event: 'digitando', payload: { quem: eu } });
  };
  const avisarParou = () => { ultimoEnvio.current = 0; canal.current?.send({ type: 'broadcast', event: 'parou', payload: { quem: eu } }); };
  return { outroDigitando, avisarDigitando, avisarParou };
}

/** Altura realmente visível no celular (encolhe quando o teclado abre, inclusive no iPhone) */
export function useAlturaVisivel(ativo: boolean) {
  const [altura, setAltura] = useState<number | null>(null);
  useEffect(() => {
    const vv = window.visualViewport;
    if (!ativo || !vv) { setAltura(null); return; }
    const medir = () => {
      setAltura(vv.height);
      // o iPhone rola a página ao abrir o teclado; mantém a conversa encaixada no topo
      if (window.scrollY) window.scrollTo(0, 0);
    };
    medir();
    vv.addEventListener('resize', medir);
    vv.addEventListener('scroll', medir);
    return () => { vv.removeEventListener('resize', medir); vv.removeEventListener('scroll', medir); };
  }, [ativo]);
  return altura;
}

/** Tipo da mídia pelo caminho do arquivo (o link assinado mantém a extensão) */
export function tipoDaMidia(url: string): 'image' | 'video' | 'audio' {
  const ext = (url.split('?')[0]?.split('.').pop() ?? '').toLowerCase();
  if (['mp4', 'mov'].includes(ext)) return 'video';
  if (['webm'].includes(ext)) return url.includes('/audio-') ? 'audio' : 'video';
  if (['m4a', 'ogg', 'mp3'].includes(ext)) return 'audio';
  return 'image';
}

export const MidiaDaMensagem: React.FC<{ url: string; temTexto: boolean; aoAmpliar: (url: string) => void }> = ({ url, temTexto, aoAmpliar }) => {
  const tipo = tipoDaMidia(url);
  if (tipo === 'audio') return <audio src={url} controls preload="metadata" className={`max-w-[260px] ${temTexto ? 'mb-2' : ''}`} />;
  if (tipo === 'video') return <video src={url} controls playsInline preload="metadata" className={`rounded-xl max-h-72 max-w-full ${temTexto ? 'mb-2' : ''}`} />;
  return (
    <button type="button" onClick={() => aoAmpliar(url)} className={`block cursor-zoom-in ${temTexto ? 'mb-2' : ''}`}>
      <img src={url} alt="Imagem enviada" loading="lazy" className="rounded-xl max-h-64 max-w-full object-cover" />
    </button>
  );
};

/** Botão de gravar áudio: toca para começar, toca de novo para enviar; X cancela. Até 2 minutos. */
export const GravadorDeAudio: React.FC<{ desabilitado: boolean; aoGravar: (arquivo: File) => void; aoMudarEstado?: (gravando: boolean) => void }> = ({ desabilitado, aoGravar, aoMudarEstado }) => {
  const [gravando, setGravandoInterno] = useState(false);
  const setGravando = (v: boolean) => { setGravandoInterno(v); aoMudarEstado?.(v); };
  const [segundos, setSegundos] = useState(0);
  const gravador = useRef<MediaRecorder | null>(null);
  const partes = useRef<Blob[]>([]);
  const cancelado = useRef(false);
  const relogio = useRef<number | undefined>(undefined);

  const parar = (cancelar: boolean) => {
    cancelado.current = cancelar;
    gravador.current?.stop();
    window.clearInterval(relogio.current);
    setGravando(false);
  };
  useEffect(() => () => { if (gravador.current?.state === 'recording') parar(true); }, []);
  useEffect(() => { if (segundos >= 120) parar(false); }, [segundos]);

  const iniciar = async () => {
    if (typeof MediaRecorder === 'undefined') { alert('Este navegador não grava áudio.'); return; }
    let fluxo: MediaStream;
    try { fluxo = await navigator.mediaDevices.getUserMedia({ audio: true }); }
    catch { alert('Permita o uso do microfone para gravar o áudio.'); return; }
    const tipo = ['audio/webm;codecs=opus', 'audio/mp4', 'audio/ogg'].find(t => MediaRecorder.isTypeSupported(t)) ?? '';
    const r = new MediaRecorder(fluxo, tipo ? { mimeType: tipo } : undefined);
    partes.current = []; cancelado.current = false;
    r.ondataavailable = e => { if (e.data.size) partes.current.push(e.data); };
    r.onstop = () => {
      fluxo.getTracks().forEach(t => t.stop());
      if (cancelado.current || !partes.current.length) return;
      const mime = (r.mimeType || 'audio/webm').split(';')[0]!;
      const ext = mime === 'audio/mp4' ? 'm4a' : mime === 'audio/ogg' ? 'ogg' : 'webm';
      aoGravar(new File(partes.current, `audio-${Date.now()}.${ext}`, { type: mime }));
    };
    r.start();
    gravador.current = r;
    setSegundos(0);
    setGravando(true);
    relogio.current = window.setInterval(() => setSegundos(s => s + 1), 1000);
  };

  // Gravando: ocupa a barra inteira (cancelar · tempo · enviar)
  if (gravando) return (
    <div className="flex-1 min-w-0 flex items-center gap-2">
      <button type="button" onClick={() => parar(true)} className="w-10 h-10 shrink-0 rounded-full text-zinc-400 hover:text-rose-300 hover:bg-zinc-800 flex items-center justify-center cursor-pointer" aria-label="Cancelar áudio"><X className="w-5 h-5" /></button>
      <div className="flex-1 min-w-0 h-10 px-4 rounded-full bg-zinc-900/90 border border-rose-500/30 flex items-center gap-2" role="status">
        <span className="w-2.5 h-2.5 shrink-0 rounded-full bg-rose-500 animate-pulse" />
        <span className="text-sm font-semibold text-rose-200 tabular-nums">{Math.floor(segundos / 60)}:{String(segundos % 60).padStart(2, '0')}</span>
        <span className="text-xs text-zinc-400 truncate">Gravando áudio…</span>
      </div>
      <button type="button" onClick={() => parar(false)} className="w-10 h-10 shrink-0 rounded-full bg-gradient-to-br from-purple-600 to-rose-600 text-white flex items-center justify-center shadow cursor-pointer" aria-label="Enviar áudio"><Square className="w-4 h-4 fill-current" /></button>
    </div>
  );
  return (
    <button type="button" onClick={iniciar} disabled={desabilitado} className="w-10 h-10 shrink-0 rounded-full bg-gradient-to-br from-purple-600 to-rose-600 text-white flex items-center justify-center shadow transition-opacity cursor-pointer disabled:opacity-40"
      title={desabilitado ? 'Áudios são liberados depois que a conversa for aceita' : 'Gravar áudio'} aria-label="Gravar áudio">
      <Mic className="w-5 h-5" />
    </button>
  );
};
