// Página da comunidade (/comunidades/<id>): publicações, regras, membros e, para a moderação,
// pedidos para entrar, banimentos e edição.
import React, { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, Ban, Crown, ImagePlus, Lock, LogOut, Pencil, Send, Share2, Shield, ShieldCheck, Trash2, UserMinus, UserPlus, Users, X } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { PostCard } from '../feed/PostCard';
import { CommunityFormModal } from './CommunityFormModal';
import { ConvidarPessoas } from '../common/ConvidarPessoas';
import { askConfirm, askText, notify } from '../common/Feedback';
import { uploadPublicMedia } from '../../lib/supabase';
import { fetchPost } from '../../lib/social';
import {
  ACCESS_INFO, cancelCommunityRequest, declineCommunityInvite, deleteCommunity, fetchCommunityBans, fetchCommunityMembers,
  fetchCommunityPosts, fetchCommunityRequests, insertCommunityPost, inviteToCommunity, removeCommunityMember,
  reviewCommunityRequest, setCommunityRole, unbanCommunityMember, type PessoaDaComunidade
} from '../../lib/comunidades';
import type { Community, CommunityRole } from '../../types';
import { comConvite } from '../../lib/convite';
import { linkDaComunidade } from '../../lib/rotas';
import { compartilharComImagem } from '../../lib/compartilhar';
import { meuCodigo } from '../../lib/crescimento';
import { Seletor } from '../common/Seletor';

type Aba = 'posts' | 'sobre' | 'membros' | 'pedidos';
const PAPEL: Record<CommunityRole, string> = { admin: 'Administrador', moderator: 'Moderador', member: 'Membro' };

