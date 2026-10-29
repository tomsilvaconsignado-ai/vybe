import React, { useRef, useState } from 'react';
import { useApp } from '../../context/AppContext';
import { X, Save, Camera, Plus, Trash2, Lock, Check, SlidersHorizontal, UserRound } from 'lucide-react';
import { CompatibilityPreferences, JointPartner, LocationPrivacy, PreferenceExtras, ProfileType } from '../../types';
import { uploadPublicMedia } from '../../lib/supabase';
import {
  INTEREST_OPTIONS,
  OBJECTIVE_OPTIONS,
  PROFILE_TYPE_OPTIONS,
  GENDER_OPTIONS,
  ORIENTATION_OPTIONS,
  EXTRA_QUESTIONS
} from '../../lib/profileOptions';
import { notify } from '../common/Feedback';
import { Captcha, CaptchaHandle, captchaEnabled } from '../auth/Captcha';

export type EditProfileTab = 'data' | 'preferences' | 'account';

interface EditProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialTab?: EditProfileTab;
}

const GROUP_TYPES: ProfileType[] = ['couple', 'joint_profile', 'polyamorous'];
const MAX_PARTNERS = 4;

const inputClass = 'w-full px-3.5 py-2 bg-zinc-900 border border-purple-900/30 rounded-xl text-xs text-white focus:outline-none focus:border-purple-500';
const labelClass = 'block text-xs font-semibold text-zinc-300 mb-1';

const chipClass = (active: boolean) =>
  `px-2.5 py-1 rounded-full text-xs transition-colors cursor-pointer ${
    active ? 'bg-fuchsia-600 text-white font-semibold' : 'bg-zinc-900 border border-zinc-800 text-zinc-400 hover:text-zinc-200'
  }`;

const optionClass = (active: boolean) =>
  `py-1.5 px-2 text-xs rounded-xl border text-center transition-all cursor-pointer ${
    active ? 'bg-purple-950 border-purple-500 text-white font-bold' : 'bg-zinc-900/40 border-zinc-800 text-zinc-400'
  }`;

const Section: React.FC<{ title: string; hint?: string; children: React.ReactNode }> = ({ title, hint, children }) => (
  <section className="space-y-3 pt-5 first:pt-0">
    <div>
      <h4 className="text-sm font-bold text-white">{title}</h4>
      {hint && <p className="text-[11px] text-zinc-500">{hint}</p>}
    </div>
    {children}
  </section>
);

const toggle = <T,>(list: T[], value: T) => (list.includes(value) ? list.filter(v => v !== value) : [...list, value]);

