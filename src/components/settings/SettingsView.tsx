import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { exportOwnData } from '../../lib/activity';
import { 
  ShieldCheck, 
  Lock, 
  MapPin, 
  EyeOff, 
  Download, 
  FileText, 
  Bell, 
  CheckCircle2,
  Key,
  Ban
} from 'lucide-react';
import { LocationPrivacy } from '../../types';

export const SettingsView: React.FC = () => {
  const { 
    currentUser, 
    updateCurrentUser, 
    setPrivacyTermsModalOpen,
    deleteAccount,
    blockedUsers,
    unblockUser
  } = useApp();

  const [exporting, setExporting] = useState(false);

  const handleExportDataLGPD = async () => {
    setExporting(true);
    const exportData = await exportOwnData(currentUser.id);
    setExporting(false);
    const url = URL.createObjectURL(new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' }));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute("href", url);
    downloadAnchor.setAttribute("download", `vybe_meus_dados_lgpd_${currentUser.username}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
    URL.revokeObjectURL(url);
    alert('Relatório de dados pessoais (LGPD Art. 18) exportado com sucesso em formato JSON legível.');
  };

  const handleDeleteAccount = async () => {
    if (!confirm('Atenção: A exclusão é definitiva e irrevogável, apagando seu perfil, fotos, publicações, cofres e mensagens. Deseja prosseguir?')) return;
    const typed = prompt(`Para confirmar, digite seu nome de usuário: ${currentUser.username}`);
    if (typed?.trim() !== currentUser.username) {
      alert('Nome de usuário não confere. A conta não foi excluída.');
      return;
    }
    const error = await deleteAccount();
    if (error) {
      alert(`Não foi possível excluir a conta: ${error}`);
      return;
    }
    alert('Sua conta e seus dados foram excluídos definitivamente, conforme a LGPD.');
  };

  return (
    <div className="max-w-3xl mx-auto py-6 px-4">
      
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-extrabold text-white flex items-center gap-2">
          <span>Configurações & Privacidade</span>
        </h1>
        <p className="text-xs text-zinc-400 mt-0.5">
          Controle de privacidade, conformidade com a LGPD e preferências de discrição.
        </p>
      </div>

      <div className="space-y-6">
        
        {/* Section 1: Location & Discretion */}
        <div className="p-6 bg-[#120d20] border border-purple-900/30 rounded-3xl shadow-xl space-y-4">
          <h3 className="text-sm font-bold text-white flex items-center gap-2">
            <MapPin className="w-4 h-4 text-rose-400" />
            <span>Privacidade da sua Localização</span>
          </h3>

          <p className="text-xs text-zinc-300 leading-relaxed">
            O Vybelog nunca divulga endereços físicos ou dados exatos de geolocalização. Escolha como sua região geográfica é apresentada:
          </p>

          <div className="grid sm:grid-cols-3 gap-3">
            {[
              { id: 'city', title: 'Mostrar Cidade', desc: `${currentUser.city}, ${currentUser.state}` },
              { id: 'approximate_region', title: 'Região Aproximada', desc: 'Mostra só o estado' },
              { id: 'hidden', title: 'Ocultar Localização', desc: 'Não exibe distância' },
            ].map(opt => (
              <button
                key={opt.id}
                onClick={() => updateCurrentUser({ locationPrivacy: opt.id as LocationPrivacy })}
                className={`p-3 rounded-2xl border text-left transition-all cursor-pointer ${
                  currentUser.locationPrivacy === opt.id
                    ? 'bg-purple-950 border-purple-500 text-white shadow-md'
                    : 'bg-zinc-900/50 border-zinc-800 text-zinc-400 hover:border-zinc-700'
                }`}
              >
                <div className="font-bold text-xs text-zinc-100">{opt.title}</div>
                <div className="text-[10px] text-zinc-400">{opt.desc}</div>
              </button>
            ))}
          </div>
        </div>

        {/* Section 2: Notifications & Discreet Screen Mode */}
        <div className="p-6 bg-[#120d20] border border-purple-900/30 rounded-3xl shadow-xl space-y-4">
          <h3 className="text-sm font-bold text-white flex items-center gap-2">
            <EyeOff className="w-4 h-4 text-fuchsia-400" />
            <span>Modo Discreto de Visualização</span>
          </h3>

          <div className="flex items-center justify-between gap-4">
            <div>
              <h4 className="text-xs font-bold text-zinc-200">Notificações sem Prévias Íntimas</h4>
              <p className="text-[11px] text-zinc-400">
                Evita textos ou detalhes sensíveis em telas bloqueadas ou no ambiente corporativo e esconde de outras pessoas o horário em que você esteve on-line (aparece só o dia).
              </p>
            </div>
            <button
              onClick={() => updateCurrentUser({ discreetModeEnabled: !currentUser.discreetModeEnabled })}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                currentUser.discreetModeEnabled
                  ? 'bg-emerald-600 text-white'
                  : 'bg-zinc-800 text-zinc-400'
              }`}
            >
              {currentUser.discreetModeEnabled ? 'Habilitado' : 'Desabilitado'}
            </button>
          </div>
        </div>

        {/* Section 3: Blocked profiles */}
        <div className="p-6 bg-[#120d20] border border-purple-900/30 rounded-3xl shadow-xl space-y-4">
          <h3 className="text-sm font-bold text-white flex items-center gap-2">
            <Ban className="w-4 h-4 text-rose-400" />
            <span>Perfis Bloqueados</span>
          </h3>
          <p className="text-xs text-zinc-300 leading-relaxed">
            Quem você bloqueia não vê seu perfil, posts e stories e não pode seguir, pedir conexão, enviar mensagens ou pedir acesso aos seus cofres. A pessoa não é avisada.
          </p>
          {blockedUsers.length === 0 ? (
            <p className="text-[11px] text-zinc-500">Você não bloqueou ninguém.</p>
          ) : (
            <ul className="space-y-2">
              {blockedUsers.map(b => (
                <li key={b.id} className="flex items-center justify-between gap-3 p-2.5 rounded-2xl bg-zinc-900/50 border border-zinc-800">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <img src={b.avatarUrl} alt="" className="w-8 h-8 rounded-full object-cover shrink-0" />
                    <div className="min-w-0">
                      <span className="block text-xs font-bold text-zinc-100 truncate">{b.displayName}</span>
                      {b.username && <span className="block text-[11px] text-zinc-500 truncate">@{b.username}</span>}
                    </div>
                  </div>
                  <button
                    onClick={() => {
                      if (confirm(`Desbloquear ${b.displayName}? A pessoa volta a ver seu perfil e poderá interagir com você. Seguir e conexões desfeitos no bloqueio não voltam sozinhos.`)) unblockUser(b.id);
                    }}
                    className="px-3 py-1.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-[11px] font-bold cursor-pointer transition-colors shrink-0"
                  >
                    Desbloquear
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Section 4: LGPD & Rights of the Data Subject */}
        <div className="p-6 bg-[#120d20] border border-purple-900/30 rounded-3xl shadow-xl space-y-4">
          <h3 className="text-sm font-bold text-white flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-emerald-400" />
            <span>Direitos do Titular de Dados (LGPD)</span>
          </h3>

          <p className="text-xs text-zinc-300 leading-relaxed">
            Você é titular soberano de suas informações. Você tem o direito de exportar todos os seus dados pessoais ou solicitar a revogação de consentimento e eliminação completa.
          </p>

          <div className="flex flex-col sm:flex-row gap-3 pt-2">
            <button
              onClick={handleExportDataLGPD}
              disabled={exporting}
              className="px-4 py-2.5 rounded-xl bg-purple-950/60 hover:bg-purple-900/60 border border-purple-800/40 text-purple-200 text-xs font-bold flex items-center justify-center gap-2 cursor-pointer transition-colors"
            >
              <Download className="w-4 h-4" />
              <span>{exporting ? 'Reunindo seus dados...' : 'Exportar Meus Dados (JSON)'}</span>
            </button>

            <button
              onClick={() => setPrivacyTermsModalOpen(true)}
              className="px-4 py-2.5 rounded-xl bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-zinc-300 text-xs font-bold flex items-center justify-center gap-2 cursor-pointer transition-colors"
            >
              <FileText className="w-4 h-4" />
              <span>Consultar Termos & LGPD</span>
            </button>
          </div>
        </div>

      </div>

      {/* Exclusão de conta: discreta e recolhida, mas sempre disponível (LGPD art. 18, VI) */}
      <details className="mt-10 text-center group">
        <summary className="list-none inline-block text-[11px] text-zinc-600 hover:text-zinc-400 cursor-pointer select-none">
          Outras opções da conta
        </summary>
        <div className="mt-3 space-y-2">
          <p className="text-[11px] text-zinc-500 max-w-md mx-auto">
            A exclusão remove definitivamente seu perfil, fotos, cofres e mensagens.
          </p>
          <button
            onClick={handleDeleteAccount}
            className="text-[11px] text-zinc-500 hover:text-rose-400 underline underline-offset-2 cursor-pointer transition-colors"
          >
            Excluir conta
          </button>
        </div>
      </details>

    </div>
  );
};
