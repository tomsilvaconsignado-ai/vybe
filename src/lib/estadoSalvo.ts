// Estado de tela que sobrevive ao F5 (filtros, abas internas): guardado no sessionStorage da aba do
// navegador. Fechar a aba limpa; outras abas não são afetadas. Falha de armazenamento (modo privado,
// cota) cai no estado comum, sem quebrar a tela.
import { useEffect, useState } from 'react';

const PREFIXO = 'vybe.tela.';

function ler<T>(chave: string, inicial: T): T {
  try {
    const bruto = sessionStorage.getItem(PREFIXO + chave);
    return bruto === null ? inicial : (JSON.parse(bruto) as T);
  } catch {
    return inicial;
  }
}

export function useEstadoSalvo<T>(chave: string, inicial: T | (() => T)) {
  const [valor, setValor] = useState<T>(() => ler(chave, typeof inicial === 'function' ? (inicial as () => T)() : inicial));
  useEffect(() => {
    try { sessionStorage.setItem(PREFIXO + chave, JSON.stringify(valor)); } catch { /* sem armazenamento */ }
  }, [chave, valor]);
  return [valor, setValor] as const;
}
