# Implementation Plan: MEKSS Production Deployment

## Overview

Implement and validate every repository-local deployment concern for the existing TypeScript/NestJS API and React/Vite PWA. The completed system must run locally in Docker as a production-shaped stack containing the frontend, backend, PostgreSQL, Redis, MinIO, and Nginx, using disposable resources, local test certificates, and mock external adapters only. All listed test tasks are required—not optional—and every implementation task includes automated, non-interactive validation.

Convert the feature design into a series of prompts for a code-generation LLM that will implement each step with incremental progress. Make sure that each prompt builds on the previous prompts, and ends with wiring things together. There should be no hanging or orphaned code that isn't integrated into a previous step. Focus ONLY on tasks that involve writing, modifying, or testing code.

## Tasks

- [ ] 1. Establish local validation commands and safe runtime configuration
  - [x] 1.1 Add check-only workspace, backend, and frontend scripts for linting, type checking, builds, unit/integration tests, browser tests, Compose smoke tests, and the aggregate local acceptance command.
    - Modify the root orchestration files and `mekss-backend/package.json` to add a non-mutating `lint:check` beside the current auto-fixing lint script; add the missing frontend lint/typecheck/test scripts and pinned test tooling configuration in `mekss-industrial-park`.
    - Ensure each command returns its child failure status and reports the named failed service or check without starting a watcher.
    - _Requirements: 1.1, 1.5, 18.1, 18.8_
  - [ ] 1.2 Implement `validate-production-config` and a complete committed non-secret environment schema.
    - Add TypeScript configuration validation and expand `mekss-backend/.env.example`; require database, Redis, MinIO, JWT, CORS, public URL, upload, bootstrap, SMS, and payment keys; reject empty and case-insensitive placeholder values; permit mock providers only when explicitly selected; print invalid key names but never their values.
    - Add unit tests for each missing/placeholder form, mock and provider selection, valid synthetic input, and the absence of a synthetic secret sentinel from captured output.
    - _Requirements: 13.7, 15.1, 15.4, 15.5, 18.7_
  - [ ] 1.3 Add local command-runner tests for the configuration and acceptance entrypoints.
    - Use temporary environment files and synthetic secrets to verify deterministic non-zero failures, named diagnostics, no secret leakage, and readiness polling timeout behavior without invoking external services.
    - _Requirements: 1.1-1.5, 12.1-12.2, 15.3, 18.1, 18.8_

- [ ] 2. Make database deployment and initialization repeatable
  - [x] 2.1 Update `mekss-backend/prisma/schema.prisma` and committed Prisma migrations to preserve canonical roles, tenant ownership, bootstrap state, durable token/OTP state, payment idempotency, notification outcomes, scoped-file metadata, and append-only audit fields.
    - Keep Prisma migrations as the only production schema writer; add indexes and uniqueness constraints required for tenant scoping, refresh revocation, OTP limits, payment authority/idempotency, and bootstrap identity.
    - _Requirements: 2.1-2.5, 3.3-3.8, 4.1-4.9, 5.5, 7.2-7.8, 8.3-8.5, 9.1-9.5, 12.5_
  - [ ] 2.2 Implement explicit migration, development seed, and production bootstrap commands in the backend.
    - Make the migration command wait for PostgreSQL, run `prisma migrate deploy`, expose only migration identifiers/status, time out within five minutes, and block API admission on failure. Keep seed mode development-only; create the production bootstrap administrator transactionally and exactly once with `mustChangePassword` and a `system-bootstrap` audit record that never persists or logs the password.
    - _Requirements: 2.1-2.3, 3.1-3.6, 13.3-13.4, 17.3, 18.1, 18.7_
  - [ ] 2.3 Add isolated PostgreSQL integration tests for migrations, seeds, and bootstrap.
    - Verify empty-database migration order, zero-change migration rerun, failed-migration API gate, idempotent development seed records, exact-once production bootstrap/audit behavior, no production demo data, and redaction of bootstrap credentials.
    - _Requirements: 2.1-2.4, 3.1-3.6, 12.4-12.5, 18.1_

