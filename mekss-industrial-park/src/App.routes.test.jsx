import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const appSource = readFileSync('src/App.jsx', 'utf8');
const declaredRoutePaths = new Set(
  [...appSource.matchAll(/<Route\s+path="([^"]+)"/g)].map((match) => match[1]),
);

const preservedRoutePaths = [
  '/login',
  '/register',
  '/forgot-password',
  '/welcome',
  '/ads',
  '/directory',
  '/directory/:id',
  '/shops',
  '/sms-request',
  '/',
  'dashboard',
  'profile',
  'settings',
  'about',
  'feedback',
  'factory/register',
  'factory/staff',
  'factory/wallet',
  'market-rates',
  'gate-passes',
  'invoices',
  'invoices/pay/:id',
  'messages',
  'requests',
  'requests/new/:type',
  'requests/tools',
  'announcements',
  'advertisements',
  'advertisements/new',
  'advertisements/:id/edit',
  'emergency',
  'admin/factories',
  'admin/registrations',
  'admin/finance',
  'admin/invoices',
  'admin/invoices/create',
  'admin/gate-passes',
  'admin/requests',
  'admin/messages',
  'admin/announcements',
  'admin/park-staff',
  'admin/advertisements',
  'admin/reports',
  'guard/gate-passes',
  'guard/gate-passes/:id/verify',
  'guard/scan',
  'guard/emergency',
  'superadmin/parks',
  'superadmin/users',
  'superadmin/advertisements',
  'superadmin/ad-categories',
  'superadmin/sms-config',
  '*',
];

describe('application route contract', () => {
  it('preserves every public, account, domain, admin, guard, and super-admin route identity', () => {
    expect([...declaredRoutePaths].sort()).toEqual([...preservedRoutePaths].sort());
  });

  it('keeps the established React/Vite app independent from the retired react-admin layout', () => {
    expect(appSource).not.toMatch(/react-admin|MyLayout/);
  });
});
