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
  '/',
  'dashboard',
  'profile',
  'settings',
  'about',
  'gate-passes',
  'invoices',
  'invoices/pay/:id',
  'messages',
  'requests',
  'requests/new/:type',
  'announcements',
  'advertisements',
  'advertisements/new',
  'emergency',
  'admin/factories',
  'admin/invoices',
  'admin/invoices/create',
  'admin/gate-passes',
  'admin/requests',
  'admin/messages',
  'admin/announcements',
  'admin/advertisements',
  'admin/reports',
  'guard/gate-passes',
  'guard/gate-passes/:id/verify',
  'guard/emergency',
  'superadmin/parks',
  'superadmin/users',
  'superadmin/advertisements',
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
