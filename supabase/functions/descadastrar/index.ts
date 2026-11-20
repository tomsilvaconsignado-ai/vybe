// Descadastro dos e-mails de comunicados do Vybelog.
// Link: /functions/v1/descadastrar?e=<email>&t=<hmac-sha256(email) em hex>
// A assinatura usa o segredo EMAIL_OPTOUT_SECRET, o mesmo usado ao gerar os e-mails.
import { createClient } from 'npm:@supabase/supabase-js@2';

const pagina = (titulo: string, texto: string, status = 200) =>
  new Response(
    `<!DOCTYPE html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${titulo} — Vybelog</title></head>
<body style="margin:0;background:#08060c;font-family:Arial,Helvetica,sans-serif;color:#e4e4e7;display:flex;min-height:100vh;align-items:center;justify-content:center;padding:16px;box-sizing:border-box">
<div style="max-width:440px;background:#110c1c;border:1px solid #3b1f5e;border-radius:20px;padding:32px;text-align:center">
<div style="font-size:22px;font-weight:900;letter-spacing:2px;color:#f2a5b8;margin-bottom:16px">Vybelog</div>
<h1 style="font-size:19px;color:#fff;margin:0 0 12px">${titulo}</h1>
<p style="margin:0 0 20px;line-height:1.6">${texto}</p>
<a href="https://vybelog.com.br/" style="color:#c4b5fd">Ir para o Vybelog</a></div></body></html>`,
    { status, headers: { 'Content-Type': 'text/html; charset=utf-8' } },
  );

const hex = (buf: ArrayBuffer) => [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, '0')).join('');

Deno.serve(async (req) => {
  const url = new URL(req.url);
  const email = (url.searchParams.get('e') || '').trim().toLowerCase();
  const token = (url.searchParams.get('t') || '').trim().toLowerCase();
  const segredo = Deno.env.get('EMAIL_OPTOUT_SECRET') || '';
  if (!email || !token || !segredo) return pagina('Link inválido', 'Este link de descadastro está incompleto.', 400);

  const chave = await crypto.subtle.importKey('raw', new TextEncoder().encode(segredo), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const esperado = hex(await crypto.subtle.sign('HMAC', chave, new TextEncoder().encode(email)));
  if (esperado !== token) return pagina('Link inválido', 'Este link de descadastro não é válido.', 400);

  const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
  const { error } = await supabase.from('email_descadastros').upsert({ email }, { onConflict: 'email' });
  if (error) return pagina('Não foi possível concluir', 'Tente de novo em alguns minutos.', 500);

  // Envio de um clique pelo cliente de e-mail (List-Unsubscribe-Post)
  if (req.method === 'POST') return new Response('ok');
  return pagina('Pronto, você saiu da lista', 'Você não vai mais receber comunicados do Vybelog por e-mail. Os e-mails da sua conta (senha, confirmação) continuam funcionando.');
});
