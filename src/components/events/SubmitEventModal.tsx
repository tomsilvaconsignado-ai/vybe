import React, { useState } from 'react';
import { X, Image } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { uploadPublicMedia } from '../../lib/supabase';
import { EVENT_CATEGORY_LABELS, EventDraft, submitEvent } from '../../lib/events';
import { EventCategory } from '../../types';

const inputClass = 'w-full px-3.5 py-2.5 bg-zinc-900/80 border border-purple-900/30 rounded-xl text-sm text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-purple-500';

export const SubmitEventModal: React.FC<{ onClose: () => void }> = ({ onClose }) => {
  const { currentUser, refreshEvents } = useApp();
  const [draft, setDraft] = useState<EventDraft>({
    title: '',
    description: '',
    category: 'festa',
    startsAt: '',
    endsAt: '',
    venueName: '',
    city: currentUser.city,
    state: currentUser.state,
    coverUrl: '',
    priceInfo: '',
    ticketUrl: '',
    dressCode: '',
    audience: ''
  });
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [sent, setSent] = useState(false);

  const set = <K extends keyof EventDraft>(key: K, value: EventDraft[K]) => setDraft(prev => ({ ...prev, [key]: value }));

  const handleCover = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) {
      setError('A imagem de capa deve ter no máximo 10 MB.');
      return;
    }
    setUploading(true);
    const extension = file.name.split('.').pop()?.toLowerCase() || 'jpg';
    const { publicUrl, error: uploadError } = await uploadPublicMedia(file, `${currentUser.id}/events/${crypto.randomUUID()}.${extension}`);
    setUploading(false);
    if (uploadError || !publicUrl) setError('Não foi possível enviar a imagem.');
    else set('coverUrl', publicUrl);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (new Date(draft.startsAt).getTime() < Date.now()) {
      setError('A data de início precisa ser no futuro.');
      return;
    }
    if (draft.endsAt && new Date(draft.endsAt) < new Date(draft.startsAt)) {
      setError('O término precisa ser depois do início.');
      return;
    }
    if (draft.ticketUrl && !/^https?:\/\//i.test(draft.ticketUrl)) {
      setError('O link de ingressos deve começar com http:// ou https://');
      return;
    }
    setSaving(true);
    const submitError = await submitEvent(currentUser.id, draft);
    setSaving(false);
    if (submitError) {
      setError(submitError);
      return;
    }
    await refreshEvents();
    setSent(true);
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
      <div className="max-w-lg w-full bg-[#130d22] border border-purple-800/40 rounded-3xl p-5 sm:p-6 shadow-2xl relative my-auto">
        <button type="button" onClick={onClose} className="absolute top-4 right-4 text-zinc-400 hover:text-white p-1 cursor-pointer" aria-label="Fechar">
          <X className="w-5 h-5" />
        </button>

        {sent ? (
          <div className="text-center space-y-3 py-6">
            <h3 className="text-lg font-bold text-white">Evento enviado para análise</h3>
            <p className="text-xs text-zinc-400">
              A moderação revisa todos os eventos antes de publicar. Você recebe uma notificação quando ele for aprovado.
            </p>
            <button type="button" onClick={onClose} className="px-6 py-2.5 rounded-xl bg-purple-600 text-white text-xs font-bold cursor-pointer">Fechar</button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-3.5">
            <div className="pr-8">
              <h3 className="text-lg font-bold text-white">Divulgar evento</h3>
              <p className="text-xs text-zinc-400">Eventos para maiores de 18 anos, com consentimento e respeito. Publicação após revisão.</p>
            </div>

            <label className="relative flex items-center justify-center aspect-[16/9] rounded-2xl border-2 border-dashed border-purple-700/50 overflow-hidden cursor-pointer hover:bg-purple-950/30">
              {draft.coverUrl ? (
                <img src={draft.coverUrl} alt="Capa do evento" className="w-full h-full object-cover" />
              ) : (
                <span className="flex flex-col items-center gap-1.5 text-purple-200 text-xs font-semibold">
                  <Image className="w-6 h-6" /> {uploading ? 'Enviando...' : 'Imagem de capa (opcional)'}
                </span>
              )}
              <input type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={handleCover} />
            </label>

            <input required maxLength={150} className={inputClass} placeholder="Nome do evento" value={draft.title} onChange={e => set('title', e.target.value)} aria-label="Nome do evento" />

            <div className="grid grid-cols-2 gap-2">
              <select className={inputClass} value={draft.category} onChange={e => set('category', e.target.value as EventCategory)} aria-label="Categoria">
                {Object.entries(EVENT_CATEGORY_LABELS).map(([id, label]) => <option key={id} value={id}>{label}</option>)}
              </select>
              <input maxLength={120} className={inputClass} placeholder="Valor (ex: Casal R$ 120)" value={draft.priceInfo} onChange={e => set('priceInfo', e.target.value)} aria-label="Valor" />
            </div>

            <div className="grid grid-cols-2 gap-2">
              <label className="text-[11px] text-zinc-400 space-y-1">
                <span>Início</span>
                <input required type="datetime-local" className={inputClass} value={draft.startsAt} onChange={e => set('startsAt', e.target.value)} />
              </label>
              <label className="text-[11px] text-zinc-400 space-y-1">
                <span>Término (opcional)</span>
                <input type="datetime-local" className={inputClass} value={draft.endsAt} onChange={e => set('endsAt', e.target.value)} />
              </label>
            </div>

            <input required maxLength={150} className={inputClass} placeholder="Local (nome da casa, clube ou região)" value={draft.venueName} onChange={e => set('venueName', e.target.value)} aria-label="Local" />
            <div className="grid grid-cols-3 gap-2">
              <input required maxLength={100} className={`${inputClass} col-span-2`} placeholder="Cidade" value={draft.city} onChange={e => set('city', e.target.value)} aria-label="Cidade" />
              <input maxLength={50} className={inputClass} placeholder="UF" value={draft.state} onChange={e => set('state', e.target.value)} aria-label="Estado" />
            </div>

            <textarea rows={3} className={inputClass} placeholder="Descrição: proposta, regras da casa, o que está incluso..." value={draft.description} onChange={e => set('description', e.target.value)} aria-label="Descrição" />

            <div className="grid grid-cols-2 gap-2">
              <input maxLength={60} className={inputClass} placeholder="Público (ex: casais e mulheres)" value={draft.audience} onChange={e => set('audience', e.target.value)} aria-label="Público" />
              <input maxLength={120} className={inputClass} placeholder="Dress code" value={draft.dressCode} onChange={e => set('dressCode', e.target.value)} aria-label="Dress code" />
            </div>
            <input type="url" className={inputClass} placeholder="Link para ingressos/informações (https://...)" value={draft.ticketUrl} onChange={e => set('ticketUrl', e.target.value)} aria-label="Link de ingressos" />

            {error && <p className="text-xs text-rose-400">{error}</p>}

            <button type="submit" disabled={saving || uploading} className="w-full py-3 rounded-xl font-bold text-sm text-white bg-gradient-to-r from-purple-600 to-rose-600 disabled:opacity-50 cursor-pointer">
              {saving ? 'Enviando...' : 'Enviar para análise'}
            </button>
          </form>
        )}
      </div>
    </div>
  );
};
