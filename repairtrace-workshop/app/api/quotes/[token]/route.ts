import { getCommercialDocument, respondToQuote } from "../../../../lib/server-operations";
import { assertSameOrigin } from "../../../../lib/server-http";

type Context = { params: Promise<{ token: string }> };
const headers={"cache-control":"no-store","referrer-policy":"no-referrer","x-content-type-options":"nosniff"};

export async function GET(_request: Request, context: Context) {
  try {
    const { token } = await context.params;
    const quote = await getCommercialDocument(token, "quote");
    return quote ? Response.json({ quote },{headers}) : Response.json({ error: "Quote not found." }, { status: 404,headers });
  } catch (error) {
    console.error("Could not load quote",error);return Response.json({ error:"Could not load quote." }, { status: 500,headers });
  }
}

export async function PATCH(request: Request, context: Context) {
  try {
    assertSameOrigin(request);
    const { token } = await context.params;
    const input = await request.json() as Record<string, unknown>;
    const response = input.response === "approved" ? "approved" : input.response === "declined" ? "declined" : null;
    if (!response) return Response.json({ error: "Choose approve or decline." }, { status: 400 });
    const quote = await respondToQuote(token, response);
    return quote ? Response.json({ quote },{headers}) : Response.json({ error: "Quote not found." }, { status: 404,headers });
  } catch (error) {
    const message=error instanceof Error?error.message:"";const conflict=/already|another session|no longer active/i.test(message);return Response.json({ error: conflict?message:"Could not record your response." }, { status: conflict?409:500,headers });
  }
}
