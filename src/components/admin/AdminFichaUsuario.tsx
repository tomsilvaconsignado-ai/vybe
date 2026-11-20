// Ficha completa do usuário no painel: conta, perfil, atividade, crescimento, denúncias e histórico.
// Registros de acesso (IP/aparelho) só para o superadmin, com justificativa auditada (Marco Civil, art. 15).
import React, { useEffect, useState } from 'react';
import { Lock, RefreshCw, ShieldCheck, ShieldAlert, Info } from 'lucide-react';
import {
  fetchFichaUsuario, fetchRegistrosAcesso, FichaUsuario, RegistrosAcesso,
  dataHora, dataCurta, haQuanto, aparelhoLegivel
} from '../../lib/adminDetalhes';
import { CATEGORIA_DENUNCIA, SITUACAO_DENUNCIA, TIPO_PERFIL, TOM, acaoLegivel } from '../../lib/adminRotulos';
import { notify } from '../common/Feedback';

const fmt = (n: number | null | undefined) => (n ?? 0).toLocaleString('pt-BR');

const Campo: React.FC<{ rotulo: string; children: React.ReactNode; destaque?: string }> = ({ rotulo, children, destaque }) => (
  <div className="min-w-0">
    <span className="text-[11px] text-zinc-500 font-semibold block">{rotulo}</span>
    <span className={`text-[13px] break-words ${destaque ?? 'text-zinc-200'}`}>{children}</span>
  </div>
);

const Bloco: React.FC<{ titulo: string; children: React.ReactNode; colunas?: string }> = ({ titulo, children, colunas = 'grid-cols-2 sm:grid-cols-3' }) => (
  <section className="p-4 bg-zinc-950/70 border border-purple-900/30 rounded-2xl space-y-3">
    <h4 className="text-xs font-bold text-white">{titulo}</h4>
    <div className={`grid ${colunas} gap-x-4 gap-y-3`}>{children}</div>
  </section>
);

const Numero: React.FC<{ rotulo: string; valor: number | undefined; detalhe?: string; alerta?: boolean }> = ({ rotulo, valor, detalhe, alerta }) => (
  <div className="min-w-0">
    <span className="text-[11px] text-zinc-500 font-semibold block leading-tight">{rotulo}</span>
    <span className={`text-lg font-black tabular-nums ${alerta && (valor ?? 0) > 0 ? 'text-rose-400' : 'text-white'}`}>{fmt(valor)}</span>
    {detalhe && <span className="block text-[11px] text-zinc-500">{detalhe}</span>}
  </div>
);

const simNao = (v: boolean) => (v ? 'Sim' : 'Não');

