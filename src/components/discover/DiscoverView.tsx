import React, { useEffect, useState } from 'react';
import { fetchNearbyProfiles } from '../../lib/geo';
import { notify } from '../common/Feedback';
import { useApp } from '../../context/AppContext';
import { ProfileCard } from './ProfileCard';
import { 
  Search, 
  SlidersHorizontal, 
  LayoutGrid, 
  List, 
  Sparkles, 
  ShieldCheck, 
  MapPin, 
  Users, 
  Flame,
  CheckCircle2,
  X
} from 'lucide-react';
import { ProfileType } from '../../types';
import { calculateCompatibility } from '../../utils/compatibility';

interface DiscoverViewProps {
  initialFilter?: 'all' | 'couples' | 'singles';
}

// Preferências da busca por distância ficam no aparelho (conveniência; nada sensível)
const NEARBY_KEY = 'vybelog:nearby-only';
const RADIUS_KEY = 'vybelog:nearby-radius';
const RADIUS_OPTIONS = [5, 10, 25, 50, 100, 300];
const readStored = (key: string) => {
  try { return localStorage.getItem(key); } catch { return null; }
};
const store = (key: string, value: string) => {
  try { localStorage.setItem(key, value); } catch { /* armazenamento indisponível */ }
};

export const DiscoverView: React.FC<DiscoverViewProps> = ({ initialFilter = 'all' }) => {
  const {
    profiles, currentUser, getCompatibility, discoverSearch: searchQuery, setDiscoverSearch: setSearchQuery,
    hasLocation, enableLocation, ensureProfiles
  } = useApp();
  const [selectedType, setSelectedType] = useState<string>(
    initialFilter === 'couples' ? 'couple' : initialFilter === 'singles' ? 'singles' : 'all'
  );
  const [onlyVerified, setOnlyVerified] = useState<boolean>(false);
  const [nearbyOnly, setNearbyOnly] = useState<boolean>(() => readStored(NEARBY_KEY) === '1');
  const [radiusKm, setRadiusKm] = useState<number>(() => {
    const saved = Number(readStored(RADIUS_KEY));
    return RADIUS_OPTIONS.includes(saved) ? saved : 25;
  });
  const [sortBy, setSortBy] = useState<'compatibility' | 'distance' | 'recent'>(() => (readStored(NEARBY_KEY) === '1' ? 'distance' : 'compatibility'));
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [showFiltersModal, setShowFiltersModal] = useState(false);

  // Busca no banco quem está dentro do raio (inclusive quem não estava entre os perfis carregados)
  const [nearby, setNearby] = useState<Map<string, number> | null>(null);
  const [nearbyLoading, setNearbyLoading] = useState(false);
  const [locating, setLocating] = useState(false);
  const nearbyActive = nearbyOnly && hasLocation === true && currentUser.locationPrivacy !== 'hidden';

  useEffect(() => {
    if (!nearbyActive) {
      setNearby(null);
      return;
    }
    let cancelled = false;
    setNearbyLoading(true);
    fetchNearbyProfiles(radiusKm).then(async results => {
      if (cancelled) return;
      setNearby(new Map(results.map(r => [r.id, r.km])));
      await ensureProfiles(results.map(r => r.id));
      if (!cancelled) setNearbyLoading(false);
    });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nearbyActive, radiusKm]);

  const toggleNearby = (on: boolean) => {
    setNearbyOnly(on);
    store(NEARBY_KEY, on ? '1' : '0');
    setSortBy(on ? 'distance' : 'compatibility');
  };
  const chooseRadius = (km: number) => {
    setRadiusKm(km);
    store(RADIUS_KEY, String(km));
  };
  const handleEnableLocation = async () => {
    setLocating(true);
    const error = await enableLocation();
    setLocating(false);
    if (error) {
      notify(error, 'error');
      return;
    }
    toggleNearby(true);
  };

  // Distância de cada perfil: a da busca por raio ou a calculada para os perfis carregados
  const distanceOf = (prof: { id: string; approximateDistanceKm?: number }) => nearby?.get(prof.id) ?? prof.approximateDistanceKm;

  // Filter pipeline
  const filteredProfiles = profiles.filter(prof => {
    // Search query
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const match = 
        prof.displayName.toLowerCase().includes(q) ||
        prof.username.toLowerCase().includes(q) ||
        prof.city.toLowerCase().includes(q) ||
        prof.state.toLowerCase().includes(q) ||
        prof.interests.some(i => i.toLowerCase().includes(q));
      if (!match) return false;
    }

    // Type filter
    if (selectedType === 'couple' && prof.profileType !== 'couple') return false;
    if (selectedType === 'singles' && prof.profileType !== 'single_female' && prof.profileType !== 'single_male') return false;
    if (selectedType === 'single_female' && prof.profileType !== 'single_female') return false;
    if (selectedType === 'single_male' && prof.profileType !== 'single_male') return false;
    if (selectedType === 'polyamorous' && prof.profileType !== 'polyamorous') return false;

    // Verified only
    if (onlyVerified && !prof.isVerified) return false;

    // Só perto de mim: apenas quem o banco encontrou dentro do raio
    if (nearbyActive && nearby && !nearby.has(prof.id)) return false;

    return true;
  });

  // Sorting
  const sortedProfiles = [...filteredProfiles].sort((a, b) => {
    if (sortBy === 'compatibility') {
      const compatA = getCompatibility(a).score;
      const compatB = getCompatibility(b).score;
      return compatB - compatA;
    }
    if (sortBy === 'distance') {
      // Quem não tem distância conhecida vai para o fim
      return (distanceOf(a) ?? Infinity) - (distanceOf(b) ?? Infinity);
    }
    return 0; // default recent
  });

  return (
    <div className="max-w-6xl mx-auto py-6 px-4">
      
      {/* Header bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-extrabold text-white flex items-center gap-2">
            <span>Descobrir Pessoas</span>
            <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-purple-950 text-purple-300 border border-purple-800/40">
              {sortedProfiles.length} disponíveis
            </span>
          </h1>
          <p className="text-xs text-zinc-400 mt-0.5">
            Conexões reais baseadas em objetivos mútuos, respeito e compatibilidade transparente.
          </p>
        </div>

        {/* View mode toggle & Filter button */}
        <div className="flex items-center gap-2">
          <div className="bg-zinc-900 border border-purple-900/30 p-1 rounded-xl flex items-center gap-1">
            <button
              onClick={() => setViewMode('grid')}
              className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
                viewMode === 'grid' ? 'bg-purple-600 text-white' : 'text-zinc-400 hover:text-zinc-200'
              }`}
              title="Visualização em Grade"
            >
              <LayoutGrid className="w-4 h-4" />
            </button>
            <button
              onClick={() => setViewMode('list')}
              className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
                viewMode === 'list' ? 'bg-purple-600 text-white' : 'text-zinc-400 hover:text-zinc-200'
              }`}
              title="Visualização em Lista"
            >
              <List className="w-4 h-4" />
            </button>
          </div>

          <button
            onClick={() => setShowFiltersModal(!showFiltersModal)}
            className={`px-3.5 py-2 rounded-xl text-xs font-semibold border flex items-center gap-1.5 transition-all cursor-pointer ${
              showFiltersModal
                ? 'bg-purple-600 text-white border-purple-500'
                : 'bg-zinc-900 border-purple-900/40 text-zinc-300 hover:text-white'
            }`}
          >
            <SlidersHorizontal className="w-4 h-4" />
            <span>Filtros Avançados</span>
          </button>
        </div>
      </div>

      {/* Quick Search & Pill Filters */}
      <div className="bg-[#120d20] border border-purple-900/30 rounded-2xl p-3 mb-6 shadow-lg flex flex-col md:flex-row items-center gap-3">
        <div className="relative flex-1 w-full">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
          <input
            type="text"
            placeholder="Filtrar por nome, cidade (São Paulo, Rio...), ou interesse (Vinho, Praia)..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-zinc-950/80 border border-purple-900/20 rounded-xl text-xs text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-purple-500"
          />
        </div>

        {/* Profile Type Badges */}
        <div className="flex items-center gap-1.5 overflow-x-auto w-full md:w-auto pb-1 md:pb-0 scrollbar-none">
          {[
            { id: 'all', label: 'Todos' },
            { id: 'couple', label: 'Casais' },
            { id: 'singles', label: 'Solteiros(as)' },
            { id: 'single_female', label: 'Mulheres' },
            { id: 'single_male', label: 'Homens' },
            { id: 'polyamorous', label: 'Poliamor' },
          ].map(type => (
            <button
              key={type.id}
              onClick={() => setSelectedType(type.id)}
              className={`px-3 py-1.5 rounded-full text-xs font-semibold shrink-0 transition-all cursor-pointer ${
                selectedType === type.id
                  ? 'bg-gradient-to-r from-purple-600 to-rose-600 text-white shadow-md'
                  : 'bg-zinc-900/80 text-zinc-400 hover:text-zinc-200 border border-zinc-800'
              }`}
            >
              {type.label}
            </button>
          ))}
        </div>
      </div>

      {/* Perto de mim: busca por distância real */}
      <div className="bg-[#120d20] border border-purple-900/30 rounded-2xl p-3.5 mb-6 shadow-lg">
        {currentUser.locationPrivacy === 'hidden' ? (
          <p className="text-xs text-zinc-400 flex items-center gap-2">
            <MapPin className="w-4 h-4 text-zinc-500 shrink-0" />
            Sua localização está oculta. Para ver quem está perto, escolha "Cidade" ou "Região aproximada" em Configurações.
          </p>
        ) : hasLocation === false ? (
          <div className="flex flex-col sm:flex-row sm:items-center gap-3 justify-between">
            <div className="flex items-start gap-2.5">
              <MapPin className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
              <div>
                <p className="text-xs font-bold text-white">Veja quem está perto de você</p>
                <p className="text-[11px] text-zinc-400">
                  Usamos só uma área aproximada (~2 km), nunca seu endereço. Os outros veem apenas a distância arredondada.
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={handleEnableLocation}
              disabled={locating}
              className="px-4 py-2 rounded-xl text-xs font-bold text-white bg-gradient-to-r from-purple-600 to-rose-600 shrink-0 disabled:opacity-50 cursor-pointer"
            >
              {locating ? 'Localizando...' : 'Usar minha localização'}
            </button>
          </div>
        ) : hasLocation ? (
          <div className="flex flex-col sm:flex-row sm:items-center gap-3">
            <label className="flex items-center gap-2.5 cursor-pointer shrink-0">
              <button
                type="button"
                role="switch"
                aria-checked={nearbyOnly}
                onClick={() => toggleNearby(!nearbyOnly)}
                className={`relative w-11 h-6 rounded-full transition-colors cursor-pointer ${nearbyOnly ? 'bg-emerald-600' : 'bg-zinc-700'}`}
              >
                <span className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-all ${nearbyOnly ? 'left-[22px]' : 'left-0.5'}`} />
              </button>
              <span className="text-xs font-bold text-white flex items-center gap-1">
                <MapPin className="w-3.5 h-3.5 text-rose-400" /> Só perto de mim
              </span>
            </label>
            {nearbyOnly && (
              <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-none">
                {RADIUS_OPTIONS.map(km => (
                  <button
                    key={km}
                    type="button"
                    onClick={() => chooseRadius(km)}
                    className={`px-3 py-1.5 rounded-full text-xs font-semibold shrink-0 cursor-pointer ${
                      radiusKm === km ? 'bg-purple-600 text-white' : 'bg-zinc-900 text-zinc-400 border border-zinc-800 hover:text-white'
                    }`}
                  >
                    {km} km
                  </button>
                ))}
                {nearbyLoading && <span className="text-[11px] text-zinc-500 shrink-0">buscando...</span>}
              </div>
            )}
          </div>
        ) : null}
      </div>

      {/* Advanced Filters Expandable Drawer */}
      {showFiltersModal && (
        <div className="bg-[#160f27] border border-purple-800/40 rounded-3xl p-5 mb-6 shadow-2xl animate-in fade-in space-y-4">
          <div className="flex items-center justify-between border-b border-purple-900/30 pb-3">
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <SlidersHorizontal className="w-4 h-4 text-fuchsia-400" />
              Critérios de Compatibilidade & Filtros de Busca
            </h3>
            <button
              onClick={() => setShowFiltersModal(false)}
              className="text-zinc-400 hover:text-white"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="grid sm:grid-cols-3 gap-4">
            {/* Sort by */}
            <div>
              <label className="block text-xs font-semibold text-zinc-300 mb-1.5">Ordenar por:</label>
              <select
                value={sortBy}
                onChange={e => setSortBy(e.target.value as any)}
                className="w-full p-2 bg-zinc-900 border border-purple-900/40 rounded-xl text-xs text-zinc-200 focus:outline-none"
              >
                <option value="compatibility">Maior sintonia</option>
                <option value="distance">Menor Distância Geográfica</option>
                <option value="recent">Atividade Mais Recente</option>
              </select>
            </div>

            {/* Verified only checkbox */}
            <div className="flex items-center pt-5">
              <label className="flex items-center gap-2.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={onlyVerified}
                  onChange={e => setOnlyVerified(e.target.checked)}
                  className="accent-purple-500 rounded cursor-pointer"
                />
                <span className="text-xs font-semibold text-zinc-200 flex items-center gap-1">
                  <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                  Apenas Perfis Verificados (+18)
                </span>
              </label>
            </div>
          </div>
        </div>
      )}

      {/* Profiles Output */}
      {sortedProfiles.length > 0 ? (
        <div className={
          viewMode === 'grid'
            ? 'grid sm:grid-cols-2 lg:grid-cols-3 gap-6'
            : 'space-y-4'
        }>
          {sortedProfiles.map(profile => (
            <ProfileCard key={profile.id} profile={profile} viewMode={viewMode} />
          ))}
        </div>
      ) : (
        <div className="p-12 text-center bg-[#120d20] border border-purple-900/30 rounded-3xl">
          <Users className="w-12 h-12 text-purple-400 mx-auto mb-3 opacity-60" />
          {nearbyActive && nearbyLoading ? (
            <p className="text-xs text-zinc-400">Procurando pessoas em até {radiusKm} km...</p>
          ) : (
            <>
              <h3 className="text-base font-bold text-white mb-1">
                {nearbyActive ? `Ninguém em até ${radiusKm} km com esses filtros` : 'Nenhum perfil corresponde aos filtros'}
              </h3>
              <p className="text-xs text-zinc-400 max-w-sm mx-auto mb-4">
                {nearbyActive
                  ? 'Aumente o raio ou desligue "Só perto de mim" para ver pessoas de outras regiões.'
                  : 'Tente desmarcar alguns filtros para descobrir mais pessoas.'}
              </p>
              <div className="flex flex-wrap justify-center gap-2">
                {nearbyActive && radiusKm < RADIUS_OPTIONS[RADIUS_OPTIONS.length - 1] && (
                  <button
                    onClick={() => chooseRadius(RADIUS_OPTIONS.find(km => km > radiusKm) ?? radiusKm)}
                    className="px-4 py-2 rounded-xl bg-gradient-to-r from-purple-600 to-rose-600 text-white text-xs font-semibold cursor-pointer"
                  >
                    Aumentar para {RADIUS_OPTIONS.find(km => km > radiusKm)} km
                  </button>
                )}
                <button
                  onClick={() => {
                    setSearchQuery('');
                    setSelectedType('all');
                    setOnlyVerified(false);
                  }}
                  className="px-4 py-2 rounded-xl bg-purple-950 text-purple-300 border border-purple-800/40 text-xs font-semibold hover:bg-purple-900/50 cursor-pointer"
                >
                  Redefinir Filtros
                </button>
              </div>
            </>
          )}
        </div>
      )}

    </div>
  );
};
