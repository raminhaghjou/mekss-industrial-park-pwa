# Admin Panel Production Readiness Bugfix Design

## Overview

The administration application currently presents production-looking dashboards, CRUD controls, moderation actions, reports, messaging, and configuration controls while much of the routed frontend is backed by hard-coded arrays, browser alerts, empty handlers, or placeholder content. The active backend is narrower than the visible UI: `AppModule` imports `CoreModule`, and `ManagementController` exposes useful `/api/v1` operations, but it lacks industrial-park CRUD, user deletion and account-safety invariants, complete administrator query/detail contracts, durable scoped advertisement moderation, and several operations currently advertised by the UI. A separate advertisement module is not registered and targets types and relations that do not exist in the active Prisma schema; it is not a safe basis for the fix.

The fix will retain the active React/Vite, Material UI, React Query, NestJS `CoreModule`, Prisma/PostgreSQL, token/session, Docker, Redis, MinIO, proxy, and service-worker boundaries. It will complete the active `/api/v1` management surface with validated DTOs, server-side role/scope enforcement, transactions, audit records, conflict-safe state transitions, and backward-compatible response behavior. The frontend will replace every production-visible mock/no-op administrator control with a React Query operation against that API or remove/disable it with an explicit Persian explanation. Shared admin primitives will provide consistent query, mutation, empty, error, confirmation, localization, responsive, accessibility, connectivity, and installation behavior.

The visual approach is a cohesive Persian RTL system with MEKSS identity: restrained layered surfaces, clear hierarchy, high-quality Persian typography, semantic status colors, consistent tokens, compact but legible data presentation, and subtle nonessential motion. Desktop uses a role-aware navigation rail/drawer; smaller screens use a temporary drawer and reachable app navigation without changing routes or task state. PWA installation is driven only by the browser's install event and a user gesture. Offline support remains shell-only: authenticated API data and mutations are never cached or silently replayed.

No implementation is performed in this phase. This document defines the target architecture, invariants, and validation strategy for subsequent tasks.

## Glossary

- **Bug_Condition (C)**: An input, actor, resource, environment, or UI state that reaches an affected administrator surface and currently produces mock, placeholder, no-op, unpersisted, misleading, inaccessible, unauthorized, or unusable behavior.
- **Property (P)**: The required truthful result: an authorized and validated operation is server-confirmed and durable, while an invalid, unauthorized, offline, unsupported, cancelled, conflicting, or failed operation is explicit and non-mutating.
- **Preservation**: Observational equivalence for behavior outside `C(X)`, especially authentication, canonical authorization, other-role workflows, persisted records, API compatibility, Docker topology, and service-worker privacy boundaries.
- **F / F'**: The current unfixed system and the fixed system respectively.
- **Canonical Role**: One of the active Prisma `Role` values: `SUPER_ADMIN`, `PARK_MANAGER`, `FACTORY_OWNER`, `SECURITY_GUARD`, `GOVERNMENT_OFFICIAL`, or `EMPLOYEE`.
- **Scope**: The parks and factories an actor may read or mutate according to canonical backend relationships. Host name and frontend visibility are not scope grants.
- **Server-confirmed State**: Data returned by, or subsequently re-read from, the active `/api/v1` API after a committed database operation.
- **Terminal Moderation State**: `APPROVED` or `REJECTED`; only a `PENDING` advertisement may transition to a terminal state.
- **Conflict-safe Mutation**: A mutation whose preconditions are checked atomically so stale, repeated, or concurrent requests cannot create duplicate or contradictory effects.
- **Admin Operation Registry**: A shared frontend description of route, label, canonical roles, scope expectations, and availability used by navigation and action visibility; it improves presentation but never replaces backend guards.
- **Sensitive Data**: Credentials, tokens, private API responses, contact details not authorized for the actor, and secrets such as SMS provider keys. Sensitive data is neither service-worker cached nor retained as an offline draft.
- **`ManagementController` / `ManagementService`**: The active management API in `mekss-backend/src/core/management.controller.ts` and `management.service.ts`.
- **`DashboardLayout`**: The routed shell in `mekss-industrial-park/src/layouts/DashboardLayout.jsx` that owns role-aware navigation, connectivity status, install affordance, and global account actions.
- **PWA Install Event**: The browser-provided `beforeinstallprompt` event, retained only while valid and invoked only after a user selects the install action.

## Bug Details

### Bug Condition

The bug manifests when an administrator reaches any affected dashboard, CRUD, moderation, visible operation, shared Persian/RTL surface, responsive navigation state, connectivity state, or PWA installation state and the current system cannot provide a truthful, authorized, durable, accessible result. It includes valid operations that are currently mock or no-op and invalid/unsupported operations that currently appear to succeed or remain misleadingly actionable.

