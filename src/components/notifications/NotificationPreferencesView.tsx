// PREFERÊNCIAS DE NOTIFICAÇÕES: o que chega por push, silenciar, horário silencioso, privacidade da tela
// bloqueada e os aparelhos conectados. Tudo salvo no banco e respeitado pelo servidor na hora do envio.
// Avisos de segurança da conta são essenciais e não podem ser desligados.
import React, { useEffect, useState } from 'react';
import { ArrowLeft, BellOff, BellRing, Laptop, Lock, Moon, ShieldCheck, Smartphone, Trash2 } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { notify } from '../common/Feedback';
import {
  PREFERENCIAS_PADRAO, ativarPush, desativarPushNesteAparelho, endpointDesteAparelho, lerPreferencias, meusAparelhos, removerAparelho,
  salvarPreferencias, situacaoPush, type Aparelho, type PreferenciasNotificacao, type SituacaoPush,
} from '../../lib/push';

const CATEGORIAS: Array<{ id: string; nome: string; detalhe: string }> = [
  { id: 'follows', nome: 'Novos seguidores', detalhe: 'Quando alguém começar a seguir você.' },
  { id: 'likes', nome: 'Curtidas', detalhe: 'Curtidas nas suas publicações.' },
  { id: 'comments', nome: 'Comentários', detalhe: 'Comentários nas suas publicações e eventos.' },
  { id: 'replies', nome: 'Respostas', detalhe: 'Respostas aos seus comentários.' },
  { id: 'mentions', nome: 'Menções', detalhe: 'Quando mencionarem você.' },
  { id: 'messages', nome: 'Mensagens privadas', detalhe: 'Mensagens e pedidos de conversa (sem mostrar o conteúdo).' },
  { id: 'connections', nome: 'Conexões', detalhe: 'Pedidos e conexões aceitas.' },
  { id: 'groups', nome: 'Grupos e comunidades', detalhe: 'Convites, aprovações e publicações nos grupos.' },
  { id: 'events', nome: 'Eventos', detalhe: 'Convites e novidades dos eventos.' },
  { id: 'vault', nome: 'Cofre privado', detalhe: 'Pedidos e liberações de acesso.' },
  { id: 'announcements', nome: 'Comunicados do Vybelog', detalhe: 'Avisos importantes da plataforma.' },
];

const SILENCIAR = [{ h: 1, r: '1 hora' }, { h: 8, r: '8 horas' }, { h: 24, r: '24 horas' }, { h: 24 * 7, r: '1 semana' }];

