-- DropIndex
DROP INDEX "appointments_clientId_lawyerId_scheduleId_key";

-- CreateIndex
CREATE INDEX "idx_appointment_client_lawyer_schedule" ON "appointments"("clientId", "lawyerId", "scheduleId");
