import React, { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence, type PanInfo } from 'motion/react';
import { X } from 'lucide-react';
import { useBackButtonModal, BackPriority } from '../../utils/backHandler';

export interface BottomSheetProps {
  isOpen: boolean;
  onClose: () => void;
  title?: React.ReactNode;
  subtitle?: React.ReactNode;
  icon?: React.ReactNode;
  children: React.ReactNode;
  footer?: React.ReactNode;
  maxWidth?: string; // e.g. 'max-w-lg', 'max-w-xl', 'max-w-2xl'
  maxHeight?: string; // e.g. 'max-h-[88vh]', 'max-h-[92dvh]'
  showHandle?: boolean;
  showCloseButton?: boolean;
  className?: string;
}

export const BottomSheet: React.FC<BottomSheetProps> = ({
  isOpen,
  onClose,
  title,
  subtitle,
  icon,
  children,
  footer,
  maxWidth = 'max-w-xl',
  maxHeight = 'max-h-[88dvh]',
  showHandle = true,
  showCloseButton = true,
  className = '',
}) => {
  useBackButtonModal(isOpen, onClose, { priority: BackPriority.DRAWER });

  useEffect(() => {
    if (isOpen) {
      const originalOverflow = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
      return () => {
        document.body.style.overflow = originalOverflow;
      };
    }
  }, [isOpen]);

  const handleDragEnd = (_: MouseEvent | TouchEvent | PointerEvent, info: PanInfo) => {
    // If dragged down by 100px or with strong downwards velocity, close sheet
    if (info.offset.y > 90 || info.velocity.y > 300) {
      onClose();
    }
  };

  if (typeof document === 'undefined') return null;

  return createPortal(
    <AnimatePresence>
      {isOpen && (
        <div
          className="fixed inset-0 z-[100000] flex flex-col justify-end items-center"
          aria-modal="true"
          role="dialog"
        >
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2, ease: 'easeOut' }}
            onClick={onClose}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm"
          />

          {/* Bottom Sheet Card */}
          <motion.div
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ ease: [0.22, 1, 0.36, 1], duration: 0.32 }}
            drag="y"
            dragConstraints={{ top: 0 }}
            dragElastic={{ top: 0.05, bottom: 0.6 }}
            onDragEnd={handleDragEnd}
            className={`relative z-10 w-full ${maxWidth} ${maxHeight} bg-[var(--drawer-bg,var(--surface))] text-[var(--text)] rounded-t-3xl border-t border-x border-[var(--border)] shadow-2xl flex flex-col overflow-hidden pb-[calc(12px+env(safe-area-inset-bottom,0px))] ${className}`}
            onClick={(e: React.MouseEvent) => e.stopPropagation()}
          >
            {/* Grab Handle */}
            {showHandle && (
              <div className="w-full pt-3 pb-2 flex justify-center items-center cursor-grab active:cursor-grabbing flex-shrink-0">
                <div className="w-12 h-1 rounded-full bg-neutral-300 dark:bg-neutral-800 transition-opacity" />
              </div>
            )}

            {/* Optional Header */}
            {(title || icon || showCloseButton) && (
              <div className="px-5 pt-1 pb-3 flex items-center justify-between gap-3 border-b border-[var(--border)] flex-shrink-0 bg-[var(--drawer-bg,var(--surface))]">
                <div className="flex items-center gap-3 min-w-0">
                  {icon && (
                    <div className="w-9 h-9 rounded-xl bg-[var(--surface2)] border border-[var(--border)] text-[var(--text)] flex items-center justify-center flex-shrink-0">
                      {icon}
                    </div>
                  )}
                  <div className="min-w-0">
                    {title && (
                      <h3 className="text-base font-bold text-[var(--text)] tracking-tight truncate leading-snug">
                        {title}
                      </h3>
                    )}
                    {subtitle && (
                      <p className="text-xs text-[var(--text-3)] truncate mt-0.5">
                        {subtitle}
                      </p>
                    )}
                  </div>
                </div>

                {showCloseButton && (
                  <button
                    type="button"
                    onClick={onClose}
                    className="w-8 h-8 rounded-full bg-[var(--surface2)] text-[var(--text-2)] hover:text-[var(--text)] border border-[var(--border)] flex items-center justify-center cursor-pointer transition-all active:scale-95 flex-shrink-0"
                    aria-label="Close"
                  >
                    <X size={16} />
                  </button>
                )}
              </div>
            )}

            {/* Scrollable Content */}
            <div className="flex-1 min-h-0 overflow-y-auto px-5 py-4 overscroll-contain">
              {children}
            </div>

            {/* Optional Footer */}
            {footer && (
              <div className="px-5 pt-3 pb-1 border-t border-[var(--border)] bg-[var(--drawer-bg,var(--surface))] flex-shrink-0">
                {footer}
              </div>
            )}
          </motion.div>
        </div>
      )}
    </AnimatePresence>,
    document.body
  );
};

export default BottomSheet;
