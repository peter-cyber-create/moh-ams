-- Activity operational data (teams, facilities, travel, budget lines)

CREATE TABLE "activity_team" (
    "id" TEXT NOT NULL,
    "activity_id" TEXT NOT NULL,
    "team_code" TEXT,
    "team_name" TEXT,
    "leader_person_id" TEXT,
    "notes" TEXT,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "activity_team_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "activity_team_member" (
    "id" TEXT NOT NULL,
    "team_id" TEXT NOT NULL,
    "person_id" TEXT,
    "designation" TEXT,
    "organisation" TEXT,
    "phone" TEXT,
    "rate" DECIMAL(14,2),
    "airtime_data" DECIMAL(14,2),
    "frequency" DECIMAL(10,2),
    "per_diem" DECIMAL(14,2),
    "fuel_allocation" DECIMAL(14,2),
    "supplied_total" DECIMAL(14,2),
    "calculated_total" DECIMAL(14,2),
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "activity_team_member_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "activity_facility" (
    "id" TEXT NOT NULL,
    "activity_id" TEXT NOT NULL,
    "region" TEXT,
    "district" TEXT,
    "facility" TEXT,
    "facility_code" TEXT,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "activity_facility_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "activity_travel" (
    "id" TEXT NOT NULL,
    "activity_id" TEXT NOT NULL,
    "team_id" TEXT,
    "region" TEXT,
    "facility" TEXT,
    "from_location" TEXT,
    "to_location" TEXT,
    "kilometres" DECIMAL(10,2),
    "litres" DECIMAL(10,2),
    "fuel_rate" DECIMAL(14,2),
    "fuel_amount" DECIMAL(14,2),
    "supplied_fuel_amount" DECIMAL(14,2),
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "activity_travel_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "activity_budget_line" (
    "id" TEXT NOT NULL,
    "activity_id" TEXT NOT NULL,
    "team_id" TEXT,
    "category" TEXT NOT NULL,
    "description" TEXT,
    "quantity" DECIMAL(10,2),
    "frequency" DECIMAL(10,2),
    "rate" DECIMAL(14,2),
    "amount" DECIMAL(14,2) NOT NULL,
    "supplied_amount" DECIMAL(14,2),
    "calculated_amount" DECIMAL(14,2),
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "activity_budget_line_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "activity_team_activity_id_idx" ON "activity_team"("activity_id");
CREATE INDEX "activity_team_member_team_id_idx" ON "activity_team_member"("team_id");
CREATE INDEX "activity_team_member_person_id_idx" ON "activity_team_member"("person_id");
CREATE INDEX "activity_facility_activity_id_idx" ON "activity_facility"("activity_id");
CREATE INDEX "activity_facility_region_district_idx" ON "activity_facility"("region", "district");
CREATE INDEX "activity_travel_activity_id_idx" ON "activity_travel"("activity_id");
CREATE INDEX "activity_travel_team_id_idx" ON "activity_travel"("team_id");
CREATE INDEX "activity_budget_line_activity_id_idx" ON "activity_budget_line"("activity_id");
CREATE INDEX "activity_budget_line_team_id_idx" ON "activity_budget_line"("team_id");

ALTER TABLE "activity_team" ADD CONSTRAINT "activity_team_activity_id_fkey" FOREIGN KEY ("activity_id") REFERENCES "activity"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "activity_team" ADD CONSTRAINT "activity_team_leader_person_id_fkey" FOREIGN KEY ("leader_person_id") REFERENCES "person"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "activity_team_member" ADD CONSTRAINT "activity_team_member_team_id_fkey" FOREIGN KEY ("team_id") REFERENCES "activity_team"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "activity_team_member" ADD CONSTRAINT "activity_team_member_person_id_fkey" FOREIGN KEY ("person_id") REFERENCES "person"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "activity_facility" ADD CONSTRAINT "activity_facility_activity_id_fkey" FOREIGN KEY ("activity_id") REFERENCES "activity"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "activity_travel" ADD CONSTRAINT "activity_travel_activity_id_fkey" FOREIGN KEY ("activity_id") REFERENCES "activity"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "activity_travel" ADD CONSTRAINT "activity_travel_team_id_fkey" FOREIGN KEY ("team_id") REFERENCES "activity_team"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "activity_budget_line" ADD CONSTRAINT "activity_budget_line_activity_id_fkey" FOREIGN KEY ("activity_id") REFERENCES "activity"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "activity_budget_line" ADD CONSTRAINT "activity_budget_line_team_id_fkey" FOREIGN KEY ("team_id") REFERENCES "activity_team"("id") ON DELETE SET NULL ON UPDATE CASCADE;
