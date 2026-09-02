import { describe, expect, it, vi } from 'vitest';


describe('auth route module exports', () => {
  it(
    'provides each named page component as the default export for React.lazy',
    async () => {
      const [loginModule, registerModule] = await Promise.all([
        import('./LoginPage.jsx'),
        import('./RegisterPage.jsx'),
      ]);

      expect(loginModule.default).toBe(loginModule.LoginPage);
      expect(registerModule.default).toBe(registerModule.RegisterPage);
    },
    60_000,
  );
});
