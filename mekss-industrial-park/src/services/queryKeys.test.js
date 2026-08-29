import { describe, expect, it } from 'vitest';
import { queryKeys } from './queryKeys';

describe('queryKeys factory', () => {
  it('produces stable plain-array keys with normalized undefined params', () => {
    expect(queryKeys.dashboard()).toEqual(['dashboard']);
    expect(queryKeys.parks.all()).toEqual(['parks', 'all', null]);
    expect(queryKeys.parks.managed({ page: 2 })).toEqual(['parks', 'managed', { page: 2 }]);
    expect(queryKeys.parks.detail('park-1')).toEqual(['parks', 'detail', 'park-1']);
  });

  it('scopes factory keys by legacy vs managed reads', () => {
    expect(queryKeys.factories.legacy()).toEqual(['factories', 'legacy', null]);
    expect(queryKeys.factories.managed({ status: 'PENDING' })).toEqual(['factories', 'managed', { status: 'PENDING' }]);
    expect(queryKeys.factories.managementScope()).toEqual(['factories', 'management-scope']);
  });

  it('produces distinct keys for every remaining resource used by admin pages', () => {
    expect(queryKeys.users.managed()).toEqual(['users', 'managed', null]);
    expect(queryKeys.advertisements.public()).toEqual(['advertisements', 'public']);
    expect(queryKeys.announcements.managed()).toEqual(['announcements', 'managed']);
    expect(queryKeys.invoices.managed()).toEqual(['invoices', 'managed', null]);
    expect(queryKeys.gatePasses.managed()).toEqual(['gate-passes', 'managed', null]);
    expect(queryKeys.requests.managed()).toEqual(['requests', 'managed', null]);
    expect(queryKeys.messages.inbox()).toEqual(['messages', 'inbox']);
    expect(queryKeys.reports({ type: 'financial' })).toEqual(['reports', { type: 'financial' }]);
    expect(queryKeys.sms.health()).toEqual(['sms', 'health']);
  });
});
