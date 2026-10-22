-- Wiederkehrende Events: jede Wiederholung ist ein eigener Datensatz,
-- verbunden über seriesId. Dadurch behält jeder Termin eigene RSVPs,
-- Erinnerungen und Aufzeichnungen und kann einzeln abgesagt werden.

CREATE TYPE "RecurrenceRule" AS ENUM ('DAILY', 'WEEKLY', 'BIWEEKLY', 'MONTHLY');

ALTER TABLE "Event" ADD COLUMN "seriesId" TEXT;
ALTER TABLE "Event" ADD COLUMN "recurrence" "RecurrenceRule";

CREATE INDEX "Event_seriesId_idx" ON "Event"("seriesId");
