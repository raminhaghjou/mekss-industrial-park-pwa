import { useState } from 'react';
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
  confirmColor = 'primary',
  loading = false,
  onConfirm,
  onClose,
}) => {
  const [reason, setReason] = useState('');

  const handleConfirm = () => {
    if (requireReason && !reason.trim()) return;
    onConfirm(requireReason ? reason.trim() : undefined);
    setReason('');
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
          disabled={loading || (requireReason && !reason.trim())}
        >
          {confirmLabel}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default ConfirmDialog;
