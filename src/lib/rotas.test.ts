// Testes das rotas (node --test via tsx): npm test
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { ESTADO_INICIAL, caminhoDoEstado, estadoDoCaminho } from './rotas';

const id = '3f2b9c1e-8a4d-4b6f-9c2e-1d5a7b8c9e0f';

test('cada tela tem o seu endereço e volta para a mesma tela', () => {
  const telas = ['feed', 'discover', 'couples', 'singles', 'compatibility', 'communities', 'events', 'connections', 'messages', 'notifications', 'profile', 'settings'];
  for (const aba of telas) {
    const caminho = caminhoDoEstado({ ...ESTADO_INICIAL, aba });
    assert.equal(estadoDoCaminho(caminho).aba, aba, `${aba} → ${caminho}`);
  }
});

test('perfil visitado, conversa e publicação sobrevivem ao F5', () => {
  assert.equal(caminhoDoEstado({ ...ESTADO_INICIAL, aba: 'profile', perfilId: id }), `/perfil/${id}`);
  assert.deepEqual(estadoDoCaminho(`/perfil/${id}`).perfilId, id);
  assert.equal(estadoDoCaminho(`/mensagens/${id}`).conversaId, id);
  assert.equal(estadoDoCaminho(`/mensagens/${id}`).aba, 'messages');
  assert.equal(estadoDoCaminho(`/publicacao/${id}`).postId, id);
});

test('link antigo ?post= continua funcionando', () => {
  assert.equal(estadoDoCaminho('/', `?post=${id}`).postId, id);
});

test('admin, barra no fim e endereço desconhecido', () => {
  assert.equal(estadoDoCaminho('/admin').admin, true);
  assert.equal(estadoDoCaminho('/eventos/').aba, 'events');
  const x = estadoDoCaminho('/qualquer-coisa');
  assert.equal(x.aba, 'feed');
  assert.equal(x.valido, false);
  assert.equal(estadoDoCaminho('/perfil/nao-e-um-id').valido, false);
});

test('meu perfil (sem id) e conversa sem id', () => {
  assert.equal(caminhoDoEstado({ ...ESTADO_INICIAL, aba: 'profile' }), '/perfil');
  assert.equal(caminhoDoEstado({ ...ESTADO_INICIAL, aba: 'messages' }), '/mensagens');
});
