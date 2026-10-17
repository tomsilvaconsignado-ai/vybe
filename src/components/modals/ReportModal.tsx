import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { ShieldAlert, X, AlertTriangle, Send } from 'lucide-react';
import { ModerationReport } from '../../types';

export const ReportModal: React.FC = () => {
  const { reportModalTarget, setReportModalTarget, submitReport } = useApp();
  const [category, setCategory] = useState<ModerationReport['category']>('unsolicited_explicit');
  const [description, setDescription] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!reportModalTarget) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!description.trim()) {
      alert('Por favor, descreva brevemente o motivo da denúncia para que a moderação possa agir.');
      return;
    }
    setIsSubmitting(true);
    setTimeout(() => {
      submitReport({
        reportedUserId: reportModalTarget.targetId,
        reportedUserName: reportModalTarget.reportedUserName,
        targetType: reportModalTarget.targetType,
        targetId: reportModalTarget.targetId,
        category,
        description
      });
      setIsSubmitting(false);
    }, 400);
  };

  const categories: { id: ModerationReport['category']; label: string; desc: string }[] = [
    {
      id: 'unsolicited_explicit',
      label: 'Conteúdo Íntimo Sem Consentimento',
      desc: 'Envio de fotos/vídeos explícitos sem autorização prévia.'
    },
    {
      id: 'harassment',
      label: 'Assédio ou Insistência Indesejada',
      desc: 'Insistência após recusa ("Não"), mensagens ofensivas ou agressivas.'
    },
    {
      id: 'fake_profile',
      label: 'Perfil Falso ou Fotos de Terceiros',
      desc: 'Uso não autorizado de fotos de outras pessoas ou dados fraudulentos.'
    },
    {
      id: 'underage_suspicion',
      label: 'Suspeita de Menor de 18 Anos (Urgente)',
      desc: 'Indícios de usuário menor de idade. Encaminhado imediatamente à equipe de segurança.'
    },
    {
      id: 'non_consensual',
      label: 'Coerção ou Violação de Consentimento',
      desc: 'Tentativa de chantagem, exposição não consentida ou desrespeito a limites.'
    },
    {
      id: 'scam',
      label: 'Spam Comercial ou Golpe Financeiro',
      desc: 'Venda de serviços, golpes com links ou publicidade irregular.'
    }
  ];

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="max-w-lg w-full bg-[#130d21] border border-purple-800/40 rounded-3xl p-6 shadow-2xl relative">
        <button
          onClick={() => setReportModalTarget(null)}
          className="absolute top-5 right-5 text-zinc-400 hover:text-white p-1 rounded-full hover:bg-zinc-800 transition-colors cursor-pointer"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-xl bg-rose-500/20 border border-rose-500/30 flex items-center justify-center text-rose-400">
            <ShieldAlert className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-white">Denunciar à Moderação</h3>
            <p className="text-xs text-zinc-400">
              Alvo: <strong className="text-purple-300">@{reportModalTarget.reportedUserName}</strong> ({reportModalTarget.targetType})
            </p>
          </div>
        </div>

        <p className="text-xs text-zinc-300 mb-4 bg-purple-950/30 border border-purple-900/30 p-3 rounded-xl leading-relaxed">
          Sua denúncia é estritamente confidencial. O denunciado não será informado de quem registrou o chamado.
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-zinc-300 mb-2">
              Selecione o Motivo:
            </label>
            <div className="space-y-2 max-h-52 overflow-y-auto pr-1">
              {categories.map(cat => (
                <label
                  key={cat.id}
                  className={`flex items-start gap-3 p-3 rounded-xl border cursor-pointer transition-all ${
                    category === cat.id
                      ? 'bg-purple-950/60 border-purple-500/60 text-white'
                      : 'bg-zinc-900/40 border-zinc-800 text-zinc-400 hover:border-zinc-700'
                  }`}
                >
                  <input
                    type="radio"
                    name="report_cat"
                    checked={category === cat.id}
                    onChange={() => setCategory(cat.id)}
                    className="mt-1 accent-purple-500 cursor-pointer"
                  />
                  <div>
                    <div className="text-xs font-semibold text-zinc-200">{cat.label}</div>
                    <div className="text-[11px] text-zinc-400 leading-tight">{cat.desc}</div>
                  </div>
                </label>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-zinc-300 mb-1">
              Descreva os Fatos (Detalhes adicionais):
            </label>
            <textarea
              rows={3}
              value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder="Explique o que aconteceu para ajudar na decisão dos moderadores..."
              className="w-full px-3 py-2 bg-zinc-900/80 border border-purple-900/30 rounded-xl text-xs text-zinc-200 placeholder-zinc-500 focus:outline-none focus:border-purple-500"
            />
          </div>

          <div className="flex items-center justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={() => setReportModalTarget(null)}
              className="px-4 py-2 text-xs font-semibold text-zinc-400 hover:text-white cursor-pointer"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-5 py-2.5 rounded-xl text-xs font-bold text-white bg-gradient-to-r from-rose-600 to-purple-600 hover:from-rose-500 hover:to-purple-500 shadow-md shadow-rose-950/40 flex items-center gap-2 cursor-pointer disabled:opacity-50"
            >
              <Send className="w-3.5 h-3.5" />
              {isSubmitting ? 'Enviando...' : 'Enviar Denúncia'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
