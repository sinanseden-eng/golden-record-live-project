import { adminServices, requireUser } from "./_shared/firebase-admin.mjs";
import { bodyJson, cleanText, json, errorMessage } from "./_shared/http.mjs";

export default async function handler(req) {
  if (req.method !== "POST") return json({ error: "Method not allowed." }, 405);
  try {
    const user = await requireUser(req, "teacher");
    const body = await bodyJson(req);
    const action = cleanText(body.action, 30);
    const { db } = adminServices();
    const base = `sessions/${user.sessionCode}`;
    const now = Date.now();

    if (action === "set-paused") {
      const metaRef = db.ref(`${base}/meta`);
      const snap = await metaRef.get();
      if (!snap.exists()) return json({ error: "Session not found." }, 404);
      const meta = snap.val();
      const shouldPause = Boolean(body.value);
      let remaining = Number(meta.remainingSeconds ?? Number(meta.durationMinutes || 60) * 60);
      if (shouldPause && !meta.paused && meta.timerStartedAt) {
        remaining = Math.max(0, remaining - Math.floor((now - Number(meta.timerStartedAt)) / 1000));
        await metaRef.update({ paused: true, timerStartedAt: null, remainingSeconds: remaining, updatedAt: now });
      } else if (!shouldPause && meta.paused) {
        await metaRef.update({ paused: false, timerStartedAt: now, remainingSeconds: remaining, updatedAt: now });
      }
    } else if (action === "set-hide-codes") {
      await db.ref(`${base}/meta`).update({ hideCodes: Boolean(body.value), updatedAt: now });
    } else if (action === "broadcast") {
      await db.ref(`${base}/broadcast`).set({ message: cleanText(body.message, 300), updatedAt: now });
    } else if (action === "close-session") {
      const metaRef = db.ref(`${base}/meta`);
      const snap = await metaRef.get();
      if (!snap.exists()) return json({ error: "Session not found." }, 404);
      const meta = snap.val();
      let remaining = Number(meta.remainingSeconds ?? Number(meta.durationMinutes || 60) * 60);
      if (!meta.paused && meta.timerStartedAt) remaining = Math.max(0, remaining - Math.floor((now - Number(meta.timerStartedAt)) / 1000));
      await metaRef.update({ status: "closed", paused: true, timerStartedAt: null, remainingSeconds: remaining, updatedAt: now });
    } else if (action === "reopen-session") {
      await db.ref(`${base}/meta`).update({ status: "active", paused: true, timerStartedAt: null, updatedAt: now });
    } else if (action === "reset-group") {
      const teamId = cleanText(body.teamId, 60).replace(/[^a-zA-Z0-9_-]/g, "");
      const groupRef = db.ref(`${base}/groups/${teamId}`);
      const snap = await groupRef.get();
      if (!snap.exists()) return json({ error: "Group not found." }, 404);
      const group = snap.val();
      group.score = 0; group.progress = 0; group.completed = false; group.targets = {}; group.latestStation = "s1";
      group.stations = { s1:{status:"not-started"}, s2:{status:"not-started"}, s3:{status:"not-started"}, s4:{status:"not-started"}, final:{status:"locked"} };
      group.updatedAt = now;
      await groupRef.set(group);
    } else if (action === "adjust-score") {
      const teamId = cleanText(body.teamId, 60).replace(/[^a-zA-Z0-9_-]/g, "");
      const delta = Math.max(-50, Math.min(50, Number(body.delta) || 0));
      const scoreRef = db.ref(`${base}/groups/${teamId}/score`);
      await scoreRef.transaction(current => Math.max(0, Number(current || 0) + delta));
    } else {
      return json({ error: "Unknown teacher action." }, 400);
    }
    return json({ ok: true, action });
  } catch (error) {
    return json({ error: error.message || errorMessage(error) }, error.status || 500);
  }
}
