# Requirements Document

## Introduction

The MEKSS Production Deployment feature makes the existing MEKSS full-stack application reproducibly runnable for local development and Docker Compose deployment on Ubuntu behind Nginx, with a documented later migration to Coolify. The feature covers the React Progressive Web App, NestJS API, PostgreSQL, Redis, S3-compatible object storage, SMS and payment integration boundaries, operational safeguards, and repeatable acceptance evidence.

The required production host names are `makss.ghaaar.ir`, `admin_makss.ghaaar.ir`, and `api_makss.ghaaar.ir`. This feature delivers configurations, validation procedures, and operator runbooks for those names. Remote VPS deployment, public DNS changes, live TLS certificate issuance, and live SMS or payment transactions remain outside this feature until authorized server and provider access is supplied; acceptance evidence must identify those operations as unexecuted when that access is absent.

## Glossary

- **MEKSS_Deployment_System**: The repository configuration, Frontend_Application, Backend_API, containers, and documented operating procedures that run MEKSS.
- **Frontend_Application**: The MEKSS React Progressive_Web_App served to browser users.
- **Backend_API**: The MEKSS NestJS HTTP API that enforces authentication, authorization, Tenant_Scope, and business rules.
- **Database**: The PostgreSQL datastore for persistent MEKSS business, authentication, payment, and audit records.
- **Migration**: A versioned, ordered Database schema change committed to the repository and applied by the Prisma migration tool.
- **Development_Seed**: Idempotent non-production sample data used only in local development and automated tests.
- **Bootstrap_Super_Admin**: The first privileged administrator created only from explicitly supplied production Environment_Configuration values.
- **Environment_Configuration**: Runtime configuration supplied through environment variables or Docker secrets and excluded from source control, container images, and application logs.
- **Production_Placeholder**: An empty value or a value equal, case-insensitively, to `changeme`, `change_me`, `replace-me`, `replace_with`, `example`, or `placeholder`.
- **External_Service_Adapter**: An application integration boundary with mock behavior for local or test environments and provider behavior for configured production environments.
- **SMS_Provider**: The Kavenegar service used to deliver one-time passwords and SMS notifications.
- **Payment_Provider**: The ZarinPal service used to initiate and verify invoice payments.
- **Payment_Authority**: The provider-issued identifier that associates one initiated payment with verification attempts.
- **Access_Token**: A signed credential valid for 15 minutes that authorizes Backend_API requests.
- **Refresh_Token**: A persistent, single-use, revocable credential valid for 30 days that obtains a replacement Access_Token and Refresh_Token.
- **One_Time_Password**: A six-digit credential valid for five minutes and usable once for authentication.
- **Tenant_Scope**: The park and factory ownership boundary that limits records and actions available to an authenticated user.
- **Role**: An explicitly assigned authorization category used by the Backend_API to permit actions.
- **Audit_Record**: An append-only record of a privileged or business-state-changing action, actor, timestamp, target, and result.
- **Object_Storage**: The S3-compatible private file storage service used for approved MEKSS uploads.
- **Time_Limited_URL**: A signed Object_Storage URL that expires after 15 minutes.
- **Job_Queue**: The Redis-backed queue used for retriable asynchronous notifications.
- **Readiness_Check**: A Backend_API endpoint result that reports whether required runtime dependencies are usable.
- **Structured_Log**: A machine-readable log record with a timestamp, severity, Correlation_Identifier, event name, and contextual fields.
- **Correlation_Identifier**: A request identifier propagated through Backend_API handling and Structured_Logs.
- **Container_Stack**: The Docker Compose deployment containing application, data, proxy, migration, and support services.
- **Internal_Network**: A Container_Stack network inaccessible from the host network.
- **Reverse_Proxy**: Nginx configuration that terminates HTTPS, routes requests by host name, and applies HTTP security controls.
- **Production_Host_Name**: One of `makss.ghaaar.ir`, `admin_makss.ghaaar.ir`, or `api_makss.ghaaar.ir`.
- **Progressive_Web_App**: The Frontend_Application configured with a web manifest, service worker, install behavior, and offline application shell.
- **Private_Cache_Data**: Access_Tokens, Refresh_Tokens, authenticated API responses, user-specific records, and files protected by Tenant_Scope.
- **Encrypted_Backup**: An encrypted Database or Object_Storage backup stored outside the deployment VPS.
- **Restore_Drill**: A documented restoration of an Encrypted_Backup into an isolated environment followed by data validation.
- **Acceptance_Suite**: Repeatable automated and manual checks that demonstrate these requirements.

