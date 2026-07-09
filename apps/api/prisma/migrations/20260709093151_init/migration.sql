-- CreateEnum
CREATE TYPE "Role" AS ENUM ('SponsorAdmin', 'CROPM', 'SitePI', 'SiteCRC', 'CRA', 'Auditor', 'RegulatorReadOnly', 'Subject', 'ProviderLogistics', 'ProviderNurse', 'SystemAdmin');

-- CreateEnum
CREATE TYPE "SubjectStatus" AS ENUM ('PreScreening', 'Consenting', 'Screening', 'Enrolled', 'Active', 'Completed', 'Withdrawn', 'ScreenFailed');

-- CreateEnum
CREATE TYPE "ProtocolParseStatus" AS ENUM ('Uploaded', 'Parsing', 'Parsed', 'ParseFailed', 'UnderReview', 'Effective', 'Superseded');

-- CreateEnum
CREATE TYPE "HumanConfirmationStatus" AS ENUM ('Pending', 'Adopted', 'EditedAdopted', 'Rejected', 'NeedsInvestigatorConfirmation');

-- CreateEnum
CREATE TYPE "ConsentStatus" AS ENUM ('NotStarted', 'Reading', 'ComprehensionPending', 'SubjectSigned', 'InvestigatorSigned', 'Completed', 'ReConsentRequired', 'Withdrawn');

-- CreateEnum
CREATE TYPE "VisitStatus" AS ENUM ('NotStarted', 'Scheduled', 'InProgress', 'SubmittedForPI', 'Completed', 'Missed', 'OutOfWindow', 'Deviation');

-- CreateEnum
CREATE TYPE "QuestionnaireStatus" AS ENUM ('Scheduled', 'InProgress', 'Submitted', 'Missed', 'Late', 'Reviewed');

-- CreateEnum
CREATE TYPE "SafetyEventStatus" AS ENUM ('Draft', 'InvestigatorReview', 'ConfirmedAE', 'ConfirmedSAE', 'Reported', 'FollowUp', 'Closed');

-- CreateEnum
CREATE TYPE "RiskLevel" AS ENUM ('Low', 'Medium', 'High', 'Critical');

-- CreateEnum
CREATE TYPE "RiskStatus" AS ENUM ('Open', 'Assigned', 'InProgress', 'PendingInvestigator', 'Resolved', 'Closed', 'Rejected');

-- CreateEnum
CREATE TYPE "ReportStatus" AS ENUM ('Generating', 'Draft', 'UnderReview', 'Confirmed', 'Exported', 'Failed');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "phone" TEXT,
    "organization" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RoleAssignment" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "projectId" TEXT,
    "siteId" TEXT,
    "role" "Role" NOT NULL,
    "assignedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RoleAssignment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Project" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "sponsor" TEXT NOT NULL,
    "therapeuticArea" TEXT NOT NULL,
    "phase" TEXT NOT NULL,
    "description" TEXT,
    "startDate" TIMESTAMP(3) NOT NULL,
    "estimatedEndDate" TIMESTAMP(3),
    "archivedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Project_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Site" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "city" TEXT,
    "region" TEXT,
    "principalInvestigatorUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Site_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Subject" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "siteId" TEXT NOT NULL,
    "status" "SubjectStatus" NOT NULL,
    "enrollmentDate" TIMESTAMP(3),
    "withdrawnDate" TIMESTAMP(3),
    "ownerUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "subjectCode" TEXT NOT NULL,
    "initials" TEXT,
    "yearOfBirth" INTEGER,
    "ageBand" TEXT,
    "sex" TEXT,
    "city" TEXT,

    CONSTRAINT "Subject_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SubjectSensitiveIdentity" (
    "subjectId" TEXT NOT NULL,
    "fullName" TEXT NOT NULL,
    "nationalId" TEXT NOT NULL,
    "dateOfBirth" TIMESTAMP(3) NOT NULL,
    "phone" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "address" TEXT NOT NULL,
    "lastViewedByUserId" TEXT,
    "lastViewedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SubjectSensitiveIdentity_pkey" PRIMARY KEY ("subjectId")
);

