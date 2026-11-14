// GROWTH CENTER — Crescimento do Vybelog: indicadores, rankings, recompensas, fundadores, embaixadores,
// campanhas e indicações. Configurar exige superadministrador com MFA; toda alteração pede justificativa
// e fica na auditoria (o banco confere tudo).
import React, { useEffect, useMemo, useState } from 'react';
import { Award, Crown, Gift, Megaphone, Plus, RefreshCw, Rocket, TrendingUp } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import {
  concederBeneficio, definirEmbaixador, estatisticasCrescimento, recusarIndicacao, ROTULO_RECOMPENSA, salvarCampanha,
  salvarConfiguracao, salvarRecompensa, type EstatisticasCrescimento, type RewardKind
} from '../../lib/crescimento';
import { askText, notify } from '../common/Feedback';
import { Seletor } from '../common/Seletor';

const fmt = (n: number) => Number(n ?? 0).toLocaleString('pt-BR');
const campo = 'w-full px-3 py-2 rounded-xl bg-zinc-950 border border-zinc-800 text-sm text-zinc-100 placeholder-zinc-600 focus:outline-none focus:border-amber-500/60';
const pedirJustificativa = (titulo: string) => askText({ title: titulo, message: 'Informe a justificativa (fica registrada na auditoria).', placeholder: 'Justificativa', confirmLabel: 'Salvar' });

const Tile: React.FC<{ titulo: string; valor: React.ReactNode; detalhe?: string }> = ({ titulo, valor, detalhe }) => (
  <div className="p-4 rounded-2xl bg-[#120d20] border border-purple-900/30">
    <span className="block text-[10px] font-bold uppercase tracking-wider text-zinc-400 mb-1">{titulo}</span>
    <span className="block text-2xl font-black text-white tabular-nums">{valor}</span>
    {detalhe && <span className="block text-[12px] text-zinc-500 mt-0.5">{detalhe}</span>}
  </div>
);