## Requirements

### Requirement 1: Reproducible Local System Baseline

**User Story:** As a developer, I want a verified local execution path, so that I can develop and diagnose MEKSS without undeclared machine state.

#### Acceptance Criteria

1. WHEN a developer follows the documented local setup procedure with the documented Node.js version and container runtime, THE MEKSS_Deployment_System SHALL start the Frontend_Application, Backend_API, Database, Redis service, and Object_Storage service using only documented commands and Environment_Configuration.
2. WHEN a developer invokes the documented local startup command with every required local dependency available, THE Backend_API SHALL return a ready Readiness_Check within 120 seconds of command invocation.
3. WHEN the Backend_API returns a ready Readiness_Check, THE Readiness_Check SHALL report a successful Database, Redis service, and Object_Storage service dependency result.
4. IF the Database, Redis service, or Object_Storage service cannot be reached during a Readiness_Check, THEN THE Backend_API SHALL return HTTP 503 within five seconds and identify each unavailable dependency.
5. IF the local startup command cannot start a required service, THEN THE MEKSS_Deployment_System SHALL exit with a non-zero status and report the failed service name.

### Requirement 2: Canonical Data Model and Migrations

**User Story:** As an operator, I want repeatable schema deployment, so that MEKSS data is created consistently in every environment.

#### Acceptance Criteria

1. WHEN a Database contains no MEKSS schema, THE MEKSS_Deployment_System SHALL apply every committed Migration in repository order and record every applied Migration in the Prisma migration history.
2. WHEN committed Migrations are applied to a Database whose Prisma migration history contains every committed Migration, THE MEKSS_Deployment_System SHALL exit with status zero without modifying the Database schema or migration history.
3. IF a Migration fails, THEN THE MEKSS_Deployment_System SHALL exit with a non-zero status, report the failed Migration identifier, and prevent the Backend_API from accepting application traffic.
4. THE MEKSS_Deployment_System SHALL use one canonical set of persisted Role values, identifiers, relations, and Tenant_Scope fields across the Backend_API and Database schema.
5. IF the Backend_API receives a request for a record outside the authenticated user's Tenant_Scope, THEN THE Backend_API SHALL return HTTP 403 and return no record fields.

### Requirement 3: Development Data and Super Administrator Bootstrap

**User Story:** As a deployment operator, I want safe development data and first-administrator creation, so that environments can be initialized without unapproved privilege.

#### Acceptance Criteria

1. WHEN a Development_Seed runs against an initialized development Database, THE MEKSS_Deployment_System SHALL create every sample record listed in the development seed documentation.
2. WHEN a Development_Seed runs more than once against the same development Database, THE MEKSS_Deployment_System SHALL preserve exactly one logical instance for each documented sample-record unique identifier.
3. WHERE production Environment_Configuration supplies a Bootstrap_Super_Admin identity and password, WHEN the production initialization completes with no existing Bootstrap_Super_Admin, THE MEKSS_Deployment_System SHALL create exactly one Bootstrap_Super_Admin with the supplied identity and a password-change-required state.
4. WHERE a Bootstrap_Super_Admin already exists, WHEN production initialization runs, THE MEKSS_Deployment_System SHALL create no additional Bootstrap_Super_Admin account.
5. WHEN a Bootstrap_Super_Admin successfully authenticates with a password-change-required state, THE Backend_API SHALL permit only the password-change action until the Bootstrap_Super_Admin changes the password.
6. WHEN the MEKSS_Deployment_System creates a Bootstrap_Super_Admin, THE Backend_API SHALL create an Audit_Record containing the actor value `system-bootstrap`, target user identifier, timestamp, and result without recording the supplied password.
7. IF an unauthenticated registration request includes a privileged Role, THEN THE Backend_API SHALL return HTTP 403 and create no account.
8. WHEN the Backend_API accepts an unauthenticated registration request without a privileged Role, THE Backend_API SHALL create the account in a pending state with no assigned privileged Role.

### Requirement 4: Authentication and Authorization

