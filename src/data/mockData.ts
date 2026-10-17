import { 
  UserProfile, 
  Post, 
  Community, 
  Conversation, 
  NotificationItem, 
  ModerationReport, 
  AdminAuditLog,
  AdminUserRecord,
  AdminMediaRecord 
} from '../types';

export const TOM_ADMIN_USER: UserProfile = {
  id: 'usr_admin_tom',
  username: 'tom_silva',
  displayName: 'Tom Silva ✨',
  email: 'tomsilvaconsignado@gmail.com',
  profileType: 'couple',
  partners: [
    {
      id: 'p_tom_1',
      name: 'Tom Silva',
      age: 36,
      gender: 'Masculino',
      orientation: 'Heterossexual',
      consentConfirmed: true,
      avatarUrl: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=300&auto=format&fit=crop&q=80',
      bio: 'Fundador & Administrador Principal do VYBE. Apreciador de boa gastronomia.'
    },
    {
      id: 'p_tom_2',
      name: 'Bárbara',
      age: 33,
      gender: 'Feminino',
      orientation: 'Bissexual',
      consentConfirmed: true,
      avatarUrl: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=300&auto=format&fit=crop&q=80',
      bio: 'Arquiteta, mente aberta e apaixonada por viagens.'
    }
  ],
  city: 'São Paulo',
  state: 'SP',
  locationPrivacy: 'city',
  approximateDistanceKm: 0,
  age: 35,
  gender: 'Casal (H+M)',
  orientation: 'Liberal Consensual',
  bio: 'Casal discreto e focado em amizades e encontros sofisticados. Conexões autênticas com respeito e transparência.',
  avatarUrl: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=500&auto=format&fit=crop&q=80',
  coverUrl: 'https://images.unsplash.com/photo-1517457373958-b7bdd4587205?w=1200&auto=format&fit=crop&q=80',
  isVerified: true,
  verifiedBadgeType: 'identity',
  followersCount: 1540,
  followingCount: 320,
  connectionsCount: 88,
  compatibilityPrefs: {
    objectives: ['conhecer_casais', 'amizades', 'jantares_sociais'],
    interestedIn: ['couples', 'singles_female'],
    ageRange: [27, 46],
    maxDistanceKm: 60,
    meetingPreference: 'virtual_first',
    pacePreference: 'slow_chat',
    discretionLevel: 'high',
    groupReadiness: 'curious',
    personalLimits: [
      'Respeito mútuo absoluto',
      'Sigilo e discrição estrita',
      'Consentimento constante de todos os envolvidos'
    ],
    lifestyleTags: ['Vinho & Jazz', 'Rooftops', 'Clubes liberais discretos']
  },
  interests: ['Gastronomia', 'Vinho', 'Segurança Digital', 'Viagens', 'Arte'],
  isPremium: true,
  lastActive: 'Agora mesmo',
  statusText: 'SuperAdmin verificado • Conexão ativa no portal.',
  discreetModeEnabled: false,
  albums: [
    {
      id: 'alb_tom_01',
      userId: 'usr_admin_tom',
      title: 'Momentos & Viagens',
      description: 'Registros públicos de momentos gastronômicos e viagens.',
      coverUrl: 'https://images.unsplash.com/photo-1517457373958-b7bdd4587205?w=600&auto=format&fit=crop&q=80',
      visibility: 'public',
      mediaCount: 3,
      allowedUserIds: [],
      pendingRequestUserIds: [],
      createdAt: '2026-09-01',
      items: [
        {
          id: 'med_tom_01',
          url: 'https://images.unsplash.com/photo-1517457373958-b7bdd4587205?w=900&auto=format&fit=crop&q=80',
          type: 'image',
          visibility: 'public',
          caption: 'Brinde à segurança e liberdade',
          createdAt: '2026-09-01'
        }
      ]
    }
  ]
};