export const CommunityPage: React.FC<{ community: Community; aoVoltar: () => void }> = ({ community: c, aoVoltar }) => {
  const { currentUser, postCache, cachePosts, toggleJoinCommunity, refreshCommunities, setSelectedProfileId, deletePost } = useApp();
  const [aba, setAba] = useState<Aba>('posts');
  const [postIds, setPostIds] = useState<string[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [temMais, setTemMais] = useState(false);
  const [membros, setMembros] = useState<PessoaDaComunidade[]>([]);
  const [pedidos, setPedidos] = useState<PessoaDaComunidade[]>([]);
  const [banidos, setBanidos] = useState<PessoaDaComunidade[]>([]);
  const [editando, setEditando] = useState(false);
  const [convidando, setConvidando] = useState(false);
  const [texto, setTexto] = useState('');
  const [foto, setFoto] = useState<{ file: File; preview: string } | null>(null);
  const [publicando, setPublicando] = useState(false);

  const souMod = c.myRole === 'admin' || c.myRole === 'moderator';
  const podeVer = c.isJoined || c.access === 'public';
  const podeConvidar = c.isJoined && (c.access === 'public' || souMod);

  const carregarPosts = async (antes?: string) => {
    const lista = await fetchCommunityPosts(c.id, currentUser.id, antes);
    cachePosts(lista);
    setPostIds(prev => (antes ? [...prev, ...lista.map(p => p.id).filter(id => !prev.includes(id))] : lista.map(p => p.id)));
    setTemMais(lista.length >= 20);
    setCarregando(false);
  };
  const carregarGestao = async () => {
    if (!c.isJoined) { setMembros([]); return; }
    setMembros(await fetchCommunityMembers(c.id));
    if (souMod) {
      const [p, b] = await Promise.all([fetchCommunityRequests(c.id), fetchCommunityBans(c.id)]);
      setPedidos(p); setBanidos(b);
    }
  };

  useEffect(() => {
    setCarregando(true);
    if (podeVer) carregarPosts(); else { setPostIds([]); setCarregando(false); }
    carregarGestao();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [c.id, c.isJoined, c.myRole]);

  const posts = useMemo(() => postIds.map(id => postCache[id]).filter(Boolean), [postIds, postCache]);

  const publicar = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!texto.trim() && !foto) return;
    setPublicando(true);
    let urls: string[] = [];
    if (foto) {
      const ext = foto.file.type === 'image/png' ? 'png' : foto.file.type === 'image/webp' ? 'webp' : 'jpg';
      const { publicUrl, error } = await uploadPublicMedia(foto.file, `${currentUser.id}/${crypto.randomUUID()}.${ext}`);
      if (error || !publicUrl) { notify('Não foi possível enviar a foto.'); setPublicando(false); return; }
      urls = [publicUrl];
    }
    const { postId, error } = await insertCommunityPost(currentUser.id, c.id, texto.trim(), urls);
    setPublicando(false);
    if (error || !postId) { notify(error ?? 'Não foi possível publicar.'); return; }
    const novo = await fetchPost(postId, currentUser.id);
    if (novo) { cachePosts([novo]); setPostIds(prev => [novo.id, ...prev]); }
    setTexto(''); setFoto(null);
  };

  const escolherFoto = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) { notify('Use uma foto JPG, PNG ou WebP.'); return; }
    if (file.size > 15 * 1024 * 1024) { notify('A foto pode ter no máximo 15 MB.'); return; }
    setFoto({ file, preview: URL.createObjectURL(file) });
  };

  const compartilhar = async () => {
    const url = comConvite(linkDaComunidade(location.origin, c.id), await meuCodigo(currentUser.id));
    const r = await compartilharComImagem({ titulo: c.name, texto: `Participe da comunidade ${c.name} no Vybelog:`, url });
    if (r === 'copiado') notify('Link copiado!');
  };

  const sair = async () => {
    const aviso = c.myRole === 'admin' ? ' Se você for o único administrador, o moderador (ou membro) mais antigo assume.' : '';
    if (!(await askConfirm({ title: 'Sair da comunidade?', message: `Você deixa de ver as publicações fechadas.${aviso}`, confirmLabel: 'Sair', danger: true }))) return;
    await toggleJoinCommunity(c.id);
  };

  const entrar = async () => {
    if (c.access === 'approval' && !c.invited) {
      const mensagem = await askText({ title: 'Pedir para entrar', message: 'Conte em poucas palavras por que quer participar (opcional).', placeholder: 'Mensagem para a moderação', confirmLabel: 'Enviar pedido' });
      if (mensagem === null) return;
      await toggleJoinCommunity(c.id, mensagem);
    } else await toggleJoinCommunity(c.id);
  };

  const excluir = async () => {
    if (!(await askConfirm({ title: 'Excluir comunidade?', message: 'Todas as publicações dela serão apagadas. Não dá para desfazer.', confirmLabel: 'Excluir', danger: true }))) return;
    const error = await deleteCommunity(c.id);
    if (error) { notify(error); return; }
    notify('Comunidade excluída.');
    aoVoltar();
    refreshCommunities();
  };

  const acaoMembro = async (m: PessoaDaComunidade, acao: 'mod' | 'admin' | 'membro' | 'remover' | 'banir') => {
    let error: string | null = null;
    if (acao === 'remover' || acao === 'banir') {
      const motivo = acao === 'banir'
        ? await askText({ title: `Banir ${m.displayName}?`, message: 'A pessoa sai e não consegue voltar. O motivo fica só para a moderação.', placeholder: 'Motivo (opcional)', confirmLabel: 'Banir' })
        : (await askConfirm({ title: `Remover ${m.displayName}?`, message: 'A pessoa sai da comunidade, mas pode pedir para voltar.', confirmLabel: 'Remover', danger: true })) ? '' : null;
      if (motivo === null) return;
      error = await removeCommunityMember(c.id, m.userId, acao === 'banir', motivo);
    } else {
      error = await setCommunityRole(c.id, m.userId, acao === 'mod' ? 'moderator' : acao === 'admin' ? 'admin' : 'member');
    }
    if (error) notify(error);
    await carregarGestao();
    refreshCommunities();
  };

  const responder = async (m: PessoaDaComunidade, aprovar: boolean) => {
    const error = await reviewCommunityRequest(c.id, m.userId, aprovar);
    if (error) notify(error);
    else notify(aprovar ? `${m.displayName} agora participa.` : 'Pedido recusado.');
    await carregarGestao();
    refreshCommunities();
  };

  const abas: { id: Aba; label: string; mostrar: boolean }[] = [
    { id: 'posts', label: 'Publicações', mostrar: true },
    { id: 'sobre', label: 'Sobre e regras', mostrar: true },
    { id: 'membros', label: `Membros (${c.membersCount})`, mostrar: c.isJoined },
    { id: 'pedidos', label: `Pedidos${pedidos.length ? ` (${pedidos.length})` : ''}`, mostrar: souMod && c.access !== 'public' }
  ];

  const Pessoa: React.FC<{ p: PessoaDaComunidade; children?: React.ReactNode }> = ({ p, children }) => (
    <li className="flex items-center gap-3 p-3">
      <button type="button" onClick={() => setSelectedProfileId(p.userId)} className="flex items-center gap-3 flex-1 min-w-0 text-left cursor-pointer">
        <img src={p.avatarUrl} alt="" className="w-10 h-10 rounded-full object-cover bg-zinc-800" />
        <span className="min-w-0">
          <span className="flex items-center gap-1 text-xs font-bold text-zinc-100 truncate">
            {p.displayName}{p.isVerified && <ShieldCheck className="w-3.5 h-3.5 text-sky-400" />}
          </span>
          <span className="block text-[12px] text-zinc-500 truncate">@{p.username}{p.role && p.role !== 'member' ? ` · ${PAPEL[p.role]}` : ''}</span>
          {p.note && <span className="block text-[12px] text-zinc-400 italic truncate">“{p.note}”</span>}
        </span>
      </button>
      {children}
    </li>
  );
  const botao = 'px-2.5 py-1.5 rounded-lg text-[12px] font-bold cursor-pointer';

  return (
    <div className="max-w-3xl mx-auto md:py-6 md:px-4 pb-10">
      {/* Capa e cabeçalho */}
      <div className="relative h-40 sm:h-52 md:rounded-t-3xl overflow-hidden bg-gradient-to-br from-purple-900 via-fuchsia-900 to-rose-900">
        {c.coverUrl && <img src={c.coverUrl} alt="" className="w-full h-full object-cover" />}
        <div className="absolute inset-0 bg-gradient-to-t from-painel-baixo via-black/20 to-transparent" />
        <button type="button" onClick={aoVoltar} className="absolute top-3 left-3 p-2 rounded-full bg-black/50 backdrop-blur text-white cursor-pointer" aria-label="Voltar para comunidades">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <button type="button" onClick={compartilhar} className="absolute top-3 right-3 p-2 rounded-full bg-black/50 backdrop-blur text-white cursor-pointer" aria-label="Compartilhar comunidade">
          <Share2 className="w-5 h-5" />
        </button>
      </div>
      <div className="px-4 -mt-10 relative">
        <div className="flex items-end gap-3">
          <div className="w-16 h-16 rounded-2xl bg-painel border border-purple-700/50 flex items-center justify-center text-3xl shadow-xl">{c.iconUrl}</div>
          <div className="flex-1 min-w-0 pb-1">
            <h1 className="text-xl font-extrabold text-white leading-tight">{c.name}</h1>
            <p className="text-[12px] text-zinc-400 flex items-center gap-1.5 flex-wrap">
              {c.access !== 'public' && <Lock className="w-3 h-3" />} {ACCESS_INFO[c.access].label}
              <span>·</span><Users className="w-3 h-3" /> {c.membersCount} {c.membersCount === 1 ? 'membro' : 'membros'}
              <span>·</span>{c.postsCount} publicações
              {c.myRole && c.myRole !== 'member' && <><span>·</span><span className="text-fuchsia-300 font-semibold">{PAPEL[c.myRole]}</span></>}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap gap-2 mt-4">
          {c.isJoined ? (
            <button type="button" onClick={sair} className="px-4 py-2 rounded-xl text-xs font-bold bg-zinc-800 text-zinc-300 border border-zinc-700 flex items-center gap-1.5 cursor-pointer">
              <LogOut className="w-3.5 h-3.5" /> Sair
            </button>
          ) : c.requested ? (
            <button type="button" onClick={async () => { await cancelCommunityRequest(c.id); refreshCommunities(); }} className="px-4 py-2 rounded-xl text-xs font-bold bg-zinc-800 text-zinc-300 border border-zinc-700 cursor-pointer">
              Pedido enviado · Cancelar
            </button>
          ) : (
            <>
              <button type="button" onClick={entrar} className="px-5 py-2 rounded-xl text-xs font-bold bg-gradient-to-r from-fuchsia-600 via-pink-600 to-orange-600 text-white shadow-md cursor-pointer">
                {c.invited ? 'Aceitar convite' : c.access === 'approval' ? 'Pedir para entrar' : 'Participar'}
              </button>
              {c.invited && (
                <button type="button" onClick={async () => { await declineCommunityInvite(c.id); refreshCommunities(); aoVoltar(); }} className="px-4 py-2 rounded-xl text-xs font-bold bg-zinc-800 text-zinc-300 border border-zinc-700 cursor-pointer">
                  Recusar
                </button>
              )}
            </>
          )}
          {podeConvidar && (
            <button type="button" onClick={() => setConvidando(true)} className="px-4 py-2 rounded-xl text-xs font-bold bg-zinc-900 text-zinc-200 border border-purple-900/40 flex items-center gap-1.5 cursor-pointer">
              <UserPlus className="w-3.5 h-3.5" /> Convidar
            </button>
          )}
          {c.myRole === 'admin' && (
            <button type="button" onClick={() => setEditando(true)} className="px-4 py-2 rounded-xl text-xs font-bold bg-zinc-900 text-zinc-200 border border-purple-900/40 flex items-center gap-1.5 cursor-pointer">
              <Pencil className="w-3.5 h-3.5" /> Editar
            </button>
          )}
        </div>

        {/* Abas */}
        <div className="flex gap-1 mt-5 border-b border-purple-900/30 overflow-x-auto no-scrollbar" role="tablist">
          {abas.filter(a => a.mostrar).map(a => (
            <button key={a.id} type="button" role="tab" aria-selected={aba === a.id} onClick={() => setAba(a.id)}
              className={`px-3.5 py-2.5 text-xs font-bold whitespace-nowrap border-b-2 -mb-px cursor-pointer ${aba === a.id ? 'border-fuchsia-500 text-white' : 'border-transparent text-zinc-500 hover:text-zinc-300'}`}>
              {a.label}
            </button>
          ))}
        </div>
      </div>

      <div className="px-0 sm:px-4 mt-4">
        {aba === 'posts' && (
          <div className="space-y-4">
            {c.isJoined && (
              <form onSubmit={publicar} className="mx-4 sm:mx-0 p-3 rounded-2xl bg-painel border border-purple-900/30 space-y-2">
                <textarea value={texto} onChange={e => setTexto(e.target.value)} rows={2} maxLength={5000} placeholder={`Escreva para ${c.name}…`}
                  className="w-full bg-transparent text-sm text-zinc-100 placeholder-zinc-500 resize-none focus:outline-none" aria-label="Nova publicação na comunidade" />
                {foto && (
                  <div className="relative w-fit">
                    <img src={foto.preview} alt="Foto a publicar" className="h-24 rounded-xl object-cover" />
                    <button type="button" onClick={() => setFoto(null)} className="absolute -top-2 -right-2 p-1 rounded-full bg-black text-white cursor-pointer" aria-label="Remover foto"><X className="w-3.5 h-3.5" /></button>
                  </div>
                )}
                <div className="flex items-center justify-between">
                  <label className="p-2 rounded-xl text-zinc-400 hover:text-fuchsia-300 cursor-pointer" aria-label="Adicionar foto">
                    <ImagePlus className="w-5 h-5" />
                    <input type="file" accept="image/jpeg,image/png,image/webp" onChange={escolherFoto} className="hidden" />
                  </label>
                  <button type="submit" disabled={publicando || (!texto.trim() && !foto)} className="px-4 py-2 rounded-xl bg-gradient-to-r from-fuchsia-600 via-pink-600 to-orange-600 text-white text-xs font-bold flex items-center gap-1.5 disabled:opacity-40 cursor-pointer">
                    <Send className="w-3.5 h-3.5" /> {publicando ? 'Publicando…' : 'Publicar'}
                  </button>
                </div>
              </form>
            )}
            {!podeVer ? (
              <div className="mx-4 sm:mx-0 p-8 text-center rounded-3xl bg-painel border border-purple-900/30">
                <Lock className="w-10 h-10 text-purple-400 mx-auto mb-2 opacity-70" />
                <p className="text-sm font-bold text-white">Publicações só para membros</p>
                <p className="text-xs text-zinc-400 mt-1">{c.requested ? 'Seu pedido está com a moderação.' : 'Peça para entrar e aguarde a aprovação.'}</p>
              </div>
            ) : carregando ? (
              <div className="py-12 flex justify-center"><div className="w-7 h-7 rounded-full border-2 border-purple-500 border-t-transparent animate-spin" /></div>
            ) : posts.length === 0 ? (
              <p className="py-10 text-center text-xs text-zinc-500">Nenhuma publicação ainda.{c.isJoined ? ' Comece a conversa!' : ''}</p>
            ) : (
              <>
                {posts.map(p => (
                  <div key={p.id}>
                    <PostCard post={p} />
                    {souMod && p.userId !== currentUser.id && (
                      <button type="button" onClick={async () => {
                        if (!(await askConfirm({ title: 'Remover publicação?', message: 'Ela sai da comunidade para todos.', confirmLabel: 'Remover', danger: true }))) return;
                        await deletePost(p.id);
                        setPostIds(prev => prev.filter(id => id !== p.id));
                      }} className="mx-4 sm:mx-0 -mt-2 mb-2 text-[12px] font-semibold text-rose-400 flex items-center gap-1 cursor-pointer">
                        <Trash2 className="w-3 h-3" /> Remover (moderação)
                      </button>
                    )}
                  </div>
                ))}
                {temMais && (
                  <button type="button" onClick={() => carregarPosts(posts[posts.length - 1]?.createdAtIso)} className="block mx-auto px-4 py-2 rounded-xl text-xs font-bold text-zinc-300 bg-zinc-900 border border-zinc-800 cursor-pointer">
                    Ver mais
                  </button>
                )}
              </>
            )}
          </div>
        )}

        {aba === 'sobre' && (
          <div className="mx-4 sm:mx-0 space-y-4">
            <p className="text-sm text-zinc-300 whitespace-pre-line leading-relaxed">{c.description}</p>
            <p className="text-[12px] text-zinc-500">{ACCESS_INFO[c.access].help}</p>
            {c.rules.length > 0 && (
              <div className="p-4 rounded-2xl bg-zinc-950/60 border border-purple-900/20">
                <h2 className="text-[12px] font-bold text-purple-300 uppercase tracking-wider mb-2">Regras da comunidade</h2>
                <ol className="space-y-1.5 text-xs text-zinc-300 list-decimal list-inside">
                  {c.rules.map((r, i) => <li key={i}>{r}</li>)}
                </ol>
              </div>
            )}
            {c.myRole === 'admin' && (
              <button type="button" onClick={excluir} className="text-xs font-semibold text-rose-400 flex items-center gap-1.5 cursor-pointer">
                <Trash2 className="w-3.5 h-3.5" /> Excluir comunidade
              </button>
            )}
          </div>
        )}

        {aba === 'membros' && (
          <ul className="mx-4 sm:mx-0 rounded-2xl bg-painel border border-purple-900/30 divide-y divide-purple-950/40">
            {membros.map(m => (
              <Pessoa key={m.userId} p={m}>
                {m.role === 'admin' && <Crown className="w-4 h-4 text-amber-300" aria-label="Administrador" />}
                {m.role === 'moderator' && <Shield className="w-4 h-4 text-sky-300" aria-label="Moderador" />}
                {m.userId !== currentUser.id && c.myRole === 'admin' && (
                  <Seletor aria-label={`Ações para ${m.displayName}`} value="" onChange={e => acaoMembro(m, e.target.value as 'mod')}
                    className="bg-zinc-900 border border-zinc-800 rounded-lg text-[12px] text-zinc-300 px-1.5 py-1 cursor-pointer">
                    <option value="">Gerenciar</option>
                    {m.role !== 'admin' && <option value="admin">Tornar administrador</option>}
                    {m.role !== 'moderator' && <option value="mod">Tornar moderador</option>}
                    {m.role !== 'member' && <option value="membro">Tornar membro</option>}
                    {m.role !== 'admin' && <option value="remover">Remover</option>}
                    {m.role !== 'admin' && <option value="banir">Banir</option>}
                  </Seletor>
                )}
                {m.userId !== currentUser.id && c.myRole === 'moderator' && m.role === 'member' && (
                  <>
                    <button type="button" onClick={() => acaoMembro(m, 'remover')} className={`${botao} bg-zinc-900 text-zinc-300`} aria-label={`Remover ${m.displayName}`}><UserMinus className="w-3.5 h-3.5" /></button>
                    <button type="button" onClick={() => acaoMembro(m, 'banir')} className={`${botao} bg-zinc-900 text-rose-300`} aria-label={`Banir ${m.displayName}`}><Ban className="w-3.5 h-3.5" /></button>
                  </>
                )}
              </Pessoa>
            ))}
          </ul>
        )}

        {aba === 'pedidos' && (
          <div className="mx-4 sm:mx-0 space-y-4">
            {pedidos.length === 0 ? <p className="py-8 text-center text-xs text-zinc-500">Nenhum pedido pendente.</p> : (
              <ul className="rounded-2xl bg-painel border border-purple-900/30 divide-y divide-purple-950/40">
                {pedidos.map(p => (
                  <Pessoa key={p.userId} p={p}>
                    <button type="button" onClick={() => responder(p, true)} className={`${botao} bg-purple-600 text-white`}>Aprovar</button>
                    <button type="button" onClick={() => responder(p, false)} className={`${botao} bg-zinc-900 text-zinc-300`}>Recusar</button>
                  </Pessoa>
                ))}
              </ul>
            )}
            {banidos.length > 0 && (
              <div>
                <h2 className="text-[12px] font-bold text-zinc-400 uppercase tracking-wider mb-2">Banidos</h2>
                <ul className="rounded-2xl bg-painel border border-purple-900/30 divide-y divide-purple-950/40">
                  {banidos.map(b => (
                    <Pessoa key={b.userId} p={b}>
                      <button type="button" onClick={async () => { const e = await unbanCommunityMember(c.id, b.userId); if (e) notify(e); carregarGestao(); }} className={`${botao} bg-zinc-900 text-zinc-300`}>Desfazer</button>
                    </Pessoa>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}
      </div>

      {editando && <CommunityFormModal community={c} aoFechar={() => setEditando(false)} aoSalvar={() => { setEditando(false); refreshCommunities(); }} />}
      {convidando && (
        <ConvidarPessoas
          titulo={`Convidar para ${c.name}`}
          ajuda={c.access === 'private' ? 'Só quem for convidado consegue encontrar esta comunidade.' : undefined}
          excluir={membros.map(m => m.userId)}
          limite={30}
          aoFechar={() => setConvidando(false)}
          aoConvidar={async ids => {
            const erros = (await Promise.all(ids.map(id => inviteToCommunity(c.id, id)))).filter(Boolean);
            const enviados = ids.length - erros.length;
            if (enviados) notify(`${enviados} ${enviados === 1 ? 'convite enviado' : 'convites enviados'}.`);
            if (erros.length) notify(erros[0]!);
          }}
        />
      )}
    </div>
  );
};
