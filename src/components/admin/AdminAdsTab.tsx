import React, { useEffect, useState } from 'react';
import { Megaphone, Plus, Pencil, Trash2, Image } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { Ad, AdPlacement } from '../../types';
import { FREQUENCIA_PADRAO, deleteAd, fetchAllAds, lerFrequenciaAnuncios, salvarFrequenciaAnuncios, saveAd } from '../../lib/events';
import { uploadPublicMedia } from '../../lib/supabase';
import { notify, askConfirm, askText } from '../common/Feedback';
import { Seletor } from '../common/Seletor';

const PLACEMENT_LABEL: Record<AdPlacement, string> = {
  feed: 'Feed (entre publicações)',
  sidebar: 'Coluna lateral',
  events: 'Página de eventos',
  carousel: 'Carrossel (coluna lateral, em slides)',
  destaques: 'Descobrir (entre membros em destaque e populares)'
};

const EMPTY: Partial<Ad> = { advertiser: '', title: '', body: '', imageUrl: '', linkUrl: '', ctaLabel: 'Saiba mais', placement: 'feed', isActive: true, showInPopup: false };
const inputClass = 'w-full px-3 py-2 bg-zinc-900 border border-zinc-800 rounded-xl text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-amber-500';

// Converte ISO para o formato do <input type="datetime-local">
const toLocalInput = (iso?: string) => (iso ? new Date(new Date(iso).getTime() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 16) : '');

const isRunning = (ad: Ad) => ad.isActive && new Date(ad.startsAt) <= new Date() && (!ad.endsAt || new Date(ad.endsAt) > new Date());

