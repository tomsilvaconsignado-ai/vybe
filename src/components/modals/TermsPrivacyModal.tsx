import React from 'react';
import { useApp } from '../../context/AppContext';
import { ShieldCheck, X, FileText, Lock, Heart, CheckCircle2 } from 'lucide-react';

export const TermsPrivacyModal: React.FC = () => {
  const { privacyTermsModalOpen, setPrivacyTermsModalOpen } = useApp();

  if (!privacyTermsModalOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-4">
      <div className="max-w-2xl w-full bg-[#110c1c] border border-purple-800/40 rounded-3xl p-6 sm:p-8 shadow-2xl relative max-h-[85vh] flex flex-col">
        
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-purple-900/30">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-purple-600/20 border border-purple-500/30 flex items-center justify-center text-purple-400">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white">Termos de Uso & Política de Privacidade</h2>
              <p className="text-xs text-zinc-400">Vybelog — Conformidade com a Lei Geral de Proteção de Dados (LGPD)</p>
            </div>
          </div>
          <button
            onClick={() => setPrivacyTermsModalOpen(false)}
            className="text-zinc-400 hover:text-white p-1 rounded-full hover:bg-zinc-800 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Terms Content */}
        <div className="overflow-y-auto py-4 space-y-4 text-xs text-zinc-300 leading-relaxed pr-2">
          
          <div className="p-3 bg-rose-950/20 border border-rose-900/40 rounded-2xl">
            <h4 className="font-bold text-rose-300 text-sm mb-1 flex items-center gap-1.5">
              <Heart className="w-4 h-4 text-rose-400" />
              1. Princípio Absoluto: Consentimento e Respeito
            </h4>
            <p>
              O Vybelog fundamenta-se na autonomia do corpo, da intimidade e da vontade consciente. Toda e qualquer interação, conversa, troca de mídia ou encontro presencial entre adultos cadastrados deve ser estritamente consensual e mútua. O "Não" é definitivo em qualquer etapa. É vedado qualquer ato de coerção, chantagem ou importunação.
            </p>
          </div>

          <div>
            <h4 className="font-bold text-purple-300 text-sm mb-1">
              2. Maioridade Legal e Verificação (+18)
            </h4>
            <p>
              O ingresso e a permanência na rede são restritos a maiores de 18 anos civis no Brasil. O Vybelog implementa checagens e reserva-se o direito de exigir comprovação biométrica ou documental para perfis com atividade suspeita. Contas de menores ou de quem fornecer dados falsos serão imediatamente banidas com notificação aos órgãos competentes.
            </p>
          </div>

          <div>
            <h4 className="font-bold text-purple-300 text-sm mb-1">
              3. Proteção aos Cofres Íntimos e Propriedade de Mídia
            </h4>
            <p>
              Mídias armazenadas em cofres privados possuem criptografia e restrição no servidor. Apenas pessoas a quem o proprietário concedeu explicitamente a chave de acesso podem visualizá-las. A captura não autorizada de tela, download forçado ou redistribuição externa de mídias de terceiros constitui infração gravíssima sujeita a banimento permanente e responsabilização civil e criminal.
            </p>
          </div>

          <div>
            <h4 className="font-bold text-purple-300 text-sm mb-1">
              4. Privacidade da Localização
            </h4>
            <p>
              O endereço residencial exato ou dados de GPS em tempo real nunca são divulgados publicamente. O usuário possui pleno controle de exibir sua cidade, uma aproximação regional ou ocultar completamente sua localização geográfica.
            </p>
          </div>

          <div>
            <h4 className="font-bold text-purple-300 text-sm mb-1">
              5. Conformidade com a LGPD (Lei nº 13.709/2018)
            </h4>
            <p>
              Você é o titular dos seus dados pessoais. Respostas fornecidas em questionários de compatibilidade têm como única finalidade refinar o algoritmo de afinidades e nunca serão comercializadas para anunciantes externos. Você pode retificar, exportar ou solicitar a exclusão irrevogável de seus dados a qualquer momento nas Configurações.
            </p>
          </div>

          <div>
            <h4 className="font-bold text-purple-300 text-sm mb-1">
              6. Moderação Justificada e Registro de Acessos
            </h4>
            <p>
              Nossa equipe administrativa não lê conversas privadas de forma indiscriminada. O exame técnico ocorre exclusivamente mediante denúncia fundamentada de usuário ou flagrante violação dos termos legais, sendo todo acesso registrado em log de auditoria rastreável.
            </p>
          </div>

        </div>

        {/* Footer */}
        <div className="pt-4 border-t border-purple-900/30 flex items-center justify-between">
          <span className="text-[11px] text-zinc-400">Última atualização: Outubro de 2026</span>
          <button
            onClick={() => setPrivacyTermsModalOpen(false)}
            className="px-6 py-2.5 rounded-xl font-bold text-xs text-white bg-gradient-to-r from-purple-600 to-rose-600 hover:from-purple-500 hover:to-rose-500 transition-all cursor-pointer shadow-md shadow-purple-950/50"
          >
            Entendido e Concordo
          </button>
        </div>

      </div>
    </div>
  );
};