const Interruptor: React.FC<{ ligado: boolean; aoMudar: (v: boolean) => void; rotulo: string; desabilitado?: boolean }> = ({ ligado, aoMudar, rotulo, desabilitado }) => (
  <button type="button" role="switch" aria-checked={ligado} aria-label={rotulo} disabled={desabilitado} onClick={() => aoMudar(!ligado)}
    className={`relative w-11 h-6 shrink-0 rounded-full transition-colors cursor-pointer disabled:cursor-not-allowed disabled:opacity-60 ${ligado ? 'bg-gradient-to-r from-fuchsia-600 to-rose-600' : 'bg-zinc-700'}`}>
    <span className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform ${ligado ? 'translate-x-5' : ''}`} />
  </button>
);

const Bloco: React.FC<{ titulo: string; icone: React.ReactNode; children: React.ReactNode }> = ({ titulo, icone, children }) => (
  <section className="rounded-3xl border border-white/[.06] bg-[#110c1c] p-5">
    <h2 className="mb-3 flex items-center gap-2 text-sm font-bold text-white">{icone}{titulo}</h2>
    {children}
  </section>
);

const quando = (iso: string | null) => (iso ? new Date(iso).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' }) : '—');

export const NotificationPreferencesView: React.FC = () => {
  const { currentUser, setActiveTab } = useApp();
  const [p, setP] = useState<PreferenciasNotificacao>(PREFERENCIAS_PADRAO);
  const [carregado, setCarregado] = useState(false);
  const [situacao, setSituacao] = useState<SituacaoPush | null>(null);
  const [aparelhos, setAparelhos] = useState<Aparelho[]>([]);
  const [este, setEste] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState(false);

  const recarregarAparelhos = async () => {
    setSituacao(await situacaoPush());
    setEste(await endpointDesteAparelho());
    setAparelhos(await meusAparelhos().catch(() => []));
  };
  useEffect(() => {
    if (!currentUser.id) return;
    lerPreferencias(currentUser.id).then((x) => { setP(x); setCarregado(true); });
    recarregarAparelhos();
  }, [currentUser.id]);

  const salvar = async (novo: PreferenciasNotificacao) => {
    setP(novo);
    try { await salvarPreferencias(novo); } catch { notify('Não foi possível salvar as preferências. Tente de novo.', 'error'); }
  };
  const ligada = (id: string) => p.categories[id] !== false;
  const silenciado = p.muted_until && new Date(p.muted_until) > new Date();

  const ativarAqui = async () => {
    setOcupado(true);
    try { await ativarPush(); notify('Notificações ativadas neste aparelho.', 'success'); }
    catch (e) { notify(e instanceof Error ? e.message : 'Não foi possível ativar.', 'error'); }
    finally { setOcupado(false); recarregarAparelhos(); }
  };

  return (
    <div className="max-w-2xl mx-auto py-6 px-4 space-y-4">
      <button type="button" onClick={() => setActiveTab('notifications')} className="flex items-center gap-1.5 text-xs font-semibold text-zinc-400 hover:text-white cursor-pointer">
        <ArrowLeft className="w-4 h-4" /> Voltar para as notificações
      </button>
      <div>
        <h1 className="text-2xl font-extrabold text-white">Preferências de notificações</h1>
        <p className="mt-1 text-xs text-zinc-400">Escolha o que chega no seu celular ou computador. Tudo continua aparecendo na central, dentro do Vybelog.</p>
      </div>

      <Bloco titulo="Este aparelho" icone={<BellRing className="w-4 h-4 text-fuchsia-400" />}>
        {situacao === 'ativo' && <div className="flex items-center justify-between gap-3">
          <p className="text-xs text-emerald-300">Este aparelho recebe as notificações push.</p>
          <button type="button" onClick={async () => { await desativarPushNesteAparelho(); recarregarAparelhos(); }} className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-white/5 text-zinc-200 hover:bg-white/10 cursor-pointer">Desativar aqui</button>
        </div>}
        {situacao === 'desativado' && <div className="flex items-center justify-between gap-3">
          <p className="text-xs text-zinc-400">Receba avisos mesmo com o Vybelog fechado.</p>
          <button type="button" disabled={ocupado} onClick={ativarAqui} className="px-4 py-2 rounded-xl text-xs font-bold text-white bg-gradient-to-r from-fuchsia-600 to-rose-600 cursor-pointer disabled:opacity-60">{ocupado ? 'Ativando…' : 'Ativar notificações'}</button>
        </div>}
        {situacao === 'bloqueado' && <p className="text-xs text-amber-300">As notificações estão bloqueadas para o Vybelog neste navegador. Libere em Configurações do site › Notificações e volte aqui para reativar.</p>}
        {situacao === 'ios_instalar' && <p className="text-xs text-zinc-300">No iPhone/iPad (iOS 16.4 ou mais novo): toque em Compartilhar › <b>Adicionar à Tela de Início</b>, abra o Vybelog pelo ícone e ative aqui.</p>}
        {(situacao === 'sem_suporte' || situacao === 'inseguro') && <p className="text-xs text-zinc-400">Este navegador não recebe notificações push. Use Chrome, Edge, Firefox ou o Vybelog instalado.</p>}
        <details className="mt-3 text-[12px] text-zinc-500">
          <summary className="cursor-pointer text-zinc-400">Como instalar o Vybelog como aplicativo</summary>
          <ul className="mt-2 space-y-1 list-disc pl-5">
            <li><b>Android:</b> menu ⋮ do Chrome › Instalar aplicativo.</li>
            <li><b>iPhone/iPad:</b> Safari › Compartilhar › Adicionar à Tela de Início.</li>
            <li><b>Computador:</b> ícone de instalar na barra de endereço do Chrome ou Edge.</li>
          </ul>
        </details>
      </Bloco>

      <Bloco titulo="O que chega por push" icone={<Smartphone className="w-4 h-4 text-fuchsia-400" />}>
        <div className="mb-3 flex gap-2">
          <button type="button" disabled={!carregado} onClick={() => salvar({ ...p, categories: {} })} className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-white/5 text-zinc-200 hover:bg-white/10 cursor-pointer">Ativar todas</button>
          <button type="button" disabled={!carregado} onClick={() => salvar({ ...p, categories: Object.fromEntries(CATEGORIAS.map((c) => [c.id, false])) })} className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-white/5 text-zinc-200 hover:bg-white/10 cursor-pointer">Desativar opcionais</button>
        </div>
        <ul className="divide-y divide-white/[.05]">
          {CATEGORIAS.map((c) => (
            <li key={c.id} className="flex items-center justify-between gap-3 py-2.5">
              <div className="min-w-0"><p className="text-sm text-white">{c.nome}</p><p className="text-[12px] text-zinc-500">{c.detalhe}</p></div>
              <Interruptor ligado={ligada(c.id)} rotulo={c.nome} desabilitado={!carregado} aoMudar={(v) => salvar({ ...p, categories: { ...p.categories, [c.id]: v } })} />
            </li>
          ))}
          <li className="flex items-center justify-between gap-3 py-2.5">
            <div className="min-w-0"><p className="text-sm text-white flex items-center gap-1.5"><ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />Segurança da conta</p><p className="text-[12px] text-zinc-500">Avisos essenciais sobre a sua conta — sempre ativos.</p></div>
            <Interruptor ligado rotulo="Segurança da conta" desabilitado aoMudar={() => undefined} />
          </li>
        </ul>
      </Bloco>

      <Bloco titulo="Silenciar e horário silencioso" icone={<Moon className="w-4 h-4 text-fuchsia-400" />}>
        {silenciado ? <div className="mb-4 flex items-center justify-between gap-3 rounded-2xl bg-amber-500/10 px-3 py-2.5">
          <p className="text-xs text-amber-200 flex items-center gap-1.5"><BellOff className="w-4 h-4" />Silenciado até {quando(p.muted_until)}</p>
          <button type="button" onClick={() => salvar({ ...p, muted_until: null })} className="px-3 py-1.5 rounded-lg text-xs font-bold bg-white/10 text-white cursor-pointer">Reativar agora</button>
        </div> : <div className="mb-4">
          <p className="mb-2 text-xs text-zinc-400">Silenciar temporariamente (nada chega por push):</p>
          <div className="flex flex-wrap gap-2">{SILENCIAR.map((s) => (
            <button key={s.h} type="button" onClick={() => salvar({ ...p, muted_until: new Date(Date.now() + s.h * 3600e3).toISOString() })}
              className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-white/5 text-zinc-200 hover:bg-white/10 cursor-pointer">{s.r}</button>
          ))}</div>
        </div>}
        <div className="flex items-center justify-between gap-3">
          <div><p className="text-sm text-white">Horário silencioso</p><p className="text-[12px] text-zinc-500">Os avisos desse período chegam quando ele terminar.</p></div>
          <Interruptor ligado={!!(p.quiet_start && p.quiet_end)} rotulo="Horário silencioso"
            aoMudar={(v) => salvar({ ...p, quiet_start: v ? '23:00' : null, quiet_end: v ? '07:00' : null, timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || p.timezone })} />
        </div>
        {p.quiet_start && p.quiet_end && <div className="mt-3 flex items-center gap-3 text-xs text-zinc-300">
          <label className="flex items-center gap-2">Das <input type="time" value={p.quiet_start} onChange={(e) => salvar({ ...p, quiet_start: e.target.value })} className="rounded-lg bg-black/40 border border-white/10 px-2 py-1 text-white" /></label>
          <label className="flex items-center gap-2">às <input type="time" value={p.quiet_end} onChange={(e) => salvar({ ...p, quiet_end: e.target.value })} className="rounded-lg bg-black/40 border border-white/10 px-2 py-1 text-white" /></label>
        </div>}
      </Bloco>

      <Bloco titulo="Privacidade na tela bloqueada" icone={<Lock className="w-4 h-4 text-fuchsia-400" />}>
        <div className="flex items-center justify-between gap-3">
          <div><p className="text-sm text-white">Mostrar nomes nas notificações</p>
            <p className="text-[12px] text-zinc-500">Desligado (recomendado): "Você recebeu uma nova mensagem". Ligado: "…de Maria". O conteúdo das mensagens e comentários nunca aparece.</p></div>
          <Interruptor ligado={p.show_names} rotulo="Mostrar nomes" aoMudar={(v) => salvar({ ...p, show_names: v })} />
        </div>
      </Bloco>

      <Bloco titulo="Aparelhos conectados" icone={<Laptop className="w-4 h-4 text-fuchsia-400" />}>
        {!aparelhos.length ? <p className="text-xs text-zinc-500">Nenhum aparelho recebe push ainda.</p> : (
          <ul className="divide-y divide-white/[.05]">{aparelhos.map((a) => {
            const aqui = !!este && este.endsWith(a.endpoint_tail);
            return (
              <li key={a.id} className={`flex items-center gap-3 py-2.5 ${a.active ? '' : 'opacity-50'}`}>
                {/Android|iPhone/.test(a.device_label ?? '') ? <Smartphone className="w-5 h-5 text-zinc-400" /> : <Laptop className="w-5 h-5 text-zinc-400" />}
                <div className="min-w-0 flex-1">
                  <p className="text-sm text-white">{a.device_label ?? 'Aparelho'}{aqui && <span className="ml-2 rounded bg-fuchsia-500/15 px-1.5 py-0.5 text-[10px] text-fuchsia-300">este aparelho</span>}</p>
                  <p className="text-[12px] text-zinc-500">Desde {quando(a.created_at)}{a.last_success_at ? ` · último aviso ${quando(a.last_success_at)}` : ''}{!a.active ? ' · desativado' : ''}</p>
                </div>
                {a.active && <button type="button" aria-label="Remover aparelho" onClick={async () => {
                  if (aqui) await desativarPushNesteAparelho(); else await removerAparelho(a.id);
                  notify('Aparelho removido: ele não recebe mais notificações.', 'success');
                  recarregarAparelhos();
                }} className="w-9 h-9 rounded-full flex items-center justify-center text-zinc-400 hover:text-rose-400 hover:bg-white/5 cursor-pointer"><Trash2 className="w-4 h-4" /></button>}
              </li>
            );
          })}</ul>
        )}
      </Bloco>
    </div>
  );
};