**Formal Specification:**
```
FUNCTION isBugCondition(input)
  INPUT: input of type AdminInteractionOrEnvironment
  OUTPUT: boolean

  affectedSurface := input.surface IN {
    ROLE_DASHBOARD,
    PARK_MANAGEMENT,
    USER_MANAGEMENT,
    ADVERTISEMENT_MODERATION,
    OTHER_VISIBLE_ADMIN_OPERATION,
    PERSIAN_RTL_PRESENTATION,
    RESPONSIVE_NAVIGATION,
    PWA_INSTALLATION,
    OFFLINE_ADMIN_STATE,
    ACCESSIBLE_INTERACTION,
    AUTOMATED_CHECK
  }

  defectiveResult := input.currentResult HAS_ANY {
    PLACEHOLDER_DATA,
    MOCK_DATA,
    EMPTY_OR_CONSOLE_HANDLER,
    BROWSER_ONLY_MUTATION,
    FALSE_SUCCESS,
    MISSING_OR_INCORRECT_AUTHORIZATION,
    MISSING_TENANT_SCOPE,
    MISSING_VALIDATION_OR_CONFIRMATION,
    UNHANDLED_LOADING_EMPTY_ERROR_OR_CONFLICT,
    RAW_ENUM_OR_BROKEN_RTL,
    INACCESSIBLE_CONTROL_OR_DIALOG,
    HORIZONTAL_OVERFLOW_OR_UNREACHABLE_NAVIGATION,
    INVALID_INSTALL_PROMPT_LIFECYCLE,
    UNSAFE_OFFLINE_MUTATION_OR_PRIVATE_CACHE,
    FAILING_REQUIRED_AUTOMATED_CHECK
  }

  RETURN affectedSurface AND defectiveResult
END FUNCTION
```

The required result predicate is:

```
FUNCTION expectedBehavior(input, result)
  INPUT: input of type AdminInteractionOrEnvironment
         result of type AdminResult
  OUTPUT: boolean

  IF input.isAuthorized
     AND input.isInScope
     AND input.payloadIsValid
     AND input.confirmedWhenRequired
     AND input.connectivityIsOnline
     AND input.operationIsSupported THEN
    RETURN result.isServerConfirmed
       AND result.matchesExactlyIntendedChange
       AND result.isDurableAcrossRefreshAndNewSession
       AND result.preservesUnrelatedRecords
       AND result.usesPersianRTLAccessibleFeedback
  ELSE
    RETURN result.isExplicitLoadingEmptyErrorOfflineUnsupportedOrForbiddenState
       AND result.didNotMutatePersistedData
       AND NOT result.claimsUnconfirmedSuccess
       AND NOT result.disclosesProtectedData
  END IF
END FUNCTION
```

### Examples

- A `SUPER_ADMIN` opens `/superadmin/parks`. Current behavior renders `P-01` and `P-02` from `mockParks`, and add/edit/delete controls have no handlers. Expected behavior loads persisted `IndustrialPark` records and performs validated, audited CRUD; a protected park deletion returns a Persian conflict state and changes nothing.
- A super administrator opens `/superadmin/users`. Current behavior renders hard-coded users, uses the non-canonical label `FACTORY_MANAGER`, has no create action, and only displays inactive controls. Expected behavior uses canonical Prisma roles, supports create/edit/activate/deactivate/eligible delete, and rejects deleting the acting account or final active super administrator.
- A `PARK_MANAGER` or `SUPER_ADMIN` opens advertisement moderation. Current behavior renders mock cards; view, approve, and reject do not mutate data. Expected behavior returns scoped pending/history records and atomically transitions only `PENDING` records, requiring a non-blank Persian reason for rejection and recording moderator/time/audit data.
- Two authorized clients approve and reject the same pending advertisement concurrently. Current `update` behavior can overwrite a terminal state. Expected behavior commits one valid transition and returns conflict for the other without a second audit effect.
- An administrator opens the dashboard. Current behavior shows only a role heading, even though `/api/v1/analytics/dashboard` exists. Expected behavior displays API-derived scoped summaries, pending work, recent priority items, and only permitted quick actions, with no fabricated value.
- A park manager presses an alert-based approve control while offline. Current behavior can display success despite no server call. Expected behavior disables the mutation, announces the Persian offline reason, preserves safe form context, and refreshes stale data after reconnection before enabling the decision.
- At 320 CSS pixels, the current persistent 280-pixel drawer and negative main margin make the task area unusable. Expected behavior uses temporary/compact navigation, no horizontal page overflow, reachable primary actions, 44-by-44 CSS-pixel targets, and preserves the active route and dialog/form context.
- On an install-capable desktop browser, the current application has a manifest but no install-event lifecycle. Expected behavior shows a non-blocking Persian affordance only after `beforeinstallprompt`, invokes it only on user selection, records dismissal for the current appropriate period, and suppresses it in standalone mode.
- The current frontend unit test and backend guard test pass, but frontend type checking reports 19 errors and backend type checking stops on malformed inactive legacy DTO syntax. Expected behavior is a deterministic green unit/type/build/browser validation set that exercises the repaired admin behavior rather than passing through `--passWithNoTests` with almost no coverage.

## Expected Behavior

### Preservation Requirements

**Unchanged Behaviors:**
- Existing login, token refresh, OTP, account approval/active checks, required-password-change, profile retrieval, logout, and protected-route behavior remain the authentication foundation; the fix does not introduce a second auth stack.
- Backend role and relationship checks remain authoritative. The `admin.` host and frontend operation registry provide presentation context only and never grant access.
- Existing `/api/v1` operations and response semantics outside completed admin operations remain compatible. New filters or fields use backward-compatible defaults; new admin-only routes do not change public approved-advertisement reads.
- Existing users, parks, factories, advertisements, IDs, relations, statuses, audit logs, and other business data survive migrations and startup. No production reseed, destructive backfill, identifier replacement, or silent terminal-state rewrite is allowed.
- Existing Docker frontend/backend/PostgreSQL/Redis/MinIO/proxy boundaries and runtime secret configuration remain intact.
- Factory-owner, security-guard, government-official, employee, and other role workflows retain their domain results, scope, and privacy boundaries except for shared Persian RTL, visual, responsive, accessibility, and feedback improvements.
- There remains one service-worker registration. API, authenticated/private, mutation, and cross-origin requests bypass caching; the cache stores only same-origin static shell/navigation assets.
- Browser use remains fully functional when installation is unsupported, unavailable, dismissed, or already complete. No automatic prompt or blocking install modal is introduced.
- Failed, cancelled, unauthorized, invalid, offline, stale, or conflicting mutations preserve the last confirmed database state and unrelated records.
- Successful mutations remain discoverable through a fresh API read, refresh, and separate authorized session, using stable record identities and valid relationships.
- Persian presentation formatting never rewrites stored identifiers, enum payloads, user content, or search/sort semantics.
- Viewport, zoom, input method, theme, and reduced-motion changes preserve route, session, selected record, safe draft state, and confirmed query data.

