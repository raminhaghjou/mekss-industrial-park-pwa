# Implementation Plan: Admin Panel Production Readiness

## Overview

Implement the approved administration bugfix through an exploratory, preservation-first workflow. Tasks 1 and 2 are mandatory pre-fix test tasks: task 1 must fail on the unfixed system and task 2 must pass on the unfixed system. Task 3 contains dependency-ordered implementation leaves that complete the active `CoreModule`/`ManagementController` API, frontend administration experience, premium Persian RTL system, responsive PWA behavior, accessibility, and automated validation without replacing the established authentication, deployment, persistence, or service-worker boundaries.

**Task classification:** `[Required]` tasks are acceptance-blocking and must be completed. `[Optional]` tasks are non-blocking enhancements and must not delay or substitute for any required behavior. Unless explicitly marked `[Optional]`, every task is required. Tests must use isolated/disposable data and non-watch commands; they must never reset or reseed an existing development or production database.

## Tasks

- [x] 1. [Required] Write the bug condition exploration property test
  - **Property 1: Bug Condition** - Truthful Production-Ready Administration
  - **CRITICAL**: Write and run this property-based test before implementing any fix; it MUST FAIL on unfixed code, and the failure is evidence that the bug exists—not a reason to weaken the assertions.
  - Encode `isBugCondition(input)` from the design across affected surface, canonical role, tenant scope, payload validity, API outcome, record count, viewport, direction-sensitive content, connectivity, install-event availability, installed state, keyboard/input mode, theme, zoom, and reduced-motion dimensions.
  - Assert `expectedBehavior(input, result)`: valid authorized, in-scope, confirmed, online, supported operations must be server-confirmed and durable; every invalid, unauthorized, out-of-scope, cancelled, offline, unsupported, stale, conflicting, or failed operation must be explicit, accessible, non-disclosing, and non-mutating without false success.
  - Use deterministic seeds and scoped generators for reproducible cases: API fixture IDs versus `P-01`/`U-001`/mock advertisements, dashboard fixture data versus heading-only output, missing API calls from visible controls, repeated/concurrent moderation, 320-pixel shell geometry, offline mutation, install-event lifecycle, and the known frontend/backend type and build failures.
  - Inventory every routed admin/super-admin page and every visible action; record whether it uses an active `/api/v1` contract, mock array, `alert`/`prompt`/`console`, empty handler, unsupported route, or browser-only state.
  - Capture exact minimized counterexamples, command names, seeds, HTTP/database/audit before-and-after state, and screenshots or accessibility output where applicable. Do not change production code while completing this task.
  - Mark complete only when the test is committed to the test suite, run against unfixed code, fails for the expected bug condition, and the counterexamples are documented in test output or a test artifact.
  - _Requirements: 1.1-1.16, 2.1-2.16_

- [ ] 2. [Required] Write the preservation property tests before implementing the fix
  - **Property 2: Preservation** - Security, Data, Deployment, and Other Roles
  - **IMPORTANT**: Follow observation-first methodology. Run the unfixed system for inputs where `isBugCondition(input)` is false, record actual behavior, then encode those observations as generated equivalence tests.
  - Observe and test established login, refresh, OTP/approval/active checks, required-password-change, profile, logout, protected-route, canonical role, tenant/factory/park scope, and non-admin role behavior.
  - Snapshot compatible `/api/v1` success/error contracts, stable database IDs/relations/statuses/audits, Docker/runtime boundaries, and service-worker handling of static, navigation, API, authenticated, non-GET, and cross-origin requests.
  - Generate non-buggy actor/scope/resource/payload/request/environment combinations and assert `F(X) = F'(X)` for domain, authorization, persistence, privacy, API compatibility, deployment topology, and existing data; permit only the explicitly required Persian RTL, responsive, visual, accessibility, and truthful-feedback improvements.
  - Include regression cases for cancelled/failed/conflicting mutations, public approved-advertisement reads, terminal moderation records, viewport/theme/input changes, unsupported or dismissed installation, and refresh/new-session reads after successful existing operations.
  - Run these tests on unfixed code and verify they PASS. Mark complete only when baseline observations, deterministic seeds, and passing results are recorded before implementation.
  - _Requirements: 3.1-3.16_

