// Service worker do Vybelog: recebe as notificações push (mesmo com o app fechado ou em segundo plano)
// e, ao tocar, abre o conteúdo certo — onde login e permissões são conferidos de novo.
// Não guarda páginas nem dados em cache: o app sempre carrega a versão publicada (sem conflito de versão
// nem de sessão). A tela bloqueada recebe só o texto discreto montado pelo servidor.
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (e) => e.waitUntil(self.clients.claim()));

const ICONE = '/icons/icon-192.png?v=3';

self.addEventListener('push', (evento) => {
  let d = {};
  try { d = evento.data ? evento.data.json() : {}; } catch { d = {}; }
  evento.waitUntil((async () => {
    // Vybelog aberto e em foco: o aviso aparece dentro do app (tempo real); não duplica no sistema
    const janelas = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    const focada = janelas.find((j) => j.focused && j.visibilityState === 'visible');
    if (focada) { focada.postMessage({ tipo: 'push', link: d.link || '/notificacoes' }); return; }
    await self.registration.showNotification(d.t || 'Vybelog', {
      body: d.b || 'Você tem uma nova notificação.',
      icon: ICONE,
      badge: ICONE,
      tag: d.tag || undefined,
      renotify: !!d.tag,
      data: { link: d.link || '/notificacoes' },
    });
  })());
});

self.addEventListener('notificationclick', (evento) => {
  evento.notification.close();
  const link = String((evento.notification.data && evento.notification.data.link) || '/notificacoes');
  // só endereços internos do próprio Vybelog
  if (!link.startsWith('/') || link.startsWith('//')) return;
  const destino = new URL(link, self.location.origin);
  evento.waitUntil((async () => {
    const janelas = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    const aberta = janelas.find((j) => new URL(j.url).origin === self.location.origin);
    if (aberta) {
      await aberta.focus();
      aberta.postMessage({ tipo: 'abrir', caminho: link });
      return;
    }
    await self.clients.openWindow(destino.href);
  })());
});

// O navegador trocou a inscrição (raro): avisa a janela aberta para registrar de novo
self.addEventListener('pushsubscriptionchange', (evento) => {
  evento.waitUntil((async () => {
    const janelas = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    janelas.forEach((j) => j.postMessage({ tipo: 'reinscrever' }));
  })());
});