**Scope:**
All inputs for which `isBugCondition(input)` is false must remain observationally equivalent between `F` and `F'` for API-visible domain results, authorization, persistence, security, deployment, and existing data. Explicitly allowed differences are the required shared UI, Persian RTL, responsive, accessibility, and feedback improvements. In particular, this fix must not:
- revive the inactive incompatible advertisement module as a parallel API;
- cache authenticated API results or queue offline mutations;
- store SMS secrets in the browser or database merely to make the existing mock form appear functional;
- broaden any role's backend access because a route or menu item is visible;
- delete related records by cascade where current business relations require conflict protection;
- replace production configuration with local-development assumptions.

## Hypothesized Root Cause

Based on repository inspection, the likely causes are:

1. **Frontend scaffolding was routed before integration was completed**
   - `DashboardPage.jsx` contains role headings and commented widget placeholders.
   - All routed files under `pages/admin` and the three core `pages/superadmin` management pages use mock arrays, alerts, prompts, commented navigation, or controls without handlers.
   - Navigation therefore over-promises capabilities that the active API does not yet expose.

2. **The active API is useful but incomplete and weakly typed**
   - `AppModule` imports only `CoreModule`; `ManagementController` is the production-shaped management surface.
   - Service methods accept `any`, whitelist fields inconsistently, and expose no industrial-park endpoints, no user delete endpoint, no administrator advertisement list/detail contract, and incomplete delete/transition contracts for visible operations.
   - The current user list omits relationship context; dashboard output has counts only; several visible frontend API wrappers point to routes that do not exist.

3. **Authorization exists at route level but is incomplete at operation/resource level**
   - `RolesGuard` enforces declared roles, and factory helpers enforce some scope, but not every query/mutation applies an explicit scope predicate.
   - Advertisement moderation directly updates by ID with no status precondition, rejection-reason rule, park scope, or not-found/conflict distinction.
   - Token role/account state can become stale after role or activation changes unless protected requests reconcile with canonical active database state.

4. **Persistence and business invariants are not encoded as atomic operations**
   - User creation relies largely on database exceptions and lacks final-super-admin/acting-account deletion protections.
   - Park manager assignment validation and park deletion constraints are not exposed.
   - Moderation actor/time fields are absent from `Advertisement`, while `AuditLog` alone does not provide the record-level moderation result needed by list/history responses.
   - Update-by-ID patterns permit stale or repeated state transitions instead of conditional updates inside transactions.

5. **A stale parallel backend tree causes contract and build ambiguity**
   - `src/advertisement` targets `UserRole`, numeric IDs, placements, impression entities, and fields absent from the active Prisma schema.
   - It is not imported by `AppModule`, but TypeScript still parses it; current backend type checking fails first on malformed DTO decorators in this legacy tree.
   - The fix must consolidate on `CoreModule` and explicitly retire, exclude, or reconcile unreachable legacy sources rather than accidentally exposing a second contract.

6. **Cross-cutting UI behavior is implemented ad hoc**
   - Pages do not share query/error/empty/loading/confirmation primitives, Persian enum maps, bidirectional formatting, or mutation state handling.
   - `DashboardLayout` always starts a persistent 280-pixel drawer, uses desktop margin arithmetic at all widths, has unlabeled icon controls, and does not identify active routes.
   - Theme values are generic and global CSS relies on overrides rather than a complete token/component system.

7. **PWA state is only partially implemented**
   - The manifest and one production service-worker registration exist, and `sw.js` correctly bypasses API/non-GET/cross-origin traffic.
   - There is no `beforeinstallprompt`, `appinstalled`, standalone-state, connectivity, stale-query, or offline mutation policy integrated into the React shell.

8. **Automated checks do not cover the production surface and currently fail type gates**
   - Frontend has one lazy-export test; backend has only auth-guard unit tests; property and integration coverage for CRUD/scope/concurrency/PWA/accessibility is absent.
   - Frontend type checking currently reports 19 errors, including dead `react-admin` imports, missing MUI imports, untyped styled props/contexts, and Vite import-meta typing.
   - Backend type checking currently fails on malformed legacy DTO syntax before exposing further stale-module incompatibilities.

## Correctness Properties

Property 1: Bug Condition - Truthful Production-Ready Administration

_For any_ generated administrator interaction or environment where `isBugCondition` returns true, the fixed system SHALL satisfy `expectedBehavior`: authorized, in-scope, valid, confirmed, online, supported actions produce exactly one intended server-confirmed durable result, while every invalid, unauthorized, out-of-scope, cancelled, offline, unsupported, stale, conflicting, or failed action produces an explicit Persian accessible non-mutating state with no fabricated data or success.

