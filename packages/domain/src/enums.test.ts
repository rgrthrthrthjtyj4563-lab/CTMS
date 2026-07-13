import { describe, it, expect } from "vitest";
import {
  ProtocolParseStatus,
  ProtocolParseStatusSchema,
  SubjectStatus,
  SubjectStatusSchema,
  VisitStatus,
  VisitStatusSchema,
  ConsentStatus,
  ConsentStatusSchema,
  QuestionnaireStatus,
  QuestionnaireStatusSchema,
  SafetyEventStatus,
  SafetyEventStatusSchema,
  RiskLevel,
  RiskLevelSchema,
  RiskStatus,
  RiskStatusSchema,
  ReportStatus,
  ReportStatusSchema,
  HumanConfirmationStatus,
  HumanConfirmationStatusSchema,
  canTransition,
  VISIT_STATUS_TRANSITIONS,
  SUBJECT_STATUS_TRANSITIONS,
  CONSENT_STATUS_TRANSITIONS,
  QUESTIONNAIRE_STATUS_TRANSITIONS,
  SAFETY_EVENT_TRANSITIONS,
  RISK_STATUS_TRANSITIONS,
  REPORT_STATUS_TRANSITIONS,
} from "./enums.js";

describe("ProtocolParseStatus", () => {
  it("accepts canonical values", () => {
    expect(ProtocolParseStatusSchema.parse("Uploaded")).toBe("Uploaded");
    expect(ProtocolParseStatusSchema.parse("Superseded")).toBe("Superseded");
  });

  it("rejects unknown values", () => {
    expect(() => ProtocolParseStatusSchema.parse("queued")).toThrow();
    expect(() => ProtocolParseStatusSchema.parse("")).toThrow();
  });
});

describe("SubjectStatus", () => {
  it("contains the eight required values", () => {
    expect(Object.values(SubjectStatus).sort()).toEqual(
      [
        "PreScreening",
        "Consenting",
        "Screening",
        "Enrolled",
        "Active",
        "Completed",
        "Withdrawn",
        "ScreenFailed",
      ].sort(),
    );
  });

  it("rejects invalid lifecycle", () => {
    expect(() => SubjectStatusSchema.parse("ActiveTreatment")).toThrow();
  });

  it("allows PreScreening -> Consenting and forbids jump to Active", () => {
    expect(canTransition(SUBJECT_STATUS_TRANSITIONS, SubjectStatus.PreScreening, SubjectStatus.Consenting)).toBe(true);
    expect(canTransition(SUBJECT_STATUS_TRANSITIONS, SubjectStatus.PreScreening, SubjectStatus.Active)).toBe(false);
  });

  it("Completed is terminal", () => {
    expect(SUBJECT_STATUS_TRANSITIONS.Completed).toEqual([]);
  });
});

describe("VisitStatus", () => {
  it("rejects invalid states", () => {
    expect(() => VisitStatusSchema.parse("Late")).toThrow();
  });

  it("Scheduled can move to InProgress, Missed, OutOfWindow", () => {
    expect(canTransition(VISIT_STATUS_TRANSITIONS, VisitStatus.Scheduled, VisitStatus.InProgress)).toBe(true);
    expect(canTransition(VISIT_STATUS_TRANSITIONS, VisitStatus.Scheduled, VisitStatus.Missed)).toBe(true);
    expect(canTransition(VISIT_STATUS_TRANSITIONS, VisitStatus.Scheduled, VisitStatus.Completed)).toBe(false);
  });

  it("Completed is terminal", () => {
    expect(VISIT_STATUS_TRANSITIONS.Completed).toEqual([]);
  });
});

describe("ConsentStatus", () => {
  it("contains the eight required values", () => {
    expect(Object.values(ConsentStatus).sort()).toEqual(
      [
        "NotStarted",
        "Reading",
        "ComprehensionPending",
        "SubjectSigned",
        "InvestigatorSigned",
        "Completed",
        "ReConsentRequired",
        "Withdrawn",
      ].sort(),
    );
  });

  it("Completed -> ReConsentRequired is allowed", () => {
    expect(canTransition(CONSENT_STATUS_TRANSITIONS, ConsentStatus.Completed, ConsentStatus.ReConsentRequired)).toBe(true);
  });
});

