-- CreateIndex
CREATE INDEX "blackouts_business_id_start_at_end_at_idx" ON "blackouts"("business_id", "start_at", "end_at");

-- CreateIndex
CREATE INDEX "staff_services_service_id_idx" ON "staff_services"("service_id");

-- CreateIndex
CREATE INDEX "time_offs_staff_id_start_at_end_at_idx" ON "time_offs"("staff_id", "start_at", "end_at");
