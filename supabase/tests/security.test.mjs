// Executa supabase/setup.sql num Postgres real (PGlite, em memória) com stubs mínimos
// dos schemas auth/storage do Supabase e testa as regras de segurança agindo como
// usuários (papel authenticated + JWT), inclusive tentativas de ataque.
//
//   npm install --no-save @electric-sql/pglite@0.2.17
//   npm run test:db
//
// Opcional: um segundo argumento com um setup.sql antigo testa a migração por cima dele
// (ex.: git show HEAD~1:supabase/setup.sql > /tmp/old.sql).
import { PGlite } from '@electric-sql/pglite';
import fs from 'fs';

const setup = fs.readFileSync(process.argv[2] ?? new URL('../setup.sql', import.meta.url), 'utf8');
const db = new PGlite();

const stubs = `
CREATE ROLE anon NOLOGIN; CREATE ROLE authenticated NOLOGIN; CREATE ROLE service_role NOLOGIN;
GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;
CREATE SCHEMA auth; GRANT USAGE ON SCHEMA auth TO anon, authenticated;
CREATE TABLE auth.users (id uuid PRIMARY KEY, email text, raw_user_meta_data jsonb, email_confirmed_at timestamptz);
CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
CREATE FUNCTION auth.jwt() RETURNS jsonb LANGUAGE sql STABLE AS $$ SELECT coalesce(nullif(current_setting('request.jwt.claims', true), ''), '{}')::jsonb $$;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA auth TO anon, authenticated;
CREATE SCHEMA storage; GRANT USAGE ON SCHEMA storage TO anon, authenticated;
CREATE TABLE storage.buckets (id text PRIMARY KEY, name text, public boolean, file_size_limit bigint, allowed_mime_types text[]);
CREATE TABLE storage.objects (id uuid DEFAULT gen_random_uuid() PRIMARY KEY, bucket_id text, name text, owner uuid);
ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE, DELETE ON storage.objects TO anon, authenticated;
CREATE FUNCTION storage.foldername(name text) RETURNS text[] LANGUAGE sql IMMUTABLE AS $$
  SELECT (string_to_array(name, '/'))[1:array_length(string_to_array(name, '/'), 1) - 1] $$;
GRANT EXECUTE ON FUNCTION storage.foldername(text) TO anon, authenticated;
CREATE PUBLICATION supabase_realtime;
`;

const ids = {
  admin: '00000000-0000-0000-0000-00000000000a',
  a: '00000000-0000-0000-0000-000000000001',
  b: '00000000-0000-0000-0000-000000000002',
  v: '00000000-0000-0000-0000-000000000003',
  mod: '00000000-0000-0000-0000-000000000004',
};

let failures = 0;
const ok = (msg) => console.log('  ✔', msg);
const bad = (msg) => { failures++; console.log('  ✘', msg); };

async function as(uid, sql, params = [], aal = 'aal1') {
  await db.exec('RESET ROLE');
  await db.query(`SELECT set_config('request.jwt.claim.sub', $1, false), set_config('request.jwt.claims', $2, false)`,
    [uid ?? '', JSON.stringify({ sub: uid, aal })]);
  await db.exec(uid ? 'SET ROLE authenticated' : 'SET ROLE anon');
  try { return await db.query(sql, params); } finally { await db.exec('RESET ROLE'); }
}
async function expectFail(label, uid, sql, params, aal) {
  try { const r = await as(uid, sql, params, aal);
    if (r.affectedRows === 0 && /^\s*(update|delete)/i.test(sql)) ok(label + ' (0 linhas afetadas)');
    else bad(label + ' — deveria falhar, mas passou'); }
  catch (e) { ok(label + ' → ' + e.message.split('\n')[0]); }
}
async function expectOk(label, uid, sql, params, aal) {
  try { const r = await as(uid, sql, params, aal); ok(label); return r; }
  catch (e) { bad(label + ' — erro: ' + e.message); return null; }
}

await db.exec(stubs);
if (process.argv[3]) {
  await db.exec(fs.readFileSync(process.argv[3], 'utf8'));
  console.log('schema antigo aplicado (teste de migração)');
}

const meta = (u, extra = {}) => JSON.stringify({ username: u, display_name: u.toUpperCase(), birthdate: '1990-01-01',
  city: 'Campinas', state: 'SP', location_privacy: 'approximate_region', ...extra });
await db.query(`INSERT INTO auth.users VALUES ($1,'a@x.com',$2,now())`, [ids.a, meta('alice', { location_privacy: 'hidden', avatar_url: 'https://evil.example/track.png' })]);
await db.query(`INSERT INTO auth.users VALUES ($1,'b@x.com',$2,now())`, [ids.b, meta('bruno')]);
await db.query(`INSERT INTO auth.users VALUES ($1,'v@x.com',$2,now())`, [ids.v, meta('vitima', { location_privacy: 'city' })]);
await db.query(`INSERT INTO auth.users VALUES ($1,'m@x.com',$2,now())`, [ids.mod, meta('moder')]);

console.log('1ª execução do setup.sql');
await db.exec(setup);
ok('executou sem erro');
console.log('2ª execução (idempotência)');
await db.exec(setup);
ok('executou sem erro');
await db.query(`INSERT INTO public.admin_users VALUES ($1, 'm@x.com', 'moderator')`, [ids.mod]);

console.log('\nCadastro e privacidade');
let r = await db.query(`SELECT p.username, p.city, p.state, p.avatar_url, pp.city AS raw_city FROM profiles p JOIN profile_private pp ON pp.user_id = p.id ORDER BY username`);
const byName = Object.fromEntries(r.rows.map(x => [x.username, x]));
byName.alice.city === '' && byName.alice.state === '' && byName.alice.raw_city === 'Campinas' ? ok('localização oculta não aparece em profiles (real guardada em profile_private)') : bad('máscara hidden: ' + JSON.stringify(byName.alice));
byName.bruno.city === '' && byName.bruno.state === 'SP' ? ok('região aproximada mostra só o estado') : bad('máscara approx: ' + JSON.stringify(byName.bruno));
byName.vitima.city === 'Campinas' ? ok('modo cidade mostra a cidade') : bad('modo cidade');
byName.alice.avatar_url === '' ? ok('avatar externo do cadastro descartado') : bad('avatar externo aceito');
r = await as(ids.b, `SELECT city, state FROM profile_private WHERE user_id = $1`, [ids.a]);
r.rows.length === 0 ? ok('B não lê profile_private de A') : bad('B leu profile_private de A');
await expectOk('A muda a própria cidade em profile_private', ids.a, `UPDATE profile_private SET city = 'Santos' WHERE user_id = $1`, [ids.a]);
await expectOk('A troca privacidade para cidade', ids.a, `UPDATE profiles SET location_privacy = 'city' WHERE id = $1`, [ids.a]);
r = await db.query(`SELECT city FROM profiles WHERE id = $1`, [ids.a]);
r.rows[0].city === 'Santos' ? ok('perfil público refletiu a nova cidade') : bad('sync de cidade: ' + r.rows[0].city);
await expectOk('A tenta trocar email em profile_private (ignorado)', ids.a, `UPDATE profile_private SET email = 'x@x.com' WHERE user_id = $1`, [ids.a]);
r = await db.query(`SELECT email FROM profile_private WHERE user_id = $1`, [ids.a]);
r.rows[0].email === 'a@x.com' ? ok('email continua o original') : bad('email alterado');
await expectFail('avatar com link externo é recusado', ids.a, `UPDATE profiles SET avatar_url = 'https://evil.example/x.png' WHERE id = $1`, [ids.a]);
await expectOk('avatar do Storage do app é aceito', ids.a, `UPDATE profiles SET avatar_url = public.app_media_prefix() || $1::text || '/profile/a.jpg' WHERE id = $1::uuid`, [ids.a]);
await expectOk('A tenta mudar a própria idade (ignorado)', ids.a, `UPDATE profiles SET age = 19 WHERE id = $1`, [ids.a]);
r = await db.query(`SELECT age FROM profiles WHERE id = $1`, [ids.a]);
r.rows[0].age !== 19 ? ok('idade não mudou') : bad('idade mudou');
await expectFail('notify() direto (notificação falsa) é negado', ids.b, `SELECT public.notify($1, NULL, 'system_safety', 'Equipe', 'Clique aqui', NULL)`, [ids.v]);
await expectFail('visitante sem login não executa RPC', null, `SELECT public.start_conversation($1)`, [ids.v]);

console.log('\nConexões (falha crítica 1)');
await expectOk('A pede conexão a B', ids.a, `INSERT INTO connections (requester_id, addressee_id) VALUES ($1, $2)`, [ids.a, ids.b]);
await expectFail('B reescreve o pedido para se conectar à vítima', ids.b, `UPDATE connections SET requester_id = $1, status = 'accepted' WHERE requester_id = $2 AND addressee_id = $3`, [ids.v, ids.a, ids.b]);
r = await db.query(`SELECT public.are_connected($1, $2) AS c`, [ids.v, ids.b]);
!r.rows[0].c ? ok('vítima e B não ficaram conectados') : bad('conexão forjada!');
await expectOk('B aceita o pedido legítimo de A', ids.b, `UPDATE connections SET status = 'accepted' WHERE requester_id = $1 AND addressee_id = $2`, [ids.a, ids.b]);
r = await as(ids.v, `SELECT * FROM connections`);
r.rows.length === 0 ? ok('vítima não vê conexões alheias') : bad('lista de conexões exposta');

console.log('\nMensagens (falha crítica 2 e pedido de conversa)');
r = await expectOk('B inicia conversa com a vítima', ids.b, `SELECT public.start_conversation($1) AS id`, [ids.v]);
const convBV = r.rows[0].id;
r = await expectOk('A inicia conversa com B (conectados)', ids.a, `SELECT public.start_conversation($1) AS id`, [ids.b]);
const convAB = r.rows[0].id;
await expectFail('vítima tenta mover a própria linha de participante para a conversa A–B', ids.v, `UPDATE conversation_participants SET conversation_id = $1 WHERE user_id = $2`, [convAB, ids.v]);
r = await as(ids.v, `SELECT count(*)::int AS n FROM messages WHERE conversation_id = $1`, [convAB]);
await expectOk('B envia a mensagem de apresentação', ids.b, `INSERT INTO messages (conversation_id, sender_id, content) VALUES ($1, $2, 'oi')`, [convBV, ids.b]);
await expectFail('B tenta uma 2ª mensagem antes do aceite', ids.b, `INSERT INTO messages (conversation_id, sender_id, content) VALUES ($1, $2, 'oi de novo')`, [convBV, ids.b]);
await expectOk('vítima recusa o pedido', ids.v, `SELECT public.decline_message_request($1)`, [convBV]);
await expectOk('B sai da conversa', ids.b, `DELETE FROM conversation_participants WHERE conversation_id = $1 AND user_id = $2`, [convBV, ids.b]);
r = await expectOk('B tenta abrir uma conversa nova com a vítima', ids.b, `SELECT public.start_conversation($1) AS id`, [ids.v]);
r && r.rows[0].id === convBV ? ok('reaproveitou a mesma conversa (sem novo pedido)') : bad('criou conversa nova');
await expectFail('e continua sem poder mandar outra mensagem', ids.b, `INSERT INTO messages (conversation_id, sender_id, content) VALUES ($1, $2, 'insistindo')`, [convBV, ids.b]);
await expectFail('mensagem com mídia externa é recusada', ids.a, `INSERT INTO messages (conversation_id, sender_id, content, media_url) VALUES ($1, $2, 'x', 'https://evil.example/p.png')`, [convAB, ids.a]);
await expectOk('A manda mensagem normal para B', ids.a, `INSERT INTO messages (conversation_id, sender_id, content) VALUES ($1, $2, 'olá')`, [convAB, ids.a]);
await expectFail('A tenta apagar a mensagem enviada (evidência preservada)', ids.a, `DELETE FROM messages WHERE conversation_id = $1`, [convAB]);

console.log('\nFotos e GIFs no direct (bucket privado chat-media)');
const chatPath = (conv, uid, f = 'foto.jpg') => `${conv}/${uid}/${f}`;
await expectOk('A envia foto para a conversa com B', ids.a, `INSERT INTO storage.objects (bucket_id, name) VALUES ('chat-media', $1)`, [chatPath(convAB, ids.a)]);
await expectOk('A envia GIF para a conversa com B', ids.a, `INSERT INTO storage.objects (bucket_id, name) VALUES ('chat-media', $1)`, [chatPath(convAB, ids.a, 'anim.gif')]);
await expectFail('A não envia na pasta de B', ids.a, `INSERT INTO storage.objects (bucket_id, name) VALUES ('chat-media', $1)`, [chatPath(convAB, ids.b)]);
await expectFail('quem não participa não envia na conversa', ids.v, `INSERT INTO storage.objects (bucket_id, name) VALUES ('chat-media', $1)`, [chatPath(convAB, ids.v)]);
await expectFail('pedido pendente não aceita foto', ids.v, `INSERT INTO storage.objects (bucket_id, name) VALUES ('chat-media', $1)`, [chatPath(convBV, ids.v)]);
await expectOk('A manda a mensagem com a foto', ids.a, `INSERT INTO messages (conversation_id, sender_id, content, media_url) VALUES ($1, $2, '', 'chat-media/' || $3)`, [convAB, ids.a, chatPath(convAB, ids.a)]);
await expectFail('mensagem não aponta para a pasta de outra pessoa', ids.a, `INSERT INTO messages (conversation_id, sender_id, content, media_url) VALUES ($1, $2, '', 'chat-media/' || $3)`, [convAB, ids.a, chatPath(convAB, ids.b)]);
await expectFail('mensagem não aponta para foto de outra conversa', ids.a, `INSERT INTO messages (conversation_id, sender_id, content, media_url) VALUES ($1, $2, '', 'chat-media/' || $3)`, [convAB, ids.a, chatPath(convBV, ids.a)]);
await expectFail('caminho com ../ é recusado', ids.a, `INSERT INTO messages (conversation_id, sender_id, content, media_url) VALUES ($1, $2, '', 'chat-media/' || $3)`, [convAB, ids.a, chatPath(convAB, ids.a, '../x.jpg')]);
r = await as(ids.b, `SELECT name FROM storage.objects WHERE bucket_id = 'chat-media'`);
r.rows.length === 2 ? ok('B vê as fotos da conversa') : bad(`B deveria ver 2 fotos, viu ${r.rows.length}`);
r = await as(ids.v, `SELECT name FROM storage.objects WHERE bucket_id = 'chat-media'`);
r.rows.length === 0 ? ok('quem não participa não vê as fotos') : bad('foto do direct vazou');
r = await as(ids.mod, `SELECT name FROM storage.objects WHERE bucket_id = 'chat-media'`, [], 'aal2');
r.rows.length === 0 ? ok('moderação sem denúncia não vê as fotos') : bad('moderação viu foto sem denúncia');
r = await as(null, `SELECT name FROM storage.objects WHERE bucket_id = 'chat-media'`).catch(() => ({ rows: [] }));
r.rows.length === 0 ? ok('visitante sem login não vê as fotos') : bad('foto do direct exposta a visitante');
await expectFail('A não apaga a foto enviada (evidência preservada)', ids.a, `DELETE FROM storage.objects WHERE bucket_id = 'chat-media'`);

