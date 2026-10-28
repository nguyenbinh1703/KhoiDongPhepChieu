import React, { useState, useRef, useEffect } from 'react';
import { LaserConfig, SpecimenId } from '../types/lab';
import { labAudio } from '../utils/audio';
import {
  Sun,
  Compass,
  ChevronDown,
  ChevronUp,
  Check,
  Box,
} from 'lucide-react';

interface Props {
  laser: LaserConfig;
  selectedSpecimen: SpecimenId;
  onUpdateLaser: (partial: Partial<LaserConfig>) => void;
  onSelectSpecimen: (id: SpecimenId) => void;
}

interface SpecimenOption {
  id: SpecimenId;
  label: string;
}

// Danh mục 4 khối hình 3D chuẩn Sách Giáo Khoa Toán 11 & TCVN/ISO
const SPECIMENS_3D: SpecimenOption[] = [
  { id: 'cylinder_3d', label: 'Khối trụ' },
  { id: 'pyramid_3d', label: 'Khối chóp tứ giác' },
  { id: 'cuboid_3d', label: 'Khối hộp chữ nhật' },
  { id: 'prism_3d', label: 'Khối lăng trụ tam giác' },
];

export const LabControlDock: React.FC<Props> = ({
  laser,
  selectedSpecimen,
  onUpdateLaser,
  onSelectSpecimen,
}) => {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  const handleAngleChange = (newAngle: number) => {
    onUpdateLaser({ alpha: newAngle });
  };

  // Đóng menu lựa chọn hoặc ẩn bảng điều khiển khi nhấp ra ngoài hoặc bấm Escape
  useEffect(() => {
    const handlePointerDown = (event: MouseEvent | TouchEvent) => {
      const target = event.target as Node;
      if (isMenuOpen && menuRef.current && !menuRef.current.contains(target)) {
        setIsMenuOpen(false);
      } else if (
        !isCollapsed &&
        containerRef.current &&
        !containerRef.current.contains(target)
      ) {
        setIsMenuOpen(false);
        setIsCollapsed(true);
      }
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        if (isMenuOpen) {
          setIsMenuOpen(false);
        } else if (!isCollapsed && !document.fullscreenElement) {
          setIsCollapsed(true);
        }
      }
    };

    document.addEventListener('pointerdown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isCollapsed, isMenuOpen]);

  const handleSelect = (id: SpecimenId) => {
    labAudio.playClick();
    onSelectSpecimen(id);
    setIsMenuOpen(false);
  };

  const currentSpecimenObj = SPECIMENS_3D.find((s) => s.id === selectedSpecimen) || SPECIMENS_3D[0];

  // Nút mở lại khi bảng điều khiển đang thu gọn
  if (isCollapsed) {
    return (
      <button
        type="button"
        tabIndex={-1}
        onClick={() => {
          labAudio.playClick();
          setIsCollapsed(false);
        }}
        className="fixed bottom-3 sm:bottom-4 left-1/2 -translate-x-1/2 z-40 flex items-center gap-2 px-4 py-2 bg-slate-900 text-white rounded-xl border-2 border-slate-700 text-xs font-bold transition-all cursor-pointer hover:scale-105 active:scale-95 pointer-events-auto shadow-none"
      >
        <ChevronUp className="w-4 h-4 text-sky-400" />
        <span>Hiện bảng điều khiển</span>
      </button>
    );
  }

  return (
    <div
      ref={containerRef}
      onTouchStart={(e) => e.stopPropagation()}
      onTouchMove={(e) => e.stopPropagation()}
      className="fixed bottom-3 sm:bottom-4 left-1/2 -translate-x-1/2 z-40 flex flex-col items-center pointer-events-auto overflow-visible select-none w-[calc(100vw-1.25rem)] max-w-lg sm:max-w-xl"
    >
      {/* Nút thu gọn bảng điều khiển */}
      <button
        type="button"
        tabIndex={-1}
        onClick={() => {
          labAudio.playClick();
          setIsMenuOpen(false);
          setIsCollapsed(true);
        }}
        className="flex items-center gap-1.5 px-3 py-1 bg-white hover:bg-slate-50 text-slate-600 hover:text-slate-900 text-[11px] font-semibold rounded-full border-2 border-slate-300 mb-1.5 cursor-pointer transition-all hover:scale-105 shadow-none"
      >
        <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
        <span>Ẩn bảng điều khiển</span>
      </button>

      {/* Khung điều khiển chính: Dạng phẳng (Flat), viền 2px rõ nét làm nổi bật */}
      <div className="bg-white border-2 border-slate-300 rounded-2xl p-2.5 sm:p-3 transition-all relative overflow-visible w-full shadow-none">
        <div className="flex flex-col gap-2 sm:gap-2.5 w-full overflow-visible">

          {/* DÒNG 1: GÓC CHIẾU (Chiếm 100% chiều ngang, thanh to rõ ràng) */}
          <div className="w-full flex flex-col justify-center gap-1.5 bg-slate-50/90 px-3 sm:px-4 py-2 sm:py-2.5 rounded-xl border border-slate-200/80">
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs sm:text-[13px] font-bold text-slate-800 flex items-center gap-1.5 truncate">
                <Compass className="w-4 h-4 text-sky-600 shrink-0" />
                <span>Góc chiếu</span>
              </span>
              <span className="text-sm sm:text-base font-mono font-bold px-3 py-0.5 rounded-lg bg-sky-100 text-sky-900 border border-sky-200/70 tabular-nums shrink-0 leading-none">
                {Math.round(laser.alpha)}°
              </span>
            </div>

            <input
              type="range"
              tabIndex={-1}
              min="30"
              max="150"
              step="1"
              value={Math.round(laser.alpha)}
              onChange={(e) => handleAngleChange(parseInt(e.target.value, 10))}
              onMouseUp={(e) => (e.target as HTMLElement).blur()}
              onTouchEnd={(e) => (e.target as HTMLElement).blur()}
              aria-label="Góc chiếu laser"
              className="w-full accent-sky-600 cursor-pointer h-3 sm:h-3.5 bg-slate-200 rounded-lg touch-none"
              style={{ touchAction: 'none' }}
            />
          </div>

          {/* DÒNG 2: TỈ LỆ 4:6 (Chọn khối 3D chiếm 40%, Độ sáng chiếm 60%) */}
          <div className="flex items-center gap-2 sm:gap-2.5 w-full overflow-visible">

            {/* Ô TRÁI: CHỌN KHỐI HÌNH 3D (Tỉ lệ 4) */}
            <div ref={menuRef} className="flex-[4] min-w-0 relative">
              <button
                type="button"
                tabIndex={-1}
                onClick={() => {
                  labAudio.playClick();
                  setIsMenuOpen((prev) => !prev);
                }}
                className={`w-full h-14 sm:h-15 flex flex-col justify-center gap-0.5 sm:gap-1 px-3 sm:px-3.5 py-1.5 sm:py-2 rounded-xl border text-xs sm:text-[13px] transition-all cursor-pointer ${
                  isMenuOpen
                    ? 'bg-sky-50/90 text-sky-900 border-sky-300'
                    : 'bg-slate-50/90 hover:bg-slate-100 text-slate-800 border-slate-200/80'
                }`}
              >
                {/* Dòng 1: Tiêu đề "Khối 3D" in đậm chuẩn như 2 thanh trượt + Mũi tên mở danh sách */}
                <div className="flex items-center justify-between w-full gap-1">
                  <span className="text-xs sm:text-[13px] font-bold text-slate-800 flex items-center gap-1.5 truncate">
                    <Box className="w-4 h-4 text-indigo-600 shrink-0" />
                    <span className="truncate">Khối 3D</span>
                  </span>
                  <ChevronDown
                    className={`w-3.5 h-3.5 shrink-0 text-slate-500 transition-transform duration-200 ml-1 ${
                      isMenuOpen ? 'rotate-180' : ''
                    }`}
                  />
                </div>

                {/* Dòng 2: Tên khối hình 3D - Giữ khoảng cách dòng thoáng (leading-normal) và đệm dưới để hiển thị trọn vẹn nét chữ dài tiếng Việt (g, y, p, q) */}
                <span className="block text-xs sm:text-[13px] font-medium text-slate-600 truncate text-left w-full leading-normal pb-0.5">
                  {currentSpecimenObj.label}
                </span>
              </button>

              {/* Danh sách xổ lên chọn khối hình */}
              {isMenuOpen && (
                <div
                  onClick={(e) => e.stopPropagation()}
                  className="absolute bottom-full mb-2 sm:mb-3 left-0 w-56 sm:w-64 max-w-[calc(100vw-2rem)] bg-white border-2 border-slate-300 rounded-2xl p-2 z-50 pointer-events-auto shadow-none"
                  style={{ minWidth: '220px' }}
                >
                  <div className="px-3 py-1.5 border-b border-slate-100 mb-1 flex items-center justify-between">
                    <span className="text-[11px] font-bold text-slate-700 uppercase tracking-wider">
                      Danh sách Khối 3D
                    </span>
                  </div>
                  <div className="flex flex-col gap-0.5 max-h-60 overflow-y-auto">
                    {SPECIMENS_3D.map((item) => {
                      const active = selectedSpecimen === item.id;
                      return (
                        <button
                          key={item.id}
                          type="button"
                          tabIndex={-1}
                          onClick={(e) => {
                            e.stopPropagation();
                            handleSelect(item.id);
                          }}
                          className={`flex items-center justify-between w-full px-3 py-2 rounded-xl text-xs text-left transition-all cursor-pointer ${
                            active
                              ? 'bg-indigo-600 text-white font-semibold'
                              : 'hover:bg-slate-100 text-slate-700'
                          }`}
                        >
                          <span className="truncate leading-tight font-medium">
                            {item.label}
                          </span>
                          {active && (
                            <Check className="w-3.5 h-3.5 shrink-0 text-white ml-2" />
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>

            {/* Ô PHẢI: ĐỘ SÁNG CHÙM TIA (Tỉ lệ 6) */}
            <div className="flex-[6] min-w-0">
              <div className="w-full h-14 sm:h-15 flex flex-col justify-center gap-1.5 bg-slate-50/90 px-3 sm:px-3.5 py-2 rounded-xl border border-slate-200/80 min-w-0">
                <div className="flex items-center justify-between gap-1.5">
                  <span className="text-xs sm:text-[13px] font-bold text-slate-800 flex items-center gap-1.5 truncate">
                    <Sun className="w-4 h-4 text-amber-500 shrink-0" />
                    <span className="truncate">Độ sáng</span>
                  </span>
                </div>

                <input
                  type="range"
                  tabIndex={-1}
                  min="0.2"
                  max="1.0"
                  step="0.01"
                  value={laser.intensity}
                  onChange={(e) => {
                    const val = parseFloat(e.target.value);
                    onUpdateLaser({ intensity: Math.round(val * 100) / 100 });
                  }}
                  onMouseUp={(e) => (e.target as HTMLElement).blur()}
                  onTouchEnd={(e) => (e.target as HTMLElement).blur()}
                  aria-label="Độ sáng laser"
                  className="w-full accent-amber-500 cursor-pointer h-3 sm:h-3.5 bg-slate-200 rounded-lg touch-none"
                  style={{ touchAction: 'none' }}
                />
              </div>
            </div>

          </div>

        </div>
      </div>
    </div>
  );
};
