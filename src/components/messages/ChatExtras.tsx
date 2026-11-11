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
export const GravadorDeAudio: React.FC<{ desabilitado: boolean; aoGravar: (arquivo: File) => void }> = ({ desabilitado, aoGravar }) => {
  const [gravando, setGravando] = useState(false);
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

  if (gravando) return (
    <div className="flex items-center gap-1.5">
      <span className="flex items-center gap-1.5 text-[11px] font-semibold text-rose-300"><span className="w-2 h-2 rounded-full bg-rose-500 animate-pulse" />{Math.floor(segundos / 60)}:{String(segundos % 60).padStart(2, '0')}</span>
      <button type="button" onClick={() => parar(true)} className="p-2 rounded-xl text-zinc-400 hover:text-white cursor-pointer" aria-label="Cancelar áudio"><X className="w-4 h-4" /></button>
      <button type="button" onClick={() => parar(false)} className="p-2 rounded-xl text-rose-300 hover:text-white cursor-pointer" aria-label="Enviar áudio"><Square className="w-4 h-4 fill-current" /></button>
    </div>
  );
  return (
    <button type="button" onClick={iniciar} disabled={desabilitado} className="p-2 rounded-xl text-zinc-400 hover:text-fuchsia-300 transition-colors cursor-pointer disabled:opacity-40"
      title={desabilitado ? 'Áudios são liberados depois que a conversa for aceita' : 'Gravar áudio'} aria-label="Gravar áudio">
      <Mic className="w-5 h-5" />
    </button>
  );
};