console.log('\nPosts privados');
r = await expectOk('A publica post só para conexões', ids.a, `INSERT INTO posts (user_id, content, visibility) VALUES ($1, 'privado', 'connections_only') RETURNING id`, [ids.a]);
const postA = r.rows[0].id;
await expectOk('B (conexão) comenta', ids.b, `INSERT INTO post_comments (post_id, user_id, content) VALUES ($1, $2, 'segredo')`, [postA, ids.b]);
r = await as(ids.v, `SELECT * FROM post_comments WHERE post_id = $1`, [postA]);
r.rows.length === 0 ? ok('vítima (não conexão) não lê os comentários') : bad('comentários de post privado expostos');
await expectFail('vítima não consegue comentar no post invisível', ids.v, `INSERT INTO post_comments (post_id, user_id, content) VALUES ($1, $2, 'x')`, [postA, ids.v]);
await expectFail('vítima não consegue curtir o post invisível', ids.v, `INSERT INTO post_likes (post_id, user_id) VALUES ($1, $2)`, [postA, ids.v]);
await expectFail('post com foto de link externo é recusado', ids.a, `INSERT INTO posts (user_id, content, media_urls) VALUES ($1, 'x', ARRAY['https://evil.example/a.jpg'])`, [ids.a]);

console.log('\nBloqueio');
await expectOk('vítima segue B', ids.v, `INSERT INTO follows (follower_id, following_id) VALUES ($1, $2)`, [ids.v, ids.b]);
await expectOk('vítima bloqueia B', ids.v, `SELECT public.block_user($1)`, [ids.b]);
r = await db.query(`SELECT count(*)::int AS n FROM follows WHERE follower_id = $1 AND following_id = $2`, [ids.v, ids.b]);
r.rows[0].n === 0 ? ok('bloqueio desfez o "seguir"') : bad('follow permaneceu');
r = await as(ids.b, `SELECT id FROM profiles WHERE id = $1`, [ids.v]);
r.rows.length === 0 ? ok('B não vê mais o perfil da vítima') : bad('B ainda vê o perfil');
r = await as(ids.v, `SELECT id FROM profiles WHERE id = $1`, [ids.b]);
r.rows.length === 1 ? ok('vítima ainda vê B (para poder desbloquear)') : bad('vítima não vê B');
await expectFail('B não consegue iniciar conversa', ids.b, `SELECT public.start_conversation($1)`, [ids.v]);
await expectFail('B não consegue pedir conexão', ids.b, `INSERT INTO connections (requester_id, addressee_id) VALUES ($1, $2)`, [ids.b, ids.v]);
await expectFail('B não consegue seguir', ids.b, `INSERT INTO follows (follower_id, following_id) VALUES ($1, $2)`, [ids.b, ids.v]);
r = await as(ids.b, `SELECT * FROM user_blocks`);
r.rows.length === 0 ? ok('B não sabe quem o bloqueou') : bad('lista de bloqueios exposta ao bloqueado');
await expectOk('vítima desbloqueia', ids.v, `DELETE FROM user_blocks WHERE blocker_id = $1 AND blocked_id = $2`, [ids.v, ids.b]);
r = await as(ids.b, `SELECT id FROM profiles WHERE id = $1`, [ids.v]);
r.rows.length === 1 ? ok('após desbloquear, B volta a ver o perfil') : bad('desbloqueio não funcionou');

console.log('\nCofres');
r = await expectOk('vítima cria cofre', ids.v, `INSERT INTO albums (user_id, title, visibility) VALUES ($1, 'cofre', 'private_vault') RETURNING id`, [ids.v]);
const vault = r.rows[0].id;
await expectOk('B pede acesso', ids.b, `INSERT INTO album_permissions (album_id, user_id) VALUES ($1, $2)`, [vault, ids.b]);
await expectFail('B tenta se autoliberar', ids.b, `UPDATE album_permissions SET status = 'granted' WHERE album_id = $1`, [vault]);
await expectOk('vítima recusa (revoked)', ids.v, `UPDATE album_permissions SET status = 'revoked' WHERE album_id = $1 AND user_id = $2`, [vault, ids.b]);
await expectFail('B tenta apagar a recusa para pedir de novo', ids.b, `DELETE FROM album_permissions WHERE album_id = $1 AND user_id = $2`, [vault, ids.b]);
await expectFail('B pede de novo', ids.b, `INSERT INTO album_permissions (album_id, user_id) VALUES ($1, $2)`, [vault, ids.b]);
await db.query(`INSERT INTO storage.objects (bucket_id, name) VALUES ('private-vaults', $1::text || '/' || $2::text || '/f.jpg')`, [ids.v, vault]);
await db.query(`INSERT INTO album_items (album_id, storage_path) VALUES ($1::uuid, $2::text || '/' || $1::text || '/f.jpg')`, [vault, ids.v]);
r = await as(ids.mod, `SELECT name FROM storage.objects WHERE bucket_id = 'private-vaults'`, [], 'aal2');
r.rows.length === 0 ? ok('moderador sem denúncia não lê arquivo do cofre') : bad('moderador lê cofre livremente');

console.log('\nModeração e Storage');
await expectFail('moderador (MFA) não altera perfil alheio direto pela API', ids.mod, `UPDATE profiles SET status = 'suspended' WHERE id = $1`, [ids.b], 'aal2');
await expectFail('moderador não insere registro falso na auditoria', ids.mod, `INSERT INTO admin_audit_logs (admin_id, admin_role, action, target_id, target_type, reason) VALUES ($1, 'moderator', 'X', 'x', 'x', 'x')`, [ids.mod], 'aal2');
await expectOk('moderador suspende pela RPC auditada', ids.mod, `SELECT public.admin_set_user_status($1, 'warned', 'teste de auditoria')`, [ids.b], 'aal2');
r = await db.query(`SELECT count(*)::int AS n FROM admin_audit_logs`);
r.rows[0].n === 1 ? ok('ação ficou no livro de auditoria') : bad('auditoria: ' + r.rows[0].n);
console.log('\nFluxos legítimos');
await expectOk('dona do cofre libera B depois de ter recusado', ids.v, `UPDATE album_permissions SET status = 'granted', granted_at = now() WHERE album_id = $1 AND user_id = $2`, [vault, ids.b]);
r = await as(ids.b, `SELECT name FROM storage.objects WHERE bucket_id = 'private-vaults'`);
r.rows.length === 1 ? ok('B com acesso liberado lê o arquivo do cofre') : bad('B liberado não lê o cofre');
r = await as(ids.v, `SELECT name FROM storage.objects WHERE bucket_id = 'private-vaults'`);
r.rows.length === 1 ? ok('dona lê o próprio cofre') : bad('dona não lê o cofre');
r = await as(ids.a, `SELECT name FROM storage.objects WHERE bucket_id = 'private-vaults'`);
r.rows.length === 0 ? ok('A (sem acesso) não lê o cofre') : bad('A lê cofre sem acesso');
const item = (await db.query(`SELECT id FROM album_items LIMIT 1`)).rows[0].id;
await expectOk('A denuncia a mídia do cofre', ids.a, `INSERT INTO moderation_reports (reporter_user_id, reported_user_id, target_type, target_id, category, description) VALUES ($1, $2, 'media', $3, 'other', 'teste')`, [ids.a, ids.v, item]);
r = await as(ids.mod, `SELECT name FROM storage.objects WHERE bucket_id = 'private-vaults'`, [], 'aal2');
r.rows.length === 1 ? ok('moderador lê a mídia denunciada') : bad('moderador não lê mídia denunciada');
r = await as(ids.mod, `SELECT name FROM storage.objects WHERE bucket_id = 'private-vaults'`, [], 'aal1');
r.rows.length === 0 ? ok('...mas não sem MFA') : bad('moderador sem MFA lê cofre');
r = await as(ids.b, `SELECT id FROM posts WHERE id = $1`, [postA]);
r.rows.length === 1 ? ok('B (conexão) vê o post só para conexões') : bad('conexão não vê post');
r = await as(ids.b, `SELECT count(*)::int AS n FROM post_comments WHERE post_id = $1`, [postA]);
r.rows[0].n === 1 ? ok('B vê os comentários do post') : bad('conexão não vê comentários');
await expectOk('A envia foto pelo app para B', ids.a, `INSERT INTO messages (conversation_id, sender_id, content, media_url) VALUES ($1, $2::uuid, '', public.app_media_prefix() || $2::text || '/m.jpg')`, [convAB, ids.a]);
r = await expectOk('B abre a conversa (que foi arquivada)', ids.b, `SELECT public.start_conversation($1) AS id`, [ids.a]);
r && r.rows[0].id === convAB ? ok('mesma conversa retomada') : bad('conversa diferente');

await db.query(`INSERT INTO storage.objects (bucket_id, name) VALUES ('public-media', $1::text || '/posts/x.jpg')`, [ids.a]);
r = await as(null, `SELECT name FROM storage.objects WHERE bucket_id = 'public-media'`).catch(e => ({ rows: [], err: e.message }));
r.rows.length === 0 ? ok('visitante sem login não lista o bucket público') : bad('anon lista public-media');
r = await as(ids.b, `SELECT name FROM storage.objects WHERE bucket_id = 'public-media'`);
r.rows.length === 0 ? ok('B não lista arquivos de A') : bad('B lista arquivos de A');

console.log('\nCompatibilidade e limites íntimos');
await expectOk('A registra limites íntimos', ids.a, `UPDATE compatibility_preferences SET personal_limits = ARRAY['segredo'] WHERE profile_id = $1`, [ids.a]);
r = await as(ids.v, `SELECT personal_limits FROM compatibility_preferences WHERE profile_id = $1`, [ids.a]);
r.rows.length === 0 ? ok('vítima (não conexão) não lê as preferências de A') : bad('preferências expostas a não conexão');
r = await as(ids.b, `SELECT personal_limits FROM compatibility_preferences WHERE profile_id = $1`, [ids.a]);
r.rows.length === 1 ? ok('B (conexão) lê as preferências de A') : bad('conexão não lê preferências');
r = await expectOk('vítima calcula o score com A pela RPC', ids.v, `SELECT public.compatibility_with($1) AS c`, [ids.a]);
const compat = r?.rows[0].c;
compat && compat.score >= 18 && !('personal_limits' in compat) ? ok('score devolvido sem os limites') : bad('RPC de compatibilidade: ' + JSON.stringify(compat));
r = await as(ids.v, `SELECT count(*)::int AS n FROM public.compatibility_scores($1::uuid[])`, [[ids.a, ids.b, ids.v]]);
r.rows[0].n === 2 ? ok('score em lote ignora o próprio perfil') : bad('lote devolveu ' + r.rows[0].n);
await expectOk('vítima bloqueia B de novo', ids.v, `SELECT public.block_user($1)`, [ids.b]);
r = await as(ids.b, `SELECT public.compatibility_with($1) AS c`, [ids.v]);
r.rows[0].c === null ? ok('bloqueado não recebe score de quem o bloqueou') : bad('score vazou após bloqueio');
await expectFail('visitante sem login não calcula score', null, `SELECT public.compatibility_with($1)`, [ids.a]);

console.log('\nEventos');
await db.query(`UPDATE profiles SET restrictions = '{"cannotPost": true}' WHERE id = $1`, [ids.a]);
await expectFail('quem está proibido de postar não publica evento', ids.a, `INSERT INTO events (created_by, title, starts_at, venue_name, city) VALUES ($1, 'festa', now() + interval '1 day', 'Clube', 'Campinas')`, [ids.a]);
await db.query(`UPDATE profiles SET restrictions = '{}' WHERE id = $1`, [ids.a]);
await expectFail('link de ingresso javascript: é recusado', ids.a, `INSERT INTO events (created_by, title, starts_at, venue_name, city, ticket_url) VALUES ($1, 'festa', now() + interval '1 day', 'Clube', 'Campinas', 'javascript:alert(1)')`, [ids.a]);
await expectOk('sem restrição, publica normalmente', ids.a, `INSERT INTO events (created_by, title, starts_at, venue_name, city) VALUES ($1, 'festa', now() + interval '1 day', 'Clube', 'Campinas')`, [ids.a]);

console.log('\nDados do perfil');
await expectOk('A troca o próprio @usuário pela RPC', ids.a, `SELECT public.change_username('Alice_Nova')`);
r = await db.query(`SELECT username FROM profiles WHERE id = $1`, [ids.a]);
r.rows[0].username === 'alice_nova' ? ok('@usuário salvo em minúsculas') : bad('@usuário: ' + r.rows[0].username);
await expectFail('A não troca de novo antes de 7 dias', ids.a, `SELECT public.change_username('alice3')`);
await expectFail('B não usa um @usuário já ocupado', ids.b, `SELECT public.change_username('alice_nova')`);
await expectFail('B não usa nome que imita a equipe', ids.b, `SELECT public.change_username('suporte_vybelog')`);
await expectFail('B não usa caracteres fora do padrão', ids.b, `SELECT public.change_username('bruno<script>')`);
await expectOk('A tenta liberar a própria troca editando a data (ignorado)', ids.a, `UPDATE profiles SET username_changed_at = NULL, username = 'hack' WHERE id = $1`, [ids.a]);
r = await db.query(`SELECT username, username_changed_at IS NOT NULL AS locked FROM profiles WHERE id = $1`, [ids.a]);
r.rows[0].username === 'alice_nova' && r.rows[0].locked ? ok('@usuário e trava de 7 dias protegidos contra UPDATE direto') : bad('proteção do @usuário: ' + JSON.stringify(r.rows[0]));
await db.query(`UPDATE auth.users SET email = 'nova@x.com' WHERE id = $1`, [ids.b]);
r = await db.query(`SELECT email FROM profile_private WHERE user_id = $1`, [ids.b]);
r.rows[0].email === 'nova@x.com' ? ok('troca de e-mail confirmada chega em profile_private') : bad('e-mail não sincronizado: ' + r.rows[0].email);
await expectOk('A salva respostas opcionais de preferências', ids.a, `UPDATE compatibility_preferences SET extras = '{"experience":"beginner"}' WHERE profile_id = $1`, [ids.a]);
await expectFail('respostas opcionais não aceitam lista no lugar de objeto', ids.a, `UPDATE compatibility_preferences SET extras = '[1,2]' WHERE profile_id = $1`, [ids.a]);
await expectFail('respostas opcionais têm tamanho limitado', ids.a, `UPDATE compatibility_preferences SET extras = jsonb_build_object('x', repeat(md5(random()::text), 400)) WHERE profile_id = $1`, [ids.a]);
await expectOk('A edita os dados do parceiro', ids.a, `INSERT INTO joint_partners (profile_id, name, age, gender) VALUES ($1, 'Par', 30, 'Feminino')`, [ids.a]);
await expectFail('A não cadastra parceiro menor de idade', ids.a, `INSERT INTO joint_partners (profile_id, name, age, gender) VALUES ($1, 'Par', 17, 'Feminino')`, [ids.a]);
await expectFail('B não cria parceiro no perfil de A', ids.b, `INSERT INTO joint_partners (profile_id, name, age, gender) VALUES ($1, 'Intruso', 30, 'Masculino')`, [ids.a]);

