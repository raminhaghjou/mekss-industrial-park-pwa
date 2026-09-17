import apiClient from './base.api';

export const settingsApi = {
  getGatePassWallet: () => apiClient.get('/settings/gate-pass-wallet'),
  updateGatePassWallet: (requireWalletBalance) =>
    apiClient.patch('/settings/gate-pass-wallet', { requireWalletBalance }),
};
