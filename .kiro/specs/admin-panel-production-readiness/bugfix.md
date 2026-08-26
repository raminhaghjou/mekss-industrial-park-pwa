# Bugfix Requirements Document

## Introduction

This bugfix makes the MEKSS administration experience production-ready without replacing or weakening the working authentication, role authorization, backend API, Docker deployment stack, PWA safety boundaries, or persisted business data. The affected scope includes role-aware dashboards, industrial-park administration, user administration, advertisement moderation, all other visible admin operations, the shared Persian RTL interface, responsive navigation, accessibility, offline behavior, and standards-compliant PWA installation on mobile and desktop.

For correctness checking, `C(X)` is true when an input or environment state `X` exercises an affected admin dashboard, admin action, visual/localization surface, responsive navigation state, offline state, or install-prompt state and the current system returns placeholder, mock, no-op, unpersisted, misleading, inaccessible, or unusable behavior. `P(result)` is true when the fixed system returns the authorized, validated, Persian RTL, accessible, server-confirmed result—or an explicit safe non-mutating loading, empty, error, offline, unsupported, or forbidden result—required below. `F` denotes the current behavior and `F'` denotes the fixed behavior.

## Bug Analysis

### Current Behavior (Defect)

The current administration interface exposes incomplete surfaces that look actionable but do not consistently execute durable business operations.

1.1 WHEN a `SUPER_ADMIN` or `PARK_MANAGER` opens the dashboard THEN the system renders only a role heading or placeholder content instead of useful, role-scoped operational data and actions.

1.2 WHEN a super administrator opens industrial-park management or selects add, edit, or delete THEN the system displays hard-coded park records and the controls do not perform validated, persisted API operations.

1.3 WHEN a super administrator opens user management or attempts to create, edit, activate/deactivate, or delete a user THEN the system displays hard-coded users, omits the create-user action, and leaves the visible controls disconnected from durable backend state.

1.4 WHEN an authorized administrator opens advertisement moderation or selects view, approve, or reject THEN the system displays mock advertisements and the controls do not load complete moderation data or persist a status transition and rejection reason.

1.5 WHEN an administrator invokes any other visible admin-panel operation THEN the system may expose placeholder, mock, no-op, partially wired, or refresh-lost behavior without a reliable server-confirmed outcome.

1.6 WHEN an admin page is waiting for API data or a mutation is in progress THEN the system does not consistently provide operation-specific loading feedback, prevent duplicate submission, or preserve a stable usable layout.

1.7 WHEN an admin query returns no records or an API request fails, times out, conflicts, or becomes unauthorized THEN the system does not consistently show a distinct Persian empty or actionable error state with safe retry behavior.

1.8 WHEN an administrator submits invalid data or selects a destructive or status-changing action THEN the system does not consistently validate required/domain fields, explain field errors, request confirmation, or protect against accidental and duplicate mutations.

1.9 WHEN a user lacks permission or tenant scope for an admin resource or action THEN the frontend does not consistently align control visibility and feedback with server-side authorization, and some screens rely on route-level checks without complete operation-level handling.

1.10 WHEN a user navigates across pages, dialogs, tables, menus, status labels, validation messages, dates, numbers, or mixed-direction identifiers THEN the system contains inconsistent terminology, untranslated enum/technical text, or incomplete Persian RTL presentation.

1.11 WHEN a user views the application in light or dark mode THEN the interface uses a generic and uneven visual treatment rather than one coherent, polished, premium visual system across all pages and interaction states.

1.12 WHEN the application is used at mobile, tablet, desktop, narrow-height, or standalone-PWA dimensions THEN the persistent desktop-oriented drawer, dense tables, actions, and page spacing can reduce usable space, overflow, or provide navigation and touch behavior that is not app-appropriate.

1.13 WHEN the browser reports that the PWA is installable, the user uses a supporting desktop browser, the app is already installed, or installation is unavailable THEN the system has no compliant install-prompt lifecycle or clear platform-appropriate state.

