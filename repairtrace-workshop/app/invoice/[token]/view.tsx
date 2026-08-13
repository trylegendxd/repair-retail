"use client";

type Invoice = {
  ticket: string; shopName: string; currency: string; countryCode: string; customer: string; device: string; issue: string;
  total: number; subtotal: number; tax: number; taxRate: number; invoiceNumber: string; invoiceStatus: string;
  invoiceIssuedAt: string | null; amountPaid: number; warrantyDays: number;
};

export default function InvoiceView({ invoice }: { invoice: Invoice }) {
  const money = (value: number) => new Intl.NumberFormat("en-IE", { style: "currency", currency: invoice.currency }).format(value);
  return <main className="document-shell">
    <section className="document-card invoice-card">
      <header><span className="document-logo">✓</span><span><strong>{invoice.shopName}</strong><small>Repair payment statement</small></span><em className={`document-status status-${invoice.invoiceStatus}`}>{invoice.invoiceStatus}</em></header>
      <div className="document-title"><small>{invoice.invoiceNumber || invoice.ticket}</small><h1>Repair invoice draft</h1><p>Prepared for {invoice.customer}{invoice.invoiceIssuedAt ? ` · ${new Intl.DateTimeFormat("en-GB", { dateStyle: "medium" }).format(new Date(invoice.invoiceIssuedAt))}` : ""}</p></div>
      <div className="invoice-line"><span><strong>{invoice.device}</strong><small>{invoice.issue}</small></span><strong>{money(invoice.total)}</strong></div>
      <dl className="invoice-totals"><div><dt>Subtotal</dt><dd>{money(invoice.subtotal)}</dd></div>{invoice.taxRate > 0 && <div><dt>Tax included ({invoice.taxRate}%)</dt><dd>{money(invoice.tax)}</dd></div>}<div className="invoice-grand"><dt>Total</dt><dd>{money(invoice.total)}</dd></div><div><dt>Paid</dt><dd>{money(invoice.amountPaid)}</dd></div><div><dt>Balance</dt><dd>{money(Math.max(0, invoice.total - invoice.amountPaid))}</dd></div></dl>
      <div className="invoice-note"><strong>Warranty record</strong><p>The repair carries the workshop&apos;s recorded {invoice.warrantyDays}-day warranty, subject to its service terms.</p></div>
      <button className="document-print" onClick={() => window.print()}>Print / save PDF</button>
      <footer>This is a RepairTrace commercial record, not a guarantee of fiscal certification. The workshop must use any locally required certified invoicing system.</footer>
    </section>
  </main>;
}
