# Authentication UI and Account Creation Design

**Status:** Approved design
**Date:** 2026-06-24
**Scope:** Login, self-service account creation, email verification, Google sign-in, and password recovery for WP Control Center

## 1. Goal

Replace the current login-only screen with one authentication experience that lets a user:

- sign in with email and password;
- create an ADMIN account with email and password;
- verify a new email address with a six-digit, ten-minute OTP;
- register or sign in with a verified Google account;
- recover and reset a forgotten password.

All self-registered accounts receive the existing `ADMIN` role and therefore have full product access. The existing `VIEWER` role remains available to internal administration flows but is never assigned by self-registration.

## 2. Existing System Constraints

- The web application is Next.js 16.2.6 with React 19, Tailwind CSS 4, and the existing shadcn-based component set.
- The API is NestJS 10 with Prisma/PostgreSQL.
- Browser authentication already uses a JWT in the `wpcc_token` httpOnly cookie. This transport remains unchanged.
- The current login, logout, `me`, forgot-password, and reset-password endpoints remain the foundation of the expanded `AuthModule`.
- Existing users and the seeded administrator must remain able to sign in after the migration.
- The public registration path must not reuse the privileged `UsersService.create` administration endpoint.

## 3. Product Decisions

1. The auth experience is a single visual page at `/`, with internal modes for login, sign-up, email verification, lost password, and password reset.
2. Login and sign-up are top-level tabs. Lost password is entered through the login form. Verification and reset replace the form inside the same card.
3. Email/password registration requires verification before login. OTPs contain exactly six decimal digits, expire after ten minutes, and permit at most five failed attempts.
4. Resending an OTP has a 60-second per-account cooldown and invalidates every earlier unused OTP.
5. Google accounts with `email_verified=true` are considered verified immediately.
6. When Google returns an already-known verified email, its immutable Google account ID is linked to the existing user instead of creating a duplicate user.
7. Every self-registered email or Google account receives role `ADMIN`. The `VIEWER` enum and existing role management remain unchanged.
8. Transactional email uses SMTP through Nodemailer. No provider-specific mail API is introduced.

## 4. User Experience

### 4.1 Visual language

The new page extends the current WP Control Center login design rather than introducing a second design language:

- zinc-950 page background with restrained violet and emerald radial accents;
- zinc-900 translucent card, zinc-800 border, rounded corners, and backdrop blur;
- violet-to-indigo primary action;
- existing typography, spacing, focus rings, Button component, and responsive breakpoints;
- one-column card on mobile and desktop, with a maximum width that keeps OTP and form controls readable.

All user-facing auth copy is written in English to match the existing application UI. Copy must remain concise and action-oriented.

### 4.2 Login mode

The login mode contains:

- `Continue with Google` button;
- an `or` separator;
- email and password fields;
- `Forgot password?` link;
- `Sign in` submit button;
- a link or tab affordance to `Create account`.

Success navigates to `/sites`. Failed credentials use one generic `Invalid email or password` message. A known but unverified account receives the stable `EMAIL_NOT_VERIFIED` error, allowing the UI to open verification mode and offer a resend.

### 4.3 Sign-up mode

The sign-up mode contains:

- `Continue with Google` button;
- an `or` separator;
- full name, email, password, and confirm-password fields;
- `Create account` submit button;
- a link or tab affordance back to `Sign in`.

Email is trimmed and lowercased before submission. Password length is at least eight characters, matching the current API rule. Confirm-password is a client-side field and is never sent to the API.

After successful registration, the card enters verification mode and preserves a masked display of the target email. It does not expose whether arbitrary other addresses have accounts.

### 4.4 Verification mode

Verification mode contains six numeric OTP inputs that also support pasting the complete code. Focus advances after each digit and returns correctly on Backspace.

The user can:

- submit the six-digit code;
- request a new code after a visible 60-second countdown;
- return to sign-in.

Successful verification returns the user to login with a success message and the email prefilled. Invalid, expired, consumed, or attempt-exhausted codes have distinct safe messages. An exhausted or expired code requires a resend.