1.14 WHEN connectivity is unavailable or changes during an admin query or mutation THEN the system has no consistent offline indication or mutation guard, so an action can appear available even though it cannot be safely persisted; installable shell behavior is not integrated with admin UX state.

1.15 WHEN a user operates admin pages with a keyboard, assistive technology, reduced-motion preference, high zoom, or touch input THEN unlabeled icon actions, focus behavior, contrast, target sizing, status announcements, and responsive reading order are not consistently accessible.

1.16 WHEN generated inputs vary role, tenant, payload validity, API outcome, record count, viewport, direction-sensitive content, connectivity, install-event availability, and installed state THEN the current system violates at least one required fix property for some inputs satisfying `C(X)`.

### Expected Behavior (Correct)

The fixed system must make every exposed administration capability truthful, durable, permission-aware, and usable across supported PWA contexts.

2.1 WHEN a `SUPER_ADMIN` or `PARK_MANAGER` opens the dashboard THEN the system SHALL load and present useful role-scoped summaries, pending-work indicators, recent or priority information, and permitted quick actions from real API data, with distinct loading, empty, and retryable error states and no fabricated metrics.

2.2 WHEN a super administrator opens industrial-park management or selects add, edit, or delete THEN the system SHALL load persisted parks and execute complete API-backed CRUD behavior; validate unique code, required identity/contact/location fields and valid manager assignments; request an explicit destructive confirmation; enforce referential and business constraints; show a Persian success or actionable failure result; and display the server-confirmed state after refresh and a new session without losing unrelated records.

2.3 WHEN a super administrator opens user management or attempts to create, edit, activate/deactivate, or delete a user THEN the system SHALL load persisted users, expose a discoverable create-user action, validate unique identity/contact fields, password policy and canonical roles, persist authorized changes through the API, require confirmation for destructive or access-changing actions, prevent deletion of the acting account and the final active super administrator, preserve referential integrity, and reconcile the list with the server-confirmed state after refresh and a new session.

2.4 WHEN an authorized administrator opens advertisement moderation or selects view, approve, or reject THEN the system SHALL load real pending and historical advertisements within the administrator's permitted scope, show complete safe details and media/contact data, permit only valid status transitions, require a non-blank Persian rejection reason for rejection and confirmation for approval/rejection, persist the decision and audit-relevant actor/time outcome through the API, prevent duplicate decisions, and move the record to the correct server-confirmed history state.

2.5 WHEN an administrator invokes any other visible admin-panel operation THEN the system SHALL either complete a real authorized API-backed operation with durable server-confirmed feedback or clearly hide/disable the unavailable action with a Persian explanation; no production-visible control SHALL remain backed only by mock arrays, placeholder values, console behavior, or an empty handler.

2.6 WHEN an admin page is waiting for API data or a mutation is in progress THEN the system SHALL show a localized, context-preserving loading or progress state, keep existing confirmed data visible where safe, disable only conflicting controls, prevent duplicate submission, and restore interaction after success or failure without layout shift that blocks the task.

2.7 WHEN an admin query returns no records or an API request fails, times out, conflicts, or becomes unauthorized THEN the system SHALL distinguish empty, validation, authentication, authorization, not-found, conflict, network/offline, and server-error outcomes; present concise Persian guidance and a safe retry or recovery action where applicable; preserve entered data unless unsafe; and never claim that an unconfirmed mutation succeeded.

2.8 WHEN an administrator submits invalid data or selects a destructive or status-changing action THEN the system SHALL validate on both client and server, associate Persian messages with the relevant fields, reject malformed or out-of-scope identifiers and enum values without mutation, require an accessible confirmation that names the target and consequence, use server-confirmed completion, and make repeated submission/retry unable to create unintended duplicate records or transitions.

2.9 WHEN a user lacks permission or tenant scope for an admin resource or action THEN the system SHALL enforce the canonical role and scope on the backend before reading or mutating data, omit or disable unauthorized frontend controls, return and present an appropriate forbidden/session-expired result, reveal no protected record fields, and leave all data unchanged; park and user administration SHALL remain super-administrator-only, while advertisement moderation SHALL follow the existing authorized administrator scope.