- [ ] 3. [Required] Implement the complete production-readiness bugfix in dependency order

  - [x] 3.1 [Required] Establish deterministic validation commands and isolated test infrastructure
    - Add or align non-watch scripts for frontend/backend unit tests, property tests, type checks, check-only lint, production builds, isolated PostgreSQL integration tests, Playwright browser tests, and Docker smoke checks; do not use `--passWithNoTests` as acceptance evidence.
    - Pin any newly required test dependency to an exact version, print property seeds/minimized counterexamples, and guarantee that integration tests refuse non-test database URLs and clean up only their own disposable resources.
    - Preserve the existing passing lazy-export and authentication-guard tests and expose one aggregate command that reports each failed gate by name.
    - _Bug_Condition: `isBugCondition(input)` where `input.surface = AUTOMATED_CHECK` and the current result is a missing, misleading, non-deterministic, or failing required gate._
    - _Expected_Behavior: `expectedBehavior(input, result)` where every required check executes once, reports deterministic evidence, and cannot mutate non-test data._
    - _Preservation: Existing test behavior, package-manager lockfiles, runtime configuration, and production/development databases remain unchanged outside isolated test resources._
    - _Requirements: 1.16, 2.16, 3.3-3.5, 3.14-3.16_

  - [x] 3.2 [Required] Repair the backend active type/build boundary without exposing stale parallel APIs
    - Fix malformed or incompatible inactive legacy sources by retiring/excluding them from the active source set or fully reconciling only code needed by `CoreModule`; do not register the stale advertisement tree or create a second contract.
    - Replace build-blocking syntax/schema/type mismatches, verify `AppModule` still exposes every current active route, and add a route-contract test that detects accidental endpoint loss.
    - Run backend type check, check-only lint, unit tests, and production build successfully before adding new management behavior.
    - _Bug_Condition: `isBugCondition(input)` where the backend automated check fails on malformed inactive sources or active contracts are ambiguous._
    - _Expected_Behavior: `expectedBehavior(input, result)` where the active CoreModule compiles deterministically and no unreachable incompatible module becomes production-visible._
    - _Preservation: Existing `/api/v1` routes, authentication guards, Prisma models, response fields, and module registration remain compatible._
    - _Requirements: 1.5, 1.16, 2.5, 2.9, 3.1-3.5_

  - [x] 3.3 [Required] Repair the frontend type/build boundary and remove dead framework ambiguity
    - Fix current import, MUI component, context default, styled-prop, severity/mode, dashboard typing, and Vite `ImportMetaEnv` errors; remove or isolate unreachable `react-admin` code rather than adding an unused framework.
    - Keep React/Vite, Material UI, React Query, React Router, existing API client, and established auth provider as the only active frontend foundations.
    - Run frontend type check, check-only lint, existing unit tests, and production build successfully, with a route smoke test proving current route identities remain available.
    - _Bug_Condition: `isBugCondition(input)` where the frontend automated check fails or dead code creates an undeclared/parallel UI dependency._
    - _Expected_Behavior: `expectedBehavior(input, result)` where the active application builds cleanly without changing route or auth contracts._
    - _Preservation: Existing public and non-admin routes, token handling, lazy loading, and package/runtime boundaries remain intact._
    - _Requirements: 1.5, 1.16, 2.5, 3.1, 3.3, 3.6_

  - [x] 3.4 [Required] Add the backward-compatible Prisma moderation migration and data-preservation checks
    - Add nullable/indexed advertisement `parkId`, `moderatedById`, and `moderatedAt` fields with explicit creator/moderator relations; preserve existing IDs, content, statuses, rejection reasons, and audit records.
    - Backfill park scope only when creator relationships make it unambiguous; leave ambiguous legacy records unchanged and restricted to safe super-admin visibility rather than guessing.
    - Create a committed additive migration and snapshot test against populated fixtures; prove migrate-deploy and rollback boundaries do not reseed, cascade, reassign identifiers, rewrite terminal states, or lose relations.
    - _Bug_Condition: `isBugCondition(input)` where moderation lacks durable scope/actor/time data or a migration could corrupt existing business records._
    - _Expected_Behavior: `expectedBehavior(input, result)` where new moderation metadata is durable and existing data remains byte/identity/relationship compatible._
    - _Preservation: All existing users, parks, factories, advertisements, statuses, relations, audits, seed policy, and Docker database startup behavior are retained._
    - _Requirements: 2.4, 2.8, 2.9, 3.4, 3.5, 3.10, 3.13-3.16_

  - [x] 3.5 [Required] Implement the shared typed backend validation, canonical actor, error, transaction, and audit foundation
    - Add whitelisted class-validator DTOs and stable machine-classifiable `400/401/403/404/409/5xx` responses for management operations; reject malformed IDs, non-canonical enums, extra fields, invalid dates/numbers/contact values, and weak passwords before mutation.
    - Reconcile each protected admin request with the current database user so deleted, inactive, unapproved, or role-changed users cannot rely on stale token claims; enforce role and resource scope in database predicates.
    - Add reusable transaction/audit helpers that commit the intended mutation and exactly one audit result atomically, distinguish not-found/forbidden/conflict without disclosure, and roll back on audit failure.
    - Test validation matrices, stale claims, scope non-interference, rollback, duplicate retries, redaction, and backward-compatible existing response fields.
    - _Bug_Condition: `isBugCondition(input)` where admin input is untyped, scope is incomplete, stale claims authorize access, or failed/auditless mutations can appear successful._
    - _Expected_Behavior: `expectedBehavior(input, result)` where only current authorized in-scope valid requests mutate atomically and all denials are explicit and non-disclosing._
    - _Preservation: Established bearer-token login/refresh/logout/OTP/password-change behavior and canonical backend role relationships remain authoritative._
    - _Requirements: 2.6-2.9, 3.1-3.3, 3.9, 3.13-3.15_

  - [x] 3.6 [Required] Complete the scoped dashboard API contract
    - Extend `/api/v1/analytics/dashboard` with role/scoped counts, pending-work indicators, recent priority items, and capability identifiers while retaining existing count fields and response compatibility.
    - Apply tenant predicates before aggregation/pagination and return only records/actions visible to `SUPER_ADMIN` or the current `PARK_MANAGER`; do not fabricate zeroes for failed queries.
    - Add generated role/scope/database-state integration tests for Design Property 3, including empty data, failures, narrower scopes, stale users, and no out-of-scope count leakage.
    - _Bug_Condition: `isBugCondition(input)` where `input.surface = ROLE_DASHBOARD` and the result is a heading, placeholder, fabricated metric, or unscoped aggregate._
    - _Expected_Behavior: `expectedBehavior(input, result)` where dashboard data is API-derived, role-scoped, complete, and truthfully classifies empty/error states._
    - _Preservation: Existing analytics count fields and authorized non-admin analytics behavior remain compatible._
    - _Requirements: 1.1, 1.6, 1.7, 1.9, 2.1, 2.6, 2.7, 2.9, 3.2, 3.3, 3.15_

  - [x] 3.7 [Required] Implement transactional industrial-park CRUD APIs
    - Add super-admin-only list/detail/create/update/delete endpoints under `/api/v1/industrial-parks` with pagination/search and committed representations.
    - Validate unique trimmed code, required identity/contact/location values, optional email/date/description, canonical status, and valid `PARK_MANAGER` assignments; update assignments and audits transactionally.
    - Reject deletion with `409` when factories, guards, announcements/files, or other protected relations exist; never cascade business records.
    - Add isolated round-trip, mutable-field, uniqueness, assignment, protected-delete, authorization, retry, refresh/new-session, and rollback tests for Design Property 4.
    - _Bug_Condition: `isBugCondition(input)` where `input.surface = PARK_MANAGEMENT` and parks are hard-coded or CRUD controls are no-op/unvalidated/unpersisted._
    - _Expected_Behavior: `expectedBehavior(input, result)` where valid super-admin operations produce one durable targeted change and invalid/protected operations change nothing._
    - _Preservation: Existing park IDs, relations, factories, guards, announcements, files, scope decisions, and unrelated records remain unchanged._
    - _Requirements: 1.2, 1.6-1.9, 2.2, 2.6-2.9, 3.2-3.4, 3.9-3.10, 3.14-3.16_

  - [x] 3.8 [Required] Implement the safe transactional user administration lifecycle
    - Extend super-admin user list/detail/create/update/activate/deactivate/delete and necessary password-reset/assignment contracts with safe relationship summaries and no credential/token fields.
    - Validate unique phone/email/national ID/username, canonical roles, password policy, and role-compatible park/factory assignments.
    - Atomically prevent acting-account deletion/deactivation, final active approved super-admin removal/demotion/deactivation, and hard deletion with protected relations; revoke refresh tokens after access-changing operations and audit exactly once.
    - Add generated CRUD/invariant, stale-session, uniqueness, assignment, authorization, protected-delete, refresh/new-session, and rollback tests for Design Properties 4 and 6.
    - _Bug_Condition: `isBugCondition(input)` where `input.surface = USER_MANAGEMENT` and records/actions are mock, incomplete, unsafe, or not durable._
    - _Expected_Behavior: `expectedBehavior(input, result)` where authorized valid lifecycle changes persist exactly once and account/relationship safety invariants always hold._
    - _Preservation: Existing user identities, auth flows, roles, assignments, protected relations, other-user sessions, and unrelated records remain intact._
    - _Requirements: 1.3, 1.6-1.9, 2.3, 2.6-2.9, 3.1-3.4, 3.9-3.10, 3.14-3.16_

  - [ ] 3.9 [Required] Implement scoped conflict-safe advertisement moderation APIs
    - Preserve public approved-advertisement reads and add authorized admin list/detail contracts for scoped pending/history records, pagination/filtering, and safe media/contact details.
    - Derive or validate park scope on creation. Permit only atomic `PENDING -> APPROVED|REJECTED` transitions; require a trimmed non-blank rejection reason, record moderator/time and exactly one audit effect, and return non-disclosing `403/404/409` outcomes.
    - Add deterministic sequential/concurrent generated tests for state, decision, reason, role, scope, stale/duplicate requests, ambiguous legacy scope, database/audit atomicity, and fresh-session history for Design Property 5.
    - _Bug_Condition: `isBugCondition(input)` where `input.surface = ADVERTISEMENT_MODERATION` and data is mock, scope is absent, or status can be overwritten without reason/audit/conflict safety._
    - _Expected_Behavior: `expectedBehavior(input, result)` where one authorized pending decision commits durably and every invalid/repeated/concurrent/out-of-scope decision is non-mutating._
    - _Preservation: Existing public approved reads, advertisement IDs/content/statuses, creator relations, terminal records, and unrelated audits remain compatible._
    - _Requirements: 1.4, 1.6-1.9, 2.4, 2.6-2.9, 3.2-3.4, 3.9-3.10, 3.13-3.16_

  - [ ] 3.10 [Required] Complete factory management and approval contracts
    - Complete scoped factory list/detail/create/update plus explicit pending approval/rejection transitions required by `ManageFactoriesPage`; validate ownership/park relations and remove any unconditional state update.
    - Define confirmation/reason rules, immutable versus mutable fields, conflict behavior, audit effects, and post-commit re-read semantics.
    - Add role/scope, CRUD round-trip, transition, duplicate/concurrent, failure atomicity, and response-compatibility integration tests.
    - _Bug_Condition: `isBugCondition(input)` where a visible factory operation is mock, missing, unscoped, unvalidated, or reports an unconfirmed result._
    - _Expected_Behavior: `expectedBehavior(input, result)` where each supported factory operation is scoped, validated, audited, durable, and conflict-safe._
    - _Preservation: Existing factory-owner workflows, IDs, ownership/park relations, approved states, and existing API fields remain compatible._
    - _Requirements: 1.5-1.9, 2.5-2.9, 3.2-3.4, 3.6, 3.9-3.10, 3.14-3.16_

  - [ ] 3.11 [Required] Complete invoice list/create behavior and remove unsupported mutations
    - Wire scoped invoice list/detail/create contracts required by `CreateInvoicePage` and `ManageInvoicesPage`, including validated amounts/dates/factory relations, pagination, and committed responses.
    - Implement update/cancel/delete only if a validated unpaid-only business contract exists; otherwise remove or explicitly disable those affordances with a Persian explanation rather than inventing semantics.
    - Add scope, validation, duplicate, failure, refresh, compatibility, and disabled-unavailable action tests.
    - _Bug_Condition: `isBugCondition(input)` where visible invoice controls are no-op, unsupported, unscoped, or claim browser-only success._
    - _Expected_Behavior: `expectedBehavior(input, result)` where supported invoice operations persist exactly once and unsupported operations are explicitly unavailable and non-mutating._
    - _Preservation: Existing invoice identities, amounts/statuses, payment behavior, factory scope, and compatible `/api/v1` responses remain unchanged._
    - _Requirements: 1.5-1.9, 2.5-2.9, 3.2-3.4, 3.6, 3.9-3.10, 3.14-3.16_

  - [ ] 3.12 [Required] Complete gate-pass and request review contracts
    - Complete scoped list/detail and valid state-transition endpoints needed by `ApproveGatePassesPage` and `ApproveRequestsPage`; define canonical states, confirmation/reason requirements, immutable terminal behavior, and committed representations.
    - Apply scope predicates before reads/mutations, prevent duplicate/concurrent decisions, and audit transitions atomically.
    - Add generated role/scope/state/reason/schedule tests plus empty/error/not-found/conflict and existing-client compatibility coverage.
    - _Bug_Condition: `isBugCondition(input)` where gate-pass/request approval controls are mock, no-op, unscoped, or permit invalid repeated transitions._
    - _Expected_Behavior: `expectedBehavior(input, result)` where one valid in-scope transition commits and all invalid/stale/unauthorized transitions are explicit and non-mutating._
    - _Preservation: Existing guard/requester workflows, IDs, valid statuses, privacy boundaries, and unrelated records remain intact._
    - _Requirements: 1.5-1.9, 2.5-2.9, 3.2-3.3, 3.6, 3.9-3.10, 3.13-3.16_

  - [ ] 3.13 [Required] Complete announcement management contracts
    - Wire scoped announcement list/create and implement validated update/delete only if those controls remain visible; enforce target scope, publish timing, mutable fields, protected relation behavior, and audit/confirmation rules.
    - Remove or explicitly disable any unsupported action instead of retaining a placeholder control.
    - Add CRUD round-trip, scope, validation, failure atomicity, refresh/new-session, and unavailable-action tests.
    - _Bug_Condition: `isBugCondition(input)` where announcement controls depend on mock data, missing routes, empty handlers, or browser-only state._
    - _Expected_Behavior: `expectedBehavior(input, result)` where each visible supported action is scoped and durable and each unsupported action is truthfully unavailable._
    - _Preservation: Existing announcement records, audience semantics, other-role reads, IDs, and unrelated records remain compatible._
    - _Requirements: 1.5-1.9, 2.5-2.9, 3.2-3.4, 3.6, 3.9-3.10, 3.14-3.16_

  - [ ] 3.14 [Required] Resolve messaging as a truthful durable operation
    - Either implement a validated scoped batch-message endpoint that resolves real user IDs and creates durable `Message` rows transactionally, or remove/disable the send route/control with a clear Persian unavailable explanation; never infer recipients from display names.
    - If implemented, validate recipient scope/content/limits, prevent accidental duplicate batches, audit the result, and return a committed recipient summary without leaking excluded users.
    - Test the chosen contract for authorization, scope, validation, duplicates, rollback, refresh, and the explicit unavailable path where applicable.
    - _Bug_Condition: `isBugCondition(input)` where `SendMessagePage` reports alert-based/mock success or addresses non-resolved recipients._
    - _Expected_Behavior: `expectedBehavior(input, result)` where messaging is a durable scoped operation or an explicit non-mutating unavailable state._
    - _Preservation: Existing message rows, recipient privacy, notification/provider boundaries, and unrelated user records remain unchanged._
    - _Requirements: 1.5-1.9, 2.5-2.9, 3.2-3.4, 3.6, 3.9-3.10, 3.14-3.16_

  - [ ] 3.15 [Required] Complete reports with server-derived scoped analytics
    - Replace placeholder report values/charts with scoped API summaries derived from active records and explicit loading/empty/error semantics.
    - Implement downloadable generation only if a real validated server contract is completed; otherwise hide/disable the action with a Persian explanation and no fabricated file or success.
    - Test report derivation, role/scope narrowing, date/filter validation, empty/error states, data consistency with source records, and unavailable downloads.
    - _Bug_Condition: `isBugCondition(input)` where `ReportsPage` displays placeholder metrics or a generate/download control cannot produce a real server result._
    - _Expected_Behavior: `expectedBehavior(input, result)` where displayed reports are scoped and derivable and unsupported exports are explicitly unavailable._
    - _Preservation: Existing analytics fields, source records, authorization, and unrelated domain workflows remain unchanged._
    - _Requirements: 1.1, 1.5-1.9, 2.1, 2.5-2.9, 3.2-3.3, 3.6, 3.9, 3.15-3.16_

  - [ ] 3.16 [Required] Resolve notifications, settings, and SMS configuration truthfully
    - Wire the top-bar notification action/badge to scoped list/read contracts or remove it; expose only settings that persist through a working contract.
    - Replace `SmsConfigPage` browser-held fake secret editing with a super-admin-only non-secret provider-health/masked-sender view, or hide the route with an explicit Persian explanation; never return/store SMS credentials in the browser or database for this UI.
    - Test role/scope, secret non-disclosure, masked health output, read-state/settings persistence where implemented, unavailable states, and navigation/action consistency.
    - _Bug_Condition: `isBugCondition(input)` where notifications/settings/SMS controls are mock, no-op, expose false state, or imply browser-managed secrets._
    - _Expected_Behavior: `expectedBehavior(input, result)` where each visible operation has a safe durable contract or an explicit unavailable state with no secret exposure._
    - _Preservation: Runtime secret management, provider boundaries, existing preferences/notifications, auth, and unrelated records remain unchanged._
    - _Requirements: 1.5-1.9, 2.5-2.9, 3.1-3.5, 3.9-3.10, 3.15-3.16_

  - [ ] 3.17 [Required] Build the shared frontend API, query, mutation, and classified-error layer
    - Extend the existing `base.api.js` client with modules for parks, users, admin advertisements, dashboard, announcements, messages, notifications/settings/SMS health, reports, and missing transitions; do not create a second token store or refresh mechanism.
    - Define normalized typed request/response adapters and query keys containing resource, filters, actor role, and scope identity; clear authenticated query data on sign-out.
    - Implement shared loading/skeleton, empty, classified error/retry, stale/offline, mutation progress, and polite `aria-live` result components; map `400/401/403/404/409`, timeout/offline, and `5xx` to concise Persian guidance without false success.
    - Prevent duplicate mutation submission, retain confirmed data where safe, preserve valid input after failure, and invalidate/refetch exact list/detail/dashboard keys only after server confirmation.
    - Test API compatibility, query isolation across actors/scopes, error mapping, duplicate prevention, invalidation, sign-out clearing, and failure atomicity for Design Property 7.
    - _Bug_Condition: `isBugCondition(input)` where pages use mocks/ad hoc calls or loading/error/mutation states are ambiguous, duplicated, or falsely successful._
    - _Expected_Behavior: `expectedBehavior(input, result)` where all pages share truthful server-confirmed query/mutation behavior and classified recovery._
    - _Preservation: Existing Axios authorization/refresh behavior, confirmed data, entered safe input, and compatible backend fields remain intact._
    - _Requirements: 1.5-1.9, 2.5-2.9, 3.1-3.3, 3.9-3.10, 3.16_

  - [ ] 3.18 [Required] Build shared accessible forms, confirmations, localization, bidi, and operation registry primitives
    - Create reusable form/dialog primitives with associated labels/errors, initial focus, focus trap/return, safe Escape handling, target-and-consequence confirmations, keyboard-complete actions, and no browser `alert`/`confirm`/`prompt`.
    - Define canonical Persian maps for all roles/statuses/categories/priorities/request types; use `Intl.DateTimeFormat('fa-IR')` and `Intl.NumberFormat('fa-IR')`, and semantic bidi isolation for IDs, phones, URLs, codes, and license plates without altering payloads.
    - Add a role-aware operation registry for route/action visibility and availability explanations; keep backend authorization authoritative and handle server denials even for expected-visible actions.
    - Test focus behavior, labels/errors/live announcements, enum coverage, date/number formatting, storage/payload integrity, bidi rendering, role visibility, and disabled explanations.
    - _Bug_Condition: `isBugCondition(input)` where confirmations are inaccessible, strings/raw enums are untranslated, bidi content is broken, or frontend visibility misrepresents capability._
    - _Expected_Behavior: `expectedBehavior(input, result)` where interactions are accessible, consistently Persian RTL, correctly formatted, and truthful about authorization/availability._
    - _Preservation: Canonical stored/API values, user-entered content, search/sort semantics, route authorization, and payload identifiers remain unchanged._
    - _Requirements: 1.8-1.10, 1.15, 2.8-2.10, 2.15, 3.2, 3.6, 3.11-3.12, 3.15-3.16_

  - [ ] 3.19 [Required] Implement the premium Persian RTL visual system and professional authentication background
    - Replace scattered styling with semantic light/dark tokens for MEKSS canvas/surfaces, restrained depth, hierarchy, brand blue/accent, typography, spacing, radii, borders, focus, status colors, shadows, and subtle nonessential motion.
    - Use a packaged/local Persian-capable font fallback strategy that remains polished offline; standardize page headers, summary cards, filters, data containers, dialogs, forms, status chips, and feedback.
    - Create a professional responsive authentication background and auth-card treatment that retains MEKSS identity, supports light/dark mode and RTL, avoids distracting motion/contrast loss, and does not imitate protected platform assets.
    - Add token/component tests plus visual, contrast, reduced-motion, forced zoom/reflow, offline-font, and auth-state snapshots at representative mobile/tablet/desktop sizes.
    - _Bug_Condition: `isBugCondition(input)` where the visual system is generic/inconsistent, auth presentation is unprofessional, or theme states reduce legibility/accessibility._
    - _Expected_Behavior: `expectedBehavior(input, result)` where all surfaces use one cohesive premium MEKSS Persian RTL system in light/dark and accessibility modes._
    - _Preservation: Route behavior, authentication semantics, stored theme preference, business data, and user-entered content remain unchanged._
    - _Requirements: 1.10-1.12, 1.15, 2.10-2.12, 2.15, 3.6, 3.11-3.12, 3.16_

  - [ ] 3.20 [Required] Rebuild responsive role-aware navigation and the accessible application shell
    - Update `DashboardLayout` to use an active-route-aware collapsible desktop rail/drawer and temporary tablet/mobile navigation with reachable primary destinations and a Persian “more” path; never apply desktop negative margins on narrow screens.
    - Close transient navigation after selection, restore focus to the trigger, label icon controls, preserve React Router location/task state, and keep account/install/offline actions reachable.
    - Add responsive semantic table/card/definition-list patterns, safe-area/dynamic-viewport/virtual-keyboard handling, 44-by-44 CSS-pixel targets, narrow-height scrolling, and page-level overflow prevention from 320 pixels upward.
    - Test role menus, route preservation, drawer focus, RTL reading order, keyboard/touch behavior, 320/mobile/tablet/desktop/narrow-height/high-zoom layouts, and action reachability for Design Property 8.
    - _Bug_Condition: `isBugCondition(input)` where responsive navigation is persistent/overflowing/unreachable/inaccessible or layout changes discard task context._
    - _Expected_Behavior: `expectedBehavior(input, result)` where navigation and records reflow without page overflow and preserve route, selection, form, and confirmed data._
    - _Preservation: Existing route identities, auth session, role-appropriate destinations, safe drafts, selected records, and query state remain intact._
    - _Requirements: 1.12, 1.15, 2.12, 2.15, 3.6, 3.12, 3.16_

  - [ ] 3.21 [Required] Implement compliant install-prompt lifecycle and offline mutation safety
    - Capture `beforeinstallprompt`, retain only the current valid event, expose a non-blocking Persian install affordance only when available/not standalone, and call `prompt()` only from the user's install action; handle accepted, dismissed, `appinstalled`, display-mode, and conservative dismissal suppression.
    - Preserve exactly one service-worker registration and prove API, authenticated/private, non-GET, and cross-origin requests bypass caches while same-origin shell/static GET assets remain eligible.
    - Add online/offline state, Persian shell banner, retained-data staleness, blocked admin mutations, and reconnect invalidation; stale-sensitive decisions remain disabled until a successful authoritative refresh.
    - Never persist sensitive drafts/private responses or queue/background-replay writes. Test generated install/connectivity/request combinations for Design Property 9.
    - _Bug_Condition: `isBugCondition(input)` where install lifecycle is missing/invalid or offline/stale admin actions can appear persistable/private responses can be cached._
    - _Expected_Behavior: `expectedBehavior(input, result)` where installation is user-gesture/event-driven and offline writes are blocked until confirmed reconnection refresh._
    - _Preservation: Browser functionality without installation, the single-worker shell behavior, private/API cache exclusions, and dismissed/standalone behavior remain intact._
    - _Requirements: 1.13-1.14, 2.13-2.14, 3.7-3.8, 3.12, 3.16_

  - [ ] 3.22 [Required] Replace the role dashboard with real scoped operational data
    - Wire `DashboardPage` to the dashboard query and render role-scoped summaries, pending work, recent priority information, permitted quick actions, and distinct context-preserving loading/empty/retry states without fabricated metrics.
    - Use shared Persian formatting, semantic headings/landmarks, responsive cards/lists, accessible action names, and stale/offline signaling.
    - Add component/browser tests for super-admin, park-manager, narrower/changed scope, empty/error/loading/stale data, route/action visibility, API fixture source integrity, and responsive/accessibility behavior.
    - _Bug_Condition: `isBugCondition(input)` where `input.surface = ROLE_DASHBOARD` and only a role heading or placeholder content is rendered._
    - _Expected_Behavior: `expectedBehavior(input, result)` where every value/action comes from the scoped API and all unavailable states are explicit._
    - _Preservation: Existing role routing, authentication, non-admin dashboards, and unrelated query data remain unchanged._
    - _Requirements: 1.1, 1.6-1.7, 1.9-1.12, 1.14-1.15, 2.1, 2.6-2.7, 2.9-2.12, 2.14-2.15, 3.1-3.3, 3.6, 3.12, 3.15-3.16_

  - [ ] 3.23 [Required] Replace `ManageParksPage` mocks with complete API-backed park administration
    - Implement responsive list/search/pagination/detail/create/edit/eligible-delete flows using shared query/form/confirmation/error primitives and stable server IDs.
    - Surface field/domain errors, manager assignment, protected-delete conflicts, duplicate prevention, server-confirmed success, refresh/new-session durability, offline blocking, and super-admin-only action visibility.
    - Add component/browser tests for every state and action, including keyboard dialog flow, 320-pixel presentation, bidi values, duplicate clicks, failure data retention, and no `mockParks`/no-op control.
    - _Bug_Condition: `isBugCondition(input)` where `input.surface = PARK_MANAGEMENT` and hard-coded parks or disconnected controls are visible._
    - _Expected_Behavior: `expectedBehavior(input, result)` where park CRUD reflects the authoritative server and failures remain explicit/non-mutating._
    - _Preservation: Unrelated parks/relations, stable identities, route context, safe form input, and authorization remain intact._
    - _Requirements: 1.2, 1.6-1.10, 1.12, 1.14-1.15, 2.2, 2.6-2.10, 2.12, 2.14-2.15, 3.2-3.4, 3.9-3.12, 3.14-3.16_

  - [ ] 3.24 [Required] Replace `ManageUsersPage` mocks with complete safe user administration
    - Implement discoverable create, list/search/filter/pagination, detail/edit, activate/deactivate, eligible delete, assignment, and supported password-reset flows with canonical role labels.
    - Present self/final-super-admin/protected-relation constraints, confirmations, field errors, token/session-impact guidance, server-confirmed outcomes, offline blocking, and refresh/new-session reconciliation.
    - Add component/browser tests for every lifecycle path, canonical enums, protected actions, changed-role/session behavior, keyboard/focus/live regions, responsive records, duplicate prevention, and no hard-coded users.
    - _Bug_Condition: `isBugCondition(input)` where `input.surface = USER_MANAGEMENT` and users/actions are hard-coded, absent, disconnected, or unsafe._
    - _Expected_Behavior: `expectedBehavior(input, result)` where authorized valid user changes persist exactly once and safety invariants are accurately explained._
    - _Preservation: Acting/final administrator safety, existing user identities/relations, auth flows, unrelated sessions, and canonical role semantics remain intact._
    - _Requirements: 1.3, 1.6-1.10, 1.12, 1.14-1.15, 2.3, 2.6-2.10, 2.12, 2.14-2.15, 3.1-3.4, 3.9-3.12, 3.14-3.16_

  - [ ] 3.25 [Required] Replace advertisement mocks with one complete scoped moderation experience
    - Consolidate `ApproveAdvertisementsPage` and `SuperAdminAdsPage` around shared pending/history/detail components and role/scope-aware contracts without duplicate business logic.
    - Show safe complete media/contact details, approve confirmation, reject dialog with required Persian reason, mutation progress, terminal history, conflict/not-found/forbidden outcomes, and authoritative re-read.
    - Add component/browser tests for super-admin/park-manager scope, empty/history/loading/error/offline states, keyboard/media semantics, duplicate/concurrent decisions, bidi content, and absence of mock cards/alerts/prompts.
    - _Bug_Condition: `isBugCondition(input)` where `input.surface = ADVERTISEMENT_MODERATION` and records/actions are mock, incomplete, unscoped, or non-persisting._
    - _Expected_Behavior: `expectedBehavior(input, result)` where exactly one valid decision persists and every invalid/stale/out-of-scope outcome is explicit and non-mutating._
    - _Preservation: Public approved-ad browsing, existing terminal content, creator data boundaries, route identity, and unrelated records remain unchanged._
    - _Requirements: 1.4, 1.6-1.10, 1.12, 1.14-1.15, 2.4, 2.6-2.10, 2.12, 2.14-2.15, 3.2-3.4, 3.7, 3.9-3.16_

  - [ ] 3.26 [Required] Replace factory management mocks and no-op controls
    - Wire `ManageFactoriesPage` list/filter/detail/create/edit/approval/rejection actions to the scoped factory contracts using shared primitives and stable IDs.
    - Present role/scope restrictions, validation/reason/confirmation, conflict/retry, durable status/history, offline/stale blocking, and responsive accessible row/card actions.
    - Add component/browser tests for all API states, scope narrowing, duplicate decisions, refresh durability, keyboard/zoom/mobile use, and absence of mock arrays/empty handlers.
    - _Bug_Condition: `isBugCondition(input)` where visible factory management is mock, no-op, unscoped, or browser-only._
    - _Expected_Behavior: `expectedBehavior(input, result)` where every supported factory action has a truthful server-confirmed result._
    - _Preservation: Factory-owner workflows, existing factory records/relations, route behavior, and unrelated data remain unchanged._
    - _Requirements: 1.5-1.10, 1.12, 1.14-1.15, 2.5-2.10, 2.12, 2.14-2.15, 3.2-3.3, 3.6, 3.9-3.12, 3.14-3.16_

  - [ ] 3.27 [Required] Replace invoice creation/management mocks and unsupported controls
    - Wire `CreateInvoicePage` and `ManageInvoicesPage` to scoped list/detail/create and any explicitly supported unpaid-only mutation; remove or clearly disable unsupported edit/delete actions.
    - Preserve entered valid form data on failure, show Persian validation/loading/empty/error/confirmation feedback, block offline/duplicate submissions, and reconcile from the server.
    - Add component/browser tests for supported and unavailable actions, role/scope, validation, failure, refresh, responsive forms/tables, keyboard flow, and no alert/no-op behavior.
    - _Bug_Condition: `isBugCondition(input)` where invoice pages expose mock, disconnected, unsupported, or unconfirmed actions._
    - _Expected_Behavior: `expectedBehavior(input, result)` where supported invoice changes are durable and unsupported changes cannot be mistaken for working._
    - _Preservation: Existing invoice/payment records, factory scope, payload semantics, and unrelated records remain unchanged._
    - _Requirements: 1.5-1.10, 1.12, 1.14-1.15, 2.5-2.10, 2.12, 2.14-2.15, 3.2-3.3, 3.6, 3.9-3.12, 3.14-3.16_

  - [ ] 3.28 [Required] Replace gate-pass and request approval mocks
    - Wire `ApproveGatePassesPage` and `ApproveRequestsPage` to scoped lists/details and valid status transitions with target-specific confirmations/reasons and server-confirmed history.
    - Handle terminal, concurrent, not-found, forbidden, conflict, offline, loading, empty, and stale-reconnect states using shared primitives.
    - Add component/browser tests for role/scope/state matrices, keyboard/mobile use, duplicate clicks, no protected disclosure, and absence of mock/no-op controls.
    - _Bug_Condition: `isBugCondition(input)` where approval pages use placeholder records or actions do not execute valid durable transitions._
    - _Expected_Behavior: `expectedBehavior(input, result)` where only one valid in-scope decision commits and every other outcome is explicit/non-mutating._
    - _Preservation: Existing requester/guard workflows, valid terminal records, route behavior, and privacy boundaries remain unchanged._
    - _Requirements: 1.5-1.10, 1.12, 1.14-1.15, 2.5-2.10, 2.12, 2.14-2.15, 3.2-3.3, 3.6, 3.9-3.16_

  - [ ] 3.29 [Required] Replace announcement management mocks and no-op controls
    - Wire `ManageAnnouncementsPage` to scoped list/create and every supported update/delete contract; remove or explain unsupported controls.
    - Add responsive accessible detail/form/confirmation states, server-confirmed reconciliation, Persian validation, duplicate/offline blocking, and clear conflict/retry behavior.
    - Add component/browser tests for role/scope, all query/mutation states, safe draft retention, keyboard/zoom/mobile use, refresh durability, and no mock arrays/alerts/prompts.
    - _Bug_Condition: `isBugCondition(input)` where announcements are mock, browser-only, unsupported, or falsely successful._
    - _Expected_Behavior: `expectedBehavior(input, result)` where each visible supported announcement action is durable and every unavailable action is explicit._
    - _Preservation: Existing announcements, audience scope, user-facing reads, identifiers, and unrelated records remain unchanged._
    - _Requirements: 1.5-1.10, 1.12, 1.14-1.15, 2.5-2.10, 2.12, 2.14-2.15, 3.2-3.4, 3.6, 3.9-3.12, 3.14-3.16_

  - [ ] 3.30 [Required] Make messaging, reports, notifications, settings, and SMS pages truthful
    - Update `SendMessagePage`, `ReportsPage`, top-bar notifications, settings routes, and `SmsConfigPage` to consume the contracts/explicit unavailable states selected in tasks 3.14-3.16.
    - Remove every mock metric, fake secret field, fabricated badge/download, alert-based success, empty handler, and production-visible placeholder; provide Persian rationale for intentionally unavailable capabilities.
    - Add component/browser tests for real data source integrity, role/scope, secret non-disclosure, durable results, unavailable explanations, loading/empty/error/offline states, responsive keyboard use, and action inventory coverage.
    - _Bug_Condition: `isBugCondition(input)` where these visible operations are mock, no-op, secret-unsafe, placeholder, or imply unsupported success._
    - _Expected_Behavior: `expectedBehavior(input, result)` where each visible operation is API-backed and durable or clearly unavailable and non-mutating._
    - _Preservation: Existing messages/analytics/notifications/preferences, runtime secrets, provider boundaries, and unrelated workflows remain unchanged._
    - _Requirements: 1.5-1.10, 1.12, 1.14-1.15, 2.5-2.10, 2.12, 2.14-2.15, 3.2-3.6, 3.9-3.12, 3.14-3.16_

  - [ ] 3.31 [Required] Enforce the complete visible-operation truthfulness inventory
    - Re-run the route/control inventory from task 1 across `App.jsx`, role navigation, every `pages/admin` route, every relevant `pages/superadmin` route, dashboard shell actions, notifications, settings, and account/PWA actions.
    - Add a static/runtime test for Design Property 10 that fails on reachable production mock arrays, placeholder values, browser `alert`/`prompt`/`confirm`, console-only actions, empty handlers, unsupported API calls, raw enums, unlabeled icon actions, or controls with no API/unavailable-state contract.
    - Remove dead routes/actions or attach an explicit role-aware Persian unavailable state; verify no removal hides an already working authorized operation.
    - _Bug_Condition: `isBugCondition(input)` where `input.surface = OTHER_VISIBLE_ADMIN_OPERATION` and activation is mock, placeholder, no-op, unsupported, or misleading._
    - _Expected_Behavior: `expectedBehavior(input, result)` where every reachable production control is real and server-confirmed or explicitly unavailable._
    - _Preservation: Existing working authorized operations, route identities needed by users, and non-admin workflows remain available._
    - _Requirements: 1.5-1.10, 1.15-1.16, 2.5-2.10, 2.15-2.16, 3.2-3.3, 3.6, 3.11, 3.15-3.16_

  - [ ] 3.32 [Required] Complete cross-cutting WCAG 2.2 AA, Persian RTL, responsive, and state validation
    - Run automated accessibility scans and keyboard-only flows for dashboard, all create/edit/detail/confirm/reject dialogs, navigation, auth, query/error states, and PWA/offline/install affordances.
    - Verify logical landmarks/headings/RTL reading order, accessible names, labels/errors, live announcements, visible focus, focus containment/return, non-color status meaning, contrast, reduced motion, 200% zoom/reflow, 44-pixel targets, and no page-level overflow from 320 pixels upward.
    - Generate locale-sensitive values and mixed-direction IDs/phones/URLs/codes/plates to prove presentation correctness without payload/storage mutation; verify route, selection, safe draft, and confirmed data survive theme/viewport/input changes.
    - _Bug_Condition: `isBugCondition(input)` where an admin interaction is inaccessible, untranslated, bidi-broken, overflowing, or loses context under supported accessibility/environment variation._
    - _Expected_Behavior: `expectedBehavior(input, result)` where all required flows meet the accessible Persian RTL responsive properties._
    - _Preservation: Exact identifiers/content/payloads, active task state, session, safe drafts, and server-confirmed records remain unchanged._
    - _Requirements: 1.10-1.12, 1.15-1.16, 2.10-2.12, 2.15-2.16, 3.6, 3.11-3.12, 3.16_

  - [ ] 3.33 [Required] Run backend, migration, and API integration/property validation
    - Against an isolated migrated PostgreSQL database, run dashboard scope, park CRUD, user lifecycle, moderation state machine/concurrency, factory, invoice, gate-pass, request, announcement, messaging/report/notification/settings/SMS, canonical-actor, authorization non-interference, failure atomicity, audit, and refresh/new-session suites.
    - Include generated valid/invalid payloads, actors/scopes, sequential/concurrent schedules, injected failures, and populated pre-migration snapshots; assert exact database/audit deltas and no unrelated changes.
    - Run backend unit tests, property tests, type check, check-only lint, production build, route-contract checks, and migration deploy checks with deterministic seeds and no test-data leakage.
    - _Bug_Condition: `isBugCondition(input)` where any backend or persistence result violates the expected behavior for generated affected inputs._
    - _Expected_Behavior: `expectedBehavior(input, result)` where all backend Design Properties 3-7 and applicable portions of 1-2 pass deterministically._
    - _Preservation: Authentication, API compatibility, existing data, non-admin roles, migration safety, and unrelated records satisfy the task 2 baseline._
    - _Requirements: 2.1-2.9, 2.14, 2.16, 3.1-3.5, 3.9-3.10, 3.13-3.16_

  - [ ] 3.34 [Required] Run frontend unit, property, integration, and browser validation
    - Run shared API/query/error/dialog/localization/install/connectivity/service-worker unit tests and generated UI properties for roles, scopes, outcomes, locale values, viewports, themes, zoom, input modes, install states, and connectivity.
    - Run Playwright production-build flows for every admin/super-admin route at 320/mobile/tablet/desktop/narrow-height/high-zoom sizes, keyboard-only operation, light/dark/reduced-motion, install acceptance/dismissal/standalone, offline/reconnect, and no private API cache entries.
    - Verify no mock/no-op controls, false success, raw enums, page overflow, inaccessible actions, route/task loss, or unsafe offline mutation; sanitize artifacts so they retain no tokens/private payloads.
    - Run frontend unit/property tests, type check, check-only lint, and production build with deterministic named results.
    - _Bug_Condition: `isBugCondition(input)` where any frontend/PWA/accessibility outcome violates required affected-surface behavior._
    - _Expected_Behavior: `expectedBehavior(input, result)` where Design Properties 7-10 and applicable portions of 1-2 pass across generated browser states._
    - _Preservation: Public/non-admin routes, auth/session handling, stored values, service-worker privacy, and task-2 observed behavior remain compatible._
    - _Requirements: 2.1, 2.5-2.16, 3.1-3.3, 3.6-3.12, 3.15-3.16_

  - [ ] 3.35 [Required] Validate the production-shaped Docker stack and runtime boundaries
    - Build and start the existing frontend, backend, PostgreSQL, Redis, MinIO, and proxy stack with disposable test resources and synthetic non-secret configuration; run migration, health, proxy `/api/v1`, frontend deep-link, and browser smoke checks.
    - Verify no production reseed, no embedded secret, no topology replacement, one service-worker registration, authenticated/API cache bypass, persistence across controlled restart, and admin refresh/new-session visibility after committed mutations.
    - Stop and clean up only the uniquely named test stack; record named failures and sanitized logs without changing deployment configuration merely to satisfy tests.
    - _Bug_Condition: `isBugCondition(input)` where production-shaped build/runtime checks fail or repaired behavior depends on development-only assumptions._
    - _Expected_Behavior: `expectedBehavior(input, result)` where the complete fix builds and operates inside established deployment boundaries._
    - _Preservation: Existing Docker services, proxy paths, runtime secret boundaries, persistent volumes, and startup/migration behavior remain intact._
    - _Requirements: 2.16, 3.3-3.5, 3.7, 3.10, 3.16_

  - [ ] 3.36 [Optional] Add extended visual-regression coverage for premium surfaces
    - Add non-blocking screenshot baselines for representative dashboard, list, form, confirmation, auth background, offline, install, and empty/error states across light/dark mobile/tablet/desktop variants.
    - Keep semantic/accessibility/functional assertions authoritative; tolerate only intentional rendering differences and do not use screenshot approval to conceal regressions.
    - _Bug_Condition: Visual drift beyond the required semantic token/component coverage may reduce consistency without changing domain behavior._
    - _Expected_Behavior: Optional snapshots provide earlier detection of unintended visual drift._
    - _Preservation: This task changes no runtime contract, data, authorization, or acceptance requirement._
    - _Requirements: 2.10-2.12, 2.15, 3.11-3.12_

  - [ ] 3.37 [Required] Verify the original bug condition exploration test now passes
    - **Property 1: Expected Behavior** - Truthful Production-Ready Administration
    - **IMPORTANT**: Re-run the SAME property test and deterministic counterexamples from task 1; do not replace it with a weaker or newly scoped test.
    - Confirm all inputs satisfying `isBugCondition(input)` now satisfy `expectedBehavior(input, result)`, including every route/control, API/data invariant, viewport/accessibility state, install/connectivity state, and required automated gate.
    - **EXPECTED OUTCOME**: The test PASSES, proving the bug condition is fixed. Record the original counterexamples and their passing fixed outcomes.
    - _Bug_Condition: `isBugCondition(input)` exactly as encoded in task 1 and the design._
    - _Expected_Behavior: `expectedBehavior(input, result)` exactly as encoded in task 1 and the design._
    - _Preservation: This verification reuses the original exploration oracle and does not alter production code or test scope._
    - _Requirements: 2.1-2.16_

  - [ ] 3.38 [Required] Verify the preservation property tests still pass
    - **Property 2: Preservation** - Security, Data, Deployment, and Other Roles
    - **IMPORTANT**: Re-run the SAME observation-derived property tests from task 2; do not rewrite expected baseline behavior after seeing fixed output.
    - Compare the fixed system with the recorded unfixed observations for authentication, role/scope, unchanged APIs, populated database, other-role workflows, Docker/runtime boundaries, service-worker privacy, failed mutations, and persisted refresh/new-session behavior.
    - **EXPECTED OUTCOME**: All preservation tests PASS, proving no regression outside the bug condition except explicitly allowed Persian RTL, responsive, visual, accessibility, and truthful-feedback improvements.
    - _Bug_Condition: Inputs satisfy `NOT isBugCondition(input)` as encoded in task 2._
    - _Expected_Behavior: `F(X) = F'(X)` for domain, security, persistence, deployment, and privacy outcomes outside the allowed UI differences._
    - _Preservation: The original observations and generators remain unchanged and authoritative._
    - _Requirements: 3.1-3.16_