console.log('\nModo discreto');
await expectOk('B ativa modo discreto', ids.b, `UPDATE profiles SET discreet_mode_enabled = true, last_active_at = now() WHERE id = $1`, [ids.b]);
r = await db.query(`SELECT last_active_at = date_trunc('day', last_active_at) AS rounded FROM profiles WHERE id = $1`, [ids.b]);
r.rows[0].rounded ? ok('última atividade guardada só com o dia') : bad('horário exato exposto');

console.log('\nSeguidores e seguindo');
await db.query(`DELETE FROM follows WHERE follower_id = $1 OR following_id = $1`, [ids.mod]);
await expectOk('moderador segue A', ids.mod, `INSERT INTO follows (follower_id, following_id) VALUES ($1, $2)`, [ids.mod, ids.a]);
await expectOk('moderador deixa de seguir A', ids.mod, `DELETE FROM follows WHERE follower_id = $1 AND following_id = $2`, [ids.mod, ids.a]);
await expectOk('moderador segue A de novo', ids.mod, `INSERT INTO follows (follower_id, following_id) VALUES ($1, $2)`, [ids.mod, ids.a]);
r = await db.query(`SELECT count(*)::int AS n FROM notifications WHERE user_id = $1 AND actor_id = $2 AND type = 'follow'`, [ids.a, ids.mod]);
r.rows[0].n === 1 ? ok('A recebe um só aviso de novo seguidor (sem spam ao seguir de novo)') : bad('avisos de seguidor: ' + r.rows[0].n);
r = await as(ids.a, `SELECT id FROM public.follow_list($1, 'followers')`, [ids.a]);
r.rows.some(x => x.id === ids.mod) ? ok('A vê os próprios seguidores') : bad('A não vê os próprios seguidores');
r = await as(ids.v, `SELECT id FROM public.follow_list($1, 'followers')`, [ids.a]);
r.rows.some(x => x.id === ids.mod) ? ok('vítima vê os seguidores de A') : bad('lista de seguidores de terceiros vazia');
r = await as(ids.v, `SELECT id FROM public.follow_list($1, 'following')`, [ids.mod]);
r.rows.some(x => x.id === ids.a) ? ok('vítima vê quem o moderador segue') : bad('lista de seguindo de terceiros vazia');
await db.query(`UPDATE profiles SET discreet_mode_enabled = true WHERE id = $1`, [ids.mod]);
r = await as(ids.v, `SELECT id FROM public.follow_list($1, 'followers')`, [ids.a]);
!r.rows.some(x => x.id === ids.mod) ? ok('quem está no modo discreto some das listas de terceiros') : bad('modo discreto exposto na lista');
r = await as(ids.a, `SELECT id FROM public.follow_list($1, 'followers')`, [ids.a]);
r.rows.some(x => x.id === ids.mod) ? ok('o dono ainda vê o seguidor em modo discreto') : bad('dono não vê seguidor discreto');
await db.query(`UPDATE profiles SET discreet_mode_enabled = false WHERE id = $1`, [ids.mod]);
r = await as(ids.b, `SELECT id FROM public.follow_list($1, 'followers')`, [ids.v]);
r.rows.length === 0 ? ok('bloqueado não vê as listas de quem o bloqueou') : bad('lista vazou após bloqueio');
await expectFail('lista com tipo inválido é recusada', ids.v, `SELECT * FROM public.follow_list($1, 'tudo')`, [ids.a]);
await expectFail('visitante sem login não lê listas', null, `SELECT * FROM public.follow_list($1, 'followers')`, [ids.a]);
await expectFail('vítima não remove seguidor de outra pessoa', ids.v, `DELETE FROM follows WHERE follower_id = $1 AND following_id = $2`, [ids.mod, ids.a]);
r = await expectOk('A remove o moderador dos seguidores', ids.a, `DELETE FROM follows WHERE follower_id = $1 AND following_id = $2`, [ids.mod, ids.a]);
r?.affectedRows === 1 ? ok('seguidor removido') : bad('remoção de seguidor não apagou a linha');

console.log('\nSuperadmin: conversas e cofres (auditado)');
await db.query(`INSERT INTO auth.users VALUES ($1,'admin@x.com',$2,now())`, [ids.admin, meta('chefe')]);
await db.query(`INSERT INTO public.admin_users VALUES ($1, 'admin@x.com', 'superadmin') ON CONFLICT (user_id) DO UPDATE SET role = 'superadmin'`, [ids.admin]);
const anyConv = (await db.query(`SELECT conversation_id AS id FROM messages LIMIT 1`)).rows[0]?.id;
anyConv ? ok('há conversa com mensagens para o teste') : bad('nenhuma conversa com mensagens no cenário');
await expectFail('moderador não lista todas as conversas', ids.mod, `SELECT * FROM public.admin_list_conversations('investigação de rotina')`, [], 'aal2');
await expectFail('usuário comum não lê conversa alheia pela RPC', ids.b, `SELECT * FROM public.admin_read_conversation($1, 'quero ver tudo aqui')`, [anyConv]);
await expectFail('superadmin sem MFA não lê conversas', ids.admin, `SELECT * FROM public.admin_read_conversation($1, 'investigação de rotina')`, [anyConv]);
await expectFail('superadmin precisa justificar', ids.admin, `SELECT * FROM public.admin_read_conversation($1, 'curto')`, [anyConv], 'aal2');
r = await expectOk('superadmin (MFA) lista as conversas', ids.admin, `SELECT * FROM public.admin_list_conversations('auditoria de segurança da plataforma')`, [], 'aal2');
r?.rows.length > 0 && Array.isArray(r.rows[0].participants) ? ok('lista traz participantes de cada conversa') : bad('lista de conversas: ' + JSON.stringify(r?.rows[0]));
r = await expectOk('superadmin (MFA) lê a conversa', ids.admin, `SELECT * FROM public.admin_read_conversation($1, 'auditoria de segurança da plataforma')`, [anyConv], 'aal2');
r?.rows.length > 0 ? ok('mensagens devolvidas') : bad('conversa sem mensagens');
r = await db.query(`SELECT count(*)::int AS n FROM admin_audit_logs WHERE admin_id = $1 AND action IN ('LIST_ALL_CONVERSATIONS', 'READ_CONVERSATION')`, [ids.admin]);
r.rows[0].n === 2 ? ok('cada acesso às conversas ficou na auditoria') : bad('auditoria de conversas: ' + r.rows[0].n);
await expectFail('usuário comum não lista cofres de outros', ids.b, `SELECT * FROM public.admin_vault_items($1, 'quero ver tudo aqui')`, [ids.v]);
r = await expectOk('superadmin (MFA) lista os álbuns e cofres da vítima', ids.admin, `SELECT * FROM public.admin_vault_items($1, 'denúncia externa recebida por e-mail')`, [ids.v], 'aal2');
r?.rows.some(x => x.storage_path) ? ok('itens do cofre listados') : bad('cofre vazio para o superadmin');
r = await as(ids.admin, `SELECT name FROM storage.objects WHERE bucket_id = 'private-vaults'`, [], 'aal2');
r.rows.length > 0 ? ok('superadmin (MFA) abre o arquivo do cofre') : bad('superadmin não abre arquivo do cofre');
r = await as(ids.admin, `SELECT name FROM storage.objects WHERE bucket_id = 'private-vaults'`);
r.rows.length === 0 ? ok('sem MFA, nem o superadmin abre o cofre') : bad('cofre aberto sem MFA');
await expectFail('a checagem interna não é chamável direto', ids.admin, `SELECT public.require_superadmin_reason('justificativa longa')`, [], 'aal2');

console.log('\nAgenda: alcance da arte e respostas');
const ev = (await db.query(`INSERT INTO events (created_by, title, starts_at, venue_name, city, status) VALUES ($1, 'baile', now() + interval '2 days', 'Clube', 'Campinas', 'approved') RETURNING id`, [ids.a])).rows[0].id;
const pendingEv = (await db.query(`INSERT INTO events (created_by, title, starts_at, venue_name, city) VALUES ($1, 'rascunho', now() + interval '2 days', 'Clube', 'Campinas') RETURNING id`, [ids.a])).rows[0].id;
await expectOk('vítima abre a arte', ids.v, `SELECT public.record_event_view($1)`, [ev]);
await expectOk('vítima abre a arte de novo', ids.v, `SELECT public.record_event_view($1)`, [ev]);
await expectOk('B abre a arte', ids.b, `SELECT public.record_event_view($1)`, [ev]);
await expectOk('abrir evento não publicado não conta', ids.v, `SELECT public.record_event_view($1)`, [pendingEv]);
await expectFail('visitante sem login não registra abertura', null, `SELECT public.record_event_view($1)`, [ev]);
await expectFail('ninguém forja aberturas direto na tabela', ids.v, `INSERT INTO event_views (event_id, user_id, open_count) VALUES ($1, $2, 999)`, [ev, ids.b]);
r = await as(ids.v, `SELECT * FROM event_views`);
r.rows.length === 0 ? ok('usuário comum não vê quem abriu a arte') : bad('event_views exposta a usuário');
await expectOk('vítima responde "não vou"', ids.v, `INSERT INTO event_attendees (event_id, user_id, status) VALUES ($1, $2, 'not_going')`, [ev, ids.v]);
await expectOk('B responde "não tenho interesse"', ids.b, `INSERT INTO event_attendees (event_id, user_id, status) VALUES ($1, $2, 'not_interested')`, [ev, ids.b]);
await expectFail('resposta inválida é recusada', ids.a, `INSERT INTO event_attendees (event_id, user_id, status) VALUES ($1, $2, 'talvez')`, [ev, ids.a]);
await expectFail('usuário comum não lê as estatísticas', ids.v, `SELECT * FROM public.admin_event_stats()`);
await expectFail('equipe sem MFA não lê as estatísticas', ids.mod, `SELECT * FROM public.admin_event_stats()`);
r = await expectOk('moderador (MFA) lê as estatísticas', ids.mod, `SELECT * FROM public.admin_event_stats() WHERE event_id = $1`, [ev], 'aal2');
const st = r?.rows[0];
st && Number(st.viewers) === 2 && Number(st.opens) === 3 && Number(st.not_going) === 1 && Number(st.not_interested) === 1 && Number(st.interacted) === 2
  ? ok('alcance: 2 pessoas, 3 aberturas, 2 interações') : bad('estatísticas: ' + JSON.stringify(st));
r = await db.query(`SELECT count(*)::int AS n FROM event_views WHERE event_id = $1`, [pendingEv]);
r.rows[0].n === 0 ? ok('evento em análise não acumula alcance') : bad('alcance contado em evento não publicado');

console.log('\nComentários na agenda');
await expectOk('moderador comenta no evento publicado', ids.mod, `INSERT INTO event_comments (event_id, user_id, content) VALUES ($1, $2, 'Vou levar minha parceira!')`, [ev, ids.mod]);
r = await db.query(`SELECT comments_count FROM events WHERE id = $1`, [ev]);
r.rows[0].comments_count === 1 ? ok('contador de comentários atualizado') : bad('contador: ' + r.rows[0].comments_count);
r = await db.query(`SELECT count(*)::int AS n FROM notifications WHERE user_id = $1 AND type = 'event_comment'`, [ids.a]);
r.rows[0].n === 1 ? ok('organizador recebe aviso do comentário') : bad('aviso de comentário: ' + r.rows[0].n);
await expectFail('não comenta em evento em análise', ids.mod, `INSERT INTO event_comments (event_id, user_id, content) VALUES ($1, $2, 'oi')`, [pendingEv, ids.mod]);
await expectFail('não comenta em nome de outra pessoa', ids.mod, `INSERT INTO event_comments (event_id, user_id, content) VALUES ($1, $2, 'falso')`, [ev, ids.v]);
await expectFail('comentário vazio é recusado', ids.mod, `INSERT INTO event_comments (event_id, user_id, content) VALUES ($1, $2, '   ')`, [ev, ids.mod]);
await expectFail('comentário enorme é recusado', ids.mod, `INSERT INTO event_comments (event_id, user_id, content) VALUES ($1, $2, repeat('a', 1001))`, [ev, ids.mod]);
await db.query(`UPDATE profiles SET restrictions = '{"cannotPost": true}' WHERE id = $1`, [ids.mod]);
await expectFail('quem está proibido de postar não comenta', ids.mod, `INSERT INTO event_comments (event_id, user_id, content) VALUES ($1, $2, 'oi')`, [ev, ids.mod]);
await db.query(`UPDATE profiles SET restrictions = '{}' WHERE id = $1`, [ids.mod]);
r = await as(ids.v, `SELECT content FROM event_comments WHERE event_id = $1`, [ev]);
r.rows.length === 1 ? ok('qualquer membro lê os comentários do evento') : bad('comentários não visíveis: ' + r.rows.length);
await expectFail('ninguém edita comentário', ids.mod, `UPDATE event_comments SET content = 'editado' WHERE event_id = $1`, [ev]);
await expectFail('vítima não apaga comentário alheio', ids.v, `DELETE FROM event_comments WHERE event_id = $1`, [ev]);
r = await expectOk('organizador apaga comentário do próprio evento', ids.a, `DELETE FROM event_comments WHERE event_id = $1`, [ev]);
r?.affectedRows === 1 ? ok('comentário apagado pelo organizador') : bad('organizador não apagou');
await expectOk('moderador comenta de novo', ids.mod, `INSERT INTO event_comments (event_id, user_id, content) VALUES ($1, $2, 'Até lá!')`, [ev, ids.mod]);
r = await as(ids.mod, `SELECT comments, commenters, interacted FROM public.admin_event_stats() WHERE event_id = $1`, [ev], 'aal2');
r.rows[0] && Number(r.rows[0].comments) === 1 && Number(r.rows[0].interacted) === 3
  ? ok('estatísticas contam comentários e quem comentou como interação') : bad('estatísticas com comentários: ' + JSON.stringify(r.rows[0]));

console.log('\nDistância (localização aproximada)');
// moderador e B na capital (região aproximada), vítima em Campinas (mostra a cidade), A oculta a localização
await db.query(`UPDATE profiles SET location_privacy = 'approximate_region' WHERE id = ANY($1::uuid[])`, [[ids.mod, ids.b]]);
await db.query(`UPDATE profiles SET location_privacy = 'hidden' WHERE id = $1`, [ids.a]);
await db.query(`UPDATE profiles SET location_privacy = 'city' WHERE id = $1`, [ids.v]);
await expectOk('moderador grava a localização', ids.mod, `SELECT public.set_my_location(-23.5505, -46.6333)`);
await expectOk('B grava a localização', ids.b, `SELECT public.set_my_location(-23.5800, -46.6600)`);
await expectOk('vítima grava a localização', ids.v, `SELECT public.set_my_location(-22.9056, -47.0608)`);
await expectOk('A (localização oculta) grava a localização', ids.a, `SELECT public.set_my_location(-23.5510, -46.6340)`);
r = await db.query(`SELECT lat, lng FROM user_geo WHERE user_id = $1`, [ids.mod]);
const onGrid = v => Math.abs(Number(v) * 50 - Math.round(Number(v) * 50)) < 1e-9;
onGrid(r.rows[0].lat) && onGrid(r.rows[0].lng) && Number(r.rows[0].lat) !== -23.5505
  ? ok('posição guardada só na grade de ~2 km (' + r.rows[0].lat + ', ' + r.rows[0].lng + ')') : bad('posição exata gravada: ' + JSON.stringify(r.rows[0]));
