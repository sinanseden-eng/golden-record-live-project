import crypto from "node:crypto";
import { adminServices } from "./_shared/firebase-admin.mjs";
import { bodyJson, cleanText, json, normalizeSession, errorMessage } from "./_shared/http.mjs";

const hashPin = (pin, salt) => crypto.scryptSync(pin, salt, 64).toString("hex");
const safeEqual = (a, b) => {
  const aa = Buffer.from(a || "", "hex"), bb = Buffer.from(b || "", "hex");
  return aa.length === bb.length && aa.length > 0 && crypto.timingSafeEqual(aa, bb);
};

export default async function handler(req) {
  if (req.method !== "POST") return json({ error: "Method not allowed." }, 405);
  try {
    const body = await bodyJson(req);
    const sessionCode = normalizeSession(body.sessionCode);
    const pin = cleanText(body.pin, 20);
    const { db, auth } = adminServices();
    const privateSnap = await db.ref(`privateSessions/${sessionCode}`).get();
    const sessionSnap = await db.ref(`sessions/${sessionCode}/meta`).get();
    if (!privateSnap.exists() || !sessionSnap.exists()) return json({ error: "Session not found." }, 404);
    const secret = privateSnap.val();
    if (!safeEqual(hashPin(pin, secret.salt), secret.pinHash)) return json({ error: "Incorrect teacher PIN." }, 403);
    const token = await auth.createCustomToken(secret.teacherUid, { role: "teacher", sessionCode });
    return json({ sessionCode, token, meta: sessionSnap.val() });
  } catch (error) {
    return json({ error: errorMessage(error) }, error.status || 500);
  }
}