/** Cadastros por dia (30 dias): barra empilhada — por convite (rosa) + demais (roxo), com legenda e valor ao tocar */
const GraficoCadastros: React.FC<{ serie: EstatisticasCrescimento['signups_series'] }> = ({ serie }) => {
  const [foco, setFoco] = useState<number | null>(null);
  const max = Math.max(1, ...serie.map(s => s.n));
  const dia = (iso: string) => new Date(iso + 'T12:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
  const atual = foco !== null ? serie[foco] : null;
  return (
    <div className="p-4 rounded-2xl bg-[#120d20] border border-purple-900/30">
      <div className="flex flex-wrap items-baseline justify-between gap-2 mb-3">
        <h3 className="text-xs font-bold text-zinc-200">Novos cadastros por dia (30 dias)</h3>
        <span className="text-[12px] text-zinc-400 tabular-nums" aria-live="polite">
          {atual ? `${dia(atual.day)}: ${atual.n} cadastros, ${atual.ref} por convite` : `${fmt(serie.reduce((a, s) => a + s.n, 0))} no período`}
        </span>
      </div>
      <div className="flex items-end gap-[2px] h-32 border-b border-zinc-800" role="img"
        aria-label={`Cadastros por dia: ${serie.map(s => `${dia(s.day)} ${s.n} (convite ${s.ref})`).join(', ')}`}>
        {serie.map((s, i) => (
          <div key={s.day} className="flex-1 h-full flex flex-col justify-end cursor-default" onMouseEnter={() => setFoco(i)} onMouseLeave={() => setFoco(null)} onClick={() => setFoco(f => (f === i ? null : i))}>
            <div className={`w-full rounded-t-[4px] ${foco === i ? 'bg-purple-300' : 'bg-purple-500/70'}`} style={{ height: `${((s.n - s.ref) / max) * 100}%` }} />
            {s.ref > 0 && <div className={`w-full mt-[2px] ${s.n - s.ref > 0 ? '' : 'rounded-t-[4px]'} ${foco === i ? 'bg-rose-300' : 'bg-rose-500'}`} style={{ height: `${(s.ref / max) * 100}%` }} />}
          </div>
        ))}
      </div>
      <div className="flex justify-between mt-1.5 text-[10px] text-zinc-500 tabular-nums">
        <span>{serie[0] && dia(serie[0].day)}</span><span>{serie[15] && dia(serie[15].day)}</span><span>{serie.length > 0 && dia(serie[serie.length - 1]!.day)}</span>
      </div>
      <div className="flex gap-4 mt-2 text-[12px] text-zinc-300">
        <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm bg-rose-500" />Por convite</span>
        <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm bg-purple-500/70" />Demais cadastros</span>
      </div>
    </div>
  );
};

export const AdminCrescimentoTab: React.FC = () => {
  const { adminRole, adminUsers } = useApp();
  const podeConfigurar = adminRole === 'superadmin';
  const [d, setD] = useState<EstatisticasCrescimento | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [carregando, setCarregando] = useState(false);
  const carregar = async () => { setCarregando(true); const r = await estatisticasCrescimento(); setD(r.dados); setErro(r.erro); setCarregando(false); };
  useEffect(() => { carregar(); }, []);

  // formulários
  const [fund, setFund] = useState({ status: 'active', limit: 500, beneficios: '' });
  const [mensagem, setMensagem] = useState('');
  const [regras, setRegras] = useState({ daily_valid_cap: 10, return_hours: 12 });
  const [novaRec, setNovaRec] = useState<{ threshold: number; kind: RewardKind; amount: number; badge: string; label: string }>({ threshold: 100, kind: 'vip_days', amount: 180, badge: '', label: '' });
  const [camp, setCamp] = useState({ slug: '', title: '', description: '', ends_at: '' });
  const [pessoa, setPessoa] = useState('');
  const [codigoEmb, setCodigoEmb] = useState('');
  const [beneficio, setBeneficio] = useState<{ tipo: 'vip_days' | 'featured_days'; dias: number }>({ tipo: 'vip_days', dias: 30 });
  useEffect(() => {
    if (!d) return;
    const f = d.settings.founders;
    if (f) setFund({ status: f.status, limit: f.limit, beneficios: (f.benefits ?? []).join('\n') });
    setMensagem(d.settings.share_message?.text ?? '');
    if (d.settings.referral_rules) setRegras(d.settings.referral_rules);
  }, [d]);

  const usuarios = useMemo(() => [...adminUsers].sort((a, b) => a.displayName.localeCompare(b.displayName)), [adminUsers]);
  const executar = async (titulo: string, acao: (j: string) => Promise<string | null>, sucesso: string) => {
    const j = await pedirJustificativa(titulo);
    if (j === null) return;
    const e = await acao(j);
    if (e) notify(e); else { notify(sucesso); carregar(); }
  };

  if (erro) return <p className="p-4 rounded-2xl bg-rose-950/30 border border-rose-900/40 text-sm text-rose-300">Growth Center indisponível: {erro}</p>;
  if (!d) return <div className="vybe-skeleton h-64 rounded-3xl" aria-label="Carregando" />;
  const conversao = d.visits_30d > 0 ? `${((d.signups_ref_30d / d.visits_30d) * 100).toFixed(1).replace('.', ',')}%` : '—';
  const concedidas = Object.values(d.grants_by_kind).reduce((a, b) => a + Number(b), 0);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-black text-white flex items-center gap-2"><Rocket className="w-5 h-5 text-amber-300" /> GROWTH CENTER — Crescimento da Vybelog</h2>
        <button type="button" onClick={carregar} disabled={carregando} className="text-[12px] font-semibold text-zinc-400 hover:text-white flex items-center gap-1 cursor-pointer">
          <RefreshCw className={`w-3.5 h-3.5 ${carregando ? 'animate-spin' : ''}`} /> Atualizar
        </button>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
        <Tile titulo="Usuários" valor={fmt(d.users)} detalhe={`+${fmt(d.new_1d)} hoje · +${fmt(d.new_7d)} na semana · +${fmt(d.new_30d)} no mês`} />
        <Tile titulo="Ativos (7 dias)" valor={fmt(d.active_7d)} detalhe={`${fmt(d.returned)} voltaram depois do 1º dia`} />
        <Tile titulo="Indicações" valor={fmt(d.referrals_total)} detalhe={`${fmt(d.referrals_valid)} válidas · ${fmt(d.referrals_pending)} aguardando · ${fmt(d.referrals_rejected)} recusadas`} />
        <Tile titulo="Conversão de convites" valor={conversao} detalhe={`${fmt(d.signups_ref_30d)} cadastros de ${fmt(d.visits_30d)} visitas (30 dias)`} />
        <Tile titulo="Fundadores" valor={fmt(d.founders)} detalhe={d.settings.founders ? `limite ${fmt(d.settings.founders.limit)} · ${d.settings.founders.status === 'active' ? 'ativa' : d.settings.founders.status === 'paused' ? 'pausada' : 'encerrada'}` : ''} />
        <Tile titulo="Embaixadores" valor={fmt(d.ambassadors)} />
        <Tile titulo="Recompensas concedidas" valor={fmt(concedidas)} detalhe={Object.entries(d.grants_by_kind).map(([k, n]) => `${ROTULO_RECOMPENSA[k as RewardKind] ?? k}: ${n}`).join(' · ')} />
      </div>

      {d.signups_series?.length > 0 && <GraficoCadastros serie={d.signups_series} />}

      <div className="grid lg:grid-cols-2 gap-4">
        <section className="p-4 rounded-2xl bg-[#120d20] border border-purple-900/30">
          <h3 className="text-xs font-bold text-zinc-200 mb-3 flex items-center gap-1.5"><TrendingUp className="w-4 h-4 text-emerald-300" /> Quem mais indica</h3>
          {d.top_referrers.length === 0 ? <p className="text-xs text-zinc-500">Sem indicações ainda.</p> : (
            <table className="w-full text-xs"><thead><tr className="text-zinc-500 text-left"><th className="font-semibold pb-1">Pessoa</th><th className="font-semibold pb-1 text-right">Válidas</th><th className="font-semibold pb-1 text-right">Total</th></tr></thead>
              <tbody>{d.top_referrers.map(r => (
                <tr key={r.id} className="border-t border-zinc-800/60"><td className="py-1.5 text-zinc-200">{r.display_name} <span className="text-zinc-500">@{r.username}</span>{r.ambassador && <Megaphone className="inline w-3 h-3 ml-1 text-fuchsia-300" />}</td>
                  <td className="py-1.5 text-right tabular-nums text-white font-bold">{r.valid}</td><td className="py-1.5 text-right tabular-nums text-zinc-400">{r.total}</td></tr>))}</tbody></table>
          )}
        </section>
        <section className="p-4 rounded-2xl bg-[#120d20] border border-purple-900/30">
          <h3 className="text-xs font-bold text-zinc-200 mb-3 flex items-center gap-1.5"><Megaphone className="w-4 h-4 text-fuchsia-300" /> Embaixadores</h3>
          {d.ambassador_list.length === 0 ? <p className="text-xs text-zinc-500">Nenhum embaixador nomeado.</p> : (
            <table className="w-full text-xs"><thead><tr className="text-zinc-500 text-left"><th className="font-semibold pb-1">Embaixador</th><th className="font-semibold pb-1 text-right">Cadastros</th><th className="font-semibold pb-1 text-right">Válidos</th><th className="font-semibold pb-1 text-right">Ativos</th></tr></thead>
              <tbody>{d.ambassador_list.map(a => (
                <tr key={a.id} className="border-t border-zinc-800/60"><td className="py-1.5 text-zinc-200">{a.display_name}{a.custom_codes && <span className="block text-[10px] text-zinc-500">/convite/{a.custom_codes}</span>}</td>
                  <td className="py-1.5 text-right tabular-nums">{a.total}</td><td className="py-1.5 text-right tabular-nums text-white font-bold">{a.valid}</td><td className="py-1.5 text-right tabular-nums">{a.active}</td></tr>))}</tbody></table>
          )}
        </section>
      </div>

      {/* Campanhas */}
      <section className="p-4 rounded-2xl bg-[#120d20] border border-purple-900/30 space-y-3">
        <h3 className="text-xs font-bold text-zinc-200 flex items-center gap-1.5"><Gift className="w-4 h-4 text-rose-300" /> Campanhas</h3>
        {d.campaigns.length === 0 ? <p className="text-xs text-zinc-500">Nenhuma campanha criada.</p> : (
          <ul className="space-y-2">{d.campaigns.map(c => (
            <li key={c.id} className="p-3 rounded-xl bg-zinc-950/60 border border-zinc-800 flex flex-wrap items-center gap-3 justify-between">
              <span><span className="block text-sm font-bold text-white">{c.title} <span className="text-[10px] text-zinc-500">?campanha={c.slug}</span></span>
                <span className="block text-[12px] text-zinc-400">{c.signups} cadastros · {c.valid} válidos · {c.active ? 'ativa' : 'inativa'}{c.ends_at ? ` · até ${new Date(c.ends_at).toLocaleDateString('pt-BR')}` : ''}</span></span>
              {podeConfigurar && <button type="button" onClick={() => executar(c.active ? 'Desativar campanha' : 'Ativar campanha', j => salvarCampanha({ ...c, active: !c.active }, j), 'Campanha atualizada.')}
                className="px-3 py-1.5 rounded-lg text-[12px] font-bold bg-zinc-800 text-zinc-200 cursor-pointer">{c.active ? 'Desativar' : 'Ativar'}</button>}
            </li>))}</ul>
        )}
        {podeConfigurar && (
          <div className="grid sm:grid-cols-2 gap-2 pt-2 border-t border-zinc-800">
            <input className={campo} placeholder="código (ex.: verao-2027)" value={camp.slug} onChange={e => setCamp({ ...camp, slug: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '') })} />
            <input className={campo} placeholder="Título" value={camp.title} onChange={e => setCamp({ ...camp, title: e.target.value })} />
            <input className={`${campo} sm:col-span-2`} placeholder="Descrição (aparece para quem convida)" value={camp.description} onChange={e => setCamp({ ...camp, description: e.target.value })} />
            <label className="text-[12px] text-zinc-400">Termina em (opcional)<input type="date" className={campo} value={camp.ends_at} onChange={e => setCamp({ ...camp, ends_at: e.target.value })} /></label>
            <button type="button" disabled={camp.slug.length < 3 || camp.title.trim().length < 3}
              onClick={() => executar('Criar campanha', j => salvarCampanha({ slug: camp.slug, title: camp.title, description: camp.description, ends_at: camp.ends_at ? new Date(camp.ends_at + 'T23:59:59').toISOString() : null, active: true }, j), 'Campanha criada.')}
              className="self-end py-2.5 rounded-xl bg-amber-500 text-black text-xs font-bold flex items-center justify-center gap-1.5 disabled:opacity-40 cursor-pointer"><Plus className="w-4 h-4" /> Criar campanha</button>
          </div>
        )}
      </section>

      {podeConfigurar && (
        <div className="grid lg:grid-cols-2 gap-4">
          {/* Fundadores */}
          <section className="p-4 rounded-2xl bg-[#120d20] border border-amber-900/30 space-y-2">
            <h3 className="text-xs font-bold text-zinc-200 flex items-center gap-1.5"><Crown className="w-4 h-4 text-amber-300" /> Campanha Fundadores</h3>
            <div className="grid grid-cols-2 gap-2">
              <Seletor value={fund.status} onChange={e => setFund({ ...fund, status: e.target.value })} aria-label="Situação da campanha" className={campo}>
                <option value="active">Ativa</option><option value="paused">Pausada</option><option value="ended">Encerrada</option>
              </Seletor>
              <input type="number" min={1} className={campo} value={fund.limit} onChange={e => setFund({ ...fund, limit: Number(e.target.value) })} aria-label="Limite de vagas" />
            </div>
            <textarea rows={4} className={campo} value={fund.beneficios} onChange={e => setFund({ ...fund, beneficios: e.target.value })} aria-label="Benefícios (um por linha)" placeholder="Um benefício por linha (só o que for real)" />
            <button type="button" onClick={() => executar('Salvar campanha Fundadores', j => salvarConfiguracao('founders', { status: fund.status, limit: fund.limit, benefits: fund.beneficios.split('\n').map(x => x.trim()).filter(Boolean) }, j), 'Campanha Fundadores salva.')}
              className="w-full py-2.5 rounded-xl bg-amber-500 text-black text-xs font-bold cursor-pointer">Salvar</button>
          </section>

          {/* Mensagem e regras */}
          <section className="p-4 rounded-2xl bg-[#120d20] border border-purple-900/30 space-y-2">
            <h3 className="text-xs font-bold text-zinc-200">Mensagem do WhatsApp e regras antifraude</h3>
            <textarea rows={4} className={campo} value={mensagem} onChange={e => setMensagem(e.target.value)} aria-label="Mensagem padrão de convite" />
            <p className="text-[10px] text-zinc-500">Use {'{link}'} onde o link do convite deve aparecer.</p>
            <button type="button" onClick={() => executar('Salvar mensagem de convite', j => salvarConfiguracao('share_message', { text: mensagem }, j), 'Mensagem salva.')}
              className="w-full py-2 rounded-xl bg-zinc-800 text-white text-xs font-bold cursor-pointer">Salvar mensagem</button>
            <div className="grid grid-cols-2 gap-2 pt-2">
              <label className="text-[12px] text-zinc-400">Validações por dia (por pessoa)<input type="number" min={1} max={100} className={campo} value={regras.daily_valid_cap} onChange={e => setRegras({ ...regras, daily_valid_cap: Number(e.target.value) })} /></label>
              <label className="text-[12px] text-zinc-400">Horas até o retorno<input type="number" min={0} max={168} className={campo} value={regras.return_hours} onChange={e => setRegras({ ...regras, return_hours: Number(e.target.value) })} /></label>
            </div>
            <button type="button" onClick={() => executar('Salvar regras antifraude', j => salvarConfiguracao('referral_rules', regras, j), 'Regras salvas.')}
              className="w-full py-2 rounded-xl bg-zinc-800 text-white text-xs font-bold cursor-pointer">Salvar regras</button>
          </section>

          {/* Recompensas */}
          <section className="p-4 rounded-2xl bg-[#120d20] border border-purple-900/30 space-y-2 lg:col-span-2">
            <h3 className="text-xs font-bold text-zinc-200 flex items-center gap-1.5"><Award className="w-4 h-4 text-amber-300" /> Recompensas por indicações válidas</h3>
            <ul className="space-y-1.5">
              {d.rewards.map(r => (
                <li key={r.id} className="flex flex-wrap items-center gap-2 p-2.5 rounded-xl bg-zinc-950/60 border border-zinc-800 text-xs">
                  <span className="w-10 text-center font-black text-white">{r.threshold}</span>
                  <span className="flex-1 text-zinc-200">{r.label} <span className="text-zinc-500">({ROTULO_RECOMPENSA[r.kind]}{r.amount ? `: ${r.amount}` : ''})</span></span>
                  <button type="button" onClick={() => executar(r.active ? 'Desativar recompensa' : 'Ativar recompensa', j => salvarRecompensa({ ...r, badge: r.badge, active: !r.active }, j), 'Recompensa atualizada.')}
                    className={`px-2.5 py-1 rounded-lg text-[12px] font-bold cursor-pointer ${r.active ? 'bg-emerald-950 text-emerald-300' : 'bg-zinc-800 text-zinc-400'}`}>{r.active ? 'Ativa' : 'Inativa'}</button>
                </li>
              ))}
            </ul>
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 pt-2 border-t border-zinc-800">
              <input type="number" min={1} className={campo} value={novaRec.threshold} onChange={e => setNovaRec({ ...novaRec, threshold: Number(e.target.value) })} aria-label="Indicações necessárias" />
              <Seletor value={novaRec.kind} onChange={e => setNovaRec({ ...novaRec, kind: e.target.value as RewardKind })} aria-label="Tipo de recompensa" className={campo}>
                <option value="vip_days">VIP (dias)</option><option value="featured_days">Destaque (dias)</option><option value="badge">Selo</option>
              </Seletor>
              {novaRec.kind === 'badge'
                ? <input className={campo} placeholder="código do selo" value={novaRec.badge} onChange={e => setNovaRec({ ...novaRec, badge: e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, '') })} />
                : <input type="number" min={1} className={campo} value={novaRec.amount} onChange={e => setNovaRec({ ...novaRec, amount: Number(e.target.value) })} aria-label="Dias" />}
              <input className={campo} placeholder="Nome exibido" value={novaRec.label} onChange={e => setNovaRec({ ...novaRec, label: e.target.value })} />
              <button type="button" disabled={novaRec.label.trim().length < 3}
                onClick={() => executar('Criar recompensa', j => salvarRecompensa({ ...novaRec, active: true }, j), 'Recompensa criada.')}
                className="py-2 rounded-xl bg-amber-500 text-black text-xs font-bold disabled:opacity-40 cursor-pointer">Adicionar</button>
            </div>
          </section>

          {/* Embaixadores e benefícios */}
          <section className="p-4 rounded-2xl bg-[#120d20] border border-fuchsia-900/30 space-y-2 lg:col-span-2">
            <h3 className="text-xs font-bold text-zinc-200 flex items-center gap-1.5"><Megaphone className="w-4 h-4 text-fuchsia-300" /> Embaixadores e benefícios</h3>
            <Seletor value={pessoa} onChange={e => setPessoa(e.target.value)} aria-label="Escolha a pessoa" className={campo}>
              <option value="">Escolha a pessoa…</option>
              {usuarios.map(u => <option key={u.id} value={u.id}>{u.displayName} (@{u.username})</option>)}
            </Seletor>
            <div className="grid sm:grid-cols-3 gap-2">
              <input className={campo} placeholder="link personalizado (opcional)" value={codigoEmb} onChange={e => setCodigoEmb(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))} />
              <button type="button" disabled={!pessoa} onClick={() => executar('Nomear embaixador', j => definirEmbaixador(pessoa, true, codigoEmb, j), 'Embaixador nomeado.')}
                className="py-2 rounded-xl bg-fuchsia-600 text-white text-xs font-bold disabled:opacity-40 cursor-pointer">Nomear embaixador</button>
              <button type="button" disabled={!pessoa} onClick={() => executar('Remover embaixador', j => definirEmbaixador(pessoa, false, '', j), 'Embaixador removido.')}
                className="py-2 rounded-xl bg-zinc-800 text-zinc-200 text-xs font-bold disabled:opacity-40 cursor-pointer">Remover embaixador</button>
            </div>
            <div className="grid sm:grid-cols-3 gap-2">
              <Seletor value={beneficio.tipo} onChange={e => setBeneficio({ ...beneficio, tipo: e.target.value as 'vip_days' | 'featured_days' })} aria-label="Benefício" className={campo}>
                <option value="vip_days">VIP</option><option value="featured_days">Perfil em destaque</option>
              </Seletor>
              <input type="number" min={1} max={3650} className={campo} value={beneficio.dias} onChange={e => setBeneficio({ ...beneficio, dias: Number(e.target.value) })} aria-label="Dias" />
              <button type="button" disabled={!pessoa} onClick={() => executar('Conceder benefício', j => concederBeneficio(pessoa, beneficio.tipo, beneficio.dias, beneficio.tipo === 'vip_days' ? `${beneficio.dias} dias de VIP` : `Destaque por ${beneficio.dias} dias`, j), 'Benefício concedido.')}
                className="py-2 rounded-xl bg-amber-500 text-black text-xs font-bold disabled:opacity-40 cursor-pointer">Conceder benefício</button>
            </div>
          </section>
        </div>
      )}

      {/* Indicações recentes */}
      <section className="p-4 rounded-2xl bg-[#120d20] border border-purple-900/30">
        <h3 className="text-xs font-bold text-zinc-200 mb-3">Indicações recentes</h3>
        {d.recent_referrals.length === 0 ? <p className="text-xs text-zinc-500">Nenhuma indicação ainda.</p> : (
          <ul className="divide-y divide-zinc-800/60">{d.recent_referrals.map(r => (
            <li key={r.referred_id} className="py-2 flex flex-wrap items-center gap-2 justify-between text-xs">
              <span className="text-zinc-200">{r.referred_name} <span className="text-zinc-500">@{r.referred_username}</span> <span className="text-zinc-500">← {r.referrer_name ?? 'conta removida'}</span></span>
              <span className="flex items-center gap-2">
                <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${r.status === 'valid' ? 'bg-emerald-950 text-emerald-300' : r.status === 'pending' ? 'bg-amber-950 text-amber-300' : 'bg-zinc-800 text-zinc-400'}`}>
                  {r.status === 'valid' ? 'Válida' : r.status === 'pending' ? 'Aguardando' : 'Recusada'}</span>
                {podeConfigurar && r.status !== 'rejected' && (
                  <button type="button" onClick={() => executar('Recusar indicação (suspeita de fraude)', j => recusarIndicacao(r.referred_id, j), 'Indicação recusada.')}
                    className="text-[12px] font-semibold text-rose-300 cursor-pointer">Recusar</button>)}
              </span>
            </li>))}</ul>
        )}
      </section>
    </div>
  );
};