r = await as(ids.v, `SELECT user_id FROM user_geo`);
r.rows.length === 1 && r.rows[0].user_id === ids.v ? ok('cada um lê só a própria localização') : bad('localização alheia exposta');
await expectFail('ninguém grava localização direto na tabela', ids.v, `INSERT INTO user_geo (user_id, lat, lng) VALUES ($1, 0, 0)`, [ids.b]);
await expectFail('coordenada inválida é recusada', ids.v, `SELECT public.set_my_location(200, 0)`);
r = await as(ids.mod, `SELECT public.set_my_location(-10.0, -40.0) AS changed`);
r.rows[0].changed === false ? ok('troca de posição em menos de 10 min é ignorada (anti-triangulação)') : bad('troca rápida de posição aceita');
r = await as(ids.mod, `SELECT * FROM public.nearby_profiles(20)`);
const near20 = Object.fromEntries(r.rows.map(x => [x.profile_id, x.distance_km]));
ids.b in near20 && !(ids.v in near20) ? ok('raio de 20 km traz só quem está perto') : bad('raio 20 km: ' + JSON.stringify(near20));
near20[ids.b] % 5 === 0 ? ok('região aproximada aparece de 5 em 5 km (' + near20[ids.b] + ' km)') : bad('distância de região aproximada: ' + near20[ids.b]);
r = await as(ids.mod, `SELECT * FROM public.nearby_profiles(150)`);
const near150 = Object.fromEntries(r.rows.map(x => [x.profile_id, x.distance_km]));
near150[ids.v] >= 70 && near150[ids.v] <= 100 ? ok('Campinas aparece a ~' + near150[ids.v] + ' km') : bad('distância até Campinas: ' + near150[ids.v]);
!(ids.a in near150) ? ok('quem ocultou a localização não aparece por distância') : bad('localização oculta exposta');
r = await as(ids.a, `SELECT * FROM public.nearby_profiles(150)`);
r.rows.length === 0 ? ok('quem ocultou a localização também não vê a distância dos outros') : bad('reciprocidade da distância falhou');
r = await as(ids.b, `SELECT * FROM public.nearby_profiles(150)`);
!r.rows.some(x => x.profile_id === ids.v) ? ok('bloqueado não encontra quem o bloqueou pela distância') : bad('distância vazou após bloqueio');
r = await as(ids.mod, `SELECT * FROM public.profile_distances($1::uuid[])`, [[ids.v, ids.b, ids.a]]);
r.rows.length === 2 ? ok('distâncias em lote só para quem compartilha') : bad('distâncias em lote: ' + JSON.stringify(r.rows));
r = await as(ids.mod, `SELECT public.compatibility_with($1) AS c`, [ids.v]);
r.rows[0].c?.distanceKm === near150[ids.v] ? ok('compatibilidade usa a distância real arredondada') : bad('compatibilidade: ' + JSON.stringify(r.rows[0].c?.distanceKm));
await expectOk('B apaga a própria localização', ids.b, `SELECT public.clear_my_location()`);
r = await as(ids.b, `SELECT * FROM public.nearby_profiles(150)`);
r.rows.length === 0 ? ok('sem localização própria, não vê distâncias') : bad('sem localização ainda vê distâncias');
await expectFail('visitante sem login não busca por distância', null, `SELECT * FROM public.nearby_profiles(50)`);

console.log('\nMesma cidade / mesmo estado (cadastro)');
const place = async (uid, city, state, privacy) => {
  await db.query(`UPDATE profile_private SET city = $2, state = $3 WHERE user_id = $1`, [uid, city, state]);
  await db.query(`UPDATE profiles SET location_privacy = $2 WHERE id = $1`, [uid, privacy]);
};
await place(ids.mod, 'Aracaju', 'SE', 'city');
await place(ids.b, '  aracajú ', 'Sergipe', 'city');
await place(ids.v, 'Itabaiana', 'se', 'city');
await place(ids.a, 'Aracaju', 'SE', 'hidden');
const region = async (uid, scope) => Object.fromEntries((await as(uid, `SELECT * FROM public.same_region_profiles($1)`, [scope])).rows.map(x => [x.profile_id, x.match]));
let reg = await region(ids.mod, 'city');
reg[ids.b] === 'city' && !(ids.v in reg) ? ok('mesma cidade ignora acento, espaço e maiúscula (Aracaju = aracajú)') : bad('mesma cidade: ' + JSON.stringify(reg));
!(ids.a in reg) ? ok('quem oculta a localização não aparece na mesma cidade') : bad('localização oculta exposta por cidade');
reg = await region(ids.mod, 'state');
reg[ids.b] === 'city' && reg[ids.v] === 'state' && !(ids.a in reg) ? ok('mesmo estado entende sigla e nome (SE = Sergipe = se)') : bad('mesmo estado: ' + JSON.stringify(reg));
await place(ids.v, 'Aracaju', 'SE', 'approximate_region');
reg = await region(ids.mod, 'city');
!(ids.v in reg) ? ok('quem mostra só a região não é encontrado pela cidade') : bad('cidade de "região aproximada" exposta');
reg = await region(ids.mod, 'state');
reg[ids.v] === 'state' ? ok('quem mostra só a região aparece no mesmo estado (sem revelar a cidade)') : bad('região aproximada no estado: ' + JSON.stringify(reg));
await place(ids.mod, 'Aracaju', 'SE', 'approximate_region');
reg = await region(ids.mod, 'city');
Object.keys(reg).length === 0 ? ok('quem não mostra a própria cidade não busca por cidade') : bad('reciprocidade da cidade falhou');
reg = await region(ids.a, 'state');
Object.keys(reg).length === 0 ? ok('quem oculta a localização não usa o filtro de região') : bad('reciprocidade do estado falhou');
reg = await region(ids.b, 'state');
!(ids.v in reg) ? ok('bloqueado não encontra quem o bloqueou pela região') : bad('região vazou após bloqueio');
await expectFail('visitante sem login não busca por região', null, `SELECT * FROM public.same_region_profiles('state')`);

console.log('\nStatus online (recíproco)');
await db.query(`UPDATE profiles SET discreet_mode_enabled = false, show_online_status = true WHERE id = ANY($1::uuid[])`, [[ids.a, ids.mod]]);
await expectOk('A registra presença', ids.a, `SELECT public.touch_presence()`);
await expectOk('moderador registra presença', ids.mod, `SELECT public.touch_presence()`);
const online = async (viewer, target) => (await as(viewer, `SELECT * FROM public.online_users($1::uuid[]) AS id`, [[target]])).rows.length === 1;
(await online(ids.mod, ids.a)) ? ok('moderador vê que A está online') : bad('A deveria aparecer online');
r = await as(ids.mod, `SELECT * FROM user_presence`);
r.rows.length === 0 ? ok('ninguém lê a tabela de presença direto') : bad('user_presence exposta');
await expectFail('ninguém forja presença de outra pessoa', ids.mod, `INSERT INTO user_presence (user_id) VALUES ($1)`, [ids.b]);
await expectOk('A esconde o status online', ids.a, `UPDATE profiles SET show_online_status = false, last_active_at = now() WHERE id = $1`, [ids.a]);
!(await online(ids.mod, ids.a)) ? ok('quem esconde não aparece online') : bad('status escondido continua visível');
!(await online(ids.a, ids.mod)) ? ok('quem esconde também não vê os outros') : bad('reciprocidade falhou');
r = await db.query(`SELECT last_active_at = date_trunc('day', last_active_at) AS rounded FROM profiles WHERE id = $1`, [ids.a]);
r.rows[0].rounded ? ok('com o status escondido, a última atividade fica só com o dia') : bad('horário exato exposto com status escondido');
await expectOk('A volta a mostrar o status', ids.a, `UPDATE profiles SET show_online_status = true WHERE id = $1`, [ids.a]);
await db.query(`UPDATE user_presence SET last_seen_at = now() - interval '10 minutes' WHERE user_id = $1`, [ids.a]);
!(await online(ids.mod, ids.a)) ? ok('sem sinal há 10 min, deixa de aparecer online') : bad('presença antiga aparece como online');
await expectFail('visitante sem login não consulta presença', null, `SELECT * FROM public.online_users($1::uuid[])`, [[ids.a]]);
(await as(ids.b, `SELECT * FROM public.online_users($1::uuid[]) AS id`, [[ids.v]])).rows.length === 0
  ? ok('bloqueado não vê o status de quem o bloqueou') : bad('presença vazou após bloqueio');

console.log('\nPublicidade em carrossel');
await expectFail('membro comum não cria anúncio', ids.b, `INSERT INTO ads (advertiser, title, placement) VALUES ('X', 'Y', 'carousel')`);
await expectOk('superadmin (MFA) cria anúncio no carrossel', ids.admin, `INSERT INTO ads (advertiser, title, placement) VALUES ('Clube', 'Slide 1', 'carousel')`, [], 'aal2');
await expectFail('espaço desconhecido é recusado', ids.admin, `INSERT INTO ads (advertiser, title, placement) VALUES ('Clube', 'Z', 'popup')`, [], 'aal2');
r = await as(ids.b, `SELECT title FROM ads WHERE placement = 'carousel'`);
r.rows.length === 1 ? ok('membro vê o slide no ar') : bad('slide do carrossel: ' + r.rows.length);
await expectOk('superadmin pausa o slide', ids.admin, `UPDATE ads SET is_active = false WHERE placement = 'carousel'`, [], 'aal2');
r = await as(ids.b, `SELECT title FROM ads WHERE placement = 'carousel'`);
r.rows.length === 0 ? ok('slide pausado some para os membros') : bad('slide pausado continua visível');

console.log('\nLembrete de foto de perfil');
const lembretes = async (uid) => (await db.query(`SELECT count(*)::int AS n FROM notifications WHERE user_id = $1 AND type = 'profile_photo_reminder'`, [uid])).rows[0].n;
await db.query(`UPDATE profiles SET avatar_url = '', created_at = now() WHERE id = $1`, [ids.b]);
await expectOk('B (conta nova, sem foto) pede o lembrete', ids.b, `SELECT public.request_avatar_reminder()`);
(await lembretes(ids.b)) === 0 ? ok('conta com menos de 1 dia não recebe lembrete') : bad('lembrete cedo demais');
await db.query(`UPDATE profiles SET created_at = now() - interval '3 days' WHERE id = $1`, [ids.b]);
await expectOk('B pede o lembrete de novo', ids.b, `SELECT public.request_avatar_reminder()`);
(await lembretes(ids.b)) === 1 ? ok('perfil sem foto recebe o lembrete') : bad('lembrete não saiu: ' + (await lembretes(ids.b)));
await as(ids.b, `SELECT public.request_avatar_reminder()`);
(await lembretes(ids.b)) === 1 ? ok('no máximo um lembrete por semana') : bad('lembrete repetido na mesma semana');
r = await as(ids.b, `SELECT title, message, actor_id FROM notifications WHERE user_id = $1 AND type = 'profile_photo_reminder'`, [ids.b]);
r.rows[0]?.actor_id === null && /mais chances/.test(r.rows[0]?.message) ? ok('B vê o aviso do Vybelog explicando o porquê') : bad('aviso: ' + JSON.stringify(r.rows[0]));
await db.query(`UPDATE notifications SET created_at = now() - interval '8 days' WHERE user_id = $1 AND type = 'profile_photo_reminder'`, [ids.b]);
r = await db.query(`SELECT public.send_avatar_reminders() AS n`);
(await lembretes(ids.b)) === 2 ? ok('rodada diária manda de novo depois de 7 dias') : bad('rodada diária: ' + (await lembretes(ids.b)));
r = await db.query(`SELECT count(*)::int AS n FROM notifications n JOIN profiles p ON p.id = n.user_id WHERE n.type = 'profile_photo_reminder' AND p.avatar_url <> ''`);
r.rows[0].n === 0 ? ok('quem já tem foto não recebe lembrete') : bad('lembrete para quem tem foto: ' + r.rows[0].n);
await db.query(`INSERT INTO notifications (user_id, type, title, message, created_at)
  SELECT $1, 'profile_photo_reminder', 't', 'm', now() - interval '60 days' FROM generate_series(1, 6)`, [ids.b]);
await db.query(`UPDATE notifications SET created_at = now() - interval '8 days' WHERE user_id = $1 AND type = 'profile_photo_reminder'`, [ids.b]);
await as(ids.b, `SELECT public.request_avatar_reminder()`);
(await lembretes(ids.b)) === 8 ? ok('para de lembrar depois de 8 avisos') : bad('limite de lembretes: ' + (await lembretes(ids.b)));
await expectFail('membro não dispara a rodada para todos', ids.b, `SELECT public.send_avatar_reminders()`);
await expectFail('membro não manda lembrete para outra pessoa', ids.b, `SELECT public.send_avatar_reminder($1)`, [ids.v]);

console.log('\nNotificações push');
const ep = (n) => `https://fcm.googleapis.com/fcm/send/teste-${n}`;
const chaves = ['BNcRdreALRFXTkOOUHK1EtK2wtaz5Ry4YfYCA_0QTpQtUbVlUls0VJXg7A8u-Ts1XbjhazAkj7I99e8QcYP7DkM', 'tBHItJI5svbpez7KI4CCXg'];
await expectOk('A registra o celular para push', ids.a, `SELECT public.push_subscribe($1, $2, $3, 'Android · Chrome')`, [ep('a1'), ...chaves]);
await expectOk('A registra também o computador (vários aparelhos)', ids.a, `SELECT public.push_subscribe($1, $2, $3, 'Windows · Edge')`, [ep('a2'), ...chaves]);
await expectOk('B registra o celular', ids.b, `SELECT public.push_subscribe($1, $2, $3, 'iPhone · PWA')`, [ep('b1'), ...chaves]);
await expectFail('endereço de push sem https é recusado', ids.b, `SELECT public.push_subscribe('http://inseguro', $1, $2, 'x')`, chaves);
await expectFail('ninguém lê as inscrições (chaves) direto', ids.a, `SELECT * FROM push_subscriptions`);
await expectFail('ninguém mexe na fila de envio', ids.a, `SELECT * FROM push_queue`);
await expectFail('membro não reserva a fila (só a função do servidor)', ids.a, `SELECT public.push_claim(10)`);
r = await as(ids.a, `SELECT * FROM public.my_push_devices()`);
r.rows.length === 2 && !('p256dh' in r.rows[0]) ? ok('a pessoa vê os próprios aparelhos, sem as chaves') : bad('meus aparelhos: ' + JSON.stringify(r.rows));
r = await as(ids.b, `SELECT * FROM public.my_push_devices()`);
r.rows.length === 1 ? ok('e só os próprios') : bad('aparelhos de outra pessoa visíveis');

