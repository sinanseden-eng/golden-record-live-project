import crypto from "node:crypto";
import { adminServices } from "./_shared/firebase-admin.mjs";
import { bodyJson, cleanText, json, normalizeSession, normalizeTeamName, errorMessage } from "./_shared/http.mjs";
import { INVESTIGATION_STATIONS } from "./_shared/game-logic.mjs";

const hashKey = (key, salt) => crypto.scryptSync(key, salt, 48).toString("hex");
const safeEqual = (a, b) => {
  const aa = Buffer.from(a || "", "hex"), bb = Buffer.from(b || "", "hex");
  return aa.length === bb.length && aa.length > 0 && crypto.timingSafeEqual(aa, bb);
};
const slug = value => value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 24) || "team";

async function allocateStation(db, sessionCode, teamId) {
  const assignmentRef = db.ref(`privateSessions/${sessionCode}/stationAssignments`);
  const result = await assignmentRef.transaction(current => {
    const assignments = current && typeof current === "object" ? { ...current } : {};
    if (assignments[teamId]) return assignments;
    const used = new Set(Object.values(assignments));
    const available = INVESTIGATION_STATIONS.find(station => !used.has(station));
    if (!available) return;
    assignments[teamId] = available;
    return assignments;
  });
  if (!result.committed) return "";
  return String(result.snapshot.val()?.[teamId] || "");
}

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
    let teamId, teamKey, assignedStation;

    if (existingEntry) {
      teamId = existingEntry[0];
      if (!suppliedKey) return json({ error: "That group already exists. Enter its team key to rejoin." }, 409);
      const secretSnap = await db.ref(`privateTeams/${sessionCode}/${teamId}`).get();
      const secret = secretSnap.val();
      if (!secret || !safeEqual(hashKey(suppliedKey, secret.salt), secret.keyHash)) return json({ error: "The team key is incorrect." }, 403);
      teamKey = suppliedKey;
      assignedStation = String(existingEntry[1].assignedStation || "");
      if (!assignedStation) assignedStation = await allocateStation(db, sessionCode, teamId);
      await db.ref(`sessions/${sessionCode}/groups/${teamId}`).update({ assignedStation, lastSeen: Date.now() });
    } else {
      if (Object.keys(groups).length >= Number(meta.maxGroups || 6)) return json({ error: "All six station teams have already joined." }, 409);
      teamId = `${slug(teamName)}-${crypto.randomBytes(2).toString("hex")}`;
      teamKey = String(crypto.randomInt(1000, 10000));
      assignedStation = await allocateStation(db, sessionCode, teamId);
      if (!assignedStation) return json({ error: "No unassigned investigation station remains." }, 409);
      const salt = crypto.randomBytes(16).toString("hex");
      const now = Date.now();
      const stations = Object.fromEntries(INVESTIGATION_STATIONS.map(station => [station, { status: station === assignedStation ? "not-started" : "locked" }]));
      stations.final = { status: "locked" };
      const group = {
        displayName: teamName,
        icon,
        assignedStation,
        joinedAt: now,
        lastSeen: now,
        score: 0,
        progress: 0,
        completed: false,
        latestStation: assignedStation,
        stations,
        targets: {}
      };
      const updates = {};
      updates[`sessions/${sessionCode}/groups/${teamId}`] = group;
      updates[`sessions/${sessionCode}/shared/stations/${assignedStation}`] = { status: "assigned", teamId, teamName, updatedAt: now };
      updates[`sessions/${sessionCode}/shared/updatedAt`] = now;
      updates[`privateTeams/${sessionCode}/${teamId}`] = { keyHash: hashKey(teamKey, salt), salt, assignedStation, createdAt: now };
      await db.ref().update(updates);
    }

    const uid = `student_${sessionCode.replace(/[^A-Z0-9]/g, "_")}_${teamId.replace(/[^a-z0-9_]/gi, "_")}`;
    const token = await auth.createCustomToken(uid, { role: "student", sessionCode, teamId, assignedStation });
    return json({ token, sessionCode, teamId, teamName, teamKey, assignedStation, meta });
  } catch (error) {
    return json({ error: errorMessage(error) }, error.status || 500);
  }
}
