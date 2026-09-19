-- Lightweight admin audit events (not an enterprise audit engine)
CREATE TABLE IF NOT EXISTS "admin_audit_event" (
  "id" TEXT NOT NULL,
  "actor_user_id" TEXT NOT NULL,
  "action" TEXT NOT NULL,
  "target_user_id" TEXT,
  "summary" TEXT NOT NULL,
  "meta" JSONB NOT NULL DEFAULT '{}',
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "admin_audit_event_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "admin_audit_event_created_at_idx" ON "admin_audit_event"("created_at");
CREATE INDEX IF NOT EXISTS "admin_audit_event_target_user_id_created_at_idx" ON "admin_audit_event"("target_user_id", "created_at");
