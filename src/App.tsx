/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
import { LaserConfig, SpecimenId } from './types/lab';
import { LabCanvas3D } from './components/LabCanvas3D';
import { LabHeader } from './components/LabHeader';
import { LabControlDock } from './components/LabControlDock';
import { labAudio } from './utils/audio';

interface DocumentWithFullscreen extends Document {
  webkitFullscreenElement?: Element;
  mozFullScreenElement?: Element;
  msFullscreenElement?: Element;
  webkitExitFullscreen?: () => Promise<void>;
  mozCancelFullScreen?: () => Promise<void>;
  msExitFullscreen?: () => Promise<void>;
}

interface ElementWithFullscreen extends HTMLElement {
  webkitRequestFullscreen?: () => Promise<void>;
  mozRequestFullScreen?: () => Promise<void>;
  msRequestFullscreen?: () => Promise<void>;
}

const isDocFullscreen = (): boolean => {
  if (typeof document === 'undefined') return false;
  const doc = document as DocumentWithFullscreen;
  return Boolean(
    doc.fullscreenElement ||
    doc.webkitFullscreenElement ||
    doc.mozFullScreenElement ||
    doc.msFullscreenElement
  );
};

const VALID_SPECIMENS: SpecimenId[] = [
  'cylinder_3d', 'pyramid_3d', 'cuboid_3d', 'prism_3d',
];