- [ ] 3. Complete local API safety, authorization, and contract behavior
  - [ ] 3.1 Implement bounded `/health/live` and `/health/ready` endpoints with PostgreSQL, Redis, and MinIO probes.
    - Return a correlation ID and the complete dependency-status map; return 200 only when all dependencies are usable and 503 within five seconds with each unavailable dependency otherwise.
    - Add API integration tests which independently disable each local dependency and assert response status, shape, correlation ID, complete failures, and time bound.
    - _Requirements: 1.2-1.4, 12.1-12.2, 13.3-13.4, 18.7_
  - [ ] 3.2 Normalize correlation propagation, log redaction, and transactional append-only audits in NestJS core and management services.
    - Propagate `X-Request-ID` through response, structured logs, audit events, and proxy requests. Redact secrets, credentials, headers/tokens, OTPs, payment data, and all but the last four phone digits; roll back a privileged mutation when its audit write fails.
    - Add unit/integration tests using secret, OTP, refresh-token, payment-credential, and phone sentinels; assert masking/redaction and HTTP 500 with rollback on forced audit failure.
    - _Requirements: 3.6, 5.1-5.4, 8.6, 12.3-12.5, 15.3, 18.7_
  - [ ] 3.3 Implement durable authentication, authorization, and tenant isolation using the canonical Prisma model.
    - Enforce six-digit, five-minute, single-use OTPs with a five-attempt/15-minute lockout; atomically rotate/revoke refresh tokens; revoke on logout/disable; restrict password-change-required sessions; enforce roles and tenant filtering before pagination or mutation.
    - Add restart-backed API/database tests for valid, invalid, expired, consumed, and limited OTPs; rotation and durable revocation; restricted bootstrap sessions; role denials; and cross-tenant 403 responses containing no resource fields.
    - _Requirements: 2.5, 3.5, 3.7-3.8, 4.1-4.9, 5.4-5.5, 18.2-18.3_
  - [ ] 3.4 Publish and enforce the versioned `/api/v1` OpenAPI/DTO contract and align the frontend client call definitions.
    - Cover factories, gate passes, invoices, requests, announcements, advertisements, emergencies, analytics, authentication, user management, and files with published success, validation-error, and pagination representations.
    - Add contract tests for every business domain covering successful, invalid-input, unauthenticated, unauthorized, and cross-tenant cases; assert pagination is tenant-filtered before totals are calculated.
    - _Requirements: 6.1-6.5, 18.2_

- [ ] 4. Implement local mock-integrated provider, queue, and object-storage behavior
  - [ ] 4.1 Implement typed mock/real ZarinPal adapters and restart-safe idempotent payment transitions.
    - Select the adapter only at startup; prevent all mock-mode network calls; persist pending authority/idempotency before redirect; verify callbacks transactionally; preserve unpaid state on failure; return the original verified result on duplicate callbacks; return 404 without mutation for unknown authorities.
    - Add deterministic adapter/API tests for mock initiation, missing provider configuration, verification failure, duplicate callback, and API restart between initiation and verification.
    - _Requirements: 7.1-7.8, 15.1, 15.5, 18.4_
  - [ ] 4.2 Implement typed mock/real Kavenegar adapters and Redis/Bull notification workers with durable outcomes.
    - Keep provider credentials runtime-only; make mock mode network-isolated; classify provider failures; schedule exactly 60, 300, and 900-second retries; persist success/final-failure notification ID, provider code, correlation ID, and UTC timestamp.
    - Add fake-clock queue tests for mock isolation, success, timeout, all retry delays, non-retryable termination, exhausted retries, persisted outcomes, and masked SMS logs.
    - _Requirements: 8.1-8.7, 12.3-12.4, 15.1, 15.3, 15.5, 18.5_
  - [ ] 4.3 Implement the MinIO/S3 adapter, private bucket bootstrap, and scoped-file API behavior.
    - Validate MIME type and byte size before storage writes; build canonical tenant/factory keys; enforce scope before presigning; cap GET URLs at 900 seconds; remove fallback credentials; require private bucket policy.
    - Add local MinIO integration tests for accepted upload/key scope, rejected MIME/size without an object, allowed/forbidden retrieval, maximum URL lifetime, and expiry denial.
    - _Requirements: 9.1-9.5, 12.1-12.2, 13.7, 15.1, 15.5, 18.7_
  - [ ] 4.4 Add an isolated provider/queue/storage suite using only disposable PostgreSQL, Redis, and MinIO services.
    - Block provider hosts at the test boundary and assert no external request occurs while all required mock payment, notification, and storage paths produce named local results.
    - _Requirements: 7.1-7.8, 8.1-8.7, 9.1-9.5, 15.1-15.3, 18.4-18.5_

