-- AlterTable
ALTER TABLE "Message" ALTER COLUMN "id" DROP DEFAULT,
ALTER COLUMN "id" SET DATA TYPE TEXT USING id::text;

-- AlterTable
ALTER TABLE "DirectMessage" ALTER COLUMN "id" DROP DEFAULT,
ALTER COLUMN "id" SET DATA TYPE TEXT USING id::text;

-- Restore Default (if needed later via application, but for DB schema strictness we can leave it or set safe defaults)
-- Prisma schema has @default(uuid()), which is handled by client or gen_random_uuid() if db supported. 
-- For now, dropping default autoincrement is key.