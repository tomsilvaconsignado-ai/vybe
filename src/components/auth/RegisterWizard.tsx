import React, { useRef, useState } from 'react';
import { useApp } from '../../context/AppContext';
import { 
  X, 
  Check, 
  ArrowRight, 
  ArrowLeft, 
  User, 
  Users, 
  ShieldCheck, 
  Lock, 
  Sparkles, 
  Camera, 
  MapPin, 
  Heart,
  AlertCircle,
  Eye,
  Key
} from 'lucide-react';
import { ProfileType, LocationPrivacy } from '../../types';
import { defaultAvatar } from '../../lib/profiles';
import { INTEREST_OPTIONS, OBJECTIVE_OPTIONS } from '../../lib/profileOptions';
import { notify } from '../common/Feedback';
import { Captcha, CaptchaHandle, captchaEnabled } from './Captcha';

export const RegisterWizard: React.FC = () => {
  const { setAuthModalType, register, setPrivacyTermsModalOpen, registerProfileType } = useApp();
  const [step, setStep] = useState(1);
  const [submitError, setSubmitError] = useState('');
  const [captchaToken, setCaptchaToken] = useState<string | null>(null);
  const captcha = useRef<CaptchaHandle>(null);
  const [confirmationSentTo, setConfirmationSentTo] = useState<string | null>(null);

  // Form State
  // Step 1: Account
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [birthdate, setBirthdate] = useState('');
  const [confirmedAdult, setConfirmedAdult] = useState(false);
  const [acceptedTerms, setAcceptedTerms] = useState(false);

  // Step 2: Profile Type
  const [profileType, setProfileType] = useState<ProfileType>(registerProfileType ?? 'couple');
  const [partner1Name, setPartner1Name] = useState('');
  const [partner1Age, setPartner1Age] = useState(30);
  const [partner1Gender, setPartner1Gender] = useState('Masculino');
  const [partner2Name, setPartner2Name] = useState('');
  const [partner2Age, setPartner2Age] = useState(28);
  const [partner2Gender, setPartner2Gender] = useState('Feminino');
  const [mutualConsentChecked, setMutualConsentChecked] = useState(true);

  // Step 3: Personal Info
  const [displayName, setDisplayName] = useState('');
  const [city, setCity] = useState('São Paulo');
  const [state, setState] = useState('SP');
  const [locationPrivacy, setLocationPrivacy] = useState<LocationPrivacy>('approximate_region');
  const [bio, setBio] = useState('');
  const [selectedInterests, setSelectedInterests] = useState<string[]>(['Gastronomia', 'Vinho']);

  // Step 4: Compatibility & Limits
  const [selectedObjectives, setSelectedObjectives] = useState<string[]>(['conhecer_casais', 'amizades']);
  const [interestedIn, setInterestedIn] = useState<('couples' | 'singles_female' | 'singles_male' | 'all')[]>(['couples']);
  const [meetingPreference, setMeetingPreference] = useState<'in_person' | 'virtual_first' | 'undecided'>('virtual_first');
  const [pacePreference, setPacePreference] = useState<'slow_chat' | 'spontaneous' | 'flexible'>('slow_chat');
  const [discretionLevel, setDiscretionLevel] = useState<'high' | 'medium' | 'relaxed'>('high');
  const [limitsText, setLimitsText] = useState('Respeito mútuo absoluto e conversa prévia.');

  // Step 5: Photos & Presentation
  // Fotos são enviadas depois do primeiro login (o envio ao Storage exige conta confirmada).
  // Links externos não são aceitos: o servidor de terceiros veria o IP de quem abre o perfil.

  // Step 6: Verification
  const [isVerifying, setIsVerifying] = useState(false);
  const [wantsSelfieVerification, setWantsSelfieVerification] = useState(true);

  const interestOptions = INTEREST_OPTIONS;
  const objectiveOptions = OBJECTIVE_OPTIONS;

  const toggleInterest = (tag: string) => {
    setSelectedInterests(prev => 
      prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag]
    );
  };

  const toggleObjective = (id: string) => {
    setSelectedObjectives(prev => 
      prev.includes(id) ? prev.filter(o => o !== id) : [...prev, id]
    );
  };

  const calculateAge = (dateStr: string): number => {
    if (!dateStr) return 0;
    const diff = Date.now() - new Date(dateStr).getTime();
    return Math.floor(diff / (1000 * 60 * 60 * 24 * 365.25));
  };

  const handleNext = () => {
    if (step === 1) {
      if (!username.trim() || !email.trim() || !password || !birthdate) {
        notify('Por favor, preencha todos os campos obrigatórios da conta.');
        return;
      }
      if (password.length < 8) {
        notify('A senha deve ter pelo menos 8 caracteres.');
        return;
      }
      if (calculateAge(birthdate) < 18) {
        notify('O acesso ao Vybelog é estritamente restrito a maiores de 18 anos civis.');
        return;
      }
      if (!confirmedAdult || !acceptedTerms) {
        notify('É obrigatório confirmar a maioridade e aceitar os termos de uso e consentimento.');
        return;
      }
    }

    if (step === 2 && profileType === 'couple' && !mutualConsentChecked) {
      notify('Para perfis conjuntos ou de casais, a concordância mútua de ambos os parceiros é mandatória.');
      return;
    }

    if (step === 3 && !displayName.trim()) {
      notify('Por favor, defina um apelido público para o perfil.');
      return;
    }

    setStep(prev => Math.min(prev + 1, 6));
  };

  const handleFinishRegistration = async () => {
    if (captchaEnabled && !captchaToken) {
      setSubmitError('Aguarde a verificação de segurança terminar e tente de novo.');
      return;
    }
    const token = captchaToken;
    captcha.current?.reset();
    setIsVerifying(true);
    setSubmitError('');

    const isCouple = profileType === 'couple';
    const { error, needsEmailConfirmation } = await register(email, password, {
      username: username.toLowerCase().replace(/[^a-z0-9_]/g, ''),
      display_name: displayName || (isCouple ? `${partner1Name} & ${partner2Name}` : username),
      birthdate,
      profile_type: profileType,
      age: isCouple ? Math.round((partner1Age + partner2Age) / 2) : calculateAge(birthdate),
      city,
      state,
      location_privacy: locationPrivacy,
      bio: bio || 'Explorando novas conexões com respeito, discrição e cumplicidade.',
      interests: selectedInterests,
      verification_requested: wantsSelfieVerification,
      partners: isCouple ? [
        { name: partner1Name || 'Parceiro 1', age: partner1Age, gender: partner1Gender, consentConfirmed: true },
        { name: partner2Name || 'Parceiro 2', age: partner2Age, gender: partner2Gender, consentConfirmed: true }
      ] : undefined,
      prefs: {
        objectives: selectedObjectives,
        interestedIn,
        ageRange: [24, 45],
        maxDistanceKm: 50,
        meetingPreference,
        pacePreference,
        discretionLevel,
        groupReadiness: 'curious',
        personalLimits: [limitsText, 'Uso de preservativo', 'Sem fotos não consentidas'],
        lifestyleTags: selectedInterests.slice(0, 4)
      }
    }, token);

    setIsVerifying(false);
    if (error) {
      setSubmitError(error);
      return;
    }
    if (needsEmailConfirmation) setConfirmationSentTo(email);
  };

  if (confirmationSentTo) {
    return (
      <div className="modal-overlay fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
        <div className="max-w-md w-full bg-[#110c1c] border border-purple-800/40 rounded-3xl p-8 shadow-2xl text-center space-y-4 my-auto">
          <div className="w-14 h-14 mx-auto rounded-2xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center">
            <ShieldCheck className="w-7 h-7 text-emerald-400" />
          </div>
          <h3 className="text-xl font-bold text-white">Confirme seu e-mail</h3>
          <p className="text-xs text-zinc-400">
            Enviamos um link de confirmação para <strong className="text-purple-300">{confirmationSentTo}</strong>.
            Clique nele para ativar sua conta e depois entre com seu e-mail e senha.
          </p>
          <button
            type="button"
            onClick={() => setAuthModalType('login')}
            className="w-full py-3 rounded-xl font-bold text-xs text-white bg-gradient-to-r from-purple-600 to-rose-600 hover:opacity-90 cursor-pointer"
          >
            Ir para o login
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="modal-overlay fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
      <div className="max-w-xl w-full bg-[#110c1c] border border-purple-800/40 rounded-3xl p-6 sm:p-8 shadow-2xl relative my-auto">
        
        {/* Close Button */}
        <button
          onClick={() => setAuthModalType(null)}
          className="absolute top-5 right-5 text-zinc-400 hover:text-white p-1 rounded-full hover:bg-zinc-800 transition-colors cursor-pointer"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Progress Bar & Steps Indicator */}
        <div className="mb-6">
          <div className="flex items-center justify-between gap-3 text-xs font-bold text-zinc-400 mb-2 pr-8">
            <span className="text-purple-400">Etapa {step} de 6</span>
            <span className="text-zinc-300">
              {step === 1 && 'Conta & Maioridade'}
              {step === 2 && 'Tipo de Relacionamento'}
              {step === 3 && 'Informações Pessoais'}
              {step === 4 && 'Interesses & Limites'}
              {step === 5 && 'Fotos & Cofres'}
              {step === 6 && 'Verificação Segura'}
            </span>
          </div>
          <div className="w-full h-1.5 bg-zinc-800 rounded-full overflow-hidden">
            <div 
              className="h-full bg-gradient-to-r from-purple-500 via-fuchsia-500 to-rose-500 transition-all duration-300"
              style={{ width: `${(step / 6) * 100}%` }}
            />
          </div>
        </div>

        {/* STEP 1: ACCOUNT & +18 VERIFICATION */}
        {step === 1 && (
          <div className="space-y-4">
            <div>
              <h3 className="text-xl font-bold text-white mb-1">Crie sua Conta Vybelog</h3>
              <p className="text-xs text-zinc-400">
                Seus dados de login são protegidos e nunca divulgados publicamente.
              </p>
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-zinc-300 mb-1">Nome de Usuário (@ exclusivo)</label>
                <input
                  type="text"
                  placeholder="ex: casal_vintage ou julia_lib"
                  value={username}
                  onChange={e => setUsername(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-zinc-900/80 border border-purple-900/30 rounded-xl text-sm text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-purple-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-zinc-300 mb-1">E-mail para Confirmação</label>
                <input
                  type="email"
                  placeholder="seuemail@exemplo.com"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-zinc-900/80 border border-purple-900/30 rounded-xl text-sm text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-purple-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-zinc-300 mb-1">Senha Segura</label>
                <input
                  type="password"
                  placeholder="Mínimo de 8 caracteres com letras e números"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-zinc-900/80 border border-purple-900/30 rounded-xl text-sm text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-purple-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-zinc-300 mb-1">Data de Nascimento (+18 anos)</label>
                <input
                  type="date"
                  value={birthdate}
                  onChange={e => setBirthdate(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-zinc-900/80 border border-purple-900/30 rounded-xl text-sm text-zinc-100 focus:outline-none focus:border-purple-500"
                />
              </div>

              {/* Consent Checkboxes */}
              <div className="pt-2 space-y-2">
                <label className="flex items-start gap-2.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={confirmedAdult}
                    onChange={e => setConfirmedAdult(e.target.checked)}
                    className="mt-0.5 accent-purple-600 rounded cursor-pointer"
                  />
                  <span className="text-xs text-zinc-300 leading-tight">
                    Declaro solenemente sob as penas da lei que tenho <strong>18 anos de idade completos ou mais</strong>.
                  </span>
                </label>

                <label className="flex items-start gap-2.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={acceptedTerms}
                    onChange={e => setAcceptedTerms(e.target.checked)}
                    className="mt-0.5 accent-purple-600 rounded cursor-pointer"
                  />
                  <span className="text-xs text-zinc-300 leading-tight">
                    Li e concordo com os{' '}
                    <button
                      type="button"
                      onClick={() => setPrivacyTermsModalOpen(true)}
                      className="text-purple-400 underline hover:text-purple-300"
                    >
                      Termos de Uso
                    </button>{' '}
                    e a{' '}
                    <button
                      type="button"
                      onClick={() => setPrivacyTermsModalOpen(true)}
                      className="text-purple-400 underline hover:text-purple-300"
                    >
                      Política de Privacidade (LGPD)
                    </button>
                    , baseada no consentimento mútuo.
                  </span>
                </label>
              </div>
            </div>
          </div>
        )}

        {/* STEP 2: PROFILE TYPE */}
        {step === 2 && (
          <div className="space-y-4">
            <div>
              <h3 className="text-xl font-bold text-white mb-1">Como você deseja se apresentar?</h3>
              <p className="text-xs text-zinc-400">
                O Vybelog acolhe diversas composições de relacionamentos adultos consensuais.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3">
              {[
                { type: 'couple', title: 'Casal', desc: 'Duas pessoas apresentando perfil conjunto' },
                { type: 'single_female', title: 'Mulher Solteira', desc: 'Independente buscando conexões liberais' },
                { type: 'single_male', title: 'Homem Solteiro', desc: 'Respeitoso com casais e solteiras' },
                { type: 'polyamorous', title: 'Poliamor / Tríade', desc: 'Múltiplas pessoas consensuais' }
              ].map(opt => (
                <button
                  key={opt.type}
                  type="button"
                  onClick={() => setProfileType(opt.type as ProfileType)}
                  className={`p-3.5 rounded-2xl border text-left transition-all cursor-pointer ${
                    profileType === opt.type
                      ? 'bg-purple-950/70 border-purple-500 text-white shadow-lg shadow-purple-950/40'
                      : 'bg-zinc-900/40 border-zinc-800 text-zinc-400 hover:border-zinc-700'
                  }`}
                >
                  <div className="font-bold text-sm text-zinc-100 mb-1">{opt.title}</div>
                  <div className="text-[11px] text-zinc-400 leading-tight">{opt.desc}</div>
                </button>
              ))}
            </div>

            {/* If Couple: Partner info & joint authorization */}
            {profileType === 'couple' && (
              <div className="p-4 bg-zinc-900/60 border border-purple-900/30 rounded-2xl space-y-3">
                <span className="text-xs font-bold text-purple-300 flex items-center gap-1.5">
                  <Users className="w-4 h-4 text-purple-400" />
                  Identificação dos Parceiros do Casal
                </span>
                
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-[11px] text-zinc-400">Nome / Apelido Parceiro 1</label>
                    <input
                      type="text"
                      placeholder="Ex: Carlos"
                      value={partner1Name}
                      onChange={e => setPartner1Name(e.target.value)}
                      className="w-full px-3 py-1.5 bg-zinc-950 border border-zinc-800 rounded-lg text-xs text-white"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] text-zinc-400">Idade Parceiro 1</label>
                    <input
                      type="number"
                      value={partner1Age}
                      onChange={e => setPartner1Age(Number(e.target.value))}
                      className="w-full px-3 py-1.5 bg-zinc-950 border border-zinc-800 rounded-lg text-xs text-white"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-[11px] text-zinc-400">Nome / Apelido Parceiro 2</label>
                    <input
                      type="text"
                      placeholder="Ex: Marina"
                      value={partner2Name}
                      onChange={e => setPartner2Name(e.target.value)}
                      className="w-full px-3 py-1.5 bg-zinc-950 border border-zinc-800 rounded-lg text-xs text-white"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] text-zinc-400">Idade Parceiro 2</label>
                    <input
                      type="number"
                      value={partner2Age}
                      onChange={e => setPartner2Age(Number(e.target.value))}
                      className="w-full px-3 py-1.5 bg-zinc-950 border border-zinc-800 rounded-lg text-xs text-white"
                    />
                  </div>
                </div>

                <label className="flex items-start gap-2 pt-1 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={mutualConsentChecked}
                    onChange={e => setMutualConsentChecked(e.target.checked)}
                    className="mt-0.5 accent-purple-600 rounded cursor-pointer"
                  />
                  <span className="text-[11px] text-zinc-300">
                    Ambos os parceiros têm ciência e autorizam expressamente a criação deste perfil conjunto.
                  </span>
                </label>
              </div>
            )}
          </div>
        )}

        {/* STEP 3: PERSONAL INFO & PRIVACY */}
        {step === 3 && (
          <div className="space-y-4">
            <div>
              <h3 className="text-xl font-bold text-white mb-1">Informações do Perfil Público</h3>
              <p className="text-xs text-zinc-400">
                Você escolhe como sua localização e identidade aparecem no feed.
              </p>
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-zinc-300 mb-1">Apelido Público de Exibição</label>
                <input
                  type="text"
                  placeholder="Ex: Rafa & Carol 🍷 ou Valentina ✨"
                  value={displayName}
                  onChange={e => setDisplayName(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-zinc-900/80 border border-purple-900/30 rounded-xl text-sm text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-purple-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-zinc-300 mb-1">Cidade</label>
                  <input
                    type="text"
                    value={city}
                    onChange={e => setCity(e.target.value)}
                    className="w-full px-3.5 py-2 bg-zinc-900/80 border border-purple-900/30 rounded-xl text-sm text-zinc-100 focus:outline-none focus:border-purple-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-zinc-300 mb-1">Estado</label>
                  <input
                    type="text"
                    value={state}
                    onChange={e => setState(e.target.value)}
                    className="w-full px-3.5 py-2 bg-zinc-900/80 border border-purple-900/30 rounded-xl text-sm text-zinc-100 focus:outline-none focus:border-purple-500"
                  />
                </div>
              </div>

              {/* Location Privacy Selector */}
              <div>
                <label className="block text-xs font-semibold text-zinc-300 mb-1">Privacidade da sua Localização:</label>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { id: 'city', label: 'Mostrar Cidade' },
                    { id: 'approximate_region', label: 'Região Aprox.' },
                    { id: 'hidden', label: 'Ocultar Total' }
                  ].map(loc => (
                    <button
                      key={loc.id}
                      type="button"
                      onClick={() => setLocationPrivacy(loc.id as LocationPrivacy)}
                      className={`py-2 px-2 text-[11px] font-semibold rounded-xl border text-center transition-all cursor-pointer ${
                        locationPrivacy === loc.id
                          ? 'bg-purple-950 border-purple-500 text-white'
                          : 'bg-zinc-900/40 border-zinc-800 text-zinc-400'
                      }`}
                    >
                      {loc.label}
                    </button>
                  ))}
                </div>
                <p className="text-[10px] text-zinc-400 mt-1">
                  * O Vybelog nunca publica endereços residenciais exatos.
                </p>
              </div>

              <div>
                <label className="block text-xs font-semibold text-zinc-300 mb-1">Biografia Resumida</label>
                <textarea
                  rows={2}
                  value={bio}
                  onChange={e => setBio(e.target.value)}
                  placeholder="Conte um pouco sobre sua vibe, estilo de vida e o que valoriza..."
                  className="w-full px-3 py-2 bg-zinc-900/80 border border-purple-900/30 rounded-xl text-xs text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-purple-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-zinc-300 mb-1.5">Interesses e Afinidades:</label>
                <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto">
                  {interestOptions.map(tag => (
                    <button
                      key={tag}
                      type="button"
                      onClick={() => toggleInterest(tag)}
                      className={`px-2.5 py-1 rounded-full text-xs transition-colors cursor-pointer ${
                        selectedInterests.includes(tag)
                          ? 'bg-fuchsia-600 text-white font-semibold'
                          : 'bg-zinc-900 border border-zinc-800 text-zinc-400 hover:text-zinc-200'
                      }`}
                    >
                      {tag}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* STEP 4: COMPATIBILITY PREFERENCES & LIMITS */}
        {step === 4 && (
          <div className="space-y-4">
            <div>
              <h3 className="text-xl font-bold text-white mb-1">Objetivos & Limites Pessoais</h3>
              <p className="text-xs text-zinc-400">
                Alimente o algoritmo de sintonia bidirecional para receber sugestões compatíveis.
              </p>
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-zinc-300 mb-1">Qual o seu objetivo principal?</label>
                <div className="space-y-1.5">
                  {objectiveOptions.map(obj => (
                    <button
                      key={obj.id}
                      type="button"
                      onClick={() => toggleObjective(obj.id)}
                      className={`w-full text-left p-2.5 rounded-xl border text-xs transition-all flex items-center justify-between cursor-pointer ${
                        selectedObjectives.includes(obj.id)
                          ? 'bg-purple-950/70 border-purple-500 text-white font-semibold'
                          : 'bg-zinc-900/40 border-zinc-800 text-zinc-400'
                      }`}
                    >
                      <span>{obj.label}</span>
                      {selectedObjectives.includes(obj.id) && <Check className="w-3.5 h-3.5 text-purple-400" />}
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-zinc-300 mb-1">Ritmo de Conexão:</label>
                  <select
                    value={pacePreference}
                    onChange={e => setPacePreference(e.target.value as any)}
                    className="w-full p-2 bg-zinc-900 border border-purple-900/30 rounded-xl text-xs text-zinc-200 focus:outline-none"
                  >
                    <option value="slow_chat">Conversa lenta e calma</option>
                    <option value="flexible">Flexível / Depende da química</option>
                    <option value="spontaneous">Espontâneo / Direto</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-zinc-300 mb-1">Preferência de Encontro:</label>
                  <select
                    value={meetingPreference}
                    onChange={e => setMeetingPreference(e.target.value as any)}
                    className="w-full p-2 bg-zinc-900 border border-purple-900/30 rounded-xl text-xs text-zinc-200 focus:outline-none"
                  >
                    <option value="virtual_first">Virtual primeiro (Drink online)</option>
                    <option value="in_person">Presencial (Bar / Lounge)</option>
                    <option value="undecided">A combinar</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-zinc-300 mb-1">Limites Inegociáveis (Consentimento):</label>
                <textarea
                  rows={2}
                  value={limitsText}
                  onChange={e => setLimitsText(e.target.value)}
                  placeholder="Ex: Nada de fotos sem consentimento, respeito ao não, uso de preservativo..."
                  className="w-full px-3 py-2 bg-zinc-900/80 border border-purple-900/30 rounded-xl text-xs text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-purple-500"
                />
              </div>
            </div>
          </div>
        )}

        {/* STEP 5: PHOTOS & PRIVATE VAULT */}
        {step === 5 && (
          <div className="space-y-4">
            <div>
              <h3 className="text-xl font-bold text-white mb-1">Fotos & Cofre Privado</h3>
              <p className="text-xs text-zinc-400">
                Fotos públicas são visíveis na rede. Registros íntimos ficam trancados no seu Cofre.
              </p>
            </div>

            <div className="space-y-4">
              <div className="flex items-center gap-4">
                <img
                  src={defaultAvatar(displayName || username)}
                  alt="Avatar"
                  className="w-16 h-16 rounded-full object-cover border-2 border-purple-500"
                />
                <p className="flex-1 text-[11px] text-zinc-400">
                  Depois de confirmar seu e-mail, você pode enviar foto de perfil e capa direto do celular ou computador em <strong className="text-zinc-200">Meu Perfil → Editar</strong>. Removemos automaticamente a localização GPS e outros dados escondidos das fotos.
                </p>
              </div>

              {/* Private Vault explanation */}
              <div className="p-3.5 bg-purple-950/40 border border-purple-800/40 rounded-2xl">
                <div className="flex items-center gap-2 mb-1">
                  <Key className="w-4 h-4 text-fuchsia-400" />
                  <span className="text-xs font-bold text-white">Cofre Íntimo Criado Automaticamente</span>
                </div>
                <p className="text-[11px] text-zinc-300 leading-relaxed">
                  Seu cofre privado estará habilitado. Nele você poderá carregar fotos sensuais posteriormente e ninguém terá acesso até que você clique em <strong>Aprovar</strong> individualmente.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* STEP 6: VERIFICATION & COMPLETION */}
        {step === 6 && (
          <div className="space-y-4 text-center">
            <div className="w-14 h-14 mx-auto rounded-2xl bg-gradient-to-tr from-purple-600 to-rose-600 p-[2px] flex items-center justify-center">
              <div className="w-full h-full bg-[#0d0a17] rounded-[14px] flex items-center justify-center text-rose-400">
                <ShieldCheck className="w-7 h-7 text-emerald-400" />
              </div>
            </div>

            <div>
              <h3 className="text-xl font-bold text-white mb-1">Quase Tudo Pronto!</h3>
              <p className="text-xs text-zinc-400 max-w-sm mx-auto">
                Ao concluir, enviaremos um link de confirmação para <strong className="text-purple-300">{email || 'seu e-mail'}</strong>.
              </p>
            </div>

            <div className="p-3.5 bg-zinc-900/60 border border-zinc-800 rounded-2xl text-left">
              <label className="flex items-start gap-2.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={wantsSelfieVerification}
                  onChange={e => setWantsSelfieVerification(e.target.checked)}
                  className="mt-0.5 accent-purple-600 rounded cursor-pointer"
                />
                <span className="text-xs text-zinc-300 leading-tight">
                  <strong className="text-white">Solicitar Selo de Verificação (+18):</strong> Quero passar pela verificação de identidade da moderação para receber o selo verificado.
                </span>
              </label>
            </div>

            <Captcha ref={captcha} onToken={setCaptchaToken} />
            {submitError && <p className="text-xs text-rose-400">{submitError}</p>}
          </div>
        )}

        {/* Wizard Controls Footer */}
        <div className="pt-6 mt-6 border-t border-purple-950/40 flex items-center justify-between">
          {step > 1 ? (
            <button
              type="button"
              onClick={() => setStep(prev => prev - 1)}
              className="px-4 py-2 text-xs font-semibold text-zinc-400 hover:text-white flex items-center gap-1.5 cursor-pointer"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              Voltar
            </button>
          ) : (
            <div />
          )}

          {step < 6 ? (
            <button
              type="button"
              onClick={handleNext}
              className="px-6 py-2.5 rounded-xl font-bold text-xs text-white bg-gradient-to-r from-purple-600 to-rose-600 hover:from-purple-500 hover:to-rose-500 shadow-md shadow-purple-950/50 flex items-center gap-1.5 cursor-pointer"
            >
              <span>Avançar</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          ) : (
            <button
              type="button"
              onClick={handleFinishRegistration}
              disabled={isVerifying}
              className="px-8 py-3 rounded-xl font-bold text-xs text-white bg-gradient-to-r from-emerald-600 via-purple-600 to-rose-600 hover:opacity-90 shadow-lg shadow-purple-950/50 flex items-center gap-2 cursor-pointer disabled:opacity-50"
            >
              {isVerifying ? 'Validando Conta...' : 'Concluir Cadastro & Entrar'}
            </button>
          )}
        </div>

      </div>
    </div>
  );
};
