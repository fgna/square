-- Files (slides, handouts) that belong to a recording.
CREATE TABLE "RecordingAttachment" (
    "id" TEXT NOT NULL,
    "recordingId" TEXT NOT NULL,
    "filename" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "size" INTEGER NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RecordingAttachment_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "RecordingAttachment_recordingId_idx" ON "RecordingAttachment"("recordingId");

ALTER TABLE "RecordingAttachment" ADD CONSTRAINT "RecordingAttachment_recordingId_fkey" FOREIGN KEY ("recordingId") REFERENCES "Recording"("id") ON DELETE CASCADE ON UPDATE CASCADE;
