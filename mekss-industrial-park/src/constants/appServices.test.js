import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  ALL_ROLES,
  appServices,
  featuredServicesForRole,
  pageTitleForPath,
  searchServices,
  servicesForRole,
  tabsByRole,
} from './appServices';

const appSource = readFileSync(resolve(__dirname, '../App.jsx'), 'utf8');

/** path (without leading slash) -> allowed roles, or null when the route has no RoleRoute guard. */
const routeRoles = (() => {
  const map = new Map();
  for (const match of appSource.matchAll(/<Route\s+path="([^"]+)"\s+element=\{([\s\S]*?)\}\s*\/>/g)) {
    const path = match[1].replace(/^\//, '');
    const guard = /<RoleRoute roles=\{\[([^\]]+)\]\}/.exec(match[2]);
    map.set(path, guard ? guard[1].split(',').map((role) => role.trim().replace(/'/g, '')) : null);
  }
  return map;
})();

const previousMenuPaths = [
  '/dashboard', '/admin/factories', '/admin/registrations', '/admin/park-staff', '/factory/register', '/factory/staff',
  '/factory/wallet', '/admin/finance', '/invoices', '/admin/gate-passes', '/gate-passes', '/guard/gate-passes', '/guard/scan',
  '/admin/requests', '/requests', '/messages', '/market-rates', '/admin/announcements', '/announcements', '/advertisements',
  '/emergency', '/ads', '/feedback', '/superadmin/parks', '/superadmin/users', '/superadmin/banners', '/admin/reports',
];

describe('appServices', () => {
  it('gives every role at least one service and exactly four tabs starting with home', () => {
    for (const role of ALL_ROLES) {
      expect(servicesForRole(role).length).toBeGreaterThan(0);
      expect(tabsByRole[role]).toHaveLength(4);
      expect(tabsByRole[role][0].path).toBe('/dashboard');
    }
  });

  it('never offers a service to a role that the router would turn away', () => {
    for (const service of appServices) {
      const key = service.path.replace(/^\//, '');
      expect(routeRoles.has(key), `${service.path} is not a registered route`).toBe(true);
      const allowed = routeRoles.get(key);
      if (!allowed) continue;
      for (const role of service.roles) {
        expect(allowed, `${role} cannot open ${service.path}`).toContain(role);
      }
    }
  });

  it('only puts tabs on routes the role may open', () => {
    for (const role of ALL_ROLES) {
      for (const tab of tabsByRole[role]) {
        const allowed = routeRoles.get(tab.path.replace(/^\//, ''));
        if (allowed) expect(allowed, `${role} tab ${tab.path}`).toContain(role);
      }
    }
  });

  it('still reaches every destination the old side menu offered', () => {
    const reachable = new Set([
      ...appServices.map((service) => service.path),
      ...Object.values(tabsByRole).flat().map((tab) => tab.path),
    ]);
    for (const path of previousMenuPaths) expect(reachable.has(path), path).toBe(true);
  });

  it('hides the wallet when the wallet feature is off', () => {
    expect(servicesForRole('FACTORY_OWNER').some((service) => service.id === 'wallet')).toBe(true);
    expect(servicesForRole('FACTORY_OWNER', { showWalletUi: false }).some((service) => service.id === 'wallet')).toBe(false);
    expect(featuredServicesForRole('FACTORY_OWNER', { showWalletUi: false }).map((service) => service.id)).not.toContain('wallet');
  });

  it('only features services the role can see', () => {
    for (const role of ALL_ROLES) {
      const visible = servicesForRole(role).map((service) => service.id);
      for (const service of featuredServicesForRole(role)) expect(visible).toContain(service.id);
    }
  });

  it('finds services by Persian words, keywords, Arabic letter variants and digits', () => {
    const services = servicesForRole('FACTORY_OWNER');
    expect(searchServices(services, 'قبض').map((service) => service.id)).toEqual(expect.arrayContaining(['invoices']));
    expect(searchServices(services, 'شارژ').map((service) => service.id)).toContain('wallet');
    expect(searchServices(services, 'كيف').map((service) => service.id)).toContain('wallet');
    expect(searchServices(services, '   ')).toHaveLength(services.length);
    expect(searchServices(services, 'ناموجود-xyz')).toHaveLength(0);
  });

  it('titles inner pages by the most specific match', () => {
    expect(pageTitleForPath('/invoices')).toBe('قبض‌های من');
    expect(pageTitleForPath('/invoices/pay/abc')).toBe('پرداخت قبض');
    expect(pageTitleForPath('/admin/invoices/create')).toBe('صدور قبض');
    expect(pageTitleForPath('/guard/gate-passes/p1/verify')).toBe('تایید خروج');
    expect(pageTitleForPath('/unknown')).toBeNull();
  });
});
