-- Allow a pending request to carry a new practice-area name
-- until an administrator approves it and creates the specialization.
ALTER TABLE "lawyer_specialization_requests"
  ALTER COLUMN "specializationId" DROP NOT NULL;

ALTER TABLE "lawyer_specialization_requests"
  ADD COLUMN "newPracticeArea" TEXT;
