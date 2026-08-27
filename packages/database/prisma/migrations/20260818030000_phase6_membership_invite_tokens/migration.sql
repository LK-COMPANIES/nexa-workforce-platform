-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "AuthEventType" ADD VALUE 'MEMBER_INVITED';
ALTER TYPE "AuthEventType" ADD VALUE 'INVITE_ACCEPTED';

-- AlterTable
ALTER TABLE "organization_memberships" ADD COLUMN     "invite_token_expires_at" TIMESTAMP(3),
ADD COLUMN     "invite_token_hash" TEXT;