**User Story:** As a MEKSS user, I want secure authentication and role enforcement, so that I can access only authorized capabilities.

#### Acceptance Criteria

1. WHEN a user submits a valid One_Time_Password within five minutes of issuance and before any successful use, THE Backend_API SHALL issue one Access_Token valid for 15 minutes and one Refresh_Token valid for 30 days.
2. IF a user submits an expired, previously used, invalid, or attempt-limited One_Time_Password, THEN THE Backend_API SHALL return HTTP 401 and issue no credential.
3. WHEN a user submits five invalid One_Time_Password values for the same identity within 15 minutes, THE Backend_API SHALL reject further One_Time_Password authentication attempts for that identity for 15 minutes.
4. WHEN a user presents an unexpired, unrevoked Refresh_Token, THE Backend_API SHALL issue one replacement Access_Token and one replacement Refresh_Token, revoke the presented Refresh_Token, and persist the revocation before returning HTTP 200.
5. WHEN the Backend_API restarts, THE Backend_API SHALL continue to reject a Refresh_Token that was revoked before the restart.
6. WHEN a user logs out with a valid Refresh_Token, THE Backend_API SHALL revoke the presented Refresh_Token before returning HTTP 204.
7. IF a user presents an expired or revoked Refresh_Token, THEN THE Backend_API SHALL return HTTP 401 and issue no credential.
8. IF an authenticated user requests an action not assigned to the user's Role, THEN THE Backend_API SHALL return HTTP 403.
9. IF an authenticated user requests a resource outside the user's Tenant_Scope, THEN THE Backend_API SHALL return HTTP 403 and return no resource fields.

### Requirement 5: Privileged User Management

**User Story:** As a Bootstrap_Super_Admin, I want to manage users and assignments, so that MEKSS access remains controlled and traceable.

#### Acceptance Criteria

1. WHEN a Bootstrap_Super_Admin creates, approves, disables, assigns a Role to, or assigns Tenant_Scope to a user using valid input, THE Backend_API SHALL persist the requested change before returning HTTP 200 or HTTP 201.
2. WHEN the Backend_API persists a privileged user-management change, THE Backend_API SHALL append one Audit_Record containing the acting user identifier, action name, target user identifier, UTC timestamp, and success result.
3. IF persistence of the Audit_Record fails, THEN THE Backend_API SHALL roll back the associated privileged user-management change and return HTTP 500.
4. IF a user without the required privileged Role requests a privileged user-management action, THEN THE Backend_API SHALL return HTTP 403, persist no user-management change, and append no success Audit_Record.
5. WHEN a Bootstrap_Super_Admin disables a user, THE Backend_API SHALL revoke every unexpired Refresh_Token belonging to the disabled user before returning HTTP 200.

### Requirement 6: Business API Contract Alignment

**User Story:** As a Frontend_Application developer, I want consistent business APIs, so that each MEKSS role can complete supported workflows against one verified contract.

#### Acceptance Criteria

1. THE Backend_API SHALL publish a versioned contract for factories, gate passes, invoices, requests, announcements, advertisements, emergencies, and analytics endpoints.
2. WHEN the Frontend_Application calls a published Backend_API endpoint with valid authorized input, THE Backend_API SHALL return the endpoint's published success status and response representation.
3. IF a published Backend_API endpoint receives invalid input, THEN THE Backend_API SHALL return HTTP 400 with the published validation-error representation and at least one field-specific error.
4. WHEN a user requests a collection permitted by the user's Role and Tenant_Scope, THE Backend_API SHALL return only records within the user's Tenant_Scope and include the published page number, page size, and total-record count.
5. WHEN the Frontend_Application calls an authentication or business endpoint, THE Frontend_Application SHALL use the endpoint path, HTTP method, request format, and response fields published by the Backend_API contract.

### Requirement 7: Idempotent ZarinPal Payments

**User Story:** As an invoice payer, I want payments to survive retries and restarts, so that an invoice is not charged or credited incorrectly.

#### Acceptance Criteria

