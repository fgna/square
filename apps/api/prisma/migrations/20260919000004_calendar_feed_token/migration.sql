-- Persönlicher Kalender-Feed: pro Nutzer ein widerrufbares Zugriffstoken.
-- Null bedeutet: Feed noch nicht aktiviert.

ALTER TABLE "User" ADD COLUMN "calendarToken" TEXT;
CREATE UNIQUE INDEX "User_calendarToken_key" ON "User"("calendarToken");
