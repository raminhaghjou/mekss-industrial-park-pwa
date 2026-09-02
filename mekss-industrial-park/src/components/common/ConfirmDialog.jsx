import { useState } from 'react';
import { ModalBackdrop, ModalContainer, ModalDialog, ModalHeader, ModalBody, ModalFooter, Button, Textarea, Spinner } from '@heroui/react';

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
    <ModalBackdrop isOpen={open} onOpenChange={(isOpen) => !isOpen && handleClose()} isDismissable={!loading} variant="blur">
      <ModalContainer size="md">
        <ModalDialog className="rounded-2xl border border-default-200 dark:border-white/10 p-6 bg-background">
          <ModalHeader className="flex flex-col gap-1 text-lg font-bold text-foreground">
            {title}
          </ModalHeader>
          <ModalBody className="gap-3">
            {description && <p className="text-sm text-foreground-500">{description}</p>}
            {requireReason && (
              <Textarea
                label={reasonLabel}
                placeholder={`${reasonLabel} را وارد کنید...`}
                value={reason}
                onValueChange={setReason}
                variant="primary"
                minRows={3}
                isRequired
                className="rounded-xl"
              />
            )}
          </ModalBody>
          <ModalFooter>
            <Button variant="tertiary" onPress={handleClose} isDisabled={loading} className="rounded-xl font-medium">
              {cancelLabel}
            </Button>
            <Button
              variant={confirmColor === 'danger' ? 'danger' : 'primary'}
              onPress={handleConfirm}
              isDisabled={loading || (requireReason && !reason.trim())}
              className="rounded-xl font-bold"
            >
              {loading ? <Spinner size="sm" /> : confirmLabel}
            </Button>
          </ModalFooter>
        </ModalDialog>
      </ModalContainer>
    </ModalBackdrop>
  );
};

export default ConfirmDialog;

