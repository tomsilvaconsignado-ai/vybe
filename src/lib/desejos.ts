// Jogos a dois no direct: Match de Desejos (§26 do setup.sql) e Quiz do Kama Sutra (§27). As respostas ficam no banco e só as
// funções leem; o resultado traz apenas o que os dois têm em comum.
import { supabase } from './supabase';

export type Baralho = 'posicoes' | 'esquenta' | 'fantasias' | 'encontros' | 'mix';
export type Resposta = 0 | 1 | 2;

export const BARALHOS: Array<{ id: Baralho; nome: string; emoji: string; descricao: string; cor: string }> = [
  { id: 'esquenta', nome: 'Esquenta', emoji: '🕯️', descricao: 'Preliminares e provocações', cor: 'from-rose-500/30 to-orange-500/20' },
  { id: 'posicoes', nome: 'Posições', emoji: '🔥', descricao: 'Do clássico ao acrobático', cor: 'from-fuchsia-600/30 to-rose-500/20' },
  { id: 'fantasias', nome: 'Fantasias', emoji: '🎭', descricao: 'Desejos para conversar e realizar', cor: 'from-purple-600/30 to-fuchsia-500/20' },
  { id: 'encontros', nome: 'Encontros', emoji: '🥂', descricao: 'Programas a dois, sem pressa', cor: 'from-amber-500/30 to-rose-500/20' },
  { id: 'mix', nome: 'Mix surpresa', emoji: '🎲', descricao: 'Um pouco de tudo, sorteado', cor: 'from-sky-500/25 to-fuchsia-600/25' },
];

export interface CartaDesejo { id: string; emoji: string; titulo: string; descricao: string; intensidade: 1 | 2 | 3; baralho: string; minha: Resposta | null }
export interface Combinacao { id: string; emoji: string; titulo: string; descricao: string; nivel: 'os_dois_querem' | 'quem_sabe' }
export interface JogoDesejos {
  kind: 'desejos';
  id: string; conversation_id: string; deck: Baralho; status: 'playing' | 'done' | 'declined';
  eu_desafiei: boolean; total: number; meus: number; dele: number;
  outro: { id: string; nome: string; avatar: string };
  cartas: CartaDesejo[];
  combinacoes: Combinacao[] | null; sintonia: number | null;
}

const mensagem = (e: { message: string }) =>
  /conversa já aceita/.test(e.message) ? 'O jogo só pode ser enviado depois que a conversa for aceita.'
    : /muitos jogos/.test(e.message) ? 'Você já enviou muitos jogos hoje. Tente amanhã.'
      : /já terminou/.test(e.message) ? 'Este jogo já terminou.'
        : /não encontrado|Não é possível/.test(e.message) ? 'Este jogo não está mais disponível.'
          : 'Não foi possível concluir. Tente de novo.';

export async function desafiar(outroId: string, baralho: Baralho): Promise<{ id: string; existente: boolean } | { erro: string }> {
  const { data, error } = await supabase.rpc('desire_start', { p_partner: outroId, p_deck: baralho });
  if (error) return { erro: mensagem(error) };
  return data as { id: string; existente: boolean };
}

/** Quiz do Kama Sutra (§27): desenho da posição e 4 nomes; placar só no final */
export interface PerguntaQuiz {
  id: string; opcoes: Array<{ id: string; titulo: string }>;
  minha: number | null; certa: number | null; outro_acertou: boolean | null;
}
export interface JogoQuiz {
  kind: 'quiz';
  id: string; conversation_id: string; status: 'playing' | 'done' | 'declined';
  eu_desafiei: boolean; total: number; meus: number; dele: number;
  outro: { id: string; nome: string; avatar: string };
  perguntas: PerguntaQuiz[];
  placar: { eu: number; outro: number } | null;
}
export type Jogo = JogoDesejos | JogoQuiz;

/** abre qualquer jogo do direct (o banco diz o tipo) */
export async function abrirJogo(id: string): Promise<Jogo | { erro: string }> {
  const { data, error } = await supabase.rpc('desire_game', { p_game: id });
  if (error) return { erro: mensagem(error) };
  return data as Jogo;
}

export async function desafiarQuiz(outroId: string): Promise<{ id: string; existente: boolean } | { erro: string }> {
  const { data, error } = await supabase.rpc('quiz_start', { p_partner: outroId });
  if (error) return { erro: mensagem(error) };
  return data as { id: string; existente: boolean };
}

export async function responderQuiz(id: string, pergunta: string, opcao: number): Promise<JogoQuiz | { erro: string }> {
  const { data, error } = await supabase.rpc('quiz_answer', { p_game: id, p_card: pergunta, p_choice: opcao });
  if (error) return { erro: /já respondeu/.test(error.message) ? 'Você já respondeu esta pergunta.' : mensagem(error) };
  return data as JogoQuiz;
}

export async function responder(id: string, carta: string, resposta: Resposta): Promise<JogoDesejos | { erro: string }> {
  const { data, error } = await supabase.rpc('desire_answer', { p_game: id, p_card: carta, p_answer: resposta });
  if (error) return { erro: mensagem(error) };
  return data as JogoDesejos;
}

export async function recusar(id: string): Promise<string | null> {
  const { error } = await supabase.rpc('desire_decline', { p_game: id });
  return error ? mensagem(error) : null;
}