**Validates: Requirements 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 2.7, 2.8, 2.9, 2.10, 2.11, 2.12, 2.13, 2.14, 2.15, 2.16**

Property 2: Preservation - Security, Data, Deployment, and Other Roles

_For any_ generated input where `isBugCondition` returns false, the fixed system SHALL be observationally equivalent to the original system for authentication, canonical role/scope decisions, existing `/api/v1` domain results, persisted identities and relationships, Docker/runtime boundaries, other-role workflows, and service-worker privacy behavior, allowing only the required shared Persian RTL, visual, responsive, accessibility, and truthful-feedback improvements.

**Validates: Requirements 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.7, 3.8, 3.9, 3.10, 3.11, 3.12, 3.13, 3.14, 3.15, 3.16**

Property 3: Dashboard Scope and Source Integrity

_For any_ canonical role, tenant scope, and database state, every dashboard metric, pending-work count, recent item, and quick action SHALL be derivable from records visible to that actor, and changing the actor to a narrower scope SHALL never retain an out-of-scope value or action.

**Validates: Requirements 2.1, 2.9, 3.2, 3.15**

Property 4: CRUD Round-Trip and Invariants

_For any_ generated valid or invalid park/user/admin-operation CRUD sequence, a successful create SHALL be readable with a stable identity, a successful update SHALL change only submitted mutable fields, an eligible delete SHALL affect only the target, and every failed operation SHALL leave all records unchanged while uniqueness, final-super-admin, acting-account, and referential constraints remain true.

**Validates: Requirements 2.2, 2.3, 2.5, 2.8, 3.4, 3.9, 3.10, 3.14**

Property 5: Advertisement Moderation State Machine

_For any_ advertisement, authorized actor, decision, reason, and sequential or concurrent request schedule, only `PENDING` may transition once to `APPROVED` or `REJECTED`; rejection SHALL contain a non-blank reason, the committed result SHALL record moderator/time and one audit effect, and stale, duplicate, unauthorized, or out-of-scope decisions SHALL not change the record.

**Validates: Requirements 2.4, 2.8, 2.9, 3.9, 3.13, 3.14, 3.15**

Property 6: Authorization Non-Interference

_For any_ protected read or mutation, replacing an authorized actor with an unauthorized role, inactive account, or out-of-scope actor SHALL only change the result to a non-disclosing authentication/authorization denial and SHALL never change persisted state or expose protected fields.

**Validates: Requirements 2.9, 3.1, 3.2, 3.6, 3.15**

Property 7: Failure Atomicity and Truthful Feedback

_For any_ mutation and injected validation, cancellation, offline, timeout, conflict, not-found, authorization, or server failure, the UI SHALL not announce success, duplicate submission SHALL be prevented, confirmed data and safe input SHALL remain available, and the database SHALL equal its pre-operation state.

**Validates: Requirements 2.6, 2.7, 2.8, 2.14, 3.9, 3.13**

Property 8: Persian RTL, Responsive, and Accessible Presentation

_For any_ supported admin record set, locale-sensitive value, viewport from 320 CSS pixels upward, zoom/input/theme/reduced-motion state, and keyboard interaction sequence, the UI SHALL expose Persian labels without raw enums, isolate LTR tokens without changing stored values, avoid page-level horizontal overflow, maintain logical focus/reading order and 44-pixel targets, and preserve route, selection, and safe draft context.

**Validates: Requirements 2.10, 2.11, 2.12, 2.15, 3.11, 3.12**

Property 9: PWA Install and Offline Safety

_For any_ combination of install-event availability, standalone state, prior dismissal, browser support, connectivity, request method, origin, path, and authentication, installation SHALL occur only from an available browser event after user gesture, redundant prompts SHALL be suppressed, only static same-origin GET shell assets SHALL be cache candidates, and offline/stale administrative mutations SHALL remain blocked until a successful refresh.

**Validates: Requirements 2.13, 2.14, 3.7, 3.8**

Property 10: Visible Operation Truthfulness

_For any_ role-aware route and production-visible control, activation SHALL either execute a permitted real API-backed operation with server-confirmed feedback or encounter an explicit unavailable/disabled Persian explanation; no reachable control SHALL depend only on a mock array, placeholder, `console`, browser `alert`/`prompt`, or empty handler.

**Validates: Requirements 2.5, 2.6, 2.7, 2.9**

## Fix Implementation

### Architecture and Data Flow

Use one active path for each operation:

```
Admin Page
  -> shared role-aware operation registry and presentational components
  -> React Query resource/mutation hook
  -> existing Axios apiClient (Bearer token + established refresh behavior)
  -> active CoreModule /api/v1 controller
  -> validated DTO + canonical actor/account/role/scope guard
  -> ManagementService transaction / conditional update
  -> Prisma/PostgreSQL + AuditService
  -> server response
  -> query invalidation and authoritative re-read
  -> localized loading/empty/error/success presentation
```

No mutation uses an optimistic success state. React Query may keep prior confirmed query data visible while refetching, but destructive/status-changing actions wait for the server and invalidate all affected dashboard/list/detail keys. Query keys include resource, normalized filters, actor role, and scope identity so data is not reused across users or tenant changes. Sign-out clears authenticated query state.

### Backend Contracts and Persistence

**Files**: `mekss-backend/src/core/management.controller.ts`, `management.service.ts`, new DTO files under `src/core/dto`, `auth.guard.ts`, `audit.service.ts`, and `prisma/schema.prisma`.