### 4.5 Lost-password and reset modes

Lost-password mode accepts an email and always displays the same success message: `If an account exists for that email, a password reset link has been sent.`

The SMTP message links to `/?mode=reset-password&token=<raw-token>`. When this URL is opened, the same auth card renders new-password and confirm-password fields. Successful reset returns to login with a success message. Invalid, expired, or consumed links offer a path back to lost-password mode.

A Google-only account does not receive a password-reset email; the endpoint still returns the generic response. It continues to sign in through Google.

### 4.6 Loading, accessibility, and responsive behavior

- Each form disables only its own submit action while a request is pending.
- Labels remain visible; placeholders are not used as labels.
- Errors use `role="alert"`; success messages use an appropriate live region.
- Tabs, links, OTP fields, and buttons are keyboard accessible with visible focus.
- Form inputs use suitable autocomplete attributes (`email`, `name`, `current-password`, and `new-password`).
- No toast is required for form errors; the error remains adjacent to the form that caused it.
- Mobile layouts preserve a minimum 44-pixel interactive target and avoid horizontal overflow.

## 5. Domain Model

### 5.1 User changes

`User` gains:

- `passwordHash String?`: nullable for Google-only users;
- `emailVerifiedAt DateTime?`: null until email verification succeeds;
- `authIdentities AuthIdentity[]`;
- `emailVerificationCodes EmailVerificationCode[]`.

The migration sets `emailVerifiedAt` to the migration timestamp for every existing user. This prevents the new verification gate from locking out the seeded administrator or current installations.

The Prisma schema default for `role` remains `ADMIN`. Public registration also passes `ADMIN` explicitly so its privilege decision is visible in application code and tests.

### 5.2 AuthIdentity

`AuthIdentity` stores an external sign-in identity:

| Field | Type | Rule |
| --- | --- | --- |
| `id` | String | cuid primary key |
| `userId` | String | cascade relation to User |
| `provider` | AuthProvider | initially only `GOOGLE` |
| `providerAccountId` | String | immutable Google `sub` value |
| `createdAt` | DateTime | defaults to now |
| `updatedAt` | DateTime | updated automatically |

Required constraints:

- unique `(provider, providerAccountId)` prevents one Google identity from belonging to multiple users;
- unique `(userId, provider)` prevents multiple Google identities from being attached to one WP Control Center user;
- index `userId` supports account lookups and deletion.

No Google access token or refresh token is stored for authentication. The existing Google Analytics/Search Console integration account remains a separate domain model and flow.

### 5.3 EmailVerificationCode

`EmailVerificationCode` contains:

| Field | Type | Rule |
| --- | --- | --- |
| `id` | String | cuid primary key |
| `userId` | String | cascade relation to User |
| `codeHash` | String | HMAC-SHA-256 of user ID and OTP using the server auth secret |
| `expiresAt` | DateTime | creation time plus ten minutes |
| `consumedAt` | DateTime? | set once verification succeeds or a code is invalidated |
| `attemptCount` | Int | defaults to zero; maximum five |
| `createdAt` | DateTime | defaults to now |

Indexes cover `userId` and `expiresAt`. The service enforces one usable code per user by invalidating prior unconsumed rows inside the transaction that creates a new code.

Raw OTPs are returned only to the mail service in memory and are never logged or persisted.

## 6. API Contracts

All request DTOs use class-validator and the existing global validation pipe. Errors use a stable machine-readable `code` plus a safe `message` so the web UI does not branch on prose.

### 6.1 Email registration

`POST /api/auth/register`

Request:

```json
{
  "fullName": "Jane Doe",
  "email": "jane@example.com",
  "password": "StrongPass123!"
}
```

Success (`201`):

```json
{
  "verificationRequired": true,
  "email": "j***@example.com",
  "resendAvailableInSeconds": 60
}
```

Rules:

