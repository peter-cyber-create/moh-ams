-- CreateTable
CREATE TABLE "accountability" (
    "id" TEXT NOT NULL,
    "reference_number" TEXT NOT NULL,
    "activity_id" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'UGX',
    "amount_advanced" DECIMAL(14,2) NOT NULL,
    "amount_returned" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "due_date" TIMESTAMP(3) NOT NULL,
    "submitted_by" TEXT NOT NULL,
    "submitted_at" TIMESTAMP(3),
    "reviewer_id" TEXT,
    "assigned_at" TIMESTAMP(3),
    "assigned_by" TEXT,
    "reviewed_at" TIMESTAMP(3),
    "approved_at" TIMESTAMP(3),
    "approved_by" TEXT,
    "rejected_at" TIMESTAMP(3),
    "rejected_by" TEXT,
    "rejection_reason" TEXT,
    "closed_at" TIMESTAMP(3),
    "closed_by" TEXT,
    "closure_reason" TEXT,
    "return_reason" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "accountability_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "accountability_line" (
    "id" TEXT NOT NULL,
    "accountability_id" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "amount" DECIMAL(14,2) NOT NULL,
    "sort_order" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "accountability_line_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "accountability_document" (
    "id" TEXT NOT NULL,
    "accountability_id" TEXT NOT NULL,
    "kind" TEXT NOT NULL DEFAULT 'supporting',
    "stored_path" TEXT NOT NULL,
    "original_name" TEXT NOT NULL,
    "mime_type" TEXT,
    "size_bytes" INTEGER,
    "uploaded_by" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "accountability_document_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "accountability_event" (
    "id" TEXT NOT NULL,
    "accountability_id" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "summary" TEXT,
    "from_status" TEXT,
    "to_status" TEXT,
    "meta" JSONB,
    "actor_user_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "accountability_event_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "accountability_clarification" (
    "id" TEXT NOT NULL,
    "accountability_id" TEXT NOT NULL,
    "question" TEXT NOT NULL,
    "requested_by" TEXT NOT NULL,
    "requested_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "response" TEXT,
    "responded_by" TEXT,
    "responded_at" TIMESTAMP(3),
    "status" TEXT NOT NULL DEFAULT 'open',

    CONSTRAINT "accountability_clarification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "accountability_comment" (
    "id" TEXT NOT NULL,
    "accountability_id" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "actor_user_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "accountability_comment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "accountability_sequence" (
    "year" INTEGER NOT NULL,
    "last" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "accountability_sequence_pkey" PRIMARY KEY ("year")
);

-- CreateIndex
CREATE UNIQUE INDEX "accountability_reference_number_key" ON "accountability"("reference_number");

-- CreateIndex
CREATE INDEX "accountability_status_due_date_idx" ON "accountability"("status", "due_date");

-- CreateIndex
CREATE INDEX "accountability_activity_id_idx" ON "accountability"("activity_id");

-- CreateIndex
CREATE INDEX "accountability_reviewer_id_status_idx" ON "accountability"("reviewer_id", "status");

-- CreateIndex
CREATE INDEX "accountability_submitted_by_idx" ON "accountability"("submitted_by");

-- CreateIndex
CREATE INDEX "accountability_created_at_idx" ON "accountability"("created_at");

-- CreateIndex
CREATE INDEX "accountability_line_accountability_id_idx" ON "accountability_line"("accountability_id");

-- CreateIndex
CREATE INDEX "accountability_document_accountability_id_created_at_idx" ON "accountability_document"("accountability_id", "created_at");

-- CreateIndex
CREATE INDEX "accountability_event_accountability_id_created_at_idx" ON "accountability_event"("accountability_id", "created_at");

-- CreateIndex
CREATE INDEX "accountability_clarification_accountability_id_status_idx" ON "accountability_clarification"("accountability_id", "status");

-- CreateIndex
CREATE INDEX "accountability_comment_accountability_id_created_at_idx" ON "accountability_comment"("accountability_id", "created_at");

-- AddForeignKey
ALTER TABLE "accountability" ADD CONSTRAINT "accountability_activity_id_fkey" FOREIGN KEY ("activity_id") REFERENCES "activity"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "accountability_line" ADD CONSTRAINT "accountability_line_accountability_id_fkey" FOREIGN KEY ("accountability_id") REFERENCES "accountability"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "accountability_document" ADD CONSTRAINT "accountability_document_accountability_id_fkey" FOREIGN KEY ("accountability_id") REFERENCES "accountability"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "accountability_event" ADD CONSTRAINT "accountability_event_accountability_id_fkey" FOREIGN KEY ("accountability_id") REFERENCES "accountability"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "accountability_clarification" ADD CONSTRAINT "accountability_clarification_accountability_id_fkey" FOREIGN KEY ("accountability_id") REFERENCES "accountability"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "accountability_comment" ADD CONSTRAINT "accountability_comment_accountability_id_fkey" FOREIGN KEY ("accountability_id") REFERENCES "accountability"("id") ON DELETE CASCADE ON UPDATE CASCADE;
