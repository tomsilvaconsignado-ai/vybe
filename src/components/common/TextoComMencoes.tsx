// Texto com @menções clicáveis: o @usuario vira link para o perfil (resolvido no banco, que respeita
// bloqueios). Hashtags e o resto do texto ficam como estão.
import React from 'react';
import { useApp } from '../../context/AppContext';
import { profileIdByUsername } from '../../lib/social';
import { notify } from './Feedback';

const MENCAO = /(@[A-Za-z0-9_]{3,50})/g;

export const TextoComMencoes: React.FC<{ texto: string }> = ({ texto }) => {
  const { setSelectedProfileId } = useApp();
  const partes = texto.split(MENCAO);
  if (partes.length === 1) return <>{texto}</>;
  const abrir = async (usuario: string) => {
    const id = await profileIdByUsername(usuario);
    if (id) setSelectedProfileId(id);
    else notify('Perfil não encontrado.');
  };
  return (
    <>
      {partes.map((p, i) =>
        i % 2 === 1 ? (
          <button key={i} type="button" onClick={e => { e.stopPropagation(); abrir(p.slice(1)); }}
            className="text-fuchsia-300 hover:text-fuchsia-200 font-semibold cursor-pointer">{p}</button>
        ) : <React.Fragment key={i}>{p}</React.Fragment>
      )}
    </>
  );
};
