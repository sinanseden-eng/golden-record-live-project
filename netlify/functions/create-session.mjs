import crypto from "node:crypto";
import { adminServices } from "./_shared/firebase-admin.mjs";
import { bodyJson, cleanText, json, errorMessage } from "./_shared/http.mjs";
import { INVESTIGATION_STATIONS } from "./_shared/game-logic.mjs";

const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const makeCode = () => "MUSIC-" + Array.from({ length: 3 }, () => alphabet[crypto.randomInt(alphabet.length)]).join("");
const hashPin = (pin, salt) => crypto.scryptSync(pin, salt, 64).toString("hex");

export default async function handler(req) {
  if (req.method !== "POST") return json({ error: "Method not allowed." }, 405);
  try {
    const body = await bodyJson(req);
    const adminKey = cleanText(body.adminKey, 120);
    if (process.env.CLASS_ADMIN_KEY) {
      const supplied = Buffer.from(adminKey);
      const expected = Buffer.from(process.env.CLASS_ADMIN_KEY);
      if (supplied.length !== expected.length || !crypto.timingSafeEqual(supplied, expected)) {
        return json({ error: "The teacher setup key is incorrect." }, 403);
      }
    }
    const teacherName = cleanText(body.teacherName, 50) || "Teacher";
    const pin = cleanText(body.pin, 20);
    const durationMinutes = Math.min(120, Math.max(30, Number(body.durationMinutes) || 45));
    if (!/^\d{4,8}$/.test(pin)) return json({ error: "Choose a 4–8 digit teacher PIN." }, 400);

    const { db, auth } = adminServices();
    let sessionCode = "";
    for (let tries = 0; tries < 12; tries++) {
      const candidate = makeCode();
      const snap = await db.ref(`sessions/${candidate}`).get();
      if (!snap.exists()) { sessionCode = candidate; break; }
    }
    if (!sessionCode) throw new Error("Could not allocate a session code.");

    const now = Date.now();
    const salt = crypto.randomBytes(16).toString("hex");
    const teacherUid = `teacher_${sessionCode.replace(/[^A-Z0-9]/g, "_")}_${crypto.randomBytes(4).toString("hex")}`;
    const sharedStations = Object.fromEntries(INVESTIGATION_STATIONS.map(station => [station, { status: "unassigned", updatedAt: now }]));
    const updates = {};
    updates[`sessions/${sessionCode}/meta`] = {
      title: "The Golden Record Blackout",
      teacherName,
      createdAt: now,
      updatedAt: now,
      status: "active",
      paused: true,
      timerStartedAt: null,
      remainingSeconds: durationMinutes * 60,
      hideCodes: true,
      durationMinutes,
      maxGroups: 6,
      stationCount: 6,
      format: "parallel-jigsaw"
    };
    updates[`sessions/${sessionCode}/broadcast`] = { message: "", updatedAt: now };
    updates[`sessions/${sessionCode}/shared`] = { stations: sharedStations, evidence: {}, updatedAt: now };
    updates[`privateSessions/${sessionCode}`] = { pinHash: hashPin(pin, salt), salt, teacherUid, stationAssignments: {}, createdAt: now };
    await db.ref().update(updates);
    const token = await auth.createCustomToken(teacherUid, { role: "teacher", sessionCode });
    return json({ sessionCode, token, teacherName, durationMinutes });
  } catch (error) {
    return json({ error: errorMessage(error) }, error.status || 500);
  }
}
