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

console.log(failures ? `\n${failures} FALHA(S)` : '\nTodos os testes passaram');
process.exit(failures ? 1 : 0);
