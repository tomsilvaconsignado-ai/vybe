// Link de convite: vybelog.com.br/convite/<código> (ou qualquer link com ?convite=<código>).
// O código fica guardado no navegador por 30 dias e vai junto com o cadastro (dados da conta), então a
// indicação é registrada mesmo que a pessoa confirme o e-mail em outro aparelho.
// Funções puras + localStorage, sem React (testadas em convite.test.ts).

const CHAVE = 'vybe.convite';
const VALIDADE_MS = 30 * 24 * 60 * 60 * 1000;
const CODIGO = /^[a-z0-9-]{4,24}$/;

export interface ConviteGuardado { codigo: string; campanha: string | null; em: number }

/** Lê o código de um endereço: /convite/<código>[?campanha=x] ou ?convite=<código>[&campanha=x] */
export function conviteDoEndereco(caminho: string, busca: string): { codigo: string; campanha: string | null; caminhoLimpo: string; buscaLimpa: string } | null {
  const params = new URLSearchParams(busca);
  const m = caminho.match(/^\/convite\/([^/?#]+)\/?$/i);
  const codigo = (m ? decodeURIComponent(m[1]!) : params.get('convite') ?? '').trim().toLowerCase();
  if (!CODIGO.test(codigo)) return null;
  const campanhaBruta = (params.get('campanha') ?? '').trim().toLowerCase();
  const campanha = /^[a-z0-9-]{3,40}$/.test(campanhaBruta) ? campanhaBruta : null;
  params.delete('convite');
  params.delete('campanha');
  const resto = params.toString();
  return { codigo, campanha, caminhoLimpo: m ? '/' : caminho, buscaLimpa: resto ? `?${resto}` : '' };
}

export function guardarConvite(codigo: string, campanha: string | null, agora = Date.now()) {
  try { localStorage.setItem(CHAVE, JSON.stringify({ codigo, campanha, em: agora } satisfies ConviteGuardado)); } catch { /* sem armazenamento */ }
}

export function conviteGuardado(agora = Date.now()): ConviteGuardado | null {
  try {
    const c = JSON.parse(localStorage.getItem(CHAVE) ?? 'null') as ConviteGuardado | null;
    if (!c || !CODIGO.test(c.codigo) || agora - c.em > VALIDADE_MS) return null;
    return c;
  } catch { return null; }
}

export function limparConvite() {
  try { localStorage.removeItem(CHAVE); } catch { /* sem armazenamento */ }
}

/** Link de convite para compartilhar (opcionalmente de uma campanha) */
// pelo endereço principal (?convite=), que as redes sociais leem para montar a prévia com a logo
export const linkDeConvite = (origem: string, codigo: string, campanha?: string | null) =>
  `${origem}/?convite=${codigo}${campanha ? `&campanha=${encodeURIComponent(campanha)}` : ''}`;

/** Acrescenta o código de quem compartilha a qualquer link do Vybelog (perfil, comunidade, evento...) */
export function comConvite(link: string, codigo: string | null | undefined): string {
  if (!codigo) return link;
  try {
    const u = new URL(link);
    u.searchParams.set('convite', codigo);
    return u.toString();
  } catch { return link; }
}

/** Mensagem pronta para o WhatsApp: {link} vira o link do convite */
export const mensagemComLink = (modelo: string, link: string) =>
  modelo.includes('{link}') ? modelo.split('{link}').join(link) : `${modelo.trim()} ${link}`;

export const linkWhatsApp = (texto: string) => `https://wa.me/?text=${encodeURIComponent(texto)}`;
