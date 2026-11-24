// Quiz do Kama Sutra (dentro da janela de jogos do direct): o desenho da posição e 4 nomes.
// Cada um responde no seu tempo e vê na hora se acertou; o placar e os acertos da outra pessoa
// só aparecem quando os dois terminam. Visual: capa ilustrada, moldura dourada por nível,
// confete no acerto, tremida no erro, sequência de acertos, medalha no placar e sons opcionais.
import React, { useEffect, useState } from 'react';
import { Check, Clock, Sparkles, Trophy, Volume2, VolumeX, X as Errou } from 'lucide-react';
import { notify } from '../common/Feedback';
import { responderQuiz, type JogoQuiz } from '../../lib/desejos';
import { PictogramaPosicao } from './Pictogramas';
import { Ampulheta, CapaQuiz, Confete, Medalha, MolduraNivel, NIVEIS, tocar, useContagem, useSom, vibrar, type Nivel } from './QuizArte';

type Pergunta = JogoQuiz['perguntas'][number];
const acertou = (q: Pergunta) => q.minha !== null && q.minha === q.certa;
const pts = (n: number) => `${n} ${n === 1 ? 'ponto' : 'pontos'}`;
/** cada acerto vale o nível da posição */
const meusPontos = (j: JogoQuiz) => j.perguntas.filter(acertou).reduce((s, q) => s + q.nivel, 0);
const LETRAS = ['A', 'B', 'C', 'D'];

/** acertos seguidos até a última pergunta respondida (na ordem do quiz) */
function sequencia(j: JogoQuiz): number {
  let n = 0;
  for (const q of j.perguntas) {
    if (q.minha === null) break;
    n = acertou(q) ? n + 1 : 0;
  }
  return n;
}

// frases variadas, escolhidas pela própria pergunta (a mesma pergunta sempre mostra a mesma)
const ELOGIOS = ['Na mosca!', 'Mandou bem!', 'Especialista 😏', 'Acertou em cheio!', 'Isso que é conhecimento 🔥', 'Sem dúvida nenhuma!'];
const CONSOLOS = ['Quase!', 'Essa era difícil…', 'Fica pra próxima 😏', 'Errou, mas agora já sabe!'];
const escolha = (lista: string[], chave: string) => lista[[...chave].reduce((s, c) => s + c.charCodeAt(0), 0) % lista.length];

const SeloNivel: React.FC<{ nivel: Nivel; valor?: boolean }> = ({ nivel, valor }) => (
  <span className={NIVEIS[nivel].texto}>
    <span style={{ color: NIVEIS[nivel].pedra }} aria-hidden>◆ </span>{NIVEIS[nivel].rotulo}{valor && <span className="text-zinc-300"> · vale {pts(nivel)}</span>}
  </span>
);

/** progresso: uma pedra por pergunta (verde acertou, vermelha errou, branca a atual) */
const Pedras: React.FC<{ perguntas: Pergunta[]; atual?: number; deOutro?: boolean }> = ({ perguntas, atual, deOutro }) => (
  <div className="flex items-center justify-center gap-1.5" aria-hidden>
    {perguntas.map((p, i) => {
      const ok = deOutro ? p.outro_acertou : p.minha === null ? null : acertou(p);
      const cor = i === atual ? 'bg-white shadow-[0_0_10px_rgba(255,255,255,.8)]' : ok === null ? 'bg-white/15' : ok ? 'bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,.6)]' : 'bg-rose-500';
      return <span key={p.id} className={`h-2.5 w-2.5 rotate-45 rounded-[2px] transition-colors duration-300 ${cor} ${i === atual ? 'scale-125' : ''}`} />;
    })}
  </div>
);

