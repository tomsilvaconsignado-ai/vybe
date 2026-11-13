// Seletor com a identidade do Vybelog, no lugar do <select> nativo (que no Android abre uma janela branca).
// Uso igual ao <select>: mesmas <option> como filhos e onChange recebe { target: { value } }.
// Celular: gaveta que sobe de baixo. Computador: menu suspenso abaixo (ou acima) do campo.
import React, { useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Check, ChevronDown } from 'lucide-react';

interface Opcao { value: string; label: React.ReactNode; texto: string; disabled?: boolean }

interface Props {
  value?: string | number | readonly string[];
  defaultValue?: string;
  onChange?: (e: { target: { value: string; name?: string } }) => void;
  children?: React.ReactNode;
  className?: string;
  disabled?: boolean;
  required?: boolean;
  name?: string;
  id?: string;
  title?: string;
  'aria-label'?: string;
}

const textoDe = (n: React.ReactNode): string =>
  n == null || typeof n === 'boolean' ? '' : typeof n === 'string' || typeof n === 'number' ? String(n)
    : Array.isArray(n) ? n.map(textoDe).join('') : React.isValidElement(n) ? textoDe((n.props as { children?: React.ReactNode }).children) : '';

function lerOpcoes(children: React.ReactNode): Opcao[] {
  const lista: Opcao[] = [];
  React.Children.forEach(children, filho => {
    if (!React.isValidElement(filho)) return;
    const p = filho.props as { value?: string | number; children?: React.ReactNode; disabled?: boolean };
    if (filho.type === React.Fragment) { lista.push(...lerOpcoes(p.children)); return; }
    const texto = textoDe(p.children);
    lista.push({ value: p.value !== undefined ? String(p.value) : texto, label: p.children, texto, disabled: p.disabled });
  });
  return lista;
}

function useCelular() {
  const [c, setC] = useState(() => typeof window !== 'undefined' && window.matchMedia('(max-width: 639px)').matches);
  useEffect(() => {
    const m = window.matchMedia('(max-width: 639px)');
    const f = () => setC(m.matches);
    m.addEventListener('change', f);
    return () => m.removeEventListener('change', f);
  }, []);
  return c;
}

