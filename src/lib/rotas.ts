// Endereços do Vybelog: cada tela tem o seu caminho, para que F5, voltar/avançar, links diretos e
// notificações abram exatamente onde a pessoa estava. Funções puras (sem React), testadas em rotas.test.ts.

export interface EstadoTela {
  aba: string;                       // activeTab do app (feed, discover, messages, profile...)
  perfilId: string | null;           // perfil visitado (null = o meu)
  conversaId: string | null;         // conversa aberta
  admin: boolean;                    // painel administrativo
  postId: string | null;             // publicação aberta por link
}

const ABA_PARA_CAMINHO: Record<string, string> = {
  feed: '/',
  discover: '/descobrir',
  couples: '/casais',
  singles: '/solteiros',
  compatibility: '/sintonia',
  communities: '/comunidades',
  events: '/eventos',
  connections: '/conexoes',
  messages: '/mensagens',
  notifications: '/notificacoes',
  profile: '/perfil',
  settings: '/configuracoes',
};
const CAMINHO_PARA_ABA = Object.fromEntries(Object.entries(ABA_PARA_CAMINHO).map(([aba, c]) => [c, aba]));

const ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const limpar = (caminho: string) => {
  const c = ('/' + caminho.replace(/^\/+/, '')).replace(/\/+$/, '');
  return c === '' ? '/' : c;
};

export const ESTADO_INICIAL: EstadoTela = { aba: 'feed', perfilId: null, conversaId: null, admin: false, postId: null };

/** Caminho que representa a tela atual */
export function caminhoDoEstado(e: EstadoTela): string {
  if (e.admin) return '/admin';
  if (e.postId) return `/publicacao/${e.postId}`;
  if (e.aba === 'profile' && e.perfilId) return `/perfil/${e.perfilId}`;
  if (e.aba === 'messages' && e.conversaId) return `/mensagens/${e.conversaId}`;
  return ABA_PARA_CAMINHO[e.aba] ?? '/';
}

/** Tela que um endereço representa (desconhecido: feed). Aceita o link antigo ?post=<id>. */
export function estadoDoCaminho(caminho: string, busca = ''): EstadoTela & { valido: boolean } {
  const c = limpar(caminho);
  const postAntigo = new URLSearchParams(busca).get('post');
  if (postAntigo && ID.test(postAntigo)) return { ...ESTADO_INICIAL, postId: postAntigo, valido: true };
  if (c === '/admin') return { ...ESTADO_INICIAL, admin: true, valido: true };
  const partes = c.split('/').filter(Boolean);
  if (partes.length === 2 && ID.test(partes[1]!)) {
    if (partes[0] === 'perfil') return { ...ESTADO_INICIAL, aba: 'profile', perfilId: partes[1]!, valido: true };
    if (partes[0] === 'mensagens') return { ...ESTADO_INICIAL, aba: 'messages', conversaId: partes[1]!, valido: true };
    if (partes[0] === 'publicacao') return { ...ESTADO_INICIAL, postId: partes[1]!, valido: true };
  }
  const aba = CAMINHO_PARA_ABA[c];
  return aba ? { ...ESTADO_INICIAL, aba, valido: true } : { ...ESTADO_INICIAL, valido: c === '/' };
}

export const mesmaTela = (a: EstadoTela, b: EstadoTela) => caminhoDoEstado(a) === caminhoDoEstado(b);

/** Link público de uma publicação */
export const linkDaPublicacao = (origem: string, postId: string) => `${origem}/publicacao/${postId}`;
export const linkDoPerfil = (origem: string, perfilId: string) => `${origem}/perfil/${perfilId}`;
