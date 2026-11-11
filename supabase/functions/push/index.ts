// Vybelog — envio das notificações push (Web Push com VAPID).
//
// Chamada pelo próprio banco (pg_net logo depois de cada notificação; pg_cron a cada minuto para as
// novas tentativas e os comunicados programados), com o cabeçalho x-push-secret. Reserva lotes da fila
// (push_claim), envia cada um ao serviço de push do aparelho e devolve o resultado (push_complete):
// enviado, falha temporária (nova tentativa) ou inscrição expirada (404/410: aparelho desativado).
//
// Segredos (Supabase > Edge Functions > Secrets): PUSH_VAPID_PUBLIC, PUSH_VAPID_PRIVATE,
// PUSH_VAPID_SUBJECT e PUSH_SECRET. A chave privada fica só aqui; o app conhece apenas a pública.
import { createClient } from 'npm:@supabase/supabase-js@2';
import webpush from 'npm:web-push@3.6.7';

interface Item { id: number; endpoint: string; p256dh: string; auth: string; payload: Record<string, unknown> }

const LIMITE_MS = 25_000;

Deno.serve(async (req) => {
  if (req.method !== 'POST') return new Response('Método não permitido', { status: 405 });
  const segredo = Deno.env.get('PUSH_SECRET');
  if (!segredo || req.headers.get('x-push-secret') !== segredo) return new Response('Não autorizado', { status: 401 });

  const publica = Deno.env.get('PUSH_VAPID_PUBLIC'), privada = Deno.env.get('PUSH_VAPID_PRIVATE');
  if (!publica || !privada) return new Response('VAPID não configurado', { status: 500 });
  webpush.setVapidDetails(Deno.env.get('PUSH_VAPID_SUBJECT') ?? 'https://vybelog.com.br/', publica, privada);

  const banco = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, { auth: { persistSession: false } });
  const inicio = Date.now();
  let enviados = 0, falhas = 0;
  while (Date.now() - inicio < LIMITE_MS) {
    const { data, error } = await banco.rpc('push_claim', { p_limit: 50 });
    if (error) return Response.json({ erro: error.message }, { status: 500 });
    const lote = (data ?? []) as Item[];
    if (!lote.length) break;
    const resultados = await Promise.all(lote.map(async (i) => {
      try {
        const r = await webpush.sendNotification({ endpoint: i.endpoint, keys: { p256dh: i.p256dh, auth: i.auth } }, JSON.stringify(i.payload),
          { TTL: 60 * 60 * 24, urgency: 'high' });
        enviados++;
        return { id: i.id, ok: true, status: r.statusCode };
      } catch (e) {
        falhas++;
        const err = e as { statusCode?: number; body?: string; message?: string };
        return { id: i.id, ok: false, status: err.statusCode ?? 0, error: String(err.body || err.message || e).slice(0, 300) };
      }
    }));
    const { error: e2 } = await banco.rpc('push_complete', { p_results: resultados });
    if (e2) return Response.json({ erro: e2.message }, { status: 500 });
  }
  return Response.json({ enviados, falhas });
});
