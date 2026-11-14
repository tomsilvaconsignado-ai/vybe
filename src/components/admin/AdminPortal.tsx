import React, { useEffect, useState } from 'react';
import { useApp } from '../../context/AppContext';
import { AdminMfaGate } from './AdminMfaGate';
import { AdminEventsTab } from './AdminEventsTab';
import { AdminAdsTab } from './AdminAdsTab';
import { AdminIndicadores } from './AdminIndicadores';
import { AdminComunicadosTab } from './AdminComunicadosTab';
import { AdminCrescimentoTab } from './AdminCrescimentoTab';
import { AdminConversationsTab } from './AdminConversationsTab';
import { AdminImageViewerHost, AdminThumb } from './AdminImageViewer';
import {
  ShieldCheck,
  Users,
  AlertTriangle,
  Image,
  FileText,
  Lock,
  Search,
  CheckCircle2,
  XCircle,
  Activity,
  ShieldAlert,
  Sliders,
  Eye,
  KeyRound,
  Filter,
  Check,
  Trash2,
  Download,
  AlertCircle,
  MessageSquare,
  Clock,
  UserCheck,
  Copy,
  ExternalLink,
  Terminal,
  FolderDown,
  CalendarHeart,
  Megaphone, Rocket,
  MessagesSquare,
  RefreshCw,
  ArrowLeft,
  Send,
  ChevronRight,
  Inbox
} from 'lucide-react';
import { ALVO_DENUNCIA, CATEGORIA_DENUNCIA, PAPEL_ADMIN, PESO_PRIORIDADE, PRIORIDADE, SITUACAO_CONTA, SITUACAO_DENUNCIA, SITUACAO_MIDIA, TIPO_PERFIL, TOM, acaoLegivel } from '../../lib/adminRotulos';
import { ModerationReport, AdminUserRecord, AdminMediaRecord } from '../../types';
import { AdminUserDetailModal } from './AdminUserDetailModal';
import { AdminMessageInvestigationModal } from './AdminMessageInvestigationModal';
import { notify, askText } from '../common/Feedback';
import { useEstadoSalvo } from '../../lib/estadoSalvo';
import { Seletor } from '../common/Seletor';

