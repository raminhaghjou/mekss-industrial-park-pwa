import { useMutation, useQueryClient } from '@tanstack/react-query';
import { gatePassApi } from '../services/api/gatePass.api';
import { useNotification } from '../providers/NotificationProvider';
import { getErrorMessage } from '../utils/apiError';
import { displayIranLicensePlate } from '../utils/iranLicensePlate';

/**
 * Guard exit decision for one gate pass (verify exit / deny with a discrepancy reason).
 * Shared by the full verify page and the inline quick-verify card on the scan page.
 *
 * @param {string|undefined} passId
 * @param {{ licensePlate?: string, onVerified?: (pass: object) => void, onDenied?: (pass: object) => void }} [options]
 */
export function useGatePassDecision(passId, { licensePlate, onVerified, onDenied } = {}) {
  const queryClient = useQueryClient();
  const { showNotification } = useNotification();
  const plateLabel = displayIranLicensePlate(licensePlate || '');

  const refreshLists = () => Promise.all([
    queryClient.invalidateQueries({ queryKey: ['gate-passes'] }),
    queryClient.invalidateQueries({ queryKey: ['gate-pass', passId] }),
    queryClient.invalidateQueries({ queryKey: ['dashboard'] }),
  ]);

  const verifyMutation = useMutation({
    mutationFn: () => gatePassApi.verifyGatePass(passId),
    onSuccess: async (res) => {
      showNotification(`خروج خودرو با پلاک ${plateLabel} با موفقیت ثبت شد.`, 'success');
      await refreshLists();
      onVerified?.(res?.data);
    },
    onError: (err) => showNotification(getErrorMessage(err, 'ثبت خروج ناموفق بود.'), 'error'),
  });

  const denyMutation = useMutation({
    mutationFn: (/** @type {string} */ reason) => gatePassApi.denyGatePassExit(passId, { reason }),
    onSuccess: async (res) => {
      showNotification('رد خروج ثبت شد و به مدیر واحد و مدیر شهرک اطلاع داده شد.', 'success');
      await refreshLists();
      onDenied?.(res?.data);
    },
    onError: (err) => showNotification(getErrorMessage(err, 'ثبت گزارش مغایرت ناموفق بود.'), 'error'),
  });

  return {
    plateLabel,
    verify: () => verifyMutation.mutate(),
    deny: (reason) => denyMutation.mutate(reason),
    verifyMutation,
    denyMutation,
    isBusy: verifyMutation.isPending || denyMutation.isPending,
  };
}

/** Guards decide only after the park manager approved the pass. */
export const canDecideGatePass = (pass) => pass?.status === 'APPROVED';

export default useGatePassDecision;
