import { getCommercialDocument } from "../../../../lib/server-operations";

type Context = { params: Promise<{ token: string }> };
const headers={"cache-control":"no-store","referrer-policy":"no-referrer","x-content-type-options":"nosniff"};

export async function GET(_request: Request, context: Context) {
  try {
    const { token } = await context.params;
    const invoice = await getCommercialDocument(token, "invoice");
    if (!invoice || invoice.invoiceStatus === "not_created") return Response.json({ error: "Invoice not found." }, { status: 404,headers });
    return Response.json({ invoice },{headers});
  } catch (error) {
    console.error("Could not load invoice",error);return Response.json({ error:"Could not load invoice." }, { status: 500,headers });
  }
}