1. **Typed validation boundary**
   - Replace `any` admin request bodies with `class-validator` DTOs using whitelisted fields, canonical enums, normalized optional strings, valid dates/numbers, password policy, and identifier shape.
   - Keep existing successful response fields compatible; add fields rather than renaming/removing existing fields. Normalize errors into stable status classes (`400`, `401`, `403`, `404`, `409`, `5xx`) without exposing private details.
   - Translate errors in the frontend; backend messages remain machine-classifiable and logs retain correlation context.

2. **Industrial-park API**
   - Add super-admin-only list/detail/create/update/delete endpoints under `/api/v1/industrial-parks`.
   - Create/update validate unique trimmed `code`, required name/province/city/address/phone/guard phone, optional email/date/description, valid `PARK_MANAGER` assignments, and mutable status.
   - Manager relationship updates and audit records occur transactionally. Delete first checks factories, security assignments, announcements/files, and other protected relations; return `409` rather than cascading business data. Re-read and return the committed representation.

3. **User API and safety**
   - Extend super-admin list/detail/create/update/delete contracts to include safe fields and scoped park/factory relationship summaries; never return password/token material.
   - Validate unique phone/email/national ID/username where supplied, canonical roles only, and password policy. Assignment fields must match role and existing resources.
   - Activation, deactivation, role change, password reset, relationship changes, and eligible deletion are explicit audited operations. Use a transaction to deny self-deletion/self-deactivation, deny removal/demotion/deactivation of the final active approved super administrator, revoke affected refresh tokens where access changes, and reject hard deletion when protected relations exist. Offer deactivation rather than silent relational deletion.

4. **Advertisement moderation model and API**
   - Keep the active `Advertisement` model and add nullable `parkId`, `moderatedById`, and `moderatedAt` relations/fields. Name creator and moderator relations explicitly at the Prisma level. Existing rows retain IDs/status/content; backfill `parkId` only when the creator's park is unambiguous, leaving ambiguous rows global/super-admin-visible rather than guessing.
   - On creation, derive or validate park scope from the creator's managed factory/park and store it. Public `GET /api/v1/advertisements` continues to default to approved records for compatibility.
   - Add admin list/detail endpoints (for example `/api/v1/admin/advertisements`) with pagination, `PENDING`/history status filters, and canonical scope. Return only media/contact fields authorized for moderation.
   - Approve/reject uses a transaction or conditional `updateMany` with `WHERE id = ? AND status = PENDING` plus the actor's scope. Rejection requires a trimmed non-blank Persian-capable reason; approval clears no historical state incorrectly. The same commit records status, `isApproved`, reason, moderator, time, and exactly one audit record. Zero matched rows are resolved to `404`, `403`, or `409` without disclosure to unauthorized actors.

5. **Dashboard and other visible admin operations**
   - Extend `/api/v1/analytics/dashboard` with scoped pending counts, recent priority records, and capability identifiers while retaining existing count fields.
   - Use existing active endpoints for factories, invoices, gate passes, requests, announcements, advertisements, emergencies, and dashboard data; add only missing detail/update/delete/transition routes required by a visible control.
   - Factories: wire scoped list/create/edit and explicit pending approval/rejection transitions. Invoices: wire list/create and remove unsupported edit/delete affordances unless a validated unpaid-only cancel/update contract is implemented. Gate passes and requests: wire scoped list/detail and valid state transitions with reason/confirmation rules. Announcements: wire list/create and add scoped update/delete if those controls remain visible.
   - Messaging: either add a validated scoped batch-message endpoint that resolves actual user recipients and creates durable `Message` rows transactionally, or remove the send route/control with an explicit unavailable explanation; no success alert is permitted. The chosen implementation must not infer recipients from display names.
   - Reports: replace placeholder charts with scoped server-derived summaries from active analytics/report contracts. If downloadable report generation is not implemented, hide the download/generate action rather than fabricate it.
   - Notifications: wire the top-bar action to scoped notification list/read endpoints or remove the action and badge. Settings expose only working preferences.
   - SMS configuration: replace the browser-held fake API key form with a read-only, super-admin-only configuration health view returning non-secret provider readiness/masked sender data, or hide the route. Runtime secrets remain environment-managed and are never returned to the client.

6. **Canonical actor enforcement**
   - Preserve bearer-token authentication but reconcile protected admin requests with the current database user so inactive, unapproved, deleted, or role-changed actors cannot continue with stale claims. Authorization decisions use the canonical current role and resource scope.
   - Keep `RolesGuard` and resource-level service predicates. Every scoped query applies its predicate in the database query itself; do not fetch broad records and filter in the browser.
   - Return non-disclosing forbidden/session-expired behavior and test that host names never influence backend privilege.

7. **Migration safety**
   - Use additive nullable columns/relations and indexes for moderation scope/history. Do not reset or reseed production data.
   - Validate migration against a copy/snapshot containing existing users, parks, factories, advertisements, relations, and terminal statuses. Ambiguous legacy advertisements remain unchanged and safely restricted.

### Frontend Resource and Interaction Layer

**Files**: `mekss-industrial-park/src/services/api`, new shared hooks/components/utilities, `App.jsx`, `DashboardPage.jsx`, every routed file under `pages/admin` and relevant `pages/superadmin`.

