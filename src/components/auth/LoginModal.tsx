import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { X, Lock, Mail, ArrowRight, ShieldCheck } from 'lucide-react';

export const LoginModal: React.FC = () => {
  const { setAuthModalType, login } = useApp();
  const [email, setEmail] = useState('leo.luana@vybe.app');
  const [password, setPassword] = useState('••••••••••');
  const [isLoading, setIsLoading] = useState(false);

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setTimeout(() => {
      login(email);
      setIsLoading(false);
    }, 400);
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-[#110c1c] border border-purple-800/40 rounded-3xl p-6 sm:p-8 shadow-2xl relative">
        <button
          onClick={() => setAuthModalType(null)}
          className="absolute top-5 right-5 text-zinc-400 hover:text-white p-1 rounded-full hover:bg-zinc-800 transition-colors cursor-pointer"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 rounded-xl bg-purple-600/20 border border-purple-500/30 flex items-center justify-center text-purple-400">
            <Lock className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-xl font-bold text-white">Entrar no VYBE</h3>
            <p className="text-xs text-zinc-400">Sua conexão liberal segura e privativa</p>
          </div>
        </div>

        <form onSubmit={handleLogin} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-zinc-300 mb-1">E-mail ou Usuário</label>
            <div className="relative">
              <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
              <input
                type="text"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="seuemail@exemplo.com"
                required
                className="w-full pl-10 pr-4 py-2.5 bg-zinc-900/80 border border-purple-900/30 rounded-xl text-sm text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-purple-500"
              />
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-xs font-semibold text-zinc-300">Senha</label>
              <button
                type="button"
                onClick={() => alert('Link de recuperação criptografado enviado ao seu e-mail cadastrado.')}
                className="text-[11px] text-purple-400 hover:text-purple-300"
              >
                Esqueci a senha
              </button>
            </div>
            <div className="relative">
              <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
              <input
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                required
                className="w-full pl-10 pr-4 py-2.5 bg-zinc-900/80 border border-purple-900/30 rounded-xl text-sm text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-purple-500"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className="w-full py-3 rounded-xl font-bold text-sm text-white bg-gradient-to-r from-purple-600 to-rose-600 hover:from-purple-500 hover:to-rose-500 shadow-lg shadow-purple-950/50 flex items-center justify-center gap-2 cursor-pointer transition-all disabled:opacity-50"
          >
            {isLoading ? 'Conectando...' : 'Entrar na Plataforma'}
            <ArrowRight className="w-4 h-4" />
          </button>
        </form>

        <div className="pt-4 border-t border-purple-950/40 space-y-2">
          <span className="text-[10px] uppercase font-bold text-zinc-400 block text-center">
            Acessos Rápidos para Demonstração:
          </span>

          <button
            type="button"
            onClick={() => {
              setEmail('tomsilvaconsignado@gmail.com');
              setPassword('SuperAdmin@2026!');
            }}
            className="w-full p-2 rounded-xl bg-amber-950/30 border border-amber-500/40 hover:bg-amber-950/60 text-left text-xs text-amber-300 flex items-center justify-between cursor-pointer transition-colors"
          >
            <span>👑 Tom Silva (SuperAdmin)</span>
            <span className="text-[10px] text-amber-400">tomsilvaconsignado@gmail.com</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setEmail('leo.luana@vybe.app');
              setPassword('SenhaSegura123!');
            }}
            className="w-full p-2 rounded-xl bg-purple-950/30 border border-purple-800/40 hover:bg-purple-950/60 text-left text-xs text-purple-300 flex items-center justify-between cursor-pointer transition-colors"
          >
            <span>👥 Leo & Luana (Usuário Comum)</span>
            <span className="text-[10px] text-purple-400">leo.luana@vybe.app</span>
          </button>
        </div>

        <div className="pt-4 text-center">
          <p className="text-xs text-zinc-400">
            Ainda não tem conta no VYBE?{' '}
            <button
              onClick={() => setAuthModalType('register')}
              className="text-fuchsia-400 font-bold hover:underline cursor-pointer"
            >
              Criar conta agora
            </button>
          </p>
        </div>

      </div>
    </div>
  );
};