const filaDe = async (uid, tipo) => (await db.query(`SELECT q.status, q.next_attempt_at > now() + interval '1 minute' AS adiado FROM push_queue q JOIN notifications n ON n.id = q.notification_id WHERE n.user_id = $1 AND n.type = $2 ORDER BY q.id`, [uid, tipo])).rows;
await db.query(`DELETE FROM post_likes WHERE post_id = $1 AND user_id = $2`, [postA, ids.b]);
await expectOk('B curte o post de A', ids.b, `INSERT INTO post_likes (post_id, user_id) VALUES ($1, $2)`, [postA, ids.b]);
r = await db.query(`SELECT link, category FROM notifications WHERE user_id = $1 AND type = 'like' ORDER BY created_at DESC LIMIT 1`, [ids.a]);
r.rows[0]?.link === `/publicacao/${postA}` && r.rows[0]?.category === 'likes' ? ok('curtida leva direto à publicação (categoria likes)') : bad('link da curtida: ' + JSON.stringify(r.rows[0]));
r = await filaDe(ids.a, 'like');
r.length >= 2 && r.slice(-2).every(x => x.status === 'pending') ? ok('push na fila dos 2 aparelhos de A') : bad('fila da curtida: ' + JSON.stringify(r));

await expectOk('A desliga push de comentários', ids.a, `SELECT public.save_notification_preferences($1)`, [JSON.stringify({ categories: { comments: false } })]);
await expectOk('B comenta no post de A', ids.b, `INSERT INTO post_comments (post_id, user_id, content) VALUES ($1, $2, 'comentário reservado')`, [postA, ids.b]);
r = await filaDe(ids.a, 'comment');
r.length > 0 && r.slice(-2).every(x => x.status === 'skipped') ? ok('preferência desligada: fica só na central, sem push') : bad('preferência ignorada: ' + JSON.stringify(r));
r = await db.query(`SELECT count(*)::int AS n FROM notifications WHERE user_id = $1 AND type = 'comment'`, [ids.a]);
r.rows[0].n >= 1 ? ok('a notificação interna continua existindo') : bad('central perdeu a notificação');

const agora = (await db.query(`SELECT to_char(now() AT TIME ZONE 'America/Sao_Paulo', 'HH24') AS h`)).rows[0].h;
const hh = Number(agora);
const ini = `${String((hh + 23) % 24).padStart(2, '0')}:00`, fim = `${String((hh + 2) % 24).padStart(2, '0')}:00`;
await expectOk('A liga o horário silencioso agora', ids.a, `SELECT public.save_notification_preferences($1)`, [JSON.stringify({ quiet_start: ini, quiet_end: fim })]);
await db.query(`DELETE FROM post_likes WHERE post_id = $1 AND user_id = $2`, [postA, ids.b]);
await expectOk('B curte de novo', ids.b, `INSERT INTO post_likes (post_id, user_id) VALUES ($1, $2)`, [postA, ids.b]);
r = await filaDe(ids.a, 'like');
r.slice(-2).every(x => x.status === 'pending' && x.adiado) ? ok('horário silencioso: o push fica para o fim do período') : bad('horário silencioso: ' + JSON.stringify(r));
await expectOk('A silencia por 8 horas', ids.a, `SELECT public.save_notification_preferences($1)`, [JSON.stringify({ muted_until: new Date(Date.now() + 8 * 3600e3).toISOString() })]);
await db.query(`DELETE FROM post_likes WHERE post_id = $1 AND user_id = $2`, [postA, ids.b]);
await as(ids.b, `INSERT INTO post_likes (post_id, user_id) VALUES ($1, $2)`, [postA, ids.b]);
r = await filaDe(ids.a, 'like');
r.slice(-2).every(x => x.status === 'skipped') ? ok('silenciado: nenhum push') : bad('silenciar: ' + JSON.stringify(r));
await expectOk('A volta ao normal', ids.a, `SELECT public.save_notification_preferences('{}')`);

// mensagens: aviso discreto, um por conversa enquanto não for lido
await db.query(`DELETE FROM notifications WHERE type IN ('message', 'message_request')`);
await as(ids.a, `INSERT INTO messages (conversation_id, sender_id, content) VALUES ($1, $2, 'primeira mensagem secreta')`, [convAB, ids.a]);
r = await db.query(`SELECT count(*)::int AS n, max(link) AS link FROM notifications WHERE user_id = $1 AND type = 'message' AND reference_id = $2`, [ids.b, convAB]);
r.rows[0].n === 1 && r.rows[0].link === `/mensagens/${convAB}` ? ok('mensagem nova avisa o destinatário e leva à conversa') : bad('aviso de mensagem: ' + JSON.stringify(r.rows[0]));
await as(ids.a, `INSERT INTO messages (conversation_id, sender_id, content) VALUES ($1, $2, 'segunda mensagem secreta')`, [convAB, ids.a]);
r = await db.query(`SELECT count(*)::int AS n FROM notifications WHERE user_id = $1 AND type = 'message' AND reference_id = $2`, [ids.b, convAB]);
r.rows[0].n === 1 ? ok('mensagens seguidas não duplicam o aviso') : bad('aviso duplicado: ' + r.rows[0].n);
await expectOk('B abre a conversa (avisos lidos)', ids.b, `SELECT public.mark_conversation_notifications_read($1)`, [convAB]);
await as(ids.a, `INSERT INTO messages (conversation_id, sender_id, content) VALUES ($1, $2, 'terceira')`, [convAB, ids.a]);
r = await db.query(`SELECT count(*)::int AS n FROM notifications WHERE user_id = $1 AND type = 'message' AND reference_id = $2`, [ids.b, convAB]);
r.rows[0].n === 2 ? ok('depois de lido, nova mensagem avisa de novo') : bad('aviso após leitura: ' + r.rows[0].n);

// conteúdo da tela bloqueada e resultado do envio
await db.exec('RESET ROLE');
r = await db.query(`SELECT public.push_claim(200) AS l`);
const lote = r.rows[0].l;
const msgB = lote.find(x => x.endpoint === ep('b1') && x.payload.link.startsWith('/mensagens/'));
msgB && msgB.payload.t === 'Nova mensagem!' && msgB.payload.b === 'Você recebeu uma nova mensagem.' && msgB.payload.link === `/mensagens/${convAB}`
  && !JSON.stringify(lote).includes('secreta') && !JSON.stringify(lote).includes('reservado') && !JSON.stringify(lote).includes('ALICE')
  ? ok('tela bloqueada discreta: sem conteúdo nem nome (padrão), com o link certo') : bad('payload: ' + JSON.stringify(msgB));
(await db.query(`SELECT public.push_claim(200) AS l`)).rows[0].l.length === 0 ? ok('o que está sendo enviado não é reservado de novo') : bad('reserva duplicada');
const [okItem, goneItem, erroItem] = lote;
await db.query(`SELECT public.push_complete($1)`, [JSON.stringify([{ id: okItem.id, ok: true, status: 201 }, { id: goneItem.id, ok: false, status: 410, error: 'Gone' }, { id: erroItem.id, ok: false, status: 503, error: 'indisponível' }])]);
r = await db.query(`SELECT id, status FROM push_queue WHERE id = ANY($1::bigint[])`, [[okItem.id, goneItem.id, erroItem.id]]);
const stFila = Object.fromEntries(r.rows.map(x => [x.id, x.status]));
stFila[okItem.id] === 'sent' && stFila[goneItem.id] === 'skipped' && stFila[erroItem.id] === 'pending' ? ok('enviado, expirado (descartado) e falha temporária (nova tentativa)') : bad("resultado: " + JSON.stringify(stFila));
r = await db.query(`SELECT active FROM push_subscriptions WHERE endpoint = $1`, [goneItem.endpoint]);
r.rows[0].active === false ? ok('aparelho expirado (410) é desativado') : bad('inscrição inválida continua ativa');
for (let i = 0; i < 5; i++) {
  await db.query(`UPDATE push_queue SET status = 'sending', attempts = attempts + 1 WHERE id = $1`, [erroItem.id]);
  await db.query(`SELECT public.push_complete($1)`, [JSON.stringify([{ id: erroItem.id, ok: false, status: 503, error: 'indisponível' }])]);
}
r = await db.query(`SELECT status, error FROM push_queue WHERE id = $1`, [erroItem.id]);
r.rows[0].status === 'failed' && r.rows[0].error ? ok('depois de 5 tentativas a falha fica registrada') : bad('retentativas: ' + JSON.stringify(r.rows[0]));

await expectOk('A revoga o computador', ids.a, `SELECT public.push_unsubscribe(NULL, $1)`, [ep('a2')]);
r = await db.query(`SELECT active FROM push_subscriptions WHERE endpoint = $1`, [ep('a2')]);
r.rows[0].active === false ? ok('aparelho revogado não recebe mais') : bad('revogação falhou');

// limite contra abuso
await db.query(`INSERT INTO notifications (user_id, actor_id, type, title, message, reference_id) SELECT $1, $2, 'follow', 't', 'm', g::text FROM generate_series(1, 40) g`, [ids.b, ids.a]);
r = await db.query(`SELECT count(*) FILTER (WHERE q.status = 'skipped' AND q.error = 'limite de envio')::int AS n FROM push_queue q JOIN notifications n ON n.id = q.notification_id WHERE n.user_id = $1`, [ids.b]);
r.rows[0].n > 0 ? ok('rajada de notificações: o excesso não vira push (limite de envio)') : bad('sem limite de envio');

// comunicados
await expectFail('membro não envia comunicado', ids.a, `SELECT public.admin_create_broadcast('Aviso', 'Manutenção hoje', 'all', NULL, NULL, NULL, 'teste de aviso')`);
await expectFail('superadmin sem MFA não envia', ids.admin, `SELECT public.admin_create_broadcast('Aviso', 'Manutenção hoje', 'all', NULL, NULL, NULL, 'teste de aviso')`);
await expectFail('destino externo é recusado', ids.admin, `SELECT public.admin_create_broadcast('Aviso', 'Manutenção hoje', 'all', NULL, 'https://evil.example', NULL, 'teste de aviso')`, [], 'aal2');
r = await expectOk('superadmin (MFA) envia comunicado a todos', ids.admin, `SELECT public.admin_create_broadcast('Manutenção programada', 'O Vybelog terá manutenção às 3h.', 'all', NULL, '/notificacoes', NULL, 'aviso de manutenção') AS id`, [], 'aal2');
const totalAtivos = (await db.query(`SELECT count(*)::int AS n FROM profiles WHERE status::text <> 'suspended'`)).rows[0].n;
r = await db.query(`SELECT count(*)::int AS n FROM notifications WHERE type = 'admin_broadcast'`);
r.rows[0].n === totalAtivos ? ok(`comunicado chegou à central de todos (${totalAtivos})`) : bad('comunicado: ' + r.rows[0].n + ' de ' + totalAtivos);
await db.query(`UPDATE admin_broadcasts SET sent_at = NULL`);
await db.query(`SELECT public.dispatch_broadcasts()`);
r = await db.query(`SELECT count(*)::int AS n FROM notifications WHERE type = 'admin_broadcast'`);
r.rows[0].n === totalAtivos ? ok('reprocessar o comunicado não duplica') : bad('comunicado duplicado: ' + r.rows[0].n);
r = await expectOk('equipe vê o histórico com o resultado', ids.admin, `SELECT * FROM public.admin_broadcast_history()`, [], 'aal2');
r && r.rows.length === 1 ? ok('histórico de comunicados') : bad('histórico');
await expectFail('membro não vê o histórico', ids.a, `SELECT * FROM public.admin_broadcast_history()`);

console.log('\nFeed: respostas, menções e "Para você"');
r = await expectOk('A comenta no próprio post', ids.a, `INSERT INTO post_comments (post_id, user_id, content) VALUES ($1, $2, 'comentário principal') RETURNING id`, [postA, ids.a]);
const cPai = r.rows[0].id;
r = await expectOk('B responde ao comentário de A', ids.b, `INSERT INTO post_comments (post_id, user_id, content, parent_id) VALUES ($1, $2, 'resposta', $3) RETURNING id, parent_id`, [postA, ids.b, cPai]);
const cResp = r.rows[0].id;
r = await expectOk('A responde à resposta (vira resposta ao principal)', ids.a, `INSERT INTO post_comments (post_id, user_id, content, parent_id) VALUES ($1, $2, 'tréplica', $3) RETURNING parent_id`, [postA, ids.a, cResp]);
r && r.rows[0].parent_id === cPai ? ok('respostas ficam em um nível (como no Instagram)') : bad('nível da resposta: ' + JSON.stringify(r?.rows));
r = await as(ids.a, `INSERT INTO posts (user_id, content) VALUES ($1, 'post aberto') RETURNING id`, [ids.a]);
const postPub = r.rows[0].id;
r = await as(ids.b, `INSERT INTO post_comments (post_id, user_id, content) VALUES ($1, $2, 'opinião de B') RETURNING id`, [postPub, ids.b]);
await expectOk('moder responde ao comentário de B num post público', ids.mod, `INSERT INTO post_comments (post_id, user_id, content, parent_id) VALUES ($1, $2, 'concordo', $3)`, [postPub, ids.mod, r.rows[0].id]);
r = await db.query(`SELECT link FROM notifications WHERE user_id = $1 AND type = 'comment_reply' ORDER BY created_at DESC LIMIT 1`, [ids.b]);
r.rows[0]?.link?.startsWith(`/publicacao/${postPub}?comentario=`) ? ok('quem foi respondido recebe aviso que abre a publicação no comentário') : bad('aviso de resposta: ' + JSON.stringify(r.rows));
r = await as(ids.b, `INSERT INTO posts (user_id, content) VALUES ($1, 'outro') RETURNING id`, [ids.b]);
await expectFail('resposta a comentário de outra publicação é recusada', ids.b, `INSERT INTO post_comments (post_id, user_id, content, parent_id) VALUES ($1, $2, 'x', $3)`, [r.rows[0].id, ids.b, cPai]);

await expectOk('B publica mencionando @alice e @vitima', ids.b, `INSERT INTO posts (user_id, content) VALUES ($1, 'olá @Alice_Nova e @MODER e @vitima e @ninguem') RETURNING id`, [ids.b]);
r = await db.query(`SELECT user_id, link FROM notifications WHERE type = 'mention'`);
const mencionados = r.rows.map(x => x.user_id);
mencionados.includes(ids.a) && mencionados.includes(ids.mod) && !mencionados.includes(ids.v) && r.rows.every(x => x.link.startsWith('/publicacao/')) ? ok('menções avisam os citados (sem diferenciar maiúsculas); quem bloqueou o autor não é avisado') : bad('menções: ' + JSON.stringify(r.rows));
const antesPriv = r.rows.length;
await expectOk('A menciona @vitima num post só para conexões', ids.a, `INSERT INTO posts (user_id, content, visibility) VALUES ($1, 'segredo para @vitima', 'connections_only')`, [ids.a]);
r = await db.query(`SELECT count(*)::int AS n FROM notifications WHERE type = 'mention'`);
r.rows[0].n === antesPriv ? ok('ninguém é avisado de menção em publicação que não pode ver') : bad('menção vazou de post privado');