1. WHERE Payment_Provider mock mode is configured, WHEN an authorized user initiates an eligible invoice payment, THE Backend_API SHALL return the configured External_Service_Adapter mock response without contacting ZarinPal.
2. WHERE Payment_Provider provider mode is configured with valid Environment_Configuration, WHEN an authorized user initiates an eligible unpaid invoice payment, THE Backend_API SHALL request one Payment_Authority from ZarinPal and persist a pending payment record containing the invoice identifier and Payment_Authority before returning the provider redirect response.
3. WHEN the Payment_Provider callback provides a persisted pending Payment_Authority, THE Backend_API SHALL verify that Payment_Authority with the configured Payment_Provider before changing the invoice payment state.
4. WHEN Payment_Provider verification succeeds for a persisted pending Payment_Authority, THE Backend_API SHALL persist exactly one verified payment record and mark the associated invoice paid in one Database transaction.
5. WHEN the Backend_API receives a repeated callback for a previously verified Payment_Authority, THE Backend_API SHALL return the original verified result without creating another payment record or changing the invoice state.
6. IF Payment_Provider verification fails, THEN THE Backend_API SHALL persist a failed payment result, preserve the associated invoice as unpaid, and return the published failure response.
7. IF a callback provides a Payment_Authority with no persisted pending or verified payment record, THEN THE Backend_API SHALL return HTTP 404 and persist no invoice state change.
8. WHEN the Backend_API restarts after persisting a pending Payment_Authority, THE Backend_API SHALL retain the pending payment record and process a later callback according to the same verification rules.

### Requirement 8: Kavenegar and Notification Processing

**User Story:** As a MEKSS user, I want reliable SMS and in-application notifications, so that important authentication and business events reach me predictably.

#### Acceptance Criteria

1. WHERE SMS_Provider mock mode is configured, WHEN the Backend_API sends a One_Time_Password or notification, THE Backend_API SHALL use the configured External_Service_Adapter mock response without contacting Kavenegar.
2. WHERE SMS_Provider provider mode is configured with valid Environment_Configuration, WHEN the Backend_API sends a One_Time_Password or notification, THE Backend_API SHALL submit the message to Kavenegar through the External_Service_Adapter.
3. WHEN an asynchronous notification submission receives a retryable provider error, THE Job_Queue SHALL schedule at most three retry attempts at delays of 60 seconds, 300 seconds, and 900 seconds after the failed attempt.
4. IF an asynchronous notification has received three retryable provider errors, THEN THE Job_Queue SHALL persist a failed notification outcome containing the notification identifier, final provider error code, and UTC timestamp.
5. IF an asynchronous notification receives a non-retryable provider error, THEN THE Job_Queue SHALL persist a failed notification outcome without scheduling a retry.
6. WHEN the Backend_API writes a Structured_Log for an SMS event, THE Structured_Log SHALL replace every destination phone-number digit except the final four digits with `*` characters.
7. WHEN a notification is submitted successfully, THE Job_Queue SHALL persist a successful notification outcome containing the notification identifier and UTC timestamp.

### Requirement 9: Private File Storage

**User Story:** As an authorized MEKSS user, I want secure document upload and access, so that files remain available only to approved tenants.

#### Acceptance Criteria

1. WHEN an authorized user uploads a file whose MIME type is listed in `ALLOWED_UPLOAD_MIME_TYPES` and whose byte count is no greater than `MAX_UPLOAD_SIZE_BYTES`, THE Backend_API SHALL store the file in Object_Storage under a key containing the user's Tenant_Scope identifier.
2. IF an upload MIME type is absent from `ALLOWED_UPLOAD_MIME_TYPES` or an upload byte count exceeds `MAX_UPLOAD_SIZE_BYTES`, THEN THE Backend_API SHALL return HTTP 400 and store no file.
3. WHEN an authorized user requests an approved file within the user's Tenant_Scope, THE Backend_API SHALL issue a Time_Limited_URL with an expiration no later than 15 minutes after issuance.
4. IF a user requests a file outside the user's Tenant_Scope, THEN THE Backend_API SHALL return HTTP 403 and issue no Time_Limited_URL.
5. IF Object_Storage receives a Time_Limited_URL after its expiration, THEN Object_Storage SHALL deny file access.

### Requirement 10: Role-Aware Responsive Frontend

**User Story:** As a MEKSS user, I want a clear, responsive interface for my role, so that I can use verified business functions on mobile and desktop devices.

#### Acceptance Criteria