2.10 WHEN a user navigates across pages, dialogs, tables, menus, status labels, validation messages, dates, numbers, or mixed-direction identifiers THEN the system SHALL use consistent natural Persian terminology and RTL layout throughout, format user-facing dates and numbers for the Persian locale, isolate inherently LTR values such as IDs, phone numbers, URLs, codes, and license plates for correct reading, and expose no raw backend enum or untranslated operational text.

2.11 WHEN a user views the application in light or dark mode THEN the system SHALL apply one cohesive premium Apple-inspired visual language with restrained depth, clear hierarchy, high-quality Persian typography, consistent spacing/radii/color tokens, refined surfaces and controls, legible data density, purposeful state feedback, and motion that is subtle and nonessential, while retaining MEKSS identity rather than imitating protected platform branding.

2.12 WHEN the application is used at mobile, tablet, desktop, narrow-height, or standalone-PWA dimensions THEN the system SHALL provide responsive, role-aware app navigation; avoid horizontal page overflow from 320 CSS pixels through large desktop widths; convert dense tables and action clusters into usable responsive presentations; maintain safe-area and virtual-keyboard awareness; keep primary actions reachable; provide at least 44-by-44 CSS-pixel touch targets; close or collapse transient navigation appropriately; and preserve the user's current route and task context across layout changes.

2.13 WHEN the browser reports that the PWA is installable, the user uses a supporting desktop browser, the app is already installed, or installation is unavailable THEN the system SHALL capture and use the browser-provided install event only after a user gesture, show a non-blocking Persian install affordance only while installation is genuinely available, support the same compliant flow on install-capable desktop browsers, respect dismissal without repeated interruption, detect installed/standalone state and suppress redundant prompts, handle accepted/dismissed results, and show platform guidance only where installation is possible without fabricating a native prompt.

2.14 WHEN connectivity is unavailable or changes during an admin query or mutation THEN the system SHALL keep the non-sensitive app shell and explicit Persian offline state usable, avoid caching authenticated API responses or private payloads, disable or safely reject mutations that cannot be server-confirmed, retain form input locally only when it does not expose sensitive data, avoid silent background replay or duplicate writes, and refresh stale administrative data after connectivity returns before allowing decisions based on it.

2.15 WHEN a user operates admin pages with a keyboard, assistive technology, reduced-motion preference, high zoom, or touch input THEN the system SHALL meet WCAG 2.2 AA outcomes for contrast and interaction, provide logical heading/landmark and RTL reading order, visible focus, keyboard-complete controls and dialogs, accessible names for every icon action, associated labels and errors, non-color-only status meaning, polite loading/success/error announcements, reduced motion, zoom/reflow support, and sufficiently large touch targets.

2.16 WHEN generated inputs vary role, tenant, payload validity, API outcome, record count, viewport, direction-sensitive content, connectivity, install-event availability, and installed state AND `C(X)` is true THEN the fixed system `F'(X)` SHALL satisfy `P(result)` for every generated input: authorized valid actions produce exactly the intended persisted state, and invalid, unauthorized, offline, unsupported, cancelled, or failed actions produce the specified explicit non-mutating state without mock or no-op success.

### Unchanged Behavior (Regression Prevention)

The bugfix must preserve working security, domain, deployment, and data behavior outside the bug condition.

3.1 WHEN a user signs in, refreshes an authorized session, changes a required password, or signs out through an existing working authentication flow THEN the system SHALL CONTINUE TO use the established authentication/session behavior and protect routes without weakening credential, token, OTP, approval, or active-account checks.

3.2 WHEN an existing role accesses a route or API operation that it is currently authorized to use THEN the system SHALL CONTINUE TO enforce the canonical backend roles and tenant/factory/park scope; host name or frontend visibility SHALL CONTINUE TO provide presentation context only and SHALL NOT grant privilege.

3.3 WHEN existing frontend clients call working `/api/v1` endpoints outside the newly completed admin operations THEN the system SHALL CONTINUE TO receive compatible success and error contracts, and any API additions SHALL remain backward-compatible unless a versioned migration is explicitly required.

