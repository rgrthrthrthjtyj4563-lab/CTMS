/**
 * M4A Subject channel smoke harness.
 *
 * Proves: Subject identity → my-tasks → ePRO submit → severe symptom →
 * risk visible to staff API. Requires seeded DB + API on PORT (default 4000).
 *
 * Usage:
 *   SUBJECT_ACTOR_ID=<user id> npm run smoke --workspace=apps/mobile
 */
const API_BASE = process.env.API_BASE ?? "http://localhost:4000";
const ACTOR_ID = process.env.SUBJECT_ACTOR_ID;

async function api<T>(
  path: string,
  init: RequestInit = {},
): Promise<{ status: number; body: T }> {
  const res = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers: {
      "content-type": "application/json",
      "x-actor-id": ACTOR_ID ?? "",
      ...(init.headers ?? {}),
    },
  });
  const body = (await res.json()) as T;
  return { status: res.status, body };
}

async function main(): Promise<void> {
  if (!ACTOR_ID) {
    console.error("Set SUBJECT_ACTOR_ID to a seeded Subject user id (subject-a@aic-dct.test).");
    process.exit(1);
  }

  console.log("M4A smoke — Subject channel @", API_BASE);

  const me = await api<{ subject: { subjectCode: string }; dataOrigin: string }>(
    "/api/subject/me",
  );
  if (me.status !== 200) throw new Error(`me failed: ${me.status}`);
  console.log("✓ /api/subject/me", me.body.subject.subjectCode, me.body.dataOrigin);

  const tasks = await api<{ total: number }>("/api/subject/my-tasks");
  if (tasks.status !== 200) throw new Error(`my-tasks failed: ${tasks.status}`);
  console.log("✓ /api/subject/my-tasks total=", tasks.body.total);

  const lists = await api<{ items: Array<{ id: string; status: string }> }>(
    "/api/subject/epro/responses",
  );
  if (lists.status !== 200) throw new Error(`epro list failed: ${lists.status}`);
  const draft = lists.body.items.find((i) => i.status === "Scheduled" || i.status === "InProgress");
  if (draft) {
    const save = await api(`/api/subject/epro/responses/${draft.id}`, {
      method: "PATCH",
      body: JSON.stringify({ responses: { physical: 20 } }),
    });
    if (save.status !== 200) throw new Error(`epro save failed: ${save.status}`);
    const submit = await api(`/api/subject/epro/responses/${draft.id}/submit`, {
      method: "POST",
      body: JSON.stringify({ responses: { physical: 20 } }),
    });
    if (submit.status !== 200) throw new Error(`epro submit failed: ${submit.status}`);
    console.log("✓ ePRO draft → submit", draft.id);
  } else {
    console.log("· skip ePRO submit (no open task)");
  }

  const symptom = await api<{ id: string; severe: boolean; riskSignalId: string | null }>(
    "/api/subject/symptom-reports",
    {
      method: "POST",
      body: JSON.stringify({
        discomfortType: "恶心",
        onsetAt: new Date().toISOString(),
        severity: "High",
        soughtMedicalCare: true,
        description: "M4A smoke — 中度恶心伴就医",
      }),
    },
  );
  if (symptom.status !== 200) throw new Error(`symptom failed: ${symptom.status}`);
  console.log("✓ symptom report", symptom.body.id, "severe=", symptom.body.severe);

  console.log("M4A smoke complete — data origin: SubjectSelfReport");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});