export const Seletor: React.FC<Props> = ({ value, defaultValue, onChange, children, className = '', disabled, required, name, id, title, ...rest }) => {
  const opcoes = useMemo(() => lerOpcoes(children), [children]);
  const [interno, setInterno] = useState(defaultValue ?? opcoes[0]?.value ?? '');
  const atual = value !== undefined ? String(value) : interno;
  const selecionada = opcoes.find(o => o.value === atual);
  const [aberto, setAberto] = useState(false);
  const [foco, setFoco] = useState(0);
  const [pos, setPos] = useState<{ left: number; width: number; top?: number; bottom?: number; maxH: number } | null>(null);
  const gatilho = useRef<HTMLButtonElement>(null);
  const lista = useRef<HTMLUListElement>(null);
  const celular = useCelular();
  const idLista = useId();
  const rotulo = rest['aria-label'] ?? title;

  const escolher = (o: Opcao) => {
    if (o.disabled) return;
    if (value === undefined) setInterno(o.value);
    if (o.value !== atual) onChange?.({ target: { value: o.value, name } });
    setAberto(false);
    gatilho.current?.focus();
  };

  const abrir = () => {
    if (disabled) return;
    setFoco(Math.max(0, opcoes.findIndex(o => o.value === atual)));
    setAberto(true);
  };

  // Posição do menu no computador: abaixo do campo, ou acima se faltar espaço
  useLayoutEffect(() => {
    if (!aberto || celular || !gatilho.current) return;
    const medir = () => {
      const r = gatilho.current!.getBoundingClientRect();
      const abaixo = window.innerHeight - r.bottom - 12;
      const acima = r.top - 12;
      const desejado = Math.min(320, opcoes.length * 44 + 12);
      const width = Math.max(r.width, 200);
      const left = Math.min(r.left, window.innerWidth - width - 8);
      setPos(abaixo >= desejado || abaixo >= acima
        ? { left, width, top: r.bottom + 6, maxH: Math.min(320, abaixo) }
        : { left, width, bottom: window.innerHeight - r.top + 6, maxH: Math.min(320, acima) });
    };
    medir();
    window.addEventListener('resize', medir);
    window.addEventListener('scroll', medir, true);
    return () => { window.removeEventListener('resize', medir); window.removeEventListener('scroll', medir, true); };
  }, [aberto, celular, opcoes.length]);

  useEffect(() => {
    if (!aberto) return;
    lista.current?.focus();
    lista.current?.querySelector<HTMLElement>(`[data-i="${foco}"]`)?.scrollIntoView({ block: 'nearest' });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [aberto]);

  useEffect(() => {
    lista.current?.querySelector<HTMLElement>(`[data-i="${foco}"]`)?.scrollIntoView({ block: 'nearest' });
  }, [foco]);

  const teclaLista = (e: React.KeyboardEvent) => {
    const mover = (d: number) => {
      e.preventDefault();
      let i = foco;
      for (let n = 0; n < opcoes.length; n++) {
        i = (i + d + opcoes.length) % opcoes.length;
        if (!opcoes[i]!.disabled) break;
      }
      setFoco(i);
    };
    if (e.key === 'ArrowDown') mover(1);
    else if (e.key === 'ArrowUp') mover(-1);
    else if (e.key === 'Home') { e.preventDefault(); setFoco(0); }
    else if (e.key === 'End') { e.preventDefault(); setFoco(opcoes.length - 1); }
    else if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); const o = opcoes[foco]; if (o) escolher(o); }
    else if (e.key === 'Escape' || e.key === 'Tab') { e.preventDefault(); setAberto(false); gatilho.current?.focus(); }
    else if (e.key.length === 1) {
      const i = opcoes.findIndex((o, j) => j > foco && o.texto.toLowerCase().startsWith(e.key.toLowerCase()));
      const k = i >= 0 ? i : opcoes.findIndex(o => o.texto.toLowerCase().startsWith(e.key.toLowerCase()));
      if (k >= 0) setFoco(k);
    }
  };

  const itens = (
    <ul
      ref={lista}
      id={idLista}
      role="listbox"
      tabIndex={-1}
      aria-label={rotulo}
      aria-activedescendant={`${idLista}-${foco}`}
      onKeyDown={teclaLista}
      className="focus:outline-none py-1.5"
    >
      {opcoes.map((o, i) => {
        const marcada = o.value === atual;
        return (
          <li
            key={o.value + i}
            id={`${idLista}-${i}`}
            data-i={i}
            role="option"
            aria-selected={marcada}
            aria-disabled={o.disabled || undefined}
            onClick={() => escolher(o)}
            onMouseEnter={() => setFoco(i)}
            className={`mx-1.5 px-3.5 rounded-xl flex items-center gap-3 cursor-pointer select-none transition-colors ${celular ? 'min-h-[52px] text-[15px]' : 'min-h-[40px] text-sm'} ${
              o.disabled ? 'opacity-40 cursor-not-allowed' : ''
            } ${marcada ? 'bg-gradient-to-r from-purple-600/30 to-rose-600/20 text-white font-semibold' : foco === i ? 'bg-white/5 text-zinc-100' : 'text-zinc-300'}`}
          >
            <span className="flex-1 min-w-0">{o.label}</span>
            <span className={`w-5 h-5 shrink-0 rounded-full flex items-center justify-center ${marcada ? 'bg-gradient-to-br from-fuchsia-500 via-pink-500 to-orange-500' : 'border border-zinc-600'}`}>
              {marcada && <Check className="w-3 h-3 text-white" strokeWidth={3} />}
            </span>
          </li>
        );
      })}
    </ul>
  );

  return (
    <>
      <button
        ref={gatilho}
        type="button"
        id={id}
        disabled={disabled}
        title={title}
        aria-label={rotulo}
        aria-haspopup="listbox"
        aria-expanded={aberto}
        aria-controls={aberto ? idLista : undefined}
        onClick={abrir}
        onKeyDown={e => { if (['ArrowDown', 'ArrowUp', 'Enter', ' '].includes(e.key)) { e.preventDefault(); abrir(); } }}
        className={`${className} relative inline-flex items-center justify-between gap-2 text-left cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed`}
      >
        <span className="truncate min-w-0">{selecionada?.label ?? <span className="text-zinc-500">Selecione</span>}</span>
        <ChevronDown className={`w-4 h-4 shrink-0 text-zinc-400 transition-transform duration-200 ${aberto ? 'rotate-180 text-fuchsia-300' : ''}`} />
      </button>
      {/* mantém a validação "obrigatório" dos formulários */}
      {required && (
        <input tabIndex={-1} aria-hidden="true" required value={atual} onChange={() => undefined} name={name}
          className="sr-only" onFocus={() => gatilho.current?.focus()} />
      )}
      {!required && name && <input type="hidden" name={name} value={atual} />}

      {aberto && createPortal(
        celular ? (
          <div className="seletor-fundo fixed inset-0 z-[10001] bg-black/60 backdrop-blur-sm flex items-end" onClick={() => { setAberto(false); gatilho.current?.focus(); }}>
            <div
              className="seletor-gaveta w-full max-h-[75vh] flex flex-col bg-[#1a1229] border-t border-purple-700/40 rounded-t-3xl shadow-2xl shadow-purple-950/60"
              style={{ paddingBottom: 'max(0.75rem, env(safe-area-inset-bottom))' }}
              onClick={e => e.stopPropagation()}
            >
              <div className="pt-2.5 pb-1 flex justify-center"><span className="w-10 h-1 rounded-full bg-white/20" /></div>
              {rotulo && <p className="px-5 pt-1 pb-2 text-xs font-bold uppercase tracking-wider text-purple-300">{rotulo}</p>}
              <div className="overflow-y-auto overscroll-contain">{itens}</div>
            </div>
          </div>
        ) : (
          <div className="fixed inset-0 z-[10001]" onMouseDown={() => setAberto(false)}>
            {pos && (
              <div
                className="seletor-menu fixed overflow-y-auto overscroll-contain bg-[#1a1229]/95 backdrop-blur-xl border border-purple-700/40 rounded-2xl shadow-2xl shadow-purple-950/60"
                style={{ left: pos.left, width: pos.width, top: pos.top, bottom: pos.bottom, maxHeight: pos.maxH }}
                onMouseDown={e => e.stopPropagation()}
              >
                {itens}
              </div>
            )}
          </div>
        ),
        document.body
      )}
    </>
  );
};
