import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import logoUrl from '../../assets/logo.png';

// Exibido quando o usuário volta pelo link de "Esqueci a senha" enviado por e-mail
export const ResetPasswordModal: React.FC = () => {
  const { updatePassword } = useApp();
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [error, setError] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password.length < 8) {
      setError('A senha deve ter pelo menos 8 caracteres.');
      return;
    }
    if (password !== confirmation) {
      setError('As senhas não coincidem.');
      return;
    }
    setIsSaving(true);
    const updateError = await updatePassword(password);
    setIsSaving(false);
    if (updateError) setError(updateError);
  };

  return (
    <div className="modal-overlay fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-[#110c1c] border border-purple-800/40 rounded-3xl p-6 sm:p-8 shadow-2xl">
        <div className="flex flex-col items-center text-center mb-6">
          <img src={logoUrl} alt="Vybelog" draggable={false} className="brand-logo w-20 h-20 rounded-full ring-1 ring-purple-400/30 mb-3 select-none" />
          <h3 className="text-xl font-bold text-white">Definir nova senha</h3>
          <p className="text-xs text-zinc-400">Escolha uma senha com pelo menos 8 caracteres.</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <input
            type="password"
            autoComplete="new-password"
            placeholder="Nova senha"
            value={password}
            onChange={e => setPassword(e.target.value)}
            required
            className="w-full px-4 py-2.5 bg-zinc-900/80 border border-purple-900/30 rounded-xl text-sm text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-purple-500"
          />
          <input
            type="password"
            autoComplete="new-password"
            placeholder="Repita a nova senha"
            value={confirmation}
            onChange={e => setConfirmation(e.target.value)}
            required
            className="w-full px-4 py-2.5 bg-zinc-900/80 border border-purple-900/30 rounded-xl text-sm text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-purple-500"
          />
          {error && <p className="text-xs text-rose-400">{error}</p>}
          <button
            type="submit"
            disabled={isSaving}
            className="w-full py-3 rounded-xl font-bold text-sm text-white bg-gradient-to-r from-purple-600 to-rose-600 hover:from-purple-500 hover:to-rose-500 cursor-pointer disabled:opacity-50"
          >
            {isSaving ? 'Salvando...' : 'Salvar nova senha'}
          </button>
        </form>
      </div>
    </div>
  );
};
