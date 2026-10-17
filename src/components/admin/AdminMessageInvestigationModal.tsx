import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { 
  X, 
  ShieldAlert, 
  Lock, 
  Eye, 
  CheckCircle2, 
  AlertTriangle, 
  FileText,
  KeyRound
} from 'lucide-react';
import { ModerationReport } from '../../types';

interface AdminMessageInvestigationModalProps {
  report: ModerationReport | null;
  onClose: () => void;
}

export const AdminMessageInvestigationModal: React.FC<AdminMessageInvestigationModalProps> = ({ report, onClose }) => {
  const { adminInvestigateMessage, currentUser, adminRole } = useApp();

  const [justification, setJustification] = useState('');
  const [isUnlocked, setIsUnlocked] = useState(false);
  const [revealedEvidence, setRevealedEvidence] = useState<any>(null);
  const [isLogging, setIsLogging] = useState(false);

  if (!report) return null;

  const handleAuthorizeInspection = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!justification.trim() || justification.trim().length < 10) {
      alert('A justificativa deve conter no mínimo 10 caracteres fundamentando o motivo legal/operacional da auditoria.');
      return;
    }

    setIsLogging(true);
    try {
      const res = await adminInvestigateMessage(report.id, justification.trim());
      setIsUnlocked(true);
      setRevealedEvidence({
        reportId: report.id,
        reporter: report.reporterName,
        reportedUser: report.reportedUserName,
        timestamp: new Date().toLocaleTimeString(),
        messages: [
          {
            id: 'flag_msg_01',
            sender: report.reportedUserName,
            text: 'Mídia sinalizada enviada sem autorização prévia pelo usuário denunciado.',
            mediaUrl: 'https://images.unsplash.com/photo-1518199266791-5375a83190b7?w=600&auto=format&fit=crop&q=80',
            hasConsent: false
          }
        ]
      });
    } finally {
      setIsLogging(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-4">
      <div className="max-w-xl w-full bg-[#120d20] border border-amber-500/40 rounded-3xl p-6 sm:p-8 shadow-2xl relative">
        <button
          onClick={onClose}
          className="absolute top-5 right-5 text-zinc-400 hover:text-white p-1 rounded-full hover:bg-zinc-800 transition-colors cursor-pointer"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-xl bg-amber-500/20 border border-amber-500/30 flex items-center justify-center text-amber-400">
            <ShieldAlert className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-base font-bold text-white">Investigação Estrita de Mensagem Sinalizada</h3>
            <p className="text-xs text-zinc-400">Denúncia Vinculada: <strong className="text-amber-300">{report.id}</strong></p>
          </div>
        </div>

        {!isUnlocked ? (
          <form onSubmit={handleAuthorizeInspection} className="space-y-4">
            <div className="p-4 bg-amber-950/20 border border-amber-800/40 rounded-2xl text-xs text-amber-200 leading-relaxed">
              <strong>Proteção à Privacidade & LGPD:</strong> O acesso a conteúdos de conversas é estritamente restrito à investigação de denúncias formais. Este acesso será gravado no livro de auditoria imutável com sua identificação (<strong>{currentUser.email}</strong>), carimbo de tempo e IP.
            </div>

            <div>
              <label className="block text-xs font-semibold text-zinc-300 mb-1">
                Justificativa Obrigatória da Investigação:
              </label>
              <textarea
                rows={3}
                value={justification}
                onChange={e => setJustification(e.target.value)}
                placeholder="Descreva o fundamento (Ex: Apuração de denúncia REP-01 referente a assédio ou envio não consentido)..."
                required
                className="w-full px-3 py-2 bg-zinc-950 border border-amber-600/30 rounded-xl text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-amber-500"
              />
              <span className="text-[10px] text-zinc-500 mt-1 block">
                Mínimo de 10 caracteres. Ação auditada.
              </span>
            </div>

            <div className="pt-2 flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-xs font-semibold text-zinc-400 hover:text-white"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={isLogging}
                className="px-5 py-2.5 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 text-black font-bold text-xs rounded-xl shadow-lg cursor-pointer transition-all disabled:opacity-50"
              >
                {isLogging ? 'Registrando em Log...' : 'Autenticar e Abrir Evidência'}
              </button>
            </div>
          </form>
        ) : (
          <div className="space-y-4">
            <div className="p-3 bg-emerald-950/30 border border-emerald-800/40 rounded-xl text-xs text-emerald-300 flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 shrink-0" />
              <span>Acesso gravado no livro de auditoria. Exibindo estritamente a mensagem objeto da denúncia.</span>
            </div>

            <div className="p-4 bg-zinc-950/80 border border-purple-900/40 rounded-2xl space-y-3">
              <div className="flex items-center justify-between text-xs border-b border-zinc-800 pb-2">
                <span className="text-zinc-400">Denunciado: <strong className="text-white">@{revealedEvidence.reportedUser}</strong></span>
                <span className="text-zinc-400">Horário: {revealedEvidence.timestamp}</span>
              </div>

              {revealedEvidence.messages.map((m: any) => (
                <div key={m.id} className="space-y-2">
                  <p className="text-xs text-zinc-200 bg-zinc-900 p-2.5 rounded-xl border border-zinc-800">
                    "{m.text}"
                  </p>
                  {m.mediaUrl && (
                    <div className="relative aspect-[16/10] max-h-48 rounded-xl overflow-hidden bg-black border border-rose-500/40">
                      <img src={m.mediaUrl} alt="Mídia investigada" className="w-full h-full object-cover" />
                      <div className="absolute top-2 right-2 px-2 py-0.5 rounded bg-rose-600 text-white text-[10px] font-bold">
                        Mídia Objeto de Denúncia
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>

            <div className="pt-2 flex justify-end">
              <button
                onClick={onClose}
                className="px-5 py-2 bg-zinc-800 hover:bg-zinc-700 text-white text-xs font-bold rounded-xl cursor-pointer"
              >
                Concluir Análise
              </button>
            </div>
          </div>
        )}

      </div>
    </div>
  );
};
