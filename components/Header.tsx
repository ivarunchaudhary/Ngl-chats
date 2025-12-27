import React from 'react';
import { ArrowLeft } from 'lucide-react';

interface HeaderProps {
  title: string;
  showBack?: boolean;
  onBack?: () => void;
  rightAction?: React.ReactNode;
}

export const Header: React.FC<HeaderProps> = ({ title, showBack, onBack, rightAction }) => {
  return (
    <div className="sticky top-0 z-50 bg-white/90 backdrop-blur-xl border-b border-zinc-100 px-4 h-14 flex items-center justify-between">
      <div className="flex items-center gap-3 overflow-hidden">
        {showBack && (
          <button onClick={onBack} className="p-2 -ml-2 rounded-full hover:bg-zinc-100 text-zinc-600 transition-colors">
            <ArrowLeft size={20} strokeWidth={2} />
          </button>
        )}
        <h1 className="text-base font-semibold text-zinc-900 truncate tracking-tight">
          {title}
        </h1>
      </div>
      <div className="flex items-center gap-2">
        {rightAction}
      </div>
    </div>
  );
};