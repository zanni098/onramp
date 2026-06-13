import React, { useEffect } from 'react';
import { X } from 'lucide-react';

// OKX-style modal: dimmed blurred backdrop, sharp #121212 panel, scale-in.
// Closes on backdrop click and Escape.

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  subtitle?: string;
  width?: number;
  children: React.ReactNode;
}

const Modal = ({ open, onClose, title, subtitle, width = 440, children }: ModalProps) => {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 okx-backdrop"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      role="dialog"
      aria-modal="true"
      aria-label={title}
    >
      <div
        className="okx-panel okx-pop w-full"
        style={{ maxWidth: width }}
      >
        <div className="flex items-start justify-between px-6 pt-6 pb-1">
          <div>
            {title && (
              <h3 className="text-lg font-semibold text-white tracking-tight">{title}</h3>
            )}
            {subtitle && <p className="text-[13px] text-sub mt-0.5">{subtitle}</p>}
          </div>
          <button
            onClick={onClose}
            aria-label="Close"
            className="p-1.5 -m-1.5 rounded-lg text-sub hover:text-white hover:bg-white/5 transition"
          >
            <X size={18} />
          </button>
        </div>
        <div className="px-6 pb-6 pt-3">{children}</div>
      </div>
    </div>
  );
};

export default Modal;
