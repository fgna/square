# Instance capabilities

Square can run with a subset of optional product capabilities. The base identity,
registration, authentication, profile, user administration, and settings APIs
remain available.

Set **both** variables to the same comma-separated allowlist:

```dotenv
# API runtime
SQUARE_CAPABILITIES=courses,assessments
# Web build/runtime (rebuild the Next.js app after changing this)
NEXT_PUBLIC_SQUARE_CAPABILITIES=courses,assessments
```

Supported names: `feed`, `messages`, `events`, `courses`, `journal`,
`assessments`, `testimonials`, `recordings`, `gamification`. An empty value disables all nine. Unset values enable all nine,
preserving existing full-featured deployments. Unknown names fail startup/build.
Each capability can be selected independently; there are currently no required
dependencies between these nine capabilities.

The API's global capability guard rejects matching disabled endpoints with 404,
independent of authorization or whether the caller knows the URL. Next middleware
redirects disabled page requests to the dashboard, and the primary navigation,
admin navigation, command palette, and user menu omit disabled destinations.
The `journal` capability includes the bundled journal plugin.

**Deployment safety:** Keep both environment values identical; a difference
between API and web configuration can cause a misleading UI. Neither toggle
removes stored data. Turning a capability back on exposes its existing data
according to normal authorization. Feature disabling does not stop every
background job or every cross-feature recommendation on the dashboard.
A deployment accepting only identity/user administration should validate its
actual browser and API flows before production rollout.

`gamification` controls `/api/gamification/*`; disabled endpoints return 404. API and Web allowlists must match.

`recordings` controls recording-specific routes under `/api/events/recordings/*` and
`/api/events/:id/recordings` independently of the `events` switch. Operators can
retain event scheduling with recordings disabled. `testimonials` controls both the
public and admin pages and all `/api/testimonials/*` routes.

For a **new minimal instance**, explicitly configure both environment variables
with the desired allowlist (for example `courses,assessments`). This disables
journal, testimonials and recordings. Do not apply that allowlist to existing
full-featured deployments unless they intentionally opt in to that change.
