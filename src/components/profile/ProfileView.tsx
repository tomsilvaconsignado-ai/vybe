import React, { useState } from 'react';
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
  ChevronLeft
} from 'lucide-react';
import { EditProfileModal } from './EditProfileModal';
import { AlbumPermissionsModal } from './AlbumPermissionsModal';
import { PostCard } from '../feed/PostCard';
import { calculateCompatibility, OBJECTIVE_LABELS } from '../../utils/compatibility';
import { MediaAlbum } from '../../types';

export const ProfileView: React.FC = () => {
  const { 
    currentUser, 
    selectedProfileId, 
    setSelectedProfileId, 
    profiles, 
    posts, 
    connections, 
    requestConnection, 
    following, 
    toggleFollow, 
    startOrOpenConversation, 
    requestAlbumAccess,
    setReportModalTarget 
  } = useApp();

  const isSelf = !selectedProfileId || selectedProfileId === currentUser.id;
  const profile = isSelf ? currentUser : profiles.find(p => p.id === selectedProfileId) || currentUser;

  const [activeTab, setActiveTab] = useState<'vault' | 'public' | 'posts'>('vault');
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [managingAlbum, setManagingAlbum] = useState<MediaAlbum | null>(null);

  const isFollowing = following.includes(profile.id);
  const isConnected = connections.includes(profile.id);
  const compat = !isSelf ? calculateCompatibility(currentUser, profile) : null;
  const userPosts = posts.filter(p => p.userId === profile.id);

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
                  reportedUserName: profile.username
                })}
                className="p-2 rounded-full bg-black/60 text-zinc-400 hover:text-rose-400 transition-colors cursor-pointer"
                title="Denunciar perfil à moderação"
              >
                <ShieldAlert className="w-4 h-4" />
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
                    onClick={() => setIsEditOpen(true)}
                    className="px-4 py-2 rounded-xl text-xs font-bold bg-zinc-800 hover:bg-zinc-700 text-white flex items-center gap-2 cursor-pointer transition-colors"
                  >
                    <Edit3 className="w-3.5 h-3.5" />
                    <span>Editar Perfil</span>
                  </button>
                  <button
                    onClick={() => alert('Link seguro do seu perfil copiado!')}
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
                    className="px-4 py-2.5 rounded-xl text-xs font-semibold bg-zinc-900 text-zinc-300 border border-zinc-800 hover:text-white cursor-pointer"
                  >
                    {isConnected ? 'Conectado(a)' : 'Conectar'}
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
                {profile.profileType === 'couple' ? 'Casal Liberal' : profile.profileType === 'single_female' ? 'Mulher Solteira' : 'Homem Solteiro'}
              </span>
            </div>

            <div className="flex items-center justify-center sm:justify-start gap-3 text-xs text-zinc-400">
              <span className="text-purple-400 font-medium">@{profile.username}</span>
              <span>•</span>
              <span className="flex items-center gap-1">
                <MapPin className="w-3.5 h-3.5 text-rose-400" />
                {profile.locationPrivacy === 'hidden' ? 'Localização Oculta' : `${profile.city}, ${profile.state}`}
              </span>
              <span>•</span>
              <span className="text-emerald-400 font-medium">{profile.lastActive}</span>
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

          {/* Followers / Connections Stats */}
          <div className="flex items-center justify-around sm:justify-start sm:gap-8 pt-5 border-t border-purple-900/20 mt-5 text-center sm:text-left">
            <div>
              <span className="text-base font-extrabold text-white block">{profile.followersCount}</span>
              <span className="text-[11px] text-zinc-400">Seguidores</span>
            </div>
            <div>
              <span className="text-base font-extrabold text-white block">{profile.followingCount}</span>
              <span className="text-[11px] text-zinc-400">Seguindo</span>
            </div>
            <div>
              <span className="text-base font-extrabold text-white block">{profile.connectionsCount}</span>
              <span className="text-[11px] text-zinc-400">Conexões Mútuas</span>
            </div>
            <div>
              <span className="text-base font-extrabold text-purple-400 block">{profile.albums.length}</span>
              <span className="text-[11px] text-zinc-400">Álbuns & Cofres</span>
            </div>
          </div>

        </div>
      </div>

      {/* Media & Feed Section Tabs */}
      <div className="flex items-center gap-2 mb-6 border-b border-purple-950/40 pb-3">
        <button
          onClick={() => setActiveTab('vault')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer ${
            activeTab === 'vault'
              ? 'bg-purple-600 text-white shadow-md shadow-purple-950/50'
              : 'text-zinc-400 hover:text-white bg-zinc-900/50'
          }`}
        >
          <Lock className="w-3.5 h-3.5" />
          <span>Cofres Íntimos & Álbuns Privados</span>
        </button>

        <button
          onClick={() => setActiveTab('public')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer ${
            activeTab === 'public'
              ? 'bg-purple-600 text-white shadow-md shadow-purple-950/50'
              : 'text-zinc-400 hover:text-white bg-zinc-900/50'
          }`}
        >
          <Image className="w-3.5 h-3.5" />
          <span>Fotos Públicas</span>
        </button>

        <button
          onClick={() => setActiveTab('posts')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer ${
            activeTab === 'posts'
              ? 'bg-purple-600 text-white shadow-md shadow-purple-950/50'
              : 'text-zinc-400 hover:text-white bg-zinc-900/50'
          }`}
        >
          <span>Publicações no Feed ({userPosts.length})</span>
        </button>
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
              <span className="text-[11px] font-bold text-fuchsia-400 shrink-0">
                Você é o proprietário
              </span>
            )}
          </div>

          <div className="grid sm:grid-cols-2 gap-6">
            {profile.albums.map(alb => {
              const isVault = alb.visibility === 'private_vault';
              const hasAccess = isSelf || alb.allowedUserIds.includes(currentUser.id);
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

                    <div className="pt-2 border-t border-purple-900/30 flex items-center justify-between">
                      <span className="text-[11px] text-zinc-400">{alb.mediaCount} fotos</span>

                      {/* Controls */}
                      {isSelf ? (
                        <button
                          onClick={() => setManagingAlbum(alb)}
                          className="px-3 py-1.5 rounded-xl bg-purple-950 hover:bg-purple-900 text-purple-300 border border-purple-800 text-xs font-bold flex items-center gap-1.5 cursor-pointer"
                        >
                          <Key className="w-3.5 h-3.5" />
                          <span>Gerenciar Chaves ({alb.allowedUserIds.length})</span>
                        </button>
                      ) : isVault ? (
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
                            onClick={() => requestAlbumAccess(alb.id, profile.id)}
                            className="px-3.5 py-1.5 rounded-xl bg-gradient-to-r from-purple-600 to-rose-600 hover:from-purple-500 hover:to-rose-500 text-white text-xs font-bold shadow-md cursor-pointer transition-all"
                          >
                            Solicitar Chave do Cofre
                          </button>
                        )
                      ) : (
                        <span className="text-xs text-zinc-400">Livre para visualização</span>
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
          {profile.albums
            .flatMap(a => a.items)
            .filter(item => item.visibility === 'public')
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
        <div className="space-y-6 max-w-xl mx-auto">
          {userPosts.map(p => (
            <PostCard key={p.id} post={p} />
          ))}
          {userPosts.length === 0 && (
            <p className="text-xs text-zinc-400 text-center py-8">
              Este perfil ainda não publicou nada no feed.
            </p>
          )}
        </div>
      )}

      {/* Edit Profile Modal */}
      <EditProfileModal isOpen={isEditOpen} onClose={() => setIsEditOpen(false)} />

      {/* Album Permissions Modal */}
      {managingAlbum && (
        <AlbumPermissionsModal
          album={managingAlbum}
          isOpen={!!managingAlbum}
          onClose={() => setManagingAlbum(null)}
        />
      )}

    </div>
  );
};