- [ ] 5. Implement and test the role-aware PWA boundary
  - [ ] 5.1 Align the React API client and role-aware UI with the published API contract.
    - Derive public/admin presentation context from `window.location.host` without granting privileges; load profile/permissions from the API; implement delayed loading, retryable error, distinct empty states, RTL/Persian number formatting, and responsive primary-action navigation.
    - Add component tests for role-filtered navigation, loading/error/empty transitions, contract-compatible requests, Persian formatting, administrator host context, and 360/768/1440-pixel no-overflow/accessibility behavior.
    - _Requirements: 6.5, 10.1-10.7, 18.2, 18.6_
  - [ ] 5.2 Configure exactly one PWA/service-worker implementation and safe private-cache boundaries.
    - Add one manifest, 192×192 and 512×512 icons, install/update UX, anonymous offline shell, and controlled activation. Cache only versioned static assets and the anonymous shell; bypass authorization-header, authentication, and user-specific API requests; clear browser-accessible private state and relevant caches before signed-out UI.
    - Add unit/browser tests for the single-worker/manifest boundary, icon dimensions, Android/iOS installation guidance, offline shell within five seconds, update notice before activation, logout cleanup, and cache exclusions.
    - _Requirements: 11.1-11.7, 18.6_
  - [ ] 5.3 Add a non-interactive frontend browser-test suite and sanitized artifacts.
    - Run role, viewport, host-context, offline/cache, and API-state tests against the local frontend/API stack; identify failed assertions without retaining tokens or private API payloads.
    - _Requirements: 6.5, 10.1-10.7, 11.1-11.7, 15.3, 18.6, 18.8_

- [ ] 6. Build and execute the complete local Docker stack
  - [ ] 6.1 Replace/add backend and frontend multi-stage Dockerfiles and `.dockerignore` files.
    - Use lockfile-based builders, generate Prisma in the backend builder, copy only runtime artifacts into non-root numeric-UID images, accept frontend public non-secret build arguments only, and exclude `.env*`, certificates, uploads, logs, tests, and build caches. Include revision metadata without secrets.
    - Add deterministic image tests which build from a clean context and inspect user, filesystem, metadata, and logs for prohibited paths or a synthetic secret sentinel.
    - _Requirements: 13.1-13.2, 15.1-15.3, 18.1, 18.7_
  - [ ] 6.2 Create root `compose.yaml`, `compose.local.yaml`, and a locally rendered production-shaped override.
    - Define frontend, API, migrate, bootstrap, PostgreSQL, Redis, MinIO, Nginx, and controlled seed/backup-test profiles; add health gates, named volumes, internal data network isolation, and local-only port mappings. The production-shaped render must publish no data-service ports and expose only Nginx, while the local override provides the developer access needed for tests.
    - _Requirements: 1.1-1.5, 2.1-2.3, 3.1-3.6, 12.1-12.2, 13.3-13.7, 15.1-15.5, 17.3, 18.7_
  - [ ] 6.3 Add a disposable Compose smoke suite that builds and executes frontend, backend, PostgreSQL, Redis, MinIO, and Nginx locally.
    - Use unique project names, volumes, local test certificates, mock adapters, and synthetic secrets. Assert `docker compose config`, clean builds, migration and bootstrap gates, readiness within 120 seconds, frontend/API proxy reachability, PostgreSQL/MinIO persistence after controlled restart, no production data ports, configuration failure blocking, and sanitized container logs.
    - _Requirements: 1.1-1.5, 2.1-2.3, 3.1-3.6, 12.1-12.4, 13.1-13.7, 15.1-15.5, 17.3, 18.7-18.8_
  - [ ] 6.4 Write the deterministic check for **Property 1: Production images exclude repository secrets and run unprivileged**.
    - Inspect frontend and backend images built through the production-shaped Compose render; include negative fixtures that copy the test sentinel or set `USER root`, and assert that each fails with the named invariant violation without emitting the sentinel.
    - _Requirements: 13.1-13.2, 15.1-15.3, 18.1, 18.7; Design Property 1_

- [ ] 7. Implement Nginx routing and local proxy verification
  - [ ] 7.1 Add version-controlled Nginx templates and local certificate/test configuration for the three production host names.
    - Redirect known HTTP hosts to the identical HTTPS host/path/query; reject unknown hosts; serve PWA deep links for public/admin hosts; proxy the API with host, client, scheme, and request-ID headers; configure exact CORS, required security headers, request limits/timeouts, authenticated-cache exclusion, and the 60 requests/minute/IP rate limit with burst at most 20. Mount only local test certificates for automated execution; never bake credentials into images.
    - _Requirements: 10.7, 12.3, 13.3-13.7, 14.1-14.8, 15.1-15.3, 18.7_
  - [ ] 7.2 Add Nginx/Compose integration tests using host-header requests and local test certificates.
    - Run `nginx -t` and assert known-host redirects, unknown-host rejection, PWA deep-link fallback, all three host routes, forwarded request IDs, exact allowed/denied CORS, security headers, rate-limit configuration, and unavailable-upstream behavior without public DNS or a certificate authority.
    - _Requirements: 12.3, 13.3-13.4, 14.1-14.8, 18.7_

