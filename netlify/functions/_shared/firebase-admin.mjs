import { cert, getApps, initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getDatabase } from "firebase-admin/database";

function env(name) {
  const value = process.env[name];
  if (!value) throw new Error(`Missing environment variable: ${name}`);
  return value;
}

export function adminServices() {
  if (!getApps().length) {
    initializeApp({
      credential: cert({
        projectId: env("FIREBASE_PROJECT_ID"),
        clientEmail: env("FIREBASE_CLIENT_EMAIL"),
        privateKey: env("FIREBASE_PRIVATE_KEY").replace(/\\n/g, "\n")
      }),
      databaseURL: env("FIREBASE_DATABASE_URL")
    });
  }
  return { auth: getAuth(), db: getDatabase() };
}

export async function requireUser(req, expectedRole) {
  const header = req.headers.get("authorization") || "";
  const match = header.match(/^Bearer\s+(.+)$/i);
  if (!match) throw Object.assign(new Error("Authentication required."), { status: 401 });
  const { auth } = adminServices();
  const decoded = await auth.verifyIdToken(match[1]);
  if (expectedRole && decoded.role !== expectedRole) {
    throw Object.assign(new Error("You do not have permission for this action."), { status: 403 });
  }
  return decoded;
}
