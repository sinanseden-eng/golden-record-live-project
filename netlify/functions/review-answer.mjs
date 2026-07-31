import { adminServices, requireUser } from "./_shared/firebase-admin.mjs";
import { bodyJson, cleanText, json, errorMessage } from "./_shared/http.mjs";
import { evidenceForStation, stationProgress } from "./_shared/game-logic.mjs";

export default async function handler(req) {
  if (req.method !== "POST") return json({ error: "Method not allowed." }, 405);
  try {
    const user = await requireUser(req, "teacher");
    const body = await bodyJson(req);
    const teamId = cleanText(body.teamId, 60).replace(/[^a-zA-Z0-9_-]/g, "");
    const station = cleanText(body.station, 12);
    const decision = cleanText(body.decision, 12);
    const feedback = cleanText(body.feedback, 800);
    if (!["s1", "s2", "s3", "final"].includes(station)) return json({ error: "This station is not teacher-reviewed." }, 400);
    if (!["approve", "revision"].includes(decision)) return json({ error: "Choose approve or revision." }, 400);

    const { db } = adminServices();
    const ref = db.ref(`sessions/${user.sessionCode}/groups/${teamId}`);
    const snap = await ref.get();
    if (!snap.exists()) return json({ error: "Group not found." }, 404);
    const group = snap.val();
    const existing = group.stations?.[station];
    if (!existing || !["pending", "revision"].includes(existing.status)) return json({ error: "There is no reviewable submission for that station." }, 409);

    const now = Date.now();
    const wasApproved = existing.status === "approved";
    existing.status = decision === "approve" ? "approved" : "revision";
    existing.teacherFeedback = feedback || (decision === "approve" ? "Approved by the teacher." : "Please revise and resubmit.");
    existing.reviewedAt = now;
    existing.updatedAt = now;
    if (decision === "approve") {
      existing.approvedAt = now;
      if (evidenceForStation[station]) {
        existing.code = evidenceForStation[station].code;
        existing.evidence = evidenceForStation[station].evidence;
        existing.targets = evidenceForStation[station].targets;
        group.targets ||= {};
        for (const target of evidenceForStation[station].targets) group.targets[target] = true;
      }
      if (!wasApproved) group.score = Number(group.score || 0) + (station === "final" ? 15 : 10);
    }
    group.lastSeen = now;
    group.latestStation = station;
    if (["s1", "s2", "s3", "s4"].every(k => group.stations?.[k]?.status === "approved") && group.stations.final?.status === "locked") {
      group.stations.final = { status: "not-started" };
    }
    Object.assign(group, stationProgress(group));
    await ref.set(group);
    return json({ teamId, station, status: existing.status, score: group.score, progress: group.progress });
  } catch (error) {
    return json({ error: error.message || errorMessage(error) }, error.status || 500);
  }
}
