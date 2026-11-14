// Criar ou editar comunidade (nome, descrição, categoria, ícone, capa, regras e tipo de acesso)
import React, { useState } from 'react';
import { ImagePlus, Plus, Trash2, X } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { ACCESS_INFO, COMMUNITY_CATEGORIES, createCommunity, updateCommunity, type CommunityDraft } from '../../lib/comunidades';
import { uploadPublicMedia } from '../../lib/supabase';
import { notify } from '../common/Feedback';
import type { Community, CommunityAccess } from '../../types';
import { Seletor } from '../common/Seletor';

const ICONES = ['💬', '🍷', '🔥', '✨', '🌱', '🎭', '💜', '🌙', '🏖️', '🎉', '📍', '🧭'];

export const CommunityFormModal: React.FC<{ community?: Community; aoFechar: () => void; aoSalvar: (id: string) => void }> = ({ community, aoFechar, aoSalvar }) => {
  const { currentUser } = useApp();
  const [d, setD] = useState<CommunityDraft>(() => community ? {
    name: community.name, description: community.description, category: community.category, icon: community.iconUrl,
    cover: null,
    rules: community.rules.length ? community.rules : [''], access: community.access
  } : { name: '', description: '', category: 'discussions', icon: '💬', cover: '', rules: [''], access: 'public' });
  const [salvando, setSalvando] = useState(false);
  const [enviandoCapa, setEnviandoCapa] = useState(false);
  const muda = (parte: Partial<CommunityDraft>) => setD(prev => ({ ...prev, ...parte }));
  // sem troca, a capa atual continua (inclusive a das comunidades iniciais)
  const capaAtual = d.cover ?? community?.coverUrl ?? '';

  const escolherCapa = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) { notify('Use uma foto JPG, PNG ou WebP.'); return; }
    if (file.size > 8 * 1024 * 1024) { notify('A capa pode ter no máximo 8 MB.'); return; }
    setEnviandoCapa(true);
    const { publicUrl, error } = await uploadPublicMedia(file, `${currentUser.id}/comunidade-${crypto.randomUUID()}.${file.type.split('/')[1]}`);
    setEnviandoCapa(false);
    if (error || !publicUrl) notify('Não foi possível enviar a capa.');
    else muda({ cover: publicUrl });
  };

  const salvar = async (e: React.FormEvent) => {
    e.preventDefault();
    setSalvando(true);
    const rascunho = d;
    if (community) {
      const error = await updateCommunity(community.id, rascunho);
      setSalvando(false);
      if (error) { notify(error); return; }
      notify('Comunidade atualizada.');
      aoSalvar(community.id);
    } else {
      const { id, error } = await createCommunity(rascunho);
      setSalvando(false);
      if (error || !id) { notify(error ?? 'Não foi possível criar a comunidade.'); return; }
      notify('Comunidade criada! Você é o administrador.');
      aoSalvar(id);
    }
  };

  const campo = 'w-full px-3.5 py-2.5 rounded-xl bg-zinc-900/80 border border-purple-900/30 text-sm text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-purple-500';

  return (
    <div className="modal-overlay fixed inset-0 z-[60] bg-black/80 backdrop-blur-sm flex items-start sm:items-center justify-center p-3 sm:p-4 overflow-y-auto" onClick={aoFechar}>
      <form onSubmit={salvar} onClick={e => e.stopPropagation()} className="w-full max-w-lg my-auto bg-[#130d22] border border-purple-800/40 rounded-3xl shadow-2xl overflow-hidden">
        <div className="flex items-center justify-between p-4 border-b border-purple-900/30">
          <h2 className="text-base font-bold text-white">{community ? 'Editar comunidade' : 'Criar comunidade'}</h2>
          <button type="button" onClick={aoFechar} className="p-1.5 rounded-full text-zinc-400 hover:text-white cursor-pointer" aria-label="Fechar"><X className="w-5 h-5" /></button>
        </div>

        <div className="p-4 space-y-4">
          <label className="relative block h-32 rounded-2xl overflow-hidden bg-gradient-to-br from-purple-900/60 via-fuchsia-900/40 to-rose-900/50 border border-purple-900/30 cursor-pointer">
            {capaAtual && <img src={capaAtual} alt="" className="w-full h-full object-cover" />}
            <span className="absolute inset-0 flex items-center justify-center gap-1.5 text-xs font-semibold text-white bg-black/30">
              <ImagePlus className="w-4 h-4" /> {enviandoCapa ? 'Enviando…' : capaAtual ? 'Trocar capa' : 'Adicionar capa (opcional)'}
            </span>
            <input type="file" accept="image/jpeg,image/png,image/webp" onChange={escolherCapa} className="hidden" />
          </label>

          <div>
            <span className="block text-[12px] font-bold text-zinc-400 mb-1.5">Ícone</span>
            <div className="flex flex-wrap gap-1.5">
              {ICONES.map(i => (
                <button key={i} type="button" onClick={() => muda({ icon: i })} aria-pressed={d.icon === i}
                  className={`w-9 h-9 rounded-xl text-lg cursor-pointer ${d.icon === i ? 'bg-purple-600/40 border border-purple-400' : 'bg-zinc-900 border border-zinc-800'}`}>{i}</button>
              ))}
            </div>
          </div>

          <label className="block">
            <span className="block text-[12px] font-bold text-zinc-400 mb-1.5">Nome</span>
            <input required minLength={3} maxLength={80} value={d.name} onChange={e => muda({ name: e.target.value })} className={campo} placeholder="Ex.: Casais de Curitiba" />
          </label>
          <label className="block">
            <span className="block text-[12px] font-bold text-zinc-400 mb-1.5">Descrição</span>
            <textarea required minLength={10} maxLength={1000} rows={3} value={d.description} onChange={e => muda({ description: e.target.value })} className={campo} placeholder="Sobre o que é a comunidade e quem deve participar" />
          </label>
          <label className="block">
            <span className="block text-[12px] font-bold text-zinc-400 mb-1.5">Categoria</span>
            <Seletor value={d.category} onChange={e => muda({ category: e.target.value as Community['category'] })} className={campo}>
              {COMMUNITY_CATEGORIES.map(c => <option key={c.id} value={c.id}>{c.label}</option>)}
            </Seletor>
          </label>

          <fieldset>
            <legend className="block text-[12px] font-bold text-zinc-400 mb-1.5">Quem pode entrar</legend>
            <div className="space-y-1.5">
              {(Object.keys(ACCESS_INFO) as CommunityAccess[]).map(a => (
                <label key={a} className={`flex items-start gap-2.5 p-3 rounded-xl border cursor-pointer ${d.access === a ? 'border-purple-500 bg-purple-900/20' : 'border-zinc-800 bg-zinc-900/50'}`}>
                  <input type="radio" name="acesso" checked={d.access === a} onChange={() => muda({ access: a })} className="mt-0.5 accent-fuchsia-500" />
                  <span>
                    <span className="block text-xs font-bold text-zinc-100">{ACCESS_INFO[a].label}</span>
                    <span className="block text-[12px] text-zinc-400">{ACCESS_INFO[a].help}</span>
                  </span>
                </label>
              ))}
            </div>
          </fieldset>

          <div>
            <span className="block text-[12px] font-bold text-zinc-400 mb-1.5">Regras ({d.rules.filter(r => r.trim()).length}/10)</span>
            <div className="space-y-1.5">
              {d.rules.map((r, i) => (
                <div key={i} className="flex gap-1.5">
                  <input maxLength={200} value={r} onChange={e => muda({ rules: d.rules.map((x, j) => (j === i ? e.target.value : x)) })} className={campo} placeholder={`Regra ${i + 1}`} />
                  <button type="button" onClick={() => muda({ rules: d.rules.length > 1 ? d.rules.filter((_, j) => j !== i) : [''] })} className="p-2 text-zinc-500 hover:text-rose-400 cursor-pointer" aria-label="Remover regra"><Trash2 className="w-4 h-4" /></button>
                </div>
              ))}
            </div>
            {d.rules.length < 10 && (
              <button type="button" onClick={() => muda({ rules: [...d.rules, ''] })} className="mt-2 text-xs font-semibold text-fuchsia-300 flex items-center gap-1 cursor-pointer"><Plus className="w-3.5 h-3.5" /> Adicionar regra</button>
            )}
          </div>
        </div>

        <div className="p-4 border-t border-purple-900/30">
          <button type="submit" disabled={salvando || enviandoCapa} className="w-full py-3 rounded-xl bg-gradient-to-r from-fuchsia-600 via-pink-600 to-orange-600 text-white text-sm font-bold disabled:opacity-50 cursor-pointer">
            {salvando ? 'Salvando…' : community ? 'Salvar alterações' : 'Criar comunidade'}
          </button>
        </div>
      </form>
    </div>
  );
};
