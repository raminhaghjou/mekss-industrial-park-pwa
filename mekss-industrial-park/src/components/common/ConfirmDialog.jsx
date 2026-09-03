import { useEffect, useState } from 'react';
import {
  ModalBackdrop,
  ModalContainer,
  ModalDialog,
  ModalHeader,
  ModalHeading,
  ModalBody,
  ModalFooter,
  Button,
  Label,
  TextArea,
  Spinner,
} from '@heroui/react';

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
  disabled = false,
  onConfirm,
  onClose,
}) => {
  const [reason, setReason] = useState('');

  useEffect(() => {
    if (!open) setReason('');
  }, [open]);

  const handleConfirm = () => {
    if (requireReason && !reason.trim()) return;
    onConfirm?.(reason.trim());
  };

  const handleClose = () => {
    onClose?.();
  };

  if (!open) return null;

  return (
    <ModalBackdrop isOpen={open} onOpenChange={(isOpen) => !isOpen && handleClose()} isDismissable={!loading} variant="blur">
      <ModalContainer size="md">
        <ModalDialog aria-label={title} className="rounded-2xl border border-default-200 dark:border-white/10 p-6 bg-background">
          <ModalHeader className="flex flex-col gap-1 text-lg font-bold text-foreground">
            <ModalHeading>{title}</ModalHeading>
          </ModalHeader>
          <ModalBody className="gap-3">
            {description && <p className="text-sm text-foreground-500">{description}</p>}
            {requireReason && (
              <div className="flex flex-col gap-1">
                <Label className="text-xs font-medium text-foreground-600">{reasonLabel}</Label>
                <TextArea
                  placeholder={`${reasonLabel} را وارد کنید...`}
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  variant="primary"
                  rows={3}
                  required
                  className="rounded-xl"
                  disabled={loading}
                />
              </div>
            )}
          </ModalBody>
          <ModalFooter>
            <Button variant="tertiary" onPress={handleClose} isDisabled={loading} className="rounded-xl font-medium">
              {cancelLabel}
            </Button>
            <Button
              variant={confirmColor === 'danger' ? 'danger' : 'primary'}
              onPress={handleConfirm}
              isDisabled={loading || disabled || (requireReason && !reason.trim())}
              className="rounded-xl font-bold flex items-center gap-2"
            >
              {loading ? <Spinner size="sm" /> : null}
              {confirmLabel}
            </Button>
          </ModalFooter>
        </ModalDialog>
      </ModalContainer>
    </ModalBackdrop>
  );
};

export default ConfirmDialog;
