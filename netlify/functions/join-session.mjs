import crypto from "node:crypto";
import { adminServices } from "./_shared/firebase-admin.mjs";
import { bodyJson, cleanText, json, normalizeSession, normalizeTeamName, errorMessage } from "./_shared/http.mjs";

const hashKey = (key, salt) => crypto.scryptSync(key, salt, 48).toString("hex");
const safeEqual = (a, b) => {
  const aa = Buffer.from(a || "", "hex"), bb = Buffer.from(b || "", "hex");
  return aa.length === bb.length && aa.length > 0 && crypto.timingSafeEqual(aa, bb);
};
const slug = value => value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 24) || "team";

export default async function handler(req) {
  if (req.method !== "POST") return json({ error: "Method not allowed." }, 405);
  try {
    const body = await bodyJson(req);
    const sessionCode = normalizeSession(body.sessionCode);
    const teamName = normalizeTeamName(body.teamName);
    const icon = cleanText(body.icon, 8) || "🎧";
    const suppliedKey = cleanText(body.teamKey, 12);
    if (teamName.length < 2) return json({ error: "Enter a group name." }, 400);

    const { db, auth } = adminServices();
    const metaSnap = await db.ref(`sessions/${sessionCode}/meta`).get();
    if (!metaSnap.exists()) return json({ error: "Session code not found." }, 404);
    const meta = metaSnap.val();
    if (meta.status !== "active") return json({ error: "This session is closed." }, 403);

    const groupsSnap = await db.ref(`sessions/${sessionCode}/groups`).get();
    const groups = groupsSnap.val() || {};
    const existingEntry = Object.entries(groups).find(([, group]) => String(group.displayName || "").toLowerCase() === teamName.toLowerCase());
    let teamId, teamKey;

    if (existingEntry) {
      teamId = existingEntry[0];
      if (!suppliedKey) return json({ error: "That group already exists. Enter its team key to rejoin." }, 409);
      const secretSnap = await db.ref(`privateTeams/${sessionCode}/${teamId}`).get();
      const secret = secretSnap.val();
      if (!secret || !safeEqual(hashKey(suppliedKey, secret.salt), secret.keyHash)) return json({ error: "The team key is incorrect." }, 403);
      teamKey = suppliedKey;
      await db.ref(`sessions/${sessionCode}/groups/${teamId}`).update({ lastSeen: Date.now() });
    } else {
      if (Object.keys(groups).length >= Number(meta.maxGroups || 12)) return json({ error: "This class session is full." }, 409);
      teamId = `${slug(teamName)}-${crypto.randomBytes(2).toString("hex")}`;
      teamKey = String(crypto.randomInt(1000, 10000));
      const salt = crypto.randomBytes(16).toString("hex");
      const now = Date.now();
      const group = {
        displayName: teamName,
        icon,
        joinedAt: now,
        lastSeen: now,
        score: 0,
        progress: 0,
        completed: false,
        latestStation: "s1",
        stations: {
          s1: { status: "not-started" },
          s2: { status: "not-started" },
          s3: { status: "not-started" },
          s4: { status: "not-started" },
          final: { status: "locked" }
        },
        targets: {}
      };
      const updates = {};
      updates[`sessions/${sessionCode}/groups/${teamId}`] = group;
      updates[`privateTeams/${sessionCode}/${teamId}`] = { keyHash: hashKey(teamKey, salt), salt, createdAt: now };
      await db.ref().update(updates);
    }

    const uid = `student_${sessionCode.replace(/[^A-Z0-9]/g, "_")}_${teamId.replace(/[^a-z0-9_]/gi, "_")}`;
    const token = await auth.createCustomToken(uid, { role: "student", sessionCode, teamId });
    return json({ token, sessionCode, teamId, teamName, teamKey, meta });
  } catch (error) {
    return json({ error: errorMessage(error) }, error.status || 500);
  }
}