export const CURRENT_USER: UserProfile = {
  id: 'usr_me_01',
  username: 'casal_aurora',
  displayName: 'Leo & Luana ✨',
  email: 'leo.luana@vybe.app',
  profileType: 'couple',
  partners: [
    {
      id: 'p1',
      name: 'Leonardo',
      age: 33,
      gender: 'Masculino',
      orientation: 'Heterossexual',
      consentConfirmed: true,
      avatarUrl: 'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=300&auto=format&fit=crop&q=80',
      bio: 'Arquiteto, apreciador de boa gastronomia e conversas profundas.'
    },
    {
      id: 'p2',
      name: 'Luana',
      age: 30,
      gender: 'Feminino',
      orientation: 'Bissexual',
      consentConfirmed: true,
      avatarUrl: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=300&auto=format&fit=crop&q=80',
      bio: 'Designer de interiores, mente aberta, curiosa e apaixonada por viagens.'
    }
  ],
  city: 'São Paulo',
  state: 'SP',
  locationPrivacy: 'approximate_region',
  approximateDistanceKm: 0,
  age: 31,
  gender: 'Casal (H+M)',
  orientation: 'Liberal / Mente Aberta',
  bio: 'Juntos há 6 anos, explorando o meio liberal com respeito, diálogo e conexões genuínas. Buscamos tanto amizades para jantares quanto casais ou mulheres solteiras com boa energia e sintonia.',
  avatarUrl: 'https://images.unsplash.com/photo-1516589178581-6cd7833ae3b2?w=500&auto=format&fit=crop&q=80',
  coverUrl: 'https://images.unsplash.com/photo-1517457373958-b7bdd4587205?w=1200&auto=format&fit=crop&q=80',
  isVerified: true,
  verifiedBadgeType: 'curated_couple',
  followersCount: 342,
  followingCount: 189,
  connectionsCount: 47,
  compatibilityPrefs: {
    objectives: ['conhecer_casais', 'amizades', 'conhecer_terceira_pessoa', 'jantares_sociais'],
    interestedIn: ['couples', 'singles_female'],
    ageRange: [26, 42],
    maxDistanceKm: 45,
    meetingPreference: 'virtual_first',
    pacePreference: 'slow_chat',
    discretionLevel: 'high',
    groupReadiness: 'curious',
    personalLimits: [
      'Respeito absoluto ao ritmo mútuo',
      'Sem mensagens invasivas ou fotos sem consentimento prévio',
      'Discrição em redes sociais convencionais',
      'Uso indispensável de preservativo em qualquer intimidade'
    ],
    lifestyleTags: ['Vinho & Jazz', 'Viagens gastronômicas', 'Clubes liberais discretos', 'Rooftops', 'Conversa franca']
  },
  interests: ['Gastronomia', 'Vinho', 'Viagens', 'Arte', 'Noite Paulista', 'Música Eletrônica Elegante', 'Fotografia'],
  isPremium: true,
  lastActive: 'Agora mesmo',
  statusText: 'Planejando o próximo final de semana com boa companhia 🍷',
  discreetModeEnabled: false,
  albums: [
    {
      id: 'alb_pub_01',
      userId: 'usr_me_01',
      title: 'Momentos Públicos & Estilo',
      description: 'Nossa rotina, viagens e eventos sociais.',
      coverUrl: 'https://images.unsplash.com/photo-1517457373958-b7bdd4587205?w=600&auto=format&fit=crop&q=80',
      visibility: 'public',
      mediaCount: 4,
      allowedUserIds: [],
      pendingRequestUserIds: [],
      createdAt: '2026-08-10',
      items: [
        {
          id: 'med_01',
          url: 'https://images.unsplash.com/photo-1517457373958-b7bdd4587205?w=900&auto=format&fit=crop&q=80',
          type: 'image',
          visibility: 'public',
          caption: 'Noite de comemoração no Jardins 🍸',
          createdAt: '2026-08-10'
        },
        {
          id: 'med_02',
          url: 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=900&auto=format&fit=crop&q=80',
          type: 'image',
          visibility: 'public',
          caption: 'Curtindo o festival acústico no interior de SP',
          createdAt: '2026-08-15'
        },
        {
          id: 'med_03',
          url: 'https://images.unsplash.com/photo-1519671482749-fd09be7ccebf?w=900&auto=format&fit=crop&q=80',
          type: 'image',
          visibility: 'public',
          caption: 'Brinde às novas conexões que agregam.',
          createdAt: '2026-08-20'
        }
      ]
    },
    {
      id: 'alb_priv_01',
      userId: 'usr_me_01',
      title: 'Cofre Íntimo do Casal 🔒',
      description: 'Ensaios sensuais e registros privativos. Acesso concedido apenas após troca de mensagens e consentimento mútuo.',
      coverUrl: 'https://images.unsplash.com/photo-1518199266791-5375a83190b7?w=600&auto=format&fit=crop&q=80',
      visibility: 'private_vault',
      mediaCount: 3,
      allowedUserIds: ['usr_02_casal_sp'],
      pendingRequestUserIds: ['usr_03_sing_f', 'usr_05_casal_bh'],
      createdAt: '2026-08-12',
      items: [
        {
          id: 'med_priv_01',
          url: 'https://images.unsplash.com/photo-1518199266791-5375a83190b7?w=900&auto=format&fit=crop&q=80',
          type: 'image',
          visibility: 'private_vault',
          caption: 'Ensaio fotográfico intimista no quarto',
          blurPreview: true,
          createdAt: '2026-08-12'
        },
        {
          id: 'med_priv_02',
          url: 'https://images.unsplash.com/photo-1529333166437-7750a6dd5a70?w=900&auto=format&fit=crop&q=80',
          type: 'image',
          visibility: 'private_vault',
          caption: 'Cumplicidade e sensualidade a dois',
          blurPreview: true,
          createdAt: '2026-08-14'
        }
      ]
    }
  ]
};