-- CreateTable
CREATE TABLE "ProtocolVersion" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "version" TEXT NOT NULL,
    "documentUrl" TEXT NOT NULL,
    "parseStatus" "ProtocolParseStatus" NOT NULL,
    "effectiveFrom" TIMESTAMP(3),
    "supersededAt" TIMESTAMP(3),
    "uploadedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProtocolVersion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AIProtocolParseResult" (
    "id" TEXT NOT NULL,
    "protocolVersionId" TEXT NOT NULL,
    "status" "HumanConfirmationStatus" NOT NULL DEFAULT 'Pending',
    "fields" JSONB NOT NULL,
    "confidence" DOUBLE PRECISION NOT NULL,
    "generatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "confirmedByUserId" TEXT,
    "confirmedAt" TIMESTAMP(3),
    "notes" TEXT,
    "aiOutputId" TEXT,

    CONSTRAINT "AIProtocolParseResult_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ConsentDocument" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "version" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "documentUrl" TEXT NOT NULL,
    "effectiveFrom" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ConsentDocument_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ConsentTask" (
    "id" TEXT NOT NULL,
    "subjectId" TEXT NOT NULL,
    "consentDocumentId" TEXT NOT NULL,
    "status" "ConsentStatus" NOT NULL,
    "startedAt" TIMESTAMP(3),
    "comprehensionScore" DOUBLE PRECISION,
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ConsentTask_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SignatureRecord" (
    "id" TEXT NOT NULL,
    "consentTaskId" TEXT NOT NULL,
    "signerUserId" TEXT NOT NULL,
    "signerRole" TEXT NOT NULL,
    "signedAt" TIMESTAMP(3) NOT NULL,
    "signatureMethod" TEXT NOT NULL,
    "signaturePayload" TEXT NOT NULL,
    "ipAddress" TEXT,

    CONSTRAINT "SignatureRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Visit" (
    "id" TEXT NOT NULL,
    "subjectId" TEXT NOT NULL,
    "visitCode" TEXT NOT NULL,
    "scheduledAt" TIMESTAMP(3) NOT NULL,
    "windowStart" TIMESTAMP(3) NOT NULL,
    "windowEnd" TIMESTAMP(3) NOT NULL,
    "status" "VisitStatus" NOT NULL,
    "createdByUserId" TEXT,
    "submittedByUserId" TEXT,
    "closedByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Visit_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VisitTask" (
    "id" TEXT NOT NULL,
    "visitId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "completed" BOOLEAN NOT NULL DEFAULT false,
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "VisitTask_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RemoteVisitRecord" (
    "id" TEXT NOT NULL,
    "visitId" TEXT NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL,
    "endedAt" TIMESTAMP(3),
    "videoProvider" TEXT,
    "videoSessionId" TEXT,
    "notes" TEXT,

    CONSTRAINT "RemoteVisitRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "QuestionnaireTemplate" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "version" TEXT NOT NULL,
    "schema" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "QuestionnaireTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "QuestionnaireResponse" (
    "id" TEXT NOT NULL,
    "questionnaireTemplateId" TEXT NOT NULL,
    "subjectId" TEXT NOT NULL,
    "visitId" TEXT,
    "status" "QuestionnaireStatus" NOT NULL,
    "responses" JSONB NOT NULL,
    "submittedByUserId" TEXT,
    "submittedAt" TIMESTAMP(3),
    "reviewedByUserId" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "QuestionnaireResponse_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SafetyEvent" (
    "id" TEXT NOT NULL,
    "subjectId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "onsetAt" TIMESTAMP(3) NOT NULL,
    "description" TEXT NOT NULL,
    "severity" "RiskLevel" NOT NULL,
    "status" "SafetyEventStatus" NOT NULL,
    "isSerious" BOOLEAN NOT NULL DEFAULT false,
    "aiSuggested" BOOLEAN NOT NULL DEFAULT false,
    "createdByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SafetyEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SafetyFollowUp" (
    "id" TEXT NOT NULL,
    "safetyEventId" TEXT NOT NULL,
    "followUpAt" TIMESTAMP(3) NOT NULL,
    "outcome" TEXT NOT NULL,
    "recordedByUserId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SafetyFollowUp_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RiskSignal" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "level" "RiskLevel" NOT NULL,
    "type" TEXT NOT NULL,
    "objectType" TEXT NOT NULL,
    "objectId" TEXT NOT NULL,
    "subjectId" TEXT,
    "trigger" TEXT NOT NULL,
    "suggestion" TEXT,
    "ownerUserId" TEXT,
    "deadline" TIMESTAMP(3),
    "status" "RiskStatus" NOT NULL,
    "aiOutputId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RiskSignal_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RiskHandlingRecord" (
    "id" TEXT NOT NULL,
    "riskSignalId" TEXT NOT NULL,
    "actorUserId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "fromStatus" "RiskStatus" NOT NULL,
    "toStatus" "RiskStatus" NOT NULL,
    "reason" TEXT,
    "at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RiskHandlingRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DrugShipment" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "siteId" TEXT NOT NULL,
    "subjectId" TEXT,
    "batchNumber" TEXT NOT NULL,
    "dispatchedAt" TIMESTAMP(3) NOT NULL,
    "receivedAt" TIMESTAMP(3),
    "temperatureLog" JSONB NOT NULL,

    CONSTRAINT "DrugShipment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SampleTransfer" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "subjectId" TEXT NOT NULL,
    "visitId" TEXT,
    "sampleType" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "collectedAt" TIMESTAMP(3),
    "transferredAt" TIMESTAMP(3),

    CONSTRAINT "SampleTransfer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReportDraft" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "status" "ReportStatus" NOT NULL,
    "sourceSnapshotId" TEXT,
    "generatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "confirmedAt" TIMESTAMP(3),
    "exportedAt" TIMESTAMP(3),

    CONSTRAINT "ReportDraft_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ExportRecord" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "objectType" TEXT NOT NULL,
    "objectIds" JSONB NOT NULL,
    "format" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "exportedByUserId" TEXT NOT NULL,
    "exportedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ExportRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Document" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "currentVersionId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "uploadedByUserId" TEXT,

    CONSTRAINT "Document_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DocumentVersion" (
    "id" TEXT NOT NULL,
    "documentId" TEXT NOT NULL,
    "version" TEXT NOT NULL,
    "fileUrl" TEXT NOT NULL,
    "sha256" TEXT NOT NULL,
    "uploadedByUserId" TEXT NOT NULL,
    "uploadedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DocumentVersion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AIConfig" (
    "id" TEXT NOT NULL,
    "projectId" TEXT,
    "provider" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "temperature" DOUBLE PRECISION NOT NULL DEFAULT 0.2,
    "maxTokens" INTEGER,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AIConfig_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PromptTemplate" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "version" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "variables" JSONB NOT NULL,
    "outputKind" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PromptTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AICallLog" (
    "id" TEXT NOT NULL,
    "aiOutputId" TEXT,
    "promptTemplateId" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "inputHash" TEXT NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL,
    "finishedAt" TIMESTAMP(3),
    "statusCode" INTEGER,
    "errorMessage" TEXT,
    "userId" TEXT,

    CONSTRAINT "AICallLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AIOutput" (
    "id" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "subjectId" TEXT,
    "payload" JSONB NOT NULL,
    "confidence" DOUBLE PRECISION NOT NULL,
    "confidenceLevel" TEXT NOT NULL,
    "status" "HumanConfirmationStatus" NOT NULL DEFAULT 'Pending',
    "generatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "confirmedByUserId" TEXT,
    "confirmedAt" TIMESTAMP(3),
    "notes" TEXT,
    "rejectionReason" TEXT,
    "promptTemplateId" TEXT,
    "model" TEXT NOT NULL,
    "modelVersion" TEXT NOT NULL,
    "inputHash" TEXT NOT NULL,
    "knowledgeBaseRefs" JSONB NOT NULL,

    CONSTRAINT "AIOutput_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditEvent" (
    "id" TEXT NOT NULL,
    "actorUserId" TEXT NOT NULL,
    "actorRole" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "objectType" TEXT NOT NULL,
    "objectId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "beforeValue" JSONB,
    "afterValue" JSONB,
    "reason" TEXT,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "device" TEXT,
    "requestId" TEXT,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "RoleAssignment_userId_idx" ON "RoleAssignment"("userId");

-- CreateIndex
CREATE INDEX "RoleAssignment_projectId_idx" ON "RoleAssignment"("projectId");

-- CreateIndex
CREATE UNIQUE INDEX "RoleAssignment_userId_projectId_siteId_role_key" ON "RoleAssignment"("userId", "projectId", "siteId", "role");

-- CreateIndex
CREATE UNIQUE INDEX "Project_code_key" ON "Project"("code");

-- CreateIndex
CREATE UNIQUE INDEX "Site_projectId_code_key" ON "Site"("projectId", "code");

-- CreateIndex
CREATE INDEX "Subject_projectId_status_idx" ON "Subject"("projectId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "Subject_projectId_subjectCode_key" ON "Subject"("projectId", "subjectCode");

-- CreateIndex
CREATE UNIQUE INDEX "ProtocolVersion_projectId_version_key" ON "ProtocolVersion"("projectId", "version");

-- CreateIndex
CREATE UNIQUE INDEX "ConsentDocument_projectId_version_key" ON "ConsentDocument"("projectId", "version");

-- CreateIndex
CREATE UNIQUE INDEX "RemoteVisitRecord_visitId_key" ON "RemoteVisitRecord"("visitId");

-- CreateIndex
CREATE UNIQUE INDEX "QuestionnaireTemplate_projectId_code_version_key" ON "QuestionnaireTemplate"("projectId", "code", "version");

-- CreateIndex
CREATE INDEX "RiskSignal_projectId_status_idx" ON "RiskSignal"("projectId", "status");

-- CreateIndex
CREATE INDEX "RiskSignal_level_status_idx" ON "RiskSignal"("level", "status");

-- CreateIndex
CREATE INDEX "RiskSignal_objectType_objectId_idx" ON "RiskSignal"("objectType", "objectId");

-- CreateIndex
CREATE INDEX "DrugShipment_projectId_siteId_idx" ON "DrugShipment"("projectId", "siteId");

-- CreateIndex
CREATE UNIQUE INDEX "Document_projectId_title_key" ON "Document"("projectId", "title");

-- CreateIndex
CREATE UNIQUE INDEX "DocumentVersion_documentId_version_key" ON "DocumentVersion"("documentId", "version");

-- CreateIndex
CREATE UNIQUE INDEX "PromptTemplate_code_version_key" ON "PromptTemplate"("code", "version");

-- CreateIndex
CREATE INDEX "AIOutput_projectId_status_idx" ON "AIOutput"("projectId", "status");

-- CreateIndex
CREATE INDEX "AIOutput_kind_status_idx" ON "AIOutput"("kind", "status");

-- CreateIndex
CREATE INDEX "AuditEvent_projectId_timestamp_idx" ON "AuditEvent"("projectId", "timestamp");

-- CreateIndex
CREATE INDEX "AuditEvent_objectType_objectId_idx" ON "AuditEvent"("objectType", "objectId");

-- CreateIndex
CREATE INDEX "AuditEvent_actorUserId_timestamp_idx" ON "AuditEvent"("actorUserId", "timestamp");

-- AddForeignKey
ALTER TABLE "RoleAssignment" ADD CONSTRAINT "RoleAssignment_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RoleAssignment" ADD CONSTRAINT "RoleAssignment_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RoleAssignment" ADD CONSTRAINT "RoleAssignment_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "Site"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Site" ADD CONSTRAINT "Site_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Subject" ADD CONSTRAINT "Subject_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Subject" ADD CONSTRAINT "Subject_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "Site"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Subject" ADD CONSTRAINT "Subject_ownerUserId_fkey" FOREIGN KEY ("ownerUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SubjectSensitiveIdentity" ADD CONSTRAINT "SubjectSensitiveIdentity_subjectId_fkey" FOREIGN KEY ("subjectId") REFERENCES "Subject"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProtocolVersion" ADD CONSTRAINT "ProtocolVersion_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AIProtocolParseResult" ADD CONSTRAINT "AIProtocolParseResult_protocolVersionId_fkey" FOREIGN KEY ("protocolVersionId") REFERENCES "ProtocolVersion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AIProtocolParseResult" ADD CONSTRAINT "AIProtocolParseResult_aiOutputId_fkey" FOREIGN KEY ("aiOutputId") REFERENCES "AIOutput"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConsentDocument" ADD CONSTRAINT "ConsentDocument_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConsentTask" ADD CONSTRAINT "ConsentTask_subjectId_fkey" FOREIGN KEY ("subjectId") REFERENCES "Subject"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConsentTask" ADD CONSTRAINT "ConsentTask_consentDocumentId_fkey" FOREIGN KEY ("consentDocumentId") REFERENCES "ConsentDocument"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SignatureRecord" ADD CONSTRAINT "SignatureRecord_consentTaskId_fkey" FOREIGN KEY ("consentTaskId") REFERENCES "ConsentTask"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SignatureRecord" ADD CONSTRAINT "SignatureRecord_signerUserId_fkey" FOREIGN KEY ("signerUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Visit" ADD CONSTRAINT "Visit_subjectId_fkey" FOREIGN KEY ("subjectId") REFERENCES "Subject"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Visit" ADD CONSTRAINT "Visit_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Visit" ADD CONSTRAINT "Visit_submittedByUserId_fkey" FOREIGN KEY ("submittedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Visit" ADD CONSTRAINT "Visit_closedByUserId_fkey" FOREIGN KEY ("closedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VisitTask" ADD CONSTRAINT "VisitTask_visitId_fkey" FOREIGN KEY ("visitId") REFERENCES "Visit"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RemoteVisitRecord" ADD CONSTRAINT "RemoteVisitRecord_visitId_fkey" FOREIGN KEY ("visitId") REFERENCES "Visit"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuestionnaireTemplate" ADD CONSTRAINT "QuestionnaireTemplate_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuestionnaireResponse" ADD CONSTRAINT "QuestionnaireResponse_questionnaireTemplateId_fkey" FOREIGN KEY ("questionnaireTemplateId") REFERENCES "QuestionnaireTemplate"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuestionnaireResponse" ADD CONSTRAINT "QuestionnaireResponse_subjectId_fkey" FOREIGN KEY ("subjectId") REFERENCES "Subject"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuestionnaireResponse" ADD CONSTRAINT "QuestionnaireResponse_visitId_fkey" FOREIGN KEY ("visitId") REFERENCES "Visit"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuestionnaireResponse" ADD CONSTRAINT "QuestionnaireResponse_submittedByUserId_fkey" FOREIGN KEY ("submittedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SafetyEvent" ADD CONSTRAINT "SafetyEvent_subjectId_fkey" FOREIGN KEY ("subjectId") REFERENCES "Subject"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SafetyEvent" ADD CONSTRAINT "SafetyEvent_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SafetyEvent" ADD CONSTRAINT "SafetyEvent_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SafetyFollowUp" ADD CONSTRAINT "SafetyFollowUp_safetyEventId_fkey" FOREIGN KEY ("safetyEventId") REFERENCES "SafetyEvent"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SafetyFollowUp" ADD CONSTRAINT "SafetyFollowUp_recordedByUserId_fkey" FOREIGN KEY ("recordedByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RiskSignal" ADD CONSTRAINT "RiskSignal_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RiskSignal" ADD CONSTRAINT "RiskSignal_ownerUserId_fkey" FOREIGN KEY ("ownerUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RiskSignal" ADD CONSTRAINT "RiskSignal_aiOutputId_fkey" FOREIGN KEY ("aiOutputId") REFERENCES "AIOutput"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RiskSignal" ADD CONSTRAINT "RiskSignal_subjectId_fkey" FOREIGN KEY ("subjectId") REFERENCES "Subject"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RiskHandlingRecord" ADD CONSTRAINT "RiskHandlingRecord_riskSignalId_fkey" FOREIGN KEY ("riskSignalId") REFERENCES "RiskSignal"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RiskHandlingRecord" ADD CONSTRAINT "RiskHandlingRecord_actorUserId_fkey" FOREIGN KEY ("actorUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DrugShipment" ADD CONSTRAINT "DrugShipment_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DrugShipment" ADD CONSTRAINT "DrugShipment_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "Site"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DrugShipment" ADD CONSTRAINT "DrugShipment_subjectId_fkey" FOREIGN KEY ("subjectId") REFERENCES "Subject"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SampleTransfer" ADD CONSTRAINT "SampleTransfer_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SampleTransfer" ADD CONSTRAINT "SampleTransfer_subjectId_fkey" FOREIGN KEY ("subjectId") REFERENCES "Subject"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReportDraft" ADD CONSTRAINT "ReportDraft_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExportRecord" ADD CONSTRAINT "ExportRecord_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExportRecord" ADD CONSTRAINT "ExportRecord_exportedByUserId_fkey" FOREIGN KEY ("exportedByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Document" ADD CONSTRAINT "Document_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Document" ADD CONSTRAINT "Document_uploadedByUserId_fkey" FOREIGN KEY ("uploadedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DocumentVersion" ADD CONSTRAINT "DocumentVersion_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "Document"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DocumentVersion" ADD CONSTRAINT "DocumentVersion_uploadedByUserId_fkey" FOREIGN KEY ("uploadedByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AIConfig" ADD CONSTRAINT "AIConfig_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AICallLog" ADD CONSTRAINT "AICallLog_promptTemplateId_fkey" FOREIGN KEY ("promptTemplateId") REFERENCES "PromptTemplate"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AICallLog" ADD CONSTRAINT "AICallLog_aiOutputId_fkey" FOREIGN KEY ("aiOutputId") REFERENCES "AIOutput"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AICallLog" ADD CONSTRAINT "AICallLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AIOutput" ADD CONSTRAINT "AIOutput_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AIOutput" ADD CONSTRAINT "AIOutput_promptTemplateId_fkey" FOREIGN KEY ("promptTemplateId") REFERENCES "PromptTemplate"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AIOutput" ADD CONSTRAINT "AIOutput_confirmedByUserId_fkey" FOREIGN KEY ("confirmedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditEvent" ADD CONSTRAINT "AuditEvent_actorUserId_fkey" FOREIGN KEY ("actorUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditEvent" ADD CONSTRAINT "AuditEvent_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
