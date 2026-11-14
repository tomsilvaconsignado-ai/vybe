// Janela da campanha "Convide e Ganhe": aparece uma vez a cada acesso (sessão do navegador), com as
// recompensas e as vagas de Fundador reais, e leva ao módulo Convide e Ganhe.
import React, { useEffect, useState } from 'react';
import { Crown, Gift, X } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { supabase } from '../../lib/supabase';
import { infoPublica, type InfoPublica } from '../../lib/crescimento';
import logoUrl from '../../assets/logo.png';
import { marcarConviteAberto } from '../../lib/janelas';

const CHAVE = 'vybe.popup.convite';
const jaVistoNestaSessao = () => { try { return sessionStorage.getItem(CHAVE) === '1'; } catch { return false; } };

export const CampanhaConvitePopup: React.FC = () => {
  const { activeTab, setActiveTab, openPostId, currentUser } = useApp();
  const [aberto, setAberto] = useState(false);
  const [recompensas, setRecompensas] = useState<{ threshold: number; label: string }[]>([]);
  const [info, setInfo] = useState<InfoPublica | null>(null);

  useEffect(() => {
    if (!currentUser.id || jaVistoNestaSessao()) return;
    let ativo = true;
    Promise.all([
      supabase.from('growth_rewards').select('threshold, label').eq('active', true).order('threshold'),
      infoPublica()
    ]).then(([r, i]) => {
      if (!ativo) return;
      setRecompensas((r.data ?? []) as { threshold: number; label: string }[]);
      setInfo(i);
    });
    const t = window.setTimeout(() => { if (ativo) setAberto(true); }, 1500);
    return () => { ativo = false; window.clearTimeout(t); };
  }, [currentUser.id]);

  const fechar = () => {
    try { sessionStorage.setItem(CHAVE, '1'); } catch { /* sem armazenamento */ }
    setAberto(false);
  };
  // avisa a janela de publicidade (ela espera um intervalo depois desta fechar)
  const visivel = aberto && activeTab !== 'invite' && !openPostId;
  useEffect(() => { marcarConviteAberto(visivel); }, [visivel]);
  useEffect(() => {
    if (!aberto) return;
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') fechar(); };
    document.addEventListener('keydown', esc);
    return () => document.removeEventListener('keydown', esc);
  }, [aberto]);

  if (!aberto || activeTab === 'invite' || openPostId) return null;
  const f = info?.founders;
  const vagas = f?.status === 'active' && f.remaining > 0;

  return (
    <div className="modal-overlay fixed inset-0 z-[55] bg-black/75 backdrop-blur-sm flex items-center justify-center p-4" onClick={fechar} role="dialog" aria-modal="true" aria-labelledby="titulo-campanha">
      <div className="relative w-full max-w-sm overflow-hidden rounded-3xl border border-fuchsia-500/30 bg-[#120b1f] shadow-2xl shadow-fuchsia-950/50" onClick={e => e.stopPropagation()}>
        {/* faixa com o degradê da marca */}
        <div className="relative px-6 pt-7 pb-6 text-center bg-gradient-to-br from-fuchsia-700/40 via-pink-600/25 to-orange-500/30">
          <div className="absolute -top-16 -right-16 w-44 h-44 rounded-full bg-orange-500/25 blur-3xl pointer-events-none" />
          <div className="absolute -bottom-20 -left-16 w-44 h-44 rounded-full bg-fuchsia-600/30 blur-3xl pointer-events-none" />
          <button type="button" onClick={fechar} className="absolute top-3 right-3 p-1.5 rounded-full bg-black/30 text-white/80 hover:text-white cursor-pointer" aria-label="Fechar">
            <X className="w-4 h-4" />
          </button>
          <img src={logoUrl} alt="" className="relative w-20 h-20 mx-auto object-contain drop-shadow-[0_0_24px_rgba(208,23,189,0.45)]" />
          <p className="relative mt-3 text-[12px] font-bold uppercase tracking-[0.2em] text-amber-200">Campanha</p>
          <h2 id="titulo-campanha" className="relative text-2xl font-black text-white">Convide e Ganhe</h2>
          <p className="relative mt-1.5 text-sm text-zinc-200">Traga amigos e casais que combinam com o Vybelog e ganhe recompensas a cada indicação confirmada.</p>
        </div>

        <div className="px-6 py-5 space-y-4">
          {recompensas.length > 0 && (
            <ul className="space-y-2">
              {recompensas.slice(0, 4).map(r => (
                <li key={r.threshold} className="flex items-center gap-3 text-sm">
                  <span className="w-9 h-9 shrink-0 rounded-full bg-gradient-to-br from-fuchsia-600 to-orange-500 text-white text-xs font-black flex items-center justify-center">{r.threshold}</span>
                  <span className="text-zinc-200">{r.label}</span>
                </li>
              ))}
            </ul>
          )}
          {vagas && (
            <p className="flex items-start gap-2 p-3 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-[12px] text-amber-100">
              <Crown className="w-4 h-4 text-amber-300 shrink-0" />
              <span>Restam <strong>{f!.remaining.toLocaleString('pt-BR')} vagas</strong> de Membro Fundador. O selo exige foto no perfil.</span>
            </p>
          )}
          <button type="button" onClick={() => { fechar(); setActiveTab('invite'); }}
            className="w-full py-3.5 rounded-2xl bg-gradient-to-r from-fuchsia-600 via-pink-600 to-orange-600 text-white font-bold flex items-center justify-center gap-2 shadow-lg shadow-fuchsia-950/50 cursor-pointer">
            <Gift className="w-5 h-5" /> Quero convidar
          </button>
          <button type="button" onClick={fechar} className="w-full text-xs font-semibold text-zinc-400 hover:text-zinc-200 cursor-pointer">Agora não</button>
        </div>
      </div>
    </div>
  );
};