export const MOCK_PROFILES: UserProfile[] = [
  {
    id: 'usr_02_casal_sp',
    username: 'rafa_e_carol',
    displayName: 'Rafa & Carol 🍷',
    email: 'rafa.carol@example.com',
    profileType: 'couple',
    partners: [
      {
        id: 'p2_1',
        name: 'Rafael',
        age: 35,
        gender: 'Masculino',
        orientation: 'Heterossexual',
        consentConfirmed: true,
        avatarUrl: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=300&auto=format&fit=crop&q=80'
      },
      {
        id: 'p2_2',
        name: 'Carolina',
        age: 32,
        gender: 'Feminino',
        orientation: 'Bissexual',
        consentConfirmed: true,
        avatarUrl: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=300&auto=format&fit=crop&q=80'
      }
    ],
    city: 'São Paulo',
    state: 'SP',
    locationPrivacy: 'city',
    approximateDistanceKm: 6,
    age: 34,
    gender: 'Casal (H+M)',
    orientation: 'Liberal Consensual',
    bio: 'Casal experiente no meio liberal (4 anos). Amantes de bons restaurantes, festas temáticas sofisticadas e troca de energia leve. Adoramos receber em casa para um bom papo antes de qualquer passo.',
    avatarUrl: 'https://images.unsplash.com/photo-1522529599102-193c0d76b5b6?w=600&auto=format&fit=crop&q=80',
    coverUrl: 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=1200&auto=format&fit=crop&q=80',
    isVerified: true,
    verifiedBadgeType: 'curated_couple',
    followersCount: 890,
    followingCount: 310,
    connectionsCount: 84,
    compatibilityPrefs: {
      objectives: ['conhecer_casais', 'amizades', 'conhecer_terceira_pessoa'],
      interestedIn: ['couples', 'singles_female'],
      ageRange: [27, 44],
      maxDistanceKm: 30,
      meetingPreference: 'in_person',
      pacePreference: 'flexible',
      discretionLevel: 'high',
      groupReadiness: 'open',
      personalLimits: ['Sem tabaco em ambientes fechados', 'Consentimento expresso dos 4 envolvidos'],
      lifestyleTags: ['Vinho & Jazz', 'Clubes liberais discretos', 'Rooftops']
    },
    interests: ['Gastronomia', 'Festas Privadas', 'Coquetelaria', 'Viagens', 'Respeito Mútuo'],
    isPremium: true,
    lastActive: 'Há 12 min',
    statusText: 'Buscando casal para um drink na Vila Madalena na sexta!',
    albums: [
      {
        id: 'alb_rafa_01',
        userId: 'usr_02_casal_sp',
        title: 'Estilo de Vida & Eventos',
        description: 'Nossa vibe em viagens e noites especiais.',
        coverUrl: 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=600&auto=format&fit=crop&q=80',
        visibility: 'public',
        mediaCount: 3,
        allowedUserIds: [],
        pendingRequestUserIds: [],
        createdAt: '2026-07-20',
        items: [
          {
            id: 'med_rf_1',
            url: 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=900&auto=format&fit=crop&q=80',
            type: 'image',
            visibility: 'public',
            caption: 'Festa no rooftop com vista panorâmica',
            createdAt: '2026-07-20'
          }
        ]
      },
      {
        id: 'alb_rafa_priv',
        userId: 'usr_02_casal_sp',
        title: 'Cofre Secreto 🔐',
        description: 'Imagens reservadas para amigos próximos e conexões aprovadas.',
        coverUrl: 'https://images.unsplash.com/photo-1518199266791-5375a83190b7?w=600&auto=format&fit=crop&q=80',
        visibility: 'private_vault',
        mediaCount: 5,
        allowedUserIds: ['usr_me_01'],
        pendingRequestUserIds: [],
        createdAt: '2026-08-01',
        items: [
          {
            id: 'med_rf_priv1',
            url: 'https://images.unsplash.com/photo-1518199266791-5375a83190b7?w=900&auto=format&fit=crop&q=80',
            type: 'image',
            visibility: 'private_vault',
            caption: 'Ensaio lingerie & champagne',
            blurPreview: false,
            createdAt: '2026-08-01'
          }
        ]
      }
    ]
  },
  {
    id: 'usr_03_sing_f',
    username: 'valentina_rio',
    displayName: 'Valentina Becker ✨',
    email: 'valentina@example.com',
    profileType: 'single_female',
    city: 'Rio de Janeiro',
    state: 'RJ',
    locationPrivacy: 'approximate_region',
    approximateDistanceKm: 420,
    age: 28,
    gender: 'Feminino',
    orientation: 'Bissexual',
    bio: 'Advogada tributarista, independente, mente aberta e discreta. Busco casais com química real e respeito mútuo para momentos especiais, sem cobranças ou dramas. Prezo por afinidade intelectual antes de tudo.',
    avatarUrl: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=600&auto=format&fit=crop&q=80',
    coverUrl: 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=1200&auto=format&fit=crop&q=80',
    isVerified: true,
    verifiedBadgeType: 'identity',
    followersCount: 1240,
    followingCount: 140,
    connectionsCount: 32,
    compatibilityPrefs: {
      objectives: ['conhecer_casais', 'amizades', 'conhecer_terceira_pessoa'],
      interestedIn: ['couples'],
      ageRange: [28, 48],
      maxDistanceKm: 500,
      meetingPreference: 'virtual_first',
      pacePreference: 'slow_chat',
      discretionLevel: 'high',
      groupReadiness: 'open',
      personalLimits: ['Sem pressão', 'Respeito ao sigilo profissional', 'Prevenção sempre'],
      lifestyleTags: ['Praia', 'Vinho & Jazz', 'Conversa franca']
    },
    interests: ['Praia', 'Artes Visuais', 'Jazz', 'Bossa Nova', 'Gastronomia Carioca'],
    isPremium: true,
    lastActive: 'Há 5 min',
    statusText: 'No Rio este mês, em SP no próximo!',
    albums: [
      {
        id: 'alb_val_01',
        userId: 'usr_03_sing_f',
        title: 'Vida Solar & Viagens',
        description: 'Registros do Rio e escapadas pelo mundo.',
        coverUrl: 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=600&auto=format&fit=crop&q=80',
        visibility: 'public',
        mediaCount: 3,
        allowedUserIds: [],
        pendingRequestUserIds: [],
        createdAt: '2026-06-12',
        items: [
          {
            id: 'med_v1',
            url: 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=900&auto=format&fit=crop&q=80',
            type: 'image',
            visibility: 'public',
            caption: 'Pôr do sol no Arpoador 🌅',
            createdAt: '2026-06-12'
          }
        ]
      },
      {
        id: 'alb_val_priv',
        userId: 'usr_03_sing_f',
        title: 'Galeria Exclusiva 🔒',
        description: 'Apenas após nos conhecermos pelo chat e com afinidade confirmada.',
        coverUrl: 'https://images.unsplash.com/photo-1529333166437-7750a6dd5a70?w=600&auto=format&fit=crop&q=80',
        visibility: 'private_vault',
        mediaCount: 4,
        allowedUserIds: [],
        pendingRequestUserIds: ['usr_me_01'],
        createdAt: '2026-07-01',
        items: [
          {
            id: 'med_vpriv1',
            url: 'https://images.unsplash.com/photo-1529333166437-7750a6dd5a70?w=900&auto=format&fit=crop&q=80',
            type: 'image',
            visibility: 'private_vault',
            caption: 'Sensualidade natural',
            blurPreview: true,
            createdAt: '2026-07-01'
          }
        ]
      }
    ]
  },
  {
    id: 'usr_04_sing_m',
    username: 'gabriel_curitiba',
    displayName: 'Gabriel M. ⚡',
    email: 'gabriel@example.com',
    profileType: 'single_male',
    city: 'Curitiba',
    state: 'PR',
    locationPrivacy: 'city',
    approximateDistanceKm: 340,
    age: 32,
    gender: 'Masculino',
    orientation: 'Heterossexual',
    bio: 'Empresário do ramo tech, solteiro, praticante de crossfit e apreciador de bons whiskies. Respeito irrestrito ao casal e seus limites declarados. Experiência em menage consensual e sigilo absoluto.',
    avatarUrl: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=600&auto=format&fit=crop&q=80',
    coverUrl: 'https://images.unsplash.com/photo-1519671482749-fd09be7ccebf?w=1200&auto=format&fit=crop&q=80',
    isVerified: true,
    verifiedBadgeType: 'selfie_age',
    followersCount: 450,
    followingCount: 95,
    connectionsCount: 22,
    compatibilityPrefs: {
      objectives: ['conhecer_casais', 'amizades'],
      interestedIn: ['couples'],
      ageRange: [25, 45],
      maxDistanceKm: 200,
      meetingPreference: 'in_person',
      pacePreference: 'spontaneous',
      discretionLevel: 'high',
      groupReadiness: 'open',
      personalLimits: ['Sem fotos divulgadas', 'Total respeito à vontade da mulher no casal'],
      lifestyleTags: ['Conversa franca', 'Rooftops']
    },
    interests: ['Esportes', 'Tecnologia', 'Vinhos', 'Cinema', 'Fitness'],
    isPremium: false,
    lastActive: 'Há 1 hora',
    statusText: 'Disponível para bate-papo civilizado.',
    albums: [
      {
        id: 'alb_gab_01',
        userId: 'usr_04_sing_m',
        title: 'Rotina & Lazer',
        description: 'Treinos, viagens e cafés.',
        coverUrl: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=600&auto=format&fit=crop&q=80',
        visibility: 'public',
        mediaCount: 2,
        allowedUserIds: [],
        pendingRequestUserIds: [],
        createdAt: '2026-05-10',
        items: []
      }
    ]
  },
  {
    id: 'usr_05_casal_bh',
    username: 'edu_e_mari',
    displayName: 'Edu & Mari 🌿',
    email: 'edu.mari@example.com',
    profileType: 'couple',
    partners: [
      {
        id: 'p5_1',
        name: 'Eduardo',
        age: 38,
        gender: 'Masculino',
        orientation: 'Heterossexual',
        consentConfirmed: true,
        avatarUrl: 'https://images.unsplash.com/photo-1492562080023-ab3db95bfbce?w=300&auto=format&fit=crop&q=80'
      },
      {
        id: 'p5_2',
        name: 'Mariana',
        age: 36,
        gender: 'Feminino',
        orientation: 'Bissexual',
        consentConfirmed: true,
        avatarUrl: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=300&auto=format&fit=crop&q=80'
      }
    ],
    city: 'Belo Horizonte',
    state: 'MG',
    locationPrivacy: 'city',
    approximateDistanceKm: 490,
    age: 37,
    gender: 'Casal (H+M)',
    orientation: 'Liberal / Poliamor Aberto',
    bio: 'Casal de médicos de BH. Gostamos de conexões com alma, boa comida mineira, taça de vinho e tranquilidade. Não temos pressa, priorizamos a cumplicidade e a boa sintonia.',
    avatarUrl: 'https://images.unsplash.com/photo-1516589178581-6cd7833ae3b2?w=600&auto=format&fit=crop&q=80',
    coverUrl: 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=1200&auto=format&fit=crop&q=80',
    isVerified: true,
    verifiedBadgeType: 'curated_couple',
    followersCount: 512,
    followingCount: 210,
    connectionsCount: 40,
    compatibilityPrefs: {
      objectives: ['conhecer_casais', 'amizades', 'jantares_sociais'],
      interestedIn: ['couples', 'singles_female'],
      ageRange: [30, 48],
      maxDistanceKm: 150,
      meetingPreference: 'virtual_first',
      pacePreference: 'slow_chat',
      discretionLevel: 'high',
      groupReadiness: 'curious',
      personalLimits: ['Sem pressa', 'Respeito ao horário de descanso'],
      lifestyleTags: ['Vinho & Jazz', 'Conversa franca', 'Viagens gastronômicas']
    },
    interests: ['Medicina', 'Gastronomia Mineira', 'Trilhas', 'Vinho', 'Literatura'],
    isPremium: false,
    lastActive: 'Há 3 horas',
    statusText: 'Abrindo um bom Syrah neste sábado.',
    albums: []
  },
  {
    id: 'usr_06_polyamory',
    username: 'triade_solar',
    displayName: 'Clara, Max & Dani ☀️',
    email: 'triade@example.com',
    profileType: 'polyamorous',
    city: 'Florianópolis',
    state: 'SC',
    locationPrivacy: 'approximate_region',
    approximateDistanceKm: 650,
    age: 29,
    gender: 'Tríade Consensual',
    orientation: 'Poliamor Livre & Ético',
    bio: 'Tríade consensual vivendo na ilha da magia. Celebramos o afeto livre, transparência radical e trocas sem posse. Buscamos pessoas e casais para amizades leves e encontros ao ar livre.',
    avatarUrl: 'https://images.unsplash.com/photo-1529156069898-49953e39b3ac?w=600&auto=format&fit=crop&q=80',
    coverUrl: 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=1200&auto=format&fit=crop&q=80',
    isVerified: true,
    verifiedBadgeType: 'identity',
    followersCount: 980,
    followingCount: 420,
    connectionsCount: 65,
    compatibilityPrefs: {
      objectives: ['amizades', 'conhecer_casais', 'encontros_sociais'],
      interestedIn: ['all'],
      ageRange: [23, 45],
      maxDistanceKm: 100,
      meetingPreference: 'in_person',
      pacePreference: 'flexible',
      discretionLevel: 'medium',
      groupReadiness: 'open',
      personalLimits: ['Comunicação não violenta', 'Consentimento constante'],
      lifestyleTags: ['Praia', 'Conversa franca', 'Viagens']
    },
    interests: ['Praia', 'Yoga', 'Sustentabilidade', 'Música Orgânica', 'Festivais'],
    isPremium: true,
    lastActive: 'Ontem',
    statusText: 'Vivendo com autenticidade.',
    albums: []
  }
];

