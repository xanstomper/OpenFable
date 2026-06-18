# Authentication Domain

## Purpose
Owns all authentication, session management, and access control logic. This includes login flows, token generation/refresh, role-based access, and session storage.

## Ownership
Backend team. Primary contact: `@auth-team` in Slack.

## Local Contracts

### Session Token Format
- Tokens are JWT, signed with RS256
- Payload must contain `sub`, `exp`, `roles` claims
- Tokens expire after 14 days; refresh tokens after 90 days

### Auth Middleware Contract
- `requireAuth(req, res, next)` — rejects unauthenticated requests with 401
- `requireRole(role)` — factory that returns middleware rejecting with 403
- Both middleware expect `Authorization: Bearer <token>` header

### Error Shape
All auth errors return:
```json
{ "error": "auth_error", "code": "<machine_code>", "message": "<human readable>" }
```

## Work Guidance
- Do not store plaintext tokens in logs
- All new auth endpoints must have rate limiting
- Prefer existing session utilities over custom crypto

## Verification
- `npm run test:auth` — runs auth-specific test suite
- Coverage threshold: 90% line coverage on `src/auth/`

## Child DOX Index

| Path | Purpose |
|------|---------|
| `src/auth/oauth/` | OAuth2 provider integrations |
| `src/auth/middleware/` | Express middleware for auth and roles |
