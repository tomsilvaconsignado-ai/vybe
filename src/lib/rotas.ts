// Endereços do Vybelog: cada tela tem o seu caminho, para que F5, voltar/avançar, links diretos e
// notificações abram exatamente onde a pessoa estava. Funções puras (sem React), testadas em rotas.test.ts.

export interface EstadoTela {
  aba: string;                       // activeTab do app (feed, discover, messages, profile...)
  perfilId: string | null;           // perfil visitado (null = o meu)
  conversaId: string | null;         // conversa aberta
  admin: boolean;                    // painel administrativo
  postId: string | null;             // publicação aberta por link
  eventoId: string | null;           // evento aberto
  comunidadeId: string | null;       // comunidade aberta
}

const ABA_PARA_CAMINHO: Record<string, string> = {
  feed: '/',
  following: '/seguindo',
  discover: '/descobrir',
  couples: '/casais',
  singles: '/solteiros',
  compatibility: '/sintonia',
  communities: '/comunidades',
  events: '/eventos',
  connections: '/conexoes',
  messages: '/mensagens',
  notifications: '/notificacoes',
  'notification-prefs': '/notificacoes/preferencias',
  profile: '/perfil',
  settings: '/configuracoes',
  invite: '/convide',
  founders: '/fundadores',
};
const CAMINHO_PARA_ABA = Object.fromEntries(Object.entries(ABA_PARA_CAMINHO).map(([aba, c]) => [c, aba]));

const ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const limpar = (caminho: string) => {
  const c = ('/' + caminho.replace(/^\/+/, '')).replace(/\/+$/, '');
  return c === '' ? '/' : c;
};

export const ESTADO_INICIAL: EstadoTela = { aba: 'feed', perfilId: null, conversaId: null, admin: false, postId: null, eventoId: null, comunidadeId: null };

/** Caminho que representa a tela atual */
export function caminhoDoEstado(e: EstadoTela): string {
  if (e.admin) return '/admin';
  if (e.postId) return `/publicacao/${e.postId}`;
  if (e.aba === 'profile' && e.perfilId) return `/perfil/${e.perfilId}`;
  if (e.aba === 'messages' && e.conversaId) return `/mensagens/${e.conversaId}`;
  if (e.aba === 'events' && e.eventoId) return `/eventos/${e.eventoId}`;
  if (e.aba === 'communities' && e.comunidadeId) return `/comunidades/${e.comunidadeId}`;
  return ABA_PARA_CAMINHO[e.aba] ?? '/';
}

/** Tela que um endereço representa (desconhecido: feed). Aceita o link antigo ?post=<id>. */
export function estadoDoCaminho(caminho: string, busca = ''): EstadoTela & { valido: boolean } {
  const c = limpar(caminho);
  const postAntigo = new URLSearchParams(busca).get('post');
  if (postAntigo && ID.test(postAntigo)) return { ...ESTADO_INICIAL, postId: postAntigo, valido: true };
  if (c === '/admin') return { ...ESTADO_INICIAL, admin: true, valido: true };
  const aba = CAMINHO_PARA_ABA[c];
  if (aba) return { ...ESTADO_INICIAL, aba, valido: true };
  const partes = c.split('/').filter(Boolean);
  if (partes.length === 2 && ID.test(partes[1]!)) {
    const id = partes[1]!;
    switch (partes[0]) {
      case 'perfil': return { ...ESTADO_INICIAL, aba: 'profile', perfilId: id, valido: true };
      case 'mensagens': return { ...ESTADO_INICIAL, aba: 'messages', conversaId: id, valido: true };
      case 'publicacao': return { ...ESTADO_INICIAL, postId: id, valido: true };
      case 'eventos': return { ...ESTADO_INICIAL, aba: 'events', eventoId: id, valido: true };
      case 'comunidades': return { ...ESTADO_INICIAL, aba: 'communities', comunidadeId: id, valido: true };
    }
  }
  return { ...ESTADO_INICIAL, valido: c === '/' };
}

/** Comentário a destacar (?comentario=<id>) quando a notificação aponta para um comentário */
export const comentarioDoEndereco = (busca: string) => {
  const id = new URLSearchParams(busca).get('comentario');
  return id && ID.test(id) ? id : null;
};

/** Links para compartilhar: passam pelo endereço principal (?ir=<caminho>), que responde normalmente,
 *  para o WhatsApp, Facebook e outras redes montarem a prévia com a imagem do Vybelog. O app abre a tela certa. */
export const linkCompartilhavel = (origem: string, caminho: string) => `${origem}/?ir=${encodeURIComponent(caminho)}`;
export const linkDaPublicacao = (origem: string, postId: string) => linkCompartilhavel(origem, `/publicacao/${postId}`);
export const linkDoPerfil = (origem: string, perfilId: string) => linkCompartilhavel(origem, `/perfil/${perfilId}`);
export const linkDoEvento = (origem: string, eventoId: string) => linkCompartilhavel(origem, `/eventos/${eventoId}`);
export const linkDaComunidade = (origem: string, comunidadeId: string) => linkCompartilhavel(origem, `/comunidades/${comunidadeId}`);

/** Destino de um link compartilhado (?ir=): só caminhos internos do próprio site */
export function destinoCompartilhado(busca: string): { caminho: string; busca: string } | null {
  const params = new URLSearchParams(busca);
  const ir = params.get('ir');
  if (!ir || !/^\/[A-Za-z0-9/_-]*$/.test(ir) || ir.startsWith('//')) return null;
  params.delete('ir');
  const resto = params.toString();
  return { caminho: ir, busca: resto ? `?${resto}` : '' };
}
