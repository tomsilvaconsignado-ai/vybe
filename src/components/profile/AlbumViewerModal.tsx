import React, { useState } from 'react';
import { X, Upload, Trash2, Lock, ChevronLeft, ChevronRight } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { MediaAlbum } from '../../types';
import { deleteAlbum, deleteAlbumItem, uploadAlbumItem } from '../../lib/albums';

interface AlbumViewerModalProps {
  album: MediaAlbum;
  isOwner: boolean;
  onClose: () => void;
  onChanged: () => Promise<void>;
}

const MAX_FILE_MB = 50;

export const AlbumViewerModal: React.FC<AlbumViewerModalProps> = ({ album, isOwner, onClose, onChanged }) => {
  const { currentUser } = useApp();
  const [uploading, setUploading] = useState<string | null>(null);
  const [viewIndex, setViewIndex] = useState<number | null>(null);
  const isVault = album.visibility === 'private_vault';

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    e.target.value = '';
    for (const [index, file] of files.entries()) {
      if (file.size > MAX_FILE_MB * 1024 * 1024) {
        alert(`"${file.name}" excede o limite de ${MAX_FILE_MB} MB.`);
        continue;
      }
      setUploading(`Enviando ${index + 1} de ${files.length}...`);
      const error = await uploadAlbumItem(currentUser.id, album, file);
      if (error) alert(`Não foi possível enviar "${file.name}": ${error}`);
    }
    setUploading(null);
    await onChanged();
  };

  const handleDeleteItem = async (index: number) => {
    if (!confirm('Apagar esta foto definitivamente?')) return;
    const error = await deleteAlbumItem(album.items[index]);
    if (error) alert(`Não foi possível apagar: ${error}`);
    setViewIndex(null);
    await onChanged();
  };

  const handleDeleteAlbum = async () => {
    if (!confirm(`Apagar o álbum "${album.title}" e todas as suas fotos? Esta ação não pode ser desfeita.`)) return;
    const error = await deleteAlbum(currentUser.id, album);
    if (error) {
      alert(`Não foi possível apagar o álbum: ${error}`);
      return;
    }
    await onChanged();
    onClose();
  };

  const current = viewIndex !== null ? album.items[viewIndex] : null;

  return (
    <div className="fixed inset-0 z-50 bg-black/90 backdrop-blur-md flex items-center justify-center p-3 sm:p-4">
      <div className="max-w-3xl w-full max-h-[90vh] bg-[#130d22] border border-purple-800/40 rounded-3xl p-5 sm:p-6 shadow-2xl relative flex flex-col">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-zinc-400 hover:text-white p-1 rounded-full hover:bg-zinc-800 cursor-pointer"
          aria-label="Fechar"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="pr-10 mb-4">
          <h3 className="text-lg font-bold text-white flex items-center gap-2">
            {isVault && <Lock className="w-4 h-4 text-fuchsia-400" />}
            {album.title}
          </h3>
          {album.description && <p className="text-xs text-zinc-400 mt-0.5">{album.description}</p>}
          {isVault && (
            <p className="text-[11px] text-fuchsia-300/80 mt-1">
              Fotos do cofre são exibidas por links temporários e nunca ficam públicas.
            </p>
          )}
        </div>

        {isOwner && (
          <div className="flex flex-wrap items-center gap-2 mb-4">
            <label className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-purple-600 to-rose-600 text-white text-xs font-bold cursor-pointer ${uploading ? 'opacity-60 pointer-events-none' : ''}`}>
              <Upload className="w-4 h-4" />
              {uploading ?? 'Enviar fotos'}
              <input
                type="file"
                multiple
                accept={isVault ? 'image/jpeg,image/png,image/webp,video/mp4' : 'image/jpeg,image/png,image/webp,image/gif,video/mp4'}
                className="hidden"
                onChange={handleUpload}
              />
            </label>
            <button
              type="button"
              onClick={handleDeleteAlbum}
              className="px-3 py-2 rounded-xl text-xs font-semibold text-rose-400 hover:bg-rose-950/40 cursor-pointer"
            >
              Apagar álbum
            </button>
          </div>
        )}

        <div className="flex-1 overflow-y-auto">
          {album.items.length > 0 ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
              {album.items.map((item, index) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setViewIndex(index)}
                  className="relative aspect-square rounded-2xl overflow-hidden bg-zinc-950 group cursor-pointer"
                >
                  {item.type === 'video' ? (
                    <video src={item.url} className="w-full h-full object-cover" muted />
                  ) : (
                    <img src={item.url} alt={item.caption ?? ''} loading="lazy" className="w-full h-full object-cover group-hover:scale-105 transition-transform" />
                  )}
                </button>
              ))}
            </div>
          ) : (
            <p className="text-xs text-zinc-400 text-center py-10">
              {isOwner ? 'Este álbum ainda está vazio. Envie as primeiras fotos.' : 'Este álbum ainda não tem fotos.'}
            </p>
          )}
        </div>
      </div>

      {current && viewIndex !== null && (
        <div className="fixed inset-0 z-[60] bg-black/95 flex items-center justify-center p-4" onClick={() => setViewIndex(null)}>
          <div className="relative max-w-4xl w-full flex items-center justify-center" onClick={e => e.stopPropagation()}>
            {current.type === 'video' ? (
              <video src={current.url} controls className="max-h-[80vh] rounded-2xl" />
            ) : (
              <img src={current.url} alt={current.caption ?? ''} className="max-h-[80vh] max-w-full rounded-2xl object-contain" />
            )}
            {viewIndex > 0 && (
              <button onClick={() => setViewIndex(viewIndex - 1)} className="absolute left-2 p-2 rounded-full bg-black/60 text-white cursor-pointer" aria-label="Anterior">
                <ChevronLeft className="w-6 h-6" />
              </button>
            )}
            {viewIndex < album.items.length - 1 && (
              <button onClick={() => setViewIndex(viewIndex + 1)} className="absolute right-2 p-2 rounded-full bg-black/60 text-white cursor-pointer" aria-label="Próxima">
                <ChevronRight className="w-6 h-6" />
              </button>
            )}
            <div className="absolute top-2 right-2 flex gap-2">
              {isOwner && (
                <button onClick={() => handleDeleteItem(viewIndex)} className="p-2 rounded-full bg-black/60 text-rose-400 cursor-pointer" aria-label="Apagar foto">
                  <Trash2 className="w-5 h-5" />
                </button>
              )}
              <button onClick={() => setViewIndex(null)} className="p-2 rounded-full bg-black/60 text-white cursor-pointer" aria-label="Fechar foto">
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