1. Add API modules for parks, users, admin advertisements, dashboard, notifications, and missing active management transitions. Reuse `base.api.js`; do not create a second token store or Axios refresh mechanism.
2. Create shared query-state components for context-preserving skeleton/progress, empty state, classified error/retry, stale/offline banner, and `aria-live` mutation result. A single error mapper distinguishes validation, expired session, forbidden, not found, conflict, timeout/offline, and server failure in concise Persian.
3. Create accessible form/dialog primitives using associated labels, field-level Persian errors, initial focus, focus trap/return, Escape handling where safe, and target/consequence confirmation. Reject destructive confirmation through generic browser `confirm`, `prompt`, or `alert`.
4. Use mutation keys/disabled state to prevent duplicate submissions. Keep confirmed list data visible during mutation where safe, preserve valid input after failure, and invalidate/refetch the exact list/detail/dashboard resources after success.
5. Replace park/user/ad mock arrays and every admin mock/no-op handler. Add discoverable primary actions, detail views, pagination/search/filter state in the URL where practical, stable IDs as keys, and responsive row/card actions with accessible names.
6. Define canonical Persian maps for role/status/category/request/priority enums. Use `Intl.DateTimeFormat('fa-IR')` and `Intl.NumberFormat('fa-IR')` for presentation. Wrap IDs, phone numbers, URLs, codes, license plates, and mixed-direction values in semantic LTR/bidi-isolated elements without changing payload values.
7. Derive frontend action visibility from the operation registry and current role/scope only as usability guidance. Handle `401/403/404/409` from every operation even if the control was expected to be permitted.

### Premium Persian RTL Visual System

**Files**: `ThemeProvider.jsx`, `index.css`, shared surface/form/table/status components, and page-level layouts.

1. Replace scattered values with semantic tokens for canvas/surface/elevated surface, primary MEKSS blue, restrained accent, text hierarchy, borders, focus, status colors, spacing, radii, shadows, and motion in light/dark modes.
2. Use locally available or reliably packaged Persian typography for the app shell so offline rendering does not depend solely on the current Google Fonts import. Maintain comfortable line height and tabular numeric treatment where appropriate.
3. Standardize page headers, summary cards, filters, data containers, dialogs, form sections, status chips, and feedback. Depth remains restrained and branded; no protected platform assets or exact platform imitation are used.
4. Ensure WCAG 2.2 AA contrast, visible `:focus-visible`, non-color status labels/icons, reduced-motion overrides, 200% zoom/reflow, logical headings/landmarks, and nonessential motion only.

### Responsive Navigation and Data Presentation

**Files**: `DashboardLayout.jsx`, route operation registry, responsive table/list components, `App.jsx`.

1. Desktop keeps a collapsible role-aware rail/drawer and visible active route. Tablet/mobile switches to a temporary drawer plus a compact reachable navigation pattern for primary destinations and a Persian “more” menu for the rest; it never applies the desktop negative margin.
2. Navigation closes after mobile route selection, restores focus to its trigger, labels all icon controls, retains the active React Router location, and keeps account/install/offline actions reachable.
3. Data tables retain semantic tables where space permits and use labelled card/definition-list rows or controlled horizontal table-region scrolling on narrow screens; page-level horizontal overflow is prohibited.
4. Use safe-area insets, dynamic viewport units, narrow-height scrolling, sticky actions only when they do not obscure content, virtual-keyboard-safe dialogs/forms, and minimum 44-by-44 CSS-pixel touch targets.
5. Layout changes do not remount the current routed task or discard safe form state, selected records, or confirmed query data.

### PWA Install and Offline State

**Files**: a new PWA/connectivity provider or hooks, `DashboardLayout.jsx`, `main.jsx`, `public/manifest.json`, `public/sw.js`, and `public/offline.html`.

1. Capture `beforeinstallprompt`, call `preventDefault`, retain only the current event, and expose a Persian install action only while the event is valid and the app is not standalone. Invoke `prompt()` only from the install button's user gesture; handle accepted/dismissed outcomes and clear the event.
2. Detect `display-mode: standalone`, iOS standalone where applicable, and `appinstalled`; suppress redundant affordances. Persist dismissal conservatively (not permanently and not as repeated pressure). Unsupported platforms receive guidance only when a real supported manual path exists.
3. Preserve the single registration in `main.jsx`. Keep service-worker exclusions for `/api/`, non-GET, cross-origin, and private/authenticated traffic; test the policy. Cache version changes affect only shell/static assets.
4. Provide online/offline listeners and an explicit Persian shell banner. Queries can show retained confirmed data as stale, but all admin decisions/mutations are disabled offline. On reconnection, invalidate and successfully refresh affected admin data before enabling stale-sensitive moderation/destructive actions.
5. Retain only explicitly non-sensitive form drafts, if any, in component/session state; never store credentials, tokens, moderation contact payloads, SMS data, or private API responses for offline replay. Do not use background sync for writes.

### Automated Test and Build Repair

**Files**: frontend/backend test configs, existing tests, new unit/property/integration/browser tests, TypeScript config/declarations, and only source files required to restore green gates.

1. Keep current passing auth lazy-export and backend guard tests, then add meaningful admin coverage so `--passWithNoTests` is not the effective quality bar.
2. Repair frontend type errors encountered in the current baseline: missing MUI imports, typed context defaults and severity/mode values, styled transient props, Vite `ImportMetaEnv` declarations, dashboard component typing/imports, and the unreachable `react-admin` layout that imports undeclared packages. Remove or isolate dead code rather than adding an unused UI framework.
3. Consolidate backend compilation on the active schema/API. The unregistered incompatible advertisement/emergency legacy sources must be explicitly retired from the active source set or fully reconciled; merely fixing two malformed decorator strings while leaving non-existent Prisma types is insufficient. Contract tests prove no active route is lost.
4. Add deterministic commands/gates for frontend unit tests, backend unit tests, both type checks, lint checks without write/fix mode, production builds, backend integration tests against an isolated test database, and Playwright browser tests. Tests never reseed or mutate a developer/production database.
5. Add a pinned property-testing library only if needed by implementation; otherwise use deterministic generated matrices. Seeds and minimized counterexamples are printed for reproducibility.

