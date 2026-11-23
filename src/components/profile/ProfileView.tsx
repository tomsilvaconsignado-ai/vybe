import React, { useEffect, useState } from 'react';
import { useApp } from '../../context/AppContext';
import {
  Heart,
  MessageSquare,
  Lock,
  Key,
  MapPin,
  Sparkles,
  ShieldCheck,
  Users,
  UserPlus,
  Edit3,
  Share2,
  ShieldAlert,
  Plus,
  Image,
  CheckCircle2,
  Calendar,
  Eye,
  Sliders,
  ChevronLeft,
  Grid3x3,
  Copy,
  MessageCircle,
  Ban,
  BadgeCheck,
  Play
} from 'lucide-react';
import { EditProfileModal, EditProfileTab } from './EditProfileModal';
import { AlbumPermissionsModal } from './AlbumPermissionsModal';
import { AlbumViewerModal } from './AlbumViewerModal';
import { CreateAlbumModal } from './CreateAlbumModal';
import { fetchAlbums } from '../../lib/albums';
import { fetchUserPosts, fetchProfileById, FollowListKind } from '../../lib/social';
import { FollowListModal } from './FollowListModal';
import { OnlineDot, activityLabel } from '../common/OnlineDot';
import { IdentityBadges, identityEntries } from '../common/IdentityBadges';
import { PROFILE_TYPE_OPTIONS } from '../../lib/profileOptions';
import { PostCard } from '../feed/PostCard';
import { calculateCompatibility, OBJECTIVE_LABELS } from '../../utils/compatibility';
import { MediaAlbum, Post, UserProfile } from '../../types';
import { notify, askConfirm } from '../common/Feedback';
import { linkDoPerfil } from '../../lib/rotas';
import { GrowthBadges } from '../growth/GrowthBadges';
import { AvisoSeloFoto, PEDIDO_EDITAR_PERFIL } from '../growth/AvisoSeloFoto';
import { temFotoPropria } from '../../lib/profiles';
import { comConvite } from '../../lib/convite';
import { meuCodigo } from '../../lib/crescimento';
import { supabase } from '../../lib/supabase';
import { compartilharComImagem } from '../../lib/compartilhar';
import { isVideoUrl, MediaThumb } from '../../lib/videoPoster';

// Compartilhar perfil: no celular abre o menu nativo; no computador copia o link (/perfil/<id>)
const compartilharPerfil = async (id: string, usuario: string) => {
  // o link leva o código de convite de quem compartilha: quem chegar por ele e se cadastrar conta como indicação
  const eu = (await supabase.auth.getSession()).data.session?.user.id;
  const url = comConvite(linkDoPerfil(window.location.origin, id), eu ? await meuCodigo(eu) : null);
  const r = await compartilharComImagem({ titulo: `@${usuario} no Vybelog`, texto: `Conheça @${usuario} no Vybelog:`, url });
  if (r === 'copiado') notify('Link do perfil copiado.');
};

