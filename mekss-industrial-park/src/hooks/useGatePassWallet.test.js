import { describe, expect, it, vi } from 'vitest';

vi.mock('../services/api/settings.api', () => ({ settingsApi: { getGatePassWallet: vi.fn() } }));

const { walletUiVisible } = await import('./useGatePassWallet');

describe('wallet UI visibility follows the global gate-pass wallet setting', () => {
  it('shows wallet UI to park managers only while the setting is on', () => {
    expect(walletUiVisible('PARK_MANAGER', { requireWalletBalance: true, fee: 50000 })).toBe(true);
    expect(walletUiVisible('PARK_MANAGER', { requireWalletBalance: false, fee: 50000 })).toBe(false);
    expect(walletUiVisible('PARK_MANAGER', undefined)).toBe(false);
  });

  it('always keeps wallet access (online top-up) for unit owners and the super admin', () => {
    for (const role of ['SUPER_ADMIN', 'FACTORY_OWNER']) {
      expect(walletUiVisible(role, { requireWalletBalance: false })).toBe(true);
      expect(walletUiVisible(role, { requireWalletBalance: true })).toBe(true);
      expect(walletUiVisible(role, undefined)).toBe(true);
    }
  });

  it('never shows it to other roles', () => {
    for (const role of ['SECURITY_GUARD', 'EMPLOYEE', 'GOVERNMENT_OFFICIAL']) {
      expect(walletUiVisible(role, { requireWalletBalance: true })).toBe(false);
    }
  });
});
