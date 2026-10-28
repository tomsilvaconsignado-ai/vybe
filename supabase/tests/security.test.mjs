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

console.log('\nModo discreto');
await expectOk('B ativa modo discreto', ids.b, `UPDATE profiles SET discreet_mode_enabled = true, last_active_at = now() WHERE id = $1`, [ids.b]);
r = await db.query(`SELECT last_active_at = date_trunc('day', last_active_at) AS rounded FROM profiles WHERE id = $1`, [ids.b]);
r.rows[0].rounded ? ok('última atividade guardada só com o dia') : bad('horário exato exposto');

console.log(failures ? `\n${failures} FALHA(S)` : '\nTodos os testes passaram');
process.exit(failures ? 1 : 0);