- create a new ADMIN user and verification code atomically;
- if a verified user or a Google-linked user already owns the email, return `409 EMAIL_ALREADY_EXISTS`;
- if an unverified local user already owns the email, return `409 EMAIL_VERIFICATION_PENDING` and let the UI open verification/resend mode;
- if SMTP delivery fails after persistence, return `503 EMAIL_DELIVERY_FAILED`; retain the unverified account so the user can resend.

### 6.2 Verify email

`POST /api/auth/verify-email`

Request:

```json
{
  "email": "jane@example.com",
  "code": "482913"
}
```

Success (`200`):

```json
{
  "success": true,
  "email": "jane@example.com"
}
```

The service locks or conditionally updates the active code to make concurrent submissions single-use. It increments `attemptCount` for a wrong code. The stable failure codes are `VERIFICATION_CODE_INVALID`, `VERIFICATION_CODE_EXPIRED`, `VERIFICATION_CODE_USED`, and `VERIFICATION_ATTEMPTS_EXCEEDED`.

### 6.3 Resend verification

`POST /api/auth/resend-verification`

Request:

```json
{
  "email": "jane@example.com"
}
```

The response is generic for unknown or already verified emails. For a pending account, the service enforces the 60-second cooldown, invalidates old codes, creates a replacement, and sends it. A cooldown violation returns `429 VERIFICATION_RESEND_COOLDOWN` with `retryAfterSeconds`.

### 6.4 Email/password login

`POST /api/auth/login` retains its current success body and cookie behavior.

Additional rules:

- inactive, missing, or wrong-password accounts return the generic `401 INVALID_CREDENTIALS`;
- an unverified local account returns `403 EMAIL_NOT_VERIFIED`;
- a Google-only account returns `400 PASSWORD_LOGIN_UNAVAILABLE`;
- verified existing and seeded accounts continue to work;
- legacy password-hash upgrade behavior remains unchanged.

### 6.5 Password recovery

`POST /api/auth/forgot-password` retains its generic response. For an active verified user with a password, it creates the existing hashed, one-hour reset token and sends a link through the mail service. It sends no link for an unknown, inactive, unverified, or Google-only account.

`POST /api/auth/reset-password` retains the current token validation, password hashing, token consumption, and `tokenVersion` increment. It now supplies stable error codes for invalid, expired, and used reset tokens.

### 6.6 Google OAuth

`GET /api/auth/google/start`

- create cryptographically random state and OpenID Connect nonce values;
- put the state and nonce in a signed, secure, httpOnly, SameSite=Lax cookie restricted to the callback path and expiring after ten minutes;
- redirect to Google with scopes `openid email profile`, the nonce, and the dedicated auth callback URI.

`GET /api/auth/google/callback?code=...&state=...`

- verify the signed state cookie and compare state using a timing-safe operation, then clear the cookie;
- exchange the authorization code with Google;
- verify the returned ID token signature, issuer, audience, expiry, and nonce claim using the official Google authentication library;
- require `email`, `email_verified=true`, and immutable `sub`;
- complete linking or user creation in one database transaction;
- issue the existing JWT/httpOnly session cookie;
- redirect to `/sites` on success or `/?mode=login&oauthError=<stable-code>` on a safe recoverable failure.

Linking rules, in order:

1. If `(GOOGLE, sub)` exists, sign in its active user.
2. Otherwise, look up the normalized verified Google email.
3. If the email exists, create the Google identity for that user and set `emailVerifiedAt` if null.
4. If the email does not exist, create an email-verified ADMIN user with a null password and attach the identity.
5. If uniqueness races occur, re-read the winning identity/user instead of creating a duplicate.

Google auth does not reuse the existing analytics integration callback, scopes, state helper, or token storage.

## 7. Internal Components and Boundaries

### API

