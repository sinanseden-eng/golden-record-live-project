import { adminServices, requireUser } from "./_shared/firebase-admin.mjs";
import { bodyJson, cleanText, json, errorMessage } from "./_shared/http.mjs";
import { checkSubmission, evidenceForStation, stationProgress } from "./_shared/game-logic.mjs";

const publicResponse = payload => {
  const clone = JSON.parse(JSON.stringify(payload || {}));
  return clone;
};

export default async function handler(req) {
  if (req.method !== "POST") return json({ error: "Method not allowed." }, 405);
  try {
    const user = await requireUser(req, "student");
    const body = await bodyJson(req);
    const station = cleanText(body.station, 12);
    if (!["s1", "s2", "s3", "s4", "final"].includes(station)) return json({ error: "Unknown station." }, 400);
    const { db } = adminServices();
    const sessionCode = user.sessionCode;
    const teamId = user.teamId;
    const metaSnap = await db.ref(`sessions/${sessionCode}/meta`).get();
    if (!metaSnap.exists()) return json({ error: "Session not found." }, 404);
    const meta = metaSnap.val();
    if (meta.status !== "active") return json({ error: "The session is closed." }, 403);
    if (meta.paused) return json({ error: "The teacher has paused the mission." }, 423);

    const groupRef = db.ref(`sessions/${sessionCode}/groups/${teamId}`);
    const groupSnap = await groupRef.get();
    if (!groupSnap.exists()) return json({ error: "Group not found." }, 404);
    const group = groupSnap.val();
    if (station === "final" && ["s1", "s2", "s3", "s4"].some(k => group.stations?.[k]?.status !== "approved")) {
      return json({ error: "Unlock all four stations before submitting the final case." }, 409);
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
    if (["s1", "s2", "s3", "s4"].every(k => nextGroup.stations?.[k]?.status === "approved") && nextGroup.stations.final?.status === "locked") {
      nextGroup.stations.final = { status: "not-started" };
    }
    Object.assign(nextGroup, stationProgress(nextGroup));
    await groupRef.set(nextGroup);

    return json({
      station,
      status,
      feedback: result.feedback,
      approved: status === "approved",
      score: nextGroup.score,
      progress: nextGroup.progress
    });
  } catch (error) {
    return json({ error: error.message || errorMessage(error) }, error.status || 500);
  }
}