export const MOCK_POSTS: Post[] = [
  {
    id: 'post_01',
    userId: 'usr_02_casal_sp',
    user: {
      id: 'usr_02_casal_sp',
      username: 'rafa_e_carol',
      displayName: 'Rafa & Carol 🍷',
      avatarUrl: 'https://images.unsplash.com/photo-1522529599102-193c0d76b5b6?w=600&auto=format&fit=crop&q=80',
      profileType: 'couple',
      isVerified: true,
      city: 'São Paulo, SP'
    },
    content: 'O meio liberal nos ensinou que diálogo transparente fortalece o casamento mil vezes mais do que qualquer tabu. Nossa primeira regra sempre foi: se não for 100% consensual e desejado por ambos, não acontece. Qual o valor indispensável na relação de vocês?',
    mediaUrls: [
      'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=900&auto=format&fit=crop&q=80',
      'https://images.unsplash.com/photo-1517457373958-b7bdd4587205?w=900&auto=format&fit=crop&q=80'
    ],
    tags: ['Diálogo', 'Cumplicidade', 'CasalLiberal', 'ConsentimentoSempre', 'VYBE'],
    location: 'Jardins, São Paulo',
    poll: {
      question: 'O que é primordial antes de conhecer outro casal?',
      options: [
        { id: 'opt_1', text: 'Jantar ou drink inicial sem pressa', votes: 142 },
        { id: 'opt_2', text: 'Conversar bastante por mensagem primeiro', votes: 89 },
        { id: 'opt_3', text: 'Química imediata em clube liberal', votes: 34 }
      ],
      voterIds: { 'usr_me_01': 'opt_1' }
    },
    likesCount: 128,
    likedByCurrentUser: true,
    commentsCount: 18,
    savedByCurrentUser: true,
    createdAt: 'Há 2 horas',
    visibility: 'public',
    comments: [
      {
        id: 'c1',
        postId: 'post_01',
        userId: 'usr_me_01',
        username: 'casal_aurora',
        userDisplayName: 'Leo & Luana ✨',
        userAvatar: 'https://images.unsplash.com/photo-1516589178581-6cd7833ae3b2?w=300&auto=format&fit=crop&q=80',
        isVerified: true,
        content: 'Assinamos embaixo! Sem drink e afinidade intelectual prévia, nada flui com a mesma elegância.',
        createdAt: 'Há 1 hora',
        likesCount: 14
      },
      {
        id: 'c2',
        postId: 'post_01',
        userId: 'usr_03_sing_f',
        username: 'valentina_rio',
        userDisplayName: 'Valentina Becker ✨',
        userAvatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=300&auto=format&fit=crop&q=80',
        isVerified: true,
        content: 'Perfeito! É tão revigorante ver casais que tratam a terceira pessoa com respeito e sem jogos.',
        createdAt: 'Há 35 min',
        likesCount: 9
      }
    ]
  },
  {
    id: 'post_02',
    userId: 'usr_03_sing_f',
    user: {
      id: 'usr_03_sing_f',
      username: 'valentina_rio',
      displayName: 'Valentina Becker ✨',
      avatarUrl: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=600&auto=format&fit=crop&q=80',
      profileType: 'single_female',
      isVerified: true,
      city: 'Rio de Janeiro, RJ'
    },
    content: 'Tarde recarregando energias à beira-mar. Nada substitui a paz de saber exatamente o que você quer e não aceitar menos do que respeito e maturidade. Um brinde à autonomia feminina! 🥂✨',
    mediaUrls: [
      'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=900&auto=format&fit=crop&q=80'
    ],
    tags: ['RioDeJaneiro', 'Autonomia', 'MenteAberta', 'GoodVibes'],
    location: 'Ipanema, Rio de Janeiro',
    likesCount: 245,
    likedByCurrentUser: false,
    commentsCount: 24,
    savedByCurrentUser: false,
    createdAt: 'Há 5 horas',
    visibility: 'public',
    comments: []
  },
  {
    id: 'post_03',
    userId: 'usr_me_01',
    user: {
      id: 'usr_me_01',
      username: 'casal_aurora',
      displayName: 'Leo & Luana ✨',
      avatarUrl: 'https://images.unsplash.com/photo-1516589178581-6cd7833ae3b2?w=500&auto=format&fit=crop&q=80',
      profileType: 'couple',
      isVerified: true,
      city: 'São Paulo, SP'
    },
    content: 'Ensaio novo no nosso cofre privado! Concedemos acesso para perfis com quem já estabelecemos uma boa conversa e conexão por aqui. Se estiver na sintonia, solicite acesso ao nosso álbum trancado.',
    mediaUrls: [
      'https://images.unsplash.com/photo-1518199266791-5375a83190b7?w=900&auto=format&fit=crop&q=80'
    ],
    tags: ['EnsaioIntimo', 'CofrePrivado', 'Casal', 'VYBE'],
    location: 'São Paulo',
    likesCount: 94,
    likedByCurrentUser: true,
    commentsCount: 6,
    savedByCurrentUser: false,
    createdAt: 'Ontem',
    visibility: 'public',
    comments: []
  }
];

