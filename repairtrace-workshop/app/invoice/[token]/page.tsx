import { getCommercialDocument } from "../../../lib/server-operations";
import InvoiceView from "./view";

export const dynamic = "force-dynamic";
export const metadata={robots:{index:false,follow:false},referrer:"no-referrer"};

export default async function InvoicePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const invoice = await getCommercialDocument(token, "invoice");
  if (!invoice || invoice.invoiceStatus === "not_created") return <main className="document-shell"><section className="document-card document-missing"><b>!</b><h1>Invoice unavailable</h1><p>This document has not been issued or the secure link is invalid.</p></section></main>;
  return <InvoiceView invoice={invoice}/>;
}
