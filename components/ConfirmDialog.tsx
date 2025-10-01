import React from 'react';
import { createPortal } from 'react-dom';

interface ConfirmDialogProps {
  open: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  onConfirm: () => void;
  onCancel: () => void;
  loading?: boolean;
}

const ConfirmDialog: React.FC<ConfirmDialogProps> = ({
  open,
  title,
  message,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  onConfirm,
  onCancel,
  loading = false,
}) => {
  if (!open) return null;

  const content = (
    <div className="fixed inset-0 z-[999] flex items-center justify-center bg-black/70 backdrop-blur-sm">
      <div className="bg-gray-900 border border-white/10 rounded-lg shadow-xl max-w-md w-full mx-4">
        <div className="px-6 py-4 border-b border-white/10">
          <h3 className="text-lg font-semibold text-white">{title}</h3>
        </div>
        <div className="px-6 py-5 text-sm text-gray-300 whitespace-pre-line">
          {message}
        </div>
        <div className="px-6 py-4 border-t border-white/10 flex justify-end gap-3">
          <button
            onClick={onCancel}
            className="px-4 py-2 text-sm font-medium text-gray-300 hover:text-white rounded-md border border-white/10 hover:border-white/30 transition-colors"
            disabled={loading}
          >
            {cancelLabel}
          </button>
          <button
            onClick={onConfirm}
            disabled={loading}
            className="px-4 py-2 text-sm font-medium rounded-md bg-red-500 hover:bg-red-600 text-white shadow disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {loading ? 'Working…' : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );

  return createPortal(content, document.body);
};

export default ConfirmDialog;
