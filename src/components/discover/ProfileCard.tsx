import React from 'react';
import { useApp } from '../../context/AppContext';
import { 
  Heart, 
  MessageSquare, 
  Lock, 
  MapPin, 
  Sparkles, 
  ShieldCheck, 
  Users, 
  UserPlus, 
  Check, 
  Eye
} from 'lucide-react';
import { UserProfile } from '../../types';
import { calculateCompatibility } from '../../utils/compatibility';
import { PROFILE_TYPE_OPTIONS } from '../../lib/profileOptions';
import { OnlineDot } from '../common/OnlineDot';

interface ProfileCardProps {
  profile: UserProfile;
  viewMode?: 'grid' | 'list';
  regionMatch?: 'city' | 'state';   // achado pela busca "perto de mim" pelo cadastro
}

export const ProfileCard: React.FC<ProfileCardProps> = ({ profile, viewMode = 'grid', regionMatch }) => {
  const regionLabel = regionMatch === 'city' ? 'Mesma cidade' : regionMatch === 'state' ? 'Mesmo estado' : null;
  const { 
    currentUser, 
    setSelectedProfileId, 
    startOrOpenConversation, 
    connections, 
    requestConnection,
    following,
    toggleFollow,
    getCompatibility,
    isOnline
  } = useApp();

  const isConnected = connections.includes(profile.id);
  const isFollowing = following.includes(profile.id);
  const compat = getCompatibility(profile);

  if (viewMode === 'list') {
    return (
      <div className="bg-[#120d20] border border-purple-900/30 rounded-3xl p-4 sm:p-5 shadow-xl hover:border-purple-700/50 transition-all flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        
        <div 
          onClick={() => setSelectedProfileId(profile.id)}
          className="flex items-center gap-4 cursor-pointer flex-1"
        >
          <div className="relative shrink-0">
            <img
              src={profile.avatarUrl}
              alt={profile.displayName}
              className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl object-cover border-2 border-purple-500/40"
            />
            <OnlineDot userId={profile.id} className="-bottom-1 -right-1" />
            {profile.isVerified && (
              <span className="absolute -top-1 -right-1 w-5 h-5 bg-purple-500 rounded-full flex items-center justify-center text-xs text-white shadow">
                ✓
              </span>
            )}
          </div>

          <div className="space-y-1">
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="font-bold text-base text-white hover:text-purple-300 transition-colors">
                {profile.displayName}
              </h3>
              <span className="text-[11px] px-2 py-0.5 rounded-full bg-purple-950 text-purple-300 border border-purple-800/40">
                {PROFILE_TYPE_OPTIONS.find(o => o.id === profile.profileType)?.label ?? 'Perfil'}
              </span>
              <span className="text-xs text-zinc-400">
                {profile.age} anos
              </span>
            </div>

            <div className="flex items-center gap-2 text-xs text-zinc-400">
              <span className="flex items-center gap-1">
                <MapPin className="w-3.5 h-3.5 text-rose-400" />
                {[profile.city, profile.state].filter(Boolean).join(', ')}
              </span>
              {profile.approximateDistanceKm !== undefined && (
                <>
                  <span>•</span>
                  <span className="text-emerald-300 font-semibold">~{profile.approximateDistanceKm} km de você</span>
                </>
              )}
              {profile.approximateDistanceKm === undefined && regionLabel && (
                <>
                  <span>•</span>
                  <span className="text-emerald-300 font-semibold">{regionLabel}</span>
                </>
              )}
            </div>

            <p className="text-xs text-zinc-300 line-clamp-1 max-w-md">
              {profile.bio}
            </p>

            {/* Quick Compat Reason Tag */}
            <div className="flex items-center gap-2 pt-1">
              <span 
                className="text-[11px] font-bold px-2 py-0.5 rounded-md flex items-center gap-1"
                style={{ backgroundColor: `${compat.color}20`, color: compat.color }}
              >
                <Sparkles className="w-3 h-3" />
                {compat.score}% Sintonia ({compat.reasons[0] || 'Interesses em comum'})
              </span>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2 w-full sm:w-auto justify-end pt-2 sm:pt-0 border-t sm:border-t-0 border-zinc-900">
          <button
            onClick={() => startOrOpenConversation(profile.id)}
            className="p-2.5 rounded-xl bg-purple-950/60 hover:bg-purple-900/60 text-purple-200 border border-purple-800/40 cursor-pointer transition-colors"
            title="Enviar mensagem privada"
          >
            <MessageSquare className="w-4 h-4" />
          </button>

          <button
            onClick={() => toggleFollow(profile.id)}
            className={`px-3 py-2 rounded-xl text-xs font-semibold border transition-all cursor-pointer ${
              isFollowing
                ? 'bg-zinc-800 text-zinc-300 border-zinc-700'
                : 'bg-purple-600 hover:bg-purple-500 text-white border-purple-500'
            }`}
          >
            {isFollowing ? 'Seguindo' : 'Seguir'}
          </button>

          <button
            onClick={() => setSelectedProfileId(profile.id)}
            className="px-4 py-2 rounded-xl text-xs font-bold bg-gradient-to-r from-purple-600 to-rose-600 hover:from-purple-500 hover:to-rose-500 text-white shadow-md cursor-pointer"
          >
            Ver Perfil
          </button>
        </div>

      </div>
    );
  }

  // Grid Card representation
  return (
    <div className="bg-[#120d20] border border-purple-900/30 rounded-3xl overflow-hidden shadow-xl hover:border-purple-600/50 transition-all flex flex-col group">
      
      {/* Cover / Avatar Banner */}
      <div 
        onClick={() => setSelectedProfileId(profile.id)}
        className="relative aspect-[4/3] overflow-hidden cursor-pointer bg-zinc-950"
      >
        <img
          src={profile.avatarUrl}
          alt={profile.displayName}
          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-[#120d20] via-black/20 to-transparent" />
        {isOnline(profile.id) && (
          <span className="absolute top-12 left-3 px-2 py-0.5 rounded-full bg-black/60 backdrop-blur text-[10px] font-bold text-emerald-300 flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" /> Online
          </span>
        )}

        {/* Top Badges */}
        <div className="absolute top-3 left-3 right-3 flex items-center justify-between">
          <span 
            className="text-[11px] font-extrabold px-2.5 py-1 rounded-full shadow-lg backdrop-blur-md flex items-center gap-1 text-white"
            style={{ backgroundColor: `${compat.color}cc` }}
          >
            <Sparkles className="w-3 h-3" />
            {compat.score}% Sintonia
          </span>

          {profile.isVerified && (
            <span className="px-2 py-0.5 rounded-full bg-purple-950/80 backdrop-blur-md border border-purple-500/40 text-purple-300 text-[10px] font-bold flex items-center gap-1">
              ✓ Verificado +18
            </span>
          )}
        </div>

        {/* Bottom profile type & location */}
        <div className="absolute bottom-2 left-3 right-3 text-left">
          <div className="flex items-center gap-1.5 text-white font-extrabold text-base drop-shadow-md">
            <span>{profile.displayName}</span>
            <span className="text-xs font-normal text-zinc-300">({profile.age})</span>
          </div>
          <div className="flex items-center gap-1 text-[11px] text-zinc-300 drop-shadow">
            <MapPin className="w-3 h-3 text-rose-400" />
            <span>{[profile.city, profile.state].filter(Boolean).join(', ')}</span>
            {profile.approximateDistanceKm !== undefined && (
              <>
                <span>•</span>
                <span className="font-semibold">~{profile.approximateDistanceKm} km</span>
              </>
            )}
            {profile.approximateDistanceKm === undefined && regionLabel && (
              <>
                <span>•</span>
                <span className="font-semibold">{regionLabel}</span>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Body Info */}
      <div className="p-4 flex-1 flex flex-col justify-between space-y-3">
        <p className="text-xs text-zinc-300 line-clamp-2 leading-relaxed">
          {profile.bio}
        </p>

        {/* Compatibility reasoning pill */}
        <div className="p-2 rounded-xl bg-purple-950/30 border border-purple-900/30 text-[11px] text-purple-300 flex items-center gap-1.5">
          <Sparkles className="w-3.5 h-3.5 text-fuchsia-400 shrink-0" />
          <span className="truncate">{compat.reasons[0] || 'Compatibilidade de objetivos e limites'}</span>
        </div>

        {/* Interests tags */}
        <div className="flex flex-wrap gap-1">
          {profile.interests.slice(0, 3).map(tag => (
            <span key={tag} className="text-[10px] px-2 py-0.5 rounded-md bg-zinc-900 text-zinc-400">
              {tag}
            </span>
          ))}
          {profile.albums.some(a => a.visibility === 'private_vault') && (
            <span className="text-[10px] px-1.5 py-0.5 rounded-md bg-rose-950/60 text-rose-400 border border-rose-900/40 flex items-center gap-0.5">
              <Lock className="w-2.5 h-2.5" /> Cofre Íntimo
            </span>
          )}
        </div>

        {/* Quick action footer */}
        <div className="pt-2 border-t border-purple-950/40 flex items-center justify-between gap-2">
          <button
            onClick={() => startOrOpenConversation(profile.id)}
            className="flex-1 py-2 px-3 rounded-xl bg-purple-950/50 hover:bg-purple-900/60 border border-purple-800/40 text-purple-200 text-xs font-semibold flex items-center justify-center gap-1.5 cursor-pointer transition-colors"
          >
            <MessageSquare className="w-3.5 h-3.5" />
            <span>Chat</span>
          </button>

          <button
            onClick={() => setSelectedProfileId(profile.id)}
            className="flex-1 py-2 px-3 rounded-xl bg-gradient-to-r from-purple-600 to-rose-600 hover:from-purple-500 hover:to-rose-500 text-white text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer shadow-md transition-all"
          >
            <Eye className="w-3.5 h-3.5" />
            <span>Ver Perfil</span>
          </button>
        </div>

      </div>

    </div>
  );
};
