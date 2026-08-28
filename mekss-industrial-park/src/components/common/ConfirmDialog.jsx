import { useEffect, useState } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogContentText,
  DialogActions,
  Button,
  TextField,
} from '@mui/material';

/**
 * Accessible confirmation dialog. Replaces browser `confirm`/`prompt` with a
 * focus-trapped, keyboard-operable MUI dialog. When `requireReason` is true,
 * the confirm action is disabled until a non-blank reason is entered.
 */
export const ConfirmDialog = ({
  open,
  title,
  description,
  confirmLabel = 'تایید',
  cancelLabel = 'انصراف',
  requireReason = false,
  reasonLabel = 'دلیل',
  reasonMultiline = true,
  reasonType = 'text',
  trimReason = true,
  confirmColor = 'primary',
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
    if (disabled || (requireReason && !reason.trim())) return;
    onConfirm(requireReason ? (trimReason ? reason.trim() : reason) : undefined);
  };

  const handleClose = () => {
    setReason('');
    onClose();
  };

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="sm" fullWidth aria-labelledby="confirm-dialog-title">
      <DialogTitle id="confirm-dialog-title">{title}</DialogTitle>
      <DialogContent>
        {description && <DialogContentText sx={{ mb: requireReason ? 2 : 0 }}>{description}</DialogContentText>}
        {requireReason && (
          <TextField
            autoFocus
            fullWidth
            required
            multiline={reasonMultiline}
            minRows={reasonMultiline ? 2 : undefined}
            type={reasonType}
            label={reasonLabel}
            value={reason}
            onChange={(event) => setReason(event.target.value)}
          />
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={handleClose} disabled={loading}>{cancelLabel}</Button>
        <Button
          onClick={handleConfirm}
          color={/** @type {'primary' | 'error'} */ (confirmColor)}
          variant="contained"
          disabled={disabled || loading || (requireReason && !reason.trim())}
        >
          {confirmLabel}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default ConfirmDialog;
