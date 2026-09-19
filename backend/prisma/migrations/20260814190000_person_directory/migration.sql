-- Wave 4 Person directory

CREATE TABLE "person_sequence" (
    "id" INTEGER NOT NULL DEFAULT 1,
    "last" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "person_sequence_pkey" PRIMARY KEY ("id")
);

INSERT INTO "person_sequence" ("id", "last") VALUES (1, 0);

CREATE TABLE "person" (
    "id" TEXT NOT NULL,
    "person_reference" TEXT NOT NULL,
    "full_name" TEXT NOT NULL,
    "phone" TEXT,
    "phone_normalized" TEXT,
    "email" TEXT,
    "organisation" TEXT,
    "title" TEXT,
    "department_id" TEXT,
    "department_name" TEXT,
    "identity_status" TEXT NOT NULL DEFAULT 'unverified',
    "identity_user_id" TEXT,
    "status" TEXT NOT NULL DEFAULT 'active',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "person_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "person_event" (
    "id" TEXT NOT NULL,
    "person_id" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "summary" TEXT,
    "meta" JSONB,
    "actor_user_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "person_event_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "activity_participant" ADD COLUMN "person_id" TEXT;
ALTER TABLE "accountability" ADD COLUMN "person_id" TEXT;

CREATE UNIQUE INDEX "person_person_reference_key" ON "person"("person_reference");
CREATE UNIQUE INDEX "person_identity_user_id_key" ON "person"("identity_user_id");
CREATE INDEX "person_phone_normalized_idx" ON "person"("phone_normalized");
CREATE INDEX "person_email_idx" ON "person"("email");
CREATE INDEX "person_full_name_idx" ON "person"("full_name");
CREATE INDEX "person_identity_status_status_idx" ON "person"("identity_status", "status");
CREATE INDEX "person_event_person_id_created_at_idx" ON "person_event"("person_id", "created_at");
CREATE INDEX "activity_participant_person_id_idx" ON "activity_participant"("person_id");
CREATE INDEX "accountability_person_id_idx" ON "accountability"("person_id");

ALTER TABLE "person" ADD CONSTRAINT "person_identity_user_id_fkey" FOREIGN KEY ("identity_user_id") REFERENCES "identity_user"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "person_event" ADD CONSTRAINT "person_event_person_id_fkey" FOREIGN KEY ("person_id") REFERENCES "person"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "activity_participant" ADD CONSTRAINT "activity_participant_person_id_fkey" FOREIGN KEY ("person_id") REFERENCES "person"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "accountability" ADD CONSTRAINT "accountability_person_id_fkey" FOREIGN KEY ("person_id") REFERENCES "person"("id") ON DELETE SET NULL ON UPDATE CASCADE;
