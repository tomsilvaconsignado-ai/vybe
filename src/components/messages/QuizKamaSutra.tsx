// Quiz do Kama Sutra (dentro da janela de jogos do direct): o desenho da posição e 4 nomes.
// Cada um responde no seu tempo e vê na hora se acertou; o placar e os acertos da outra pessoa
// só aparecem quando os dois terminam.
import React, { useState } from 'react';
import { Check, Trophy, X as Errou } from 'lucide-react';
import { notify } from '../common/Feedback';
import { responderQuiz, type JogoQuiz } from '../../lib/desejos';
import { PictogramaPosicao } from './Pictogramas';

const acertou = (q: JogoQuiz['perguntas'][number]) => q.minha !== null && q.minha === q.certa;

export const QuizKamaSutra: React.FC<{
  jogo: JogoQuiz; aoAtualizar: (j: JogoQuiz) => void; aoFechar: () => void; aoRevanche: () => void; aoOutroJogo: () => void;
}> = ({ jogo, aoAtualizar, aoFechar, aoRevanche, aoOutroJogo }) => {
  // pergunta em tela: a primeira sem resposta (ou a que acabou de ser respondida, até tocar em "Próxima")
  const [atual, setAtual] = useState(() => Math.max(0, jogo.perguntas.findIndex((q) => q.minha === null)));
  const [ocupado, setOcupado] = useState(false);
  const pontos = jogo.perguntas.filter(acertou).length;

  if (jogo.status === 'done' && jogo.placar) return <Placar jogo={jogo} aoFechar={aoFechar} aoRevanche={aoRevanche} aoOutroJogo={aoOutroJogo} />;

  const q = jogo.perguntas[atual];
  const respondida = !!q && q.minha !== null;

  const escolher = async (opcao: number) => {
    if (!q || respondida || ocupado) return;
    setOcupado(true);
    const r = await responderQuiz(jogo.id, q.id, opcao);
    setOcupado(false);
    if ('erro' in r) { notify(r.erro, 'error'); return; }
    aoAtualizar(r);
  };
  const proxima = () => {
    const seguinte = jogo.perguntas.findIndex((p, i) => i > atual && p.minha === null);
    if (seguinte !== -1) setAtual(seguinte);
    else setAtual(jogo.total); // todas respondidas: vai para a espera
  };

  // todas respondidas e já saiu da última: espera a outra pessoa
  if (!q) {
    return (
      <div className="py-4 text-center">
        <p className="text-5xl" aria-hidden>🧠</p>
        <p className="mt-2 text-lg font-bold">Você acertou {pontos} de {jogo.total}!</p>
        <p className="mt-1 text-sm text-zinc-400">Agora é a vez de {jogo.outro.nome} ({jogo.dele}/{jogo.total}). O placar sai quando os dois terminarem.</p>
        <div className="mx-auto mt-4 h-2 max-w-[220px] rounded-full bg-white/10">
          <div className="h-2 rounded-full bg-gradient-to-r from-fuchsia-500 to-amber-400 transition-[width] duration-500" style={{ width: `${(jogo.dele / jogo.total) * 100}%` }} />
        </div>
        <button type="button" onClick={aoFechar} className="mt-6 min-h-[44px] w-full rounded-2xl fundo-neon font-bold cursor-pointer">Voltar à conversa</button>
      </div>
    );
  }

  const certa = q.certa;
  return (
    <>
      <div className="mb-3 flex items-center text-[12px] text-zinc-400">
        <span className="tabular-nums">Pergunta {atual + 1} de {jogo.total}</span>
        <span className="ml-auto tabular-nums">Seus acertos: <b className="text-white">{pontos}</b></span>
      </div>
      <div className="mb-4 flex gap-1" aria-hidden>
        {jogo.perguntas.map((p, i) => (
          <span key={p.id} className={`h-1.5 flex-1 rounded-full ${i === atual ? 'bg-white' : p.minha === null ? 'bg-white/15' : acertou(p) ? 'bg-emerald-400' : 'bg-rose-500'}`} />
        ))}
      </div>
      <div key={q.id} className="carta-desejo rounded-3xl border border-white/10 bg-gradient-to-br from-fuchsia-600/25 via-purple-800/20 to-rose-500/15 px-4 pt-3 pb-4 text-center">
        <PictogramaPosicao id={q.id} titulo="Posição do quiz" className="mx-auto w-full max-w-[260px] drop-shadow-[0_0_18px_rgba(236,72,153,0.35)]" />
        <p className="mt-1 text-lg font-extrabold">Qual é o nome desta posição?</p>
      </div>
      <div className="mt-4 grid grid-cols-2 gap-2" role="group" aria-label="Opções">
        {q.opcoes.map((o, i) => {
          const eCerta = respondida && i === certa;
          const eMinhaErrada = respondida && i === q.minha && i !== certa;
          return (
            <button key={o.id} type="button" disabled={respondida || ocupado} onClick={() => void escolher(i)}
              className={`min-h-[56px] rounded-2xl px-3 text-[14px] font-bold leading-tight flex items-center justify-center gap-1.5 transition-transform active:scale-95 cursor-pointer disabled:cursor-default ${
                eCerta ? 'bg-emerald-500 text-black' : eMinhaErrada ? 'bg-rose-600 text-white' : respondida ? 'bg-white/5 text-zinc-500' : 'bg-white/10 hover:bg-white/20 text-white'}`}>
              {eCerta && <Check className="w-4 h-4 shrink-0" strokeWidth={3} />}{eMinhaErrada && <Errou className="w-4 h-4 shrink-0" strokeWidth={3} />}
              {o.titulo}
            </button>
          );
        })}
      </div>
      {respondida && (
        <div className="mt-4 text-center" aria-live="polite">
          <p className="font-bold">{acertou(q) ? 'Acertou! 🔥' : `Era ${q.opcoes[certa ?? 0]?.titulo} 😏`}</p>
          <button type="button" onClick={proxima} className="mt-3 min-h-[44px] w-full rounded-2xl fundo-neon font-bold cursor-pointer">
            {jogo.perguntas.some((p, i) => i > atual && p.minha === null) ? 'Próxima' : 'Ver resultado'}
          </button>
        </div>
      )}
    </>
  );
};

