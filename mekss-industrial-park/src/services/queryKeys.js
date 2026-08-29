/**
 * Central React Query key factory. Consolidates the ad hoc key arrays that
 * pages previously wrote by hand, so a resource's key shape (and any actor
 * scope needed for cache isolation) is defined once. Existing pages that
 * still spell out their own arrays remain compatible, since these factories
 * produce the same plain-array shapes React Query already expects.
 */
export const queryKeys = {
  dashboard: () => ['dashboard'],
  parks: {
    all: (params) => ['parks', 'all', params ?? null],
    managed: (params) => ['parks', 'managed', params ?? null],
    detail: (id) => ['parks', 'detail', id],
  },
  users: {
    managed: (params) => ['users', 'managed', params ?? null],
    detail: (id) => ['users', 'detail', id],
  },
  factories: {
    legacy: (params) => ['factories', 'legacy', params ?? null],
    managed: (params) => ['factories', 'managed', params ?? null],
    detail: (id) => ['factories', 'detail', id],
    managementScope: () => ['factories', 'management-scope'],
  },
  advertisements: {
    public: () => ['advertisements', 'public'],
    managed: (params) => ['advertisements', 'managed', params ?? null],
    detail: (id) => ['advertisements', 'detail', id],
    creationScope: () => ['advertisements', 'creation-scope'],
  },
  announcements: {
    public: () => ['announcements', 'public'],
    managed: () => ['announcements', 'managed'],
  },
  invoices: {
    managed: (params) => ['invoices', 'managed', params ?? null],
  },
  gatePasses: {
    managed: (params) => ['gate-passes', 'managed', params ?? null],
    detail: (id) => ['gate-passes', 'detail', id],
  },
  requests: {
    managed: (params) => ['requests', 'managed', params ?? null],
  },
  messages: {
    inbox: () => ['messages', 'inbox'],
  },
  reports: (filters) => ['reports', filters ?? null],
  sms: {
    health: () => ['sms', 'health'],
  },
};

export default queryKeys;