export const MOCK_COMMUNITIES: Community[] = [
  {
    id: 'comm_01',
    name: 'Casais Liberais de São Paulo',
    slug: 'casais-sp',
    description: 'Espaço exclusivo para casais da grande SP trocarem experiências, dicas de rooftops, lounges discretos e encontros sociais.',
    coverUrl: 'https://images.unsplash.com/photo-1517457373958-b7bdd4587205?w=800&auto=format&fit=crop&q=80',
    iconUrl: '🍷',
    category: 'regional',
    rules: [
      'Respeito absoluto à privacidade e identidade dos membros.',
      'Proibido postar conteúdo explícito no feed geral da comunidade.',
      'Consentimento mútuo obrigatório em qualquer interação.',
      'Não é permitida abordagem comercial ou spam.'
    ],
    membersCount: 1420,
    isJoined: true,
    isPrivate: true,
    postsCount: 312,
    moderators: ['rafa_e_carol', 'casal_aurora']
  },
  {
    id: 'comm_02',
    name: 'Iniciantes no Meio Liberal: Dúvidas & Diálogo',
    slug: 'iniciantes-liberal',
    description: 'Para casais e pessoas solteiras que estão dando os primeiros passos no universo não-monogâmico com segurança emocional e respeito.',
    coverUrl: 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=800&auto=format&fit=crop&q=80',
    iconUrl: '🌱',
    category: 'beginners',
    rules: [
      'Zero julgamento: todas as dúvidas sinceras são bem-vindas.',
      'Sem mensagens privadas invasivas sem consentimento explícito.',
      'Foco em comunicação não violenta e acordos de casal.'
    ],
    membersCount: 2850,
    isJoined: true,
    isPrivate: false,
    postsCount: 780,
    moderators: ['psico_marina', 'admin_vybe']
  },
  {
    id: 'comm_03',
    name: 'Conexões a Três & Poliamor Ético',
    slug: 'poliamor-etico',
    description: 'Debates sobre unicorn-hunting responsável, relações a três sem hierarquias tóxicas e desconstrução da posse.',
    coverUrl: 'https://images.unsplash.com/photo-1529156069898-49953e39b3ac?w=800&auto=format&fit=crop&q=80',
    iconUrl: '✨',
    category: 'lifestyle',
    rules: [
      'Respeito prioritário à autonomia e bem-estar de pessoas solteiras.',
      'Sem objetificação ou promessas irreais.',
      'Comunicação clara de limites e expectativas.'
    ],
    membersCount: 1980,
    isJoined: false,
    isPrivate: false,
    postsCount: 420,
    moderators: ['triade_solar']
  },
  {
    id: 'comm_04',
    name: 'Festas & Noites Liberais Sofisticadas',
    slug: 'festas-sofisticadas',
    description: 'Guia de eventos fechados, festas de máscaras, hotéis boutique liberais e encontros para quem valoriza discrição e elegância.',
    coverUrl: 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=800&auto=format&fit=crop&q=80',
    iconUrl: '🎭',
    category: 'events',
    rules: [
      'Proibido divulgar endereços exatos abertamente.',
      'Dress code e etiqueta do meio devem ser observados.',
      'O "Não" é definitivo em qualquer ambiente.'
    ],
    membersCount: 3100,
    isJoined: false,
    isPrivate: true,
    postsCount: 560,
    moderators: ['rafa_e_carol']
  }
];

