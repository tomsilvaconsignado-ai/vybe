import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { 
  X, 
  ShieldCheck, 
  AlertTriangle, 
  Ban, 
  CheckCircle2, 
  FileText, 
  Image, 
  MessageSquare, 
  Lock, 
  Calendar, 
  MapPin, 
  Sparkles,
  Plus,
  Send,
  Eye,
  Sliders
} from 'lucide-react';
import { AdminUserRecord, UserAccountStatus } from '../../types';
import { notify, askText } from '../common/Feedback';

interface AdminUserDetailModalProps {
  user: AdminUserRecord | null;
  onClose: () => void;
}

export const AdminUserDetailModal: React.FC<AdminUserDetailModalProps> = ({ user, onClose }) => {
  const { 
    adminUpdateUserStatus, 
    adminAddUserNote, 
    adminSetRestrictions, 
    adminVerifyUserAge,
    adminSetUserRole,
    adminRole,
    posts,
    setSelectedProfileId,
    setIsAdminMode,
    setActiveTab
  } = useApp();

  const [activeTab, setActiveTabInternal] = useState<'overview' | 'media' | 'moderation' | 'notes'>('overview');
  const [newNote, setNewNote] = useState('');
  const [statusReason, setStatusReason] = useState('');
  const [selectedStatus, setSelectedStatus] = useState<UserAccountStatus>(user?.status || 'active');

  // Restrictions form state
  const [restrictPost, setRestrictPost] = useState(user?.restrictions?.cannotPost || false);
  const [restrictMessage, setRestrictMessage] = useState(user?.restrictions?.cannotMessage || false);
  const [restrictVault, setRestrictVault] = useState(user?.restrictions?.cannotRequestVault || false);

  const [roleReason, setRoleReason] = useState('');
  const [selectedRole, setSelectedRole] = useState<string>(user?.adminRole ?? '');

  if (!user) return null;

  const userPosts = posts.filter(p => p.userId === user.id);

  const statusLabels: Record<UserAccountStatus, string> = {
    active: 'Ativo', warned: 'Advertido', restricted: 'Restrito', suspended: 'Suspenso', blocked: 'Bloqueado'
  };

  const handleUpdateStatus = async () => {
    if (statusReason.trim().length < 5) {
      notify('Informe a justificativa (mínimo 5 caracteres). Ela fica registrada no livro de auditoria.');
      return;
    }
    if (await adminUpdateUserStatus(user.id, selectedStatus, statusReason.trim())) {
      setStatusReason('');
      notify(`Situação de @${user.username} alterada para "${statusLabels[selectedStatus]}". O usuário foi notificado.`);
    }
  };

  const handleAddNote = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newNote.trim().length < 5) return;
    if (await adminAddUserNote(user.id, newNote.trim())) setNewNote('');
  };

  const handleApplyRestrictions = async () => {
    const reason = await askText({ title: 'Aplicar restrições', message: 'Informe a justificativa (mínimo 5 caracteres):', confirmLabel: 'Aplicar', multiline: true });
    if (!reason || reason.trim().length < 5) return;
    const ok = await adminSetRestrictions(user.id, {
      cannotPost: restrictPost,
      cannotMessage: restrictMessage,
      cannotRequestVault: restrictVault
    }, reason.trim());
    if (ok) notify('Restrições atualizadas e registradas na auditoria.');
  };

  const handleVerify = async () => {
    if (await adminVerifyUserAge(user.id)) notify('Selo de verificação concedido. O usuário foi notificado.');
  };

  const handleSetRole = async () => {
    if (roleReason.trim().length < 5) {
      notify('Informe a justificativa (mínimo 5 caracteres).');
      return;
    }
    const role = selectedRole ? (selectedRole as 'superadmin' | 'moderator' | 'support' | 'auditor') : null;
    if (await adminSetUserRole(user.id, role, roleReason.trim())) {
      setRoleReason('');
      notify(role ? 'Papel na equipe atualizado.' : 'Acesso administrativo removido.');
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
      <div className="max-w-3xl w-full bg-[#120d20] border border-purple-800/40 rounded-3xl p-6 sm:p-8 shadow-2xl relative my-auto max-h-[90vh] flex flex-col">
        
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-purple-900/30">
          <div className="flex items-center gap-3">
            <div className="relative">
              <img
                src={user.avatarUrl}
                alt={user.displayName}
                className="w-12 h-12 rounded-full object-cover border-2 border-purple-500/50"
              />
              {user.isVerified && (
                <span className="absolute -bottom-1 -right-1 w-4 h-4 bg-purple-500 rounded-full flex items-center justify-center text-[10px] text-white">
                  ✓
                </span>
              )}
            </div>

            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold text-white">{user.displayName}</h3>
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded uppercase ${
                  user.status === 'active'
                    ? 'bg-emerald-950 text-emerald-400 border border-emerald-800'
                    : user.status === 'restricted'
                    ? 'bg-amber-950 text-amber-400 border border-amber-800'
                    : 'bg-rose-950 text-rose-400 border border-rose-800'
                }`}>
                  {user.status}
                </span>
              </div>
              <p className="text-xs text-zinc-400">
                @{user.username} • ID: <code className="text-purple-300">{user.id}</code>
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="text-zinc-400 hover:text-white p-1 rounded-full hover:bg-zinc-800 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Navigation Tabs */}
        <div className="flex items-center gap-2 border-b border-purple-900/30 py-3 overflow-x-auto scrollbar-none">
          {[
            { id: 'overview', label: 'Dados Cadastrais & Perfil' },
            { id: 'media', label: `Publicações & Mídias (${userPosts.length})` },
            { id: 'moderation', label: 'Status & Sanções' },
            { id: 'notes', label: `Notas Confidenciais (${user.moderationNotes?.length || 0})` }
          ].map(t => (
            <button
              key={t.id}
              onClick={() => setActiveTabInternal(t.id as any)}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                activeTab === t.id
                  ? 'bg-purple-600 text-white'
                  : 'text-zinc-400 hover:text-zinc-200 bg-zinc-900/50'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto py-4 space-y-4 text-xs pr-1">
          
          {/* TAB 1: OVERVIEW */}
          {activeTab === 'overview' && (
            <div className="space-y-4">
              
              {/* Sanitized Admin Data Grid (No passwords, tokens or intimate private leaks) */}
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 p-4 bg-zinc-950/70 border border-purple-900/30 rounded-2xl">
                <div>
                  <span className="text-[11px] text-zinc-500 font-semibold block">E-mail Cadastral</span>
                  <span className="text-zinc-200 font-mono text-[11px] truncate block">{user.email}</span>
                </div>
                <div>
                  <span className="text-[11px] text-zinc-500 font-semibold block">Localização</span>
                  <span className="text-zinc-200">{user.city}, {user.state}</span>
                </div>
                <div>
                  <span className="text-[11px] text-zinc-500 font-semibold block">Idade Primária</span>
                  <span className="text-zinc-200">{user.age} anos</span>
                </div>
                <div>
                  <span className="text-[11px] text-zinc-500 font-semibold block">Formato de Perfil</span>
                  <span className="text-zinc-200 capitalize">{user.profileType}</span>
                </div>
                <div>
                  <span className="text-[11px] text-zinc-500 font-semibold block">Nascimento (declarado)</span>
                  <span className="text-zinc-200">{user.birthdate ? new Date(user.birthdate + 'T12:00:00').toLocaleDateString('pt-BR') : 'Não informado'}</span>
                </div>
                <div>
                  <span className="text-[11px] text-zinc-500 font-semibold block">Denúncias Recebidas</span>
                  <span className={`font-bold ${user.reportsReceivedCount > 0 ? 'text-rose-400' : 'text-zinc-400'}`}>
                    {user.reportsReceivedCount} ocorrências
                  </span>
                </div>
                <div>
                  <span className="text-[11px] text-zinc-500 font-semibold block">Papel na Equipe</span>
                  <span className="text-amber-300 font-semibold">{user.adminRole ?? 'Nenhum'}</span>
                </div>
                <div>
                  <span className="text-[11px] text-zinc-500 font-semibold block">Última Atividade</span>
                  <span className="text-zinc-200">{user.lastActive}</span>
                </div>
                <div>
                  <span className="text-[11px] text-zinc-500 font-semibold block">Publicações</span>
                  <span className="text-zinc-200">{user.postsCount}</span>
                </div>
              </div>

              {/* Cover Preview */}
              <div>
                <span className="text-[11px] text-zinc-400 font-semibold block mb-1">Foto de Capa Atual:</span>
                <div className="h-28 rounded-2xl overflow-hidden bg-black border border-purple-900/30">
                  <img src={user.coverUrl} alt="Capa" className="w-full h-full object-cover" />
                </div>
              </div>

              {/* View as User Button */}
              <div className="pt-2 flex items-center justify-between">
                <span className="text-[11px] text-zinc-400">
                  Registrado no sistema desde {user.createdAt}
                </span>
                <button
                  onClick={() => {
                    setSelectedProfileId(user.id);
                    setIsAdminMode(false);
                    setActiveTab('profile');
                    onClose();
                  }}
                  className="px-4 py-2 rounded-xl bg-purple-950/60 hover:bg-purple-900/60 border border-purple-800 text-purple-200 font-bold text-xs flex items-center gap-1.5 cursor-pointer"
                >
                  <Eye className="w-3.5 h-3.5" />
                  <span>Ver Perfil Social Completo</span>
                </button>
              </div>

            </div>
          )}

          {/* TAB 2: MEDIA & POSTS */}
          {activeTab === 'media' && (
            <div className="space-y-4">
              <h4 className="font-bold text-white text-xs">Publicações Registradas no Feed</h4>
              {userPosts.length > 0 ? (
                <div className="space-y-3">
                  {userPosts.map(p => (
                    <div key={p.id} className="p-3 bg-zinc-950/60 border border-zinc-800 rounded-2xl space-y-2">
                      <p className="text-zinc-200 text-xs">{p.content}</p>
                      {p.mediaUrls && p.mediaUrls.length > 0 && (
                        <div className="flex gap-2">
                          {p.mediaUrls.map((u, i) => (
                            <img key={i} src={u} alt="post" className="w-16 h-16 rounded-xl object-cover border border-purple-900/40" />
                          ))}
                        </div>
                      )}
                      <div className="text-[10px] text-zinc-500 flex items-center justify-between">
                        <span>Postado em: {p.createdAt}</span>
                        <span>{p.likesCount} curtidas • {p.commentsCount} comentários</span>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-zinc-400 text-xs bg-zinc-900/40 p-4 rounded-xl text-center">
                  O usuário não possui publicações públicas ativas no feed.
                </p>
              )}
            </div>
          )}

          {/* TAB 3: MODERATION & SANCTIONS */}
          {activeTab === 'moderation' && (
            <div className="space-y-4">
              
              {/* Account Status Switcher */}
              <div className="p-4 bg-zinc-950/70 border border-purple-900/30 rounded-2xl space-y-3">
                <label className="block text-xs font-bold text-white">Alterar Situação da Conta:</label>
                <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
                  {[
                    { id: 'active', label: 'Ativo' },
                    { id: 'warned', label: 'Advertido' },
                    { id: 'restricted', label: 'Restrito' },
                    { id: 'suspended', label: 'Suspenso' },
                    { id: 'blocked', label: 'Bloqueado' }
                  ].map(s => (
                    <button
                      key={s.id}
                      type="button"
                      onClick={() => setSelectedStatus(s.id as UserAccountStatus)}
                      className={`py-2 px-2 text-xs font-bold rounded-xl border transition-all cursor-pointer ${
                        selectedStatus === s.id
                          ? 'bg-purple-600 border-purple-400 text-white shadow'
                          : 'bg-zinc-900 border-zinc-800 text-zinc-400'
                      }`}
                    >
                      {s.label}
                    </button>
                  ))}
                </div>

                <div>
                  <label className="block text-[11px] text-zinc-400 font-semibold mb-1">
                    Justificativa da Ação (Auditada em Log):
                  </label>
                  <input
                    type="text"
                    placeholder="Ex: Advertência por fotos inadequadas / Reativação após análise..."
                    value={statusReason}
                    onChange={e => setStatusReason(e.target.value)}
                    className="w-full px-3 py-2 bg-zinc-900 border border-zinc-800 rounded-xl text-xs text-white"
                  />
                </div>

                <button
                  type="button"
                  onClick={handleUpdateStatus}
                  className="px-4 py-2 bg-gradient-to-r from-purple-600 to-rose-600 hover:from-purple-500 text-white rounded-xl font-bold text-xs cursor-pointer shadow"
                >
                  Salvar Situação no Banco
                </button>
              </div>

              {/* Functional Restrictions */}
              <div className="p-4 bg-zinc-950/70 border border-purple-900/30 rounded-2xl space-y-3">
                <span className="text-xs font-bold text-white block">
                  Restrições de Funcionalidades Específicas:
                </span>
                
                <div className="space-y-2">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={restrictPost}
                      onChange={e => setRestrictPost(e.target.checked)}
                      className="accent-purple-500 rounded"
                    />
                    <span className="text-xs text-zinc-300">Bloquear criação de novas publicações no feed</span>
                  </label>

                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={restrictMessage}
                      onChange={e => setRestrictMessage(e.target.checked)}
                      className="accent-purple-500 rounded"
                    />
                    <span className="text-xs text-zinc-300">Bloquear envio de mensagens privadas</span>
                  </label>

                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={restrictVault}
                      onChange={e => setRestrictVault(e.target.checked)}
                      className="accent-purple-500 rounded"
                    />
                    <span className="text-xs text-zinc-300">Bloquear solicitações de acesso a cofres íntimos</span>
                  </label>
                </div>

                <button
                  type="button"
                  onClick={handleApplyRestrictions}
                  className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 rounded-xl font-bold text-xs cursor-pointer"
                >
                  Aplicar Restrições
                </button>
              </div>

              {/* Verify Badge Action */}
              {!user.isVerified && (
                <div className="p-4 bg-emerald-950/20 border border-emerald-900/40 rounded-2xl flex items-center justify-between">
                  <div>
                    <h5 className="font-bold text-emerald-300 text-xs">Selo de Verificação +18</h5>
                    <p className="text-[11px] text-zinc-400">
                      {user.verificationRequested ? 'O usuário pediu a verificação no cadastro.' : 'O usuário não pediu verificação.'}
                    </p>
                  </div>
                  <button
                    onClick={handleVerify}
                    className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-xl cursor-pointer"
                  >
                    Aprovar Selo
                  </button>
                </div>
              )}

              {/* Equipe administrativa (somente superadmin) */}
              {adminRole === 'superadmin' && (
                <div className="p-4 bg-amber-950/20 border border-amber-900/40 rounded-2xl space-y-3">
                  <span className="text-xs font-bold text-amber-300 block">Papel na Equipe Administrativa</span>
                  <p className="text-[11px] text-zinc-400">Moderadores precisam ativar o MFA no primeiro acesso ao painel.</p>
                  <div className="flex flex-col sm:flex-row gap-2">
                    <select
                      value={selectedRole}
                      onChange={e => setSelectedRole(e.target.value)}
                      className="px-3 py-2 bg-zinc-900 border border-zinc-800 rounded-xl text-xs text-white"
                    >
                      <option value="">Sem acesso administrativo</option>
                      <option value="moderator">Moderador</option>
                      <option value="support">Suporte (somente leitura)</option>
                      <option value="auditor">Auditor (somente leitura)</option>
                    </select>
                    <input
                      type="text"
                      placeholder="Justificativa"
                      value={roleReason}
                      onChange={e => setRoleReason(e.target.value)}
                      className="flex-1 min-w-0 px-3 py-2 bg-zinc-900 border border-zinc-800 rounded-xl text-xs text-white"
                    />
                    <button
                      type="button"
                      onClick={handleSetRole}
                      className="px-4 py-2 bg-amber-500 hover:bg-amber-400 text-black font-bold text-xs rounded-xl cursor-pointer"
                    >
                      Salvar papel
                    </button>
                  </div>
                </div>
              )}

            </div>
          )}

          {/* TAB 4: CONFIDENTIAL MODERATION NOTES */}
          {activeTab === 'notes' && (
            <div className="space-y-4">
              <form onSubmit={handleAddNote} className="space-y-2">
                <label className="block text-xs font-bold text-white">Nova Observação Administrativa (Privada):</label>
                <textarea
                  rows={2}
                  value={newNote}
                  onChange={e => setNewNote(e.target.value)}
                  placeholder="Registre apontamentos sobre reincidência, conversas ou alertas de segurança..."
                  className="w-full px-3 py-2 bg-zinc-950 border border-purple-900/30 rounded-xl text-xs text-white"
                />
                <button
                  type="submit"
                  disabled={!newNote.trim()}
                  className="px-4 py-2 bg-purple-600 hover:bg-purple-500 text-white rounded-xl font-bold text-xs flex items-center gap-1.5 cursor-pointer disabled:opacity-40"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Adicionar Nota</span>
                </button>
              </form>

              <div className="space-y-2 pt-2">
                {user.moderationNotes && user.moderationNotes.length > 0 ? (
                  user.moderationNotes.map(n => (
                    <div key={n.id} className="p-3 bg-zinc-950/70 border border-zinc-800 rounded-xl space-y-1">
                      <div className="flex items-center justify-between text-[10px] text-zinc-400">
                        <span className="font-bold text-purple-300">{n.adminName}</span>
                        <span>{n.createdAt}</span>
                      </div>
                      <p className="text-zinc-200 text-xs">{n.note}</p>
                    </div>
                  ))
                ) : (
                  <p className="text-zinc-400 text-xs text-center py-4">Nenhuma nota interna registrada para esta conta.</p>
                )}
              </div>
            </div>
          )}

        </div>

      </div>
    </div>
  );
};
