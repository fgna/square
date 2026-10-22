PRIVATE COMMUNITY INSTANCE STARTER
==================================

This starter is a guide, not a deployable application or a secret store.
Use only reviewed material that you own or are licensed to use.

1. Copy the complete sample pack into a NEW, PRIVATE instance repository:
   cp -R examples/neutral-method-pack ./content
   The commands are relative to the community-platform-core checkout;
   move the copied content directory into your independent instance repo.

2. Replace ALL synthetic sample data with your own authorized material.
   Keep community.json schemaVersion/platformCompatibility and the
   assessment identity consistent with assessments/definition.json.
   Maintain both journal/de.json and journal/en.json and both method
   translation files (i18n/de/method.json, i18n/en/method.json).
   Never copy customer records, API keys, database dumps or brand assets
   out of the original project.

3. Use a dedicated PostgreSQL database and Redis instance per community.
   Set COMMUNITY_CONTENT_DIR to the canonical ABSOLUTE path of the private
   content directory on the API server; do not accept this path from users.
   API methods read inspected, trusted local content only. The web-side
   translation loader is server-only and must be explicitly integrated
   into an instance's i18n configuration before claiming those messages
   are active. Simply setting COMMUNITY_CONTENT_DIR is not sufficient.

4. Supply distinct high-entropy JWT secrets through a secret manager.
   Never commit .env files containing secrets. Configure per-instance
   domains, storage, backups, retention, allowed origins and TLS.
   Do not expose PostgreSQL or Redis publicly.

5. Pin a reviewed core commit or release. Run core unit tests, Prisma
   generate, API/Web typechecks and builds, then complete an isolated
   runtime smoke test with temporary data. Do not deploy the example
   pack, use development signing keys, or treat a green build as an
   authorization, legal, or security sign-off.

CURRENT LIMITATION
------------------
Core PR #9 has no reviewed production Dockerfiles or Docker Compose.
The previous deployment-security test still targets docker-compose.yml,
which has deliberately not been imported from the branded source.
Deployment remains blocked pending a separate audited deployment design.