export const MOCK_CONVERSATIONS: Conversation[] = [
  {
    id: 'conv_01',
    participantIds: ['usr_me_01', 'usr_02_casal_sp'],
    participants: [
      {
        id: 'usr_02_casal_sp',
        username: 'rafa_e_carol',
        displayName: 'Rafa & Carol 🍷',
        avatarUrl: 'https://images.unsplash.com/photo-1522529599102-193c0d76b5b6?w=600&auto=format&fit=crop&q=80',
        profileType: 'couple',
        isVerified: true,
        lastActive: 'Agora'
      }
    ],
    unreadCount: 0,
    isPendingRequest: false,
    lastMessage: {
      id: 'msg_01',
      conversationId: 'conv_01',
      senderId: 'usr_02_casal_sp',
      senderName: 'Rafa & Carol',
      senderAvatar: 'https://images.unsplash.com/photo-1522529599102-193c0d76b5b6?w=600&auto=format&fit=crop&q=80',
      content: 'Adoramos as fotos do ensaio de vocês! O restaurante no Jardins sexta às 20h está confirmado?',
      createdAt: '18:42',
      status: 'read'
    }
  },
  {
    id: 'conv_02',
    participantIds: ['usr_me_01', 'usr_03_sing_f'],
    participants: [
      {
        id: 'usr_03_sing_f',
        username: 'valentina_rio',
        displayName: 'Valentina Becker ✨',
        avatarUrl: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=600&auto=format&fit=crop&q=80',
        profileType: 'single_female',
        isVerified: true,
        lastActive: 'Há 5 min'
      }
    ],
    unreadCount: 1,
    isPendingRequest: false,
    lastMessage: {
      id: 'msg_02',
      conversationId: 'conv_02',
      senderId: 'usr_03_sing_f',
      senderName: 'Valentina',
      senderAvatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=600&auto=format&fit=crop&q=80',
      content: 'Oi Leo e Luana! Gostei muito do perfil e da postura de vocês. Quando estiverem pelo Rio me avisem!',
      createdAt: '14:20',
      status: 'delivered'
    }
  },
  {
    id: 'conv_03_request',
    participantIds: ['usr_me_01', 'usr_04_sing_m'],
    participants: [
      {
        id: 'usr_04_sing_m',
        username: 'gabriel_curitiba',
        displayName: 'Gabriel M. ⚡',
        avatarUrl: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=600&auto=format&fit=crop&q=80',
        profileType: 'single_male',
        isVerified: true,
        lastActive: 'Há 1 hora'
      }
    ],
    unreadCount: 1,
    isPendingRequest: true, // Message request gate protecting user inbox
    lastMessage: {
      id: 'msg_03',
      conversationId: 'conv_03_request',
      senderId: 'usr_04_sing_m',
      senderName: 'Gabriel',
      senderAvatar: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=600&auto=format&fit=crop&q=80',
      content: 'Olá casal! Vi o perfil de vocês na busca por compatibilidade e temos muitos gostos e limites em comum. Seria um prazer bater um papo.',
      createdAt: 'Ontem',
      status: 'delivered'
    }
  }
];

export const MOCK_NOTIFICATIONS: NotificationItem[] = [
  {
    id: 'notif_01',
    userId: 'usr_me_01',
    actor: {
      id: 'usr_03_sing_f',
      displayName: 'Valentina Becker ✨',
      username: 'valentina_rio',
      avatarUrl: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=300&auto=format&fit=crop&q=80'
    },
    type: 'vault_access_request',
    title: 'Solicitação de Acesso ao Cofre',
    message: 'solicitou permissão para visualizar o álbum privado "Cofre Íntimo do Casal 🔒".',
    referenceId: 'alb_priv_01',
    createdAt: 'Há 15 min',
    read: false
  },
  {
    id: 'notif_02',
    userId: 'usr_me_01',
    actor: {
      id: 'usr_02_casal_sp',
      displayName: 'Rafa & Carol 🍷',
      username: 'rafa_e_carol',
      avatarUrl: 'https://images.unsplash.com/photo-1522529599102-193c0d76b5b6?w=300&auto=format&fit=crop&q=80'
    },
    type: 'vault_access_granted',
    title: 'Acesso a Álbum Concedido',
    message: 'aprovou seu pedido para visualizar o álbum "Cofre Secreto 🔐".',
    referenceId: 'alb_rafa_priv',
    createdAt: 'Há 2 horas',
    read: false
  },
  {
    id: 'notif_03',
    userId: 'usr_me_01',
    actor: {
      id: 'usr_02_casal_sp',
      displayName: 'Rafa & Carol 🍷',
      username: 'rafa_e_carol',
      avatarUrl: 'https://images.unsplash.com/photo-1522529599102-193c0d76b5b6?w=300&auto=format&fit=crop&q=80'
    },
    type: 'like',
    title: 'Nova curtida na publicação',
    message: 'curtiu seu post sobre cumplicidade e diálogo.',
    referenceId: 'post_01',
    createdAt: 'Há 3 horas',
    read: true
  },
  {
    id: 'notif_04',
    userId: 'usr_me_01',
    actor: {
      id: 'sys',
      displayName: 'Segurança VYBE',
      username: 'seguranca',
      avatarUrl: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=300&auto=format&fit=crop&q=80'
    },
    type: 'system_safety',
    title: 'Selo de Casal Verificado Concedido',
    message: 'Seu perfil conjunto foi auditado e aprovado com o selo dourado de Casal Verificado.',
    createdAt: 'Ontem',
    read: true
  }
];

