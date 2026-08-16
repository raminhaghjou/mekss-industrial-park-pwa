# Baseline Audit — 2026-08-17

This baseline was captured before source changes. It is evidence for the remediation work in `PRODUCTION-IMPLEMENTATION-PLAN.md`.

## Execution results

| Area | Command | Result |
| --- | --- | --- |
| Backend build | `npm run build` in `mekss-backend` | **Failed:** 407 TypeScript errors. |
| Frontend build | `npm run build` in `mekss-industrial-park` | **Failed:** `vite` is not installed because the frontend has no `node_modules` and no committed lockfile. |
| Git working tree | `git status --short` | Clean before creating `docs/`; plan documentation is the only intentional change. |

## Confirmed blockers

1. Two incompatible Prisma/API generations coexist. The schema exports `Role`, `AdvertisementCategory`, and `AdvertisementStatus`; several modules import non-existent `UserRole`, `AdvertisementType`, `AdvertisementPlacement`, `RequestStatus`, and other obsolete fields.
2. The role model conflicts across source. The schema lists `SUPER_ADMIN`, `PARK_MANAGER`, `FACTORY_MANAGER`, `SECURITY_GUARD`, `GUEST`, and `EMPLOYEE`; old source and the product requirement use `FACTORY_OWNER`, `ADMIN`, and `GOVERNMENT_OFFICIAL`.
3. `advertisement`, `request`, `emergency` and other services refer to non-existent Prisma relations and numeric IDs while the active schema uses CUID strings. A syntax error also exists in `advertisement-response.dto.ts`.
4. `shared` imports use an invalid relative path in modules below `src/<module>`, and `LoggerService` conflicts with Nest's imported `LoggerService` type.
5. Kavenegar is imported but not declared in `package.json`; ZarinPal is referenced by source but also absent from the dependency manifest.
6. The backend Dockerfile installs production-only dependencies in its build stage even though `nest` and TypeScript are dev dependencies needed by `npm run build`.
7. The Compose file refers to missing `nginx.conf` and `docker/postgres/init.sql`, does not deploy the frontend, exposes data services publicly, and contains unsafe production defaults.
8. Prisma has no committed migrations and `package.json` references a missing `prisma/seed.ts`.
9. The configured health controller is not registered in `AppModule`; the Docker healthcheck cannot succeed. The Prisma shutdown hook uses a Prisma event signature incompatible with the installed generated client.
10. Authentication stores OTP and refresh-token state in memory. Public registration permits caller-controlled role selection and auto-approves `SUPER_ADMIN`.
11. The frontend calls legacy auth routes (`/auth/send-otp`, `/auth/profile`, etc.) that do not match the Nest routes (`/auth/otp/send`, `/auth/me`, etc.).
12. The frontend Vite config imports undeclared `vite-plugin-pwa`; it also coexists with a custom service worker that risks caching authenticated API responses. Required PWA icons are absent.

## Remediation baseline

The recovery path is to establish one canonical Prisma role/schema model, regenerate the Prisma client, replace the stale incompatible services with tested implementations or correct them against that model, and make Docker/Compose the reproducible source of local and production behavior. No production deployment is permitted until the build, migrations, health/readiness, role security, and integration contracts are green.