r = await expectOk('Para você: lista ranqueada', ids.v, `SELECT * FROM public.feed_for_you(20, 0)`);
const visiveisV = (await as(ids.v, `SELECT id FROM posts WHERE community_id IS NULL AND created_at > now() - interval '30 days' AND moderation_status = 'approved'`)).rows.map(x => x.id);
r && r.rows.every(x => visiveisV.includes(x.post_id)) && !r.rows.some(x => x.post_id === postA) ? ok('"Para você" respeita as regras de acesso (sem posts privados alheios)') : bad('para você vazou: ' + JSON.stringify(r?.rows));
r = await as(ids.b, `SELECT public.profile_id_by_username('ALICE_NOVA') AS id`);
r.rows[0].id === ids.a ? ok('@usuario leva ao perfil certo') : bad('busca por @usuario');

console.log('\nChat: entregue, busca e mídia');
await as(ids.a, `INSERT INTO messages (conversation_id, sender_id, content) VALUES ($1, $2, 'mensagem para busca pitanga')`, [convAB, ids.a]);
r = await expectOk('B confirma o recebimento', ids.b, `SELECT public.mark_messages_delivered() AS n`);
r = await db.query(`SELECT status FROM messages WHERE conversation_id = $1 AND sender_id = $2 ORDER BY created_at DESC LIMIT 1`, [convAB, ids.a]);
r.rows[0].status === 'delivered' ? ok('mensagem fica como entregue') : bad('entregue: ' + r.rows[0].status);
await expectOk('B abre a conversa', ids.b, `SELECT public.mark_conversation_read($1)`, [convAB]);
r = await db.query(`SELECT status FROM messages WHERE conversation_id = $1 AND sender_id = $2 ORDER BY created_at DESC LIMIT 1`, [convAB, ids.a]);
r.rows[0].status === 'read' ? ok('e depois como visualizada') : bad('visualizada: ' + r.rows[0].status);
r = await as(ids.b, `SELECT * FROM public.search_my_messages('PITANGA')`);
r.rows.length === 1 && r.rows[0].conversation_id === convAB ? ok('busca encontra a mensagem nas próprias conversas') : bad('busca: ' + JSON.stringify(r.rows));
r = await as(ids.v, `SELECT * FROM public.search_my_messages('pitanga')`);
r.rows.length === 0 ? ok('quem não participa não encontra mensagens alheias') : bad('busca vazou mensagens');
r = await as(ids.b, `SELECT * FROM public.search_my_messages('_%')`);
r.rows.every(x => x.content.includes('_%')) ? ok('caracteres especiais da busca são tratados como texto') : bad('busca com curinga');
const audio = `chat-media/${convAB}/${ids.a}/audio1.webm`;
await expectOk('áudio do direct no caminho certo é aceito', ids.a, `INSERT INTO messages (conversation_id, sender_id, content, media_url) VALUES ($1, $2, '', $3)`, [convAB, ids.a, audio]);
await expectFail('mídia em pasta de outra pessoa é recusada', ids.a, `INSERT INTO messages (conversation_id, sender_id, content, media_url) VALUES ($1, $2, '', $3)`, [convAB, ids.a, `chat-media/${convAB}/${ids.b}/x.mp4`]);
await expectFail('extensão não permitida é recusada', ids.a, `INSERT INTO messages (conversation_id, sender_id, content, media_url) VALUES ($1, $2, '', $3)`, [convAB, ids.a, `chat-media/${convAB}/${ids.a}/x.exe`]);

console.log('\nComunidades e convites para eventos');
r = await expectOk('A cria uma comunidade com aprovação', ids.a, `SELECT public.create_community('Clube Teste', 'Uma comunidade para testes.', 'discussions', '🧪', '', ARRAY['Respeito'], 'approval') AS id`);
const comA = r.rows[0].id;
r = await db.query(`SELECT role FROM community_members WHERE community_id = $1 AND user_id = $2`, [comA, ids.a]);
r.rows[0]?.role === 'admin' ? ok('quem cria vira administrador') : bad('criador sem papel de admin');
await expectFail('capa de fora do app é recusada', ids.a, `SELECT public.create_community('Clube X', 'Descrição de teste.', 'discussions', '🧪', 'https://exemplo.com/x.jpg', '{}', 'public')`);
await expectFail('B não entra direto em comunidade com aprovação', ids.b, `INSERT INTO community_members (community_id, user_id) VALUES ($1, $2)`, [comA, ids.b]);
await expectOk('B pede para entrar', ids.b, `SELECT public.community_join($1, 'oi') AS s`, [comA]);
r = await db.query(`SELECT count(*)::int AS n FROM notifications WHERE user_id = $1 AND type = 'group_join_request'`, [ids.a]);
r.rows[0].n === 1 ? ok('administração recebe o pedido') : bad('pedido sem aviso: ' + r.rows[0].n);
await expectOk('A publica na comunidade', ids.a, `INSERT INTO posts (user_id, content, community_id) VALUES ($1, 'post do clube', $2)`, [ids.a, comA]);
r = await as(ids.b, `SELECT count(*)::int AS n FROM posts WHERE community_id = $1`, [comA]);
r.rows[0].n === 0 ? ok('quem não é membro não vê publicações de comunidade fechada') : bad('publicação fechada vazou');
await expectFail('não membro não publica na comunidade', ids.b, `INSERT INTO posts (user_id, content, community_id) VALUES ($1, 'intruso', $2)`, [ids.b, comA]);
await expectFail('não moderador não aprova pedidos', ids.b, `SELECT public.community_review_request($1, $2, true)`, [comA, ids.b]);
await expectOk('A aprova o pedido de B', ids.a, `SELECT public.community_review_request($1, $2, true)`, [comA, ids.b]);
r = await as(ids.b, `SELECT count(*)::int AS n FROM posts WHERE community_id = $1`, [comA]);
r.rows[0].n === 1 ? ok('depois de aprovado, B vê as publicações') : bad('membro sem acesso');
r = await as(ids.b, `SELECT count(*)::int AS n FROM community_members WHERE community_id = $1`, [comA]);
r.rows[0].n === 2 ? ok('membros veem a lista de membros') : bad('lista de membros: ' + r.rows[0].n);
r = await as(ids.v, `SELECT count(*)::int AS n FROM community_members WHERE community_id = $1`, [comA]);
r.rows[0].n === 0 ? ok('quem está fora não vê quem participa') : bad('lista de membros vazou');
await expectFail('membro comum não muda funções', ids.b, `SELECT public.community_set_role($1, $2, 'admin')`, [comA, ids.b]);
await expectOk('A promove B a moderador', ids.a, `SELECT public.community_set_role($1, $2, 'moderator')`, [comA, ids.b]);
await expectFail('moderador não remove administrador', ids.b, `SELECT public.community_remove_member($1, $2, false, '')`, [comA, ids.a]);
await expectFail('o único administrador não pode se rebaixar', ids.a, `SELECT public.community_set_role($1, $2, 'member')`, [comA, ids.a]);

r = await expectOk('A cria comunidade secreta', ids.a, `SELECT public.create_community('Secreta', 'Só para convidados.', 'lifestyle', '🔒', '', '{}', 'private') AS id`);
const comS = r.rows[0].id;
r = await as(ids.mod, `SELECT count(*)::int AS n FROM communities WHERE id = $1`, [comS]);
r.rows[0].n === 0 ? ok('comunidade secreta fica oculta para quem não é membro') : bad('secreta visível');
await expectFail('pedido em comunidade secreta é recusado', ids.mod, `SELECT public.community_join($1, '')`, [comS]);
await expectOk('A convida mod', ids.a, `SELECT public.community_invite($1, $2)`, [comS, ids.mod]);
r = await as(ids.mod, `SELECT count(*)::int AS n FROM communities WHERE id = $1`, [comS]);
r.rows[0].n === 1 ? ok('o convidado passa a ver a comunidade') : bad('convidado não vê');
r = await as(ids.mod, `SELECT public.community_join($1, '') AS s`, [comS]);
r.rows[0].s === 'joined' ? ok('convite aceito: entra direto') : bad('convite: ' + r.rows[0].s);
await expectFail('membro comum não convida em comunidade secreta', ids.mod, `SELECT public.community_invite($1, $2)`, [comS, ids.b]);
await db.query('INSERT INTO user_blocks (blocker_id, blocked_id) VALUES ($1, $2) ON CONFLICT DO NOTHING', [ids.v, ids.a]);
await expectFail('não dá para convidar quem bloqueou', ids.a, `SELECT public.community_invite($1, $2)`, [comS, ids.v]);
await expectOk('A remove e bane mod', ids.a, `SELECT public.community_remove_member($1, $2, true, 'teste')`, [comS, ids.mod]);
await expectFail('banido não volta pelo convite antigo', ids.mod, `SELECT public.community_join($1, '')`, [comS]);
await expectOk('A sai da comunidade (é o último admin)', ids.a, `DELETE FROM community_members WHERE community_id = $1 AND user_id = $2`, [comA, ids.a]);
r = await db.query(`SELECT role FROM community_members WHERE community_id = $1 AND user_id = $2`, [comA, ids.b]);
r.rows[0]?.role === 'admin' ? ok('o moderador mais antigo assume a administração') : bad('comunidade ficou sem admin');
await expectFail('ex-membro não exclui a comunidade', ids.a, `SELECT public.delete_community($1)`, [comA]);
await expectOk('o novo admin exclui a comunidade', ids.b, `SELECT public.delete_community($1)`, [comA]);

r = await db.query(`INSERT INTO events (created_by, title, starts_at, venue_name, city, status) VALUES ($1, 'Festa teste', now() + interval '3 days', 'Casa', 'São Paulo', 'approved') RETURNING id`, [ids.mod]);
const evT = r.rows[0].id;
r = await expectOk('A convida B (conexão) e a vítima (que bloqueou A) para o evento', ids.a, `SELECT public.invite_to_event($1, ARRAY[$2, $3]::uuid[]) AS n`, [evT, ids.b, ids.v]);
r.rows[0].n === 1 ? ok('só a conexão recebe o convite') : bad('convites enviados: ' + r.rows[0].n);
r = await db.query(`SELECT link FROM notifications WHERE user_id = $1 AND type = 'event_invite'`, [ids.b]);
r.rows[0]?.link === '/eventos/' + evT ? ok('o aviso abre o evento') : bad('link do convite: ' + JSON.stringify(r.rows));
await expectFail('evento pendente não aceita convites', ids.a, `SELECT public.invite_to_event($1, ARRAY[$2]::uuid[])`,
  [(await db.query(`INSERT INTO events (created_by, title, starts_at, venue_name, city) VALUES ($1, 'Pendente', now() + interval '3 days', 'Casa', 'SP') RETURNING id`, [ids.mod])).rows[0].id, ids.b]);
await db.query('DELETE FROM user_blocks WHERE blocker_id = $1 AND blocked_id = $2', [ids.v, ids.a]);

console.log('\nPainel: indicadores da plataforma');
await expectFail('usuário comum não lê os indicadores', ids.a, `SELECT public.admin_platform_stats()`);
r = await expectOk('equipe lê os indicadores', ids.admin, `SELECT public.admin_platform_stats() AS s`, [], 'aal2');
const st14 = r.rows[0].s;
st14.users >= 5 && Array.isArray(st14.signups_14d) && st14.signups_14d.length === 14 ? ok('números e série de 14 dias') : bad('indicadores: ' + JSON.stringify(st14).slice(0, 200));
st14.signups_14d.reduce((a, x) => a + Number(x.n), 0) >= 1 ? ok('cadastros recentes aparecem na série') : bad('série vazia');

console.log('\nRevisão: privacidade das funções, índices e políticas');
r = await expectOk('A cria comunidade com aprovação (revisão)', ids.a, `SELECT public.create_community('Clube Revisão', 'Comunidade para a revisão.', 'discussions', '🧪', '', '{}', 'approval') AS id`);
const comR = r.rows[0].id;
r = await as(ids.v, `SELECT public.community_role($1, $2) AS papel, public.can_see_community($1, $2) AS ve`, [comR, ids.a]);
r.rows[0].papel === null && r.rows[0].ve === false ? ok('quem está fora não descobre quem participa pela API') : bad('vazou participação: ' + JSON.stringify(r.rows[0]));
r = await as(ids.a, `SELECT public.community_role($1) AS papel`, [comR]);
r.rows[0].papel === 'admin' ? ok('cada um continua vendo o próprio papel') : bad('papel próprio: ' + r.rows[0].papel);
await expectOk('B pede para entrar (revisão)', ids.b, `SELECT public.community_join($1, '')`, [comR]);
await expectOk('A aprova B (revisão)', ids.a, `SELECT public.community_review_request($1, $2, true)`, [comR, ids.b]);
r = await as(ids.b, `SELECT public.community_role($1, $2) AS papel`, [comR, ids.a]);
r.rows[0].papel === 'admin' ? ok('membros veem o papel dos colegas') : bad('papel do colega: ' + r.rows[0].papel);
r = await db.query(`SELECT count(*)::int AS n FROM pg_policies WHERE schemaname = 'public' AND (qual ~ '(?<!SELECT )auth\\.uid\\(\\)' OR with_check ~ '(?<!SELECT )auth\\.uid\\(\\)')`);
r.rows[0].n === 0 ? ok('todas as políticas calculam auth.uid() uma vez por consulta') : bad('políticas sem ajuste: ' + r.rows[0].n);
r = await db.query(`SELECT count(*)::int AS n FROM pg_constraint c JOIN pg_namespace n ON n.oid = c.connamespace
  WHERE c.contype = 'f' AND n.nspname = 'public' AND array_length(c.conkey, 1) = 1
    AND NOT EXISTS (SELECT 1 FROM pg_index i WHERE i.indrelid = c.conrelid AND i.indkey[0] = c.conkey[1])`);
r.rows[0].n === 0 ? ok('toda chave estrangeira tem índice') : bad('chaves sem índice: ' + r.rows[0].n);
await expectOk('A exclui a comunidade da revisão', ids.a, `SELECT public.delete_community($1)`, [comR]);

console.log('\nCrescimento: convites, antifraude, recompensas, fundadores e embaixadores');
await db.exec('RESET ROLE');
const novoId = (n) => `00000000-0000-0000-0000-0000000009${String(n).padStart(2, '0')}`;
r = await expectOk('A abre o painel Convide e Ganhe', ids.a, `SELECT public.growth_my_panel() AS p`);
const codigoA = r.rows[0].p.code;
/^[a-z0-9]{8}$/.test(codigoA) ? ok('A recebe um código de convite próprio') : bad('código: ' + codigoA);
r = await as(ids.a, `SELECT public.growth_my_panel() AS p`);
r.rows[0].p.code === codigoA ? ok('o código é o mesmo a cada acesso') : bad('código mudou');

await expectOk('visita ao link sem login é contada', null, `SELECT public.growth_track_visit($1)`, [codigoA]);
await as(null, `SELECT public.growth_track_visit('codigo-inexistente')`);
r = await db.query(`SELECT coalesce(sum(visits), 0)::int AS n FROM growth_visits`);
r.rows[0].n === 1 ? ok('só o código válido conta visita') : bad('visitas: ' + r.rows[0].n);
r = await as(null, `SELECT public.growth_public_info() AS i`);
r.rows[0].i.founders?.limit > 0 ? ok('a página inicial vê as vagas de fundador sem login') : bad('info pública: ' + JSON.stringify(r.rows[0].i));