const parseInitialHash = () => {
  if (typeof window === 'undefined' || !window.location.hash) {
    return null;
  }
  try {
    const raw = window.location.hash.replace(/^#\/?/, '');
    const p = new URLSearchParams(raw);
    const alphaNum = parseInt(p.get('alpha') || '', 10);
    const alpha = (!isNaN(alphaNum) && alphaNum >= 30 && alphaNum <= 150) ? alphaNum : 30;
    const intensityNum = parseFloat(p.get('intensity') || '');
    const intensity = (!isNaN(intensityNum) && intensityNum >= 0.2 && intensityNum <= 1.0)
      ? Math.round(intensityNum * 100) / 100
      : 1.0;
    const spec = p.get('specimen') as SpecimenId;
    const selectedSpecimen: SpecimenId = (spec && VALID_SPECIMENS.includes(spec)) ? spec : 'cylinder_3d';

    return {
      laser: {
        alpha,
        intensity,
      },
      selectedSpecimen,
    };
  } catch (_) {
    return null;
  }
};

export default function App() {
  const initial = useRef(parseInitialHash()).current;

  // Cấu hình góc chiếu alpha (30° - 150°) và cường độ sáng
  const [laser, setLaser] = useState<LaserConfig>(
    initial?.laser ?? {
      alpha: 30,
      intensity: 1.0,
    }
  );

  const [selectedSpecimen, setSelectedSpecimen] = useState<SpecimenId>(
    initial?.selectedSpecimen ?? 'cylinder_3d'
  );
  const [is3DReady, setIs3DReady] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);

  // Chuyển đổi toàn màn hình đồng bộ
  const toggleFullscreen = () => {
    labAudio.playClick();
    const doc = document as DocumentWithFullscreen;
    const elem = document.documentElement as ElementWithFullscreen;

    if (!isDocFullscreen()) {
      if (elem.requestFullscreen) {
        elem.requestFullscreen().catch(() => {});
      } else if (elem.webkitRequestFullscreen) {
        elem.webkitRequestFullscreen();
      } else if (elem.mozRequestFullScreen) {
        elem.mozRequestFullScreen();
      } else if (elem.msRequestFullscreen) {
        elem.msRequestFullscreen();
      }
    } else {
      if (doc.exitFullscreen) {
        doc.exitFullscreen().catch(() => {});
      } else if (doc.webkitExitFullscreen) {
        doc.webkitExitFullscreen();
      } else if (doc.mozCancelFullScreen) {
        doc.mozCancelFullScreen();
      } else if (doc.msExitFullscreen) {
        doc.msExitFullscreen();
      }
    }
  };

  // Đồng bộ trạng thái toàn màn hình, quản lý phím tắt và khóa focus
  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(isDocFullscreen());
    };

    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      const k = (e.key || '').toLowerCase();
      const c = e.code || '';
      const isCtrl = e.ctrlKey || e.metaKey;

      // 1. Chặn phím Tab và phím Space để tránh nhảy focus ngoài ý muốn
      if (e.key === 'Tab' || e.key === ' ' || c === 'Space') {
        e.preventDefault();
        e.stopPropagation();
        return;
      }

      // 2. Phím F11: Chặn mặc định trình duyệt, đồng bộ HTML5 Fullscreen API
      if (e.key === 'F11') {
        e.preventDefault();
        e.stopPropagation();
        toggleFullscreen();
        return;
      }

      // 3. Phím Escape: Thoát toàn màn hình nếu đang bật
      if (e.key === 'Escape' && isDocFullscreen()) {
        const doc = document as DocumentWithFullscreen;
        if (doc.exitFullscreen) {
          doc.exitFullscreen().catch(() => {});
        } else if (doc.webkitExitFullscreen) {
          doc.webkitExitFullscreen();
        }
        return;
      }

      // 4. Khóa phím F12 mở DevTools
      if (e.keyCode === 123 || k === 'f12' || c === 'F12') {
        e.preventDefault();
        e.stopPropagation();
        return;
      }

      // 5. Khóa các tổ hợp phím Ctrl/Cmd mở mã nguồn, in ấn, lưu trang
      if (isCtrl) {
        if (
          k === 'u' || c === 'KeyU' ||
          k === 's' || c === 'KeyS' ||
          k === 'p' || c === 'KeyP' ||
          k === 'a' || c === 'KeyA' ||
          (e.shiftKey && (k === 'i' || k === 'j' || k === 'c' || c === 'KeyI' || c === 'KeyJ' || c === 'KeyC' || c === 'KeyS'))
        ) {
          e.preventDefault();
          e.stopPropagation();
          return;
        }
      }

      // 6. Khóa tổ hợp phím tắt trên macOS (Cmd + Option + I/J/C/U)
      if (e.metaKey && e.altKey) {
        if (k === 'i' || k === 'j' || k === 'c' || k === 'u' || c === 'KeyI' || c === 'KeyJ' || c === 'KeyC' || c === 'KeyU') {
          e.preventDefault();
          e.stopPropagation();
          return;
        }
      }
    };

    // Triệt tiêu trạng thái focus sau khi click chuột hoặc chạm cảm ứng
    const handlePointerUp = () => {
      if (document.activeElement && typeof (document.activeElement as HTMLElement).blur === 'function') {
        (document.activeElement as HTMLElement).blur();
      }
    };

    // Ngăn chặn focus vào các thành phần giao diện không phải ô nhập liệu
    const handleFocusIn = (e: FocusEvent) => {
      const target = e.target as HTMLElement | null;
      if (target && target.tagName !== 'INPUT') {
        target.blur();
      }
    };

    document.addEventListener('fullscreenchange', handleFullscreenChange);
    document.addEventListener('webkitfullscreenchange', handleFullscreenChange);
    document.addEventListener('mozfullscreenchange', handleFullscreenChange);
    document.addEventListener('MSFullscreenChange', handleFullscreenChange);

    window.addEventListener('keydown', handleGlobalKeyDown, true);
    window.addEventListener('pointerup', handlePointerUp);
    window.addEventListener('focusin', handleFocusIn);

    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
      document.removeEventListener('webkitfullscreenchange', handleFullscreenChange);
      document.removeEventListener('mozfullscreenchange', handleFullscreenChange);
      document.removeEventListener('MSFullscreenChange', handleFullscreenChange);

      window.removeEventListener('keydown', handleGlobalKeyDown, true);
      window.removeEventListener('pointerup', handlePointerUp);
      window.removeEventListener('focusin', handleFocusIn);
    };
  }, []);

  // Tự động đồng bộ hóa trạng thái thí nghiệm vào URL Hash (debounce 600ms)
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const timeoutId = window.setTimeout(() => {
      try {
        const params = new URLSearchParams();
        params.set('alpha', Math.round(laser.alpha).toString());
        params.set('specimen', selectedSpecimen);
        if (laser.intensity < 0.99) {
          params.set('intensity', (Math.round(laser.intensity * 100) / 100).toString());
        }

        const hashStr = '#' + params.toString();
        if (window.location.hash !== hashStr) {
          window.history.replaceState(null, '', hashStr);
        }
      } catch (_) {
        // Bỏ qua lỗi nếu trình duyệt giới hạn replaceState
      }
    }, 600);

    return () => window.clearTimeout(timeoutId);
  }, [laser.alpha, laser.intensity, selectedSpecimen]);

  const handleUpdateLaser = (partial: Partial<LaserConfig>) => {
    setLaser((prev) => ({ ...prev, ...partial }));
  };

  // Chặn menu ngữ cảnh chuột phải và kéo thả tài nguyên
  useEffect(() => {
    const handleContextMenu = (e: MouseEvent) => {
      e.preventDefault();
      return false;
    };

    const handleDragStart = (e: DragEvent) => {
      e.preventDefault();
      return false;
    };

    document.addEventListener('contextmenu', handleContextMenu, { capture: true });
    document.addEventListener('dragstart', handleDragStart, { capture: true });

    return () => {
      document.removeEventListener('contextmenu', handleContextMenu, { capture: true });
      document.removeEventListener('dragstart', handleDragStart, { capture: true });
    };
  }, []);

  return (
    <div className="relative w-screen h-screen h-[100dvh] overflow-hidden bg-slate-100 flex flex-col font-sans select-none overscroll-none">
      {/* Màn hình tải ban đầu */}
      {!is3DReady && (
        <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-slate-50/95 backdrop-blur-xs pointer-events-none transition-opacity duration-300">
          <div className="w-9 h-9 rounded-full border-[3px] border-slate-200 border-t-sky-600 animate-spin mb-3.5" />
          <span className="text-[15px] font-semibold text-slate-700 tracking-tight">
            Đang tải...
          </span>
        </div>
      )}

      {/* 1. Thanh tiêu đề và nút toàn màn hình */}
      <LabHeader
        isFullscreen={isFullscreen}
        onToggleFullscreen={toggleFullscreen}
      />

      {/* 2. Không gian thí nghiệm 3D (Phép chiếu song song chuẩn SGK) */}
      <main className="absolute inset-0 w-full h-full">
        <LabCanvas3D
          specimenId={selectedSpecimen}
          laser={laser}
          onReady={() => setIs3DReady(true)}
        />
      </main>

      {/* 3. Bảng điều khiển tinh gọn */}
      <LabControlDock
        laser={laser}
        selectedSpecimen={selectedSpecimen}
        onUpdateLaser={handleUpdateLaser}
        onSelectSpecimen={(id) => setSelectedSpecimen(id)}
      />
    </div>
  );
}
