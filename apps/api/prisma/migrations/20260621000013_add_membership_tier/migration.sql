CREATE TYPE "MembershipTier" AS ENUM ('FREE', 'PREMIUM');
ALTER TABLE "User" ADD COLUMN "membershipTier" "MembershipTier" NOT NULL DEFAULT 'PREMIUM';
