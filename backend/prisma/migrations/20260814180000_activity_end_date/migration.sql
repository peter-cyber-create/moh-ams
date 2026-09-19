-- CreateTable
-- Wave 3: activity end date for inclusive participation duration.

ALTER TABLE "activity" ADD COLUMN "end_date" TIMESTAMP(3);

CREATE INDEX "activity_end_date_idx" ON "activity"("end_date");
