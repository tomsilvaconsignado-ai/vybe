import React, { useEffect, useState } from 'react';
import { KeyRound } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { supabase, translateAuthError } from '../../lib/supabase';

// Autenticação em dois fatores (TOTP) do Supabase Auth. Ao verificar, a sessão sobe para aal2,
// requisito das funções is_moderator()/is_superadmin() no banco.
export const AdminMfaGate: React.FC = () => {
  const { currentUser, refreshAdminMfa, setIsAdminMode } = useApp();
  const [factorId, setFactorId] = useState<string | null>(null);
  const [enrollment, setEnrollment] = useState<{ qrCode: string; secret: string } | null>(null);
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const loadFactors = async () => {
      const { data, error: listError } = await supabase.auth.mfa.listFactors();
      if (listError) setError(translateAuthError(listError.message));
      const verified = data?.totp.find(f => f.status === 'verified');
      if (verified) setFactorId(verified.id);
      setIsLoading(false);
    };
    loadFactors();
  }, []);

  const startEnrollment = async () => {
    setError('');
    setIsLoading(true);

    // Remove tentativas de cadastro anteriores que não foram concluídas
    const { data: factors } = await supabase.auth.mfa.listFactors();
    for (const factor of factors?.all ?? []) {
      if (factor.status === 'unverified') await supabase.auth.mfa.unenroll({ factorId: factor.id });
    }

    const { data, error: enrollError } = await supabase.auth.mfa.enroll({ factorType: 'totp', friendlyName: 'VYBE Admin' });
    setIsLoading(false);
    if (enrollError || !data) {
      setError(translateAuthError(enrollError?.message));
      return;
    }
    setFactorId(data.id);
    setEnrollment({ qrCode: data.totp.qr_code, secret: data.totp.secret });
  };

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!factorId) return;
    setError('');
    setIsLoading(true);
    const { error: verifyError } = await supabase.auth.mfa.challengeAndVerify({ factorId, code: code.trim() });
    setIsLoading(false);
    if (verifyError) {
      setError(translateAuthError(verifyError.message));
      return;
    }
    await refreshAdminMfa();
  };

  return (
    <div className="min-h-[80vh] flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-[#110a1c] border border-amber-600/40 rounded-3xl p-8 shadow-2xl text-center space-y-4">
        <div className="w-16 h-16 mx-auto rounded-2xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-400">
          <KeyRound className="w-8 h-8" />
        </div>
        <h2 className="text-xl font-bold text-white">Autenticação Multifator (MFA)</h2>

        {isLoading && <p className="text-xs text-zinc-400">Carregando...</p>}

        {!isLoading && !factorId && (
          <>
            <p className="text-xs text-zinc-400">
              O painel administrativo exige um aplicativo autenticador (Google Authenticator, Authy, 1Password etc.)
              vinculado a <strong className="text-amber-300">{currentUser.email}</strong>.
            </p>
            <button
              type="button"
              onClick={startEnrollment}
              className="w-full py-3 rounded-xl font-bold text-xs text-black bg-gradient-to-r from-amber-400 to-amber-500 hover:from-amber-300 hover:to-amber-400 cursor-pointer"
            >
              Configurar aplicativo autenticador
            </button>
          </>
        )}

        {!isLoading && factorId && (
          <form onSubmit={handleVerify} className="space-y-3">
            {enrollment ? (
              <div className="space-y-2">
                <p className="text-xs text-zinc-400">Escaneie o QR code no seu aplicativo autenticador:</p>
                <img src={enrollment.qrCode} alt="QR code MFA" className="w-44 h-44 mx-auto bg-white rounded-xl p-2" />
                <p className="text-[10px] text-zinc-500 break-all">
                  Ou digite a chave manualmente: <span className="font-mono text-zinc-300">{enrollment.secret}</span>
                </p>
              </div>
            ) : (
              <p className="text-xs text-zinc-400">
                Informe o código de 6 dígitos do seu aplicativo autenticador.
              </p>
            )}
            <input
              type="text"
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={6}
              value={code}
              onChange={e => setCode(e.target.value.replace(/\D/g, ''))}
              placeholder="000000"
              className="w-full text-center tracking-widest text-xl font-mono font-bold px-4 py-2.5 bg-zinc-900 border border-amber-500/40 rounded-xl text-white focus:outline-none focus:border-amber-400"
            />
            <button
              type="submit"
              disabled={code.length !== 6}
              className="w-full py-3 rounded-xl font-bold text-xs text-black bg-gradient-to-r from-amber-400 to-amber-500 hover:from-amber-300 hover:to-amber-400 cursor-pointer disabled:opacity-50"
            >
              Validar credencial administrativa
            </button>
          </form>
        )}

        {error && <p className="text-xs text-rose-400">{error}</p>}

        <button
          type="button"
          onClick={() => setIsAdminMode(false)}
          className="text-[11px] text-zinc-500 hover:text-zinc-300 cursor-pointer"
        >
          Voltar ao portal social
        </button>
      </div>
    </div>
  );
};
