// Opções usadas no cadastro e na edição do perfil (mesma lista nos dois lugares)

export const INTEREST_OPTIONS = [
  'Gastronomia', 'Vinho', 'Viagens', 'Festas Privadas', 'Clubes Liberais',
  'Praia', 'Cinema de Arte', 'Música Eletrônica', 'Jazz & Blues', 'BDSM Suave',
  'Poliamor', 'Conversa Filosófica', 'Saúde & Fitness'
];

export const OBJECTIVE_OPTIONS = [
  { id: 'conhecer_casais', label: 'Conhecer outros casais' },
  { id: 'amizades', label: 'Fazer amizades no meio liberal' },
  { id: 'conhecer_terceira_pessoa', label: 'Conhecer uma terceira pessoa' },
  { id: 'jantares_sociais', label: 'Participar de jantares e eventos sociais' },
  { id: 'conversar_primeiro', label: 'Conversar com calma antes de encontros' }
];

export const PROFILE_TYPE_OPTIONS = [
  { id: 'couple', label: 'Casal' },
  { id: 'single_female', label: 'Mulher solteira' },
  { id: 'single_male', label: 'Homem solteiro' },
  { id: 'joint_profile', label: 'Perfil conjunto' },
  { id: 'polyamorous', label: 'Poliamor / Tríade' }
] as const;

export const GENDER_OPTIONS = ['Feminino', 'Masculino', 'Não binário', 'Outro'];
export const ORIENTATION_OPTIONS = ['Heterossexual', 'Bissexual', 'Homossexual', 'Pansexual', 'Outra'];

// Aba opcional de preferências: só perguntas que o cadastro não faz, para ninguém responder duas vezes
export interface ExtraQuestion {
  id: string;
  question: string;
  multiple?: boolean;
  options: { id: string; label: string }[];
}

export const EXTRA_QUESTIONS: ExtraQuestion[] = [
  {
    id: 'experience',
    question: 'Qual a sua experiência no meio liberal?',
    options: [
      { id: 'beginner', label: 'Estou começando' },
      { id: 'some', label: 'Já tive algumas experiências' },
      { id: 'experienced', label: 'Tenho bastante experiência' }
    ]
  },
  {
    id: 'availability',
    question: 'Quando você costuma ter disponibilidade?',
    multiple: true,
    options: [
      { id: 'weekdays', label: 'Durante a semana' },
      { id: 'weekends', label: 'Fins de semana' },
      { id: 'nights', label: 'À noite' },
      { id: 'flexible', label: 'Horários flexíveis' }
    ]
  },
  {
    id: 'venues',
    question: 'Onde prefere os encontros?',
    multiple: true,
    options: [
      { id: 'bars', label: 'Bares e restaurantes' },
      { id: 'clubs', label: 'Clubes e casas liberais' },
      { id: 'private', label: 'Ambiente privado' },
      { id: 'travel', label: 'Viagens' }
    ]
  },
  {
    id: 'values',
    question: 'O que você mais valoriza em alguém?',
    multiple: true,
    options: [
      { id: 'chemistry', label: 'Química' },
      { id: 'conversation', label: 'Boa conversa' },
      { id: 'care', label: 'Higiene e cuidado' },
      { id: 'discretion', label: 'Discrição' },
      { id: 'humor', label: 'Bom humor' }
    ]
  },
  {
    id: 'protection',
    question: 'Uso de preservativo',
    options: [
      { id: 'always', label: 'Sempre' },
      { id: 'discuss', label: 'A combinar' }
    ]
  },
  {
    id: 'smoking',
    question: 'Você fuma?',
    options: [
      { id: 'no', label: 'Não' },
      { id: 'social', label: 'Socialmente' },
      { id: 'yes', label: 'Sim' }
    ]
  },
  {
    id: 'drinking',
    question: 'Você bebe?',
    options: [
      { id: 'no', label: 'Não' },
      { id: 'social', label: 'Socialmente' },
      { id: 'yes', label: 'Sim' }
    ]
  }
];
