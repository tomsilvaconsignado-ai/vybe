import React, { useEffect, useImperativeHandle, useRef, forwardRef } from 'react';

// Cloudflare Turnstile (CAPTCHA sem quebra-cabeça). Só aparece com VITE_TURNSTILE_SITE_KEY
// definida; sem ela o app funciona como antes (captcha desligado também no Supabase).
// O token vale uma vez: depois de cada tentativa de login/cadastro chame reset().
export const CAPTCHA_SITE_KEY: string = import.meta.env.VITE_TURNSTILE_SITE_KEY || '';
export const captchaEnabled = CAPTCHA_SITE_KEY !== '';

declare global {
  interface Window {
    turnstile?: {
      render: (el: HTMLElement, options: Record<string, unknown>) => string;
      reset: (id?: string) => void;
      remove: (id: string) => void;
    };
  }
}

const SCRIPT_URL = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
let scriptPromise: Promise<void> | null = null;

const loadScript = () => {
  scriptPromise ??= new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = SCRIPT_URL;
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => { scriptPromise = null; reject(new Error('Turnstile indisponível')); };
    document.head.appendChild(script);
  });
  return scriptPromise;
};

export interface CaptchaHandle { reset: () => void }

export const Captcha = forwardRef<CaptchaHandle, { onToken: (token: string | null) => void }>(({ onToken }, ref) => {
  const container = useRef<HTMLDivElement>(null);
  const widgetId = useRef<string | null>(null);
  const onTokenRef = useRef(onToken);
  onTokenRef.current = onToken;

  useImperativeHandle(ref, () => ({
    reset: () => {
      onTokenRef.current(null);
      if (widgetId.current) window.turnstile?.reset(widgetId.current);
    }
  }));

  useEffect(() => {
    if (!captchaEnabled) return;
    let cancelled = false;
    loadScript()
      .then(() => {
        if (cancelled || !container.current || !window.turnstile) return;
        widgetId.current = window.turnstile.render(container.current, {
          sitekey: CAPTCHA_SITE_KEY,
          theme: 'dark',
          language: 'pt-br',
          appearance: 'interaction-only',
          callback: (token: string) => onTokenRef.current(token),
          'expired-callback': () => onTokenRef.current(null),
          'error-callback': () => onTokenRef.current(null)
        });
      })
      .catch(() => onTokenRef.current(null));
    return () => {
      cancelled = true;
      if (widgetId.current) window.turnstile?.remove(widgetId.current);
      widgetId.current = null;
    };
  }, []);

  if (!captchaEnabled) return null;
  return <div ref={container} className="flex justify-center empty:hidden" />;
});
