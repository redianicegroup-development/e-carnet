import contactHandler from "../../../../../../contact.js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request) {
  let body;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Corps JSON invalide." }, { status: 400, headers: { "Cache-Control": "no-store" } });
  }

  let statusCode = 200;
  let payload;
  const response = {
    setHeader() { return this; },
    status(code) { statusCode = code; return this; },
    json(data) { payload = data; return this; },
  };

  await contactHandler({
    method: request.method,
    headers: Object.fromEntries(request.headers.entries()),
    body,
  }, response);

  return Response.json(payload || { error: "Une erreur est survenue." }, {
    status: statusCode,
    headers: { "Cache-Control": "no-store" },
  });
}