// cadastro com convite
await db.query(`INSERT INTO auth.users VALUES ($1,'n1@x.com',$2,now())`, [novoId(1), meta('convidado1', { invite_code: codigoA.toUpperCase() })]);
r = await db.query(`SELECT referrer_id, status FROM growth_referrals WHERE referred_id = $1`, [novoId(1)]);
r.rows[0]?.referrer_id === ids.a && r.rows[0].status === 'pending' ? ok('cadastro pelo link fica registrado como indicação de A (pendente)') : bad('indicação: ' + JSON.stringify(r.rows));
await db.query(`INSERT INTO auth.users VALUES ($1,'n2@x.com',$2,now())`, [novoId(2), meta('convidado2', { invite_code: 'naoexiste' })]);
r = await db.query(`SELECT count(*)::int AS n FROM growth_referrals WHERE referred_id = $1`, [novoId(2)]);
r.rows[0].n === 0 ? ok('código inválido não cria indicação (e o cadastro segue normal)') : bad('indicação com código inválido');
r = await db.query(`SELECT count(*)::int AS n FROM profiles WHERE id = $1`, [novoId(2)]);
r.rows[0].n === 1 ? ok('o cadastro com código inválido foi concluído') : bad('cadastro falhou');
await expectFail('ninguém grava indicação direto na tabela', ids.b, `INSERT INTO growth_referrals (referred_id, referrer_id) VALUES ($1, $2)`, [ids.b, ids.a]);
await expectFail('ninguém se dá VIP direto na tabela', ids.b, `UPDATE profile_growth SET vip_until = now() + interval '1 year' WHERE user_id = $1`, [ids.b]);
await expectFail('pessoa comum não roda a validação', ids.b, `SELECT public.growth_validate()`);

// validação: só conta pessoa real
await db.query(`SELECT public.growth_validate()`);
r = await db.query(`SELECT status FROM growth_referrals WHERE referred_id = $1`, [novoId(1)]);
r.rows[0].status === 'pending' ? ok('sem foto e sem voltar ao Vybelog, a indicação continua pendente') : bad('validou cedo: ' + r.rows[0].status);
await db.query(`UPDATE profiles SET avatar_url = 'x', created_at = now() - interval '2 days' WHERE id = $1`, [novoId(1)]);
await db.query(`INSERT INTO user_presence (user_id, last_seen_at) VALUES ($1, now()) ON CONFLICT (user_id) DO UPDATE SET last_seen_at = now()`, [novoId(1)]);
await db.query(`SELECT public.growth_validate()`);
r = await db.query(`SELECT status FROM growth_referrals WHERE referred_id = $1`, [novoId(1)]);
r.rows[0].status === 'valid' ? ok('com e-mail confirmado, foto e retorno depois do cadastro, a indicação vale') : bad('não validou: ' + r.rows[0].status);
r = await db.query(`SELECT count(*)::int AS n FROM notifications WHERE user_id = $1 AND type = 'growth_referral_valid'`, [ids.a]);
r.rows[0].n === 1 ? ok('A é avisado da indicação confirmada') : bad('aviso: ' + r.rows[0].n);

// limite diário antifraude
await db.query(`UPDATE growth_settings SET value = jsonb_set(value, '{daily_valid_cap}', '1') WHERE key = 'referral_rules'`);
await db.query(`INSERT INTO auth.users VALUES ($1,'n3@x.com',$2,now())`, [novoId(3), meta('convidado3', { invite_code: codigoA })]);
await db.query(`UPDATE profiles SET avatar_url = 'x', created_at = now() - interval '2 days' WHERE id = $1`, [novoId(3)]);
await db.query(`INSERT INTO user_presence (user_id, last_seen_at) VALUES ($1, now()) ON CONFLICT (user_id) DO UPDATE SET last_seen_at = now()`, [novoId(3)]);
await db.query(`SELECT public.growth_validate()`);
r = await db.query(`SELECT status FROM growth_referrals WHERE referred_id = $1`, [novoId(3)]);
r.rows[0].status === 'pending' ? ok('acima do limite diário de validações, a indicação espera o dia seguinte') : bad('limite diário ignorado');
await db.query(`UPDATE growth_settings SET value = jsonb_set(value, '{daily_valid_cap}', '10') WHERE key = 'referral_rules'`);
await db.query(`SELECT public.growth_validate()`);

// recompensas: 5 válidas -> selo, uma única vez
for (let i = 4; i <= 6; i++) {
  await db.query(`INSERT INTO auth.users VALUES ($1,$2,$3,now())`, [novoId(i), `n${i}@x.com`, meta('convidado' + i, { invite_code: codigoA })]);
  await db.query(`UPDATE profiles SET avatar_url = 'x', created_at = now() - interval '2 days' WHERE id = $1`, [novoId(i)]);
  await db.query(`INSERT INTO user_presence (user_id, last_seen_at) VALUES ($1, now()) ON CONFLICT (user_id) DO UPDATE SET last_seen_at = now()`, [novoId(i)]);
}
await db.query(`SELECT public.growth_validate()`);
r = await db.query(`SELECT count(*)::int AS n FROM growth_referrals WHERE referrer_id = $1 AND status = 'valid'`, [ids.a]);
const validasA = r.rows[0].n;
validasA === 5 ? ok('A tem 5 indicações válidas') : bad('válidas de A: ' + validasA);
r = await db.query(`SELECT 'indicador' = ANY (badges) AS tem FROM profile_growth WHERE user_id = $1`, [ids.a]);
r.rows[0]?.tem ? ok('com 5 indicações válidas, A ganha o Selo de Indicador') : bad('selo não concedido');
await db.query(`SELECT public.growth_apply_rewards($1)`, [ids.a]);
r = await db.query(`SELECT count(*)::int AS n FROM growth_grants WHERE user_id = $1 AND source = 'referral'`, [ids.a]);
r.rows[0].n === 1 ? ok('a mesma recompensa nunca é concedida duas vezes') : bad('recompensas duplicadas: ' + r.rows[0].n);
r = await as(ids.a, `SELECT public.growth_my_panel() AS p`);
const painel = r.rows[0].p;
painel.valid === 5 && painel.signups === 5 && painel.rewards.some(x => x.threshold === 5 && x.achieved) ? ok('o painel mostra cadastros, válidas e a recompensa conquistada') : bad('painel: ' + JSON.stringify({ v: painel.valid, s: painel.signups }));
r = await as(ids.b, `SELECT * FROM growth_referrals`);
r.rows.length === 0 ? ok('B não vê as indicações de A') : bad('indicações vazaram');

// ranking e privacidade
r = await as(ids.b, `SELECT * FROM public.growth_ranking('all', false)`);
r.rows[0]?.user_id === ids.a ? ok('A aparece em 1º no ranking') : bad('ranking: ' + JSON.stringify(r.rows));
await expectOk('A prefere não aparecer no ranking', ids.a, `SELECT public.growth_set_ranking_visibility(false)`);
r = await as(ids.b, `SELECT count(*)::int AS n FROM public.growth_ranking('all', false)`);
r.rows[0].n === 0 ? ok('quem saiu do ranking não aparece') : bad('ranking ignorou a escolha');
await as(ids.a, `SELECT public.growth_set_ranking_visibility(true)`);

// fundadores
r = await db.query(`SELECT count(*)::int AS n, count(DISTINCT founder_number)::int AS d FROM profile_growth WHERE founder_number IS NOT NULL`);
r.rows[0].n > 0 && r.rows[0].n === r.rows[0].d ? ok(`fundadores numerados sem repetição (${r.rows[0].n})`) : bad('fundadores: ' + JSON.stringify(r.rows[0]));
await db.query(`UPDATE growth_settings SET value = jsonb_set(value, '{limit}', to_jsonb((SELECT count(*) FROM profile_growth WHERE founder_number IS NOT NULL)::int + 1)) WHERE key = 'founders'`);
await db.query(`INSERT INTO auth.users VALUES ($1,'n7@x.com',$2,now())`, [novoId(7), meta('convidado7')]);
await db.query(`INSERT INTO auth.users VALUES ($1,'n8@x.com',$2,now())`, [novoId(8), meta('convidado8')]);
await db.query(`UPDATE profiles SET avatar_url = 'x' WHERE id IN ($1, $2)`, [novoId(7), novoId(8)]);   // fundador exige foto (§17)
await db.query(`SELECT public.growth_validate()`);
r = await db.query(`SELECT (SELECT value ->> 'status' FROM growth_settings WHERE key = 'founders') AS s,
  (SELECT count(*)::int FROM profile_growth WHERE founder_number IS NOT NULL) AS n, (SELECT (value ->> 'limit')::int FROM growth_settings WHERE key = 'founders') AS l`);
r.rows[0].n === r.rows[0].l && r.rows[0].s === 'ended' ? ok('o limite de vagas é respeitado e a campanha encerra sozinha') : bad('vagas: ' + JSON.stringify(r.rows[0]));

// administração
await expectFail('pessoa comum não nomeia embaixador', ids.b, `SELECT public.admin_growth_set_ambassador($1, true, 'bruno-vybe', 'teste de permissão')`, [ids.b]);
await expectFail('admin sem MFA não nomeia embaixador', ids.admin, `SELECT public.admin_growth_set_ambassador($1, true, 'bruno-vybe', 'teste sem mfa')`, [ids.b], 'aal1');
await expectOk('superadmin com MFA nomeia B embaixador com link personalizado', ids.admin,
  `SELECT public.admin_growth_set_ambassador($1, true, 'bruno-vybe', 'Divulgação em eventos')`, [ids.b], 'aal2');
r = await db.query(`SELECT ambassador, 'embaixador' = ANY (badges) AS selo FROM profile_growth WHERE user_id = $1`, [ids.b]);
r.rows[0]?.ambassador && r.rows[0].selo ? ok('B recebe o selo de Embaixador') : bad('embaixador: ' + JSON.stringify(r.rows));
await expectFail('código personalizado já usado é recusado', ids.admin,
  `SELECT public.admin_growth_set_ambassador($1, true, 'bruno-vybe', 'Duplicidade de código')`, [ids.mod], 'aal2');
await db.query(`INSERT INTO auth.users VALUES ($1,'n9@x.com',$2,now())`, [novoId(9), meta('convidado9', { invite_code: 'bruno-vybe' })]);
r = await db.query(`SELECT referrer_id FROM growth_referrals WHERE referred_id = $1`, [novoId(9)]);
r.rows[0]?.referrer_id === ids.b ? ok('o link personalizado do embaixador registra a indicação') : bad('link do embaixador: ' + JSON.stringify(r.rows));

console.log('\nPadrinho VIP');
await expectFail('membro comum não marca padrinho', ids.b, `SELECT public.admin_growth_set_vip_padrinho($1, 30, 'quero ser padrinho')`, [ids.b]);
await expectFail('sem MFA não marca padrinho', ids.admin, `SELECT public.admin_growth_set_vip_padrinho($1, 30, 'Convidados VIP')`, [ids.b], 'aal1');
await expectFail('dias fora do limite são recusados', ids.admin, `SELECT public.admin_growth_set_vip_padrinho($1, 5000, 'Convidados VIP')`, [ids.b], 'aal2');
r = await expectOk('superadmin marca B como padrinho VIP de 30 dias', ids.admin, `SELECT public.admin_growth_set_vip_padrinho($1, 30, 'Convidados VIP')`, [ids.b], 'aal2');
r?.rows[0]?.admin_growth_set_vip_padrinho === 1 ? ok('quem B já convidou recebe o VIP na hora (1 pessoa)') : bad('retroativo: ' + JSON.stringify(r?.rows));
r = await db.query(`SELECT vip_until FROM profile_growth WHERE user_id = $1`, [novoId(9)]);
const dias9 = r.rows[0]?.vip_until ? (new Date(r.rows[0].vip_until) - Date.now()) / 864e5 : 0;
dias9 > 29 && dias9 <= 30.1 ? ok('o VIP vale 30 dias') : bad('vip_until: ' + JSON.stringify(r.rows));
r = await db.query(`SELECT count(*)::int AS n FROM notifications WHERE user_id = $1 AND type = 'growth_reward'`, [novoId(9)]);
r.rows[0].n >= 1 ? ok('o convidado é avisado do VIP') : bad('sem aviso');
r = await db.query(`SELECT title FROM notifications WHERE user_id = $1 AND type = 'growth_reward' ORDER BY created_at DESC LIMIT 1`, [novoId(9)]);
r.rows[0]?.title === 'Coloque foto no perfil e receba o selo VIP' ? ok('convidado sem foto é avisado para colocar a foto e receber o selo') : bad('aviso do VIP sem foto: ' + JSON.stringify(r.rows));
r = await expectOk('marcar de novo não concede em dobro', ids.admin, `SELECT public.admin_growth_set_vip_padrinho($1, 30, 'Convidados VIP')`, [ids.b], 'aal2');
r?.rows[0]?.admin_growth_set_vip_padrinho === 0 ? ok('ninguém recebe duas vezes') : bad('repetiu: ' + JSON.stringify(r?.rows));
await db.query(`INSERT INTO auth.users VALUES ($1,'n10@x.com',$2,now())`, [novoId(10), meta('convidado10', { invite_code: 'bruno-vybe' })]);
r = await db.query(`SELECT vip_until > now() + interval '29 days' AS vip FROM profile_growth WHERE user_id = $1`, [novoId(10)]);
r.rows[0]?.vip ? ok('novo cadastro pelo convite do padrinho já entra VIP') : bad('novo convidado sem VIP: ' + JSON.stringify(r.rows));
r = await as(ids.b, `SELECT * FROM growth_vip_padrinhos`);
r.rows.length === 0 ? ok('membro comum não vê a lista de padrinhos') : bad('lista exposta');
await expectFail('convidado não chama a concessão direto', ids.a, `SELECT public.growth_vip_padrinho_conceder($1, $2)`, [ids.a, ids.b]);
await expectOk('dias 0 desmarca o padrinho', ids.admin, `SELECT public.admin_growth_set_vip_padrinho($1, 0, 'Fim da parceria')`, [ids.b], 'aal2');
await db.query(`INSERT INTO auth.users VALUES ($1,'n11@x.com',$2,now())`, [novoId(11), meta('convidado11', { invite_code: 'bruno-vybe' })]);
r = await db.query(`SELECT vip_until FROM profile_growth WHERE user_id = $1`, [novoId(11)]);
!r.rows[0]?.vip_until ? ok('depois de desmarcado, novos convidados não ganham VIP') : bad('ainda concede: ' + JSON.stringify(r.rows));
await expectFail('justificativa curta é recusada', ids.admin, `SELECT public.admin_growth_grant($1, 'vip_days', 30, 'VIP', 'x')`, [ids.b], 'aal2');
await expectOk('superadmin concede 30 dias de VIP', ids.admin, `SELECT public.admin_growth_grant($1, 'vip_days', 30, '30 dias de VIP', 'Parceria de divulgação')`, [ids.b], 'aal2');
r = await db.query(`SELECT vip_until > now() + interval '29 days' AS ok FROM profile_growth WHERE user_id = $1`, [ids.b]);
r.rows[0]?.ok ? ok('o VIP de B vale por 30 dias') : bad('VIP não aplicado');
await expectOk('superadmin recusa uma indicação suspeita', ids.admin, `SELECT public.admin_growth_reject_referral($1, 'Conta suspeita de duplicidade')`, [novoId(9)], 'aal2');
r = await db.query(`SELECT count(*)::int AS n FROM admin_audit_logs WHERE action LIKE 'growth_%'`);
r.rows[0].n >= 3 ? ok('ações de crescimento ficam na auditoria') : bad('auditoria: ' + r.rows[0].n);
await expectFail('mensagem de compartilhamento sem {link} é recusada', ids.admin,
  `SELECT public.admin_growth_save_settings('share_message', '{"text": "mensagem sem o link do convite aqui"}', 'Teste de validação')`, [], 'aal2');
