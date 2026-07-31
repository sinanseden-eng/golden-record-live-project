import { adminServices, requireUser } from "./_shared/firebase-admin.mjs";
import { bodyJson, cleanText, json, errorMessage } from "./_shared/http.mjs";
import { evidenceForStation, INVESTIGATION_STATIONS, stationProgress } from "./_shared/game-logic.mjs";

export default async function handler(req) {
  if (req.method !== "POST") return json({ error: "Method not allowed." }, 405);
  try {
    const user = await requireUser(req, "teacher");
    const body = await bodyJson(req);
    const teamId = cleanText(body.teamId, 60).replace(/[^a-zA-Z0-9_-]/g, "");
    const station = cleanText(body.station, 12);
    const decision = cleanText(body.decision, 12);
    const feedback = cleanText(body.feedback, 800);
    if (![...INVESTIGATION_STATIONS, "final"].includes(station)) return json({ error: "This station is not teacher-reviewed." }, 400);
    if (!["approve", "revision"].includes(decision)) return json({ error: "Choose approve or revision." }, 400);

    const { db } = adminServices();
    const sessionCode = user.sessionCode;
    const groupRef = db.ref(`sessions/${sessionCode}/groups/${teamId}`);
    const snap = await groupRef.get();
    if (!snap.exists()) return json({ error: "Group not found." }, 404);
    const group = snap.val();
    const existing = group.stations?.[station];
    if (!existing || !["pending", "revision"].includes(existing.status)) return json({ error: "There is no reviewable submission for that station." }, 409);
    if (station !== "final" && station !== group.assignedStation) return json({ error: "That group is not assigned to this station." }, 409);

    const now = Date.now();
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
      group.score = Number(group.score || 0) + (station === "final" ? 15 : 10);
    }

    group.lastSeen = now;
    group.latestStation = station;
    Object.assign(group, stationProgress(group));

    const updates = {};
    updates[`sessions/${sessionCode}/groups/${teamId}`] = group;

    if (station !== "final") {
      updates[`sessions/${sessionCode}/shared/stations/${station}`] = {
        status: decision === "approve" ? "approved" : "revision",
        teamId,
        teamName: group.displayName,
        targets: decision === "approve" ? evidenceForStation[station].targets : [],
        reviewedAt: now,
        updatedAt: now
      };
      if (decision === "approve") {
        for (const [key, value] of Object.entries(evidenceForStation[station].evidence)) {
          updates[`sessions/${sessionCode}/shared/evidence/${key}`] = {
            station,
            text: value,
            code: evidenceForStation[station].code,
            teamId,
            teamName: group.displayName,
            approvedAt: now
          };
        }
      }
      updates[`sessions/${sessionCode}/shared/updatedAt`] = now;
    }

    await db.ref().update(updates);

    if (station !== "final" && decision === "approve") {
      const [sharedSnap, groupsSnap] = await Promise.all([
        db.ref(`sessions/${sessionCode}/shared/stations`).get(),
        db.ref(`sessions/${sessionCode}/groups`).get()
      ]);
      const sharedStations = sharedSnap.val() || {};
      if (INVESTIGATION_STATIONS.every(key => sharedStations[key]?.status === "approved")) {
        const allGroups = groupsSnap.val() || {};
        const unlocks = {};
        for (const [id, current] of Object.entries(allGroups)) {
          if (current.stations?.final?.status === "locked") {
            unlocks[`sessions/${sessionCode}/groups/${id}/stations/final`] = { status: "not-started", unlockedAt: now };
          }
        }
        if (Object.keys(unlocks).length) await db.ref().update(unlocks);
      }
    }

    return json({ teamId, station, status: existing.status, score: group.score, progress: group.progress });
  } catch (error) {
    return json({ error: error.message || errorMessage(error) }, error.status || 500);
  }
}