1. WHEN an authenticated user opens the Frontend_Application, THE Frontend_Application SHALL display only navigation items and dashboards permitted by the user's Role.
2. WHEN the Frontend_Application waits for a supported Backend_API endpoint for more than 300 milliseconds, THE Frontend_Application SHALL display a loading state until the endpoint succeeds or fails.
3. IF a supported Backend_API endpoint returns an error, THEN THE Frontend_Application SHALL display an error state containing a retry control.
4. WHEN a supported Backend_API endpoint returns zero records, THE Frontend_Application SHALL display an empty state distinct from the loading and error states.
5. THE Frontend_Application SHALL render Persian text and numbers with right-to-left layout and Persian number formatting.
6. WHEN the Frontend_Application renders at 360, 768, or 1440 CSS pixels wide, THE Frontend_Application SHALL preserve access to supported navigation and primary business actions without horizontal document overflow.
7. WHEN a user visits `admin_makss.ghaaar.ir`, THE Frontend_Application SHALL select the administrator host context while relying on Backend_API authorization for every privileged action.

### Requirement 11: Android and iOS Progressive Web App

**User Story:** As a mobile MEKSS user, I want an installable and safe Progressive_Web_App, so that I can access the application reliably from Android and iOS devices.

#### Acceptance Criteria

1. THE Frontend_Application SHALL publish one valid web manifest, application icons at 192 by 192 and 512 by 512 CSS pixels, and one registered service worker for the Progressive_Web_App.
2. WHEN Android Chrome opens the Frontend_Application over HTTPS and the Progressive_Web_App is not installed, THE Frontend_Application SHALL display an Android installation control or installation instruction.
3. WHEN iOS Safari opens the Frontend_Application over HTTPS and the Progressive_Web_App is not installed, THE Frontend_Application SHALL display an installation instruction that names the Share menu and Add to Home Screen action.
4. WHEN the Progressive_Web_App starts without a network connection after the application shell has been installed, THE Progressive_Web_App SHALL display the installed offline application shell within five seconds.
5. WHEN a new Progressive_Web_App version has installed and is waiting to activate, THE Frontend_Application SHALL display an update notification before activating the new version.
6. WHEN a user logs out, THE Frontend_Application SHALL remove Private_Cache_Data from browser-accessible application storage and service-worker caches before displaying the signed-out state.
7. THE Progressive_Web_App SHALL exclude requests containing an `Authorization` header, authentication endpoint responses, and user-specific API responses from service-worker runtime caching.

### Requirement 12: Health, Logging, and Auditability

**User Story:** As an operator, I want actionable health and audit information, so that I can detect service failures and investigate sensitive actions.

#### Acceptance Criteria

1. WHEN the Database, Redis service, and Object_Storage service are available, THE Backend_API SHALL return HTTP 200 from the Readiness_Check within five seconds.
2. IF the Database, Redis service, or Object_Storage service is unavailable, THEN THE Backend_API SHALL return HTTP 503 from the Readiness_Check within five seconds and identify every unavailable dependency.
3. WHEN the Backend_API handles a request, THE Backend_API SHALL assign a Correlation_Identifier and include the same Correlation_Identifier in every Structured_Log for that request.
4. THE Backend_API SHALL redact Environment_Configuration secret values, access credentials, payment credentials, One_Time_Password values, and unmasked Refresh_Tokens from Structured_Logs.
5. WHEN an authorized user changes a security-sensitive or business-state-changing record, THE Backend_API SHALL append one Audit_Record containing the actor identifier, action, target identifier, UTC timestamp, and result.

### Requirement 13: Secure Container Stack

**User Story:** As an operator, I want reproducible and hardened containers, so that MEKSS can run consistently on Ubuntu without exposing internal services.

#### Acceptance Criteria

