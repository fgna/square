-- Erfahrungsberichte: Likes und Kommentare durch andere Mitglieder

CREATE TABLE "TestimonialLike" (
    "id" TEXT NOT NULL,
    "testimonialId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "TestimonialLike_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "TestimonialComment" (
    "id" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "testimonialId" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "TestimonialComment_pkey" PRIMARY KEY ("id")
);

-- Ein Like pro Person und Bericht
CREATE UNIQUE INDEX "TestimonialLike_testimonialId_userId_key" ON "TestimonialLike"("testimonialId", "userId");
CREATE INDEX "TestimonialLike_testimonialId_idx" ON "TestimonialLike"("testimonialId");
CREATE INDEX "TestimonialComment_testimonialId_createdAt_idx" ON "TestimonialComment"("testimonialId", "createdAt");

ALTER TABLE "TestimonialLike" ADD CONSTRAINT "TestimonialLike_testimonialId_fkey"
    FOREIGN KEY ("testimonialId") REFERENCES "Testimonial"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TestimonialLike" ADD CONSTRAINT "TestimonialLike_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TestimonialComment" ADD CONSTRAINT "TestimonialComment_testimonialId_fkey"
    FOREIGN KEY ("testimonialId") REFERENCES "Testimonial"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TestimonialComment" ADD CONSTRAINT "TestimonialComment_authorId_fkey"
    FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
