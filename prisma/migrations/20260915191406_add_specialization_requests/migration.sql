-- CreateEnum
CREATE TYPE "SpecializationRequestStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- CreateTable
CREATE TABLE "lawyer_specialization_requests" (
    "id" TEXT NOT NULL,
    "lawyerId" TEXT NOT NULL,
    "specializationId" TEXT NOT NULL,
    "status" "SpecializationRequestStatus" NOT NULL DEFAULT 'PENDING',
    "rejectionReason" TEXT,
    "reviewedBy" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "lawyer_specialization_requests_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "lawyer_specialization_requests_status_idx" ON "lawyer_specialization_requests"("status");

-- CreateIndex
CREATE INDEX "lawyer_specialization_requests_lawyerId_idx" ON "lawyer_specialization_requests"("lawyerId");

-- CreateIndex
CREATE INDEX "lawyer_specialization_requests_specializationId_idx" ON "lawyer_specialization_requests"("specializationId");

-- CreateIndex
CREATE UNIQUE INDEX "lawyer_specialization_requests_lawyerId_specializationId_st_key" ON "lawyer_specialization_requests"("lawyerId", "specializationId", "status");

-- AddForeignKey
ALTER TABLE "lawyer_specialization_requests" ADD CONSTRAINT "lawyer_specialization_requests_lawyerId_fkey" FOREIGN KEY ("lawyerId") REFERENCES "lawyers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lawyer_specialization_requests" ADD CONSTRAINT "lawyer_specialization_requests_specializationId_fkey" FOREIGN KEY ("specializationId") REFERENCES "specializations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
