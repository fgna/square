-- CreateTable
CREATE TABLE "PlatformSettings" (
    "id" TEXT NOT NULL DEFAULT 'default',
    "platformName" TEXT NOT NULL DEFAULT 'Community',
    "logoUrl" TEXT,
    "primaryColor" TEXT NOT NULL DEFAULT '#c5a880',
    "accentColor" TEXT NOT NULL DEFAULT '#6366f1',
    "allowSignups" BOOLEAN NOT NULL DEFAULT true,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PlatformSettings_pkey" PRIMARY KEY ("id")
);

-- Insert default settings row
INSERT INTO "PlatformSettings" ("id", "platformName", "primaryColor", "accentColor", "allowSignups", "updatedAt")
VALUES ('default', 'Community', '#c5a880', '#6366f1', true, NOW())
ON CONFLICT ("id") DO NOTHING;
