import React from 'react';
import { Maximize, Minimize } from 'lucide-react';
import { FrameMode } from '../../lib/media';

// Como a foto entra no formato 1080x1920 (9:16) do feed e dos stories
export const FrameModeToggle: React.FC<{ value: FrameMode; onChange: (mode: FrameMode) => void; disabled?: boolean }> = ({ value, onChange, disabled }) => (
  <div>
    <span className="block text-[11px] font-semibold text-zinc-400 mb-1.5">Enquadramento da foto (1080 × 1920)</span>
    <div className="grid grid-cols-2 gap-2">
      {([
        { id: 'fill', label: 'Preencher a tela', icon: Maximize },
        { id: 'fit', label: 'Foto inteira', icon: Minimize }
      ] as const).map(opt => (
        <button
          key={opt.id}
          type="button"
          disabled={disabled}
          onClick={() => onChange(opt.id)}
          className={`py-2 rounded-xl border text-xs font-semibold flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50 ${
            value === opt.id ? 'bg-purple-950 border-purple-500 text-white' : 'bg-zinc-900/40 border-zinc-800 text-zinc-400'
          }`}
        >
          <opt.icon className="w-3.5 h-3.5" />
          {opt.label}
        </button>
      ))}
    </div>
  </div>
);
