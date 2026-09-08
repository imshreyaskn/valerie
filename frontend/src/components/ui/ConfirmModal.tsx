import React, { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { AlertTriangle, X } from 'lucide-react';
import { ActionButton } from './ActionButton';

export interface ConfirmModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  subtitle?: string;
  description: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: 'danger' | 'warning' | 'default';
  isPending?: boolean;
}

export const ConfirmModal: React.FC<ConfirmModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
  title,
  subtitle,
  description,
  confirmLabel = 'CONFIRM',
  cancelLabel = 'CANCEL',
  variant = 'danger',
  isPending = false,
}) => {
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (!isOpen) return;
      if (e.key === 'Escape') onClose();
      if (e.key === 'Enter' && !isPending) {
        onConfirm();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isOpen, onClose, onConfirm, isPending]);

  if (typeof document === 'undefined') return null;

  return createPortal(
    <AnimatePresence>
      {isOpen && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center p-4 select-none font-mono"
          role="dialog"
          aria-modal="true"
          aria-labelledby="confirm-modal-title"
        >
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="fixed inset-0 bg-slate/60 backdrop-blur-xs"
            onClick={onClose}
          />

          {/* Dialog Body */}
          <motion.div
            initial={{ opacity: 0, scale: 0.96, y: 8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 8 }}
            transition={{ duration: 0.2, ease: 'easeOut' }}
            className="relative w-full max-w-md bg-parchment border border-hairline shadow-2xl overflow-hidden"
          >
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-3.5 bg-linen/70 hairline-bottom">
              <div className="flex items-center gap-2">
                <span className={`w-2 h-2 rounded-full ${variant === 'danger' ? 'bg-maroon' : 'bg-camel'}`} />
                <span className="text-[10px] font-bold tracking-widest text-slate uppercase">
                  {subtitle || 'SYSTEM CONFIRMATION'}
                </span>
              </div>
              <button
                onClick={onClose}
                className="text-steel hover:text-slate p-0.5 transition-colors cursor-pointer"
                aria-label="Close dialog"
              >
                <X size={14} />
              </button>
            </div>

            {/* Content */}
            <div className="p-6 space-y-4">
              <div className="flex items-start gap-3.5">
                <div
                  className={`p-2.5 shrink-0 border ${
                    variant === 'danger'
                      ? 'bg-maroon-muted border-maroon/30 text-maroon'
                      : 'bg-camel-muted border-camel/30 text-camel'
                  }`}
                >
                  <AlertTriangle size={18} />
                </div>
                <div className="space-y-1 min-w-0">
                  <h3 id="confirm-modal-title" className="text-sm font-bold text-slate uppercase font-sans">
                    {title}
                  </h3>
                  <p className="text-xs text-steel font-mono leading-relaxed whitespace-pre-wrap">
                    {description}
                  </p>
                </div>
              </div>
            </div>

            {/* Action Bar */}
            <div className="flex items-center justify-end gap-2.5 px-6 py-4 bg-linen/30 hairline-top">
              <ActionButton
                variant="secondary"
                onClick={onClose}
                disabled={isPending}
              >
                {cancelLabel}
              </ActionButton>
              <button
                type="button"
                onClick={onConfirm}
                disabled={isPending}
                className={`px-4 py-2 font-mono text-xs font-bold uppercase tracking-wider transition-colors cursor-pointer disabled:opacity-50 ${
                  variant === 'danger'
                    ? 'bg-maroon text-parchment hover:bg-maroon/90'
                    : 'bg-slate text-parchment hover:bg-slate/90'
                }`}
              >
                {isPending ? 'PROCESSING...' : confirmLabel}
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>,
    document.body
  );
};
