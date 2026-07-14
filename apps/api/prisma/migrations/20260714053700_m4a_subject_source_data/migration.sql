-- M4A: Subject identity binding + symptom reports + data entry channel

-- CreateEnum
CREATE TYPE "DataEntryChannel" AS ENUM ('SubjectSelfReport', 'StaffEntry', 'AssistedEntry');

-- CreateEnum
CREATE TYPE "SymptomReportStatus" AS ENUM ('Draft', 'Submitted');

-- AlterTable
ALTER TABLE "Subject" ADD COLUMN "subjectUserId" TEXT;

-- AlterTable
ALTER TABLE "QuestionnaireResponse" ADD COLUMN "entryChannel" "DataEntryChannel" NOT NULL DEFAULT 'StaffEntry';

-- CreateTable
CREATE TABLE "SymptomReport" (
    "id" TEXT NOT NULL,
    "subjectId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "status" "SymptomReportStatus" NOT NULL,
    "entryChannel" "DataEntryChannel" NOT NULL DEFAULT 'SubjectSelfReport',
    "discomfortType" TEXT NOT NULL,
    "onsetAt" TIMESTAMP(3) NOT NULL,
    "severity" "RiskLevel" NOT NULL,
    "soughtMedicalCare" BOOLEAN NOT NULL DEFAULT false,
    "hospitalized" BOOLEAN NOT NULL DEFAULT false,
    "stoppedMedication" BOOLEAN NOT NULL DEFAULT false,
    "description" TEXT NOT NULL,
    "submittedByUserId" TEXT,
    "submittedAt" TIMESTAMP(3),
    "riskSignalId" TEXT,
    "safetyEventId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SymptomReport_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SymptomReport_projectId_status_idx" ON "SymptomReport"("projectId", "status");

-- CreateIndex
CREATE INDEX "SymptomReport_subjectId_status_idx" ON "SymptomReport"("subjectId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "Subject_subjectUserId_key" ON "Subject"("subjectUserId");

-- AddForeignKey
ALTER TABLE "Subject" ADD CONSTRAINT "Subject_subjectUserId_fkey" FOREIGN KEY ("subjectUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SymptomReport" ADD CONSTRAINT "SymptomReport_subjectId_fkey" FOREIGN KEY ("subjectId") REFERENCES "Subject"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SymptomReport" ADD CONSTRAINT "SymptomReport_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SymptomReport" ADD CONSTRAINT "SymptomReport_submittedByUserId_fkey" FOREIGN KEY ("submittedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;