/*
  Warnings:

  - You are about to drop the column `generatedBy` on the `case_reports` table. All the data in the column will be lost.
  - You are about to drop the column `specialization` on the `lawyers` table. All the data in the column will be lost.
  - You are about to drop the column `uploadedBy` on the `legal_documents` table. All the data in the column will be lost.
  - Added the required column `uploadedById` to the `legal_documents` table without a default value. This is not possible if the table is not empty.

*/
-- DropIndex
DROP INDEX "idx_lawyer_specialization";

-- DropIndex
DROP INDEX "idx_payment_appointment";

-- AlterTable
ALTER TABLE "case_reports" DROP COLUMN "generatedBy",
ADD COLUMN     "generatedById" TEXT;

-- AlterTable
ALTER TABLE "lawyers" DROP COLUMN "specialization";

-- AlterTable
ALTER TABLE "legal_documents" DROP COLUMN "uploadedBy",
ADD COLUMN     "uploadedById" TEXT NOT NULL,
ALTER COLUMN "documentType" DROP DEFAULT;

-- DropEnum
DROP TYPE "DocumentUploader";

-- CreateTable
CREATE TABLE "case_messages" (
    "id" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "isRead" BOOLEAN NOT NULL DEFAULT false,
    "caseId" TEXT NOT NULL,
    "senderId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "case_messages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "specializations" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "specializations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "lawyer_specializations" (
    "id" TEXT NOT NULL,
    "lawyerId" TEXT NOT NULL,
    "specializationId" TEXT NOT NULL,

    CONSTRAINT "lawyer_specializations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "video_sessions" (
    "id" TEXT NOT NULL,
    "provider" TEXT,
    "roomId" TEXT NOT NULL,
    "roomUrl" TEXT,
    "startedAt" TIMESTAMP(3),
    "endedAt" TIMESTAMP(3),
    "appointmentId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "video_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "idx_case_message_case" ON "case_messages"("caseId");

-- CreateIndex
CREATE INDEX "idx_case_message_sender" ON "case_messages"("senderId");

-- CreateIndex
CREATE INDEX "idx_case_message_createdAt" ON "case_messages"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "specializations_name_key" ON "specializations"("name");

-- CreateIndex
CREATE INDEX "lawyer_specializations_lawyerId_idx" ON "lawyer_specializations"("lawyerId");

-- CreateIndex
CREATE INDEX "lawyer_specializations_specializationId_idx" ON "lawyer_specializations"("specializationId");

-- CreateIndex
CREATE UNIQUE INDEX "lawyer_specializations_lawyerId_specializationId_key" ON "lawyer_specializations"("lawyerId", "specializationId");

-- CreateIndex
CREATE UNIQUE INDEX "video_sessions_roomId_key" ON "video_sessions"("roomId");

-- CreateIndex
CREATE UNIQUE INDEX "video_sessions_appointmentId_key" ON "video_sessions"("appointmentId");

-- CreateIndex
CREATE INDEX "idx_case_report_generatedBy" ON "case_reports"("generatedById");

-- CreateIndex
CREATE INDEX "idx_document_uploadedBy" ON "legal_documents"("uploadedById");

-- CreateIndex
CREATE INDEX "idx_document_type" ON "legal_documents"("documentType");

-- CreateIndex
CREATE INDEX "idx_user_isDeleted" ON "users"("isDeleted");

-- AddForeignKey
ALTER TABLE "case_messages" ADD CONSTRAINT "case_messages_caseId_fkey" FOREIGN KEY ("caseId") REFERENCES "cases"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "case_messages" ADD CONSTRAINT "case_messages_senderId_fkey" FOREIGN KEY ("senderId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "case_reports" ADD CONSTRAINT "case_reports_generatedById_fkey" FOREIGN KEY ("generatedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "legal_documents" ADD CONSTRAINT "legal_documents_uploadedById_fkey" FOREIGN KEY ("uploadedById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lawyer_specializations" ADD CONSTRAINT "lawyer_specializations_lawyerId_fkey" FOREIGN KEY ("lawyerId") REFERENCES "lawyers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lawyer_specializations" ADD CONSTRAINT "lawyer_specializations_specializationId_fkey" FOREIGN KEY ("specializationId") REFERENCES "specializations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "video_sessions" ADD CONSTRAINT "video_sessions_appointmentId_fkey" FOREIGN KEY ("appointmentId") REFERENCES "appointments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- RenameIndex
ALTER INDEX "idx_payment_gateway" RENAME TO "payments_paymentGateway_idx";

-- RenameIndex
ALTER INDEX "idx_payment_status" RENAME TO "payments_status_idx";