- [ ] 4. [Required] Checkpoint - Ensure all required tests and acceptance gates pass
  - Run the aggregate non-watch validation command and confirm required frontend/backend unit, property, integration, type, lint, build, migration, browser/accessibility, service-worker/PWA, and Docker smoke gates pass.
  - Confirm task 1's exploration property now passes, task 2's preservation property still passes, no required task remains incomplete, and optional task 3.36 is explicitly recorded as completed or skipped.
  - Review test/database/Docker artifacts for sanitized deterministic evidence and ensure no application code was accepted on the basis of mock data, false success, unexecuted checks, or changes to non-test data.
  - Ask the user if any acceptance question or environment-specific blocker remains.
  - _Requirements: 2.1-2.16, 3.1-3.16_

## Task Dependency Graph

The numbered order is authoritative. Tasks 1 and 2 must complete before any task 3 implementation. Within task 3, execute the required leaves using these dependency waves; tasks in the same wave may proceed independently only when they do not edit the same files or database migration.

```json
{
  "waves": [
    { "id": 0, "tasks": ["1"] },
    { "id": 1, "tasks": ["2"] },
    { "id": 2, "tasks": ["3.1"] },
    { "id": 3, "tasks": ["3.2", "3.3"] },
    { "id": 4, "tasks": ["3.4", "3.5"] },
    { "id": 5, "tasks": ["3.6", "3.7", "3.8", "3.9", "3.10", "3.11", "3.12", "3.13", "3.14", "3.15", "3.16"] },
    { "id": 6, "tasks": ["3.17", "3.18", "3.19"] },
    { "id": 7, "tasks": ["3.20", "3.21"] },
    { "id": 8, "tasks": ["3.22", "3.23", "3.24", "3.25", "3.26", "3.27", "3.28", "3.29", "3.30"] },
    { "id": 9, "tasks": ["3.31", "3.32"] },
    { "id": 10, "tasks": ["3.33", "3.34"] },
    { "id": 11, "tasks": ["3.35", "3.36"] },
    { "id": 12, "tasks": ["3.37", "3.38"] },
    { "id": 13, "tasks": ["4"] }
  ]
}
```

## Notes

- All required production-visible capabilities must end in one of two truthful states: a real authorized API-backed server-confirmed operation, or a clearly unavailable/disabled Persian state. Optional task 3.36 may be skipped; no other task is optional.
- The active backend path remains `AppModule -> CoreModule -> ManagementController/ManagementService -> Prisma/AuditService`. Do not revive the incompatible unregistered advertisement module as a parallel API.
- No mutation may use optimistic success, offline replay, browser-only persistence, mock arrays, `alert`/`prompt`/`confirm`, console-only behavior, or an empty handler.
- Tasks 1 and 3.1-3.4 have sufficient recorded repository evidence to retain their completion markers. Task 2 remains incomplete because its current preservation artifact is source-level only and records no HTTP, database, or Docker observation. The next implementation task is 3.5; continue in dependency order and do not mark any later task complete until all coding, testing, build, migration, browser, and runtime outcomes required by that task have been executed and recorded.
