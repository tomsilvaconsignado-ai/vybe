// "Convide e Ganhe": link pessoal, compartilhamento, progresso, recompensas, convidados, ranking e histórico.
import React, { useEffect, useMemo, useState } from 'react';
import { Award, CheckCircle2, Clock, Crown, Gift, Info, Megaphone, MousePointerClick, Trophy, UserPlus, Users, XCircle } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { definirVisibilidadeRanking, infoPublica, meuPainel, ranking, type InfoPublica, type PainelConvite, type PosicaoRanking } from '../../lib/crescimento';
import { linkDeConvite } from '../../lib/convite';
import { CompartilharConvite } from './CompartilharConvite';
import { notify } from '../common/Feedback';
import { Seletor } from '../common/Seletor';

const fmtData = (iso: string) => new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });
const STATUS = {
  valid: { rotulo: 'Confirmada', cor: 'text-emerald-300 bg-emerald-950/60', icone: <CheckCircle2 className="w-3 h-3" /> },
  pending: { rotulo: 'Aguardando', cor: 'text-amber-300 bg-amber-950/60', icone: <Clock className="w-3 h-3" /> },
  rejected: { rotulo: 'Não contabilizada', cor: 'text-zinc-400 bg-zinc-800', icone: <XCircle className="w-3 h-3" /> },
} as const;

const Numero: React.FC<{ rotulo: string; valor: number; icone: React.ReactNode; destaque?: boolean }> = ({ rotulo, valor, icone, destaque }) => (
  <div className={`p-3.5 rounded-2xl border ${destaque ? 'bg-gradient-to-br from-purple-900/40 to-rose-900/30 border-purple-600/40' : 'bg-[#120d20] border-purple-900/30'}`}>
    <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-zinc-400">{icone}{rotulo}</div>
    <p className="text-2xl font-black text-white tabular-nums mt-1">{valor.toLocaleString('pt-BR')}</p>
  </div>
);

