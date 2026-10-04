import { describe, expect, it, vi } from 'vitest';

vi.mock('../services/api/settings.api', () => ({ settingsApi: { getGatePassWallet: vi.fn() } }));

const { walletUiVisible } = await import('./useGatePassWallet');

describe('wallet UI visibility follows the global gate-pass wallet setting', () => {
  it('shows wallet UI to park managers and owners only while the setting is on', () => {
    for (const role of ['PARK_MANAGER', 'FACTORY_OWNER']) {
      expect(walletUiVisible(role, { requireWalletBalance: true, fee: 50000 })).toBe(true);
      expect(walletUiVisible(role, { requireWalletBalance: false, fee: 50000 })).toBe(false);
      expect(walletUiVisible(role, undefined)).toBe(false);
    }
  });

  it('always keeps wallet access for the super admin and never shows it to other roles', () => {
    expect(walletUiVisible('SUPER_ADMIN', { requireWalletBalance: false })).toBe(true);
    expect(walletUiVisible('SUPER_ADMIN', undefined)).toBe(true);
    for (const role of ['SECURITY_GUARD', 'EMPLOYEE', 'GOVERNMENT_OFFICIAL']) {
      expect(walletUiVisible(role, { requireWalletBalance: true })).toBe(false);
    }
  });
});
