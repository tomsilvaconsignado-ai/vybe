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
  Ban
} from 'lucide-react';
import { EditProfileModal, EditProfileTab } from './EditProfileModal';
import { AlbumPermissionsModal } from './AlbumPermissionsModal';
import { AlbumViewerModal } from './AlbumViewerModal';
import { CreateAlbumModal } from './CreateAlbumModal';
import { fetchAlbums } from '../../lib/albums';
import { fetchUserPosts, fetchProfileById, FollowListKind } from '../../lib/social';
import { FollowListModal } from './FollowListModal';
import { OnlineDot, activityLabel } from '../common/OnlineDot';
import { PROFILE_TYPE_OPTIONS } from '../../lib/profileOptions';
import { PostCard } from '../feed/PostCard';
import { calculateCompatibility, OBJECTIVE_LABELS } from '../../utils/compatibility';
import { MediaAlbum, Post, UserProfile } from '../../types';
import { notify, askConfirm } from '../common/Feedback';

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
    <div className="max-w-4xl mx-auto py-6 px-4">
      
      {/* Back button if viewing another user */}
      {!isSelf && (
        <button
          onClick={() => setSelectedProfileId(null)}
          className="mb-4 text-xs font-semibold text-zinc-400 hover:text-white flex items-center gap-1.5 cursor-pointer"
        >
          <ChevronLeft className="w-4 h-4" />
          <span>Voltar ao meu perfil</span>
        </button>
      )}

      {/* Main Profile Header Card */}
      <div className="bg-[#120d20] border border-purple-900/30 rounded-3xl overflow-hidden shadow-2xl mb-6">
        
        {/* Cover Photo */}
        <div className="h-48 sm:h-64 relative bg-zinc-950 overflow-hidden">
          <img
            src={profile.coverUrl}
            alt="Capa do Perfil"
            className="w-full h-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-[#120d20] via-transparent to-black/30" />

          {/* Badges on top of cover */}
          <div className="absolute top-4 right-4 flex items-center gap-2">
            {profile.isVerified && (
              <span className="px-3 py-1 rounded-full bg-black/60 backdrop-blur-md border border-purple-500/40 text-purple-300 text-xs font-bold flex items-center gap-1.5 shadow">
                <ShieldCheck className="w-4 h-4 text-purple-400" />
                <span>Perfil Verificado +18</span>
              </span>
            )}
            
            {!isSelf && (
              <button
                onClick={() => setReportModalTarget({
                  targetType: 'profile',
                  targetId: profile.id,
                  reportedUserId: profile.id,
                  reportedUserName: profile.username
                })}
                className="p-2 rounded-full bg-black/60 text-zinc-400 hover:text-rose-400 transition-colors cursor-pointer"
                title="Denunciar perfil à moderação"
                aria-label="Denunciar perfil à moderação"
              >
                <ShieldAlert className="w-4 h-4" />
              </button>
            )}
            {!isSelf && (
              <button
                onClick={async () => {
                  if (await askConfirm({ title: `Bloquear ${profile.displayName}?`, message: "Vocês deixam de se seguir e de ser conexões. A pessoa não verá mais seu perfil, posts e stories, nem poderá enviar mensagens ou pedir acesso aos seus cofres. Ela não é avisada. Você pode desbloquear em Configurações.", confirmLabel: "Bloquear", danger: true })) {
                    await blockUser(profile.id);
                  }
                }}
                className="p-2 rounded-full bg-black/60 text-zinc-400 hover:text-rose-400 transition-colors cursor-pointer"
                title="Bloquear perfil"
                aria-label="Bloquear perfil"
              >
                <Ban className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>

        {/* Profile Details Container */}
        <div className="px-6 pb-6 pt-0 relative">
          
          {/* Avatar and Primary Actions */}
          <div className="flex flex-col sm:flex-row items-center sm:items-end justify-between gap-4 -mt-16 sm:-mt-20 mb-4">
            
            {/* Avatar */}
            <div className="relative">
              <img
                src={profile.avatarUrl}
                alt={profile.displayName}
                className="w-28 h-28 sm:w-36 sm:h-36 rounded-full object-cover border-4 border-[#120d20] shadow-2xl"
              />
              {!isSelf && <OnlineDot userId={profile.id} size="lg" className="top-2 right-2 sm:top-3 sm:right-3" />}
              {profile.isVerified && (
                <span className="absolute bottom-1 right-1 w-7 h-7 bg-purple-600 rounded-full flex items-center justify-center text-white text-xs font-bold border-2 border-[#120d20] shadow">
                  ✓
                </span>
              )}
            </div>

            {/* Actions for Self or Visitor */}
            <div className="flex items-center gap-2.5 flex-wrap justify-center sm:justify-end">
              {isSelf ? (
                <>
                  <button
                    onClick={() => setEditTab('data')}
                    className="px-4 py-2 rounded-xl text-xs font-bold bg-zinc-800 hover:bg-zinc-700 text-white flex items-center gap-2 cursor-pointer transition-colors"
                  >
                    <Edit3 className="w-3.5 h-3.5" />
                    <span>Editar Perfil</span>
                  </button>
                  <button
                    onClick={() => setEditTab('preferences')}
                    className="px-4 py-2 rounded-xl text-xs font-bold bg-zinc-800 hover:bg-zinc-700 text-white flex items-center gap-2 cursor-pointer transition-colors"
                  >
                    <Sliders className="w-3.5 h-3.5" />
                    <span>Preferências</span>
                  </button>
                  <button
                    onClick={() => notify('Link seguro do seu perfil copiado!')}
                    className="p-2 rounded-xl bg-zinc-800 text-zinc-300 hover:text-white transition-colors cursor-pointer"
                    title="Compartilhar"
                  >
                    <Share2 className="w-4 h-4" />
                  </button>
                </>
              ) : (
                <>
                  <button
                    onClick={() => startOrOpenConversation(profile.id)}
                    className="px-5 py-2.5 rounded-xl text-xs font-bold text-white bg-gradient-to-r from-purple-600 to-rose-600 hover:from-purple-500 hover:to-rose-500 shadow-md shadow-purple-950/50 flex items-center gap-1.5 cursor-pointer"
                  >
                    <MessageSquare className="w-4 h-4" />
                    <span>Mensagem</span>
                  </button>

                  <button
                    onClick={() => toggleFollow(profile.id)}
                    className={`px-4 py-2.5 rounded-xl text-xs font-semibold border transition-all cursor-pointer ${
                      isFollowing 
                        ? 'bg-zinc-800 text-zinc-300 border-zinc-700' 
                        : 'bg-purple-950/60 text-purple-300 border-purple-800 hover:bg-purple-900/60'
                    }`}
                  >
                    {isFollowing ? 'Seguindo' : '+ Seguir'}
                  </button>

                  <button
                    onClick={() => requestConnection(profile.id)}
                    disabled={isConnected || outgoingConnectionRequests.includes(profile.id)}
                    className={`px-4 py-2.5 rounded-xl text-xs font-semibold border transition-colors ${
                      incomingConnectionRequests.includes(profile.id)
                        ? "bg-gradient-to-r from-purple-600 to-rose-600 text-white border-transparent cursor-pointer"
                        : isConnected || outgoingConnectionRequests.includes(profile.id)
                          ? "bg-zinc-900/60 text-zinc-500 border-zinc-800 cursor-default"
                          : "bg-zinc-900 text-zinc-200 border-zinc-700 hover:text-white active:scale-95 cursor-pointer"
                    }`}
                  >
                    {isConnected
                      ? 'Conectado(a)'
                      : incomingConnectionRequests.includes(profile.id)
                        ? 'Aceitar conexão'
                        : outgoingConnectionRequests.includes(profile.id)
                          ? 'Solicitado'
                          : 'Conectar'}
                  </button>
                </>
              )}
            </div>
          </div>

          {/* Name, Handle, Type, Location */}
          <div className="space-y-2 text-center sm:text-left">
            <div className="flex flex-col sm:flex-row sm:items-center gap-2">
              <h2 className="text-2xl font-extrabold text-white flex items-center justify-center sm:justify-start gap-2">
                <span>{profile.displayName}</span>
                <span className="text-sm font-normal text-zinc-400">({profile.age} anos)</span>
              </h2>
              <span className="text-xs px-2.5 py-0.5 rounded-full bg-purple-950 text-purple-300 border border-purple-800/40 w-max mx-auto sm:mx-0 capitalize">
                {PROFILE_TYPE_OPTIONS.find(o => o.id === profile.profileType)?.label ?? 'Perfil'}
              </span>
            </div>

            <div className="flex items-center justify-center sm:justify-start gap-3 text-xs text-zinc-400">
              <span className="text-purple-400 font-medium">@{profile.username}</span>
              <span>•</span>
              <span className="flex items-center gap-1">
                <MapPin className="w-3.5 h-3.5 text-rose-400" />
                {profile.locationPrivacy === 'hidden' ? 'Localização Oculta' : [profile.city, profile.state].filter(Boolean).join(', ')}
              </span>
              {!isSelf && isOnline(profile.id) ? (
                <>
                  <span>•</span>
                  <span className="text-emerald-400 font-semibold flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" /> Online agora
                  </span>
                </>
              ) : !isSelf && profile.lastActive && canSeeActivity(profile) ? (
                <>
                  <span>•</span>
                  <span className="text-zinc-400">{activityLabel(profile.lastActive)}</span>
                </>
              ) : null}
            </div>

            {/* Contadores (como no Instagram): seguidores e seguindo abrem as listas */}
            <div className="grid grid-cols-4 sm:flex sm:gap-8 py-3 my-1 border-y border-purple-900/20 text-center sm:text-left">
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
                  className={`flex flex-col sm:flex-row sm:items-baseline sm:gap-1 items-center ${stat.list ? 'cursor-pointer hover:opacity-80' : 'cursor-default'}`}
                >
                  <span className="text-base font-extrabold text-white">{stat.value}</span>
                  <span className="text-[11px] sm:text-xs text-zinc-400">{stat.label}</span>
                </button>
              ))}
            </div>

            {profile.statusText && (
              <div className="p-3 bg-zinc-950/60 border border-purple-900/30 rounded-2xl text-xs text-purple-300 italic">
                "{profile.statusText}"
              </div>
            )}

            <p className="text-sm text-zinc-300 leading-relaxed max-w-2xl pt-1">
              {profile.bio}
            </p>
          </div>

          {/* Joint Couple Breakdown (If Couple) */}
          {profile.profileType === 'couple' && profile.partners && profile.partners.length > 0 && (
            <div className="mt-5 p-4 rounded-2xl bg-zinc-950/70 border border-purple-900/30">
              <h4 className="text-xs font-bold text-zinc-300 uppercase tracking-wider mb-3 flex items-center gap-1.5">
                <Users className="w-4 h-4 text-purple-400" />
                Integrantes do Perfil Conjunto
              </h4>

              <div className="grid sm:grid-cols-2 gap-3">
                {profile.partners.map(p => (
                  <div key={p.id} className="p-3 rounded-xl bg-zinc-900/60 border border-zinc-800 flex items-center gap-3">
                    <img
                      src={p.avatarUrl || profile.avatarUrl}
                      alt={p.name}
                      className="w-10 h-10 rounded-full object-cover border border-purple-500/40"
                    />
                    <div>
                      <div className="text-xs font-bold text-white flex items-center gap-1.5">
                        <span>{p.name}, {p.age}</span>
                        {p.consentConfirmed && (
                          <span className="text-[9px] px-1.5 py-0.2 rounded bg-emerald-950 text-emerald-400 border border-emerald-800">
                            Autorizado
                          </span>
                        )}
                      </div>
                      <div className="text-[11px] text-zinc-400">
                        {p.gender} • {p.orientation || 'Liberal'}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Compatibility Banner (If visiting another profile) */}
          {!isSelf && compat && (
            <div className="mt-5 p-4 rounded-2xl bg-gradient-to-r from-purple-950/50 via-zinc-900/80 to-purple-950/50 border border-purple-800/40 flex items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div 
                  className="w-12 h-12 rounded-2xl border-2 flex items-center justify-center font-black text-white text-base shadow-lg"
                  style={{ borderColor: compat.color, backgroundColor: `${compat.color}20` }}
                >
                  {compat.score}%
                </div>
                <div>
                  <div className="text-xs font-bold text-white" style={{ color: compat.color }}>
                    {compat.tier} com você
                  </div>
                  <div className="text-[11px] text-zinc-300">
                    {compat.reasons[0] || 'Objetivos e limites alinhados'}
                  </div>
                </div>
              </div>

              <div className="text-right hidden sm:block">
                <span className="text-[11px] text-zinc-400 block">
                  {compat.sharedObjectives.length} objetivos mútuos
                </span>
                <span className="text-[11px] text-zinc-400 block">
                  {compat.distanceKm} km de distância aproximada
                </span>
              </div>
            </div>
          )}

          {/* Stated Limits & Respect */}
          {profile.compatibilityPrefs.personalLimits && profile.compatibilityPrefs.personalLimits.length > 0 && (
            <div className="mt-4 p-3.5 rounded-2xl bg-purple-950/20 border border-purple-900/20">
              <span className="text-xs font-bold text-zinc-300 block mb-1.5">
                Limites Pessoais & Condições Declaradas:
              </span>
              <div className="flex flex-wrap gap-1.5">
                {profile.compatibilityPrefs.personalLimits.map((l, i) => (
                  <span key={i} className="text-[11px] px-2.5 py-1 rounded-lg bg-zinc-900/80 border border-zinc-800 text-zinc-300">
                    ✓ {l}
                  </span>
                ))}
              </div>
            </div>
          )}

        </div>
      </div>

      {/* Abas do perfil (estilo Instagram) */}
      <div className="flex items-center justify-around sm:justify-center sm:gap-10 mb-6 border-t border-purple-950/40" role="tablist">
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
            className={`py-3 -mt-px border-t-2 text-[11px] font-bold uppercase tracking-wider flex items-center gap-1.5 cursor-pointer ${
              activeTab === tab.id ? 'border-fuchsia-400 text-white' : 'border-transparent text-zinc-500 hover:text-zinc-300'
            }`}
          >
            <tab.icon className="w-4 h-4" />
            <span className="hidden sm:inline">{tab.label}</span>
            {tab.count !== undefined && <span className="text-zinc-500">{tab.count}</span>}
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
                className="px-3 py-1.5 rounded-xl bg-gradient-to-r from-purple-600 to-rose-600 text-white text-xs font-bold flex items-center gap-1.5 shrink-0 cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                Novo álbum
              </button>
            )}
          </div>

          {albumsLoading && <p className="text-xs text-zinc-400 text-center py-6">Carregando álbuns...</p>}
          {!albumsLoading && albums.length === 0 && (
            <div className="p-8 text-center bg-[#120d20] border border-purple-900/30 rounded-3xl">
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
                <div key={alb.id} className="bg-[#120d20] border border-purple-900/30 rounded-3xl overflow-hidden shadow-xl flex flex-col justify-between">
                  
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
                        <span className="text-[11px] text-zinc-300 drop-shadow">
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
                        <span className="text-[11px] text-zinc-400">{alb.mediaCount} {alb.mediaCount === 1 ? 'mídia' : 'mídias'}</span>
                        {hasAccess && (
                          <button
                            type="button"
                            onClick={() => setViewingAlbumId(alb.id)}
                            className="px-2.5 py-1 rounded-lg text-[11px] font-semibold text-purple-200 bg-purple-950/60 hover:bg-purple-900/60 cursor-pointer"
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
                            className="px-3.5 py-1.5 rounded-xl bg-gradient-to-r from-purple-600 to-rose-600 hover:from-purple-500 hover:to-rose-500 text-white text-xs font-bold shadow-md cursor-pointer transition-all"
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
            <div className="grid grid-cols-3 gap-1 sm:gap-2">
              {profilePosts.map(p => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => setOpenPostId(p.id)}
                  className="relative aspect-[3/4] bg-zinc-950 overflow-hidden group cursor-pointer sm:rounded-xl"
                  aria-label="Abrir publicação"
                >
                  {p.mediaUrls.length > 0 ? (
                    <img src={p.mediaUrls[0]} alt="" loading="lazy" className="w-full h-full object-cover" />
                  ) : (
                    <span className="absolute inset-0 p-3 flex items-center justify-center text-center text-[11px] sm:text-xs text-zinc-200 bg-gradient-to-br from-purple-950 to-rose-950 line-clamp-6">
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
            <p className="text-xs text-zinc-400 text-center py-10">
              {isSelf ? 'Você ainda não publicou nada. Sua primeira publicação aparece aqui.' : 'Este perfil ainda não publicou nada.'}
            </p>
          )}

          {openPost && (
            <div className="modal-overlay fixed inset-0 z-50 bg-black/85 backdrop-blur-sm flex items-start sm:items-center justify-center p-2 sm:p-4 overflow-y-auto" onClick={() => setOpenPostId(null)}>
              <div className="w-full max-w-xl my-auto" onClick={e => e.stopPropagation()}>
                <button type="button" onClick={() => setOpenPostId(null)} className="mb-2 ml-auto flex items-center gap-1 text-xs text-zinc-300 cursor-pointer">
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
