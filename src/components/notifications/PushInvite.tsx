// Convite para ativar as notificações push — sem pedir permissão de cara:
// aparece só depois de a pessoa usar o Vybelog um pouco, explica o que ela ganha e deixa escolher.
// "Agora não" espera 7 dias; "Não perguntar mais" e a recusa do navegador não insistem (dá para
// ativar depois em Preferências de notificações). No iPhone fora da Tela de Início, ensina a instalar.
import React, { useEffect, useState } from 'react';
import { BellRing, Share, X } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { notify } from '../common/Feedback';
import { ativarPush, registrarServiceWorker, situacaoPush, sincronizarInscricao, type SituacaoPush } from '../../lib/push';

const CHAVE = 'vybe.push.convite';
const ESPERA_MS = 25_000;            // tempo de uso nesta visita antes de convidar
const PAUSA_DIAS = 7;

type Registro = { pausadoAte?: number; nunca?: boolean; visitas?: number };
const ler = (): Registro => { try { return JSON.parse(localStorage.getItem(CHAVE) ?? '{}') as Registro; } catch { return {}; } };
const gravar = (r: Registro) => { try { localStorage.setItem(CHAVE, JSON.stringify(r)); } catch { /* sem armazenamento */ } };

export const PushInvite: React.FC = () => {
  const { isLoggedIn, activeTab } = useApp();
  const [situacao, setSituacao] = useState<SituacaoPush | null>(null);
  const [visivel, setVisivel] = useState(false);
  const [ocupado, setOcupado] = useState(false);

  // service worker sempre registrado (o push só chega com ele); inscrição existente fica sincronizada
  useEffect(() => {
    if (!isLoggedIn) return;
    registrarServiceWorker().then(() => sincronizarInscricao());
    const aoReceber = (ev: MessageEvent) => { if ((ev.data as { tipo?: string })?.tipo === 'reinscrever') sincronizarInscricao(); };
    navigator.serviceWorker?.addEventListener('message', aoReceber);
    return () => navigator.serviceWorker?.removeEventListener('message', aoReceber);
  }, [isLoggedIn]);

  useEffect(() => {
    if (!isLoggedIn) return;
    const r = ler();
    gravar({ ...r, visitas: (r.visitas ?? 0) + 1 });
    let cancelado = false;
    const t = window.setTimeout(async () => {
      const s = await situacaoPush();
      if (cancelado) return;
      setSituacao(s);
      const reg = ler();
      const pausado = reg.nunca || (reg.pausadoAte && reg.pausadoAte > Date.now());
      if (!pausado && (s === 'desativado' || (s === 'ios_instalar' && (reg.visitas ?? 0) >= 2))) setVisivel(true);
    }, ESPERA_MS);
    return () => { cancelado = true; window.clearTimeout(t); };
  }, [isLoggedIn]);

  // não aparece por cima das próprias preferências nem do chat aberto
  if (!visivel || !situacao || activeTab === 'notification-prefs' || activeTab === 'messages') return null;

  const fechar = (r: Registro) => { gravar({ ...ler(), ...r }); setVisivel(false); };
  const ativar = async () => {
    setOcupado(true);
    try {
      await ativarPush();
      notify('Pronto! Você vai receber as notificações do Vybelog neste aparelho.', 'success');
      fechar({ nunca: true });
    } catch (e) {
      notify(e instanceof Error ? e.message : 'Não foi possível ativar as notificações.', 'error');
      // recusou no navegador: não insiste
      if (typeof Notification !== 'undefined' && Notification.permission === 'denied') fechar({ nunca: true });
    } finally { setOcupado(false); }
  };

  return (
    <div role="dialog" aria-label="Ativar notificações" className="fixed inset-x-3 bottom-[calc(5.5rem+env(safe-area-inset-bottom))] lg:bottom-6 lg:left-auto lg:right-6 lg:w-[380px] z-40 animate-[vybe-sobe_.35s_ease-out]">
      <div className="relative rounded-3xl border border-white/10 bg-painel/95 backdrop-blur-xl p-5 shadow-2xl shadow-black/60">
        <button type="button" onClick={() => fechar({ pausadoAte: Date.now() + PAUSA_DIAS * 86_400_000 })} aria-label="Fechar"
          className="absolute top-3 right-3 w-8 h-8 rounded-full flex items-center justify-center text-zinc-400 hover:text-white hover:bg-white/5 cursor-pointer">
          <X className="w-4 h-4" />
        </button>
        <div className="flex items-start gap-3.5">
          <div className="w-11 h-11 shrink-0 rounded-2xl bg-gradient-to-br from-fuchsia-500 to-rose-500 flex items-center justify-center shadow-lg shadow-fuchsia-900/40">
            <BellRing className="w-5 h-5 text-white" />
          </div>
          <div className="min-w-0 pr-6">
            {situacao === 'ios_instalar' ? <>
              <h3 className="text-sm font-bold text-white">Receba avisos no iPhone</h3>
              <p className="mt-1 text-xs leading-relaxed text-zinc-400">
                Toque em <Share className="inline w-3.5 h-3.5 -mt-0.5" /> <b className="text-zinc-200">Compartilhar</b> e depois em <b className="text-zinc-200">Adicionar à Tela de Início</b>.
                Abra o Vybelog pelo ícone criado e ative as notificações.
              </p>
            </> : <>
              <h3 className="text-sm font-bold text-white">Não perca nenhuma conexão</h3>
              <p className="mt-1 text-xs leading-relaxed text-zinc-400">
                Saiba na hora quando alguém te seguir, curtir, comentar ou mandar mensagem — mesmo com o Vybelog fechado.
                Os avisos são discretos: nada de conteúdo na tela bloqueada.
              </p>
            </>}
          </div>
        </div>
        <div className="mt-4 flex items-center gap-2">
          {situacao !== 'ios_instalar' && (
            <button type="button" disabled={ocupado} onClick={ativar}
              className="flex-1 py-2.5 rounded-xl text-xs font-bold text-white bg-gradient-to-r from-fuchsia-600 via-pink-600 to-orange-600 hover:brightness-110 active:scale-[.98] transition disabled:opacity-60 cursor-pointer">
              {ocupado ? 'Ativando…' : 'Ativar notificações'}
            </button>
          )}
          <button type="button" onClick={() => fechar({ pausadoAte: Date.now() + PAUSA_DIAS * 86_400_000 })}
            className="flex-1 py-2.5 rounded-xl text-xs font-semibold text-zinc-300 bg-white/5 hover:bg-white/10 transition cursor-pointer">
            Agora não
          </button>
        </div>
        <button type="button" onClick={() => fechar({ nunca: true })} className="mt-2 w-full text-[12px] text-zinc-500 hover:text-zinc-300 cursor-pointer">
          Não perguntar mais (dá para ativar em Preferências de notificações)
        </button>
      </div>
    </div>
  );
};
