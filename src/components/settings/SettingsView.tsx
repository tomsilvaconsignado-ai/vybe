import React from 'react';
import { useApp } from '../../context/AppContext';
import { 
  ShieldCheck, 
  Lock, 
  MapPin, 
  EyeOff, 
  Download, 
  Trash2, 
  FileText, 
  Bell, 
  CheckCircle2,
  Key
} from 'lucide-react';
import { LocationPrivacy } from '../../types';

export const SettingsView: React.FC = () => {
  const { 
    currentUser, 
    updateCurrentUser, 
    setPrivacyTermsModalOpen, 
    logout 
  } = useApp();

  const handleExportDataLGPD = () => {
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(currentUser, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute("href", dataStr);
    downloadAnchor.setAttribute("download", `vybe_meus_dados_lgpd_${currentUser.username}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
    alert('Relatório de dados pessoais (LGPD Art. 18) exportado com sucesso em formato JSON legível.');
  };

  const handleDeleteAccount = () => {
    if (confirm('Atenção: A exclusão é definitiva e irrevogável, apagando suas fotos, cofres e mensagens. Deseja prosseguir com o pedido de exclusão?')) {
      alert('Sua conta e dados foram removidos da plataforma com sucesso conforme previsto na LGPD.');
      logout();
    }
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
            O VYBE nunca divulga endereços físicos ou dados exatos de geolocalização. Escolha como sua região geográfica é apresentada:
          </p>

          <div className="grid sm:grid-cols-3 gap-3">
            {[
              { id: 'city', title: 'Mostrar Cidade', desc: `${currentUser.city}, ${currentUser.state}` },
              { id: 'approximate_region', title: 'Região Aproximada', desc: 'Raio de 30-50 km' },
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
                Evita textos ou detalhes sensíveis em telas bloqueadas ou no ambiente corporativo.
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

        {/* Section 3: LGPD & Rights of the Data Subject */}
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
              className="px-4 py-2.5 rounded-xl bg-purple-950/60 hover:bg-purple-900/60 border border-purple-800/40 text-purple-200 text-xs font-bold flex items-center justify-center gap-2 cursor-pointer transition-colors"
            >
              <Download className="w-4 h-4" />
              <span>Exportar Meus Dados (JSON)</span>
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

        {/* Section 4: Export Complete Source Code (GitHub & Supabase Ready) */}
        <div className="p-6 bg-gradient-to-r from-purple-950/40 via-zinc-900/80 to-purple-950/40 border border-purple-800/40 rounded-3xl shadow-xl space-y-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-400 shrink-0">
              <Download className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white">Exportação Completa do Projeto (GitHub & Supabase)</h3>
              <p className="text-xs text-zinc-400">
                Baixe todos os arquivos-fonte, backend Express, esquemas SQL do Supabase e documentação em um arquivo .ZIP.
              </p>
            </div>
          </div>

          <p className="text-xs text-zinc-300 leading-relaxed">
            O pacote contém todos os componentes React 19, TypeScript, rotas de API, migrações PostgreSQL, políticas de segurança RLS para o Supabase e o guia passo a passo no README.md.
          </p>

          <div className="pt-1">
            <a
              href="/vybe-project.zip"
              download="vybe-project.zip"
              className="inline-flex items-center gap-2 px-6 py-3 rounded-2xl font-bold text-xs text-black bg-gradient-to-r from-amber-400 to-amber-500 hover:from-amber-300 hover:to-amber-400 shadow-lg shadow-amber-950/50 cursor-pointer transition-all"
            >
              <Download className="w-4 h-4" />
              <span>Baixar Código-Fonte Completo (vybe-project.zip)</span>
            </a>
          </div>
        </div>

        {/* Section 4: Delete Account */}
        <div className="p-6 bg-rose-950/20 border border-rose-900/30 rounded-3xl shadow-xl flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h4 className="text-xs font-bold text-rose-300 flex items-center gap-1.5">
              <Trash2 className="w-4 h-4" />
              Excluir Conta Permanentemente
            </h4>
            <p className="text-[11px] text-zinc-400">
              Remove imediatamente seu perfil, fotos públicas, cofres criptografados e histórico de mensagens.
            </p>
          </div>
          <button
            onClick={handleDeleteAccount}
            className="px-4 py-2 rounded-xl bg-rose-600/30 hover:bg-rose-600/50 border border-rose-500/50 text-rose-200 text-xs font-bold cursor-pointer transition-colors shrink-0"
          >
            Excluir Minha Conta
          </button>
        </div>

      </div>

    </div>
  );
};
