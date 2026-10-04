import { useQuery } from '@tanstack/react-query';
import { settingsApi } from '../services/api/settings.api';

const SETTING_READER_ROLES = ['SUPER_ADMIN', 'PARK_MANAGER', 'FACTORY_OWNER'];

/**
 * Wallet UI (menu, quick action, fee notices) is shown to park managers and owners only while the
 * global `require_gate_pass_wallet` setting is on. The super admin always keeps wallet access.
 */
export const walletUiVisible = (role, setting) => {
  if (role === 'SUPER_ADMIN') return true;
  if (!SETTING_READER_ROLES.includes(role)) return false;
  return setting?.requireWalletBalance === true;
};

export const useGatePassWallet = (role) => {
  const enabled = SETTING_READER_ROLES.includes(role);
  const { data, isLoading } = useQuery({
    queryKey: ['settings', 'gate-pass-wallet'],
    queryFn: () => settingsApi.getGatePassWallet().then((res) => res.data),
    enabled,
    staleTime: 60_000,
  });
  return {
    setting: data,
    isLoading: enabled && isLoading,
    walletRequired: data?.requireWalletBalance === true,
    showWalletUi: walletUiVisible(role, data),
  };
};
