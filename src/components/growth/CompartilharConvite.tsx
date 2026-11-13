// Botões de compartilhamento do convite: WhatsApp (mensagem editável), copiar link e outros aplicativos.
import React, { useEffect, useState } from 'react';
import { Check, Copy, MessageCircle, Share2 } from 'lucide-react';
import { linkWhatsApp, mensagemComLink } from '../../lib/convite';
import { notify } from '../common/Feedback';

const MENSAGEM_PADRAO = 'Você já conhece o Vybelog? Uma rede social para adultos e casais que compartilham interesses semelhantes e buscam novas conexões com respeito e discrição. Venha fazer parte: {link}';

export const CompartilharConvite: React.FC<{ link: string; modelo?: string | null; editavel?: boolean; titulo?: string }> = ({ link, modelo, editavel = true, titulo = 'Vybelog' }) => {
  const [texto, setTexto] = useState(() => mensagemComLink(modelo || MENSAGEM_PADRAO, link));
  const [copiado, setCopiado] = useState(false);
  useEffect(() => { setTexto(mensagemComLink(modelo || MENSAGEM_PADRAO, link)); }, [modelo, link]);

  const copiar = async () => {
    try { await navigator.clipboard.writeText(link); setCopiado(true); setTimeout(() => setCopiado(false), 2000); }
    catch { notify('Não foi possível copiar. Segure o link para copiar.'); }
  };
  const outros = async () => {
    if (navigator.share) { try { await navigator.share({ title: titulo, text: texto }); } catch { /* cancelado */ } }
    else copiar();
  };

  return (
    <div className="space-y-3">
      <div className="flex items-stretch gap-2">
        <input readOnly value={link} aria-label="Seu link de convite" onFocus={e => e.currentTarget.select()}
          className="flex-1 min-w-0 px-3.5 py-2.5 rounded-xl bg-zinc-950 border border-purple-900/40 text-xs text-zinc-200 font-mono" />
        <button type="button" onClick={copiar} className="shrink-0 px-3.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-xs font-bold text-white flex items-center gap-1.5 cursor-pointer">
          {copiado ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}{copiado ? 'Copiado' : 'Copiar'}
        </button>
      </div>
      {editavel && (
        <textarea value={texto} onChange={e => setTexto(e.target.value)} rows={3} maxLength={700} aria-label="Mensagem do convite"
          className="w-full px-3.5 py-2.5 rounded-xl bg-zinc-950 border border-purple-900/40 text-xs text-zinc-300 leading-relaxed focus:outline-none focus:border-purple-500 resize-none" />
      )}
      <div className="grid grid-cols-2 gap-2">
        <a href={linkWhatsApp(texto)} target="_blank" rel="noopener noreferrer"
          className="py-3 rounded-xl bg-[#25D366] hover:bg-[#1ebe5b] text-black text-sm font-bold flex items-center justify-center gap-2">
          <MessageCircle className="w-4 h-4" /> WhatsApp
        </a>
        <button type="button" onClick={outros} className="py-3 rounded-xl bg-gradient-to-r from-fuchsia-600 via-pink-600 to-orange-600 text-white text-sm font-bold flex items-center justify-center gap-2 cursor-pointer">
          <Share2 className="w-4 h-4" /> Outros apps
        </button>
      </div>
    </div>
  );
};
