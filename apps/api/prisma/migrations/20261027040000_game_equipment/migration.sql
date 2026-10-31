-- Authenticated cosmetic equipment selection, separate from the immutable inventory ledger.
CREATE TABLE "GameEquipment" (
  "userId" TEXT NOT NULL,
  "slot" TEXT NOT NULL,
  "itemId" TEXT,
  "variant" TEXT NOT NULL DEFAULT 'red',
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "GameEquipment_pkey" PRIMARY KEY ("userId","slot")
);
ALTER TABLE "GameEquipment" ADD CONSTRAINT "GameEquipment_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "GameEquipment" ADD CONSTRAINT "GameEquipment_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "GameItem"("id") ON DELETE SET NULL ON UPDATE CASCADE;