describe("QuestionnaireStatus", () => {
  it("contains all six values", () => {
    expect(Object.values(QuestionnaireStatus).sort()).toEqual(
      ["Scheduled", "InProgress", "Submitted", "Missed", "Late", "Reviewed"].sort(),
    );
  });

  it("Scheduled -> InProgress allowed, Submitted -> Scheduled forbidden", () => {
    expect(canTransition(QUESTIONNAIRE_STATUS_TRANSITIONS, QuestionnaireStatus.Scheduled, QuestionnaireStatus.InProgress)).toBe(true);
    expect(canTransition(QUESTIONNAIRE_STATUS_TRANSITIONS, QuestionnaireStatus.Submitted, QuestionnaireStatus.Scheduled)).toBe(false);
  });

  it("Reviewed is terminal", () => {
    expect(QUESTIONNAIRE_STATUS_TRANSITIONS.Reviewed).toEqual([]);
  });
});

describe("SafetyEventStatus", () => {
  it("contains the seven required values", () => {
    expect(Object.values(SafetyEventStatus).sort()).toEqual(
      ["Draft", "InvestigatorReview", "ConfirmedAE", "ConfirmedSAE", "Reported", "FollowUp", "Closed"].sort(),
    );
  });

  it("Draft must move to InvestigatorReview", () => {
    expect(canTransition(SAFETY_EVENT_TRANSITIONS, SafetyEventStatus.Draft, SafetyEventStatus.InvestigatorReview)).toBe(true);
    expect(canTransition(SAFETY_EVENT_TRANSITIONS, SafetyEventStatus.Draft, SafetyEventStatus.Closed)).toBe(false);
  });

  it("Closed is terminal", () => {
    expect(SAFETY_EVENT_TRANSITIONS.Closed).toEqual([]);
  });
});

describe("RiskLevel", () => {
  it("contains the four required values", () => {
    expect(Object.values(RiskLevel).sort()).toEqual(["Low", "Medium", "High", "Critical"].sort());
  });

  it("rejects lowercase", () => {
    expect(() => RiskLevelSchema.parse("high")).toThrow();
  });
});

describe("RiskStatus", () => {
  it("Open -> Assigned -> InProgress -> Resolved -> Closed is allowed", () => {
    expect(canTransition(RISK_STATUS_TRANSITIONS, RiskStatus.Open, RiskStatus.Assigned)).toBe(true);
    expect(canTransition(RISK_STATUS_TRANSITIONS, RiskStatus.Assigned, RiskStatus.InProgress)).toBe(true);
    expect(canTransition(RISK_STATUS_TRANSITIONS, RiskStatus.InProgress, RiskStatus.Resolved)).toBe(true);
    expect(canTransition(RISK_STATUS_TRANSITIONS, RiskStatus.Resolved, RiskStatus.Closed)).toBe(true);
  });

  it("Closed is terminal", () => {
    expect(RISK_STATUS_TRANSITIONS.Closed).toEqual([]);
  });
});

describe("ReportStatus", () => {
  it("Generating -> Draft -> UnderReview -> Confirmed -> Exported", () => {
    expect(canTransition(REPORT_STATUS_TRANSITIONS, ReportStatus.Generating, ReportStatus.Draft)).toBe(true);
    expect(canTransition(REPORT_STATUS_TRANSITIONS, ReportStatus.Draft, ReportStatus.UnderReview)).toBe(true);
    expect(canTransition(REPORT_STATUS_TRANSITIONS, ReportStatus.UnderReview, ReportStatus.Confirmed)).toBe(true);
    expect(canTransition(REPORT_STATUS_TRANSITIONS, ReportStatus.Confirmed, ReportStatus.Exported)).toBe(true);
  });

  it("Confirmed cannot go back to Draft", () => {
    expect(canTransition(REPORT_STATUS_TRANSITIONS, ReportStatus.Confirmed, ReportStatus.Draft)).toBe(false);
  });
});

describe("HumanConfirmationStatus", () => {
  it("contains all five required values", () => {
    expect(Object.values(HumanConfirmationStatus).sort()).toEqual(
      ["Pending", "Adopted", "EditedAdopted", "Rejected", "NeedsInvestigatorConfirmation"].sort(),
    );
  });

  it("rejects unknown", () => {
    expect(() => HumanConfirmationStatusSchema.parse("ignored")).toThrow();
  });
});