export const MOCK_REPORTS: ModerationReport[] = [
  {
    id: 'rep_01',
    reporterUserId: 'usr_03_sing_f',
    reporterName: 'Valentina Becker',
    reportedUserId: 'usr_suspect_99',
    reportedUserName: 'marcos_fake_sp',
    targetType: 'message',
    targetId: 'msg_flag_01',
    category: 'unsolicited_explicit',
    description: 'Enviou foto íntima não solicitada logo após a primeira mensagem sem consentimento nem autorização prévia.',
    status: 'pending',
    priority: 'urgent',
    createdAt: '2026-10-17 11:20',
    evidenceSnapshot: '[Foto sinalizada com blur preventivo pela IA de segurança]'
  },
  {
    id: 'rep_02',
    reporterUserId: 'usr_02_casal_sp',
    reporterName: 'Rafa & Carol',
    reportedUserId: 'usr_suspect_88',
    reportedUserName: 'rodrigo_perfil_falso',
    targetType: 'profile',
    targetId: 'usr_suspect_88',
    category: 'fake_profile',
    description: 'Usando fotos de modelo internacional encontradas no Pinterest para se passar por casal.',
    status: 'under_review',
    priority: 'high',
    createdAt: '2026-10-16 19:40',
    reviewedBy: 'Mod. Carlos',
    evidenceSnapshot: 'Reverso de imagens confirmou duplicidade em banco externo.'
  },
  {
    id: 'rep_03',
    reporterUserId: 'usr_05_casal_bh',
    reporterName: 'Edu & Mari',
    reportedUserId: 'usr_suspect_77',
    reportedUserName: 'spam_divulgacao',
    targetType: 'post',
    targetId: 'post_spam_01',
    category: 'scam',
    description: 'Divulgando links suspeitos de venda de ingressos em comunidade sem permissão.',
    status: 'resolved',
    priority: 'medium',
    createdAt: '2026-10-15 14:10',
    reviewedBy: 'SuperAdmin Ana',
    resolutionNote: 'Conta suspensa preventivamente por 7 dias e postagem excluída conforme regras da comunidade.'
  }
];

export const MOCK_ADMIN_LOGS: AdminAuditLog[] = [
  {
    id: 'log_01',
    adminId: 'adm_super_01',
    adminName: 'Ana V. (SuperAdmin)',
    adminRole: 'superadmin',
    action: 'SUSPEND_USER',
    targetId: 'usr_suspect_77',
    targetType: 'User',
    reason: 'Violação das regras de publicidade não autorizada e links suspeitos.',
    timestamp: '2026-10-15 15:02:11',
    ipAddress: '177.18.29.112 (VPN Corporativa)'
  },
  {
    id: 'log_02',
    adminId: 'adm_mod_02',
    adminName: 'Carlos M. (Moderador)',
    adminRole: 'moderator',
    action: 'INSPECT_FLAGGED_MESSAGE',
    targetId: 'msg_flag_01',
    targetType: 'ChatMessage',
    reason: 'Investigação estrita de denúncia de envio de mídia sem consentimento (REP-01).',
    timestamp: '2026-10-17 11:35:40',
    ipAddress: '177.18.29.114 (VPN Corporativa)'
  },
  {
    id: 'log_03',
    adminId: 'adm_mod_02',
    adminName: 'Carlos M. (Moderador)',
    adminRole: 'moderator',
    action: 'VERIFY_AGE_BADGE',
    targetId: 'usr_me_01',
    targetType: 'UserProfile',
    reason: 'Documento e biometria facial de ambos os parceiros validados com sucesso.',
    timestamp: '2026-10-16 10:14:00',
    ipAddress: '177.18.29.114 (VPN Corporativa)'
  },
  {
    id: 'log_04',
    adminId: 'usr_admin_tom',
    adminName: 'Tom Silva (SuperAdmin)',
    adminRole: 'superadmin',
    action: 'SYSTEM_BOOTSTRAP_PRIMARY_ADMIN',
    targetId: 'tomsilvaconsignado@gmail.com',
    targetType: 'AuthAccount',
    reason: 'Provisionamento seguro de credencial administrativa principal no banco com política RLS.',
    timestamp: '2026-10-17 14:00:00',
    ipAddress: '177.18.29.100 (Sessão Segura Criptografada)'
  }
];

