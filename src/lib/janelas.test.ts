import { test } from 'node:test';
import assert from 'node:assert/strict';
import { marcarConviteAberto, proximoDoRevezamento, publicidadeLiberada } from './janelas';

test('a publicidade espera o intervalo depois da janela de convite e nunca aparece junto', () => {
  assert.equal(publicidadeLiberada(45_000), true);            // convite não apareceu neste acesso
  marcarConviteAberto(true);
  assert.equal(publicidadeLiberada(45_000), false);           // convite aberto: nunca juntas
  marcarConviteAberto(false);
  const fechou = Date.now();
  assert.equal(publicidadeLiberada(45_000, fechou + 10_000), false);   // logo em seguida: não
  assert.equal(publicidadeLiberada(45_000, fechou + 46_000), true);    // depois do intervalo: sim
});

test('o revezamento percorre todos os anúncios em ordem', () => {
  const memoria = new Map<string, string>();
  (globalThis as any).localStorage = { getItem: (k: string) => memoria.get(k) ?? null, setItem: (k: string, v: string) => memoria.set(k, v) };
  assert.deepEqual([0, 1, 2, 3].map(() => proximoDoRevezamento(3, 'teste')), [0, 1, 2, 0]);
  assert.equal(proximoDoRevezamento(0, 'teste'), -1);
  delete (globalThis as any).localStorage;
});