export const AdminAdsTab: React.FC = () => {
  const { currentUser, adminRole } = useApp();
  const canEdit = adminRole === 'superadmin';
  const [freq, setFreq] = useState(FREQUENCIA_PADRAO);
  useEffect(() => { lerFrequenciaAnuncios().then(setFreq); }, []);
  const salvarFreq = async () => {
    const j = await askText({ title: 'Salvar configuração da janela', message: 'Informe a justificativa (fica na auditoria).', placeholder: 'Justificativa', confirmLabel: 'Salvar' });
    if (j === null) return;
    const e = await salvarFrequenciaAnuncios(freq, j);
    notify(e ?? 'Configuração da janela salva.');
  };
  const [ads, setAds] = useState<Ad[]>([]);
  const [editing, setEditing] = useState<Partial<Ad> | null>(null);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);

  const carouselRunning = ads.filter(ad => ad.placement === 'carousel' && isRunning(ad)).length;

  const load = async () => setAds(await fetchAllAds());
  useEffect(() => { load(); }, []);

  const set = <K extends keyof Ad>(key: K, value: Ad[K]) => setEditing(prev => ({ ...prev, [key]: value }));

  const handleImage = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setUploading(true);
    const extension = file.name.split('.').pop()?.toLowerCase() || 'jpg';
    const { publicUrl, error } = await uploadPublicMedia(file, `${currentUser.id}/ads/${crypto.randomUUID()}.${extension}`);
    setUploading(false);
    if (error || !publicUrl) notify('Não foi possível enviar a imagem.');
    else set('imageUrl', publicUrl);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editing) return;
    if (editing.linkUrl && !/^https?:\/\//i.test(editing.linkUrl)) {
      notify('O link deve começar com http:// ou https://');
      return;
    }
    setSaving(true);
    const error = await saveAd(currentUser.id, editing);
    setSaving(false);
    if (error) {
      notify(`Não foi possível salvar: ${error}`);
      return;
    }
    setEditing(null);
    load();
  };

  const togglePopup = async (ad: Ad) => {
    const error = await saveAd(currentUser.id, { ...ad, showInPopup: !ad.showInPopup });
    if (error) notify(error);
    load();
  };

  const toggleActive = async (ad: Ad) => {
    const error = await saveAd(currentUser.id, { ...ad, isActive: !ad.isActive });
    if (error) notify(error);
    load();
  };

  const remove = async (ad: Ad) => {
    if (!(await askConfirm({ title: "Apagar anúncio?", message: `"${ad.title}" deixa de ser exibido.`, confirmLabel: "Apagar", danger: true }))) return;
    const error = await deleteAd(ad.id);
    if (error) notify(error);
    load();
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <p className="text-xs text-zinc-400 max-w-xl">
          Anúncios aparecem como "Patrocinado" no feed (a cada 5 publicações), na coluna lateral, na agenda de eventos
          e no Descobrir, entre os membros em destaque e os populares (espaço "Descobrir").
          Sem anúncio ativo, o espaço convida a divulgar eventos.
          Os anúncios do espaço "Carrossel" passam em slides na coluna lateral, abaixo da divulgação ({carouselRunning} no ar agora).
        </p>
        {canEdit && (
          <button type="button" onClick={() => setEditing({ ...EMPTY })} className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-black text-xs font-bold flex items-center gap-1.5 cursor-pointer">
            <Plus className="w-4 h-4" /> Novo anúncio
          </button>
        )}
      </div>

      {!canEdit && <p className="text-[12px] text-amber-300">Somente o superadministrador cria e edita anúncios.</p>}

      {/* Frequência da janela de publicidade */}
      <div className="p-4 rounded-2xl bg-fuchsia-950/20 border border-fuchsia-800/40 flex flex-col sm:flex-row sm:items-end gap-3">
        <div className="flex-1">
          <p className="text-xs font-bold text-white">Janela de publicidade</p>
          <p className="text-[12px] text-zinc-400">Reveza os anúncios marcados "Na janela" e, se ligado, os eventos da agenda (os em destaque; sem destaque, os 3 próximos). Nunca enquanto a pessoa digita nem junto da janela de convite. Limite 0 desliga a janela.</p>
          <label className="mt-2 inline-flex items-center gap-2 text-[12px] text-zinc-300 cursor-pointer">
            <input type="checkbox" className="accent-fuchsia-500" disabled={!canEdit} checked={freq.incluirEventos} onChange={e => setFreq({ ...freq, incluirEventos: e.target.checked })} />
            Mostrar eventos na janela
          </label>
        </div>
        <label className="text-[12px] text-zinc-400">1ª janela após (segundos)
          <input type="number" min={5} max={600} disabled={!canEdit} value={freq.esperaInicialS} onChange={e => setFreq({ ...freq, esperaInicialS: Number(e.target.value) })}
            className="block w-28 mt-1 px-3 py-2 rounded-xl bg-zinc-950 border border-zinc-800 text-sm text-white" />
        </label>
        <label className="text-[12px] text-zinc-400">A cada (minutos)
          <input type="number" min={1} max={120} disabled={!canEdit} value={freq.intervalMin} onChange={e => setFreq({ ...freq, intervalMin: Number(e.target.value) })}
            className="block w-28 mt-1 px-3 py-2 rounded-xl bg-zinc-950 border border-zinc-800 text-sm text-white" />
        </label>
        <label className="text-[12px] text-zinc-400">Máximo por acesso
          <input type="number" min={0} max={30} disabled={!canEdit} value={freq.maxPorAcesso} onChange={e => setFreq({ ...freq, maxPorAcesso: Number(e.target.value) })}
            className="block w-28 mt-1 px-3 py-2 rounded-xl bg-zinc-950 border border-zinc-800 text-sm text-white" />
        </label>
        {canEdit && <button type="button" onClick={salvarFreq} className="px-4 py-2.5 rounded-xl bg-fuchsia-600 hover:bg-fuchsia-500 text-white text-xs font-bold cursor-pointer">Salvar</button>}
      </div>

      {ads.length === 0 ? (
        <div className="p-10 text-center bg-painel border border-purple-900/30 rounded-3xl text-xs text-zinc-400">
          <Megaphone className="w-10 h-10 mx-auto mb-2 text-purple-400 opacity-60" />
          Nenhum anúncio cadastrado.
        </div>
      ) : (
        <div className="overflow-x-auto bg-painel border border-purple-900/30 rounded-3xl">
          <table className="w-full text-left text-xs">
            <thead className="bg-zinc-950/80 text-zinc-400 border-b border-zinc-800">
              <tr>
                <th className="p-3">Anúncio</th>
                <th className="p-3">Espaço</th>
                <th className="p-3">Período</th>
                <th className="p-3 text-right">Visualizações</th>
                <th className="p-3 text-right">Cliques</th>
                <th className="p-3 text-right">CTR</th>
                <th className="p-3">Situação</th>
                {canEdit && <th className="p-3" />}
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800/60 text-zinc-300">
              {ads.map(ad => (
                <tr key={ad.id}>
                  <td className="p-3">
                    <div className="flex items-center gap-2.5 min-w-[200px]">
                      {ad.imageUrl ? <img src={ad.imageUrl} alt="" className="w-10 h-10 rounded-lg object-cover" /> : <div className="w-10 h-10 rounded-lg bg-zinc-800" />}
                      <div>
                        <p className="font-bold text-white">{ad.title}</p>
                        <p className="text-zinc-500">{ad.advertiser}</p>
                      </div>
                    </div>
                  </td>
                  <td className="p-3 whitespace-nowrap">{PLACEMENT_LABEL[ad.placement]}</td>
                  <td className="p-3 whitespace-nowrap text-zinc-400">
                    {new Date(ad.startsAt).toLocaleDateString('pt-BR')} – {ad.endsAt ? new Date(ad.endsAt).toLocaleDateString('pt-BR') : 'sem fim'}
                  </td>
                  <td className="p-3 text-right tabular-nums">{ad.impressions.toLocaleString('pt-BR')}</td>
                  <td className="p-3 text-right tabular-nums">{ad.clicks.toLocaleString('pt-BR')}</td>
                  <td className="p-3 text-right tabular-nums">{ad.impressions ? ((ad.clicks / ad.impressions) * 100).toFixed(1) : '0.0'}%</td>
                  <td className="p-3">
                    <span className={`px-2 py-0.5 rounded font-bold ${isRunning(ad) ? 'bg-emerald-950 text-emerald-300' : 'bg-zinc-800 text-zinc-400'}`}>
                      {isRunning(ad) ? 'No ar' : ad.isActive ? 'Fora do período' : 'Pausado'}
                    </span>
                    {ad.showInPopup && <span className="ml-1 px-2 py-0.5 rounded font-bold bg-fuchsia-950 text-fuchsia-300" title="Aparece na janela de publicidade, revezando durante o uso">Na janela</span>}
                  </td>
                  {canEdit && (
                    <td className="p-3">
                      <div className="flex items-center gap-1 justify-end">
                        <button type="button" onClick={() => toggleActive(ad)} className="px-2 py-1 rounded-lg text-[12px] font-semibold text-zinc-300 hover:bg-zinc-800 cursor-pointer">
                          {ad.isActive ? 'Pausar' : 'Ativar'}
                        </button>
                        <button type="button" onClick={() => togglePopup(ad)} disabled={!ad.imageUrl}
                          title={!ad.imageUrl ? 'A janela exige imagem' : ad.showInPopup ? 'Tirar da janela de publicidade' : 'Exibir na janela de publicidade'}
                          className="px-2 py-1 rounded-lg text-[12px] font-semibold text-fuchsia-300 hover:bg-zinc-800 disabled:opacity-40 cursor-pointer">
                          {ad.showInPopup ? 'Tirar da janela' : 'Pôr na janela'}
                        </button>
                        {ad.placement !== 'carousel' && (
                          <button
                            type="button"
                            onClick={() => setEditing({ ...ad, id: undefined, placement: 'carousel' })}
                            className="px-2 py-1 rounded-lg text-[12px] font-semibold text-fuchsia-300 hover:bg-zinc-800 cursor-pointer whitespace-nowrap"
                            title="Cria uma cópia deste anúncio no carrossel; o original continua onde está"
                          >
                            + Carrossel
                          </button>
                        )}
                        <button type="button" onClick={() => setEditing(ad)} className="p-1.5 rounded-lg text-zinc-300 hover:bg-zinc-800 cursor-pointer" aria-label="Editar">
                          <Pencil className="w-3.5 h-3.5" />
                        </button>
                        <button type="button" onClick={() => remove(ad)} className="p-1.5 rounded-lg text-rose-400 hover:bg-rose-950/40 cursor-pointer" aria-label="Apagar">
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {editing && (
        <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
          <form onSubmit={handleSave} className="max-w-lg w-full bg-painel border border-amber-500/40 rounded-3xl p-6 space-y-3 my-auto">
            <h3 className="text-base font-bold text-white">{editing.id ? 'Editar anúncio' : 'Novo anúncio'}</h3>

            <label className="relative flex items-center justify-center aspect-[16/9] rounded-2xl border-2 border-dashed border-amber-700/50 overflow-hidden cursor-pointer">
              {editing.imageUrl ? (
                <img src={editing.imageUrl} alt="" className="w-full h-full object-cover" />
              ) : (
                <span className="flex flex-col items-center gap-1 text-amber-200 text-xs font-semibold"><Image className="w-6 h-6" />{uploading ? 'Enviando...' : 'Imagem do anúncio'}</span>
              )}
              <input type="file" accept="image/jpeg,image/png,image/webp,image/gif" className="hidden" onChange={handleImage} />
            </label>

            <input required maxLength={120} className={inputClass} placeholder="Anunciante (ex: Clube X)" value={editing.advertiser ?? ''} onChange={e => set('advertiser', e.target.value)} aria-label="Anunciante" />
            <input required maxLength={120} className={inputClass} placeholder="Título" value={editing.title ?? ''} onChange={e => set('title', e.target.value)} aria-label="Título" />
            <textarea rows={2} className={inputClass} placeholder="Texto (opcional)" value={editing.body ?? ''} onChange={e => set('body', e.target.value)} aria-label="Texto" />
            <div className="grid grid-cols-3 gap-2">
              <input type="url" className={`${inputClass} col-span-2`} placeholder="Link (https://...)" value={editing.linkUrl ?? ''} onChange={e => set('linkUrl', e.target.value)} aria-label="Link" />
              <input maxLength={40} className={inputClass} placeholder="Botão" value={editing.ctaLabel ?? ''} onChange={e => set('ctaLabel', e.target.value)} aria-label="Texto do botão" />
            </div>
            <Seletor className={inputClass} value={editing.placement} onChange={e => set('placement', e.target.value as AdPlacement)} aria-label="Espaço">
              {Object.entries(PLACEMENT_LABEL).map(([id, label]) => <option key={id} value={id}>{label}</option>)}
            </Seletor>
            <label className="flex items-start gap-2.5 p-3 rounded-xl bg-fuchsia-950/30 border border-fuchsia-800/40 cursor-pointer">
              <input type="checkbox" className="mt-0.5 accent-fuchsia-500" checked={!!editing.showInPopup} onChange={e => set('showInPopup', e.target.checked)} />
              <span className="text-[12px] text-zinc-300">
                <strong className="block text-xs text-white">Exibir na janela de publicidade</strong>
                Abre durante o uso, revezando entre os anúncios marcados e os eventos, na frequência configurada acima (precisa de imagem).
              </span>
            </label>
            {editing.placement === 'carousel' && (
              <p className="text-[12px] text-zinc-400">
                Cada anúncio do carrossel vira um slide que troca a cada 6 segundos (pausa com o mouse em cima). Use imagem na proporção 4:3.
                Para manter um anúncio também nos outros espaços, cadastre uma cópia com o outro espaço.
              </p>
            )}
            <div className="grid grid-cols-2 gap-2">
              <label className="text-[12px] text-zinc-400 space-y-1">
                <span>Início</span>
                <input type="datetime-local" className={inputClass} value={toLocalInput(editing.startsAt)} onChange={e => set('startsAt', e.target.value)} />
              </label>
              <label className="text-[12px] text-zinc-400 space-y-1">
                <span>Fim (opcional)</span>
                <input type="datetime-local" className={inputClass} value={toLocalInput(editing.endsAt)} onChange={e => set('endsAt', e.target.value || undefined)} />
              </label>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button type="button" onClick={() => setEditing(null)} className="px-4 py-2 text-xs font-semibold text-zinc-400 cursor-pointer">Cancelar</button>
              <button type="submit" disabled={saving || uploading} className="px-5 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-black text-xs font-bold disabled:opacity-50 cursor-pointer">
                {saving ? 'Salvando...' : 'Salvar anúncio'}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};
