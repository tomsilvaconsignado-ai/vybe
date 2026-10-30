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
import { notify, askConfirm, askText } from '../common/Feedback';

export const SettingsView: React.FC = () => {
  const { 
    currentUser, 
    updateCurrentUser, 
    setPrivacyTermsModalOpen,
    deleteAccount,
    blockedUsers,
    unblockUser,
    hasLocation,
    enableLocation,
    disableLocation
  } = useApp();

  const [exporting, setExporting] = useState(false);
  const [locationBusy, setLocationBusy] = useState(false);

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
    notify('Relatório de dados pessoais (LGPD Art. 18) exportado com sucesso em formato JSON legível.');
  };

  const handleDeleteAccount = async () => {
    if (!(await askConfirm({ title: 'Excluir conta?', message: 'A exclusão é definitiva: apaga seu perfil, fotos, publicações, cofres e mensagens.', confirmLabel: 'Continuar', danger: true }))) return;
    const typed = await askText({ title: "Confirme a exclusão", message: `Digite seu nome de usuário: ${currentUser.username}`, placeholder: currentUser.username, confirmLabel: "Excluir conta", danger: true });
    if (typed?.trim() !== currentUser.username) {
      notify('Nome de usuário não confere. A conta não foi excluída.');
      return;
    }
    const error = await deleteAccount();
    if (error) {
      notify(`Não foi possível excluir a conta: ${error}`);
      return;
    }
    notify('Sua conta e seus dados foram excluídos definitivamente, conforme a LGPD.');
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
              { id: 'city', title: 'Mostrar Cidade', desc: `${currentUser.city}, ${currentUser.state} · distância de ~2 km em ~2 km` },
              { id: 'approximate_region', title: 'Região Aproximada', desc: 'Mostra só o estado · distância de 5 em 5 km' },
              { id: 'hidden', title: 'Ocultar Localização', desc: 'Sem distância (e você não vê a dos outros)' },
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

          {/* Localização para a busca por distância */}
          <div className="pt-4 border-t border-purple-900/30 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h4 className="text-xs font-bold text-zinc-200">Busca por distância</h4>
              <p className="text-[11px] text-zinc-400">
                {hasLocation
                  ? 'Ativada. Guardamos só uma área aproximada (~2 km), atualizada quando você abre o app.'
                  : 'Desativada. Ative para ver a distância até as pessoas e usar o filtro "Só perto de mim".'}
              </p>
            </div>
            <div className="flex gap-2 shrink-0">
              <button
                type="button"
                disabled={locationBusy}
                onClick={async () => {
                  setLocationBusy(true);
                  const error = await enableLocation();
                  setLocationBusy(false);
                  notify(error ?? 'Localização atualizada.', error ? 'error' : 'success');
                }}
                className="px-4 py-2 rounded-xl text-xs font-bold bg-purple-700 hover:bg-purple-600 text-white disabled:opacity-50 cursor-pointer"
              >
                {locationBusy ? 'Localizando...' : hasLocation ? 'Atualizar' : 'Ativar'}
              </button>
              {hasLocation && (
                <button
                  type="button"
                  disabled={locationBusy}
                  onClick={async () => {
                    setLocationBusy(true);
                    const error = await disableLocation();
                    setLocationBusy(false);
                    notify(error ?? 'Localização apagada. Você não aparece mais nas buscas por distância.', error ? 'error' : 'success');
                  }}
                  className="px-4 py-2 rounded-xl text-xs font-bold bg-zinc-800 hover:bg-zinc-700 text-zinc-200 disabled:opacity-50 cursor-pointer"
                >
                  Desativar
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Status online (ligado por padrão; recíproco) */}
        <div className="p-6 bg-[#120d20] border border-purple-900/30 rounded-3xl shadow-xl space-y-4">
          <h3 className="text-sm font-bold text-white flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
            <span>Status Online</span>
          </h3>

          <div className="flex items-center justify-between gap-4">
            <div>
              <h4 className="text-xs font-bold text-zinc-200">Mostrar quando estou online</h4>
              <p className="text-[11px] text-zinc-400">
                Outros membros veem a bolinha verde e "Online agora" no seu perfil e nas conversas.
                Se você desligar, ninguém verá seu status nem há quanto tempo você esteve ativo, e você
                também deixará de ver se os outros estão online.
              </p>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={currentUser.showOnlineStatus !== false}
              onClick={() => updateCurrentUser({ showOnlineStatus: currentUser.showOnlineStatus === false })}
              className={`relative w-12 h-7 rounded-full shrink-0 transition-colors cursor-pointer ${
                currentUser.showOnlineStatus !== false ? 'bg-emerald-600' : 'bg-zinc-700'
              }`}
            >
              <span className={`absolute top-1 w-5 h-5 rounded-full bg-white shadow transition-all ${
                currentUser.showOnlineStatus !== false ? 'left-6' : 'left-1'
              }`} />
              <span className="sr-only">Mostrar quando estou online</span>
            </button>
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
                    onClick={async () => {
                      if (await askConfirm({ title: `Desbloquear ${b.displayName}?`, message: "A pessoa volta a ver seu perfil e poderá interagir com você. Seguir e conexões desfeitos no bloqueio não voltam sozinhos.", confirmLabel: "Desbloquear" })) unblockUser(b.id);
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
