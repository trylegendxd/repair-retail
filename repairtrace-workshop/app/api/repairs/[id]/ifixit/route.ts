import { getIfixitGuideWorkspace, importIfixitGuide, searchAndSaveIfixitGuides, selectIfixitGuide } from "../../../../../lib/server-ifixit";
import { ownerIdFromRequest } from "../../../../../lib/server-identity";
import { assertSameOrigin } from "../../../../../lib/server-http";

type Context = { params: Promise<{ id: string }> };

export async function GET(request: Request, context: Context) {
  try {
    assertSameOrigin(request);
    const { id } = await context.params;
    const ownerId = await ownerIdFromRequest(request);
    let workspace = await getIfixitGuideWorkspace(ownerId, id);
    let warning = "";
    if (!workspace.candidates.length) {
      try { workspace = await searchAndSaveIfixitGuides(ownerId, id); }
      catch (error) { warning = error instanceof Error ? error.message : "The live iFixit search is temporarily unavailable"; }
    }
    return Response.json({ ifixit:workspace, warning });
  } catch (error) {
    const rawMessage = error instanceof Error ? error.message : "Could not load iFixit guides";
    const message = /internal error; reference/i.test(rawMessage) ? "The live iFixit API is temporarily unavailable" : rawMessage;
    return Response.json({ error:message }, { status:message === "Repair not found" ? 404 : 500 });
  }
}

export async function POST(request: Request, context: Context) {
  try {
    const { id } = await context.params;
    const ownerId = await ownerIdFromRequest(request);
    const body = await request.json().catch(() => ({})) as { action?: string; query?: string; guideId?: number; url?: string };
    const workspace = body.action === "select"
      ? await selectIfixitGuide(ownerId, id, Number(body.guideId))
      : body.action === "import"
        ? await importIfixitGuide(ownerId, id, String(body.url ?? ""))
        : await searchAndSaveIfixitGuides(ownerId, id, body.query);
    return Response.json({ ifixit:workspace });
  } catch (error) {
    const rawMessage = error instanceof Error ? error.message : "Could not update iFixit guides";
    const message = /internal error; reference/i.test(rawMessage) ? "The live iFixit API is temporarily unavailable; paste an exact guide URL instead" : rawMessage;
    const status = message === "Repair not found" ? 404 : message === "Guide candidate not found" || message.startsWith("Enter a valid") || message.includes("numeric guide ID") ? 400 : 502;
    return Response.json({ error:message }, { status });
  }
}
