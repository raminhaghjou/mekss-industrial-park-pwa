import { useState } from 'react';
import { Modal, Button, TextArea } from '@heroui/react';

export const ConfirmDialog = ({
  open,
  title,
  description,
  confirmLabel = 'تایید',
  cancelLabel = 'انصراف',
  confirmColor = 'primary',
  requireReason = false,
  reasonLabel = 'دلیل',
  loading = false,
  onConfirm,
  onClose,
}) => {
  const [reason, setReason] = useState('');

  const handleConfirm = () => {
    if (requireReason && !reason.trim()) return;
    onConfirm?.(reason.trim());
    setReason('');
  };

  const handleClose = () => {
    setReason('');
    onClose?.();
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={handleClose}>
      <div className="w-full max-w-md rounded-xl bg-background p-6 shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <h3 className="mb-2 text-lg font-semibold">{title}</h3>
        {description && <p className="mb-4 text-foreground-600">{description}</p>}
        {requireReason && (
          <textarea
            className="mb-4 w-full rounded-lg border border-default-300 p-2 focus:border-primary-500 focus:outline-none"
            placeholder={`${reasonLabel} را وارد کنید...`}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            rows={3}
          />
        )}
        <div className="flex justify-end gap-2">
          <button
            className="rounded-lg px-4 py-2 text-foreground-600 hover:bg-default-100"
            onClick={handleClose}
            disabled={loading}
          >
            {cancelLabel}
          </button>
          <button
            className={`rounded-lg px-4 py-2 text-white ${confirmColor === 'danger' ? 'bg-danger-500 hover:bg-danger-600' : 'bg-primary-500 hover:bg-primary-600'} disabled:opacity-50`}
            onClick={handleConfirm}
            disabled={(requireReason && !reason.trim()) || loading}
          >
            {loading ? '...' : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ConfirmDialog;
