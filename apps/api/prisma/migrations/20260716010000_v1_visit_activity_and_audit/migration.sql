-- VisitInput audit fields
ALTER TABLE "VisitInput" ADD COLUMN "version" INTEGER NOT NULL DEFAULT 1;
ALTER TABLE "VisitInput" ADD COLUMN "originalContent" TEXT;
ALTER TABLE "VisitInput" ADD COLUMN "editReason" TEXT;
ALTER TABLE "VisitInput" ADD COLUMN "isVoided" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "VisitInput" ADD COLUMN "voidedAt" DATETIME;
ALTER TABLE "VisitInput" ADD COLUMN "voidReason" TEXT;
ALTER TABLE "VisitInput" ADD COLUMN "voidedById" TEXT;

-- ActionPack active flag and model info
ALTER TABLE "ActionPack" ADD COLUMN "modelInfo" TEXT;
ALTER TABLE "ActionPack" ADD COLUMN "isActive" BOOLEAN NOT NULL DEFAULT true;
CREATE INDEX "ActionPack_monitoringVisitId_isActive_idx" ON "ActionPack"("monitoringVisitId", "isActive");

-- ActionItem origin
ALTER TABLE "ActionItem" ADD COLUMN "origin" TEXT NOT NULL DEFAULT 'RULE';

-- VisitActivity checklist
CREATE TABLE "VisitActivity" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "monitoringVisitId" TEXT NOT NULL,
    "activityType" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "note" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "relatedIssueIds" TEXT,
    "evidenceIds" TEXT,
    "sourceInputId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "VisitActivity_monitoringVisitId_fkey" FOREIGN KEY ("monitoringVisitId") REFERENCES "MonitoringVisit" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX "VisitActivity_monitoringVisitId_idx" ON "VisitActivity"("monitoringVisitId");
