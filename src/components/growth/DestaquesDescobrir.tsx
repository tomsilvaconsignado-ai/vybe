// Descobrir: destaques reais da plataforma (casal e membro da semana, perfis em destaque/VIP, novos membros,
// populares). O banco escolhe os ids; os perfis vêm com as regras de privacidade de quem está vendo.
import React, { useEffect, useState } from 'react';
import { Crown, Flame, Sparkles, UserPlus } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { destaques, type Destaques } from '../../lib/crescimento';
import { fetchProfilesByIds } from '../../lib/social';
import type { UserProfile } from '../../types';
import { GrowthBadges } from './GrowthBadges';
import { CartaoPatrocinado } from '../ads/CartaoPatrocinado';
import type { Ad } from '../../types';

// cartão patrocinado depois do 2º perfil e, em faixas longas, a cada 5 perfis
const POSICOES_PATROCINADO = (n: number) => [2, 7, 12].filter(i => i <= n);

const Faixa: React.FC<{ titulo: string; icone: React.ReactNode; perfis: UserProfile[]; abrir: (id: string) => void; anuncios?: Ad[] }> = ({ titulo, icone, perfis, abrir, anuncios = [] }) =>
  perfis.length === 0 ? null : (
    <section>
      <h3 className="text-xs font-bold text-zinc-300 uppercase tracking-wider mb-2 flex items-center gap-1.5">{icone}{titulo}</h3>
      <div className="flex gap-3 overflow-x-auto no-scrollbar pb-1 -mx-1 px-1">
        {perfis.map((p, i) => (
          <React.Fragment key={p.id}>
          {anuncios.length > 0 && POSICOES_PATROCINADO(perfis.length).includes(i) && (
            <CartaoPatrocinado anuncio={anuncios[POSICOES_PATROCINADO(perfis.length).indexOf(i) % anuncios.length]} />
          )}
          <button type="button" onClick={() => abrir(p.id)} className="shrink-0 w-28 text-left cursor-pointer group">
            <div className="relative w-28 h-36 rounded-2xl overflow-hidden bg-zinc-900 border border-purple-900/30 group-hover:border-purple-500/60 transition-colors">
              <img src={p.avatarUrl} alt="" loading="lazy" className="w-full h-full object-cover" />
              <div className="absolute inset-x-0 bottom-0 p-1.5 bg-gradient-to-t from-black/90 to-transparent">
                <GrowthBadges growth={p.growth} compacto max={1} />
              </div>
            </div>
            <p className="text-[12px] font-bold text-zinc-100 truncate mt-1">{p.displayName}{p.isVerified && <span className="text-purple-400 ml-0.5">✓</span>}</p>
            <p className="text-[10px] text-zinc-500 truncate">{p.city}</p>
          </button>
          </React.Fragment>
        ))}
        {/* faixa curta (até 2 perfis): o patrocinado vai no fim */}
        {anuncios.length > 0 && perfis.length > 0 && perfis.length <= 2 && <CartaoPatrocinado anuncio={anuncios[0]} />}
      </div>
    </section>
  );

const Semana: React.FC<{ titulo: string; perfil: UserProfile; abrir: (id: string) => void }> = ({ titulo, perfil, abrir }) => (
  <button type="button" onClick={() => abrir(perfil.id)} className="flex-1 min-w-[220px] p-3 rounded-2xl bg-gradient-to-br from-amber-900/30 to-purple-900/40 border border-amber-500/30 flex items-center gap-3 text-left cursor-pointer">
    <img src={perfil.avatarUrl} alt="" className="w-14 h-14 rounded-2xl object-cover" />
    <span className="min-w-0">
      <span className="block text-[10px] font-bold uppercase tracking-wider text-amber-300 flex items-center gap-1"><Crown className="w-3 h-3" />{titulo}</span>
      <span className="block text-sm font-bold text-white truncate">{perfil.displayName}</span>
      <span className="block text-[12px] text-zinc-400 truncate">{perfil.city}</span>
    </span>
  </button>
);

export const DestaquesDescobrir: React.FC = () => {
  const { setSelectedProfileId, ads } = useApp();
  // anúncios do espaço "Descobrir"; a faixa "Populares" começa de outro anúncio para variar
  const patrocinados = ads.filter(a => a.placement === 'destaques');
  const girar = (lista: Ad[], n: number) => (lista.length ? [...lista.slice(n % lista.length), ...lista.slice(0, n % lista.length)] : lista);
  const [d, setD] = useState<Destaques | null>(null);
  const [perfis, setPerfis] = useState<Record<string, UserProfile>>({});
  useEffect(() => {
    let ativo = true;
    destaques().then(async x => {
      if (!x || !ativo) return;
      setD(x);
      const ids = [...new Set([...x.featured, ...x.new_members, ...x.popular, x.couple_of_week, x.member_of_week].filter(Boolean) as string[])];
      const lista = await fetchProfilesByIds(ids);
      if (ativo) setPerfis(Object.fromEntries(lista.map(p => [p.id, p])));
    });
    return () => { ativo = false; };
  }, []);
  if (!d) return null;
  const de = (ids: string[]) => ids.map(id => perfis[id]).filter(Boolean) as UserProfile[];
  const casal = d.couple_of_week ? perfis[d.couple_of_week] : undefined;
  const membro = d.member_of_week ? perfis[d.member_of_week] : undefined;
  const abrir = (id: string) => setSelectedProfileId(id);
  return (
    <div className="space-y-5 mb-6">
      {(casal || membro) && (
        <div className="flex flex-wrap gap-3">
          {casal && <Semana titulo="Casal destaque da semana" perfil={casal} abrir={abrir} />}
          {membro && <Semana titulo="Membro destaque da semana" perfil={membro} abrir={abrir} />}
        </div>
      )}
      <Faixa titulo="Em destaque" icone={<Sparkles className="w-3.5 h-3.5 text-purple-300" />} perfis={de(d.featured)} abrir={abrir} anuncios={patrocinados} />
      <Faixa titulo="Novos membros" icone={<UserPlus className="w-3.5 h-3.5 text-emerald-300" />} perfis={de(d.new_members)} abrir={abrir} />
      <Faixa titulo="Populares" icone={<Flame className="w-3.5 h-3.5 text-rose-300" />} perfis={de(d.popular)} abrir={abrir} anuncios={girar(patrocinados, 1)} />
    </div>
  );
};
