import { getOperationsSnapshot, mutateOperations } from "../../../lib/server-operations";
import { ownerIdFromRequest } from "../../../lib/server-identity";
import { apiError, assertSameOrigin, privateHeaders } from "../../../lib/server-http";

export async function GET(request: Request) {
  try {
    const ownerId = await ownerIdFromRequest(request);
    return Response.json({ operations: await getOperationsSnapshot(ownerId) },{headers:privateHeaders});
  } catch (error) {
    return apiError(error,"Could not load workshop operations.");
  }
}

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);const ownerId = await ownerIdFromRequest(request);
    const input = await request.json() as Record<string, unknown>;
    return Response.json({ operations: await mutateOperations(ownerId, input) }, { status: 201,headers:privateHeaders });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not update workshop operations.";
    const conflict = /unique constraint/i.test(message);
    return Response.json({ error: conflict ? "That SKU is already in inventory." : message }, { status: conflict ? 409 : 400 });
  }
}
