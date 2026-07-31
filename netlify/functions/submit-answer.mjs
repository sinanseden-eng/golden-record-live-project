import { adminServices, requireUser } from "./_shared/firebase-admin.mjs";
import { bodyJson, cleanText, json, errorMessage } from "./_shared/http.mjs";
import { checkSubmission, evidenceForStation, INVESTIGATION_STATIONS, stationProgress } from "./_shared/game-logic.mjs";

const publicResponse = payload => JSON.parse(JSON.stringify(payload || {}));

export default async function handler(req) {
  if (req.method !== "POST") return json({ error: "Method not allowed." }, 405);
  try {
    const user = await requireUser(req, "student");
    const body = await bodyJson(req);
    const station = cleanText(body.station, 12);
    if (![...INVESTIGATION_STATIONS, "final"].includes(station)) return json({ error: "Unknown station." }, 400);

    const { db } = adminServices();
    const sessionCode = user.sessionCode;
    const teamId = user.teamId;
    const [metaSnap, groupSnap] = await Promise.all([
      db.ref(`sessions/${sessionCode}/meta`).get(),
      db.ref(`sessions/${sessionCode}/groups/${teamId}`).get()
    ]);
    if (!metaSnap.exists()) return json({ error: "Session not found." }, 404);
    if (!groupSnap.exists()) return json({ error: "Group not found." }, 404);
    const meta = metaSnap.val();
    const group = groupSnap.val();
    if (meta.status !== "active") return json({ error: "The session is closed." }, 403);
    if (meta.paused) return json({ error: "The teacher has paused the mission." }, 423);

    if (station !== "final" && station !== group.assignedStation) {
      return json({ error: "This station is assigned to another investigation team." }, 403);
    }
    if (station === "final") {
      const sharedSnap = await db.ref(`sessions/${sessionCode}/shared/stations`).get();
      const sharedStations = sharedSnap.val() || {};
      if (INVESTIGATION_STATIONS.some(key => sharedStations[key]?.status !== "approved")) {
        return json({ error: "The final case unlocks after all six station reports are approved." }, 409);
      }
    }

    const payload = publicResponse(body.payload);
    const result = checkSubmission(station, payload);
    const now = Date.now();
    const previousStatus = group.stations?.[station]?.status;
    const status = result.accepted ? (result.autoApprove ? "approved" : "pending") : "revision";
    const stationData = {
      status,
      submittedAt: now,
      updatedAt: now,
      response: payload,
      automaticFeedback: result.feedback,
      automaticChecks: result.details || {},
      teacherFeedback: status === "revision" ? result.feedback : ""
    };

    let scoreDelta = 0;
    if (status === "approved") {
      if (previousStatus !== "approved") scoreDelta = station === "final" ? 15 : 10;
      if (evidenceForStation[station]) {
        stationData.code = evidenceForStation[station].code;
        stationData.evidence = evidenceForStation[station].evidence;
        stationData.targets = evidenceForStation[station].targets;
        stationData.approvedAt = now;
      }
    }

    const nextGroup = JSON.parse(JSON.stringify(group));
    nextGroup.stations ||= {};
    nextGroup.stations[station] = stationData;
    nextGroup.score = Math.max(0, Number(nextGroup.score || 0) + scoreDelta);
    nextGroup.lastSeen = now;
    nextGroup.latestStation = station;
    if (status === "approved" && evidenceForStation[station]) {
      nextGroup.targets ||= {};
      for (const target of evidenceForStation[station].targets) nextGroup.targets[target] = true;
    }
    Object.assign(nextGroup, stationProgress(nextGroup));
    await db.ref(`sessions/${sessionCode}/groups/${teamId}`).set(nextGroup);

    return json({ station, status, feedback: result.feedback, approved: status === "approved", score: nextGroup.score, progress: nextGroup.progress });
  } catch (error) {
    return json({ error: error.message || errorMessage(error) }, error.status || 500);
  }
}
