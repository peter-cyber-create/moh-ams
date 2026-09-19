-- In-app notifications (not an event bus / notification engine)
CREATE TABLE IF NOT EXISTS "notification" (
  "id" TEXT NOT NULL,
  "recipient_user_id" TEXT NOT NULL,
  "type" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "message" TEXT NOT NULL,
  "reference_type" TEXT,
  "reference_id" TEXT,
  "href" TEXT,
  "dedupe_key" TEXT NOT NULL,
  "is_read" BOOLEAN NOT NULL DEFAULT false,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "read_at" TIMESTAMP(3),
  CONSTRAINT "notification_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "notification_recipient_user_id_type_dedupe_key_key"
  ON "notification"("recipient_user_id", "type", "dedupe_key");

CREATE INDEX IF NOT EXISTS "notification_recipient_user_id_is_read_created_at_idx"
  ON "notification"("recipient_user_id", "is_read", "created_at");
