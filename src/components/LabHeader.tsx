import React, { useState, useEffect } from 'react';
import { labAudio } from '../utils/audio';
import { Maximize2, Minimize2, HelpCircle } from 'lucide-react';
import { LabHelpModal } from './LabHelpModal';

interface Props {
  isFullscreen: boolean;
  onToggleFullscreen: () => void;
}

export const LabHeader: React.FC<Props> = ({
  isFullscreen,
  onToggleFullscreen,
}) => {
  const [isHelpOpen, setIsHelpOpen] = useState(false);

  // Đóng modal trợ năng khi bấm phím Escape
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && isHelpOpen) {
        setIsHelpOpen(false);
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isHelpOpen]);

  return (
    <header className="fixed top-0 left-0 right-0 z-30 flex items-center justify-between px-3 sm:px-6 py-2.5 bg-white/90 backdrop-blur-md border-b border-slate-200/80 shadow-xs pointer-events-auto select-none">
      {/* Khối bên trái: Logo và Tiêu đề mô hình */}
      <div className="flex items-center gap-2 sm:gap-2.5 shrink-0">
        <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg bg-transparent flex items-center justify-center text-white shadow-xs shrink-0">
          <img
            src={`${import.meta.env.BASE_URL}logo.png`}
            alt="Logo"
            className="w-5 h-5 sm:w-6 sm:h-6 object-contain"
          />
        </div>
        <h1 className="text-sm sm:text-base font-bold tracking-tight text-slate-900 whitespace-nowrap leading-none">
          Mô Hình Thí Nghiệm
        </h1>
      </div>

      {/* Khối bên phải: Nút Toàn màn hình & Nút Hướng dẫn */}
      <div className="flex items-center gap-2 shrink-0 ml-auto">
        <button
          type="button"
          tabIndex={-1}
          onClick={onToggleFullscreen}
          aria-label="Toàn màn hình"
          className="flex items-center justify-center w-8.5 h-8.5 text-slate-700 bg-white hover:bg-slate-50 border border-slate-200 rounded-lg transition-colors shadow-2xs cursor-pointer shrink-0"
        >
          {isFullscreen ? (
            <Minimize2 className="w-4 h-4 shrink-0 text-sky-600" />
          ) : (
            <Maximize2 className="w-4 h-4 shrink-0 text-slate-600" />
          )}
        </button>

        <button
          type="button"
          tabIndex={-1}
          onClick={() => {
            labAudio.playClick();
            setIsHelpOpen(true);
          }}
          aria-label="Hướng dẫn trợ năng"
          className="flex items-center justify-center w-8.5 h-8.5 text-slate-700 bg-white hover:bg-slate-50 border border-slate-200 rounded-lg transition-colors shadow-2xs cursor-pointer shrink-0"
        >
          <HelpCircle className="w-4.5 h-4.5 text-slate-600" />
        </button>
      </div>

      {/* Cửa sổ trợ năng và thông tin liên hệ */}
      <LabHelpModal
        isOpen={isHelpOpen}
        onClose={() => setIsHelpOpen(false)}
      />
    </header>
  );
};
