export function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
      "x-content-type-options": "nosniff"
    }
  });
}

export async function bodyJson(req) {
  try {
    const body = await req.json();
    return body && typeof body === "object" ? body : {};
  } catch {
    return {};
  }
}

export function cleanText(value, max = 2000) {
  return String(value ?? "").replace(/[\u0000-\u001f\u007f]/g, " ").trim().slice(0, max);
}

export function normalizeSession(value) {
  return cleanText(value, 20).toUpperCase().replace(/[^A-Z0-9-]/g, "");
}

export function normalizeTeamName(value) {
  return cleanText(value, 40).replace(/\s+/g, " ");
}

export function errorMessage(error) {
  console.error(error);
  return "The request could not be completed.";
}