const Placar: React.FC<{ jogo: JogoQuiz; aoFechar: () => void; aoRevanche: () => void; aoOutroJogo: () => void }> = ({ jogo, aoFechar, aoRevanche, aoOutroJogo }) => {
  const { eu, outro } = jogo.placar!;
  const titulo = eu > outro ? 'Você venceu! 🏆' : eu < outro ? `${jogo.outro.nome} venceu 😏` : 'Empate! 🔥';
  const frase = eu > outro ? 'O prêmio: você escolhe a próxima posição 😏' : eu < outro ? `${jogo.outro.nome} escolhe a próxima posição… ou pede revanche!` : 'Desempate ao vivo?';
  return (
    <div>
      <div className="text-center">
        <Trophy className={`mx-auto w-10 h-10 ${eu >= outro ? 'text-amber-300' : 'text-zinc-500'}`} aria-hidden />
        <p className="mt-2 text-xl font-extrabold">{titulo}</p>
        <p className="mt-1 text-3xl font-extrabold tabular-nums">
          <span className={eu >= outro ? 'text-fuchsia-300' : ''}>{eu}</span>
          <span className="mx-2 text-zinc-500">×</span>
          <span className={outro >= eu ? 'text-fuchsia-300' : ''}>{outro}</span>
        </p>
        <p className="text-[12px] text-zinc-400">Você × {jogo.outro.nome}</p>
        <p className="mt-2 text-sm text-zinc-200">{frase}</p>
      </div>
      <ul className="mt-4 grid grid-cols-2 gap-2">
        {jogo.perguntas.map((q) => (
          <li key={q.id} className="rounded-2xl bg-white/[0.06] p-2">
            <PictogramaPosicao id={q.id} titulo={q.opcoes[q.certa ?? 0]?.titulo} className="w-full" />
            <p className="truncate text-center text-[12px] font-bold">{q.opcoes[q.certa ?? 0]?.titulo}</p>
            <p className="mt-0.5 flex justify-center gap-2 text-[11px] text-zinc-400">
              <span>Você {acertou(q) ? '✅' : '❌'}</span><span>{jogo.outro.nome.split(' ')[0]} {q.outro_acertou ? '✅' : '❌'}</span>
            </p>
          </li>
        ))}
      </ul>
      <div className="mt-5 grid gap-2">
        <button type="button" onClick={aoFechar} className="min-h-[44px] rounded-2xl fundo-neon font-bold cursor-pointer">Conversar sobre isso</button>
        <div className="grid grid-cols-2 gap-2">
          <button type="button" onClick={aoRevanche} className="min-h-[44px] rounded-2xl bg-white/10 hover:bg-white/15 text-sm font-semibold cursor-pointer">Revanche 🧠</button>
          <button type="button" onClick={aoOutroJogo} className="min-h-[44px] rounded-2xl bg-white/10 hover:bg-white/15 text-sm font-semibold cursor-pointer">Outro jogo</button>
        </div>
      </div>
    </div>
  );
};
