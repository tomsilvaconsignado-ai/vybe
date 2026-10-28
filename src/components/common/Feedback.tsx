import React, { useEffect, useRef, useState } from 'react';
import { CheckCircle2, AlertCircle, Info } from 'lucide-react';

// Avisos e confirmações no visual do Vybelog, no lugar de alert/confirm/prompt do navegador.
// Funções soltas (notify, askConfirm, askText) para serem chamadas de qualquer lugar;
// <FeedbackHost /> fica montado uma vez no App e desenha o que estiver pendente.

type ToastKind = 'success' | 'error' | 'info';
interface Toast { id: number; message: string; kind: ToastKind }

interface ConfirmOptions {
  title?: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  danger?: boolean;
}
interface TextOptions extends ConfirmOptions {
  placeholder?: string;
  defaultValue?: string;
  multiline?: boolean;
}
type Dialog =
  | { id: number; type: 'confirm'; options: ConfirmOptions; resolve: (ok: boolean) => void }
  | { id: number; type: 'text'; options: TextOptions; resolve: (value: string | null) => void };

let nextId = 1;
let toasts: Toast[] = [];
let dialogs: Dialog[] = [];
const listeners = new Set<() => void>();
const emit = () => listeners.forEach(l => l());

const ERROR_HINT = /não foi possível|negad|erro|falh|inválid|não confere|não pode|obrigatóri|deve |precisa|apenas|restrit|não realizada|aguarde/i;
const SUCCESS_HINT = /enviad|recebid|salv|exportad|excluíd|criad|publicad|aprovad|atualizad|removid|liberad|desbloque|bloquead/i;

export function notify(value: unknown, kind?: ToastKind) {
  const message = String(value ?? '');
  const resolved: ToastKind = kind ?? (ERROR_HINT.test(message) ? 'error' : SUCCESS_HINT.test(message) ? 'success' : 'info');
  const toast = { id: nextId++, message, kind: resolved };
  toasts = [...toasts.slice(-2), toast];
  emit();
  window.setTimeout(() => {
    toasts = toasts.filter(t => t.id !== toast.id);
    emit();
  }, Math.min(6000, 2600 + message.length * 30));
}

export function askConfirm(options: ConfirmOptions | string): Promise<boolean> {
  const opts = typeof options === 'string' ? { message: options } : options;
  return new Promise(resolve => {
    dialogs = [...dialogs, { id: nextId++, type: 'confirm', options: opts, resolve }];
    emit();
  });
}

export function askText(options: TextOptions | string): Promise<string | null> {
  const opts = typeof options === 'string' ? { message: options } : options;
  return new Promise(resolve => {
    dialogs = [...dialogs, { id: nextId++, type: 'text', options: opts, resolve }];
    emit();
  });
}

const closeDialog = (dialog: Dialog, value: boolean | string | null) => {
  dialogs = dialogs.filter(d => d !== dialog);
  emit();
  if (dialog.type === 'confirm') dialog.resolve(value === true);
  else dialog.resolve(typeof value === 'string' ? value : null);
};

const TOAST_ICON = { success: CheckCircle2, error: AlertCircle, info: Info };
const TOAST_COLOR = { success: 'text-emerald-400', error: 'text-rose-400', info: 'text-fuchsia-300' };

const DialogCard: React.FC<{ dialog: Dialog }> = ({ dialog }) => {
  const { options } = dialog;
  const [text, setText] = useState(dialog.type === 'text' ? dialog.options.defaultValue ?? '' : '');
  const inputRef = useRef<HTMLInputElement & HTMLTextAreaElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') closeDialog(dialog, dialog.type === 'confirm' ? false : null); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [dialog]);

  const confirm = () => closeDialog(dialog, dialog.type === 'confirm' ? true : text);
  const cancel = () => closeDialog(dialog, dialog.type === 'confirm' ? false : null);

  return (
    <div className="feedback-backdrop fixed inset-0 z-[10002] bg-black/70 backdrop-blur-sm flex items-center justify-center p-6" onClick={cancel}>
      <div
        role="alertdialog"
        aria-modal="true"
        onClick={e => e.stopPropagation()}
        className="feedback-dialog w-full max-w-[300px] bg-[#1a1229] border border-purple-800/40 rounded-3xl overflow-hidden shadow-2xl shadow-purple-950/60 text-center"
      >
        <div className="px-6 pt-6 pb-5">
          {options.title && <h3 className="text-base font-bold text-white mb-1.5">{options.title}</h3>}
          <p className={`text-sm leading-relaxed ${options.title ? 'text-zinc-400' : 'text-zinc-200'}`}>{options.message}</p>
          {dialog.type === 'text' && (
            dialog.options.multiline ? (
              <textarea
                ref={inputRef}
                value={text}
                onChange={e => setText(e.target.value)}
                placeholder={dialog.options.placeholder}
                rows={3}
                className="mt-4 w-full px-3 py-2.5 rounded-xl bg-zinc-900/80 border border-purple-900/40 text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-purple-500 resize-none"
              />
            ) : (
              <input
                ref={inputRef}
                value={text}
                onChange={e => setText(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') confirm(); }}
                placeholder={dialog.options.placeholder}
                className="mt-4 w-full px-3 py-2.5 rounded-xl bg-zinc-900/80 border border-purple-900/40 text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-purple-500"
              />
            )
          )}
        </div>
        <button
          type="button"
          onClick={confirm}
          className={`w-full py-3.5 border-t border-purple-900/40 text-sm font-bold active:bg-white/5 cursor-pointer ${options.danger ? 'text-rose-400' : 'text-fuchsia-300'}`}
        >
          {options.confirmLabel ?? 'Confirmar'}
        </button>
        <button
          type="button"
          onClick={cancel}
          className="w-full py-3.5 border-t border-purple-900/40 text-sm text-zinc-300 active:bg-white/5 cursor-pointer"
        >
          {options.cancelLabel ?? 'Cancelar'}
        </button>
      </div>
    </div>
  );
};

export const FeedbackHost: React.FC = () => {
  const [, force] = useState(0);
  useEffect(() => {
    const listener = () => force(n => n + 1);
    listeners.add(listener);
    return () => { listeners.delete(listener); };
  }, []);

  const dialog = dialogs[0];

  return (
    <>
      <div
        aria-live="polite"
        className="fixed inset-x-0 z-[10003] flex flex-col items-center gap-2 px-4 pointer-events-none bottom-[calc(5.5rem+env(safe-area-inset-bottom))] lg:bottom-8"
      >
        {toasts.map(t => {
          const Icon = TOAST_ICON[t.kind];
          return (
            <div
              key={t.id}
              className="feedback-toast pointer-events-auto max-w-sm w-full sm:w-auto flex items-start gap-2.5 px-4 py-3 rounded-2xl bg-[#1a1229]/95 backdrop-blur-xl border border-purple-800/40 shadow-2xl shadow-black/50 text-sm text-zinc-100"
            >
              <Icon className={`w-5 h-5 shrink-0 ${TOAST_COLOR[t.kind]}`} />
              <span className="leading-snug">{t.message}</span>
            </div>
          );
        })}
      </div>
      {dialog && <DialogCard key={dialog.id} dialog={dialog} />}
    </>
  );
};