1. WHEN an operator builds the Container_Stack from a clean repository checkout and valid Environment_Configuration, THE MEKSS_Deployment_System SHALL build the Frontend_Application and Backend_API images without undeclared local dependencies.
2. THE MEKSS_Deployment_System SHALL run the Frontend_Application and Backend_API containers as users whose numeric user identifiers are not zero.
3. WHEN the Container_Stack starts with pending Migrations, THE MEKSS_Deployment_System SHALL apply the pending Migrations successfully within 300 seconds before the Reverse_Proxy forwards application traffic to the Backend_API.
4. IF a Container_Stack Migration fails or exceeds 300 seconds, THEN THE MEKSS_Deployment_System SHALL keep the Backend_API unavailable to the Reverse_Proxy, exit the migration service with a non-zero status, and report the failed Migration identifier or timeout.
5. THE Container_Stack SHALL place the Database, Redis service, and Object_Storage service on an Internal_Network with no host-published data-service ports in production configuration.
6. WHEN the Container_Stack restarts without deleting persistent volumes, THE Container_Stack SHALL retain Database and Object_Storage data.
7. IF required production Environment_Configuration is absent or contains a Production_Placeholder, THEN THE Container_Stack SHALL exit before application traffic is accepted with a non-zero status and identify the configuration key name without displaying its value.

### Requirement 14: Production Host Routing and HTTPS

**User Story:** As an internet user, I want MEKSS host names to route safely, so that public, administrative, and API experiences are isolated and protected.

#### Acceptance Criteria

1. WHEN an HTTPS request with host `makss.ghaaar.ir` reaches the Reverse_Proxy, THE Reverse_Proxy SHALL serve the Frontend_Application and return the Frontend_Application entry document for an otherwise unmatched application deep-link path.
2. WHEN an HTTPS request with host `admin_makss.ghaaar.ir` reaches the Reverse_Proxy, THE Reverse_Proxy SHALL serve the Frontend_Application with the administrator host context.
3. WHEN an HTTPS request with host `api_makss.ghaaar.ir` reaches the Reverse_Proxy, THE Reverse_Proxy SHALL proxy the request to the Backend_API.
4. WHEN an HTTP request with host `makss.ghaaar.ir`, `admin_makss.ghaaar.ir`, or `api_makss.ghaaar.ir` reaches the Reverse_Proxy, THE Reverse_Proxy SHALL return a redirect to the same host and request path using HTTPS.
5. WHEN a cross-origin Backend_API request has an `Origin` exactly equal to `https://makss.ghaaar.ir` or `https://admin_makss.ghaaar.ir`, THE Backend_API SHALL return `Access-Control-Allow-Origin` with that exact Origin value.
6. IF a cross-origin Backend_API request has an Origin other than `https://makss.ghaaar.ir` or `https://admin_makss.ghaaar.ir`, THEN THE Backend_API SHALL omit `Access-Control-Allow-Origin`.
7. THE Reverse_Proxy SHALL configure `Strict-Transport-Security`, `X-Content-Type-Options`, `X-Frame-Options`, and `Referrer-Policy` headers for Production_Host_Name HTTPS responses.
8. THE Reverse_Proxy SHALL configure a public-traffic request-rate limit of 60 requests per minute per client IP address with a burst allowance no greater than 20 requests.

### Requirement 15: Environment-Only External Configuration

**User Story:** As a security owner, I want all operational secrets isolated from source and diagnostics, so that external credentials cannot be disclosed through routine development or deployment.

#### Acceptance Criteria

1. THE MEKSS_Deployment_System SHALL load SMS_Provider credentials, Payment_Provider credentials, signing secrets, Database credentials, and Object_Storage credentials only from Environment_Configuration.
2. WHEN the MEKSS_Deployment_System builds a deployable image, THE MEKSS_Deployment_System SHALL exclude Environment_Configuration secret values from image layers.
3. WHEN the MEKSS_Deployment_System writes a Structured_Log, THE MEKSS_Deployment_System SHALL redact Environment_Configuration secret values and external-provider credentials.
4. THE MEKSS_Deployment_System SHALL provide an environment example that lists every required configuration key with no usable production secret value.
5. IF a required production configuration key is empty or contains a Production_Placeholder, THEN THE MEKSS_Deployment_System SHALL prevent production startup, return a non-zero status, and identify the key name without displaying its value.

### Requirement 16: Encrypted Backup and Restoration

**User Story:** As an operator, I want verified off-host backups, so that MEKSS can recover from data loss or server failure.

#### Acceptance Criteria

