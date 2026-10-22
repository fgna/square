-- Uploads used to be stored with the host they were uploaded through
-- ("http://localhost:3001/uploads/…", "https://api.example.com/uploads/…").
-- They break when the platform moves to another domain. Keep only the path;
-- the web app serves "/uploads/…" through its own rewrite.
-- Only addresses whose path starts directly with /uploads/ are touched, so
-- links to other sites (e.g. /wp-content/uploads/) stay as they are.

UPDATE "User"
SET "avatarUrl" = regexp_replace("avatarUrl", '^https?://[^/]+(/uploads/)', '\1')
WHERE "avatarUrl" ~ '^https?://[^/]+/uploads/';

UPDATE "Course"
SET "coverUrl" = regexp_replace("coverUrl", '^https?://[^/]+(/uploads/)', '\1')
WHERE "coverUrl" ~ '^https?://[^/]+/uploads/';

UPDATE "PlatformSettings"
SET "logoUrl" = regexp_replace("logoUrl", '^https?://[^/]+(/uploads/)', '\1')
WHERE "logoUrl" ~ '^https?://[^/]+/uploads/';

UPDATE "DigestTemplate"
SET "logoUrl" = regexp_replace("logoUrl", '^https?://[^/]+(/uploads/)', '\1')
WHERE "logoUrl" ~ '^https?://[^/]+/uploads/';

-- Pictures inside lesson text (rich editor HTML).
UPDATE "Lesson"
SET "content" = regexp_replace("content", 'https?://[^/"''\s]+(/uploads/)', '\1', 'g')
WHERE "content" ~ 'https?://[^/"''\s]+/uploads/';