export const ConvideView: React.FC = () => {
  const { currentUser, setActiveTab } = useApp();
  const [painel, setPainel] = useState<PainelConvite | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [info, setInfo] = useState<InfoPublica | null>(null);
  const [campanha, setCampanha] = useState<string>('');
  const [aba, setAba] = useState<'30d' | 'all' | 'embaixadores'>('30d');
  const [lista, setLista] = useState<PosicaoRanking[]>([]);

  const carregar = async () => { setPainel(await meuPainel()); setCarregando(false); };
  useEffect(() => { carregar(); infoPublica().then(setInfo); }, []);
  useEffect(() => { ranking(aba === 'all' ? 'all' : '30d', aba === 'embaixadores').then(setLista); }, [aba, painel?.show_in_ranking]);

  const link = painel ? linkDeConvite(window.location.origin, painel.code, campanha || null) : '';
  const proxima = useMemo(() => painel?.rewards.find(r => !r.achieved) ?? null, [painel]);
  const anterior = useMemo(() => [...(painel?.rewards ?? [])].reverse().find(r => r.achieved)?.threshold ?? 0, [painel]);

  if (carregando) return <div className="max-w-3xl mx-auto p-6"><div className="vybe-skeleton h-64 rounded-3xl" /></div>;
  if (!painel) return <p className="p-10 text-center text-sm text-zinc-400">Não foi possível carregar seus convites agora. Tente novamente em instantes.</p>;

  const progresso = proxima ? Math.min(100, ((painel.valid - anterior) / Math.max(1, proxima.threshold - anterior)) * 100) : 100;
  const horas = painel.rules?.return_hours ?? 12;

  return (
    <div className="max-w-3xl mx-auto py-6 px-4 space-y-6">
      <header>
        <h1 className="text-2xl font-extrabold text-white flex items-center gap-2"><Gift className="w-6 h-6 text-fuchsia-400" /> Convide e Ganhe</h1>
        <p className="text-xs text-zinc-400 mt-1 max-w-xl">Traga pessoas e casais que combinam com o Vybelog. Cada indicação confirmada aproxima você da próxima recompensa.</p>
      </header>

      {/* Link e compartilhamento */}
      <section className="p-5 rounded-3xl bg-[#120d20] border border-purple-900/30 space-y-3">
        <h2 className="text-sm font-bold text-white flex items-center gap-2"><UserPlus className="w-4 h-4 text-fuchsia-400" /> Seu link de convite</h2>
        {info && info.campaigns.length > 0 && (
          <label className="block">
            <span className="block text-[11px] font-bold text-zinc-400 mb-1">Divulgar com uma campanha (opcional)</span>
            <Seletor value={campanha} onChange={e => setCampanha(e.target.value)} aria-label="Campanha" className="w-full px-3 py-2 rounded-xl bg-zinc-950 border border-purple-900/40 text-xs text-zinc-200">
              <option value="">Sem campanha</option>
              {info.campaigns.map(c => <option key={c.slug} value={c.slug}>{c.title}</option>)}
            </Seletor>
          </label>
        )}
        <CompartilharConvite link={link} modelo={painel.share_message} />
      </section>

      {/* Números */}
      <section className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Numero rotulo="Visitas ao link" valor={painel.visits} icone={<MousePointerClick className="w-3.5 h-3.5" />} />
        <Numero rotulo="Cadastros" valor={painel.signups} icone={<Users className="w-3.5 h-3.5" />} />
        <Numero rotulo="Confirmadas" valor={painel.valid} icone={<CheckCircle2 className="w-3.5 h-3.5" />} destaque />
        <Numero rotulo="Aguardando" valor={painel.pending} icone={<Clock className="w-3.5 h-3.5" />} />
      </section>

      {/* Progresso e recompensas */}
      <section className="p-5 rounded-3xl bg-[#120d20] border border-purple-900/30 space-y-4">
        <h2 className="text-sm font-bold text-white flex items-center gap-2"><Award className="w-4 h-4 text-amber-300" /> Recompensas</h2>
        {proxima ? (
          <div>
            <div className="flex justify-between text-xs mb-1.5">
              <span className="text-zinc-300">Próxima: <strong className="text-white">{proxima.label}</strong></span>
              <span className="text-zinc-400 tabular-nums">{painel.valid}/{proxima.threshold}</span>
            </div>
            <div className="h-2.5 rounded-full bg-zinc-800 overflow-hidden" role="progressbar" aria-valuenow={painel.valid} aria-valuemax={proxima.threshold}>
              <div className="h-full rounded-full bg-gradient-to-r from-fuchsia-500 via-pink-500 to-orange-500 transition-all" style={{ width: `${progresso}%` }} />
            </div>
            <p className="text-[11px] text-zinc-500 mt-1.5">Faltam {proxima.threshold - painel.valid} {proxima.threshold - painel.valid === 1 ? 'indicação confirmada' : 'indicações confirmadas'}.</p>
          </div>
        ) : painel.rewards.length > 0 && <p className="text-xs text-emerald-300">Você conquistou todas as recompensas disponíveis. Obrigado!</p>}
        <ol className="space-y-2">
          {painel.rewards.map(r => (
            <li key={r.id} className={`flex items-center gap-3 p-3 rounded-2xl border ${r.achieved ? 'border-emerald-700/40 bg-emerald-950/20' : 'border-zinc-800 bg-zinc-950/40'}`}>
              <span className={`w-10 h-10 shrink-0 rounded-full flex items-center justify-center text-sm font-black ${r.achieved ? 'bg-emerald-500 text-black' : 'bg-zinc-800 text-zinc-300'}`}>{r.threshold}</span>
              <span className="flex-1 text-sm text-zinc-200">{r.label}</span>
              {r.achieved ? <CheckCircle2 className="w-5 h-5 text-emerald-400" aria-label="Conquistada" /> : <span className="text-[11px] text-zinc-500">{r.threshold} indicações</span>}
            </li>
          ))}
        </ol>
        <details className="text-xs text-zinc-400">
          <summary className="cursor-pointer font-semibold text-zinc-300 flex items-center gap-1.5"><Info className="w-3.5 h-3.5" /> Quando uma indicação é confirmada?</summary>
          <ul className="mt-2 space-y-1 list-disc pl-5">
            <li>A pessoa se cadastra pelo seu link e confirma o e-mail.</li>
            <li>Coloca uma foto no perfil.</li>
            <li>Volta a usar o Vybelog pelo menos {horas} horas depois do cadastro.</li>
            <li>A conta continua ativa (sem suspensão).</li>
          </ul>
          <p className="mt-2">Cada pessoa conta uma única vez, e cada recompensa é concedida uma vez. Para evitar abusos, no máximo {painel.rules?.daily_valid_cap ?? 10} indicações são confirmadas por dia (as demais seguem para os dias seguintes).</p>
        </details>
      </section>

      {/* Fundador / Embaixador */}
      {(painel.founder_number || (info?.founders?.status === 'active')) && (
        <button type="button" onClick={() => setActiveTab('founders')} className="w-full text-left p-4 rounded-3xl bg-gradient-to-r from-amber-900/30 to-purple-900/30 border border-amber-600/30 flex items-center gap-3 cursor-pointer">
          <Crown className="w-8 h-8 text-amber-300 shrink-0" />
          <span className="flex-1">
            <span className="block text-sm font-bold text-white">{painel.founder_number ? (currentUser.growth?.hasPhoto ? `Você é o Membro Fundador nº ${painel.founder_number}` : `Fundador nº ${painel.founder_number} reservado: coloque uma foto para ativar o selo`) : 'Campanha Vybelog Fundadores'}</span>
            <span className="block text-xs text-zinc-400">{info?.founders?.status === 'active' ? `${info.founders.remaining} vagas restantes · convide agora para garantir o selo a quem você ama` : 'Conheça a campanha'}</span>
          </span>
        </button>
      )}
      {painel.ambassador && (
        <section className="p-5 rounded-3xl bg-gradient-to-br from-fuchsia-950/40 to-purple-950/40 border border-fuchsia-700/40">
          <h2 className="text-sm font-bold text-white flex items-center gap-2"><Megaphone className="w-4 h-4 text-fuchsia-300" /> Painel do Embaixador</h2>
          <div className="grid grid-cols-3 gap-3 mt-3">
            <Numero rotulo="Cadastros gerados" valor={painel.signups} icone={<Users className="w-3.5 h-3.5" />} />
            <Numero rotulo="Confirmados" valor={painel.valid} icone={<CheckCircle2 className="w-3.5 h-3.5" />} />
            <Numero rotulo="Ativos (7 dias)" valor={painel.active_referred} icone={<Clock className="w-3.5 h-3.5" />} />
          </div>
        </section>
      )}

      {/* Convidados */}
      <section className="p-5 rounded-3xl bg-[#120d20] border border-purple-900/30">
        <h2 className="text-sm font-bold text-white mb-3">Quem entrou pelo seu convite</h2>
        {painel.referrals.length === 0 ? (
          <p className="text-xs text-zinc-500">Ainda ninguém. Que tal mandar o link para aquele casal que combina com o Vybelog?</p>
        ) : (
          <ul className="divide-y divide-purple-950/40">
            {painel.referrals.map((r, i) => (
              <li key={i} className="py-2.5 flex items-center gap-3">
                <img src={r.avatar_url || '/icons/icon-192.png?v=3'} alt="" className="w-9 h-9 rounded-full object-cover bg-zinc-800" />
                <span className="flex-1 min-w-0">
                  <span className="block text-xs font-bold text-zinc-100 truncate">{r.display_name}</span>
                  <span className="block text-[11px] text-zinc-500">desde {fmtData(r.created_at)}</span>
                </span>
                <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold ${STATUS[r.status].cor}`}>{STATUS[r.status].icone}{STATUS[r.status].rotulo}</span>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Ranking */}
      <section className="p-5 rounded-3xl bg-[#120d20] border border-purple-900/30">
        <div className="flex items-center justify-between gap-2 mb-3 flex-wrap">
          <h2 className="text-sm font-bold text-white flex items-center gap-2"><Trophy className="w-4 h-4 text-amber-300" /> Ranking de indicações</h2>
          <div className="flex bg-zinc-900 rounded-full p-0.5 text-[11px] font-bold">
            {([['30d', '30 dias'], ['all', 'Geral'], ['embaixadores', 'Embaixadores']] as const).map(([id, r]) => (
              <button key={id} type="button" onClick={() => setAba(id)} aria-pressed={aba === id}
                className={`px-3 py-1 rounded-full cursor-pointer ${aba === id ? 'bg-purple-600 text-white' : 'text-zinc-400'}`}>{r}</button>
            ))}
          </div>
        </div>
        {lista.length === 0 ? <p className="text-xs text-zinc-500">O ranking começa com as primeiras indicações confirmadas.</p> : (
          <ol className="space-y-1.5">
            {lista.map(p => (
              <li key={p.user_id} className={`flex items-center gap-3 p-2 rounded-xl ${p.user_id === currentUser.id ? 'bg-purple-900/30' : ''}`}>
                <span className={`w-7 text-center text-sm font-black ${p.pos <= 3 ? 'text-amber-300' : 'text-zinc-500'}`}>{p.pos}º</span>
                <img src={p.avatar_url || '/icons/icon-192.png?v=3'} alt="" className="w-8 h-8 rounded-full object-cover bg-zinc-800" />
                <span className="flex-1 min-w-0 text-xs font-bold text-zinc-100 truncate">{p.display_name}{p.ambassador && <Megaphone className="inline w-3 h-3 ml-1 text-fuchsia-300" aria-label="Embaixador" />}</span>
                <span className="text-xs text-zinc-300 tabular-nums">{p.valid_count}</span>
              </li>
            ))}
          </ol>
        )}
        <label className="mt-3 flex items-center gap-2 text-[11px] text-zinc-400 cursor-pointer">
          <input type="checkbox" checked={painel.show_in_ranking} className="accent-fuchsia-500"
            onChange={async e => { const v = e.target.checked; const err = await definirVisibilidadeRanking(v); if (err) notify('Não foi possível salvar.'); else setPainel({ ...painel, show_in_ranking: v }); }} />
          Aparecer no ranking (só nome e foto; você pode sair quando quiser)
        </label>
        {painel.rank_30d && <p className="text-[11px] text-zinc-500 mt-1">Sua posição nos últimos 30 dias: {painel.rank_30d}º</p>}
      </section>

      {/* Histórico */}
      {painel.grants.length > 0 && (
        <section className="p-5 rounded-3xl bg-[#120d20] border border-purple-900/30">
          <h2 className="text-sm font-bold text-white mb-3">Histórico de benefícios</h2>
          <ul className="space-y-2">
            {painel.grants.map((g, i) => (
              <li key={i} className="flex items-center justify-between gap-3 text-xs">
                <span className="text-zinc-200">{g.label}</span>
                <span className="text-zinc-500 tabular-nums text-right">{fmtData(g.granted_at)}{g.expires_at ? ` · até ${fmtData(g.expires_at)}` : ''}</span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
};