### Implementation Sequence and Rollback Boundaries

1. Capture failing exploratory tests against current mock/no-op UI and unsafe backend transitions.
2. Add DTOs, scope predicates, transactions, endpoint contracts, and additive migration; verify backend properties before UI wiring.
3. Add frontend API modules/shared state primitives and replace park, user, dashboard, and moderation surfaces.
4. Complete or truthfully remove every remaining visible admin operation.
5. Apply visual/localization/accessibility and responsive shell changes without changing route identities.
6. Add install/connectivity integration while preserving service-worker exclusions.
7. Repair and run all automated gates, migration snapshot checks, Docker smoke checks, and other-role preservation suites.

Each backend contract group and each frontend route is independently reversible. The additive migration must have a safe rollback that drops only newly added nullable fields/indexes after confirming no new moderation data must be retained; production rollback must never reset the database.

## Testing Strategy

### Validation Approach

Testing follows two phases. First, exploratory tests run against unfixed code to produce concrete counterexamples and validate/refute each root-cause hypothesis. Second, the same tests become fix checks, augmented by preservation and generated invariant tests. API tests use an isolated migrated PostgreSQL test database and deterministic fixtures; UI tests mock contracts for component behavior and use production-shaped backend/browser flows for integration. No test writes to an existing development or production database.

Current baseline evidence to retain in test reporting:
- Frontend unit command passes one lazy-export test.
- Backend unit command passes three authentication-guard tests.
- Frontend type check fails with 19 errors across dashboard components, an inactive `react-admin` layout, `DashboardLayout`, providers, API import-meta typing, and an admin page import.
- Backend type check fails on 31 parse errors in two legacy DTO files before broader inactive-schema incompatibilities can be evaluated.

### Exploratory Bug Condition Checking

**Goal**: Surface counterexamples that demonstrate `C(X)` before implementation and confirm which defects originate in frontend scaffolding, missing API contracts, missing scope/invariants, stale parallel code, or cross-cutting shell behavior. If a hypothesis is refuted, revise the design before implementing that area.

**Test Plan**:
- Render every admin/superadmin route with representative roles and assert visible records come from API fixtures, then run against unfixed code to expose hard-coded records and uncalled clients.
- Call active management endpoints with valid, invalid, unauthorized, out-of-scope, stale, and concurrent inputs; snapshot database/audit state before and after.
- Exercise viewport, keyboard, screen-reader semantics, install events, connectivity changes, and service-worker fetch policy in browser tests.
- Run unit, type, lint, integration, and production build commands against the unfixed repository and record exact failures.

**Test Cases**:
1. **Mock Park/User/Ad Detection**: API returns unique fixture IDs, but pages render `P-01`, `U-001`, and numeric mock ads and issue no query (fails on unfixed code).
2. **Dashboard Source Test**: analytics returns scoped counts/recent work, but only a role heading renders (fails on unfixed code).
3. **Moderation Transition Test**: two clients decide the same ad; current unconditional update permits an invalid overwrite or lacks the required scope/history response (fails or exposes missing contract).
4. **Authorization Matrix Test**: out-of-scope manager reads/decides a resource and state/disclosure is compared with super admin (expected to expose missing ad scope on unfixed code).
5. **Mutation Failure Test**: alert/no-op controls claim success without a server commit (fails on unfixed code).
6. **Responsive Shell Test**: 320-pixel viewport with persistent drawer produces reduced/overflowing task area (fails on unfixed code).
7. **Install Lifecycle Test**: dispatch `beforeinstallprompt`; no user-visible compliant action exists (fails on unfixed code).
8. **Offline Mutation Test**: set browser offline while a decision control remains actionable and no stale refresh gate exists (fails on unfixed code).
9. **Build Gate Test**: run current type checks and capture the known frontend/backend failures.
10. **Edge Cases**: empty lists, ambiguous legacy advertisement scope, final active super admin, acting account, related park deletion, malformed mixed-direction values, high zoom, narrow height, dismissed install prompt, and reconnection during an open confirmation.

**Expected Counterexamples**:
- Rendered data remains unchanged when API fixtures change because pages consume mock arrays.
- Visible buttons do not invoke API methods or announce durable results.
- Missing endpoints return not found for park CRUD/user delete/admin moderation query.
- Advertisement state can be updated without a pending-state/scope/reason precondition.
- Placeholder dashboard and reports contain no server-derived work.
- Persistent drawer geometry fails narrow viewport/reflow expectations.
- No install event or connectivity state reaches React.
- Type gates fail even though minimal unit suites pass.

### Fix Checking

**Goal**: Verify all generated inputs satisfying the bug condition produce the expected behavior.

**Pseudocode:**
```
FOR ALL input WHERE isBugCondition(input) DO
  result := fixedSystem(input)
  ASSERT expectedBehavior(input, result)
END FOR
```

