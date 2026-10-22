-- CreateTable
CREATE TABLE "DigestTemplate" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "headerHtml" TEXT NOT NULL DEFAULT '',
    "footerHtml" TEXT NOT NULL DEFAULT '',
    "sections" JSONB NOT NULL DEFAULT '[]',
    "accentColor" TEXT NOT NULL DEFAULT '#c5a880',
    "logoUrl" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DigestTemplate_pkey" PRIMARY KEY ("id")
);