export const ProfileView: React.FC = () => {
  const {
    currentUser,
    selectedProfileId,
    setSelectedProfileId,
    profiles,
    posts,
    connections,
    incomingConnectionRequests,
    outgoingConnectionRequests,
    requestConnection,
    following,
    toggleFollow,
    startOrOpenConversation,
    requestAlbumAccess,
    postCache,
    cachePosts,
    setReportModalTarget,
    blockUser,
    getCompatibility,
    isOnline,
    canSeeActivity
  } = useApp();

  const isSelf = !selectedProfileId || selectedProfileId === currentUser.id;
  // Perfis fora dos carregados na descoberta (ex.: abertos por uma lista de seguidores) vêm do banco
  const [remoteProfile, setRemoteProfile] = useState<UserProfile | null>(null);
  const loadedProfile = isSelf ? currentUser : profiles.find(p => p.id === selectedProfileId) ?? (remoteProfile?.id === selectedProfileId ? remoteProfile : null);
  const profile = loadedProfile ?? currentUser;
  const [followList, setFollowList] = useState<FollowListKind | null>(null);

  useEffect(() => {
    setFollowList(null);
    if (isSelf || !selectedProfileId || profiles.some(p => p.id === selectedProfileId)) return;
    let cancelled = false;
    fetchProfileById(selectedProfileId).then(found => {
      if (cancelled) return;
      if (found) setRemoteProfile(found);
      else {
        notify('Este perfil não está disponível.');
        setSelectedProfileId(null);
      }
    });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedProfileId]);

  const [activeTab, setActiveTab] = useState<'vault' | 'public' | 'posts'>('posts');
  const [editTab, setEditTab] = useState<EditProfileTab | null>(null);
  // "Colocar foto agora" (aviso dos selos) abre a edição do perfil
  useEffect(() => {
    if (!isSelf) return;
    try {
      if (sessionStorage.getItem(PEDIDO_EDITAR_PERFIL)) { sessionStorage.removeItem(PEDIDO_EDITAR_PERFIL); setEditTab('data'); }
    } catch { /* sem armazenamento */ }
  }, [isSelf]);
  const [managingAlbum, setManagingAlbum] = useState<MediaAlbum | null>(null);
  const [viewingAlbumId, setViewingAlbumId] = useState<string | null>(null);
  const [isCreatingAlbum, setIsCreatingAlbum] = useState(false);
  const [albums, setAlbums] = useState<MediaAlbum[]>([]);
  const [albumsLoading, setAlbumsLoading] = useState(true);

  const loadAlbums = async () => {
    if (!profile.id) return;
    const loaded = await fetchAlbums(profile.id);
    setAlbums(loaded);
    setAlbumsLoading(false);
    // Mantém a janela de permissões com os dados atualizados
    setManagingAlbum(prev => (prev ? loaded.find(a => a.id === prev.id) ?? null : null));
  };

  useEffect(() => {
    setAlbums([]);
    setAlbumsLoading(true);
    loadAlbums();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile.id]);

  const viewingAlbum = albums.find(a => a.id === viewingAlbumId) ?? null;

  const [profilePostIds, setProfilePostIds] = useState<string[]>([]);
  const [openPostId, setOpenPostId] = useState<string | null>(null);
  useEffect(() => {
    if (!profile.id) return;
    setProfilePostIds([]);
    fetchUserPosts(profile.id, currentUser.id).then(list => {
      cachePosts(list);
      setProfilePostIds(list.map(p => p.id));
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile.id]);
  // Versão mais recente de cada post (o feed e o cache recebem as curtidas/comentários)
  const newInFeed = posts.filter(p => p.userId === profile.id && !profilePostIds.includes(p.id));
  const profilePosts: Post[] = [
    ...newInFeed,
    ...profilePostIds.map(id => posts.find(p => p.id === id) ?? postCache[id]).filter((p): p is Post => Boolean(p))
  ];
  const openPost = profilePosts.find(p => p.id === openPostId) ?? null;

  const isFollowing = following.includes(profile.id);
  const isConnected = connections.includes(profile.id);
  const compat = !isSelf ? getCompatibility(profile) : null;
  const userPosts = posts.filter(p => p.userId === profile.id);

  if (!loadedProfile) {
    return (
      <div className="py-24 flex justify-center">
        <div className="w-8 h-8 rounded-full border-2 border-purple-500 border-t-transparent animate-spin" aria-label="Carregando perfil" />
      </div>
    );
  }

  return (
    <div className="max-w-[935px] mx-auto pb-6 sm:px-4">

      {/* Cabeçalho do perfil, no estilo Instagram: foto e números lado a lado, depois nome, bio e ações.
          A capa vira uma luz ambiente desfocada atrás do cabeçalho. */}
      <section className="relative isolate px-4 pt-4 sm:pt-10 pb-2">
        {profile.coverUrl && (
          <div aria-hidden className="absolute inset-x-0 top-0 h-56 -z-10 overflow-hidden [mask-image:linear-gradient(to_bottom,black,transparent)]">
            <img src={profile.coverUrl} alt="" className="w-full h-full object-cover opacity-35 blur-2xl scale-110" />
          </div>
        )}

        {/* barra de cima: voltar (perfil de outra pessoa) e, à direita, denunciar e bloquear */}
        {(!isSelf) && (
          <div className="flex items-center justify-between mb-3 sm:mb-6 -mx-1">
            <button
              onClick={() => setSelectedProfileId(null)}
              className="h-9 pl-1 pr-3 rounded-full text-[13px] font-semibold text-zinc-300 hover:text-white hover:bg-white/5 flex items-center gap-1 cursor-pointer"
            >
              <ChevronLeft className="w-5 h-5" />
              Meu perfil
            </button>
            <div className="flex items-center gap-1">
              <button
                onClick={() => setReportModalTarget({ targetType: 'profile', targetId: profile.id, reportedUserId: profile.id, reportedUserName: profile.username })}
                className="w-9 h-9 rounded-full text-zinc-400 hover:text-rose-400 hover:bg-white/5 flex items-center justify-center transition-colors cursor-pointer"
                title="Denunciar perfil à moderação"
                aria-label="Denunciar perfil à moderação"
              >
                <ShieldAlert className="w-[18px] h-[18px]" />
              </button>
              <button
                onClick={async () => {
                  if (await askConfirm({ title: `Bloquear ${profile.displayName}?`, message: "Vocês deixam de se seguir e de ser conexões. A pessoa não verá mais seu perfil, posts e stories, nem poderá enviar mensagens ou pedir acesso aos seus cofres. Ela não é avisada. Você pode desbloquear em Configurações.", confirmLabel: "Bloquear", danger: true })) {
                    await blockUser(profile.id);
                  }
                }}
                className="w-9 h-9 rounded-full text-zinc-400 hover:text-rose-400 hover:bg-white/5 flex items-center justify-center transition-colors cursor-pointer"
                title="Bloquear perfil"
                aria-label="Bloquear perfil"
              >
                <Ban className="w-[18px] h-[18px]" />
              </button>
            </div>
          </div>
        )}

        <div className="flex items-center gap-5 sm:gap-12">
          {/* foto com anel de luz */}
          <div className="relative shrink-0 sm:ml-10">
            <span className="block w-[88px] h-[88px] sm:w-[150px] sm:h-[150px] rounded-full p-[3px] fundo-neon shadow-[0_10px_40px_-12px_rgba(236,72,153,0.7)]">
              <span className="block w-full h-full rounded-full bg-fundo p-[3px]">
                <img src={profile.avatarUrl} alt={profile.displayName} className="w-full h-full rounded-full object-cover" />
              </span>
            </span>
            {!isSelf && <OnlineDot userId={profile.id} size="lg" className="bottom-1.5 right-1.5 sm:bottom-3 sm:right-3" />}
          </div>

          <div className="flex-1 min-w-0">
            {/* no computador, o @ fica em cima dos números */}
            <div className="hidden sm:flex items-center gap-2 mb-5">
              <h1 className="text-xl font-semibold text-white truncate">{profile.username}</h1>
              {profile.isVerified && <BadgeCheck className="w-5 h-5 shrink-0 text-white fill-fuchsia-500" aria-label="Perfil verificado" />}
            </div>
            {/* números: seguidores e seguindo abrem as listas */}
            <div className="grid grid-cols-3 sm:flex sm:gap-9 text-center sm:text-left">
              {([
                { label: 'publicações', value: profilePosts.length },
                { label: 'seguidores', value: profile.followersCount, list: 'followers' },
                { label: 'seguindo', value: profile.followingCount, list: 'following' },
                { label: 'conexões', value: profile.connectionsCount }
              ] as { label: string; value: number; list?: FollowListKind }[]).map(stat => (
                <button
                  key={stat.label}
                  type="button"
                  disabled={!stat.list}
                  onClick={() => stat.list && setFollowList(stat.list)}
                  className={`${stat.label === 'conexões' ? 'hidden sm:flex' : 'flex'} flex-col sm:flex-row sm:items-baseline sm:gap-1.5 items-center ${stat.list ? 'cursor-pointer hover:opacity-80' : 'cursor-default'}`}
                >
                  <span className="text-[17px] sm:text-base font-bold text-white tabular-nums">{stat.value.toLocaleString('pt-BR')}</span>
                  <span className="text-[13px] sm:text-[15px] text-zinc-400">{stat.label}</span>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* nome, tipo, local e bio */}
        <div className="mt-4 sm:mt-5 sm:ml-[calc(150px+5.5rem)] space-y-1.5 max-w-xl">
          <h2 className="flex flex-wrap items-center gap-x-1.5 text-[15px] font-bold text-white">
            <span>{profile.displayName}</span>
            {profile.isVerified && <BadgeCheck className="sm:hidden w-4 h-4 text-white fill-fuchsia-500" aria-label="Perfil verificado" />}
            <span className="font-normal text-zinc-400">· {profile.age} anos</span>
            <span className="sm:hidden w-full font-normal text-[13px] text-zinc-500">@{profile.username}</span>
          </h2>
          <p className="flex flex-wrap items-center gap-x-1.5 gap-y-1 text-[13px] text-zinc-400">
            <span className="text-zinc-200">{PROFILE_TYPE_OPTIONS.find(o => o.id === profile.profileType)?.label ?? 'Perfil'}</span>
            <span aria-hidden>·</span>
            <span className="inline-flex items-center gap-1">
              <MapPin className="w-3.5 h-3.5" />
              {profile.locationPrivacy === 'hidden' ? 'Localização oculta' : [profile.city, profile.state].filter(Boolean).join(', ')}
            </span>
            {!isSelf && isOnline(profile.id) ? (
              <><span aria-hidden>·</span><span className="text-emerald-400 font-semibold inline-flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />Online agora</span></>
            ) : !isSelf && profile.lastActive && canSeeActivity(profile) ? (
              <><span aria-hidden>·</span><span>{activityLabel(profile.lastActive)}</span></>
            ) : null}
            <span className="sm:hidden text-zinc-500">· {profile.connectionsCount} {profile.connectionsCount === 1 ? 'conexão' : 'conexões'}</span>
          </p>

          <IdentityBadges profile={profile} />
          <GrowthBadges growth={isSelf && profile.growth ? { ...profile.growth, hasPhoto: temFotoPropria(profile.avatarUrl) } : profile.growth} />

          {profile.statusText && (
            <p className="text-sm text-fuchsia-200/90 italic">“{profile.statusText}”</p>
          )}
          {profile.bio && <p className="text-[14px] text-zinc-100 leading-relaxed whitespace-pre-line">{profile.bio}</p>}

          {isSelf && identityEntries(profile).some(e => !e.orientation || !e.gender) && (
            <button
              type="button"
              onClick={() => setEditTab('data')}
              className="text-[13px] text-amber-300/90 hover:text-amber-200 cursor-pointer"
            >
              Complete seu gênero e orientação no perfil
            </button>
          )}
        </div>

        {/* ações */}
        <div className="mt-4 sm:ml-[calc(150px+5.5rem)] flex items-center gap-2 max-w-xl">
          {isSelf ? (
            <>
              <button onClick={() => setEditTab('data')} className="flex-1 h-9 rounded-lg text-[14px] font-semibold bg-white/[0.09] hover:bg-white/[0.14] text-white flex items-center justify-center gap-2 cursor-pointer transition-colors">
                <Edit3 className="w-4 h-4" />Editar perfil
              </button>
              <button onClick={() => setEditTab('preferences')} className="flex-1 h-9 rounded-lg text-[14px] font-semibold bg-white/[0.09] hover:bg-white/[0.14] text-white flex items-center justify-center gap-2 cursor-pointer transition-colors">
                <Sliders className="w-4 h-4" />Preferências
              </button>
              <button onClick={() => compartilharPerfil(profile.id, profile.username)} className="w-9 h-9 shrink-0 rounded-lg bg-white/[0.09] hover:bg-white/[0.14] text-white flex items-center justify-center cursor-pointer" title="Compartilhar perfil" aria-label="Compartilhar perfil">
                <Share2 className="w-4 h-4" />
              </button>
            </>
          ) : (
            <>
              <button
                onClick={() => toggleFollow(profile.id)}
                className={`flex-1 h-9 rounded-lg text-[14px] font-semibold transition-colors cursor-pointer ${isFollowing ? 'bg-white/[0.09] hover:bg-white/[0.14] text-white' : 'fundo-neon text-white shadow-[0_6px_20px_-8px_rgba(236,72,153,0.9)]'}`}
              >
                {isFollowing ? 'Seguindo' : 'Seguir'}
              </button>
              <button
                onClick={() => startOrOpenConversation(profile.id)}
                className="flex-1 h-9 rounded-lg text-[14px] font-semibold bg-white/[0.09] hover:bg-white/[0.14] text-white flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <MessageSquare className="w-4 h-4" />Mensagem
              </button>
              <button
                onClick={() => requestConnection(profile.id)}
                disabled={isConnected || outgoingConnectionRequests.includes(profile.id)}
                title={isConnected ? 'Vocês estão conectados' : 'Pedir conexão'}
                className={`h-9 px-3 rounded-lg text-[14px] font-semibold flex items-center gap-1.5 transition-colors ${
                  incomingConnectionRequests.includes(profile.id)
                    ? 'fundo-neon text-white cursor-pointer'
                    : isConnected || outgoingConnectionRequests.includes(profile.id)
                      ? 'bg-white/[0.05] text-zinc-400 cursor-default'
                      : 'bg-white/[0.09] hover:bg-white/[0.14] text-white cursor-pointer'
                }`}
              >
                <UserPlus className="w-4 h-4" />
                <span className="hidden min-[400px]:inline">
                  {isConnected ? 'Conectados' : incomingConnectionRequests.includes(profile.id) ? 'Aceitar' : outgoingConnectionRequests.includes(profile.id) ? 'Pedido enviado' : 'Conectar'}
                </span>
              </button>
              <button onClick={() => compartilharPerfil(profile.id, profile.username)} className="w-9 h-9 shrink-0 rounded-lg bg-white/[0.09] hover:bg-white/[0.14] text-white flex items-center justify-center cursor-pointer" title="Compartilhar perfil" aria-label="Compartilhar perfil">
                <Share2 className="w-4 h-4" />
              </button>
            </>
          )}
        </div>

        {isSelf && <AvisoSeloFoto className="mt-5 sm:ml-[calc(150px+5.5rem)] max-w-xl" onColocarFoto={() => setEditTab('data')} />}

        {/* compatibilidade (perfil de outra pessoa) */}
        {!isSelf && compat && (
          <div className="mt-5 sm:ml-[calc(150px+5.5rem)] max-w-xl flex items-center gap-3.5 p-3 rounded-2xl border border-white/[0.08]">
            <span
              className="w-12 h-12 shrink-0 rounded-full flex items-center justify-center font-black text-white text-sm"
              style={{ background: `conic-gradient(${compat.color} ${compat.score * 3.6}deg, rgba(255,255,255,0.08) 0)` }}
            >
              <span className="w-[40px] h-[40px] rounded-full bg-fundo flex items-center justify-center">{compat.score}%</span>
            </span>
            <span className="min-w-0">
              <span className="block text-[14px] font-bold" style={{ color: compat.color }}>{compat.tier} com você</span>
              <span className="block text-[13px] text-zinc-400 truncate">
                {compat.reasons[0] || 'Objetivos e limites alinhados'}
                {compat.distanceKm !== null && ` · ~${compat.distanceKm} km`}
              </span>
            </span>
          </div>
        )}

        {/* integrantes do perfil conjunto */}
        {profile.profileType === 'couple' && profile.partners && profile.partners.length > 0 && (
          <div className="mt-5 sm:ml-[calc(150px+5.5rem)] max-w-xl">
            <p className="text-[13px] font-semibold text-zinc-400 mb-2 flex items-center gap-1.5"><Users className="w-4 h-4" />Quem faz parte deste perfil</p>
            <div className="flex flex-wrap gap-2">
              {profile.partners.map(p => (
                <div key={p.id} className="flex items-center gap-2.5 pl-1 pr-3.5 py-1 rounded-full bg-white/[0.05]">
                  <img src={p.avatarUrl || profile.avatarUrl} alt="" className="w-8 h-8 rounded-full object-cover" />
                  <span className="text-[13px] leading-tight">
                    <span className="block font-semibold text-white">{p.name}, {p.age}{p.consentConfirmed && <CheckCircle2 className="inline w-3.5 h-3.5 ml-1 -mt-0.5 text-emerald-400" aria-label="Participação autorizada" />}</span>
                    <span className="block text-zinc-400">{[p.gender, p.orientation].filter(Boolean).join(' · ') || 'Identidade não informada'}</span>
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* limites declarados */}
        {profile.compatibilityPrefs.personalLimits && profile.compatibilityPrefs.personalLimits.length > 0 && (
          <div className="mt-5 sm:ml-[calc(150px+5.5rem)] max-w-xl">
            <p className="text-[13px] font-semibold text-zinc-400 mb-2">Limites que pedimos para respeitar</p>
            <div className="flex flex-wrap gap-1.5">
              {profile.compatibilityPrefs.personalLimits.map((l, i) => (
                <span key={i} className="text-[13px] px-3 py-1 rounded-full border border-white/[0.1] text-zinc-200">{l}</span>
              ))}
            </div>
          </div>
        )}
      </section>

      {/* Abas do perfil (estilo Instagram) */}
      <div className="flex items-center justify-around sm:justify-center sm:gap-14 mt-4 mb-1 sm:mb-6 border-t border-white/[0.08]" role="tablist">
        {([
          { id: 'posts', label: 'Publicações', icon: Grid3x3, count: profilePosts.length },
          { id: 'vault', label: 'Cofres e álbuns', icon: Lock, count: albums.length },
          { id: 'public', label: 'Fotos', icon: Image, count: undefined }
        ] as const).map(tab => (
          <button
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={activeTab === tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex-1 sm:flex-none justify-center h-12 -mt-px border-t-2 text-[13px] font-semibold flex items-center gap-1.5 cursor-pointer transition-colors ${
              activeTab === tab.id ? 'border-white text-white' : 'border-transparent text-zinc-500 hover:text-zinc-300'
            }`}
          >
            <tab.icon className="w-[22px] h-[22px] sm:w-4 sm:h-4" strokeWidth={activeTab === tab.id ? 2.3 : 1.8} />
            <span className="hidden sm:inline">{tab.label}</span>
            {tab.count !== undefined && <span className="hidden sm:inline text-zinc-500">{tab.count}</span>}
          </button>
        ))}
      </div>

      {/* Tab 1: Private Vaults & Albums */}
      {activeTab === 'vault' && (
        <div className="space-y-6">
          <div className="p-4 rounded-2xl bg-purple-950/30 border border-purple-800/40 text-xs text-zinc-300 flex items-center justify-between gap-4">
            <div className="flex items-center gap-2.5">
              <Key className="w-5 h-5 text-fuchsia-400 shrink-0" />
              <span>
                Cofres privados possuem controle de chaves de acesso. Somente conexões aprovadas nominalmente podem visualizar os registros fotográficos.
              </span>
            </div>
            {isSelf && (
              <button
                type="button"
                onClick={() => setIsCreatingAlbum(true)}
                className="px-3 py-1.5 rounded-xl bg-gradient-to-r from-fuchsia-600 via-pink-600 to-orange-600 text-white text-xs font-bold flex items-center gap-1.5 shrink-0 cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                Novo álbum
              </button>
            )}
          </div>

          {albumsLoading && <p className="text-xs text-zinc-400 text-center py-6">Carregando álbuns...</p>}
          {!albumsLoading && albums.length === 0 && (
            <div className="p-8 text-center bg-painel border border-purple-900/30 rounded-3xl">
              <Lock className="w-10 h-10 text-purple-400 mx-auto mb-2 opacity-60" />
              <p className="text-xs text-zinc-400">
                {isSelf ? 'Você ainda não tem álbuns. Crie um cofre privado e escolha quem pode ver.' : 'Este perfil ainda não tem álbuns visíveis para você.'}
              </p>
            </div>
          )}

          <div className="grid sm:grid-cols-2 gap-6">
            {albums.map(alb => {
              const isVault = alb.visibility === 'private_vault';
              // Álbuns públicos/conexões só chegam aqui se o usuário pode vê-los (RLS)
              const hasAccess = isSelf || !isVault || alb.allowedUserIds.includes(currentUser.id);
              const hasRequested = alb.pendingRequestUserIds.includes(currentUser.id);

              return (
                <div key={alb.id} className="bg-painel border border-purple-900/30 rounded-3xl overflow-hidden shadow-xl flex flex-col justify-between">

                  {/* Album Cover preview */}
                  <div className="relative aspect-[16/10] bg-zinc-950 overflow-hidden">
                    <img
                      src={alb.coverUrl}
                      alt={alb.title}
                      className={`w-full h-full object-cover transition-all ${
                        isVault && !hasAccess ? 'blur-xl scale-110' : ''
                      }`}
                    />

                    <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />

                    {/* Lock overlay if vault and no access */}
                    {isVault && !hasAccess && (
                      <div className="absolute inset-0 flex flex-col items-center justify-center p-4 text-center">
                        <div className="w-12 h-12 rounded-full bg-black/70 border border-purple-500/50 flex items-center justify-center text-fuchsia-400 mb-2 shadow-2xl">
                          <Lock className="w-6 h-6" />
                        </div>
                        <span className="text-xs font-bold text-white drop-shadow">
                          Cofre Protegido com Chave
                        </span>
                        <span className="text-[12px] text-zinc-300 drop-shadow">
                          {alb.mediaCount} mídias íntimas
                        </span>
                      </div>
                    )}

                    {/* Top status tag */}
                    <div className="absolute top-3 right-3">
                      {isVault ? (
                        <span className="px-2.5 py-1 rounded-full bg-rose-950/80 backdrop-blur-md border border-rose-500/40 text-rose-300 text-[10px] font-bold flex items-center gap-1">
                          <Lock className="w-3 h-3" /> Privado
                        </span>
                      ) : (
                        <span className="px-2.5 py-1 rounded-full bg-zinc-900/80 backdrop-blur-md border border-zinc-700 text-zinc-300 text-[10px] font-bold">
                          Público
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Album Body Info & Permission Button */}
                  <div className="p-4 space-y-3">
                    <div>
                      <h4 className="text-sm font-bold text-white">{alb.title}</h4>
                      <p className="text-xs text-zinc-400 mt-0.5">{alb.description}</p>
                    </div>

                    <div className="pt-2 border-t border-purple-900/30 flex items-center justify-between gap-2 flex-wrap">
                      <div className="flex items-center gap-2">
                        <span className="text-[12px] text-zinc-400">{alb.mediaCount} {alb.mediaCount === 1 ? 'mídia' : 'mídias'}</span>
                        {hasAccess && (
                          <button
                            type="button"
                            onClick={() => setViewingAlbumId(alb.id)}
                            className="px-2.5 py-1 rounded-lg text-[12px] font-semibold text-purple-200 bg-purple-950/60 hover:bg-purple-900/60 cursor-pointer"
                          >
                            {isSelf ? 'Abrir e enviar fotos' : 'Ver fotos'}
                          </button>
                        )}
                      </div>

                      {/* Controls */}
                      {isSelf ? (isVault && (
                        <button
                          onClick={() => setManagingAlbum(alb)}
                          className="px-3 py-1.5 rounded-xl bg-purple-950 hover:bg-purple-900 text-purple-300 border border-purple-800 text-xs font-bold flex items-center gap-1.5 cursor-pointer"
                        >
                          <Key className="w-3.5 h-3.5" />
                          <span>Chaves ({alb.allowedUserIds.length}{alb.pendingRequestUserIds.length > 0 ? ` • ${alb.pendingRequestUserIds.length} pedido${alb.pendingRequestUserIds.length > 1 ? 's' : ''}` : ''})</span>
                        </button>
                      )) : isVault ? (
                        hasAccess ? (
                          <span className="text-xs font-bold text-emerald-400 flex items-center gap-1">
                            ✓ Acesso Liberado
                          </span>
                        ) : hasRequested ? (
                          <span className="text-xs font-bold text-purple-400">
                            Solicitação em Análise
                          </span>
                        ) : (
                          <button
                            onClick={async () => { if (await requestAlbumAccess(alb.id, profile.id)) loadAlbums(); }}
                            className="px-3.5 py-1.5 rounded-xl bg-gradient-to-r from-fuchsia-600 via-pink-600 to-orange-600 hover:from-fuchsia-500 hover:via-pink-500 hover:to-orange-500 text-white text-xs font-bold shadow-md cursor-pointer transition-all"
                          >
                            Solicitar Chave do Cofre
                          </button>
                        )
                      ) : (
                        <span className="text-xs text-zinc-400">{alb.visibility === 'public' ? 'Público' : 'Para conexões'}</span>
                      )}
                    </div>

                  </div>

                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Tab 2: Public Photos */}
      {activeTab === 'public' && (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {albums
            .filter(a => a.visibility === 'public')
            .flatMap(a => a.items)
            .map((item, idx) => (
              <div key={idx} className="relative aspect-square rounded-2xl overflow-hidden bg-zinc-950 group">
                <img src={item.url} alt="Foto pública" className="w-full h-full object-cover group-hover:scale-105 transition-transform" />
                {item.caption && (
                  <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center p-3 text-center text-xs text-white">
                    {item.caption}
                  </div>
                )}
              </div>
            ))}
        </div>
      )}

      {/* Tab 3: User Posts */}
      {activeTab === 'posts' && (
        <>
          {profilePosts.length > 0 ? (
            <div className="grid grid-cols-3 gap-[3px] sm:gap-1">
              {profilePosts.map(p => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => setOpenPostId(p.id)}
                  className="relative aspect-[3/4] bg-zinc-950 overflow-hidden group cursor-pointer sm:rounded-md"
                  aria-label="Abrir publicação"
                >
                  {p.mediaUrls.length > 0 ? (
                    <>
                      <MediaThumb url={p.mediaUrls[0]} isVideo={p.mediaType === 'video'} className="w-full h-full object-cover" />
                      {(p.mediaType === 'video' || isVideoUrl(p.mediaUrls[0])) && <Play className="absolute top-2 right-2 w-4 h-4 text-white fill-white drop-shadow" aria-label="Vídeo" />}
                    </>
                  ) : (
                    <span className="absolute inset-0 p-3 flex items-center justify-center text-center text-[13px] sm:text-[15px] font-semibold leading-snug text-white bg-[radial-gradient(120%_90%_at_20%_0%,#86198f,#1a1229_70%)] line-clamp-6">
                      {p.content}
                    </span>
                  )}
                  {p.mediaUrls.length > 1 && <Copy className="absolute top-2 right-2 w-4 h-4 text-white drop-shadow" />}
                  <span className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-4 text-white text-sm font-bold">
                    <span className="flex items-center gap-1"><Heart className="w-4 h-4 fill-white" /> {p.likesCount}</span>
                    <span className="flex items-center gap-1"><MessageCircle className="w-4 h-4 fill-white" /> {p.commentsCount}</span>
                  </span>
                </button>
              ))}
            </div>
          ) : (
            <p className="text-sm text-zinc-400 text-center py-14 px-6">
              {isSelf ? 'Você ainda não publicou nada. Sua primeira publicação aparece aqui.' : 'Este perfil ainda não publicou nada.'}
            </p>
          )}

          {openPost && (
            <div className="modal-overlay fixed inset-0 z-50 bg-black/85 backdrop-blur-sm flex items-start sm:items-center justify-center p-2 sm:p-4 overflow-y-auto" onClick={() => setOpenPostId(null)}>
              <div className="w-full max-w-xl my-auto bg-fundo rounded-2xl overflow-hidden" onClick={e => e.stopPropagation()}>
                <button type="button" onClick={() => setOpenPostId(null)} className="m-2 ml-auto flex items-center gap-1 text-[13px] text-zinc-300 hover:text-white cursor-pointer">
                  Fechar ✕
                </button>
                <PostCard post={openPost} />
              </div>
            </div>
          )}
        </>
      )}

      {/* Edit Profile Modal */}
      {editTab && <EditProfileModal isOpen initialTab={editTab} onClose={() => setEditTab(null)} />}

      {followList && (
        <FollowListModal
          profileId={profile.id}
          username={profile.username}
          followersCount={profile.followersCount}
          followingCount={profile.followingCount}
          initialKind={followList}
          onClose={() => setFollowList(null)}
        />
      )}

      {/* Album Permissions Modal */}
      {managingAlbum && (
        <AlbumPermissionsModal
          album={managingAlbum}
          isOpen={!!managingAlbum}
          onClose={() => setManagingAlbum(null)}
          onChanged={loadAlbums}
        />
      )}

      {viewingAlbum && (
        <AlbumViewerModal
          album={viewingAlbum}
          isOwner={isSelf}
          onClose={() => setViewingAlbumId(null)}
          onChanged={loadAlbums}
        />
      )}

      {isCreatingAlbum && (
        <CreateAlbumModal onClose={() => setIsCreatingAlbum(false)} onCreated={loadAlbums} />
      )}

    </div>
  );
};
