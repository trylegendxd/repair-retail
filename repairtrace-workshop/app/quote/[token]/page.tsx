import { getCommercialDocument } from "../../../lib/server-operations";
import QuoteView from "./view";

export const dynamic = "force-dynamic";
export const metadata={robots:{index:false,follow:false},referrer:"no-referrer"};

export default async function QuotePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const quote = await getCommercialDocument(token, "quote");
  if (!quote) return <main className="document-shell"><section className="document-card document-missing"><b>!</b><h1>Quote unavailable</h1><p>This secure link is invalid or has expired. Contact the workshop for a new one.</p></section></main>;
  return <QuoteView token={token} initialQuote={quote}/>;
}
