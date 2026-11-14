// Escolher pessoas para convidar (comunidade ou evento): mostra conexões e quem eu sigo, com busca.
// O banco confere quem pode receber o convite (bloqueios, conexão, banimento).
import React, { useMemo, useState } from 'react';
import { Check, Search, UserPlus, X } from 'lucide-react';
import { useApp } from '../../context/AppContext';

interface Props {
  titulo: string;
  ajuda?: string;
  /** pessoas que não devem aparecer (já participam, etc.) */
  excluir?: string[];
  limite?: number;
  aoFechar: () => void;
  aoConvidar: (ids: string[]) => Promise<void>;
}

export const ConvidarPessoas: React.FC<Props> = ({ titulo, ajuda, excluir = [], limite = 50, aoFechar, aoConvidar }) => {
  const { profiles, connections, following, currentUser } = useApp();
  const [busca, setBusca] = useState('');
  const [marcados, setMarcados] = useState<string[]>([]);
  const [enviando, setEnviando] = useState(false);

  const candidatos = useMemo(() => {
    const fora = new Set([...excluir, currentUser.id]);
    const conexoes = new Set(connections);
    const proximos = new Set([...connections, ...following]);
    const q = busca.trim().toLowerCase();
    return profiles
      .filter(p => proximos.has(p.id) && !fora.has(p.id))
      .filter(p => !q || p.displayName.toLowerCase().includes(q) || p.username.toLowerCase().includes(q))
      .sort((a, b) => Number(conexoes.has(b.id)) - Number(conexoes.has(a.id)) || a.displayName.localeCompare(b.displayName))
      .slice(0, 100);
  }, [profiles, connections, following, excluir, currentUser.id, busca]);

  const alternar = (id: string) =>
    setMarcados(m => (m.includes(id) ? m.filter(x => x !== id) : m.length >= limite ? m : [...m, id]));

  const enviar = async () => {
    if (!marcados.length) return;
    setEnviando(true);
    await aoConvidar(marcados);
    setEnviando(false);
    aoFechar();
  };

  return (
    <div className="modal-overlay fixed inset-0 z-[60] bg-black/80 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4" onClick={aoFechar} role="dialog" aria-modal="true" aria-label={titulo}>
      <div className="w-full sm:max-w-md max-h-[85vh] flex flex-col bg-[#130d22] border border-purple-800/40 rounded-t-3xl sm:rounded-3xl shadow-2xl" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between p-4 border-b border-purple-900/30">
          <div>
            <h2 className="text-sm font-bold text-white flex items-center gap-2"><UserPlus className="w-4 h-4 text-fuchsia-400" /> {titulo}</h2>
            {ajuda && <p className="text-[12px] text-zinc-400 mt-0.5">{ajuda}</p>}
          </div>
          <button type="button" onClick={aoFechar} className="p-1.5 rounded-full text-zinc-400 hover:text-white cursor-pointer" aria-label="Fechar"><X className="w-5 h-5" /></button>
        </div>
        <div className="p-3">
          <label className="flex items-center gap-2 px-3 py-2 rounded-xl bg-zinc-900/80 border border-purple-900/30">
            <Search className="w-4 h-4 text-zinc-500" />
            <input value={busca} onChange={e => setBusca(e.target.value)} placeholder="Buscar conexões" aria-label="Buscar pessoas"
              className="flex-1 bg-transparent text-xs text-zinc-100 placeholder-zinc-500 focus:outline-none" />
          </label>
        </div>
        <ul className="flex-1 overflow-y-auto px-2 pb-2">
          {candidatos.length === 0 && (
            <li className="p-6 text-center text-xs text-zinc-500">Ninguém por aqui. Convites vão para suas conexões e para quem você segue.</li>
          )}
          {candidatos.map(p => {
            const marcado = marcados.includes(p.id);
            return (
              <li key={p.id}>
                <button type="button" onClick={() => alternar(p.id)} aria-pressed={marcado}
                  className={`w-full flex items-center gap-3 p-2.5 rounded-xl text-left cursor-pointer transition-colors ${marcado ? 'bg-purple-900/30' : 'hover:bg-zinc-900/60'}`}>
                  <img src={p.avatarUrl} alt="" className="w-9 h-9 rounded-full object-cover bg-zinc-800" />
                  <span className="flex-1 min-w-0">
                    <span className="block text-xs font-bold text-zinc-100 truncate">{p.displayName}</span>
                    <span className="block text-[12px] text-zinc-500 truncate">@{p.username}{connections.includes(p.id) ? ' · conexão' : ''}</span>
                  </span>
                  <span className={`w-5 h-5 rounded-full border flex items-center justify-center ${marcado ? 'bg-fuchsia-500 border-fuchsia-500' : 'border-zinc-600'}`}>
                    {marcado && <Check className="w-3 h-3 text-white" />}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
        <div className="p-3 border-t border-purple-900/30">
          <button type="button" onClick={enviar} disabled={!marcados.length || enviando}
            className="w-full py-2.5 rounded-xl bg-gradient-to-r from-fuchsia-600 via-pink-600 to-orange-600 text-white text-xs font-bold disabled:opacity-40 cursor-pointer">
            {enviando ? 'Enviando…' : marcados.length ? `Convidar ${marcados.length} ${marcados.length === 1 ? 'pessoa' : 'pessoas'}` : 'Escolha quem convidar'}
          </button>
        </div>
      </div>
    </div>
  );
};