- `AuthController`: HTTP transport, cookies, redirects, throttling, and mapping service results to response contracts.
- `AuthService`: password login, session creation, registration orchestration, verification, resend, and password recovery.
- `GoogleAuthService`: Google authorization URL, callback validation, verified profile extraction, and identity linking.
- `MailModule` / `MailService`: Nodemailer transport and the two templates `sendVerificationCode` and `sendPasswordResetLink`.
- Auth DTO files: one request type per endpoint, with no persistence logic.
- `config/env.ts`: typed accessors and startup validation for auth, Google, web URL, and SMTP settings.

The mail service accepts domain values and owns subject/text/HTML rendering. Auth services do not format SMTP messages. Google auth does not import the analytics `IntegrationsService`.

### Web

- `app/page.tsx`: thin page entry that renders the auth experience.
- `components/auth/AuthCard.tsx`: mode state, shared card shell, API error routing, and navigation between modes.
- Focused form components: `LoginForm`, `SignUpForm`, `VerifyEmailForm`, `ForgotPasswordForm`, and `ResetPasswordForm`.
- `components/auth/GoogleAuthButton.tsx`: starts the server redirect and is shared by login/sign-up.
- `lib/auth-api.ts`: typed requests and stable API error parsing for all non-redirect auth operations.

Each form owns its input state and client validation. It calls typed functions from `auth-api.ts` and reports a domain outcome to `AuthCard`; it does not build endpoint URLs itself.

## 8. Email Delivery

Nodemailer is configured once in `MailModule`. Required production settings are:

- `SMTP_HOST`;
- `SMTP_PORT`;
- `SMTP_USER`;
- `SMTP_PASSWORD`;
- `MAIL_FROM`.

`SMTP_SECURE` is parsed as a boolean and must match the server/port configuration. `WEB_URL` provides the trusted reset-link origin. Header values and URLs are configuration, never request-controlled.

Verification email requirements:

- subject identifies WP Control Center email verification;
- the six-digit code is prominent in HTML and plain text;
- the ten-minute expiry is stated;
- no clickable verification token is included.

Reset email requirements:

- subject identifies WP Control Center password reset;
- HTML and plain-text versions contain the one-hour reset link;
- the message says to ignore it if the request was not made by the recipient.

Tests replace the transport with a mock. Development may use a local SMTP sink, but the API never returns raw OTPs or reset tokens in HTTP responses.

## 9. Configuration

Auth-related environment configuration is centralized in `apps/api/src/config/env.ts`:

- existing `JWT_SECRET` and `JWT_EXPIRES_IN`;
- `WEB_URL`;
- `SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE`, `SMTP_USER`, `SMTP_PASSWORD`, `MAIL_FROM`;
- `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_AUTH_REDIRECT_URI`.

Production startup fails fast when any required auth setting is missing or malformed. Tests inject explicit values. Example environment files and production Compose wiring must document every new setting without committing real credentials.

The Google callback URI is dedicated to sign-in and is distinct from the existing Google Analytics/Search Console integration callback URI.

## 10. Security and Abuse Controls

- Continue using the httpOnly session cookie. Browser code does not read or store JWTs.
- Keep `Secure` in production, `SameSite=Lax`, and the existing one-day session duration.
- Hash passwords with the current scrypt utility and compare them with timing-safe operations.
- Store only hashes of OTPs and reset tokens.
- Normalize email before all identity queries and writes.
- Do not log passwords, OTPs, reset tokens, OAuth codes, ID tokens, Google profiles, SMTP credentials, or cookies.
- Rate limit by IP and, where applicable, normalized email: login 10/minute, register 5/minute, verify 10/minute, resend 3/hour with a 60-second cooldown, and forgot-password 5/minute.
- Clear the OAuth state cookie on both callback success and failure.
- Accept only a verified Google email and a Google token whose audience equals `GOOGLE_CLIENT_ID`.
- Keep registration and Google linking transactions idempotent under uniqueness races.
- Return generic password-recovery responses and safe OAuth callback codes.
- Preserve `isActive` and `tokenVersion` checks for every resulting session.

## 11. Failure Handling