export const AdminFichaUsuario: React.FC<{ userId: string; username: string; isSuperadmin: boolean; onFicha?: (f: FichaUsuario) => void }> = ({ userId, username, isSuperadmin, onFicha }) => {
  const [ficha, setFicha] = useState<FichaUsuario | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [carregando, setCarregando] = useState(true);

  const [motivo, setMotivo] = useState('');
  const [registros, setRegistros] = useState<RegistrosAcesso | null>(null);
  const [abrindo, setAbrindo] = useState(false);

  const carregar = async () => {
    setCarregando(true);
    const { ficha: f, error } = await fetchFichaUsuario(userId);
    setFicha(f); setErro(error); setCarregando(false);
    if (f) onFicha?.(f);
  };
  useEffect(() => { setRegistros(null); setMotivo(''); carregar(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [userId]);

  const abrirRegistros = async () => {
    setAbrindo(true);
    const { registros: r, error } = await fetchRegistrosAcesso(userId, motivo.trim());
    setAbrindo(false);
    if (error) { notify(error, 'error'); return; }
    setRegistros(r);
  };

  if (erro) return <p className="p-4 rounded-2xl bg-rose-950/30 border border-rose-900/40 text-xs text-rose-300">Ficha indisponível: {erro}</p>;
  if (carregando || !ficha) return <div className="h-64 rounded-2xl bg-zinc-950/70 border border-purple-900/30 animate-pulse" aria-label="Carregando ficha" />;

  const { conta, perfil, crescimento: g, atividade: a, denuncias: d } = ficha;
  const diasConta = Math.max(1, Math.round((Date.now() - new Date(conta.cadastro_em).getTime()) / 86400000));
  const engaj = a.publicacoes ? ((a.curtidas_recebidas + a.comentarios_recebidos) / a.publicacoes) : 0;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <p className="text-[11px] text-zinc-500 flex items-center gap-1.5">
          <Info className="w-3.5 h-3.5 shrink-0" />
          Consulta registrada na auditoria ({fmt(ficha.consultas_da_ficha)} no total). Orientação, preferências íntimas e conteúdo de mensagens não aparecem aqui (LGPD, art. 11).
        </p>
        <button type="button" onClick={carregar} className="text-[12px] font-semibold text-zinc-400 hover:text-white flex items-center gap-1 cursor-pointer shrink-0">
          <RefreshCw className="w-3.5 h-3.5" /> Atualizar
        </button>
      </div>

      <Bloco titulo="Conta e cadastro">
        <Campo rotulo="E-mail">{conta.email ?? '—'}</Campo>
        <Campo rotulo="E-mail confirmado" destaque={conta.email_confirmado_em ? 'text-emerald-300' : 'text-amber-300'}>
          {conta.email_confirmado_em ? dataHora(conta.email_confirmado_em) : 'Não confirmado'}
        </Campo>
        <Campo rotulo="Cadastro">{dataHora(conta.cadastro_em)} <span className="text-zinc-500">({fmt(diasConta)} dias)</span></Campo>
        <Campo rotulo="Último login">{dataHora(conta.ultimo_login_em)}</Campo>
        <Campo rotulo="Último acesso ao app">{haQuanto(perfil.ultimo_acesso)}</Campo>
        <Campo rotulo="Forma de login">{conta.provedores.join(', ') || '—'}</Campo>
        <Campo rotulo="Nascimento">{conta.nascimento ? dataCurta(conta.nascimento) : 'Não informado'}</Campo>
        <Campo rotulo="Declarou maioridade">{dataHora(conta.maioridade_declarada_em)}</Campo>
        <Campo rotulo="Aceitou os termos">{dataHora(conta.termos_aceitos_em)}</Campo>
        <Campo rotulo="Cidade (privada)">{conta.cidade_privada ?? '—'}</Campo>
        <Campo rotulo="Verificação em 2 etapas" destaque={conta.mfa_ativo ? 'text-emerald-300' : 'text-zinc-400'}>{conta.mfa_ativo ? 'Ativa' : 'Não ativada'}</Campo>
        <Campo rotulo="Sessões abertas">{fmt(conta.sessoes_ativas)}</Campo>
        <Campo rotulo="Aparelhos com push">{fmt(conta.aparelhos_push)}</Campo>
        <Campo rotulo="Recebe comunicados por e-mail">{conta.descadastrado_email ? 'Não (saiu da lista)' : 'Sim'}</Campo>
      </Bloco>

      <Bloco titulo="Perfil">
        <Campo rotulo="Tipo de perfil">{TIPO_PERFIL[perfil.tipo as keyof typeof TIPO_PERFIL] ?? perfil.tipo}</Campo>
        <Campo rotulo="Gênero">{perfil.genero || 'Não informado'}</Campo>
        <Campo rotulo="Parceiros no perfil conjunto">{fmt(perfil.parceiros_conjuntos)}</Campo>
        <Campo rotulo="Foto de perfil">{simNao(perfil.tem_foto)}</Campo>
        <Campo rotulo="Modo discreto">{simNao(perfil.modo_discreto)}</Campo>
        <Campo rotulo="Mostra quando está online">{simNao(perfil.mostra_online)}</Campo>
        <Campo rotulo="Localização exibida">{perfil.privacidade_local === 'city' ? 'Cidade' : perfil.privacidade_local === 'hidden' ? 'Oculta' : 'Região aproximada'}</Campo>
        <Campo rotulo="Perfil atualizado">{haQuanto(perfil.atualizado_em)}</Campo>
        <Campo rotulo="Trocou o @">{perfil.username_alterado_em ? dataCurta(perfil.username_alterado_em) : 'Nunca'}</Campo>
        {perfil.status_texto && <div className="col-span-2 sm:col-span-3"><Campo rotulo="Status">{perfil.status_texto}</Campo></div>}
        {perfil.bio && <div className="col-span-2 sm:col-span-3"><Campo rotulo="Bio">{perfil.bio}</Campo></div>}
      </Bloco>

      <Bloco titulo="Publicações e engajamento" colunas="grid-cols-2 sm:grid-cols-4">
        <Numero rotulo="Publicações" valor={a.publicacoes} detalhe={`${fmt(a.publicacoes_7d)} em 7 dias · ${fmt(a.publicacoes_30d)} em 30`} />
        <Numero rotulo="Com foto ou vídeo" valor={a.publicacoes_com_midia} />
        <Numero rotulo="Curtidas recebidas" valor={a.curtidas_recebidas} detalhe={a.publicacoes ? `${engaj.toLocaleString('pt-BR', { maximumFractionDigits: 1 })} interações por publicação` : undefined} />
        <Numero rotulo="Comentários recebidos" valor={a.comentarios_recebidos} />
        <Numero rotulo="Salvamentos recebidos" valor={a.salvamentos_recebidos} />
        <Numero rotulo="Curtidas dadas" valor={a.curtidas_dadas} />
        <Numero rotulo="Comentários feitos" valor={a.comentarios_feitos} detalhe={`${fmt(a.comentarios_feitos_7d)} em 7 dias`} />
        <Numero rotulo="Stories" valor={a.stories} detalhe={`${fmt(a.stories_ativos)} no ar · ${fmt(a.visualizacoes_stories)} visualizações`} />
      </Bloco>

      <Bloco titulo="Relacionamentos e mensagens" colunas="grid-cols-2 sm:grid-cols-4">
        <Numero rotulo="Seguidores" valor={a.seguidores} />
        <Numero rotulo="Seguindo" valor={a.seguindo} />
        <Numero rotulo="Conexões" valor={a.conexoes} detalhe={`${fmt(a.conexoes_pendentes)} pendentes`} />
        <Numero rotulo="Conversas" valor={a.conversas} detalhe={`com ${fmt(a.pessoas_contatadas)} pessoas`} />
        <Numero rotulo="Mensagens enviadas" valor={a.mensagens_enviadas} detalhe={`${fmt(a.mensagens_enviadas_7d)} em 7 dias`} />
        <Numero rotulo="Bloqueou" valor={a.bloqueou} />
        <Numero rotulo="Bloqueado por" valor={a.bloqueado_por} alerta />
        <Numero rotulo="Notificações não lidas" valor={a.notificacoes_nao_lidas} />
      </Bloco>

      <Bloco titulo="Álbuns, eventos e comunidades" colunas="grid-cols-2 sm:grid-cols-4">
        <Numero rotulo="Álbuns" valor={a.albuns} detalhe={`${fmt(a.fotos_em_albuns)} fotos`} />
        <Numero rotulo="Acessos ao cofre liberados" valor={a.acessos_cofre_concedidos} />
        <Numero rotulo="Eventos criados" valor={a.eventos_criados} />
        <Numero rotulo="Eventos (vai / interesse)" valor={a.eventos_vai} detalhe={`${fmt(a.eventos_interesse)} com interesse`} />
        <Numero rotulo="Comunidades criadas" valor={a.comunidades_criadas} />
        <Numero rotulo="Comunidades em que participa" valor={a.comunidades_membro} />
        <Numero rotulo="Banido de comunidades" valor={a.banido_de_comunidades} alerta />
      </Bloco>

      <Bloco titulo="Crescimento e recompensas">
        <Campo rotulo="Fundador">{g.fundador_numero ? `Nº ${g.fundador_numero}` : 'Não'}</Campo>
        <Campo rotulo="Embaixador">{simNao(g.embaixador)}</Campo>
        <Campo rotulo="VIP" destaque={g.vip_ate && new Date(g.vip_ate) > new Date() ? 'text-amber-300' : undefined}>
          {g.vip_ate ? (new Date(g.vip_ate) > new Date() ? `Até ${dataCurta(g.vip_ate)}` : `Venceu em ${dataCurta(g.vip_ate)}`) : 'Não'}
        </Campo>
        <Campo rotulo="Destaque no Descobrir">{g.destaque_ate && new Date(g.destaque_ate) > new Date() ? `Até ${dataCurta(g.destaque_ate)}` : 'Não'}</Campo>
        <Campo rotulo="Selos">{g.selos.length ? g.selos.join(', ') : 'Nenhum'}</Campo>
        <Campo rotulo="Código de convite">{g.codigo_convite ?? '—'}</Campo>
        <Campo rotulo="Convidou">{fmt(g.convidou_total)} <span className="text-zinc-500">({fmt(g.convidou_validos)} válidos)</span></Campo>
        <Campo rotulo="Convidado por">{g.convidado_por ? `@${g.convidado_por}` : 'Ninguém'}</Campo>
        <Campo rotulo="Recompensas recebidas">{fmt(g.recompensas)}</Campo>
      </Bloco>

      <section className="p-4 bg-zinc-950/70 border border-purple-900/30 rounded-2xl space-y-3">
        <h4 className="text-xs font-bold text-white flex items-center gap-1.5"><ShieldAlert className="w-3.5 h-3.5 text-rose-400" /> Denúncias</h4>
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
          <Numero rotulo="Recebidas" valor={d.recebidas} alerta />
          <Numero rotulo="Abertas" valor={d.recebidas_abertas} alerta />
          <Numero rotulo="Procedentes" valor={d.recebidas_procedentes} alerta />
          <Numero rotulo="Feitas por ele(a)" valor={d.feitas} />
          <Numero rotulo="Feitas e arquivadas" valor={d.feitas_arquivadas} detalhe="possível denúncia sem fundamento" />
        </div>
        {Object.keys(d.por_categoria).length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {Object.entries(d.por_categoria).map(([c, n]) => (
              <span key={c} className={`text-[11px] px-2 py-0.5 rounded-full ${TOM.perigo}`}>{CATEGORIA_DENUNCIA[c as keyof typeof CATEGORIA_DENUNCIA] ?? c}: {n}</span>
            ))}
          </div>
        )}
        {d.ultimas.length > 0 && (
          <ul className="space-y-1.5">
            {d.ultimas.map((r, i) => (
              <li key={i} className="p-2.5 rounded-xl bg-zinc-900/60 border border-zinc-800 text-[12px]">
                <div className="flex flex-wrap items-center gap-2 text-zinc-400">
                  <span className="font-semibold text-zinc-200">{CATEGORIA_DENUNCIA[r.categoria as keyof typeof CATEGORIA_DENUNCIA] ?? r.categoria}</span>
                  <span>{SITUACAO_DENUNCIA[r.status as keyof typeof SITUACAO_DENUNCIA] ?? r.status}</span>
                  <span>{dataHora(r.criada_em)}</span>
                  {r.denunciante && <span>por @{r.denunciante}</span>}
                </div>
                <p className="text-zinc-300 mt-1">{r.descricao}</p>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="p-4 bg-zinc-950/70 border border-purple-900/30 rounded-2xl space-y-2">
        <h4 className="text-xs font-bold text-white">Histórico de moderação</h4>
        {ficha.historico_moderacao.length === 0 ? (
          <p className="text-[12px] text-zinc-500">Nenhuma ação da equipe sobre esta conta.</p>
        ) : (
          <ul className="space-y-1.5">
            {ficha.historico_moderacao.map((h, i) => (
              <li key={i} className="text-[12px] flex flex-col sm:flex-row sm:items-baseline gap-x-2 border-b border-zinc-900 pb-1.5">
                <span className="text-zinc-500 tabular-nums shrink-0">{dataHora(h.em)}</span>
                <span className="font-semibold text-purple-300 shrink-0">{acaoLegivel(h.acao)}</span>
                <span className="text-zinc-300 min-w-0">{h.motivo} <span className="text-zinc-500">— {h.por ?? 'Equipe'}</span></span>
              </li>
            ))}
          </ul>
        )}
      </section>

      {isSuperadmin && (
        <section className="p-4 bg-amber-950/20 border border-amber-900/40 rounded-2xl space-y-3">
          <h4 className="text-xs font-bold text-amber-300 flex items-center gap-1.5"><Lock className="w-3.5 h-3.5" /> Registros de acesso (IP e aparelho)</h4>
          {!registros ? (
            <>
              <p className="text-[12px] text-zinc-400">
                Guardados por exigência do Marco Civil da Internet (art. 15) e sigilosos. Use só para segurança, fraude ou ordem judicial. Informe o motivo — fica no livro de auditoria.
              </p>
              <div className="flex gap-2">
                <input
                  type="text" value={motivo} onChange={e => setMotivo(e.target.value)}
                  placeholder="Ex.: suspeita de contas múltiplas da mesma pessoa"
                  className="flex-1 min-w-0 px-3 py-2 bg-zinc-900 border border-zinc-800 rounded-xl text-xs text-white focus:outline-none focus:border-amber-500"
                />
                <button type="button" onClick={abrirRegistros} disabled={motivo.trim().length < 10 || abrindo}
                  className="px-3 rounded-xl bg-amber-600 hover:bg-amber-500 text-white text-xs font-bold disabled:opacity-40 cursor-pointer">
                  {abrindo ? '...' : 'Abrir'}
                </button>
              </div>
            </>
          ) : (
            <>
              <p className="text-[12px] text-zinc-400">{fmt(registros.ips_distintos)} IP(s) diferentes nas sessões de @{username}.</p>
              {registros.sessoes.length === 0 ? <p className="text-[12px] text-zinc-500">Nenhuma sessão registrada.</p> : (
                <div className="overflow-x-auto">
                  <table className="w-full text-[12px] text-left">
                    <thead className="text-zinc-500">
                      <tr><th className="py-1 pr-3 font-semibold">Início</th><th className="py-1 pr-3 font-semibold">Última atividade</th><th className="py-1 pr-3 font-semibold">IP</th><th className="py-1 pr-3 font-semibold">Aparelho</th><th className="py-1 font-semibold">Situação</th></tr>
                    </thead>
                    <tbody className="text-zinc-300">
                      {registros.sessoes.map((s, i) => (
                        <tr key={i} className="border-t border-zinc-900">
                          <td className="py-1.5 pr-3 tabular-nums whitespace-nowrap">{dataHora(s.inicio)}</td>
                          <td className="py-1.5 pr-3 tabular-nums whitespace-nowrap">{dataHora(s.ultima_atividade)}</td>
                          <td className="py-1.5 pr-3 font-mono">{s.ip ?? '—'}</td>
                          <td className="py-1.5 pr-3" title={s.aparelho ?? ''}>{aparelhoLegivel(s.aparelho)}</td>
                          <td className="py-1.5 whitespace-nowrap">
                            {s.ativa ? 'Aberta' : 'Encerrada'}
                            {s.nivel === 'aal2' && <ShieldCheck className="inline w-3.5 h-3.5 ml-1 text-emerald-400" aria-label="com verificação em 2 etapas" />}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </>
          )}
        </section>
      )}
    </div>
  );
};