1. WHEN 24 hours have elapsed since the completion of the most recent successful backup, THE MEKSS_Deployment_System SHALL create an Encrypted_Backup of the Database and Object_Storage data in off-VPS storage.
2. WHEN the MEKSS_Deployment_System creates an Encrypted_Backup, THE MEKSS_Deployment_System SHALL record the backup identifier, UTC completion timestamp, retention expiration timestamp, storage location identifier, and integrity-check result.
3. WHEN an Encrypted_Backup completes successfully, THE MEKSS_Deployment_System SHALL retain the Encrypted_Backup for at least 30 consecutive days from its UTC completion timestamp.
4. IF an Encrypted_Backup integrity check fails, THEN THE MEKSS_Deployment_System SHALL record the failed integrity-check result and report the failed backup identifier to the operator within 15 minutes.
5. WHEN 90 calendar days have elapsed since the completion of the most recent successful Restore_Drill, THE MEKSS_Deployment_System SHALL perform a Restore_Drill in an isolated environment using the most recent successful Encrypted_Backup.
6. WHEN a Restore_Drill completes, THE MEKSS_Deployment_System SHALL report whether the restored Database is queryable and whether the restored Object_Storage object count matches the backup manifest count.

### Requirement 17: Deployment and Recovery Operations

**User Story:** As an operator, I want documented Ubuntu and Coolify procedures, so that I can deploy, update, recover, and later migrate MEKSS without data loss.

#### Acceptance Criteria

1. THE MEKSS_Deployment_System SHALL provide an Ubuntu operator procedure for Environment_Configuration, Docker, Container_Stack startup, Migrations, Reverse_Proxy configuration, HTTPS certificate renewal validation, backup, rollback, and secret rotation.
2. THE MEKSS_Deployment_System SHALL provide a Coolify migration procedure that identifies required Environment_Configuration, persistent volumes, Production_Host_Names, health checks, Migrations, and rollback steps.
3. WHEN an operator follows the documented redeployment procedure without deleting persistent volumes, THE MEKSS_Deployment_System SHALL preserve Database and Object_Storage data.
4. WHERE authorized server access and DNS authority have not been supplied, THE MEKSS_Deployment_System SHALL label remote VPS deployment, public DNS changes, live TLS certificate issuance, and live provider transactions as unexecuted in acceptance evidence.
5. WHERE authorized server access and DNS authority have not been supplied, THE MEKSS_Deployment_System SHALL provide local and Container_Stack validation evidence without claiming that remote VPS deployment, public DNS changes, live TLS certificate issuance, or live provider transactions occurred.

### Requirement 18: Acceptance Evidence and Continuous Verification

**User Story:** As a release owner, I want repeatable acceptance checks, so that MEKSS changes are verified before deployment.

#### Acceptance Criteria

1. WHEN the Acceptance_Suite runs on a clean repository checkout, THE MEKSS_Deployment_System SHALL execute type checking, linting without automatic fixes, Frontend_Application and Backend_API builds, and Migration validation and record the exit status of each check.
2. WHEN the Acceptance_Suite runs business API checks, THE Acceptance_Suite SHALL cover one successful, invalid-input, unauthenticated, unauthorized, and cross-Tenant_Scope outcome for every published business API domain.
3. WHEN the Acceptance_Suite runs authentication checks, THE Acceptance_Suite SHALL cover a valid One_Time_Password, expired One_Time_Password, Refresh_Token rotation after a Backend_API restart, logout revocation, password change, Role enforcement, and Tenant_Scope enforcement.
4. WHEN the Acceptance_Suite runs Payment_Provider checks in mock mode, THE Acceptance_Suite SHALL cover initiation, verification failure, a repeated callback, and a Backend_API restart between initiation and verification.
5. WHEN the Acceptance_Suite runs SMS_Provider checks in mock mode, THE Acceptance_Suite SHALL cover provider success, timeout, each of the three retry delays, and the exhausted-retry outcome.
6. WHEN the Acceptance_Suite runs Progressive_Web_App checks, THE Acceptance_Suite SHALL verify the manifest, offline application shell, logout Private_Cache_Data removal, runtime-cache exclusion, and documented Android and iOS installation behavior.
7. WHEN the Acceptance_Suite runs Container_Stack checks, THE Acceptance_Suite SHALL verify image build, Readiness_Check success, persistent data after restart, migration-failure traffic blocking, and the absence of Environment_Configuration secret values in repository tracking and container logs.
8. WHEN a required Acceptance_Suite check fails, THE Acceptance_Suite SHALL return a non-zero status and identify the failed check name in its report.
