import { useState } from 'react';
import {
  ModalBackdrop,
  ModalContainer,
  ModalDialog,
  ModalHeader,
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
              <div className="flex flex-col gap-1">
                <Label className="text-xs font-medium text-foreground-600">{reasonLabel}</Label>
                <TextArea
                  placeholder={`${reasonLabel} را وارد کنید...`}
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  variant="primary"
                  minRows={3}
                  isRequired
                  className="rounded-xl"
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
