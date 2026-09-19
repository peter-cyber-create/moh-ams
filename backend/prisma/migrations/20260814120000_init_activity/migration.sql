-- CreateTable
CREATE TABLE "identity_user" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "username" TEXT,
    "module" TEXT,
    "role_name" TEXT,
    "department_id" TEXT,
    "department_name" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "identity_user_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "activity" (
    "id" TEXT NOT NULL,
    "finance_activity_id" TEXT,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "requested_by" TEXT,
    "location" TEXT,
    "department_id" TEXT,
    "department_name" TEXT,
    "activity_date" TIMESTAMP(3),
    "budget_amount" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "funder" TEXT,
    "reference_number" TEXT,
    "activity_type" TEXT,
    "days" INTEGER,
    "status" TEXT NOT NULL,
    "created_by" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "activity_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "activity_participant" (
    "id" TEXT NOT NULL,
    "activity_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "title" TEXT,
    "phone" TEXT,
    "amount" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "days" INTEGER NOT NULL DEFAULT 0,
    "sort_order" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "activity_participant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "activity_document" (
    "id" TEXT NOT NULL,
    "activity_id" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "stored_path" TEXT NOT NULL,
    "original_name" TEXT NOT NULL,
    "mime_type" TEXT,
    "size_bytes" INTEGER,
    "uploaded_by" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "activity_document_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "activity_event" (
    "id" TEXT NOT NULL,
    "activity_id" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "summary" TEXT,
    "from_status" TEXT,
    "to_status" TEXT,
    "meta" JSONB,
    "actor_user_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "activity_event_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "migration_run" (
    "id" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "started_at" TIMESTAMP(3) NOT NULL,
    "finished_at" TIMESTAMP(3),
    "counts" JSONB,
    "notes" TEXT,

    CONSTRAINT "migration_run_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "activity_finance_activity_id_key" ON "activity"("finance_activity_id");

-- CreateIndex
CREATE INDEX "activity_status_created_at_idx" ON "activity"("status", "created_at");

-- CreateIndex
CREATE INDEX "activity_created_by_created_at_idx" ON "activity"("created_by", "created_at");

-- CreateIndex
CREATE INDEX "activity_funder_idx" ON "activity"("funder");

-- CreateIndex
CREATE INDEX "activity_activity_date_idx" ON "activity"("activity_date");

-- CreateIndex
CREATE INDEX "activity_participant_activity_id_idx" ON "activity_participant"("activity_id");

-- CreateIndex
CREATE INDEX "activity_participant_phone_name_idx" ON "activity_participant"("phone", "name");

-- CreateIndex
CREATE INDEX "activity_document_activity_id_kind_created_at_idx" ON "activity_document"("activity_id", "kind", "created_at");

-- CreateIndex
CREATE INDEX "activity_event_activity_id_created_at_idx" ON "activity_event"("activity_id", "created_at");

-- AddForeignKey
ALTER TABLE "activity_participant" ADD CONSTRAINT "activity_participant_activity_id_fkey" FOREIGN KEY ("activity_id") REFERENCES "activity"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "activity_document" ADD CONSTRAINT "activity_document_activity_id_fkey" FOREIGN KEY ("activity_id") REFERENCES "activity"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "activity_event" ADD CONSTRAINT "activity_event_activity_id_fkey" FOREIGN KEY ("activity_id") REFERENCES "activity"("id") ON DELETE CASCADE ON UPDATE CASCADE;

