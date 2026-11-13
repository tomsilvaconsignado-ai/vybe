import { test } from 'node:test';
import assert from 'node:assert/strict';
import { comConvite, conviteDoEndereco, linkDeConvite, mensagemComLink } from './convite';

test('lê o código de /convite/<código> e limpa o endereço', () => {
  const r = conviteDoEndereco('/convite/AbC12345', '');
  assert.equal(r?.codigo, 'abc12345');
  assert.equal(r?.caminhoLimpo, '/');
  assert.equal(r?.campanha, null);
});

test('lê ?convite= em qualquer página e preserva o resto do endereço', () => {
  const r = conviteDoEndereco('/perfil/123', '?convite=bruno-vybe&campanha=verao-2027&x=1');
  assert.equal(r?.codigo, 'bruno-vybe');
  assert.equal(r?.campanha, 'verao-2027');
  assert.equal(r?.caminhoLimpo, '/perfil/123');
  assert.equal(r?.buscaLimpa, '?x=1');
});

test('recusa códigos inválidos (injeção, tamanho, caracteres)', () => {
  assert.equal(conviteDoEndereco('/convite/<script>', ''), null);
  assert.equal(conviteDoEndereco('/convite/ab', ''), null);
  assert.equal(conviteDoEndereco('/', '?convite=' + 'a'.repeat(40)), null);
  assert.equal(conviteDoEndereco('/', ''), null);
});

test('monta links de convite e acrescenta o código a links do site', () => {
  assert.equal(linkDeConvite('https://vybelog.com.br', 'abc12345'), 'https://vybelog.com.br/convite/abc12345');
  assert.equal(linkDeConvite('https://vybelog.com.br', 'abc12345', 'verao'), 'https://vybelog.com.br/convite/abc12345?campanha=verao');
  assert.equal(comConvite('https://vybelog.com.br/comunidades/x', 'abc12345'), 'https://vybelog.com.br/comunidades/x?convite=abc12345');
  assert.equal(comConvite('https://vybelog.com.br/perfil/x', null), 'https://vybelog.com.br/perfil/x');
});

test('a mensagem do WhatsApp recebe o link', () => {
  assert.equal(mensagemComLink('Venha: {link}', 'L'), 'Venha: L');
  assert.equal(mensagemComLink('Venha', 'L'), 'Venha L');
});