export const QuizKamaSutra: React.FC<{
  jogo: JogoQuiz; aoAtualizar: (j: JogoQuiz) => void; aoFechar: () => void; aoRevanche: () => void; aoOutroJogo: () => void;
}> = ({ jogo, aoAtualizar, aoFechar, aoRevanche, aoOutroJogo }) => {
  // pergunta em tela: a primeira sem resposta (ou a que acabou de ser respondida, até tocar em "Próxima")
  // já respondeu tudo (reabriu o jogo enquanto a outra pessoa joga): vai direto para a espera
  const [atual, setAtual] = useState(() => {
    const pendente = jogo.perguntas.findIndex((q) => q.minha === null);
    return pendente === -1 ? jogo.total : pendente;
  });
  const [ocupado, setOcupado] = useState(false);
  const [som, alternarSom] = useSom();
  const [efeito, setEfeito] = useState<{ tipo: 'acerto' | 'erro'; chave: number; pontos: number } | null>(null);
  // a capa aparece uma vez por jogo, antes da primeira resposta
  const chaveCapa = `vybe-quiz-capa-${jogo.id}`;
  const [naCapa, setNaCapa] = useState(() => {
    if (jogo.status !== 'playing' || jogo.meus > 0) return false;
    try { return sessionStorage.getItem(chaveCapa) !== '1'; } catch { return true; }
  });
  const pontos = meusPontos(jogo);
  const seguidas = sequencia(jogo);

  if (jogo.status === 'done' && jogo.placar) return <Placar jogo={jogo} som={som} aoFechar={aoFechar} aoRevanche={aoRevanche} aoOutroJogo={aoOutroJogo} />;

  if (naCapa) {
    return (
      <Capa jogo={jogo} aoComecar={() => {
        try { sessionStorage.setItem(chaveCapa, '1'); } catch { /* sem armazenamento */ }
        setNaCapa(false);
      }} />
    );
  }

  const q = jogo.perguntas[atual];
  const respondida = !!q && q.minha !== null;

  const escolher = async (opcao: number) => {
    if (!q || respondida || ocupado) return;
    setOcupado(true);
    const r = await responderQuiz(jogo.id, q.id, opcao);
    setOcupado(false);
    if ('erro' in r) { notify(r.erro, 'error'); return; }
    const resp = r.perguntas.find((p) => p.id === q.id);
    const certo = !!resp && acertou(resp);
    setEfeito({ tipo: certo ? 'acerto' : 'erro', chave: Date.now(), pontos: q.nivel });
    if (som) tocar(certo ? 'acerto' : 'erro');
    vibrar(certo ? 'acerto' : 'erro');
    aoAtualizar(r);
  };
  const proxima = () => {
    setEfeito(null);
    const seguinte = jogo.perguntas.findIndex((p, i) => i > atual && p.minha === null);
    if (seguinte !== -1) setAtual(seguinte);
    else setAtual(jogo.total); // todas respondidas: vai para a espera
  };

  // todas respondidas e já saiu da última: espera a outra pessoa
  if (!q) {
    const meusAcertos = jogo.perguntas.filter(acertou).length;
    return (
      <div className="py-2 text-center">
        <Ampulheta className="mx-auto h-16 w-12" />
        <p className="mt-3 text-[13px] font-semibold uppercase tracking-wide text-amber-200/80">Sua parte está feita</p>
        <p className="mt-1 text-2xl font-extrabold">Você fez {pts(pontos)}</p>
        <p className="text-sm text-zinc-300">{meusAcertos} de {jogo.total} posições certas</p>
        <div className="mt-3"><Pedras perguntas={jogo.perguntas} /></div>
        <div className="mt-6 rounded-2xl border border-white/10 bg-white/[0.04] p-3">
          <div className="flex items-center gap-3">
            {jogo.outro.avatar
              ? <img src={jogo.outro.avatar} alt="" className="h-11 w-11 shrink-0 rounded-full object-cover ring-2 ring-amber-300/60 bg-zinc-800" />
              : <span className="h-11 w-11 shrink-0 rounded-full bg-white/10" aria-hidden />}
            <div className="min-w-0 flex-1 text-left">
              <p className="truncate text-sm font-bold">Vez de {jogo.outro.nome}</p>
              <p className="text-[12px] text-zinc-400">{jogo.dele} de {jogo.total} respondidas · o placar sai quando os dois terminarem</p>
            </div>
          </div>
          <div className="mt-3 h-2 rounded-full bg-white/10">
            <div className="h-2 rounded-full bg-gradient-to-r from-fuchsia-500 via-amber-400 to-amber-200 transition-[width] duration-700" style={{ width: `${(jogo.dele / jogo.total) * 100}%` }} />
          </div>
        </div>
        <p className="mt-3 flex items-center justify-center gap-1.5 text-[12px] text-zinc-500"><Clock className="h-3.5 w-3.5" />Avisamos você quando o resultado sair.</p>
        <button type="button" onClick={aoFechar} className="mt-5 min-h-[44px] w-full rounded-2xl fundo-neon font-bold cursor-pointer">Voltar à conversa</button>
      </div>
    );
  }

  const certa = q.certa;
  const acertouEsta = respondida && acertou(q);
  return (
    <>
      <div className="mb-2 flex items-center gap-2 text-[12px] text-zinc-400">
        <span className="tabular-nums">Pergunta <b className="text-white">{atual + 1}</b> de {jogo.total}</span>
        {seguidas >= 2 && (
          <span className="rounded-full bg-gradient-to-r from-orange-500/30 to-rose-500/30 px-2 py-0.5 text-[11px] font-bold text-orange-100 ring-1 ring-orange-300/40">🔥 {seguidas} seguidas</span>
        )}
        <span className="ml-auto tabular-nums">Pontos: <b className="text-amber-200">{pontos}</b></span>
        <button type="button" onClick={alternarSom} aria-pressed={som} aria-label={som ? 'Desligar sons do quiz' : 'Ligar sons do quiz'} title={som ? 'Sons ligados' : 'Sons desligados'}
          className="-mr-1 flex h-8 w-8 items-center justify-center rounded-full text-zinc-300 hover:bg-white/10 cursor-pointer">
          {som ? <Volume2 className="h-4 w-4" /> : <VolumeX className="h-4 w-4 text-zinc-500" />}
        </button>
      </div>
      <div className="mb-5"><Pedras perguntas={jogo.perguntas} atual={atual} /></div>

      <div key={q.id} className="carta-desejo relative">
        <div className={efeito?.tipo === 'erro' && respondida ? 'quiz-tremer' : ''}>
          <MolduraNivel nivel={q.nivel} selo={<SeloNivel nivel={q.nivel} valor />}
            className={`${efeito?.tipo === 'acerto' && respondida ? 'quiz-acerto rounded-[18px]' : ''}`}>
            <PictogramaPosicao id={q.id} cena="noite" titulo="Posição do quiz" className="block w-full" />
          </MolduraNivel>
        </div>
        {efeito?.tipo === 'acerto' && respondida && (
          <>
            <Confete disparo={efeito.chave} />
            <span key={efeito.chave} className="pontos-sobe pointer-events-none absolute left-1/2 top-6 z-20 rounded-full bg-emerald-400 px-3 py-1 text-sm font-extrabold text-black shadow-lg">
              +{pts(efeito.pontos)}
            </span>
          </>
        )}
      </div>
      <p className="mt-4 text-center text-lg font-extrabold">Qual é o nome desta posição?</p>

      <div className="mt-3 grid grid-cols-2 gap-2" role="group" aria-label="Opções">
        {q.opcoes.map((o, i) => {
          const eCerta = respondida && i === certa;
          const eMinhaErrada = respondida && i === q.minha && i !== certa;
          return (
            <button key={o.id} type="button" disabled={respondida || ocupado} onClick={() => void escolher(i)}
              style={{ animationDelay: `${i * 45}ms` }}
              className={`opcao-entra group min-h-[58px] rounded-2xl border px-2.5 text-left text-[14px] font-bold leading-tight flex items-center gap-2 transition-[transform,background-color,border-color] active:scale-95 cursor-pointer disabled:cursor-default ${
                eCerta ? 'border-emerald-300 bg-emerald-500 text-black shadow-[0_0_20px_-4px_rgba(52,211,153,.8)]'
                  : eMinhaErrada ? 'border-rose-400 bg-rose-600 text-white'
                    : respondida ? 'border-white/5 bg-white/[0.03] text-zinc-500'
                      : 'border-amber-200/20 bg-white/[0.07] text-white hover:border-amber-200/60 hover:bg-white/[0.12]'}`}>
              <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[12px] font-extrabold ${
                eCerta ? 'bg-black/20' : eMinhaErrada ? 'bg-black/25' : respondida ? 'bg-white/5' : 'bg-gradient-to-br from-amber-200 to-amber-500 text-[#2a1438]'}`}>
                {eCerta ? <Check className="h-4 w-4" strokeWidth={3} /> : eMinhaErrada ? <Errou className="h-4 w-4" strokeWidth={3} /> : LETRAS[i]}
              </span>
              <span className="min-w-0">{o.titulo}</span>
            </button>
          );
        })}
      </div>
      {respondida && (
        <div className="mt-4 text-center" aria-live="polite">
          <p className={`text-base font-extrabold ${acertouEsta ? 'text-emerald-300' : 'text-rose-200'}`}>
            {acertouEsta ? `${escolha(ELOGIOS, q.id)} +${pts(q.nivel)}` : `${escolha(CONSOLOS, q.id)} Era ${q.opcoes[certa ?? 0]?.titulo}.`}
          </p>
          <button type="button" onClick={proxima} className="mt-3 min-h-[48px] w-full rounded-2xl fundo-neon font-bold shadow-[0_10px_30px_-10px_rgba(236,72,153,.9)] cursor-pointer">
            {jogo.perguntas.some((p, i) => i > atual && p.minha === null) ? 'Próxima posição' : 'Ver como fui'}
          </button>
        </div>
      )}
    </>
  );
};

/** Capa: arte, quem desafiou quem e as regras em três linhas. */
const Capa: React.FC<{ jogo: JogoQuiz; aoComecar: () => void }> = ({ jogo, aoComecar }) => {
  const niveis = ([1, 2, 3] as Nivel[]).map((n) => ({ n, qtd: jogo.perguntas.filter((p) => p.nivel === n).length })).filter((x) => x.qtd > 0);
  return (
    <div className="text-center">
      <CapaQuiz className="w-full drop-shadow-[0_18px_30px_rgba(0,0,0,.45)]" />
      <h3 className="mt-4 bg-gradient-to-r from-amber-100 via-amber-300 to-amber-100 bg-clip-text text-2xl font-extrabold tracking-tight text-transparent">Quiz do Kama Sutra</h3>
      <p className="mt-1 text-sm text-zinc-300">
        {jogo.eu_desafiei ? <>Você desafiou <b className="text-white">{jogo.outro.nome}</b>.</> : <><b className="text-white">{jogo.outro.nome}</b> desafiou você.</>} Quem conhece mais?
      </p>
      <ul className="mt-4 space-y-2 text-left text-[13px]">
        <li className="flex items-start gap-3 rounded-2xl bg-white/[0.05] px-3 py-2.5">
          <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-amber-300/20 text-amber-200" aria-hidden><Sparkles className="h-3.5 w-3.5" /></span>
          <span><b>{jogo.total} posições</b> desenhadas. Para cada uma, escolha o nome certo entre 4.</span>
        </li>
        <li className="flex items-start gap-3 rounded-2xl bg-white/[0.05] px-3 py-2.5">
          <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-amber-300/20 text-amber-200" aria-hidden>◆</span>
          <span>
            Difíceis valem mais:{' '}
            {niveis.map(({ n, qtd }, i) => (
              <span key={n}>{i > 0 && ', '}<SeloNivel nivel={n} /> <span className="text-zinc-400">({qtd}× {pts(n)})</span></span>
            ))}
          </span>
        </li>
        <li className="flex items-start gap-3 rounded-2xl bg-white/[0.05] px-3 py-2.5">
          <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-amber-300/20 text-amber-200" aria-hidden><Trophy className="h-3.5 w-3.5" /></span>
          <span>Cada um joga no seu tempo. O placar só aparece quando <b>os dois</b> terminarem — e quem vencer escolhe a próxima 😏</span>
        </li>
      </ul>
      <button type="button" onClick={aoComecar} className="mt-5 min-h-[50px] w-full rounded-2xl fundo-neon text-[15px] font-extrabold shadow-[0_12px_32px_-10px_rgba(236,72,153,.9)] cursor-pointer">
        Começar o desafio
      </button>
    </div>
  );
};

const Placar: React.FC<{ jogo: JogoQuiz; som: boolean; aoFechar: () => void; aoRevanche: () => void; aoOutroJogo: () => void }> = ({ jogo, som, aoFechar, aoRevanche, aoOutroJogo }) => {
  const { eu, outro } = jogo.placar!;
  const venci = eu > outro, empate = eu === outro;
  const contaEu = useContagem(eu);
  const contaOutro = useContagem(outro);
  const [festa, setFesta] = useState(0);
  useEffect(() => {
    if (!(venci || empate)) return;
    const t = setTimeout(() => {
      setFesta(Date.now());
      if (som) tocar('vitoria');
    }, 450);
    return () => clearTimeout(t);
  }, [venci, empate, som]);

  const nome = jogo.outro.nome.split(' ')[0];
  const titulo = venci ? 'Você venceu!' : empate ? 'Empate!' : `${nome} venceu`;
  const frase = venci ? 'O prêmio: você escolhe a próxima posição 😏' : empate ? 'Desempate ao vivo? 🔥' : `${nome} escolhe a próxima posição… ou você pede revanche!`;
  const meusAcertos = jogo.perguntas.filter(acertou);
  const delesAcertos = jogo.perguntas.filter((p) => p.outro_acertou).length;
  // melhor jogada: a posição mais difícil que você acertou
  const melhor = [...meusAcertos].sort((a, b) => b.nivel - a.nivel)[0];

  return (
    <div>
      <div className="relative text-center">
        <Confete disparo={festa} quantidade={40} />
        <Medalha tipo={venci || empate ? 'ouro' : 'prata'} className="medalha-entra mx-auto h-24 w-20 drop-shadow-[0_10px_20px_rgba(233,185,73,.35)]" />
        <p className="mt-2 text-2xl font-extrabold">{titulo}</p>
        <div className="mt-3 flex items-center justify-center gap-4">
          <div className="min-w-[84px]">
            <p className={`text-4xl font-extrabold tabular-nums ${eu >= outro ? 'text-amber-200' : 'text-zinc-300'}`}>{contaEu}</p>
            <p className="text-[12px] text-zinc-400">você · {meusAcertos.length}/{jogo.total}</p>
          </div>
          <span className="text-xl font-bold text-zinc-600" aria-hidden>×</span>
          <div className="min-w-[84px]">
            <p className={`text-4xl font-extrabold tabular-nums ${outro >= eu ? 'text-amber-200' : 'text-zinc-300'}`}>{contaOutro}</p>
            <p className="truncate text-[12px] text-zinc-400">{nome} · {delesAcertos}/{jogo.total}</p>
          </div>
        </div>
        <p className="sr-only">Placar: você {eu} pontos, {jogo.outro.nome} {outro} pontos.</p>
        <p className="mt-3 text-sm text-zinc-200">{frase}</p>
      </div>

      {melhor && (
        <div className="mt-5 flex items-center gap-3 rounded-2xl border border-amber-200/25 bg-gradient-to-r from-amber-400/10 to-fuchsia-500/10 p-2.5">
          <MolduraNivel nivel={melhor.nivel} pequena className="w-24 shrink-0">
            <PictogramaPosicao id={melhor.id} cena="noite" titulo={melhor.opcoes[melhor.certa ?? 0]?.titulo} className="block w-full" />
          </MolduraNivel>
          <div className="min-w-0">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-amber-200/80">Sua melhor jogada</p>
            <p className="truncate text-[15px] font-extrabold">{melhor.opcoes[melhor.certa ?? 0]?.titulo}</p>
            <p className="text-[12px]"><SeloNivel nivel={melhor.nivel} /> <span className="text-zinc-400">· +{pts(melhor.nivel)}</span></p>
          </div>
        </div>
      )}

      <p className="mt-5 mb-3 text-[12px] font-semibold uppercase tracking-wide text-zinc-400">As {jogo.total} posições</p>
      <ul className="grid grid-cols-2 gap-x-3 gap-y-4">
        {jogo.perguntas.map((q) => (
          <li key={q.id}>
            <MolduraNivel nivel={q.nivel} pequena>
              <PictogramaPosicao id={q.id} cena="noite" titulo={q.opcoes[q.certa ?? 0]?.titulo} className="block w-full" />
            </MolduraNivel>
            <p className="mt-1.5 truncate text-center text-[12.5px] font-bold">{q.opcoes[q.certa ?? 0]?.titulo}</p>
            <p className="mt-0.5 flex justify-center gap-2 text-[11px] text-zinc-400">
              <span className={acertou(q) ? 'text-emerald-300' : 'text-rose-300'}>Você {acertou(q) ? '✓' : '✗'}</span>
              <span className={q.outro_acertou ? 'text-emerald-300' : 'text-rose-300'}>{nome} {q.outro_acertou ? '✓' : '✗'}</span>
            </p>
          </li>
        ))}
      </ul>
      <div className="mt-6 grid gap-2">
        <button type="button" onClick={aoFechar} className="min-h-[48px] rounded-2xl fundo-neon font-bold shadow-[0_10px_30px_-10px_rgba(236,72,153,.9)] cursor-pointer">Conversar sobre isso</button>
        <div className="grid grid-cols-2 gap-2">
          <button type="button" onClick={aoRevanche} className="min-h-[44px] rounded-2xl border border-amber-200/25 bg-white/[0.06] hover:bg-white/[0.12] text-sm font-semibold cursor-pointer">Revanche 🧠</button>
          <button type="button" onClick={aoOutroJogo} className="min-h-[44px] rounded-2xl bg-white/10 hover:bg-white/15 text-sm font-semibold cursor-pointer">Outro jogo</button>
        </div>
      </div>
    </div>
  );
};
