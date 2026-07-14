-- Assisted Entry minimum slice: distinct metadata + correction history

-- CreateEnum
CREATE TYPE "AssistedCollectionChannel" AS ENUM ('Phone', 'InPerson', 'Video', 'HomeVisit', 'Other');

-- CreateTable
CREATE TABLE "AssistedEntry" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "subjectId" TEXT NOT NULL,
    "recorderUserId" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "collectionChannel" "AssistedCollectionChannel" NOT NULL,
    "instrumentType" TEXT NOT NULL,
    "questionnaireResponseId" TEXT NOT NULL,
    "templateId" TEXT NOT NULL,
    "templateCode" TEXT NOT NULL,
    "templateVersion" TEXT NOT NULL,
    "recordedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AssistedEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AssistedEntryCorrection" (
    "id" TEXT NOT NULL,
    "assistedEntryId" TEXT NOT NULL,
    "actorUserId" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "beforeValue" JSONB NOT NULL,
    "afterValue" JSONB NOT NULL,
    "correctedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AssistedEntryCorrection_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "AssistedEntry_questionnaireResponseId_key" ON "AssistedEntry"("questionnaireResponseId");

-- CreateIndex
CREATE INDEX "AssistedEntry_projectId_recordedAt_idx" ON "AssistedEntry"("projectId", "recordedAt");

-- CreateIndex
CREATE INDEX "AssistedEntry_subjectId_idx" ON "AssistedEntry"("subjectId");

-- AddForeignKey
ALTER TABLE "AssistedEntry" ADD CONSTRAINT "AssistedEntry_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AssistedEntry" ADD CONSTRAINT "AssistedEntry_subjectId_fkey" FOREIGN KEY ("subjectId") REFERENCES "Subject"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AssistedEntry" ADD CONSTRAINT "AssistedEntry_recorderUserId_fkey" FOREIGN KEY ("recorderUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AssistedEntry" ADD CONSTRAINT "AssistedEntry_questionnaireResponseId_fkey" FOREIGN KEY ("questionnaireResponseId") REFERENCES "QuestionnaireResponse"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AssistedEntryCorrection" ADD CONSTRAINT "AssistedEntryCorrection_assistedEntryId_fkey" FOREIGN KEY ("assistedEntryId") REFERENCES "AssistedEntry"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AssistedEntryCorrection" ADD CONSTRAINT "AssistedEntryCorrection_actorUserId_fkey" FOREIGN KEY ("actorUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;