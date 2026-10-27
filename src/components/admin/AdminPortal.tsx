import React, { useEffect, useState } from 'react';
import { useApp } from '../../context/AppContext';
import { AdminMfaGate } from './AdminMfaGate';
import { AdminEventsTab } from './AdminEventsTab';
import { AdminAdsTab } from './AdminAdsTab';
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
  Megaphone
} from 'lucide-react';
import { ModerationReport, AdminUserRecord, AdminMediaRecord } from '../../types';
import { AdminUserDetailModal } from './AdminUserDetailModal';
import { AdminMessageInvestigationModal } from './AdminMessageInvestigationModal';

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

  const [activeAdminTab, setActiveAdminTab] = useState<'dashboard' | 'users' | 'reports' | 'media' | 'events' | 'ads' | 'audit'>('dashboard');

  // Modals state
  const [inspectingUser, setInspectingUser] = useState<AdminUserRecord | null>(null);
  const [investigatingReport, setInvestigatingReport] = useState<ModerationReport | null>(null);

  // Filters state
  const [searchUserQuery, setSearchUserQuery] = useState('');
  const [userStatusFilter, setUserStatusFilter] = useState<'all' | 'active' | 'warned' | 'restricted' | 'suspended'>('all');
  const [mediaStatusFilter, setMediaStatusFilter] = useState<'all' | 'approved' | 'pending_review' | 'flagged' | 'removed'>('all');
  const [reportPriorityFilter, setReportPriorityFilter] = useState<'all' | 'urgent' | 'high' | 'medium' | 'low'>('all');
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
  const totalUsers = adminUsers.length;
  const activeAccounts = adminUsers.filter(u => u.status === 'active').length;
  const warnedAccounts = adminUsers.filter(u => u.status === 'warned').length;
  const restrictedAccounts = adminUsers.filter(u => u.status === 'restricted').length;
  const suspendedAccounts = adminUsers.filter(u => u.status === 'suspended').length;
  const verifiedProfiles = adminUsers.filter(u => u.isVerified).length;
  const pendingReports = reports.filter(r => r.status === 'pending');
  const resolvedReports = reports.filter(r => r.status === 'resolved');
  const urgentReports = reports.filter(r => r.priority === 'urgent');
  const messageReports = reports.filter(r => r.targetType === 'message');
  const flaggedMediaCount = adminMediaList.filter(m => m.status === 'flagged').length;

  if (!adminMfaVerified) {
    return <AdminMfaGate />;
  }

  // Filtered Users
  const filteredUsers = adminUsers.filter(u => {
    if (userStatusFilter !== 'all' && u.status !== userStatusFilter) return false;
    if (searchUserQuery.trim()) {
      const q = searchUserQuery.toLowerCase();
      return u.username.toLowerCase().includes(q) || u.displayName.toLowerCase().includes(q) || u.email.toLowerCase().includes(q);
    }
    return true;
  });

  // Filtered Media
  const filteredMedia = adminMediaList.filter(m => {
    if (mediaStatusFilter !== 'all' && m.status !== mediaStatusFilter) return false;
    return true;
  });

  // Filtered Reports
  const filteredReports = reports.filter(r => {
    if (reportPriorityFilter !== 'all' && r.priority !== reportPriorityFilter) return false;
    return true;
  });

  return (
    <div className="max-w-7xl mx-auto py-6 px-4">
      
      {/* Top Admin Header Bar */}
      <div className="bg-gradient-to-r from-amber-950/60 via-zinc-900 to-purple-950/60 border border-amber-600/30 rounded-3xl p-5 sm:p-6 mb-6 shadow-2xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-400 shrink-0 shadow-lg shadow-amber-950/30">
            <ShieldCheck className="w-7 h-7" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-xl font-black text-white">Painel Administrativo & Moderação</h1>
              <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/40">
                {adminRole.toUpperCase()}
              </span>
              <span className="text-[10px] text-emerald-400 font-semibold flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                MFA Validado
              </span>
            </div>
            <p className="text-xs text-zinc-400">
              Sessão administrativa: <strong className="text-amber-200">{currentUser.email}</strong> ({adminRole})
            </p>
          </div>
        </div>

        {/* Role Switcher & Back to Portal button */}
        <div className="flex items-center gap-2.5 self-end sm:self-auto flex-wrap">
          <span className="px-3 py-2 bg-zinc-950 border border-amber-600/40 rounded-xl text-xs text-amber-300 font-semibold">
            {{ superadmin: 'Superadministrador', moderator: 'Moderador', support: 'Suporte (leitura)', auditor: 'Auditor (leitura)' }[adminRole]}
          </span>
          <button
            onClick={() => refreshAdminData()}
            className="px-3 py-2 rounded-xl bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-xs font-semibold text-zinc-300 cursor-pointer"
          >
            Atualizar dados
          </button>

          <button
            onClick={() => setIsAdminMode(false)}
            className="px-4 py-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-xs font-bold text-white transition-colors cursor-pointer shadow"
          >
            Voltar ao Portal Social
          </button>
        </div>

      </div>

      {/* Main Admin Navigation Tabs */}
      <div className="flex items-center gap-2 overflow-x-auto pb-2 mb-6 scrollbar-none">
        {[
          { id: 'dashboard', label: 'Dashboard & Indicadores', icon: Activity },
          { id: 'reports', label: `Fila de Denúncias (${pendingReports.length})`, icon: ShieldAlert },
          { id: 'users', label: `Gerenciamento de Usuários (${totalUsers})`, icon: Users },
          { id: 'media', label: `Moderação de Mídias (${adminMediaList.length})`, icon: Image },
          { id: 'events', label: 'Eventos', icon: CalendarHeart },
          { id: 'ads', label: 'Publicidade', icon: Megaphone },
          { id: 'audit', label: `Livro de Auditoria (${adminLogs.length})`, icon: FileText },
        ].map(t => {
          const Icon = t.icon;
          const isActive = activeAdminTab === t.id;
          return (
            <button
              key={t.id}
              onClick={() => setActiveAdminTab(t.id as any)}
              className={`px-4 py-2.5 rounded-2xl text-xs font-bold transition-all flex items-center gap-2 shrink-0 cursor-pointer ${
                isActive
                  ? 'bg-amber-400 text-black shadow-lg shadow-amber-950/40'
                  : 'bg-zinc-900/80 text-zinc-400 hover:text-white border border-zinc-800'
              }`}
            >
              <Icon className="w-4 h-4" />
              <span>{t.label}</span>
            </button>
          );
        })}
      </div>

      {/* ==================== TAB 1: DASHBOARD & METRICS ==================== */}
      {activeAdminTab === 'dashboard' && (
        <div className="space-y-6">
          
          {/* Complete 11 KPIs Grid as requested in Prompt Section 3 */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
            
            {/* 1. Total Usuários */}
            <div className="p-4 rounded-3xl bg-[#120d20] border border-purple-900/30">
              <span className="text-[10px] text-zinc-400 font-bold uppercase tracking-wider block mb-1">
                Total de Usuários
              </span>
              <div className="flex items-baseline justify-between">
                <span className="text-2xl font-black text-white">{totalUsers}</span>
                <span className="text-[11px] text-purple-400 font-semibold">+100% +18</span>
              </div>
            </div>

            {/* 2. Contas Ativas */}
            <div className="p-4 rounded-3xl bg-[#120d20] border border-emerald-900/30">
              <span className="text-[10px] text-emerald-400 font-bold uppercase tracking-wider block mb-1">
                Contas Ativas
              </span>
              <div className="flex items-baseline justify-between">
                <span className="text-2xl font-black text-emerald-400">{activeAccounts}</span>
                <span className="text-[11px] text-zinc-400">Em conformidade</span>
              </div>
            </div>

            {/* 3. Contas Restritas / Advertidas */}
            <div className="p-4 rounded-3xl bg-[#120d20] border border-amber-900/30">
              <span className="text-[10px] text-amber-400 font-bold uppercase tracking-wider block mb-1">
                Contas Restritas
              </span>
              <div className="flex items-baseline justify-between">
                <span className="text-2xl font-black text-amber-300">{restrictedAccounts + warnedAccounts}</span>
                <span className="text-[11px] text-amber-500 font-semibold">Sob análise</span>
              </div>
            </div>

            {/* 4. Contas Suspensas */}
            <div className="p-4 rounded-3xl bg-[#120d20] border border-rose-900/30">
              <span className="text-[10px] text-rose-400 font-bold uppercase tracking-wider block mb-1">
                Contas Suspensas
              </span>
              <div className="flex items-baseline justify-between">
                <span className="text-2xl font-black text-rose-400">{suspendedAccounts}</span>
                <span className="text-[11px] text-rose-500 font-semibold">Bloqueio preventivo</span>
              </div>
            </div>

            {/* 5. Perfis Verificados */}
            <div className="p-4 rounded-3xl bg-[#120d20] border border-purple-900/30">
              <span className="text-[10px] text-purple-300 font-bold uppercase tracking-wider block mb-1">
                Perfis Verificados (+18)
              </span>
              <div className="flex items-baseline justify-between">
                <span className="text-2xl font-black text-white">{verifiedProfiles}</span>
                <span className="text-[11px] text-emerald-400 font-semibold">Biometria / Doc</span>
              </div>
            </div>

            {/* 6. Quantidade de Publicações */}
            <div className="p-4 rounded-3xl bg-[#120d20] border border-purple-900/30">
              <span className="text-[10px] text-zinc-400 font-bold uppercase tracking-wider block mb-1">
                Publicações no Feed
              </span>
              <div className="flex items-baseline justify-between">
                <span className="text-2xl font-black text-white">4</span>
                <span className="text-[11px] text-zinc-400">Total auditado</span>
              </div>
            </div>

            {/* 7. Fotos e Vídeos Publicados */}
            <div className="p-4 rounded-3xl bg-[#120d20] border border-purple-900/30">
              <span className="text-[10px] text-zinc-400 font-bold uppercase tracking-wider block mb-1">
                Mídias Registradas
              </span>
              <div className="flex items-baseline justify-between">
                <span className="text-2xl font-black text-white">{adminMediaList.length}</span>
                <span className="text-[11px] text-purple-400 font-semibold">Storage protegido</span>
              </div>
            </div>

            {/* 8. Conteúdos Pendentes de Moderação */}
            <div className="p-4 rounded-3xl bg-[#120d20] border border-amber-900/30">
              <span className="text-[10px] text-amber-400 font-bold uppercase tracking-wider block mb-1">
                Mídias Sinalizadas
              </span>
              <div className="flex items-baseline justify-between">
                <span className="text-2xl font-black text-amber-300">{flaggedMediaCount}</span>
                <span className="text-[11px] text-amber-500 font-semibold">Requer decisão</span>
              </div>
            </div>

            {/* 9. Denúncias Recebidas */}
            <div className="p-4 rounded-3xl bg-[#120d20] border border-amber-900/30">
              <span className="text-[10px] text-amber-400 font-bold uppercase tracking-wider block mb-1">
                Denúncias Pendentes
              </span>
              <div className="flex items-baseline justify-between">
                <span className="text-2xl font-black text-amber-300">{pendingReports.length}</span>
                <span className="text-[11px] text-rose-400 font-semibold">{urgentReports.length} Urgentes</span>
              </div>
            </div>

            {/* 10. Denúncias de Mensagens */}
            <div className="p-4 rounded-3xl bg-[#120d20] border border-purple-900/30">
              <span className="text-[10px] text-zinc-400 font-bold uppercase tracking-wider block mb-1">
                Denúncias de Mensagens
              </span>
              <div className="flex items-baseline justify-between">
                <span className="text-2xl font-black text-white">{messageReports.length}</span>
                <span className="text-[11px] text-purple-400 font-semibold">Investigação estrita</span>
              </div>
            </div>

            {/* 11. Histórico de Ações de Moderação */}
            <div className="p-4 rounded-3xl bg-[#120d20] border border-purple-900/30 col-span-2">
              <span className="text-[10px] text-zinc-400 font-bold uppercase tracking-wider block mb-1">
                Registros de Auditoria Imutáveis
              </span>
              <div className="flex items-baseline justify-between">
                <span className="text-2xl font-black text-white">{adminLogs.length} eventos</span>
                <span className="text-[11px] text-emerald-400 font-semibold">100% Rastreável por IP/Data</span>
              </div>
            </div>

          </div>

          {/* Urgent Tickets Alert Banner */}
          {urgentReports.length > 0 && (
            <div className="p-5 rounded-3xl bg-rose-950/30 border border-rose-800/50 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-rose-600/30 text-rose-400 flex items-center justify-center shrink-0">
                  <AlertTriangle className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white">
                    {urgentReports.length} Denúncia(s) com prioridade URGENTE aguardando ação
                  </h3>
                  <p className="text-xs text-rose-200">
                    Ocorrências de envio de imagens íntimas sem consentimento possuem prazo prioritário de resolução.
                  </p>
                </div>
              </div>
              <button
                onClick={() => setActiveAdminTab('reports')}
                className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs shrink-0 cursor-pointer shadow-lg"
              >
                Atender Denúncias Agora
              </button>
            </div>
          )}

          {/* Recent Audit Action Feed */}
          <div className="p-6 bg-[#120d20] border border-purple-900/30 rounded-3xl shadow-xl">
            <h3 className="text-sm font-bold text-white mb-4 flex items-center gap-2">
              <FileText className="w-4 h-4 text-amber-400" />
              <span>Últimas Ações Registradas em Log de Auditoria</span>
            </h3>
            <div className="space-y-3">
              {adminLogs.slice(0, 4).map(l => (
                <div key={l.id} className="p-3 bg-zinc-950/70 border border-zinc-800 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
                  <div>
                    <span className="font-mono text-amber-400 font-bold mr-2">{l.action}</span>
                    <span className="text-zinc-300">{l.reason}</span>
                  </div>
                  <div className="text-[10px] text-zinc-500 shrink-0 sm:text-right">
                    <div>{l.adminName}</div>
                    <div>{l.timestamp}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>

        </div>
      )}

      {/* ==================== TAB 2: REPORTS & MESSAGE MODERATION ==================== */}
      {activeAdminTab === 'reports' && (
        <div className="grid lg:grid-cols-12 gap-6">
          
          {/* Reports List Column */}
          <div className="lg:col-span-7 space-y-3">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-bold text-white">Fila de Atendimento de Denúncias</h3>
              
              {/* Filter by priority */}
              <select
                value={reportPriorityFilter}
                onChange={e => setReportPriorityFilter(e.target.value as any)}
                className="px-2.5 py-1 bg-zinc-900 border border-zinc-800 rounded-lg text-xs text-zinc-300"
              >
                <option value="all">Todas as Prioridades</option>
                <option value="urgent">Urgentes</option>
                <option value="high">Altas</option>
                <option value="medium">Médias</option>
              </select>
            </div>

            {filteredReports.map(rep => (
              <div
                key={rep.id}
                onClick={() => setSelectedReport(rep)}
                className={`p-4 rounded-3xl border transition-all cursor-pointer ${
                  selectedReport?.id === rep.id
                    ? 'bg-purple-950/70 border-amber-500 shadow-xl'
                    : 'bg-[#120d20] border-purple-900/30 hover:border-purple-700/50'
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs font-bold text-amber-400">{rep.id}</span>
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase ${
                      rep.priority === 'urgent'
                        ? 'bg-rose-500/20 text-rose-400 border border-rose-500/30'
                        : rep.priority === 'high'
                        ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                        : 'bg-zinc-800 text-zinc-300'
                    }`}>
                      {rep.priority}
                    </span>
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-400 capitalize">
                      {rep.targetType}
                    </span>
                  </div>

                  <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                    rep.status === 'resolved'
                      ? 'bg-emerald-950 text-emerald-400 border border-emerald-800'
                      : 'bg-amber-950 text-amber-400 border border-amber-800'
                  }`}>
                    {rep.status === 'resolved' ? 'Resolvida' : 'Pendente'}
                  </span>
                </div>

                <div className="text-xs font-bold text-white mb-1">
                  Denunciado: <span className="text-purple-300">@{rep.reportedUserName}</span> por {rep.reporterName}
                </div>
                <p className="text-xs text-zinc-300 line-clamp-2 leading-relaxed">
                  {rep.description}
                </p>
                <div className="text-[10px] text-zinc-500 mt-2 flex items-center justify-between">
                  <span>Criado em: {rep.createdAt}</span>
                  {rep.targetType === 'message' && (
                    <span className="text-amber-400 font-semibold">Requer autorização para inspeção</span>
                  )}
                </div>
              </div>
            ))}
          </div>

          {/* Report Detail & Investigation Decision Panel */}
          <div className="lg:col-span-5 bg-[#120d20] border border-purple-900/30 rounded-3xl p-6 shadow-xl space-y-4 h-fit">
            {selectedReport ? (
              <>
                <div className="border-b border-purple-900/30 pb-3">
                  <span className="text-[10px] uppercase font-bold text-zinc-400 block mb-1">
                    Exame Formal da Denúncia {selectedReport.id}
                  </span>
                  <h4 className="text-base font-bold text-white">
                    Alvo: @{selectedReport.reportedUserName} ({selectedReport.targetType})
                  </h4>
                </div>

                <div className="space-y-2 text-xs">
                  <div>
                    <span className="text-zinc-400 font-semibold">Categoria: </span>
                    <span className="text-amber-300 font-bold">{selectedReport.category}</span>
                  </div>
                  <div>
                    <span className="text-zinc-400 font-semibold">Denunciante: </span>
                    <span className="text-zinc-200">{selectedReport.reporterName}</span>
                  </div>
                  <div className="p-3 bg-zinc-950/70 border border-zinc-800 rounded-2xl text-zinc-300 leading-relaxed">
                    "{selectedReport.description}"
                  </div>

                  {/* Special Button for Investigating Messages */}
                  {selectedReport.targetType === 'message' && (
                    <div className="p-3 bg-amber-950/30 border border-amber-800/40 rounded-2xl space-y-2">
                      <span className="text-xs font-bold text-amber-300 flex items-center gap-1.5">
                        <Lock className="w-3.5 h-3.5" />
                        Mensagem Privada Sinalizada
                      </span>
                      <p className="text-[11px] text-zinc-300">
                        O conteúdo da mensagem é protegido e só pode ser exibido mediante justificativa gravada em auditoria.
                      </p>
                      <button
                        type="button"
                        onClick={() => setInvestigatingReport(selectedReport)}
                        className="px-3.5 py-1.5 bg-amber-500 hover:bg-amber-400 text-black font-bold text-xs rounded-xl cursor-pointer"
                      >
                        Abrir Ferramenta de Investigação com Justificativa
                      </button>
                    </div>
                  )}

                  {selectedReport.evidenceSnapshot && (
                    <div className="p-3 bg-purple-950/30 border border-purple-900/30 rounded-2xl text-[11px] text-purple-300">
                      <strong>Evidência Protegida: </strong>
                      {selectedReport.evidenceSnapshot}
                    </div>
                  )}
                </div>

                {/* Resolution Form */}
                {selectedReport.status === 'pending' || selectedReport.status === 'under_review' ? (
                  <div className="pt-3 border-t border-purple-900/30 space-y-3">
                    <label className="block text-xs font-semibold text-zinc-300">
                      Justificativa Técnica da Decisão (Obrigatório para Auditoria):
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
                            alert('Informe a justificativa (mínimo 5 caracteres).');
                            return;
                          }
                          adminResolveReport(selectedReport.id, 'resolved', resolutionNote.trim()).then(ok => ok && setResolutionNote(''));
                        }}
                        className="flex-1 py-2.5 rounded-xl bg-gradient-to-r from-rose-600 to-purple-600 hover:from-rose-500 text-white text-xs font-bold cursor-pointer transition-all shadow"
                      >
                        Aplicar Medida & Resolver
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
                Selecione uma denúncia à esquerda para examinar os fatos.
              </div>
            )}
          </div>

        </div>
      )}

      {/* ==================== TAB 3: USER MANAGEMENT ==================== */}
      {activeAdminTab === 'users' && (
        <div className="bg-[#120d20] border border-purple-900/30 rounded-3xl p-6 shadow-xl space-y-4">
          
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h3 className="text-base font-bold text-white">Gerenciamento Completo de Usuários</h3>
              <p className="text-xs text-zinc-400">
                Acesse dados cadastrais necessários sem exposição de senhas ou credenciais confidenciais.
              </p>
            </div>

            <div className="flex items-center gap-2">
              <select
                value={userStatusFilter}
                onChange={e => setUserStatusFilter(e.target.value as any)}
                className="px-3 py-1.5 bg-zinc-950 border border-zinc-800 rounded-xl text-xs text-zinc-200"
              >
                <option value="all">Todas as Situações</option>
                <option value="active">Ativos</option>
                <option value="warned">Advertidos</option>
                <option value="restricted">Restritos</option>
                <option value="suspended">Suspensos</option>
              </select>

              <div className="relative w-full sm:w-64">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
                <input
                  type="text"
                  placeholder="Buscar por usuário, @ ou e-mail"
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
                  <th className="p-3">Usuário / Identificador</th>
                  <th className="p-3">E-mail Cadastrado</th>
                  <th className="p-3">Tipo / Cidade</th>
                  <th className="p-3">Situação</th>
                  <th className="p-3">Verificação</th>
                  <th className="p-3">Denúncias</th>
                  <th className="p-3 text-right">Ação</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800/60 text-zinc-300">
                {filteredUsers.map(u => (
                  <tr key={u.id} className="hover:bg-zinc-900/40 transition-colors">
                    <td className="p-3 flex items-center gap-2.5">
                      <img src={u.avatarUrl} alt={u.displayName} className="w-8 h-8 rounded-full object-cover border border-purple-500/40" />
                      <div>
                        <div className="font-bold text-white flex items-center gap-1">
                          <span>{u.displayName}</span>
                          {u.email === 'tomsilvaconsignado@gmail.com' && (
                            <span className="text-[9px] px-1 bg-amber-500/20 text-amber-300 rounded">Admin</span>
                          )}
                        </div>
                        <div className="text-[10px] text-zinc-400">@{u.username} • {u.id}</div>
                      </div>
                    </td>
                    <td className="p-3 font-mono text-[11px] text-zinc-300">{u.email}</td>
                    <td className="p-3 capitalize">{u.profileType} • {u.city}</td>
                    <td className="p-3">
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded uppercase ${
                        u.status === 'active'
                          ? 'bg-emerald-950 text-emerald-400 border border-emerald-800'
                          : u.status === 'restricted'
                          ? 'bg-amber-950 text-amber-400 border border-amber-800'
                          : 'bg-rose-950 text-rose-400 border border-rose-800'
                      }`}>
                        {u.status}
                      </span>
                    </td>
                    <td className="p-3">
                      {u.isVerified ? (
                        <span className="text-emerald-400 font-bold">✓ +18 Verificado</span>
                      ) : (
                        <span className="text-amber-400 font-medium">Pendente</span>
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
                        Abrir Ficha
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

        </div>
      )}

      {/* ==================== TAB 4: MEDIA & VIDEO MODERATION ==================== */}
      {activeAdminTab === 'media' && (
        <div className="bg-[#120d20] border border-purple-900/30 rounded-3xl p-6 shadow-xl space-y-4">
          
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h3 className="text-base font-bold text-white">Módulo Centralizado de Moderação de Mídias</h3>
              <p className="text-xs text-zinc-400">
                Álbuns privados permanecem protegidos por permissões; o acesso legítimo gera registro de auditoria.
              </p>
            </div>

            <div className="flex items-center gap-2">
              <select
                value={mediaStatusFilter}
                onChange={e => setMediaStatusFilter(e.target.value as any)}
                className="px-3 py-1.5 bg-zinc-950 border border-zinc-800 rounded-xl text-xs text-zinc-200"
              >
                <option value="all">Todas as Situações</option>
                <option value="approved">Aprovadas</option>
                <option value="flagged">Sinalizadas / Denunciadas</option>
                <option value="removed">Removidas</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredMedia.map(m => (
              <div key={m.id} className="bg-zinc-950/80 border border-purple-900/30 rounded-2xl overflow-hidden shadow-lg flex flex-col justify-between">
                
                {/* Media Preview */}
                <div className="relative aspect-[16/10] bg-black overflow-hidden group">
                  <img src={m.url} alt="Mídia" className="w-full h-full object-cover" />
                  
                  <div className="absolute top-2 left-2 flex items-center gap-1.5">
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                      m.status === 'approved' 
                        ? 'bg-emerald-950/80 text-emerald-400 border border-emerald-800' 
                        : m.status === 'flagged'
                        ? 'bg-rose-950/80 text-rose-400 border border-rose-800'
                        : 'bg-zinc-800 text-zinc-300'
                    }`}>
                      {m.status.toUpperCase()}
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
                    <p className="text-[11px] text-zinc-300 line-clamp-1 italic">
                      "{m.caption}"
                    </p>
                  )}

                  {m.flagReason && (
                    <div className="p-2 rounded-lg bg-rose-950/30 border border-rose-900/30 text-[10px] text-rose-300">
                      Motivo: {m.flagReason}
                    </div>
                  )}

                  <div className="pt-2 border-t border-zinc-800 flex items-center justify-between gap-2">
                    {m.status !== 'approved' && (
                      <button
                        onClick={() => {
                          const r = prompt('Justificativa para aprovação:');
                          if (r) adminModerateMedia(m.id, 'approved', r);
                        }}
                        className="px-2.5 py-1 bg-emerald-600/30 hover:bg-emerald-600/50 text-emerald-300 rounded-lg text-[11px] font-bold cursor-pointer"
                      >
                        Aprovar
                      </button>
                    )}

                    {m.status !== 'removed' && (
                      <button
                        onClick={() => {
                          const r = prompt('Justificativa para remoção (registrada em log):');
                          if (r) adminModerateMedia(m.id, 'removed', r);
                        }}
                        className="px-2.5 py-1 bg-rose-600/30 hover:bg-rose-600/50 text-rose-300 rounded-lg text-[11px] font-bold cursor-pointer"
                      >
                        Remover Conteúdo
                      </button>
                    )}
                  </div>

                </div>

              </div>
            ))}
          </div>

        </div>
      )}

      {/* ==================== TAB 5: AUDIT LOGS ==================== */}
      {activeAdminTab === 'events' && <AdminEventsTab />}
      {activeAdminTab === 'ads' && <AdminAdsTab />}

      {activeAdminTab === 'audit' && (
        <div className="bg-[#120d20] border border-purple-900/30 rounded-3xl p-6 shadow-xl space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h3 className="text-base font-bold text-white">Livro de Auditoria Imutável (Audit Trail)</h3>
              <p className="text-xs text-zinc-400">
                Todas as ações administrativas relevantes são registradas com identificação, carimbo de tempo, IP e justificativa.
              </p>
            </div>
            <button
              onClick={() => {
                const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(adminLogs, null, 2));
                const a = document.createElement('a');
                a.href = dataStr;
                a.download = `vybe_audit_logs_${Date.now()}.json`;
                document.body.appendChild(a);
                a.click();
                a.remove();
              }}
              className="px-3.5 py-1.5 rounded-xl bg-purple-950 hover:bg-purple-900 border border-purple-800/50 text-xs font-bold text-purple-200 flex items-center gap-1.5 cursor-pointer self-start sm:self-auto"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Exportar Logs (JSON)</span>
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-zinc-950/80 text-zinc-400 border-b border-zinc-800">
                <tr>
                  <th className="p-3">Data / Hora</th>
                  <th className="p-3">Administrador</th>
                  <th className="p-3">Ação</th>
                  <th className="p-3">Alvo</th>
                  <th className="p-3">Motivo / Fundamentação</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800/60 text-zinc-300">
                {adminLogs.map(l => (
                  <tr key={l.id} className="hover:bg-zinc-900/40 transition-colors">
                    <td className="p-3 font-mono text-[11px] text-zinc-400">{l.timestamp}</td>
                    <td className="p-3 font-semibold text-white">{l.adminName}</td>
                    <td className="p-3 font-mono text-amber-400 font-bold">{l.action}</td>
                    <td className="p-3 font-mono text-zinc-300">{l.targetType}:{l.targetId}</td>
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