- Database failure rolls back user/code/identity mutations and returns the existing sanitized API error format.
- SMTP failure does not roll back a successfully created unverified account or code. The response tells the UI that delivery failed and provides a resend path.
- A wrong OTP increments attempts without exposing the stored hash or expected value.
- An expired, consumed, or exhausted OTP cannot be revived; only resend can create a usable code.
- Google cancellation and safe provider errors return to login without leaking provider payloads.
- A callback with missing/mismatched state is rejected before token exchange.
- Conflicting Google identity/email writes are resolved by re-reading the unique record; an identity is never silently moved between users.
- Password reset consumes its token and updates the password in the same transaction.

## 12. Testing Strategy

### API unit and service tests

Cover:

- registration creates an ADMIN user, normalized email, hashed password, and hashed OTP;
- verified duplicate, pending duplicate, invalid email, and weak password behavior;
- verification success, wrong code, expiry, reuse, five-attempt exhaustion, and concurrent consumption;
- resend cooldown, prior-code invalidation, and generic unknown/verified responses;
- login refusal before verification and success after verification;
- Google new-user creation, existing-email linking, existing-identity login, unverified Google email refusal, invalid state, invalid token, inactive user, and uniqueness races;
- forgot-password generic behavior, SMTP invocation, Google-only behavior, reset token expiry/reuse, and session revocation;
- mail subjects, plain text, HTML, expiry copy, and trusted reset URL using a mocked transporter;
- cookie attributes and callback redirect allowlist behavior at the controller boundary.

### Prisma and migration checks

- generate Prisma Client against the updated schema;
- apply the migration to a test database containing an existing user;
- verify that the existing user becomes email-verified and remains login-capable;
- verify identity uniqueness and cascade behavior;
- verify nullable password support for Google-only accounts.

### Web and Playwright tests

Cover:

- login/sign-up tab behavior and lost-password navigation;
- client validation, loading state, accessible errors, and password confirmation;
- registration to OTP, paste behavior, wrong/expired code, resend countdown, verification success, and return to login;
- successful email login and redirect to `/sites`;
- Google start redirect plus mocked success/failure callback outcomes;
- generic forgot-password result, reset-token mode, reset success, and invalid-link recovery;
- mobile viewport layout, keyboard navigation, and focus movement.

### Final regression commands

- API tests, lint, and typecheck;
- web lint, typecheck, and auth Playwright suite;
- Prisma generation and migration verification against a disposable database;
- root `npm run build:all`;
- runtime smoke check for seeded admin login, registration/verification, Google callback, logout, and password reset.

## 13. Acceptance Criteria

1. A user can create an ADMIN account with name, email, and password.
2. The account cannot sign in until a correct six-digit OTP is submitted within ten minutes.
3. OTP resend observes a 60-second cooldown and invalidates previous codes.
4. A verified email/password user can sign in and reaches `/sites` through the existing httpOnly cookie session.
5. A user can register or sign in through Google only when Google asserts a verified email.
6. Google sign-in automatically links an existing matching email and never creates a second user for that email.
7. A user with a password can request a generic password-recovery response, receive an SMTP reset link, set a new password, and invalidate previous sessions.
8. The page exposes only login, sign-up, and lost-password entry points; verification and reset are contextual completion states inside the same auth experience.
9. Self-registration never assigns `VIEWER`; the existing `VIEWER` role remains intact elsewhere.
10. Existing users and the seeded administrator remain able to sign in after migration.
11. Raw passwords, OTPs, reset tokens, OAuth codes, Google tokens, and JWTs are absent from logs and persistent client storage.
12. The UI matches the existing dark WP Control Center design system and is keyboard-accessible and responsive.

## 14. Out of Scope

- multi-factor authentication beyond initial email verification;
- magic-link login;
- additional social providers;
- organization invitations or approval workflows;
- changing the role hierarchy or removing `VIEWER`;
- account unlinking or a UI for managing sign-in methods;
- persistent Google authentication tokens;
- email marketing, notification preferences, or a general-purpose template platform;
- redesigning dashboard authorization or the existing Google analytics integration.