export const EditProfileModal: React.FC<EditProfileModalProps> = ({ isOpen, onClose, initialTab = 'data' }) => {
  const { currentUser, updateCurrentUser, savePreferences, savePartners, changeUsername, changeEmail, updatePassword, verifyPassword } = useApp();
  const prefs = currentUser.compatibilityPrefs;

  const [tab, setTab] = useState<EditProfileTab>(initialTab);
  const [saving, setSaving] = useState(false);

  // Perfil público
  const [displayName, setDisplayName] = useState(currentUser.displayName);
  const [statusText, setStatusText] = useState(currentUser.statusText || '');
  const [bio, setBio] = useState(currentUser.bio);
  const [profileType, setProfileType] = useState<ProfileType>(currentUser.profileType);
  const [gender, setGender] = useState(currentUser.gender || '');
  const [orientation, setOrientation] = useState(currentUser.orientation || '');
  const [interests, setInterests] = useState<string[]>(currentUser.interests);
  const [partners, setPartners] = useState<JointPartner[]>(currentUser.partners ?? []);

  // Localização e fotos
  const [city, setCity] = useState(currentUser.city);
  const [state, setState] = useState(currentUser.state);
  const [locationPrivacy, setLocationPrivacy] = useState<LocationPrivacy>(currentUser.locationPrivacy);
  const [avatarUrl, setAvatarUrl] = useState(currentUser.avatarUrl);
  const [coverUrl, setCoverUrl] = useState(currentUser.coverUrl);
  const [uploading, setUploading] = useState<'avatar' | 'cover' | null>(null);

  // Respondido no cadastro (editável aqui, não é perguntado de novo na aba opcional)
  const [objectives, setObjectives] = useState<string[]>(prefs.objectives);
  const [pacePreference, setPacePreference] = useState(prefs.pacePreference);
  const [meetingPreference, setMeetingPreference] = useState(prefs.meetingPreference);
  const [limitsText, setLimitsText] = useState(prefs.personalLimits.join('\n'));

  // Aba opcional
  const [interestedIn, setInterestedIn] = useState(prefs.interestedIn);
  const [ageMin, setAgeMin] = useState(prefs.ageRange[0]);
  const [ageMax, setAgeMax] = useState(prefs.ageRange[1]);
  const [maxDistanceKm, setMaxDistanceKm] = useState(prefs.maxDistanceKm);
  const [discretionLevel, setDiscretionLevel] = useState(prefs.discretionLevel);
  const [groupReadiness, setGroupReadiness] = useState(prefs.groupReadiness);
  const [extras, setExtras] = useState<PreferenceExtras>(prefs.extras ?? {});

  // Conta (cada uma tem seu próprio botão, pois passam por confirmação ou regras do servidor)
  const [newUsername, setNewUsername] = useState(currentUser.username);
  const [newEmail, setNewEmail] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [accountBusy, setAccountBusy] = useState<'username' | 'email' | 'password' | null>(null);

  // Área restrita: os dados de acesso só aparecem depois de confirmar a senha (vale até fechar a janela)
  const [accountUnlocked, setAccountUnlocked] = useState(false);
  const [unlockPassword, setUnlockPassword] = useState('');
  const [unlockError, setUnlockError] = useState('');
  const [unlocking, setUnlocking] = useState(false);
  const [captchaToken, setCaptchaToken] = useState<string | null>(null);
  const captcha = useRef<CaptchaHandle>(null);

  if (!isOpen) return null;

  const isGroup = GROUP_TYPES.includes(profileType);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>, kind: 'avatar' | 'cover') => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) {
      notify('A imagem deve ter no máximo 10 MB.');
      return;
    }
    setUploading(kind);
    const extension = file.name.split('.').pop()?.toLowerCase() || 'jpg';
    // Nome único evita que o navegador mostre a foto antiga do cache
    const { publicUrl, error } = await uploadPublicMedia(file, `${currentUser.id}/profile/${kind}-${Date.now()}.${extension}`);
    setUploading(null);
    if (error || !publicUrl) {
      notify('Não foi possível enviar a imagem. Tente novamente.');
      return;
    }
    if (kind === 'avatar') setAvatarUrl(publicUrl);
    else setCoverUrl(publicUrl);
  };

  const updatePartner = (index: number, change: Partial<JointPartner>) =>
    setPartners(prev => prev.map((p, i) => (i === index ? { ...p, ...change } : p)));

  const addPartner = () =>
    setPartners(prev => [...prev, { id: '', name: '', age: 18, gender: GENDER_OPTIONS[0], consentConfirmed: false }]);

  const answerExtra = (questionId: string, optionId: string, multiple?: boolean) =>
    setExtras(prev => {
      const next = { ...prev };
      const current = prev[questionId];
      if (multiple) {
        const list = toggle(Array.isArray(current) ? current : [], optionId);
        if (list.length > 0) next[questionId] = list;
        else delete next[questionId];
      } else if (current === optionId) {
        delete next[questionId]; // tocar de novo desmarca
      } else {
        next[questionId] = optionId;
      }
      return next;
    });

  const answeredExtras = EXTRA_QUESTIONS.filter(q => {
    const answer = extras[q.id];
    return Array.isArray(answer) ? answer.length > 0 : Boolean(answer);
  }).length;

  const handleSave = async () => {
    if (!displayName.trim()) {
      setTab('data');
      notify('Defina um apelido de exibição.');
      return;
    }
    if (isGroup && partners.some(p => !p.name.trim() || !(p.age >= 18))) {
      setTab('data');
      notify('Preencha o nome de cada pessoa do perfil. Todas precisam ter 18 anos ou mais.');
      return;
    }
    if (isGroup && partners.some(p => !p.id && !p.consentConfirmed)) {
      setTab('data');
      notify('Confirme que cada pessoa adicionada concorda em fazer parte do perfil.');
      return;
    }
    if (ageMin < 18 || ageMax < ageMin) {
      setTab('preferences');
      notify('A faixa de idade deve começar em 18 anos ou mais e o máximo não pode ser menor que o mínimo.');
      return;
    }

    setSaving(true);
    const failures: string[] = [];

    const profileError = await updateCurrentUser({
      displayName: displayName.trim(),
      statusText,
      bio,
      profileType,
      gender: gender || undefined,
      orientation: orientation || undefined,
      interests,
      city,
      state,
      locationPrivacy,
      avatarUrl,
      coverUrl
    });
    if (profileError) failures.push('perfil');

    if (isGroup && JSON.stringify(partners) !== JSON.stringify(currentUser.partners ?? [])) {
      const error = await savePartners(partners);
      if (error) failures.push('pessoas do perfil');
    }

    const nextPrefs: CompatibilityPreferences = {
      ...prefs,
      objectives,
      pacePreference,
      meetingPreference,
      personalLimits: limitsText.split('\n').map(l => l.trim()).filter(Boolean),
      interestedIn,
      ageRange: [ageMin, ageMax],
      maxDistanceKm,
      discretionLevel,
      groupReadiness,
      lifestyleTags: interests,
      extras
    };
    if (JSON.stringify(nextPrefs) !== JSON.stringify(prefs)) {
      const error = await savePreferences(nextPrefs);
      if (error) failures.push('preferências');
    }

    setSaving(false);
    if (failures.length > 0) {
      // Falha no perfil já foi avisada por updateCurrentUser
      if (failures.some(f => f !== 'perfil')) notify(`Não foi possível salvar: ${failures.join(', ')}. Tente novamente.`, 'error');
      return;
    }
    notify('Perfil atualizado.', 'success');
    onClose();
  };

  const handleUsername = async () => {
    setAccountBusy('username');
    const error = await changeUsername(newUsername);
    setAccountBusy(null);
    notify(error ?? 'Nome de usuário atualizado.', error ? 'error' : 'success');
  };

  const handleEmail = async () => {
    if (!/^\S+@\S+\.\S+$/.test(newEmail.trim())) {
      notify('Informe um e-mail válido.');
      return;
    }
    setAccountBusy('email');
    const error = await changeEmail(newEmail);
    setAccountBusy(null);
    if (error) {
      notify(error, 'error');
      return;
    }
    notify('Enviamos um link de confirmação. O e-mail só muda depois que você clicar nele.', 'success');
    setNewEmail('');
  };

  const handlePassword = async () => {
    if (newPassword.length < 8 || !/[a-zA-Z]/.test(newPassword) || !/\d/.test(newPassword)) {
      notify('A senha precisa ter pelo menos 8 caracteres, com letras e números.');
      return;
    }
    if (newPassword !== confirmPassword) {
      notify('As senhas não conferem.');
      return;
    }
    setAccountBusy('password');
    const error = await updatePassword(newPassword);
    setAccountBusy(null);
    if (error) {
      notify(error, 'error');
      return;
    }
    notify('Senha alterada.', 'success');
    setNewPassword('');
    setConfirmPassword('');
  };

  const handleUnlock = async (e: React.FormEvent) => {
    e.preventDefault();
    setUnlockError('');
    if (captchaEnabled && !captchaToken) {
      setUnlockError('Aguarde a verificação de segurança terminar e tente de novo.');
      return;
    }
    const token = captchaToken;
    captcha.current?.reset();
    setUnlocking(true);
    const error = await verifyPassword(unlockPassword, token);
    setUnlocking(false);
    setUnlockPassword('');
    if (error) {
      setUnlockError(error);
      return;
    }
    setAccountUnlocked(true);
  };

  const birthdate = currentUser.birthdate ? currentUser.birthdate.split('-').reverse().join('/') : '—';

  return (
    <div className="modal-overlay fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-4 overflow-y-auto">
      <div className="max-w-lg w-full bg-[#130d22] border border-purple-800/40 rounded-3xl shadow-2xl relative my-auto">
        {/* Cabeçalho fixo com as abas */}
        <div className="sticky top-0 z-10 bg-[#130d22]/95 backdrop-blur rounded-t-3xl px-6 sm:px-8 pt-6 pb-3 border-b border-purple-950/60">
          <button
            onClick={onClose}
            className="absolute top-5 right-5 text-zinc-400 hover:text-white p-1 rounded-full hover:bg-zinc-800 transition-colors cursor-pointer"
            aria-label="Fechar"
          >
            <X className="w-5 h-5" />
          </button>
          <h3 className="text-xl font-bold text-white mb-3">Editar perfil</h3>
          <div className="grid grid-cols-3 gap-1 p-1 bg-zinc-900/70 rounded-2xl">
            {([
              { id: 'data', label: 'Meus dados', icon: UserRound },
              { id: 'preferences', label: 'Preferências', icon: SlidersHorizontal },
              { id: 'account', label: 'Conta', icon: Lock }
            ] as const).map(t => (
              <button
                key={t.id}
                type="button"
                onClick={() => setTab(t.id)}
                className={`py-2 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer transition-colors ${
                  tab === t.id ? 'bg-purple-700 text-white' : 'text-zinc-400 hover:text-white'
                }`}
              >
                <t.icon className="w-3.5 h-3.5" />
                {t.label}
                {t.id === 'preferences' && <span className="hidden sm:inline font-normal opacity-70">(opcional)</span>}
              </button>
            ))}
          </div>
        </div>

        <div className="px-6 sm:px-8 py-5 space-y-2 divide-y divide-purple-950/40 [&>section]:pb-5">
          {tab === 'data' && (
            <>
              <Section title="Fotos">
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <span className="block text-xs font-semibold text-zinc-300">Foto de perfil</span>
                    <img src={avatarUrl} alt="" className="w-16 h-16 rounded-full object-cover border border-purple-500/40" />
                    <label className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-purple-900/40 border border-purple-700/40 text-[11px] font-semibold text-purple-200 cursor-pointer ${uploading ? 'opacity-50 pointer-events-none' : ''}`}>
                      <Camera className="w-3.5 h-3.5" />
                      {uploading === 'avatar' ? 'Enviando...' : 'Trocar foto'}
                      <input type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={e => handleUpload(e, 'avatar')} />
                    </label>
                  </div>
                  <div className="space-y-2">
                    <span className="block text-xs font-semibold text-zinc-300">Foto de capa</span>
                    <img src={coverUrl} alt="" className="w-full h-16 rounded-xl object-cover border border-purple-500/40" />
                    <label className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-purple-900/40 border border-purple-700/40 text-[11px] font-semibold text-purple-200 cursor-pointer ${uploading ? 'opacity-50 pointer-events-none' : ''}`}>
                      <Camera className="w-3.5 h-3.5" />
                      {uploading === 'cover' ? 'Enviando...' : 'Trocar capa'}
                      <input type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={e => handleUpload(e, 'cover')} />
                    </label>
                  </div>
                </div>
              </Section>

              <Section title="Perfil público">
                <div>
                  <label className={labelClass}>Apelido de exibição</label>
                  <input type="text" maxLength={100} value={displayName} onChange={e => setDisplayName(e.target.value)} className={inputClass} />
                </div>
                <div>
                  <label className={labelClass}>Status rápido / frase do dia</label>
                  <input
                    type="text"
                    maxLength={160}
                    value={statusText}
                    onChange={e => setStatusText(e.target.value)}
                    placeholder="Ex: Planejando jantar no final de semana..."
                    className={inputClass}
                  />
                </div>
                <div>
                  <label className={labelClass}>Biografia</label>
                  <textarea rows={3} value={bio} onChange={e => setBio(e.target.value)} className={inputClass} />
                </div>
                <div>
                  <label className={labelClass}>Tipo de perfil</label>
                  <select value={profileType} onChange={e => setProfileType(e.target.value as ProfileType)} className={inputClass}>
                    {PROFILE_TYPE_OPTIONS.map(opt => <option key={opt.id} value={opt.id}>{opt.label}</option>)}
                  </select>
                </div>
                {!isGroup && (
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className={labelClass}>Gênero</label>
                      <select value={gender} onChange={e => setGender(e.target.value)} className={inputClass}>
                        <option value="">Prefiro não dizer</option>
                        {GENDER_OPTIONS.map(g => <option key={g} value={g}>{g}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className={labelClass}>Orientação</label>
                      <select value={orientation} onChange={e => setOrientation(e.target.value)} className={inputClass}>
                        <option value="">Prefiro não dizer</option>
                        {ORIENTATION_OPTIONS.map(o => <option key={o} value={o}>{o}</option>)}
                      </select>
                    </div>
                  </div>
                )}
                <div>
                  <label className={labelClass}>Interesses e afinidades</label>
                  <div className="flex flex-wrap gap-1.5">
                    {INTEREST_OPTIONS.map(tag => (
                      <button key={tag} type="button" onClick={() => setInterests(prev => toggle(prev, tag))} className={chipClass(interests.includes(tag))}>
                        {tag}
                      </button>
                    ))}
                  </div>
                </div>
              </Section>

              {isGroup && (
                <Section title="Pessoas do perfil" hint="Todas precisam ter 18 anos ou mais e concordar em participar.">
                  {partners.map((partner, i) => (
                    <div key={partner.id || `new-${i}`} className="p-3 bg-zinc-900/60 border border-purple-900/30 rounded-2xl space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] font-bold text-purple-300">Pessoa {i + 1}</span>
                        <button
                          type="button"
                          onClick={() => setPartners(prev => prev.filter((_, idx) => idx !== i))}
                          className="p-1 text-zinc-500 hover:text-rose-400 cursor-pointer"
                          aria-label={`Remover pessoa ${i + 1}`}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                      <div className="grid grid-cols-[1fr_5rem] gap-2">
                        <input type="text" maxLength={100} placeholder="Nome ou apelido" value={partner.name} onChange={e => updatePartner(i, { name: e.target.value })} className={inputClass} />
                        <input type="number" min={18} max={99} aria-label="Idade" value={partner.age} onChange={e => updatePartner(i, { age: Number(e.target.value) })} className={inputClass} />
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <select value={partner.gender} onChange={e => updatePartner(i, { gender: e.target.value })} className={inputClass} aria-label="Gênero">
                          {GENDER_OPTIONS.map(g => <option key={g} value={g}>{g}</option>)}
                        </select>
                        <select value={partner.orientation || ''} onChange={e => updatePartner(i, { orientation: e.target.value || undefined })} className={inputClass} aria-label="Orientação">
                          <option value="">Orientação (opcional)</option>
                          {ORIENTATION_OPTIONS.map(o => <option key={o} value={o}>{o}</option>)}
                        </select>
                      </div>
                      {!partner.id && (
                        <label className="flex items-start gap-2 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={partner.consentConfirmed}
                            onChange={e => updatePartner(i, { consentConfirmed: e.target.checked })}
                            className="mt-0.5 accent-purple-600"
                          />
                          <span className="text-[11px] text-zinc-300">Esta pessoa tem 18 anos ou mais e concorda em fazer parte do perfil.</span>
                        </label>
                      )}
                    </div>
                  ))}
                  {partners.length < MAX_PARTNERS && (
                    <button
                      type="button"
                      onClick={addPartner}
                      className="w-full py-2 rounded-xl border border-dashed border-purple-700/50 text-xs font-semibold text-purple-200 hover:bg-purple-950/40 flex items-center justify-center gap-1.5 cursor-pointer"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      Adicionar pessoa
                    </button>
                  )}
                </Section>
              )}

              <Section title="Localização">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className={labelClass}>Cidade</label>
                    <input type="text" maxLength={100} value={city} onChange={e => setCity(e.target.value)} className={inputClass} />
                  </div>
                  <div>
                    <label className={labelClass}>Estado</label>
                    <input type="text" maxLength={50} value={state} onChange={e => setState(e.target.value)} className={inputClass} />
                  </div>
                </div>
                <div>
                  <label className={labelClass}>Quem vê sua localização</label>
                  <div className="grid grid-cols-3 gap-2">
                    {[
                      { id: 'city', label: 'Cidade' },
                      { id: 'approximate_region', label: 'Só o estado' },
                      { id: 'hidden', label: 'Ocultar' }
                    ].map(opt => (
                      <button key={opt.id} type="button" onClick={() => setLocationPrivacy(opt.id as LocationPrivacy)} className={optionClass(locationPrivacy === opt.id)}>
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>
              </Section>

              <Section title="Objetivos e limites" hint="O que você respondeu no cadastro.">
                <div className="space-y-1.5">
                  {OBJECTIVE_OPTIONS.map(obj => (
                    <button
                      key={obj.id}
                      type="button"
                      onClick={() => setObjectives(prev => toggle(prev, obj.id))}
                      className={`w-full text-left p-2.5 rounded-xl border text-xs transition-all flex items-center justify-between cursor-pointer ${
                        objectives.includes(obj.id) ? 'bg-purple-950/70 border-purple-500 text-white font-semibold' : 'bg-zinc-900/40 border-zinc-800 text-zinc-400'
                      }`}
                    >
                      <span>{obj.label}</span>
                      {objectives.includes(obj.id) && <Check className="w-3.5 h-3.5 text-purple-400" />}
                    </button>
                  ))}
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className={labelClass}>Ritmo de conexão</label>
                    <select value={pacePreference} onChange={e => setPacePreference(e.target.value as CompatibilityPreferences['pacePreference'])} className={inputClass}>
                      <option value="slow_chat">Conversa lenta e calma</option>
                      <option value="flexible">Flexível / depende da química</option>
                      <option value="spontaneous">Espontâneo / direto</option>
                    </select>
                  </div>
                  <div>
                    <label className={labelClass}>Primeiro encontro</label>
                    <select value={meetingPreference} onChange={e => setMeetingPreference(e.target.value as CompatibilityPreferences['meetingPreference'])} className={inputClass}>
                      <option value="virtual_first">Virtual primeiro</option>
                      <option value="in_person">Presencial</option>
                      <option value="undecided">A combinar</option>
                    </select>
                  </div>
                </div>
                <div>
                  <label className={labelClass}>Limites inegociáveis (um por linha)</label>
                  <textarea rows={3} value={limitsText} onChange={e => setLimitsText(e.target.value)} className={inputClass} />
                  <p className="text-[11px] text-zinc-500 mt-1">Só suas conexões aceitas veem seus limites.</p>
                </div>
              </Section>

            </>
          )}
          {tab === 'preferences' && (
            <>
              <div className="pb-4">
                <p className="text-xs text-zinc-400">
                  Tudo aqui é opcional e melhora as sugestões de compatibilidade. São só perguntas que o cadastro não fez;
                  o que você já respondeu fica em <button type="button" onClick={() => setTab('data')} className="text-purple-400 underline cursor-pointer">Meus dados</button>.
                </p>
                <div className="mt-3 h-1.5 rounded-full bg-zinc-800 overflow-hidden">
                  <div className="h-full bg-gradient-to-r from-purple-500 to-rose-500 transition-all" style={{ width: `${(answeredExtras / EXTRA_QUESTIONS.length) * 100}%` }} />
                </div>
                <p className="text-[11px] text-zinc-500 mt-1">{answeredExtras} de {EXTRA_QUESTIONS.length} perguntas sobre você respondidas</p>
              </div>

              <Section title="Quem você quer conhecer">
                <div className="flex flex-wrap gap-1.5">
                  {([
                    { id: 'couples', label: 'Casais' },
                    { id: 'singles_female', label: 'Mulheres solteiras' },
                    { id: 'singles_male', label: 'Homens solteiros' },
                    { id: 'all', label: 'Todos' }
                  ] as const).map(opt => (
                    <button key={opt.id} type="button" onClick={() => setInterestedIn(prev => toggle(prev, opt.id))} className={chipClass(interestedIn.includes(opt.id))}>
                      {opt.label}
                    </button>
                  ))}
                </div>
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className={labelClass}>Idade mín.</label>
                    <input type="number" min={18} max={99} value={ageMin} onChange={e => setAgeMin(Number(e.target.value))} className={inputClass} />
                  </div>
                  <div>
                    <label className={labelClass}>Idade máx.</label>
                    <input type="number" min={18} max={99} value={ageMax} onChange={e => setAgeMax(Number(e.target.value))} className={inputClass} />
                  </div>
                  <div>
                    <label className={labelClass}>Distância</label>
                    <select value={maxDistanceKm} onChange={e => setMaxDistanceKm(Number(e.target.value))} className={inputClass}>
                      {[10, 25, 50, 100, 300, 1000].map(km => <option key={km} value={km}>{km === 1000 ? 'Qualquer' : `${km} km`}</option>)}
                    </select>
                  </div>
                </div>
              </Section>

              <Section title="Discrição e grupo">
                <div>
                  <label className={labelClass}>Nível de discrição que você espera</label>
                  <div className="grid grid-cols-3 gap-2">
                    {([
                      { id: 'high', label: 'Alta' },
                      { id: 'medium', label: 'Média' },
                      { id: 'relaxed', label: 'Tranquila' }
                    ] as const).map(opt => (
                      <button key={opt.id} type="button" onClick={() => setDiscretionLevel(opt.id)} className={optionClass(discretionLevel === opt.id)}>
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <label className={labelClass}>Encontros com mais pessoas</label>
                  <div className="grid grid-cols-3 gap-2">
                    {([
                      { id: 'open', label: 'Topo' },
                      { id: 'curious', label: 'Tenho curiosidade' },
                      { id: 'only_duo', label: 'Só a dois' }
                    ] as const).map(opt => (
                      <button key={opt.id} type="button" onClick={() => setGroupReadiness(opt.id)} className={optionClass(groupReadiness === opt.id)}>
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>
              </Section>

              <Section title="Sobre você" hint="Toque de novo numa resposta para desmarcar.">
                {EXTRA_QUESTIONS.map(q => {
                  const answer = extras[q.id];
                  const isChosen = (id: string) => (Array.isArray(answer) ? answer.includes(id) : answer === id);
                  return (
                    <div key={q.id}>
                      <label className={labelClass}>
                        {q.question}
                        {q.multiple && <span className="font-normal text-zinc-500"> (pode marcar várias)</span>}
                      </label>
                      <div className="flex flex-wrap gap-1.5">
                        {q.options.map(opt => (
                          <button key={opt.id} type="button" onClick={() => answerExtra(q.id, opt.id, q.multiple)} className={chipClass(isChosen(opt.id))}>
                            {opt.label}
                          </button>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </Section>
            </>
          )}
          {tab === 'account' && (accountUnlocked ? (
            <section className="space-y-3">
              <p className="text-[11px] text-zinc-500">Estes dados não aparecem para outros membros.</p>
                <div>
                  <label className={labelClass}>Nome de usuário</label>
                  <div className="flex gap-2">
                    <div className="relative flex-1">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-zinc-500">@</span>
                      <input
                        type="text"
                        maxLength={30}
                        value={newUsername}
                        onChange={e => setNewUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ''))}
                        className={`${inputClass} pl-7`}
                      />
                    </div>
                    <button
                      type="button"
                      onClick={handleUsername}
                      disabled={newUsername === currentUser.username || newUsername.length < 3 || accountBusy !== null}
                      className="px-3 rounded-xl text-xs font-bold bg-zinc-800 text-white disabled:opacity-40 cursor-pointer"
                    >
                      {accountBusy === 'username' ? '...' : 'Trocar'}
                    </button>
                  </div>
                  <p className="text-[11px] text-zinc-500 mt-1">Pode ser trocado uma vez a cada 7 dias.</p>
                </div>

                <div>
                  <label className={labelClass}>E-mail de acesso</label>
                  <p className="text-xs text-zinc-200 mb-1.5 break-all">{currentUser.email || '—'}</p>
                  <div className="flex gap-2">
                    <input
                      type="email"
                      autoComplete="email"
                      placeholder="Novo e-mail"
                      value={newEmail}
                      onChange={e => setNewEmail(e.target.value)}
                      className={`${inputClass} flex-1`}
                    />
                    <button
                      type="button"
                      onClick={handleEmail}
                      disabled={!newEmail.trim() || accountBusy !== null}
                      className="px-3 rounded-xl text-xs font-bold bg-zinc-800 text-white disabled:opacity-40 cursor-pointer"
                    >
                      {accountBusy === 'email' ? '...' : 'Trocar'}
                    </button>
                  </div>
                  <p className="text-[11px] text-zinc-500 mt-1">Enviamos um link de confirmação; o e-mail só muda depois do clique.</p>
                </div>

                <div>
                  <label className={labelClass}>Nova senha</label>
                  <div className="grid grid-cols-2 gap-2">
                    <input type="password" autoComplete="new-password" placeholder="Nova senha" value={newPassword} onChange={e => setNewPassword(e.target.value)} className={inputClass} />
                    <input type="password" autoComplete="new-password" placeholder="Repita a senha" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} className={inputClass} />
                  </div>
                  <button
                    type="button"
                    onClick={handlePassword}
                    disabled={!newPassword || accountBusy !== null}
                    className="mt-2 px-3 py-1.5 rounded-xl text-xs font-bold bg-zinc-800 text-white disabled:opacity-40 cursor-pointer"
                  >
                    {accountBusy === 'password' ? 'Alterando...' : 'Alterar senha'}
                  </button>
                </div>

                <div className="flex items-start gap-2 p-3 rounded-xl bg-zinc-900/60 border border-zinc-800">
                  <Lock className="w-3.5 h-3.5 text-zinc-500 mt-0.5 shrink-0" />
                  <p className="text-[11px] text-zinc-400">
                    Data de nascimento: <strong className="text-zinc-200">{birthdate}</strong>. Ela não pode ser alterada, pois garante que
                    todos no Vybelog são maiores de 18 anos. Se estiver errada, fale com a equipe.
                  </p>
                </div>
            </section>
          ) : (
            <form onSubmit={handleUnlock} className="space-y-4 py-4">
              <div className="flex flex-col items-center text-center gap-2">
                <div className="w-12 h-12 rounded-2xl bg-purple-950/70 border border-purple-700/40 flex items-center justify-center">
                  <Lock className="w-5 h-5 text-purple-300" />
                </div>
                <h4 className="text-sm font-bold text-white">Área restrita</h4>
                <p className="text-xs text-zinc-400 max-w-xs">
                  Usuário, e-mail, senha e data de nascimento ficam protegidos. Confirme sua senha para ver e alterar.
                </p>
              </div>
              <input
                type="password"
                autoComplete="current-password"
                placeholder="Sua senha atual"
                value={unlockPassword}
                onChange={e => setUnlockPassword(e.target.value)}
                className={inputClass}
                required
              />
              <Captcha ref={captcha} onToken={setCaptchaToken} />
              {unlockError && <p className="text-xs text-rose-400">{unlockError}</p>}
              <button
                type="submit"
                disabled={!unlockPassword || unlocking}
                className="w-full py-2.5 rounded-xl font-bold text-xs text-white bg-gradient-to-r from-purple-600 to-rose-600 disabled:opacity-50 cursor-pointer"
              >
                {unlocking ? 'Verificando...' : 'Desbloquear'}
              </button>
            </form>
          ))}
        </div>

        {/* Rodapé fixo: salva "Meus dados" e "Preferências" de uma vez (a aba Conta tem botões próprios) */}
        <div className={`${tab === 'account' ? 'hidden' : 'flex'} sticky bottom-0 bg-[#130d22]/95 backdrop-blur rounded-b-3xl px-6 sm:px-8 py-4 border-t border-purple-950/60 items-center justify-end gap-3`}>
          <button type="button" onClick={onClose} className="px-4 py-2 text-xs font-semibold text-zinc-400 hover:text-white cursor-pointer">
            Cancelar
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={saving || uploading !== null}
            className="px-6 py-2.5 rounded-xl font-bold text-xs text-white bg-gradient-to-r from-purple-600 to-rose-600 hover:from-purple-500 hover:to-rose-500 shadow-md shadow-purple-950/50 flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
          >
            <Save className="w-3.5 h-3.5" />
            {saving ? 'Salvando...' : 'Salvar alterações'}
          </button>
        </div>
      </div>
    </div>
  );
};
