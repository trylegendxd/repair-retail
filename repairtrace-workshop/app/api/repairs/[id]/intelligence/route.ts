import { getRepairIntelligence } from "../../../../../lib/server-intelligence";
import { ownerIdFromRequest } from "../../../../../lib/server-identity";
import { apiError, privateHeaders } from "../../../../../lib/server-http";

type Context = { params: Promise<{ id: string }> };

export async function GET(request: Request, context: Context) {
  try {
    const { id } = await context.params;
    const ownerId = await ownerIdFromRequest(request);
    const intelligence = await getRepairIntelligence(ownerId, id);
    return intelligence ? Response.json({ intelligence },{headers:privateHeaders}) : Response.json({ error: "Repair not found" }, { status: 404 });
  } catch (error) {
    return apiError(error,"Could not load repair intelligence");
  }
}
