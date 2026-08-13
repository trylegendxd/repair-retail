import { ownerIdFromRequest } from "../../../../../lib/server-identity";
import { generateAndSaveRepairGuide } from "../../../../../lib/server-guide";
import { assertSameOrigin } from "../../../../../lib/server-http";

type Context = { params: Promise<{ id: string }> };

export async function POST(request: Request, context: Context) {
  try {
    assertSameOrigin(request);
    const { id } = await context.params;
    const ownerId = await ownerIdFromRequest(request);
    const repair = await generateAndSaveRepairGuide(id, ownerId);
    return Response.json({ repair });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not generate repair guide";
    return Response.json({ error:message }, { status:message === "Repair not found" ? 404 : 500 });
  }
}