- [ ] 8. Implement local-only backup, restore, and acceptance evidence automation
  - [ ] 8.1 Implement repository-local backup/restore scripts or one-shot jobs for encrypted PostgreSQL and MinIO archives.
    - Create a secret-free manifest containing backup ID, completion time, retention expiration, local destination identifier, checksums/integrity result, object count, and restore-drill result. Support isolated local restoration with synthetic test keys; do not configure a real offsite destination.
    - Add local integration tests for archive encryption/integrity, queryable restored database, restored object-count equality, failed-checksum reporting, and 24-hour/30-day/90-day policy calculations.
    - _Requirements: 16.1-16.6, 17.3, 18.7_
  - [ ] 8.2 Implement a machine-readable and human-readable local acceptance evidence ledger generator.
    - Record command/check name, timestamp, image revision, exit status, executed state, and sanitized diagnostics for local tests. Add fixture tests for executed local evidence, named failure reporting, synthetic-secret redaction, and the required labels for authorization-dependent operations.
    - _Requirements: 15.3, 16.2-16.6, 17.4-17.5, 18.1, 18.7-18.8_

- [ ] 9. Wire all repository-local checks into clean-checkout acceptance automation
  - [ ] 9.1 Add CI-compatible local acceptance orchestration for check-only lint/type checks, builds, migrations, unit/integration/API/browser tests, image-boundary checks, Compose smoke, Nginx tests, backup/restore tests, and secret scans.
    - Generate synthetic non-placeholder secrets only in the test process; use mock adapters and disposable Docker resources; collect sanitized reports; return non-zero with named failed checks. Do not contact VPS, DNS, public TLS, external providers, or offsite accounts.
    - _Requirements: 1.1-1.5, 2.1-2.5, 3.1-3.8, 4.1-4.9, 5.1-5.5, 6.1-6.5, 7.1-7.8, 8.1-8.7, 9.1-9.5, 10.1-10.7, 11.1-11.7, 12.1-12.5, 13.1-13.7, 14.1-14.8, 15.1-15.5, 16.1-16.6, 17.3-17.5, 18.1-18.8_
  - [ ] 9.2 Add deliberately failing local fixtures for lint, migration, image-secret/root-user, configuration, routing, and redaction checks.
    - Verify each fixture produces a named non-zero failure and sanitized acceptance evidence, thereby proving the local suite detects failures rather than only passing paths.
    - _Requirements: 15.3, 18.1, 18.7-18.8_

- [ ] 10. Checkpoint - Ensure all automated local checks pass
  - Ensure all tests pass, ask the user if questions arise.

## Deferred Non-Repository Operations

The following actions are explicitly deferred and are not implementation tasks in this plan: VPS provisioning or configuration; firewall changes; remote Docker/Compose deployment; Coolify project, service, secret, volume, domain, migration, cutover, rollback, or recovery operations; public DNS changes; public SSL/TLS certificate issuance or renewal; live Kavenegar or ZarinPal transactions; real offsite backup uploads; and remote restore drills. The local evidence ledger must label them as **Unexecuted — authorization required** and must never claim they occurred. Runbooks and manual operator procedures are intentionally excluded because this plan contains coding and automated-test tasks only.

## Notes

- Every task is repository-local and required. No test sub-task is optional.
- All Docker execution uses local containers, disposable resources, local certificates, synthetic secrets, and mock adapters. It never contacts public DNS, a certificate authority, a VPS, Coolify, external providers, or an offsite account.
- The design contains **Property 1**; task 6.4 implements its required deterministic image-boundary check.
- Each task cites granular requirement clauses for traceability. The dependency graph includes every incomplete leaf task and places shared-file work in successive waves.
- Open `tasks.md` and click **Start task** next to an item to begin implementation.

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1", "2.1"] },
    { "id": 1, "tasks": ["1.2", "6.1"] },
    { "id": 2, "tasks": ["1.3", "2.2", "5.1"] },
    { "id": 3, "tasks": ["2.3", "3.1", "6.2"] },
    { "id": 4, "tasks": ["3.2", "4.1", "5.2", "7.1", "8.1"] },
    { "id": 5, "tasks": ["3.3", "4.2", "6.3"] },
    { "id": 6, "tasks": ["3.4", "4.3", "5.3", "6.4"] },
    { "id": 7, "tasks": ["4.4", "7.2", "8.2"] },
    { "id": 8, "tasks": ["9.1"] },
    { "id": 9, "tasks": ["9.2"] }
  ]
}
```