Fix checking runs each numbered correctness property with deterministic seeds and includes fresh-client reads after successful mutations. For UI-only properties, assertions cover API invocation, state presentation, focus/announcements, route preservation, responsive geometry, and absence of mock/no-op production behavior.

### Preservation Checking

**Goal**: Verify every generated non-bug input preserves existing domain, security, persistence, deployment, and privacy behavior.

**Pseudocode:**
```
FOR ALL input WHERE NOT isBugCondition(input) DO
  original := observeOriginalSystem(input)
  fixed := observeFixedSystem(input)
  ASSERT equivalentDomainSecurityPersistenceDeploymentResult(original, fixed)
END FOR
```

**Testing Approach**: Capture working authentication, role, API, database, Docker, and service-worker behavior before changes. Property-based tests then vary actors, scopes, records, methods, origins, payloads, failures, viewports, and environment state. Equivalence excludes only explicitly required presentation improvements.

**Test Cases**:
1. **Authentication Preservation**: login, refresh, OTP/approval/active checks, required password change, profile, and logout maintain their established outcomes.
2. **Other-Role Preservation**: factory owner, guard, official, and employee retain authorized workflows and privacy boundaries.
3. **Database Snapshot Preservation**: migration retains IDs, rows, relations, terminal statuses, and audit history without production seed effects.
4. **API Contract Preservation**: existing `/api/v1` success/error fields remain compatible for unchanged clients.
5. **Service-Worker Preservation**: generated API/authenticated/non-GET/cross-origin requests are never cache-handled; same-origin shell behavior remains.
6. **Docker Preservation**: existing compose services, proxy paths, runtime configuration, and secret boundaries build and start unchanged.
7. **Failure Preservation**: cancelled/failed/conflicting mutations leave the last confirmed state and unrelated records intact.

### Unit Tests

- DTO validation for parks, users, moderation reasons, canonical enums, IDs, dates, phone/email/password rules, and field whitelisting.
- Service tests for final-super-admin/acting-account rules, relationship constraints, scoped queries, conditional moderation, duplicate/conflict behavior, audit writes, and rollback on failure.
- Guard tests for missing/expired tokens, inactive/unapproved/deleted users, stale role claims, canonical role matching, and non-disclosing forbidden results.
- Frontend API/error mapper tests for `400/401/403/404/409`, timeout/offline, and server errors.
- Query/mutation hook tests for keys, duplicate prevention, retained confirmed data, invalidation, sign-out clearing, and stale-after-reconnect gating.
- Component tests for loading/empty/error/success states, accessible confirmation, field errors, focus return, live announcements, Persian enum/date/number rendering, and LTR isolation.
- Install/connectivity hook tests for unavailable/available/accepted/dismissed/installed states and user-gesture-only prompting.
- Service-worker policy tests across request method, origin, API path, navigation, and static destination.

### Property-Based Tests

- Generate CRUD payloads and sequences to verify round-trip identity, mutable-field isolation, uniqueness, relationship integrity, targeted deletion, and no state change on failure.
- Generate actor role/scope/resource matrices to verify authorization non-interference and no protected-field disclosure.
- Generate moderation states, decisions, reasons, and concurrent schedules to verify one-way single terminal transitions and exactly one audit effect.
- Generate API outcomes and retry schedules to verify failure atomicity, no false success, and duplicate prevention.
- Generate enum/date/number/identifier/content combinations to verify Persian presentation and storage/payload integrity.
- Generate viewport, zoom, direction-sensitive content, theme, reduced-motion, and task-state combinations to verify reflow, touch targets, focus, and context preservation.
- Generate install/connectivity/request-policy combinations to verify prompt suppression, shell-only caching, offline mutation blocking, and refresh-before-decision.

### Integration Tests

- Full super-admin park CRUD and user lifecycle against isolated PostgreSQL, including refresh/new session, protected deletes, final-super-admin, self-action, and audit assertions.
- Full scoped advertisement flow from creation through pending moderation, details/media/contact visibility, approval/rejection history, duplicate/concurrent decisions, and cross-role denial.
- Super-admin and park-manager dashboards with real scoped records, pending work, recent priority information, loading/empty/error states, and permitted quick actions.
- Every routed admin operation inventory: factories, invoices, gate passes, requests, announcements, moderation, messaging, reports, notifications, and SMS readiness each proves a real contract or an explicit unavailable state.
- Session role/activation change followed by another protected request verifies canonical backend enforcement without weakening refresh/logout behavior.
- Migration against a populated fixture snapshot verifies preservation of all existing records and safe handling of ambiguous advertisements.
- Production-shaped frontend/backend build and Docker smoke test verifies `/api/v1`, static shell, proxy, PostgreSQL, Redis, and MinIO boundaries.

### Browser and Accessibility Tests

- Playwright flows at 320px mobile, tablet, desktop, narrow-height, high zoom, and standalone-like viewports verify navigation, no page overflow, responsive records, safe areas, and route/form preservation.
- Keyboard-only create/edit/confirm/reject flows verify logical tab order, visible focus, dialog containment/return, Escape behavior, and named icon actions.
- Automated accessibility scans cover landmarks, headings, names, labels/errors, status semantics, contrast, and live regions; manual screen-reader checks validate Persian RTL reading order and dynamic announcements.
- Install-event simulations verify desktop/mobile-capable affordance, user gesture, acceptance, dismissal, unsupported guidance, and standalone suppression.
- Offline/reconnection flows verify shell availability, no private/API cache entries, blocked mutations, stale indication, safe draft handling, data refresh, and re-enabled actions only after successful reconciliation.
