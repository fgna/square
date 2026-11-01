ALTER TABLE "Post" ADD COLUMN "publishAt" TIMESTAMP(3);
CREATE INDEX "Post_publishAt_idx" ON "Post"("publishAt");