await expectOk('superadmin cria campanha', ids.admin,
  `SELECT public.admin_growth_save_campaign(NULL, 'verao-2027', 'Verão Vybelog', 'Convide e ganhe destaque', now(), NULL, true, 'Campanha de verão')`, [], 'aal2');
r = await as(ids.admin, `SELECT public.growth_admin_stats() AS s`, [], 'aal2');
r.rows[0].s.referrals_total >= 6 && r.rows[0].s.campaigns.length === 1 ? ok('o Growth Center mostra indicações e campanhas') : bad('growth center: ' + JSON.stringify(r.rows[0].s).slice(0, 200));
await expectFail('pessoa comum não abre o Growth Center', ids.b, `SELECT public.growth_admin_stats()`);
r = await as(ids.a, `SELECT public.growth_highlights() AS h`);
Array.isArray(r.rows[0].h.new_members) && Array.isArray(r.rows[0].h.featured) ? ok('o Descobrir recebe as seções de destaque') : bad('destaques: ' + JSON.stringify(r.rows[0].h));
!r.rows[0].h.featured.includes(ids.b) ? ok('VIP sem foto de perfil não aparece em "Em destaque"') : bad('VIP sem foto listado nos destaques');
await db.query(`UPDATE profiles SET avatar_url = 'https://x/bruno.jpg' WHERE id = $1`, [ids.b]);
r = await as(ids.a, `SELECT public.growth_highlights() AS h`);
r.rows[0].h.featured.includes(ids.b) ? ok('com foto, o perfil VIP aparece nos destaques') : bad('VIP com foto fora dos destaques');
await db.query(`DELETE FROM auth.users WHERE id::text LIKE '00000000-0000-0000-0000-0000000009%'`);
await db.query(`DELETE FROM profiles WHERE id::text LIKE '00000000-0000-0000-0000-0000000009%'`);

console.log('\nInclusão de gênero e fundador com foto');
await db.query(`INSERT INTO auth.users VALUES ('00000000-0000-0000-0000-000000000951','nb@x.com',$1,now())`,
  [meta('pessoa_nb', { profile_type: 'single_other', gender: 'Não binário', orientation: 'Pansexual' })]);
r = await db.query(`SELECT profile_type::text AS t, gender FROM profiles WHERE id = '00000000-0000-0000-0000-000000000951'`);
r.rows[0]?.t === 'single_other' && r.rows[0].gender === 'Não binário' ? ok('cadastro como "Pessoa solteira" com gênero não binário') : bad('tipo: ' + JSON.stringify(r.rows));
r = await db.query(`SELECT public.is_interested_in(ARRAY['singles_other'], 'single_other') AS a, public.is_interested_in(ARRAY['all'], 'single_other') AS b, public.is_interested_in(ARRAY['couples'], 'single_other') AS c`);
r.rows[0].a && r.rows[0].b && !r.rows[0].c ? ok('compatibilidade reconhece o novo tipo de perfil') : bad('compatibilidade: ' + JSON.stringify(r.rows[0]));
await db.query(`UPDATE growth_settings SET value = jsonb_set(value, '{status}', '"active"') || jsonb_build_object('limit', 100000) WHERE key = 'founders'`);
await db.query(`UPDATE profiles SET avatar_url = '' WHERE id = '00000000-0000-0000-0000-000000000951'`);
await db.query(`SELECT public.growth_validate()`);
r = await db.query(`SELECT founder_number FROM profile_growth WHERE user_id = '00000000-0000-0000-0000-000000000951'`);
!r.rows[0]?.founder_number ? ok('sem foto de perfil, a conta nova não recebe o número de fundador') : bad('fundador sem foto');
await db.query(`UPDATE profiles SET avatar_url = 'x' WHERE id = '00000000-0000-0000-0000-000000000951'`);
await db.query(`SELECT public.growth_validate()`);
r = await db.query(`SELECT founder_number FROM profile_growth WHERE user_id = '00000000-0000-0000-0000-000000000951'`);
r.rows[0]?.founder_number ? ok('ao colocar a foto, recebe o número de fundador') : bad('com foto não virou fundador');
r = await as(null, `SELECT public.growth_public_info() AS i`);
/foto/.test(r.rows[0].i.founders?.requirements ?? '') ? ok('o requisito da foto aparece nas informações públicas da campanha') : bad('requisito ausente');
await db.query(`DELETE FROM auth.users WHERE id = '00000000-0000-0000-0000-000000000951'`);
await db.query(`DELETE FROM profiles WHERE id = '00000000-0000-0000-0000-000000000951'`);

console.log('\nPublicidade: anúncios escolhidos para a janela');
await db.query(`INSERT INTO ads (advertiser, title, image_url, placement) VALUES ('Teste', 'Anúncio da janela', 'x', 'feed')`);
r = await db.query(`SELECT show_in_popup FROM ads WHERE title = 'Anúncio da janela'`);
r.rows[0].show_in_popup === false ? ok('anúncio novo começa fora da janela de publicidade') : bad('anúncio novo já na janela');
await expectFail('membro comum não coloca anúncio na janela', ids.b, `UPDATE ads SET show_in_popup = true WHERE title = 'Anúncio da janela'`);
await expectOk('superadmin com MFA escolhe o anúncio para a janela', ids.admin, `UPDATE ads SET show_in_popup = true WHERE title = 'Anúncio da janela'`, [], 'aal2');
r = await db.query(`SELECT show_in_popup FROM ads WHERE title = 'Anúncio da janela'`);
r.rows[0].show_in_popup === true ? ok('o anúncio passa a aparecer na janela') : bad('não salvou');
await db.query(`DELETE FROM ads WHERE title = 'Anúncio da janela'`);

console.log('\nPublicidade: frequência da janela');
r = await as(ids.b, `SELECT value FROM app_settings WHERE key = 'public.ads_popup'`);
JSON.parse(r.rows[0]?.value ?? '{}').interval_min === 2 && JSON.parse(r.rows[0]?.value ?? '{}').include_events === true ? ok('membros leem a configuração da janela (2 min, com eventos, por padrão)') : bad('frequência: ' + JSON.stringify(r.rows));
await expectFail('membro comum não muda a frequência', ids.b, `SELECT public.admin_set_ads_popup(1, 30, 'quero mais anúncios')`);
await expectFail('intervalo fora do limite é recusado', ids.admin, `SELECT public.admin_set_ads_popup(0, 5, 'teste de limite')`, [], 'aal2');
await expectOk('superadmin com MFA ajusta para a cada 2 min, até 10 por acesso', ids.admin, `SELECT public.admin_set_ads_popup(2, 10, 'Mais exposição aos anunciantes')`, [], 'aal2');
r = await db.query(`SELECT value FROM app_settings WHERE key = 'public.ads_popup'`);
const v = JSON.parse(r.rows[0].value);
v.interval_min === 2 && v.max_per_session === 10 ? ok('a nova frequência fica gravada') : bad('frequência gravada: ' + r.rows[0].value);
r = await db.query(`SELECT count(*)::int AS n FROM admin_audit_logs WHERE action = 'ads_popup_frequency'`);
r.rows[0].n === 1 ? ok('a mudança fica na auditoria') : bad('auditoria: ' + r.rows[0].n);
const v2 = JSON.parse((await db.query(`SELECT value FROM app_settings WHERE key = 'public.ads_popup'`)).rows[0].value);
v2.initial_delay_s === 10 && v2.include_events === true ? ok('a função antiga mantém espera inicial e eventos') : bad('opções perdidas: ' + JSON.stringify(v2));
await expectFail('espera inicial fora do limite é recusada', ids.admin, `SELECT public.admin_set_ads_popup(2, 10, 'teste de limite', 1, true)`, [], 'aal2');
await expectFail('membro comum não muda a janela (versão nova)', ids.b, `SELECT public.admin_set_ads_popup(1, 30, 'quero mais anúncios', 5, true)`);
await expectOk('superadmin ajusta espera inicial e desliga eventos', ids.admin, `SELECT public.admin_set_ads_popup(1, 15, 'Campanha de fim de ano', 5, false)`, [], 'aal2');
const v3 = JSON.parse((await db.query(`SELECT value FROM app_settings WHERE key = 'public.ads_popup'`)).rows[0].value);
v3.interval_min === 1 && v3.max_per_session === 15 && v3.initial_delay_s === 5 && v3.include_events === false ? ok('a configuração completa fica gravada') : bad('gravado: ' + JSON.stringify(v3));

console.log('\nPublicidade: espaço Descobrir');
await expectOk('anúncio no espaço "destaques" é aceito', ids.admin, `INSERT INTO ads (advertiser, title, placement) VALUES ('Clube', 'No Descobrir', 'destaques')`, [], 'aal2');
await expectFail('espaço desconhecido é recusado', ids.admin, `INSERT INTO ads (advertiser, title, placement) VALUES ('Clube', 'Errado', 'popup')`, [], 'aal2');
await db.query(`DELETE FROM ads WHERE advertiser = 'Clube'`);

console.log('\nEventos: edição e exclusão depois de publicados');
const evPub = (await db.query(`INSERT INTO events (created_by, title, starts_at, venue_name, city, status, is_featured, cover_url) VALUES ($1, 'Festa antiga', now() + interval '3 days', 'Clube', 'Campinas', 'approved', true, 'https://x/arte1.jpg') RETURNING id`, [ids.a])).rows[0].id;
await expectOk('organizador corrige o texto e troca a arte do evento publicado', ids.a,
  `UPDATE events SET title = 'Festa corrigida', cover_url = 'https://x/arte2.jpg', status = 'approved', is_featured = false WHERE id = $1`, [evPub]);
r = await db.query(`SELECT title, cover_url, status, is_featured, edited_at IS NOT NULL AS editado, edited_by FROM events WHERE id = $1`, [evPub]);
r.rows[0].title === 'Festa corrigida' && r.rows[0].cover_url === 'https://x/arte2.jpg' ? ok('texto e arte novos ficam gravados') : bad('edição: ' + JSON.stringify(r.rows));
r.rows[0].status === 'approved' ? ok('o evento continua publicado depois da correção') : bad('status: ' + r.rows[0].status);
r.rows[0].is_featured === true ? ok('o organizador não mexe no destaque') : bad('destaque alterado');
r.rows[0].editado && r.rows[0].edited_by === ids.a ? ok('a moderação vê que foi editado e por quem') : bad('sem marca de edição');
const evRec = (await db.query(`INSERT INTO events (created_by, title, starts_at, venue_name, city, status) VALUES ($1, 'Recusado', now() + interval '3 days', 'Clube', 'Campinas', 'rejected') RETURNING id`, [ids.a])).rows[0].id;
await as(ids.a, `UPDATE events SET status = 'approved', title = 'Reenviado' WHERE id = $1`, [evRec]);
r = await db.query(`SELECT status FROM events WHERE id = $1`, [evRec]);
r.rows[0].status === 'pending' ? ok('evento recusado editado volta para análise (não se autoaprova)') : bad('recusado virou: ' + r.rows[0].status);
await expectFail('outra pessoa não edita o evento', ids.b, `UPDATE events SET title = 'invadido' WHERE id = $1`, [evPub]);
await expectFail('outra pessoa não exclui o evento', ids.b, `DELETE FROM events WHERE id = $1`, [evPub]);
await expectFail('membro comum não usa a edição da equipe', ids.b, `SELECT public.admin_edit_event($1, '{"title":"x"}', 'tentativa indevida')`, [evPub]);
await expectFail('equipe sem MFA não edita', ids.mod, `SELECT public.admin_edit_event($1, '{"title":"x"}', 'Correção de texto')`, [evPub], 'aal1');
await expectFail('edição da equipe exige justificativa', ids.mod, `SELECT public.admin_edit_event($1, '{"title":"x"}', 'x')`, [evPub], 'aal2');
await expectFail('link de ingresso inseguro é recusado', ids.mod, `SELECT public.admin_edit_event($1, '{"ticket_url":"javascript:alert(1)"}', 'Correção do link')`, [evPub], 'aal2');
await expectOk('moderador (MFA) corrige o local', ids.mod, `SELECT public.admin_edit_event($1, '{"venue_name":"Clube Novo","price_info":""}', 'Endereço informado errado')`, [evPub], 'aal2');
r = await db.query(`SELECT venue_name, title, price_info, status, edited_by FROM events WHERE id = $1`, [evPub]);
r.rows[0].venue_name === 'Clube Novo' && r.rows[0].title === 'Festa corrigida' && r.rows[0].status === 'approved' && r.rows[0].edited_by === ids.mod
  ? ok('só o campo enviado muda e o evento segue publicado') : bad('edição da equipe: ' + JSON.stringify(r.rows));
r = await db.query(`SELECT count(*)::int AS n FROM notifications WHERE user_id = $1 AND title = 'Seu evento foi ajustado'`, [ids.a]);
r.rows[0].n === 1 ? ok('o organizador é avisado da edição da equipe') : bad('aviso de edição: ' + r.rows[0].n);
await expectFail('membro comum não usa a exclusão da equipe', ids.b, `SELECT public.admin_delete_event($1, 'tentativa indevida')`, [evPub]);
await expectOk('moderador (MFA) exclui o evento com justificativa', ids.mod, `SELECT public.admin_delete_event($1, 'Evento cancelado pelo local')`, [evPub], 'aal2');
r = await db.query(`SELECT count(*)::int AS n FROM events WHERE id = $1`, [evPub]);
r.rows[0].n === 0 ? ok('o evento sai da agenda') : bad('evento ainda existe');
r = await db.query(`SELECT count(*)::int AS n FROM admin_audit_logs WHERE action IN ('EVENT_EDIT', 'EVENT_DELETE') AND target_id = $1`, [evPub]);
r.rows[0].n === 2 ? ok('edição e exclusão ficam na auditoria') : bad('auditoria: ' + r.rows[0].n);
r = await db.query(`SELECT count(*)::int AS n FROM notifications WHERE user_id = $1 AND title = 'Seu evento foi removido'`, [ids.a]);
r.rows[0].n === 1 ? ok('o organizador é avisado da exclusão') : bad('aviso de exclusão: ' + r.rows[0].n);
await expectOk('organizador exclui o próprio evento', ids.a, `DELETE FROM events WHERE id = $1`, [evRec]);

console.log(failures ? `\n${failures} FALHA(S)` : '\nTodos os testes passaram');
process.exit(failures ? 1 : 0);
