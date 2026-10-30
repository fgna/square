# Member password recovery (Square #88)

Configure the instance with `SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE`, `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM` and `PUBLIC_BASE_URL`. The public base URL must be an HTTPS origin controlled by this instance, for example `https://community.example.org`, without a path, query, credentials or fragment. Set a valid sender address belonging to the instance's mail domain. Redis is required for one-time tokens and request throttling.

Members select **Forgot password?** on the sign-in page. The email message links to `/reset-password?token=...` at the configured public origin; links are valid for 20 minutes and can be used once. Requests for nonexistent, inactive and OAuth-only accounts have identical responses. Repeated requests per email are limited to one per minute, in addition to per-IP route throttling. A successful reset clears refresh sessions and invalidates old access JWTs using the password-hash version.

No token should appear in application logs or analytics. Deployment proxies and access logs must redact query strings on `/reset-password`, and third-party analytics must not record that URL. The reset page should be excluded from analytics and use a strict referrer policy. Mail transport failures are logged without token content and no reset token is returned to the requester. An unconfigured SMTP transport or public base URL disables delivery while returning the same generic confirmation.

Do not use the demo mail dry-run behavior for password recovery: the recovery service checks `isConfigured` before issuing reset tokens. Never embed provider credentials or an instance-specific hostname in Square source code.

Acceptance requires an isolated instance with working SMTP, browser validation of login → request → email → reset → login, and focused security tests for expiry, reuse, enumeration, rate limiting and provider failure. Do not deploy to production as part of this implementation.
