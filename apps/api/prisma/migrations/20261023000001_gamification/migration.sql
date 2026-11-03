
CREATE TABLE "GameWallet" ("userId" TEXT PRIMARY KEY REFERENCES "User"("id") ON DELETE CASCADE, "balance" INTEGER NOT NULL DEFAULT 0 CHECK ("balance" >= 0), "updatedAt" TIMESTAMP(3) NOT NULL);
CREATE TABLE "GameRewardDefinition" ("code" TEXT PRIMARY KEY, "amount" INTEGER NOT NULL CHECK ("amount" > 0), "active" BOOLEAN NOT NULL DEFAULT true, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE "GameRewardEvent" ("id" TEXT PRIMARY KEY, "userId" TEXT NOT NULL REFERENCES "User"("id") ON DELETE CASCADE, "eventKey" TEXT NOT NULL, "rewardCode" TEXT NOT NULL, "amount" INTEGER NOT NULL CHECK ("amount" > 0), "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP);
CREATE UNIQUE INDEX "GameRewardEvent_userId_eventKey_key" ON "GameRewardEvent"("userId","eventKey");
CREATE TABLE "GameTransaction" ("id" TEXT PRIMARY KEY, "userId" TEXT NOT NULL REFERENCES "User"("id") ON DELETE CASCADE, "delta" INTEGER NOT NULL CHECK ("delta" <> 0), "kind" TEXT NOT NULL, "reference" TEXT NOT NULL, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP);
CREATE UNIQUE INDEX "GameTransaction_kind_reference_key" ON "GameTransaction"("kind","reference");
CREATE INDEX "GameTransaction_userId_createdAt_idx" ON "GameTransaction"("userId","createdAt");
CREATE TABLE "GameItem" ("id" TEXT PRIMARY KEY, "name" TEXT NOT NULL, "price" INTEGER NOT NULL CHECK ("price" >= 0), "cosmetic" BOOLEAN NOT NULL DEFAULT false, "active" BOOLEAN NOT NULL DEFAULT true, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE "GameInventory" ("userId" TEXT NOT NULL REFERENCES "User"("id") ON DELETE CASCADE, "itemId" TEXT NOT NULL REFERENCES "GameItem"("id"), "acquiredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, PRIMARY KEY ("userId","itemId"));
CREATE TABLE "GamePurchase" ("id" TEXT PRIMARY KEY, "userId" TEXT NOT NULL REFERENCES "User"("id") ON DELETE CASCADE, "itemId" TEXT NOT NULL REFERENCES "GameItem"("id"), "requestKey" TEXT NOT NULL, "price" INTEGER NOT NULL CHECK ("price" >= 0), "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP);
CREATE UNIQUE INDEX "GamePurchase_userId_requestKey_key" ON "GamePurchase"("userId","requestKey");
