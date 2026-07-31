import { json } from "./_shared/http.mjs";

export default async function handler(req) {
  if (req.method !== "GET") return json({ error: "Method not allowed." }, 405);
  const keys = ["FIREBASE_API_KEY", "FIREBASE_AUTH_DOMAIN", "FIREBASE_DATABASE_URL", "FIREBASE_PROJECT_ID", "FIREBASE_APP_ID"];
  const missing = keys.filter(k => !process.env[k]);
  if (missing.length) return json({ configured: false, missing }, 503);
  return json({
    configured: true,
    firebase: {
      apiKey: process.env.FIREBASE_API_KEY,
      authDomain: process.env.FIREBASE_AUTH_DOMAIN,
      databaseURL: process.env.FIREBASE_DATABASE_URL,
      projectId: process.env.FIREBASE_PROJECT_ID,
      appId: process.env.FIREBASE_APP_ID
    }
  });
}