export const INITIAL_ADMIN_USERS: AdminUserRecord[] = [
  {
    id: 'usr_admin_tom',
    username: 'tom_silva',
    displayName: 'Tom Silva ✨ (SuperAdmin)',
    email: 'tomsilvaconsignado@gmail.com',
    profileType: 'couple',
    city: 'São Paulo',
    state: 'SP',
    age: 35,
    status: 'active',
    isVerified: true,
    verifiedBadgeType: 'identity',
    avatarUrl: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=300&auto=format&fit=crop&q=80',
    coverUrl: 'https://images.unsplash.com/photo-1517457373958-b7bdd4587205?w=1200&auto=format&fit=crop&q=80',
    createdAt: '2026-01-10',
    lastActive: 'Agora mesmo',
    reportsReceivedCount: 0,
    moderationNotes: [
      {
        id: 'note_01',
        adminId: 'system',
        adminName: 'Sistema',
        note: 'Superadministrador principal registrado e autorizado no banco de dados.',
        createdAt: '2026-01-10 10:00'
      }
    ],
    birthdateVerified: true,
    consentConfirmed: true,
    albumsCount: 1,
    postsCount: 2
  },
  {
    id: 'usr_me_01',
    username: 'casal_aurora',
    displayName: 'Leo & Luana ✨',
    email: 'leo.luana@vybe.app',
    profileType: 'couple',
    city: 'São Paulo',
    state: 'SP',
    age: 31,
    status: 'active',
    isVerified: true,
    verifiedBadgeType: 'curated_couple',
    avatarUrl: 'https://images.unsplash.com/photo-1516589178581-6cd7833ae3b2?w=500&auto=format&fit=crop&q=80',
    coverUrl: 'https://images.unsplash.com/photo-1517457373958-b7bdd4587205?w=1200&auto=format&fit=crop&q=80',
    createdAt: '2026-08-01',
    lastActive: 'Há 5 min',
    reportsReceivedCount: 0,
    moderationNotes: [],
    birthdateVerified: true,
    consentConfirmed: true,
    albumsCount: 2,
    postsCount: 1
  },
  {
    id: 'usr_02_casal_sp',
    username: 'rafa_e_carol',
    displayName: 'Rafa & Carol 🍷',
    email: 'rafa.carol@example.com',
    profileType: 'couple',
    city: 'São Paulo',
    state: 'SP',
    age: 34,
    status: 'active',
    isVerified: true,
    verifiedBadgeType: 'curated_couple',
    avatarUrl: 'https://images.unsplash.com/photo-1522529599102-193c0d76b5b6?w=600&auto=format&fit=crop&q=80',
    coverUrl: 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=1200&auto=format&fit=crop&q=80',
    createdAt: '2026-07-15',
    lastActive: 'Há 12 min',
    reportsReceivedCount: 0,
    moderationNotes: [
      {
        id: 'note_02',
        adminId: 'adm_mod_02',
        adminName: 'Carlos M.',
        note: 'Casal verificado com biometria facial válida de ambos os parceiros.',
        createdAt: '2026-07-16'
      }
    ],
    birthdateVerified: true,
    consentConfirmed: true,
    albumsCount: 2,
    postsCount: 1
  },
  {
    id: 'usr_03_sing_f',
    username: 'valentina_rio',
    displayName: 'Valentina Becker ✨',
    email: 'valentina@example.com',
    profileType: 'single_female',
    city: 'Rio de Janeiro',
    state: 'RJ',
    age: 28,
    status: 'active',
    isVerified: true,
    verifiedBadgeType: 'identity',
    avatarUrl: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=600&auto=format&fit=crop&q=80',
    coverUrl: 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=1200&auto=format&fit=crop&q=80',
    createdAt: '2026-06-10',
    lastActive: 'Há 5 min',
    reportsReceivedCount: 0,
    moderationNotes: [],
    birthdateVerified: true,
    consentConfirmed: true,
    albumsCount: 2,
    postsCount: 1
  },
  {
    id: 'usr_suspect_88',
    username: 'rodrigo_perfil_falso',
    displayName: 'Rodrigo M. (Em Análise)',
    email: 'rodrigo.suspect@example.com',
    profileType: 'single_male',
    city: 'São Paulo',
    state: 'SP',
    age: 29,
    status: 'restricted',
    isVerified: false,
    avatarUrl: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=300&auto=format&fit=crop&q=80',
    coverUrl: 'https://images.unsplash.com/photo-1519671482749-fd09be7ccebf?w=1200&auto=format&fit=crop&q=80',
    createdAt: '2026-10-14',
    lastActive: 'Ontem',
    reportsReceivedCount: 1,
    restrictions: {
      cannotMessage: true,
      cannotRequestVault: true,
      until: '2026-10-24'
    },
    moderationNotes: [
      {
        id: 'note_03',
        adminId: 'adm_mod_02',
        adminName: 'Carlos M.',
        note: 'Restrição temporária aplicada após denúncia de duplicidade de imagem de perfil.',
        createdAt: '2026-10-16 20:00'
      }
    ],
    birthdateVerified: false,
    consentConfirmed: true,
    albumsCount: 0,
    postsCount: 0
  },
  {
    id: 'usr_suspect_77',
    username: 'spam_divulgacao',
    displayName: 'Eventos SP Fake',
    email: 'spam77@example.com',
    profileType: 'single_male',
    city: 'Campinas',
    state: 'SP',
    age: 30,
    status: 'suspended',
    isVerified: false,
    avatarUrl: 'https://images.unsplash.com/photo-1492562080023-ab3db95bfbce?w=300&auto=format&fit=crop&q=80',
    coverUrl: 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=1200&auto=format&fit=crop&q=80',
    createdAt: '2026-10-10',
    lastActive: '3 dias atrás',
    reportsReceivedCount: 2,
    restrictions: {
      cannotPost: true,
      cannotMessage: true,
      cannotRequestVault: true
    },
    moderationNotes: [
      {
        id: 'note_04',
        adminId: 'usr_admin_tom',
        adminName: 'Tom Silva (SuperAdmin)',
        note: 'Conta suspensa preventivamente por 7 dias devido a spam comercial em comunidades.',
        createdAt: '2026-10-15 15:02'
      }
    ],
    birthdateVerified: false,
    consentConfirmed: true,
    albumsCount: 0,
    postsCount: 1
  }
];

export const INITIAL_ADMIN_MEDIA: AdminMediaRecord[] = [
  {
    id: 'adm_med_01',
    userId: 'usr_02_casal_sp',
    userName: 'rafa_e_carol',
    userAvatar: 'https://images.unsplash.com/photo-1522529599102-193c0d76b5b6?w=600&auto=format&fit=crop&q=80',
    url: 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=900&auto=format&fit=crop&q=80',
    type: 'image',
    visibility: 'public',
    albumTitle: 'Estilo de Vida & Eventos',
    caption: 'Festa no rooftop com vista panorâmica',
    status: 'approved',
    createdAt: '2026-07-20'
  },
  {
    id: 'adm_med_02',
    userId: 'usr_me_01',
    userName: 'casal_aurora',
    userAvatar: 'https://images.unsplash.com/photo-1516589178581-6cd7833ae3b2?w=500&auto=format&fit=crop&q=80',
    url: 'https://images.unsplash.com/photo-1517457373958-b7bdd4587205?w=900&auto=format&fit=crop&q=80',
    type: 'image',
    visibility: 'public',
    albumTitle: 'Momentos Públicos & Estilo',
    caption: 'Noite de comemoração no Jardins 🍸',
    status: 'approved',
    createdAt: '2026-08-10'
  },
  {
    id: 'adm_med_03',
    userId: 'usr_03_sing_f',
    userName: 'valentina_rio',
    userAvatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=600&auto=format&fit=crop&q=80',
    url: 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=900&auto=format&fit=crop&q=80',
    type: 'image',
    visibility: 'public',
    albumTitle: 'Vida Solar & Viagens',
    caption: 'Pôr do sol no Arpoador 🌅',
    status: 'approved',
    createdAt: '2026-06-12'
  },
  {
    id: 'adm_med_04_flagged',
    userId: 'usr_suspect_88',
    userName: 'rodrigo_perfil_falso',
    userAvatar: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=300&auto=format&fit=crop&q=80',
    url: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=900&auto=format&fit=crop&q=80',
    type: 'image',
    visibility: 'public',
    caption: 'Foto de capa sinalizada por denúncia de perfil falso',
    status: 'flagged',
    reportId: 'rep_02',
    flagReason: 'Suspeita de uso de foto de banco de imagens para falsidade ideológica.',
    createdAt: '2026-10-16'
  },
  {
    id: 'adm_med_05_vault',
    userId: 'usr_02_casal_sp',
    userName: 'rafa_e_carol',
    userAvatar: 'https://images.unsplash.com/photo-1522529599102-193c0d76b5b6?w=600&auto=format&fit=crop&q=80',
    url: 'https://images.unsplash.com/photo-1518199266791-5375a83190b7?w=900&auto=format&fit=crop&q=80',
    type: 'image',
    visibility: 'private_vault',
    albumTitle: 'Cofre Secreto 🔐',
    caption: 'Ensaio lingerie & champagne (Cofre Protegido com Chave)',
    status: 'approved',
    isPrivateVaultItem: true,
    createdAt: '2026-08-01'
  }
];
