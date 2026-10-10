-- Schedule capacity is no longer divided into fixed-duration slots.
ALTER TABLE "schedules" DROP COLUMN IF EXISTS "totalSlots";
ALTER TABLE "schedules" DROP COLUMN IF EXISTS "availableSlots";

DROP INDEX IF EXISTS "unique_appointment_serial_number";
CREATE UNIQUE INDEX "unique_appointment_serial_number"
ON "appointments"("scheduleId", "serialNumber")
WHERE "serialNumber" IS NOT NULL;