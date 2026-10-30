import React, { useEffect, useRef, useState } from 'react';

// Seletor de emojis leve (sem biblioteca): os emojis são texto comum e vão junto da mensagem

const EMOJI_GROUPS: { label: string; icon: string; emojis: string[] }[] = [
  {
    label: 'Carinhas', icon: '😀',
    emojis: ['😀', '😃', '😄', '😁', '😆', '😅', '😂', '🤣', '😊', '😇', '🙂', '😉', '😌', '😍', '🥰', '😘', '😗', '😙', '😚', '😋', '😛', '😜', '🤪', '😝', '🤑', '🤗', '🤭', '🤫', '🤔', '🤐', '🤨', '😐', '😏', '😒', '🙄', '😬', '😮‍💨', '😴', '🥵', '🥶', '🥴', '😵', '🤯', '🤠', '🥳', '😎', '🤓', '🧐', '😕', '😟', '🙁', '😮', '😯', '😲', '😳', '🥺', '😢', '😭', '😱', '😤', '😡', '🤬', '😈', '👿']
  },
  {
    label: 'Amor', icon: '❤️',
    emojis: ['❤️', '🧡', '💛', '💚', '💙', '💜', '🖤', '🤍', '🤎', '💔', '❤️‍🔥', '💕', '💞', '💓', '💗', '💖', '💘', '💝', '💋', '💌', '😻', '💑', '💏', '👩‍❤️‍👨', '👨‍❤️‍👨', '👩‍❤️‍👩', '🌹', '🥀', '💐']
  },
  {
    label: 'Gestos', icon: '👋',
    emojis: ['👋', '🤚', '✋', '🖐️', '👌', '🤌', '🤏', '✌️', '🤞', '🫰', '🤟', '🤘', '🤙', '👈', '👉', '👆', '👇', '☝️', '👍', '👎', '✊', '👊', '🤛', '🤜', '👏', '🙌', '🫶', '👐', '🤲', '🤝', '🙏', '💪', '👀', '👅', '👄', '🫦']
  },
  {
    label: 'Festa', icon: '🍷',
    emojis: ['🍷', '🥂', '🍾', '🍸', '🍹', '🍺', '🍻', '🥃', '🍓', '🍒', '🍑', '🍆', '🍌', '🍫', '🍕', '🍔', '🍣', '🎉', '🎊', '🎈', '🪩', '🎶', '🎵', '💃', '🕺', '🔥', '✨', '⭐', '🌟', '💫', '🌙', '☀️', '🌈', '🏖️', '🌴', '🛏️', '🛁', '🔞', '😈', '🎭', '🗝️', '🔒']
  }
];

export const EmojiPicker: React.FC<{ onPick: (emoji: string) => void; onClose: () => void }> = ({ onPick, onClose }) => {
  const [group, setGroup] = useState(0);
  const ref = useRef<HTMLDivElement>(null);

  // Fecha ao clicar fora ou apertar Esc
  useEffect(() => {
    const onDown = (e: PointerEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    document.addEventListener('pointerdown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('pointerdown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [onClose]);

  return (
    <div
      ref={ref}
      className="absolute bottom-full left-0 mb-2 w-[min(20rem,calc(100vw-2rem))] bg-[#1a1229] border border-purple-800/50 rounded-2xl shadow-2xl z-30 overflow-hidden"
    >
      <div className="flex border-b border-purple-900/40">
        {EMOJI_GROUPS.map((g, i) => (
          <button
            key={g.label}
            type="button"
            onClick={() => setGroup(i)}
            title={g.label}
            aria-label={g.label}
            className={`flex-1 py-2 text-lg cursor-pointer ${group === i ? 'bg-purple-950/80' : 'hover:bg-zinc-900/60'}`}
          >
            {g.icon}
          </button>
        ))}
      </div>
      <div className="grid grid-cols-8 gap-0.5 p-2 max-h-52 overflow-y-auto">
        {EMOJI_GROUPS[group].emojis.map(emoji => (
          <button
            key={emoji}
            type="button"
            onClick={() => onPick(emoji)}
            className="text-xl leading-none p-1.5 rounded-lg hover:bg-purple-950/70 cursor-pointer"
          >
            {emoji}
          </button>
        ))}
      </div>
    </div>
  );
};

// Mensagem só com 1 a 3 emojis aparece grande, como nos apps de conversa
export function isEmojiOnly(text: string): boolean {
  const trimmed = text.trim();
  if (!trimmed || trimmed.length > 40) return false;
  const emoji = /\p{Extended_Pictographic}(️|‍\p{Extended_Pictographic}|\p{Emoji_Modifier})*/gu;
  const matches = trimmed.match(emoji) ?? [];
  return matches.length > 0 && matches.length <= 3 && trimmed.replace(emoji, '').replace(/[\s️‍]/g, '') === '';
}