export const AdminPortal: React.FC = () => {
  const {
    currentUser,
    adminUsers,
    adminMediaList,
    reports,
    adminLogs,
    adminRole,
    refreshAdminData,
    setIsAdminMode,
    adminResolveReport,
    adminModerateMedia,
    adminMfaVerified
  } = useApp();

  const [activeAdminTab, setActiveAdminTab] = useEstadoSalvo<'dashboard' | 'users' | 'reports' | 'media' | 'conversations' | 'events' | 'ads' | 'broadcasts' | 'growth' | 'audit'>('admin.aba', 'dashboard');

  // Modals state
  const [inspectingUser, setInspectingUser] = useState<AdminUserRecord | null>(null);
  const [investigatingReport, setInvestigatingReport] = useState<ModerationReport | null>(null);

  // Filters state
  const [searchUserQuery, setSearchUserQuery] = useState('');
  const [userStatusFilter, setUserStatusFilter] = useEstadoSalvo<'all' | 'active' | 'warned' | 'restricted' | 'suspended'>('admin.usuarios.situacao', 'all');
  const [mediaStatusFilter, setMediaStatusFilter] = useEstadoSalvo<'all' | 'approved' | 'pending_review' | 'flagged' | 'removed'>('admin.midia.situacao', 'all');
  const [reportPriorityFilter, setReportPriorityFilter] = useEstadoSalvo<'all' | 'urgent' | 'high' | 'medium' | 'low'>('admin.denuncias.prioridade', 'all');
  const [reportStatusFilter, setReportStatusFilter] = useEstadoSalvo<'open' | 'closed' | 'all'>('admin.denuncias.situacao', 'open');
  const [auditQuery, setAuditQuery] = useState('');
  const [atualizando, setAtualizando] = useState(false);
  const [selectedReport, setSelectedReport] = useState<ModerationReport | null>(null);
  useEffect(() => {
    setSelectedReport(prev => (prev ? reports.find(r => r.id === prev.id) ?? null : reports.find(r => r.status === 'pending') ?? null));
  }, [reports]);
  const [copiedText, setCopiedText] = useState<string | null>(null);

  const handleCopy = (text: string) => {
    navigator.clipboard?.writeText(text);
    setCopiedText(text);
    setTimeout(() => setCopiedText(null), 2500);
  };
  const [resolutionNote, setResolutionNote] = useState('');

  // KPIs Calculations
  const warnedAccounts = adminUsers.filter(u => u.status === 'warned').length;
  const restrictedAccounts = adminUsers.filter(u => u.status === 'restricted').length;
  const suspendedAccounts = adminUsers.filter(u => u.status === 'suspended').length;
  const verifiedProfiles = adminUsers.filter(u => u.isVerified).length;
  const pendingReports = reports.filter(r => r.status === 'pending' || r.status === 'under_review');
  const urgentPending = pendingReports.filter(r => r.priority === 'urgent');
  const flaggedMediaCount = adminMediaList.filter(m => m.status === 'flagged').length;

  if (!adminMfaVerified) {
    return <AdminMfaGate />;
  }

  type Aba = typeof activeAdminTab;
  const abas: { id: Aba; label: string; icon: React.ComponentType<{ className?: string }>; contador?: number }[] = [
    { id: 'dashboard', label: 'Visão geral', icon: Activity },
    { id: 'reports', label: 'Denúncias', icon: ShieldAlert, contador: pendingReports.length },
    { id: 'users', label: 'Usuários', icon: Users },
    { id: 'media', label: 'Mídias', icon: Image, contador: flaggedMediaCount },
    { id: 'events', label: 'Eventos', icon: CalendarHeart },
    { id: 'ads', label: 'Publicidade', icon: Megaphone },
    { id: 'broadcasts', label: 'Comunicados', icon: Send },
    { id: 'growth', label: 'Crescimento', icon: Rocket },
    ...(adminRole === 'superadmin' ? [{ id: 'conversations' as Aba, label: 'Conversas', icon: MessagesSquare }] : []),
    { id: 'audit', label: 'Auditoria', icon: FileText },
  ];
  // atalhos da visão geral: abrem a aba já filtrada
  const irPara = (aba: Aba, filtro?: () => void) => { filtro?.(); setActiveAdminTab(aba); window.scrollTo({ top: 0 }); };

  // Usuários: situação + busca por nome, @, e-mail ou cidade
  const filteredUsers = adminUsers.filter(u => {
    if (userStatusFilter !== 'all' && u.status !== userStatusFilter) return false;
    if (searchUserQuery.trim()) {
      const q = searchUserQuery.trim().toLowerCase().replace(/^@/, '');
      return u.username.toLowerCase().includes(q) || u.displayName.toLowerCase().includes(q) || u.email.toLowerCase().includes(q) || (u.city ?? '').toLowerCase().includes(q);
    }
    return true;
  });

  const filteredMedia = adminMediaList.filter(m => mediaStatusFilter === 'all' || m.status === mediaStatusFilter);

  // Denúncias: situação e prioridade; urgentes primeiro, depois as mais antigas da fila
  const abertas = (r: ModerationReport) => r.status === 'pending' || r.status === 'under_review';
  const filteredReports = reports
    .filter(r => reportStatusFilter === 'all' || (reportStatusFilter === 'open' ? abertas(r) : !abertas(r)))
    .filter(r => reportPriorityFilter === 'all' || r.priority === reportPriorityFilter)
    .sort((a, b) => (abertas(a) === abertas(b) ? PESO_PRIORIDADE[a.priority] - PESO_PRIORIDADE[b.priority] : abertas(a) ? -1 : 1));

  const filteredLogs = auditQuery.trim()
    ? adminLogs.filter(l => [l.action, l.adminName, l.reason, l.targetType, l.targetId].some(c => (c ?? '').toLowerCase().includes(auditQuery.trim().toLowerCase())))
    : adminLogs;

  return (
    <div className="max-w-7xl mx-auto py-6 px-4">
      <AdminImageViewerHost />

      {/* Cabeçalho: quem está na sessão, papel e atalhos */}
      <header className="bg-gradient-to-r from-amber-950/50 via-zinc-900 to-purple-950/50 border border-amber-600/30 rounded-3xl p-4 sm:p-5 mb-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-11 h-11 rounded-2xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-400 shrink-0">
            <ShieldCheck className="w-6 h-6" />
          </div>
          <div className="min-w-0">
            <h1 className="text-lg font-black text-white leading-tight">Painel administrativo</h1>
            <p className="text-xs text-zinc-400 flex items-center gap-2 flex-wrap">
              <span className="font-semibold text-amber-300">{PAPEL_ADMIN[adminRole]}</span>
              <span className="text-emerald-400 font-semibold inline-flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" aria-hidden="true" /> Verificação em duas etapas ativa
              </span>
              <span className="truncate">{currentUser.email}</span>
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 self-stretch sm:self-auto">
          <button
            type="button"
            onClick={async () => { setAtualizando(true); await refreshAdminData(); setAtualizando(false); notify('Dados do painel atualizados.'); }}
            disabled={atualizando}
            className="flex-1 sm:flex-none px-3 py-2 rounded-xl bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-xs font-semibold text-zinc-200 cursor-pointer inline-flex items-center justify-center gap-1.5 disabled:opacity-60"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${atualizando ? 'animate-spin' : ''}`} /> {atualizando ? 'Atualizando...' : 'Atualizar'}
          </button>
          <button
            type="button"
            onClick={() => setIsAdminMode(false)}
            className="flex-1 sm:flex-none px-4 py-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-xs font-bold text-white transition-colors cursor-pointer inline-flex items-center justify-center gap-1.5"
          >
            <ArrowLeft className="w-3.5 h-3.5" /> Voltar ao app
          </button>
        </div>
      </header>

      {/* Abas: nomes curtos, contador de pendências em destaque; no celular rola de lado */}
      <nav aria-label="Seções do painel" className="mb-5 pb-2 border-b border-zinc-800/60">
        <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar lg:flex-wrap">
          {abas.map(t => {
            const Icon = t.icon;
            const isActive = activeAdminTab === t.id;
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => setActiveAdminTab(t.id)}
                aria-current={isActive ? 'page' : undefined}
                className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-colors flex items-center gap-1.5 shrink-0 cursor-pointer ${
                  isActive ? 'bg-amber-400 text-black' : 'text-zinc-300 hover:text-white hover:bg-zinc-800/80'
                }`}
              >
                <Icon className="w-4 h-4" />
                <span>{t.label}</span>
                {!!t.contador && (
                  <span className={`min-w-5 px-1.5 py-0.5 rounded-full text-[10px] leading-none tabular-nums ${isActive ? 'bg-black/80 text-amber-300' : 'bg-rose-600 text-white'}`}>
                    {t.contador}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </nav>

      {/* ==================== TAB 1: DASHBOARD & METRICS ==================== */}
      {activeAdminTab === 'dashboard' && (
        <div className="space-y-6">
          {/* Urgências primeiro */}
          {urgentPending.length > 0 && (
            <div className="p-4 rounded-3xl bg-rose-950/40 border border-rose-700/60 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3" role="alert">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-rose-600/30 text-rose-300 flex items-center justify-center shrink-0">
                  <AlertTriangle className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-sm font-bold text-white">
                    {urgentPending.length === 1 ? '1 denúncia urgente aguardando ação' : `${urgentPending.length} denúncias urgentes aguardando ação`}
                  </h2>
                  <p className="text-xs text-rose-200">Suspeita de menor de idade e conteúdo íntimo sem consentimento têm prioridade de atendimento.</p>
                </div>
              </div>
              <button type="button" onClick={() => irPara('reports', () => { setReportStatusFilter('open'); setReportPriorityFilter('urgent'); })}
                className="w-full sm:w-auto px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs shrink-0 cursor-pointer">
                Atender agora
              </button>
            </div>
          )}

          {/* Pendências de moderação: cada número abre a aba já filtrada */}
          <section aria-label="Pendências de moderação" className="space-y-3">
            <h2 className="text-sm font-bold text-white">Pendências de moderação</h2>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              {[
                { titulo: 'Denúncias abertas', valor: pendingReports.length, detalhe: urgentPending.length ? `${urgentPending.length} urgente${urgentPending.length > 1 ? 's' : ''}` : 'nenhuma urgente', tom: pendingReports.length ? 'text-amber-300' : 'text-white',
                  abrir: () => irPara('reports', () => { setReportStatusFilter('open'); setReportPriorityFilter('all'); }) },
                { titulo: 'Mídias sinalizadas', valor: flaggedMediaCount, detalhe: 'aguardando decisão', tom: flaggedMediaCount ? 'text-amber-300' : 'text-white',
                  abrir: () => irPara('media', () => setMediaStatusFilter('flagged')) },
                { titulo: 'Contas advertidas ou restritas', valor: restrictedAccounts + warnedAccounts, detalhe: `${warnedAccounts} advertida${warnedAccounts === 1 ? '' : 's'} · ${restrictedAccounts} restrita${restrictedAccounts === 1 ? '' : 's'}`, tom: 'text-white',
                  abrir: () => irPara('users', () => setUserStatusFilter(restrictedAccounts ? 'restricted' : 'warned')) },
                { titulo: 'Contas suspensas', valor: suspendedAccounts, detalhe: `${verifiedProfiles} perfis verificados no total`, tom: suspendedAccounts ? 'text-rose-300' : 'text-white',
                  abrir: () => irPara('users', () => setUserStatusFilter('suspended')) },
              ].map(c => (
                <button key={c.titulo} type="button" onClick={c.abrir}
                  className="group p-4 rounded-2xl bg-painel border border-purple-900/30 hover:border-amber-500/50 text-left cursor-pointer transition-colors">
                  <span className="flex items-center justify-between text-[10px] font-bold uppercase tracking-wider text-zinc-400 mb-1">
                    {c.titulo} <ChevronRight className="w-3.5 h-3.5 text-zinc-600 group-hover:text-amber-400" />
                  </span>
                  <span className={`block text-2xl font-black tabular-nums ${c.tom}`}>{c.valor.toLocaleString('pt-BR')}</span>
                  <span className="block text-[12px] text-zinc-500 mt-0.5">{c.detalhe}</span>
                </button>
              ))}
            </div>
          </section>

          <AdminIndicadores />

          {/* Últimas ações da equipe */}
          <section className="p-5 bg-painel border border-purple-900/30 rounded-3xl space-y-3" aria-label="Últimas ações da equipe">
            <div className="flex items-center justify-between gap-2">
              <h2 className="text-sm font-bold text-white flex items-center gap-2"><FileText className="w-4 h-4 text-amber-400" /> Últimas ações da equipe</h2>
              <button type="button" onClick={() => irPara('audit')} className="text-[12px] font-semibold text-amber-300 hover:text-amber-200 cursor-pointer inline-flex items-center gap-0.5">
                Ver auditoria completa <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>
            {adminLogs.length === 0 ? (
              <p className="text-xs text-zinc-500 py-4 text-center">Nenhuma ação registrada ainda.</p>
            ) : (
              <ul className="divide-y divide-zinc-800/70">
                {adminLogs.slice(0, 5).map(l => (
                  <li key={l.id} className="py-2.5 flex flex-col sm:flex-row sm:items-center justify-between gap-1 text-xs">
                    <div className="min-w-0">
                      <span className="font-bold text-amber-300 mr-2">{acaoLegivel(l.action)}</span>
                      <span className="text-zinc-300">{l.reason}</span>
                    </div>
                    <span className="text-[12px] text-zinc-500 shrink-0">{l.adminName} · {l.timestamp}</span>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      )}

      {/* ==================== TAB 2: REPORTS & MESSAGE MODERATION ==================== */}
      {activeAdminTab === 'reports' && (
        <div className="grid lg:grid-cols-12 gap-6">

          {/* Fila de denúncias */}
          <div className="lg:col-span-7 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-sm font-bold text-white">Fila de denúncias <span className="text-zinc-500 font-semibold">({filteredReports.length})</span></h2>
              <div className="flex items-center gap-2">
                <div className="flex rounded-xl bg-zinc-900 border border-zinc-800 p-0.5" role="group" aria-label="Situação">
                  {([['open', `Abertas (${pendingReports.length})`], ['closed', 'Encerradas'], ['all', 'Todas']] as const).map(([v, rot]) => (
                    <button key={v} type="button" onClick={() => setReportStatusFilter(v)} aria-pressed={reportStatusFilter === v}
                      className={`px-2.5 py-1 rounded-lg text-[12px] font-semibold cursor-pointer ${reportStatusFilter === v ? 'bg-zinc-700 text-white' : 'text-zinc-400 hover:text-white'}`}>{rot}</button>
                  ))}
                </div>
                <Seletor
                  value={reportPriorityFilter}
                  onChange={e => setReportPriorityFilter(e.target.value as any)}
                  className="px-2.5 py-1.5 bg-zinc-900 border border-zinc-800 rounded-xl text-xs text-zinc-300"
                  aria-label="Prioridade"
                >
                  <option value="all">Todas as prioridades</option>
                  <option value="urgent">Urgentes</option>
                  <option value="high">Altas</option>
                  <option value="medium">Médias</option>
                  <option value="low">Baixas</option>
                </Seletor>
              </div>
            </div>

            {filteredReports.length === 0 && (
              <div className="p-10 rounded-3xl bg-painel border border-purple-900/30 text-center text-xs text-zinc-400">
                <Inbox className="w-9 h-9 mx-auto mb-2 text-purple-400/70" />
                {reportStatusFilter === 'open' ? 'Nenhuma denúncia aberta com esse filtro. Fila em dia.' : 'Nenhuma denúncia com esse filtro.'}
              </div>
            )}

            {filteredReports.map(rep => {
              const aberta = abertas(rep);
              return (
              <button
                type="button"
                key={rep.id}
                onClick={() => setSelectedReport(rep)}
                aria-pressed={selectedReport?.id === rep.id}
                className={`w-full text-left p-4 rounded-2xl border transition-colors cursor-pointer ${
                  selectedReport?.id === rep.id
                    ? 'bg-purple-950/70 border-amber-500'
                    : 'bg-painel border-purple-900/30 hover:border-purple-700/60'
                } ${aberta ? '' : 'opacity-75'}`}
              >
                <div className="flex items-center justify-between gap-2 mb-2">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${rep.priority === 'urgent' ? TOM.perigo : rep.priority === 'high' ? TOM.alerta : TOM.neutro}`}>
                      {PRIORIDADE[rep.priority]}
                    </span>
                    <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-zinc-800 text-zinc-300">{ALVO_DENUNCIA[rep.targetType]}</span>
                    <span className="text-[12px] font-semibold text-amber-200">{CATEGORIA_DENUNCIA[rep.category] ?? rep.category}</span>
                  </div>
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full shrink-0 ${aberta ? TOM.alerta : TOM.ok}`}>{SITUACAO_DENUNCIA[rep.status]}</span>
                </div>
                <p className="text-xs text-zinc-200 mb-1">
                  <span className="font-bold text-purple-300">@{rep.reportedUserName}</span> <span className="text-zinc-500">denunciado por</span> {rep.reporterName}
                </p>
                <p className="text-xs text-zinc-400 line-clamp-2 leading-relaxed">{rep.description}</p>
                <div className="text-[12px] text-zinc-500 mt-2 flex items-center justify-between gap-2">
                  <span>{rep.createdAt}</span>
                  {rep.targetType === 'message' && aberta && <span className="text-amber-300 font-semibold inline-flex items-center gap-1"><Lock className="w-3 h-3" /> Inspeção com justificativa</span>}
                </div>
              </button>
              );
            })}
          </div>

          {/* Report Detail & Investigation Decision Panel */}
          <div className="lg:col-span-5 bg-painel border border-purple-900/30 rounded-3xl p-5 space-y-4 h-fit lg:sticky lg:top-20">
            {selectedReport ? (
              <>
                <div className="border-b border-purple-900/30 pb-3">
                  <span className="text-[10px] uppercase font-bold text-zinc-400 block mb-1">
                    Denúncia · {PRIORIDADE[selectedReport.priority]} · {SITUACAO_DENUNCIA[selectedReport.status]}
                  </span>
                  <h3 className="text-base font-bold text-white">
                    @{selectedReport.reportedUserName} <span className="text-zinc-400 font-semibold">({ALVO_DENUNCIA[selectedReport.targetType]})</span>
                  </h3>
                  <p className="text-[12px] text-zinc-500 font-mono mt-0.5 flex items-center gap-1.5">
                    {selectedReport.id}
                    <button type="button" onClick={() => handleCopy(selectedReport.id)} className="text-zinc-400 hover:text-white cursor-pointer" aria-label="Copiar código da denúncia">
                      {copiedText === selectedReport.id ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                    </button>
                  </p>
                </div>

                <div className="space-y-2 text-xs">
                  <div>
                    <span className="text-zinc-400 font-semibold">Categoria: </span>
                    <span className="text-amber-300 font-bold">{CATEGORIA_DENUNCIA[selectedReport.category] ?? selectedReport.category}</span>
                  </div>
                  <div>
                    <span className="text-zinc-400 font-semibold">Denunciante: </span>
                    <span className="text-zinc-200">{selectedReport.reporterName}</span>
                    <span className="text-zinc-500"> · {selectedReport.createdAt}</span>
                  </div>
                  {(() => {
                    const alvo = adminUsers.find(u => u.id === selectedReport.reportedUserId);
                    return alvo ? (
                      <button type="button" onClick={() => setInspectingUser(alvo)}
                        className="w-full p-2.5 rounded-2xl bg-zinc-950/70 border border-zinc-800 hover:border-purple-600/60 flex items-center gap-2.5 text-left cursor-pointer">
                        <img src={alvo.avatarUrl} alt="" className="w-8 h-8 rounded-full object-cover" />
                        <span className="min-w-0 flex-1">
                          <span className="block font-bold text-white truncate">{alvo.displayName}</span>
                          <span className="block text-[12px] text-zinc-400">{SITUACAO_CONTA[alvo.status]} · {alvo.reportsReceivedCount} denúncia{alvo.reportsReceivedCount === 1 ? '' : 's'} recebida{alvo.reportsReceivedCount === 1 ? '' : 's'}</span>
                        </span>
                        <span className="text-[12px] font-bold text-purple-300 shrink-0 inline-flex items-center">Abrir ficha <ChevronRight className="w-3.5 h-3.5" /></span>
                      </button>
                    ) : null;
                  })()}
                  <div className="p-3 bg-zinc-950/70 border border-zinc-800 rounded-2xl text-zinc-300 leading-relaxed">
                    "{selectedReport.description}"
                  </div>

                  {/* Special Button for Investigating Messages */}
                  {selectedReport.targetType === 'message' && (
                    <div className="p-3 bg-amber-950/30 border border-amber-800/40 rounded-2xl space-y-2">
                      <span className="text-xs font-bold text-amber-300 flex items-center gap-1.5">
                        <Lock className="w-3.5 h-3.5" />
                        Mensagem privada denunciada
                      </span>
                      <p className="text-[12px] text-zinc-300">
                        O conteúdo da mensagem é protegido e só pode ser exibido mediante justificativa gravada em auditoria.
                      </p>
                      <button
                        type="button"
                        onClick={() => setInvestigatingReport(selectedReport)}
                        className="px-3.5 py-1.5 bg-amber-500 hover:bg-amber-400 text-black font-bold text-xs rounded-xl cursor-pointer"
                      >
                        Inspecionar mensagem (com justificativa)
                      </button>
                    </div>
                  )}

                  {selectedReport.evidenceSnapshot && (
                    <div className="p-3 bg-purple-950/30 border border-purple-900/30 rounded-2xl text-[12px] text-purple-300">
                      <strong>Evidência Protegida: </strong>
                      {selectedReport.evidenceSnapshot}
                    </div>
                  )}
                </div>

                {/* Resolution Form */}
                {selectedReport.status === 'pending' || selectedReport.status === 'under_review' ? (
                  <div className="pt-3 border-t border-purple-900/30 space-y-3">
                    <label className="block text-xs font-semibold text-zinc-300">
                      Justificativa da decisão (obrigatória, fica na auditoria)
                    </label>
                    <textarea
                      rows={3}
                      value={resolutionNote}
                      onChange={e => setResolutionNote(e.target.value)}
                      placeholder="Descreva a sanção aplicada e a fundamentação nos termos do Vybelog..."
                      className="w-full px-3 py-2 bg-zinc-950 border border-purple-900/30 rounded-xl text-xs text-white focus:outline-none"
                    />

                    <div className="flex gap-2">
                      <button
                        onClick={() => {
                          if (resolutionNote.trim().length < 5) {
                            notify('Informe a justificativa (mínimo 5 caracteres).');
                            return;
                          }
                          adminResolveReport(selectedReport.id, 'resolved', resolutionNote.trim()).then(ok => ok && setResolutionNote(''));
                        }}
                        className="flex-1 py-2.5 rounded-xl bg-gradient-to-r from-fuchsia-600 via-pink-600 to-orange-600 hover:from-fuchsia-500 text-white text-xs font-bold cursor-pointer transition-all shadow"
                      >
                        Resolver
                      </button>

                      <button
                        onClick={() => {
                          adminResolveReport(selectedReport.id, 'dismissed', resolutionNote.trim() || 'Denúncia improcedente após verificação técnica.').then(ok => ok && setResolutionNote(''));
                        }}
                        className="px-4 py-2.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs font-semibold cursor-pointer"
                      >
                        Arquivar
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="p-3 bg-emerald-950/30 border border-emerald-800/40 rounded-2xl text-xs text-emerald-300">
                    ✓ Denúncia {selectedReport.status === 'dismissed' ? 'arquivada' : 'resolvida'} por {selectedReport.reviewedBy ?? 'equipe'}: "{selectedReport.resolutionNote}"
                  </div>
                )}
              </>
            ) : (
              <div className="p-8 text-center text-xs text-zinc-400">
                {filteredReports.length ? 'Selecione uma denúncia para ver os detalhes.' : 'Sem denúncia selecionada.'}
              </div>
            )}
          </div>

        </div>
      )}

      {/* ==================== TAB 3: USER MANAGEMENT ==================== */}
      {activeAdminTab === 'users' && (
        <div className="bg-painel border border-purple-900/30 rounded-3xl p-4 sm:p-5 space-y-4">

          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h2 className="text-base font-bold text-white">Usuários <span className="text-zinc-500 font-semibold text-sm">({filteredUsers.length}{filteredUsers.length !== adminUsers.length ? ` de ${adminUsers.length}` : ''})</span></h2>
              <p className="text-xs text-zinc-400">Clique na linha para abrir a ficha. Senhas e credenciais nunca são exibidas.</p>
            </div>

            <div className="flex items-center gap-2">
              <Seletor
                value={userStatusFilter}
                onChange={e => setUserStatusFilter(e.target.value as any)}
                className="px-3 py-1.5 bg-zinc-950 border border-zinc-800 rounded-xl text-xs text-zinc-200"
              >
                <option value="all">Todas as situações</option>
                <option value="active">Ativas</option>
                <option value="warned">Advertidas</option>
                <option value="restricted">Restritas</option>
                <option value="suspended">Suspensas</option>
              </Seletor>

              <div className="relative w-full sm:w-64">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
                <input
                  type="text"
                  placeholder="Nome, @, e-mail ou cidade"
                  aria-label="Buscar usuários"
                  value={searchUserQuery}
                  onChange={e => setSearchUserQuery(e.target.value)}
                  className="w-full pl-9 pr-3 py-1.5 bg-zinc-950 border border-zinc-800 rounded-xl text-xs text-white"
                />
              </div>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-zinc-950/80 text-zinc-400 border-b border-zinc-800">
                <tr>
                  <th className="p-3">Usuário</th>
                  <th className="p-3">E-mail</th>
                  <th className="p-3">Tipo · cidade</th>
                  <th className="p-3">Situação</th>
                  <th className="p-3">Verificação</th>
                  <th className="p-3">Denúncias</th>
                  <th className="p-3 text-right">Ação</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800/60 text-zinc-300">
                {filteredUsers.map(u => (
                  <tr key={u.id} className="hover:bg-zinc-900/60 transition-colors cursor-pointer" onClick={() => setInspectingUser(u)}>
                    <td className="p-3 flex items-center gap-2.5" onClick={e => e.stopPropagation()}>
                      <AdminThumb src={u.avatarUrl} label={`Foto de perfil de @${u.username}`} alt={u.displayName} className="w-8 h-8 rounded-full object-cover border border-purple-500/40" />
                      <div>
                        <div className="font-bold text-white flex items-center gap-1">
                          <span>{u.displayName}</span>
                          {u.adminRole && (
                            <span className="text-[10px] px-1.5 bg-amber-500/20 text-amber-300 rounded">{PAPEL_ADMIN[u.adminRole]}</span>
                          )}
                        </div>
                        <div className="text-[12px] text-zinc-400">@{u.username}</div>
                      </div>
                    </td>
                    <td className="p-3 font-mono text-[12px] text-zinc-300">{u.email}</td>
                    <td className="p-3">{TIPO_PERFIL[u.profileType] ?? u.profileType} · {u.city}</td>
                    <td className="p-3">
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                        u.status === 'active' ? TOM.ok : u.status === 'warned' || u.status === 'restricted' ? TOM.alerta : TOM.perigo
                      }`}>
                        {SITUACAO_CONTA[u.status] ?? u.status}
                      </span>
                    </td>
                    <td className="p-3">
                      {u.isVerified ? (
                        <span className="text-emerald-400 font-bold">✓ Verificado</span>
                      ) : (
                        <span className={u.verificationRequested ? 'text-amber-300 font-semibold' : 'text-zinc-500'}>{u.verificationRequested ? 'Pediu verificação' : 'Não verificado'}</span>
                      )}
                    </td>
                    <td className="p-3">
                      <span className={u.reportsReceivedCount > 0 ? 'text-rose-400 font-bold' : 'text-zinc-400'}>
                        {u.reportsReceivedCount}
                      </span>
                    </td>
                    <td className="p-3 text-right">
                      <button
                        onClick={() => setInspectingUser(u)}
                        className="px-3 py-1.5 bg-purple-950 hover:bg-purple-900 border border-purple-800/40 text-purple-200 rounded-xl font-bold text-xs cursor-pointer transition-colors"
                      >
                        Abrir ficha
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {filteredUsers.length === 0 && <p className="p-8 text-center text-xs text-zinc-400">Nenhum usuário encontrado com esse filtro.</p>}
          </div>

        </div>
      )}

      {/* ==================== TAB 4: MEDIA & VIDEO MODERATION ==================== */}
      {activeAdminTab === 'media' && (
        <div className="bg-painel border border-purple-900/30 rounded-3xl p-4 sm:p-5 space-y-4">

          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h2 className="text-base font-bold text-white">Mídias <span className="text-zinc-500 font-semibold text-sm">({filteredMedia.length}{filteredMedia.length !== adminMediaList.length ? ` de ${adminMediaList.length}` : ''})</span></h2>
              <p className="text-xs text-zinc-400">
                Álbuns privados permanecem protegidos por permissões; o acesso legítimo gera registro de auditoria.
              </p>
            </div>

            <div className="flex items-center gap-2">
              <Seletor
                value={mediaStatusFilter}
                onChange={e => setMediaStatusFilter(e.target.value as any)}
                className="px-3 py-1.5 bg-zinc-950 border border-zinc-800 rounded-xl text-xs text-zinc-200"
              >
                <option value="all">Todas as situações</option>
                <option value="flagged">Sinalizadas ({flaggedMediaCount})</option>
                <option value="pending_review">Em análise</option>
                <option value="approved">Aprovadas</option>
                <option value="removed">Removidas</option>
              </Seletor>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredMedia.map(m => (
              <div key={m.id} className="bg-zinc-950/80 border border-purple-900/30 rounded-2xl overflow-hidden shadow-lg flex flex-col justify-between">

                {/* Media Preview */}
                <div className="relative aspect-[16/10] bg-black overflow-hidden group">
                  <AdminThumb src={m.url} label={`Publicação de @${m.userName}`} alt="Mídia" className="w-full h-full object-cover" />
                  {m.urls.length > 1 && (
                    <div className="absolute bottom-2 right-2 flex gap-1">
                      {m.urls.slice(1).map((u, i) => (
                        <AdminThumb key={u} src={u} label={`Publicação de @${m.userName} (${i + 2}/${m.urls.length})`} className="w-9 h-9 rounded-lg object-cover border border-white/40" />
                      ))}
                    </div>
                  )}

                  <div className="absolute top-2 left-2 flex items-center gap-1.5">
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                      m.status === 'approved' ? TOM.ok : m.status === 'flagged' ? TOM.perigo : m.status === 'pending_review' ? TOM.alerta : TOM.neutro
                    }`}>
                      {SITUACAO_MIDIA[m.status] ?? m.status}
                    </span>

                    {m.isPrivateVaultItem && (
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-purple-950/80 text-purple-300 border border-purple-800 flex items-center gap-1">
                        <Lock className="w-3 h-3" /> Cofre
                      </span>
                    )}
                  </div>
                </div>

                {/* Info & Moderation Action buttons */}
                <div className="p-3.5 space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-bold text-white">{m.userName}</span>
                    <span className="text-[10px] text-zinc-400">{m.createdAt}</span>
                  </div>

                  {m.caption && (
                    <p className="text-[12px] text-zinc-300 line-clamp-1 italic">
                      "{m.caption}"
                    </p>
                  )}

                  {m.flagReason && (
                    <div className="p-2 rounded-lg bg-rose-950/30 border border-rose-900/30 text-[10px] text-rose-300">
                      Motivo: {m.flagReason}
                    </div>
                  )}

                  <div className="pt-2 border-t border-zinc-800 flex items-center justify-end gap-2">
                    {m.status !== 'approved' && (
                      <button
                        onClick={async () => {
                          const r = await askText({ title: 'Aprovar mídia', message: 'Justificativa para aprovação:', confirmLabel: 'Aprovar' });
                          if (r) adminModerateMedia(m.id, 'approved', r);
                        }}
                        className="px-2.5 py-1 bg-emerald-600/30 hover:bg-emerald-600/50 text-emerald-300 rounded-lg text-[12px] font-bold cursor-pointer"
                      >
                        Aprovar
                      </button>
                    )}

                    {m.status !== 'removed' && (
                      <button
                        onClick={async () => {
                          const r = await askText({ title: 'Remover mídia', message: 'Justificativa para remoção (registrada em log):', confirmLabel: 'Remover', danger: true });
                          if (r) adminModerateMedia(m.id, 'removed', r);
                        }}
                        className="px-2.5 py-1 bg-rose-600/30 hover:bg-rose-600/50 text-rose-300 rounded-lg text-[12px] font-bold cursor-pointer"
                      >
                        Remover
                      </button>
                    )}
                  </div>

                </div>

              </div>
            ))}
          </div>
          {filteredMedia.length === 0 && (
            <div className="p-8 text-center text-xs text-zinc-400">
              <Inbox className="w-9 h-9 mx-auto mb-2 text-purple-400/70" />
              {mediaStatusFilter === 'flagged' ? 'Nenhuma mídia sinalizada. Tudo em dia.' : 'Nenhuma mídia com esse filtro.'}
            </div>
          )}

        </div>
      )}

      {/* ==================== TAB 5: AUDIT LOGS ==================== */}
      {activeAdminTab === 'events' && <AdminEventsTab />}
      {activeAdminTab === 'ads' && <AdminAdsTab />}
      {activeAdminTab === 'broadcasts' && <AdminComunicadosTab />}
      {activeAdminTab === 'growth' && <AdminCrescimentoTab />}
      {activeAdminTab === 'conversations' && <AdminConversationsTab />}

      {activeAdminTab === 'audit' && (
        <div className="bg-painel border border-purple-900/30 rounded-3xl p-4 sm:p-5 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h2 className="text-base font-bold text-white">Auditoria <span className="text-zinc-500 font-semibold text-sm">({filteredLogs.length}{filteredLogs.length !== adminLogs.length ? ` de ${adminLogs.length}` : ''})</span></h2>
              <p className="text-xs text-zinc-400">Ações da equipe com autor, data e justificativa. Os registros não podem ser alterados.</p>
            </div>
            <div className="relative w-full sm:w-64">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
              <input type="search" value={auditQuery} onChange={e => setAuditQuery(e.target.value)} placeholder="Buscar ação, pessoa ou motivo" aria-label="Buscar na auditoria"
                className="w-full pl-9 pr-3 py-1.5 bg-zinc-950 border border-zinc-800 rounded-xl text-xs text-white" />
            </div>
            <button
              onClick={() => {
                const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(adminLogs, null, 2));
                const a = document.createElement('a');
                a.href = dataStr;
                a.download = `vybelog-auditoria-${new Date().toISOString().slice(0, 10)}.json`;
                document.body.appendChild(a);
                a.click();
                a.remove();
              }}
              className="px-3.5 py-1.5 rounded-xl bg-purple-950 hover:bg-purple-900 border border-purple-800/50 text-xs font-bold text-purple-200 flex items-center gap-1.5 cursor-pointer self-start sm:self-auto"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Exportar (JSON)</span>
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-zinc-950/80 text-zinc-400 border-b border-zinc-800">
                <tr>
                  <th className="p-3">Data e hora</th>
                  <th className="p-3">Quem</th>
                  <th className="p-3">Ação</th>
                  <th className="p-3">Alvo</th>
                  <th className="p-3">Justificativa</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800/60 text-zinc-300">
                {filteredLogs.map(l => (
                  <tr key={l.id} className="hover:bg-zinc-900/40 transition-colors">
                    <td className="p-3 text-[12px] text-zinc-400 whitespace-nowrap tabular-nums">{l.timestamp}</td>
                    <td className="p-3 font-semibold text-white whitespace-nowrap">{l.adminName}</td>
                    <td className="p-3 text-amber-300 font-bold" title={l.action}>{acaoLegivel(l.action)}</td>
                    <td className="p-3 font-mono text-[12px] text-zinc-400 max-w-[14rem] truncate" title={`${l.targetType}:${l.targetId}`}>{l.targetType}:{l.targetId}</td>
                    <td className="p-3 text-zinc-200">{l.reason}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* User Detail Modal */}
      {inspectingUser && (
        <AdminUserDetailModal
          user={adminUsers.find(u => u.id === inspectingUser.id) ?? inspectingUser}
          onClose={() => setInspectingUser(null)}
        />
      )}

      {/* Message Investigation Modal */}
      {investigatingReport && (
        <AdminMessageInvestigationModal
          report={investigatingReport}
          onClose={() => setInvestigatingReport(null)}
        />
      )}

    </div>
  );
};