3.4 WHEN the fixed application starts against an existing database THEN the system SHALL CONTINUE TO retain all valid users, parks, factories, advertisements, relations, statuses, audit history, and other business records without destructive reseeding, identifier reassignment, silent status rewriting, or data loss.

3.5 WHEN the repository's Docker or production-shaped local stack builds and starts THEN the system SHALL CONTINUE TO use the existing frontend, backend, PostgreSQL, Redis, MinIO, and proxy boundaries and runtime configuration without embedding secrets or replacing working deployment behavior with development-only assumptions.

3.6 WHEN a factory owner, security guard, government official, employee, or other non-admin user performs an existing authorized workflow outside `C(X)` THEN the system SHALL CONTINUE TO receive the same domain result, privacy boundary, and role-appropriate navigation behavior, except for the shared Persian RTL, responsive, visual, and accessibility improvements required above.

3.7 WHEN the service worker handles static assets, navigation fallback, API requests, authenticated requests, mutations, or cross-origin requests THEN the system SHALL CONTINUE TO use a single registration, provide the existing safe offline shell, and bypass caching for APIs, private authenticated data, non-GET requests, and cross-origin content.

3.8 WHEN the application is not installable, the install event has not been emitted, the user dismissed the offer, or the application already runs in installed/standalone mode THEN the system SHALL CONTINUE TO function fully in the browser without blocking content, automatically invoking a prompt, or repeatedly pressuring the user.

3.9 WHEN a valid admin create, update, delete, approval, or rejection request fails validation, authorization, confirmation, connectivity, concurrency, or server processing THEN the system SHALL CONTINUE TO preserve the last confirmed database state and unrelated records, with no optimistic success left visible after reconciliation.

3.10 WHEN an administrator refreshes, revisits, opens another authenticated session, or observes the same resource from another authorized client after a successful mutation THEN the system SHALL CONTINUE TO derive the displayed state from persisted API data rather than browser-only state, while maintaining stable record identity and relationship integrity.

3.11 WHEN Persian localization is applied to business content THEN the system SHALL CONTINUE TO preserve exact identifiers, stored values, user-entered content, API payload semantics, and searchable/sortable meaning; presentation formatting SHALL NOT corrupt persisted data.

3.12 WHEN the viewport, zoom level, input method, color scheme, or reduced-motion preference changes outside a pending destructive confirmation THEN the system SHALL CONTINUE TO preserve the active route, authenticated session, entered non-sensitive form data, selected record, and server-confirmed data rather than restarting the workflow.

3.13 WHEN an advertisement is already approved or rejected, a user or park no longer exists, or two authorized clients act concurrently THEN the system SHALL CONTINUE TO enforce valid server-side state transitions and referential rules, return a conflict/not-found result as appropriate, and avoid duplicate audit effects or unintended mutation of a replacement record.

3.14 WHEN automated checks generate valid and invalid CRUD payloads and action sequences THEN the system SHALL CONTINUE TO satisfy round-trip and invariant properties: successful creates are readable, successful updates change only submitted mutable fields, successful deletes remove only the intended eligible record, failed operations change no records, unique fields remain unique, protected relations remain valid, and repeated moderation cannot produce contradictory terminal states.

3.15 WHEN automated checks generate roles, tenant scopes, resource identifiers, and protected operations THEN the system SHALL CONTINUE TO satisfy the authorization non-interference property: changing an actor from authorized to unauthorized or changing a resource to an out-of-scope tenant can only change the result to a non-disclosing denial and cannot change persisted state.

3.16 WHEN any generated input `X` does not satisfy `C(X)` THEN the fixed behavior SHALL CONTINUE TO be observationally equivalent to the original behavior, expressed as `F(X) = F'(X)` for API-visible domain results, authorization, persistence, security boundaries, deployment behavior, and existing data, allowing only the explicitly required shared visual, Persian RTL, responsive, accessibility, and feedback improvements.
