import { database, ensureRepairDatabase, getRepair } from "./server-repairs";

type Row = Record<string, unknown>;

function textValue(value: unknown, max = 500) {
  return String(value ?? "").replace(/[\u0000-\u001f]+/g, " ").trim().slice(0, max);
}

function numberValue(value: unknown, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

export async function syncCustomersFromRepairs(ownerId: string) {
  await ensureRepairDatabase();
  const db = database();
  await db.prepare(`INSERT INTO customers (id,owner_id,name,email,phone)
    SELECT 'customer_' || lower(hex(randomblob(16))), r.owner_id, r.customer_name, r.customer_email, r.customer_phone
    FROM repairs r
    WHERE r.owner_id=? AND trim(r.customer_name)<>''
      AND NOT EXISTS (
        SELECT 1 FROM customers c WHERE c.owner_id=r.owner_id AND (
          (trim(r.customer_email)<>'' AND lower(trim(c.email))=lower(trim(r.customer_email))) OR
          (trim(r.customer_email)='' AND trim(r.customer_phone)<>'' AND trim(c.phone)=trim(r.customer_phone)) OR
          (trim(r.customer_email)='' AND trim(r.customer_phone)='' AND lower(trim(c.name))=lower(trim(r.customer_name)))
        )
      )
    GROUP BY CASE
      WHEN trim(r.customer_email)<>'' THEN 'email:' || lower(trim(r.customer_email))
      WHEN trim(r.customer_phone)<>'' THEN 'phone:' || trim(r.customer_phone)
      ELSE 'name:' || lower(trim(r.customer_name))
    END`).bind(ownerId).run();

  await db.prepare(`UPDATE repairs SET customer_id=(
      SELECT c.id FROM customers c WHERE c.owner_id=repairs.owner_id AND (
        (trim(repairs.customer_email)<>'' AND lower(trim(c.email))=lower(trim(repairs.customer_email))) OR
        (trim(repairs.customer_email)='' AND trim(repairs.customer_phone)<>'' AND trim(c.phone)=trim(repairs.customer_phone)) OR
        (trim(repairs.customer_email)='' AND trim(repairs.customer_phone)='' AND lower(trim(c.name))=lower(trim(repairs.customer_name)))
      ) ORDER BY datetime(c.created_at) LIMIT 1
    ) WHERE owner_id=? AND customer_id=''`).bind(ownerId).run();
}

export async function upsertCustomerForRepair(ownerId: string, input: { name: string; email?: string; phone?: string }) {
  await ensureRepairDatabase();
  const name = textValue(input.name, 160);
  const email = textValue(input.email, 200).toLowerCase();
  const phone = textValue(input.phone, 80);
  const db = database();
  let existing: Row | null = null;
  if (email) existing = await db.prepare("SELECT id FROM customers WHERE owner_id=? AND lower(email)=? LIMIT 1").bind(ownerId, email).first<Row>();
  if (!existing && phone) existing = await db.prepare("SELECT id FROM customers WHERE owner_id=? AND phone=? LIMIT 1").bind(ownerId, phone).first<Row>();
  if (!existing) existing = await db.prepare("SELECT id FROM customers WHERE owner_id=? AND lower(name)=lower(?) AND email='' AND phone='' LIMIT 1").bind(ownerId, name).first<Row>();
  if (existing) {
    const id = String(existing.id);
    await db.prepare("UPDATE customers SET name=?,email=CASE WHEN ?<>'' THEN ? ELSE email END,phone=CASE WHEN ?<>'' THEN ? ELSE phone END,updated_at=CURRENT_TIMESTAMP WHERE id=? AND owner_id=?")
      .bind(name, email, email, phone, phone, id, ownerId).run();
    return id;
  }
  const id = `customer_${crypto.randomUUID()}`;
  await db.prepare("INSERT INTO customers (id,owner_id,name,email,phone) VALUES (?,?,?,?,?)").bind(id, ownerId, name, email, phone).run();
  return id;
}

function customerFromRow(row: Row) {
  return {
    id: String(row.id), name: String(row.name), email: String(row.email ?? ""), phone: String(row.phone ?? ""),
    company: String(row.company ?? ""), notes: String(row.notes ?? ""), tags: String(row.tags ?? ""),
    repairCount: Number(row.repair_count ?? 0), activeRepairs: Number(row.active_repairs ?? 0),
    lifetimeValue: Number(row.lifetime_value ?? 0), lastVisit: row.last_visit ? String(row.last_visit) : null,
    createdAt: String(row.created_at), updatedAt: String(row.updated_at),
  };
}

function inventoryFromRow(row: Row) {
  return {
    id: String(row.id), name: String(row.name), sku: String(row.sku ?? ""), supplier: String(row.supplier ?? ""),
    compatibleModels: String(row.compatible_models ?? ""), location: String(row.location ?? ""),
    quantity: Number(row.quantity ?? 0), reorderLevel: Number(row.reorder_level ?? 0),
    unitCost: Number(row.unit_cost ?? 0), salePrice: Number(row.sale_price ?? 0), active: Boolean(row.active),
    lowStock: Number(row.quantity ?? 0) <= Number(row.reorder_level ?? 0), updatedAt: String(row.updated_at),
  };
}

export async function getOperationsSnapshot(ownerId: string) {
  await syncCustomersFromRepairs(ownerId);
  const db = database();
  const [customers, inventory, technicians, appointments, metrics, revenueTrend] = await Promise.all([
    db.prepare(`SELECT c.*,
      COUNT(r.id) AS repair_count,
      SUM(CASE WHEN r.id IS NOT NULL AND r.status<>'Completed' THEN 1 ELSE 0 END) AS active_repairs,
      COALESCE(SUM(CASE WHEN r.status='Completed' THEN CASE WHEN r.final_cost>0 THEN r.final_cost ELSE r.estimate END ELSE 0 END),0) AS lifetime_value,
      MAX(r.created_at) AS last_visit
      FROM customers c LEFT JOIN repairs r ON r.customer_id=c.id AND r.owner_id=c.owner_id
      WHERE c.owner_id=? GROUP BY c.id ORDER BY datetime(COALESCE(MAX(r.created_at),c.updated_at)) DESC`).bind(ownerId).all<Row>(),
    db.prepare("SELECT * FROM inventory_items WHERE owner_id=? AND active=1 ORDER BY (quantity<=reorder_level) DESC,name").bind(ownerId).all<Row>(),
    db.prepare("SELECT * FROM shop_technicians WHERE owner_id=? AND active=1 ORDER BY name").bind(ownerId).all<Row>(),
    db.prepare(`SELECT a.*,r.ticket,r.device,r.customer_name FROM shop_appointments a
      LEFT JOIN repairs r ON r.id=a.repair_id AND r.owner_id=a.owner_id
      WHERE a.owner_id=? ORDER BY datetime(a.starts_at),a.title`).bind(ownerId).all<Row>(),
    db.prepare(`SELECT
      COUNT(*) AS total_repairs,
      SUM(CASE WHEN status<>'Completed' THEN 1 ELSE 0 END) AS active_repairs,
      SUM(CASE WHEN status='Completed' THEN 1 ELSE 0 END) AS completed_repairs,
      SUM(CASE WHEN status='Ready' THEN 1 ELSE 0 END) AS ready_repairs,
      SUM(CASE WHEN quote_status='sent' THEN 1 ELSE 0 END) AS quotes_waiting,
      SUM(CASE WHEN invoice_status IN ('draft','sent') THEN 1 ELSE 0 END) AS invoices_outstanding,
      COALESCE(SUM(CASE WHEN status='Completed' THEN CASE WHEN final_cost>0 THEN final_cost ELSE estimate END ELSE 0 END),0) AS completed_value,
      COALESCE(AVG(CASE WHEN status='Completed' THEN CASE WHEN final_cost>0 THEN final_cost ELSE estimate END END),0) AS average_ticket,
      COALESCE(AVG(CASE WHEN status='Completed' AND completed_at IS NOT NULL THEN julianday(completed_at)-julianday(created_at) END),0) AS average_turnaround,
      SUM(CASE WHEN status='Completed' AND warranty_return=1 THEN 1 ELSE 0 END) AS warranty_returns,
      SUM(CASE WHEN quote_status='approved' THEN 1 ELSE 0 END) AS quotes_approved,
      SUM(CASE WHEN quote_status IN ('approved','declined') THEN 1 ELSE 0 END) AS quotes_answered
      FROM repairs WHERE owner_id=?`).bind(ownerId).first<Row>(),
    db.prepare(`SELECT strftime('%Y-%m',COALESCE(completed_at,updated_at)) AS month,
      COUNT(*) AS jobs,COALESCE(SUM(CASE WHEN final_cost>0 THEN final_cost ELSE estimate END),0) AS value
      FROM repairs WHERE owner_id=? AND status='Completed'
      GROUP BY month ORDER BY month DESC LIMIT 6`).bind(ownerId).all<Row>(),
  ]);
  const metric = metrics ?? {};
  const quotesAnswered = Number(metric.quotes_answered ?? 0);
  const totalRepairs = Number(metric.total_repairs ?? 0);
  const completedRepairs=Number(metric.completed_repairs??0);
  return {
    customers: customers.results.map(customerFromRow),
    inventory: inventory.results.map(inventoryFromRow),
    technicians: technicians.results.map((row) => ({
      id: String(row.id), name: String(row.name), email: String(row.email ?? ""), role: String(row.role ?? "Technician"),
      specialty: String(row.specialty ?? "General repair"), active: Boolean(row.active),
    })),
    appointments: appointments.results.map((row) => ({
      id: String(row.id), repairId: String(row.repair_id ?? ""), title: String(row.title), startsAt: String(row.starts_at),
      endsAt: String(row.ends_at ?? ""), technician: String(row.technician ?? ""), status: String(row.status), notes: String(row.notes ?? ""),
      ticket: String(row.ticket ?? ""), device: String(row.device ?? ""), customer: String(row.customer_name ?? ""),
    })),
    metrics: {
      totalRepairs, activeRepairs: Number(metric.active_repairs ?? 0), completedRepairs,
      readyRepairs: Number(metric.ready_repairs ?? 0), quotesWaiting: Number(metric.quotes_waiting ?? 0),
      invoicesOutstanding: Number(metric.invoices_outstanding ?? 0), completedValue: Number(metric.completed_value ?? 0),
      averageTicket: Number(metric.average_ticket ?? 0), averageTurnaroundDays: Number(metric.average_turnaround ?? 0),
      warrantyReturnRate: completedRepairs ? Number(metric.warranty_returns ?? 0) / completedRepairs * 100 : 0,
      quoteApprovalRate: quotesAnswered ? Number(metric.quotes_approved ?? 0) / quotesAnswered * 100 : 0,
      lowStockItems: inventory.results.filter((row) => Number(row.quantity ?? 0) <= Number(row.reorder_level ?? 0)).length,
    },
    revenueTrend: [...revenueTrend.results].reverse().map((row) => ({ month: String(row.month), jobs: Number(row.jobs), value: Number(row.value) })),
  };
}

export async function mutateOperations(ownerId: string, input: Record<string, unknown>) {
  await ensureRepairDatabase();
  const db = database();
  const action = textValue(input.action, 50);

  if (action === "create_customer") {
    const name = textValue(input.name, 160);
    if (!name) throw new Error("Customer name is required.");
    const id = await upsertCustomerForRepair(ownerId, { name, email: textValue(input.email, 200), phone: textValue(input.phone, 80) });
    await db.prepare("UPDATE customers SET company=?,notes=?,tags=?,updated_at=CURRENT_TIMESTAMP WHERE id=? AND owner_id=?")
      .bind(textValue(input.company, 160), textValue(input.notes, 1500), textValue(input.tags, 300), id, ownerId).run();
  } else if (action === "update_customer") {
    const id = textValue(input.id, 100);
    const current = await db.prepare("SELECT * FROM customers WHERE id=? AND owner_id=?").bind(id, ownerId).first<Row>();
    if (!current) throw new Error("Customer not found.");
    const name = textValue(input.name ?? current.name, 160);
    if (!name) throw new Error("Customer name is required.");
    await db.prepare("UPDATE customers SET name=?,email=?,phone=?,company=?,notes=?,tags=?,updated_at=CURRENT_TIMESTAMP WHERE id=? AND owner_id=?")
      .bind(name, textValue(input.email ?? current.email, 200).toLowerCase(), textValue(input.phone ?? current.phone, 80), textValue(input.company ?? current.company, 160), textValue(input.notes ?? current.notes, 1500), textValue(input.tags ?? current.tags, 300), id, ownerId).run();
  } else if (action === "create_inventory" || action === "update_inventory") {
    const id = action === "create_inventory" ? `stock_${crypto.randomUUID()}` : textValue(input.id, 100);
    const current = action === "update_inventory" ? await db.prepare("SELECT * FROM inventory_items WHERE id=? AND owner_id=?").bind(id, ownerId).first<Row>() : null;
    if (action === "update_inventory" && !current) throw new Error("Inventory item not found.");
    const name = textValue(input.name ?? current?.name, 180);
    if (!name) throw new Error("Part name is required.");
    const quantity = Math.trunc(numberValue(input.quantity, Number(current?.quantity ?? 0)));
    const reorderLevel = Math.trunc(numberValue(input.reorderLevel, Number(current?.reorder_level ?? 2)));
    const unitCost = numberValue(input.unitCost, Number(current?.unit_cost ?? 0));
    const salePrice = numberValue(input.salePrice, Number(current?.sale_price ?? 0));
    if (quantity < 0 || quantity > 1_000_000 || reorderLevel < 0 || unitCost < 0 || salePrice < 0) throw new Error("Enter valid non-negative stock and price values.");
    const values = [name, textValue(input.sku ?? current?.sku, 100).toUpperCase(), textValue(input.supplier ?? current?.supplier, 180), textValue(input.compatibleModels ?? current?.compatible_models, 500), textValue(input.location ?? current?.location, 120), quantity, reorderLevel, unitCost, salePrice];
    if (current) await db.prepare("UPDATE inventory_items SET name=?,sku=?,supplier=?,compatible_models=?,location=?,quantity=?,reorder_level=?,unit_cost=?,sale_price=?,updated_at=CURRENT_TIMESTAMP WHERE id=? AND owner_id=?").bind(...values, id, ownerId).run();
    else await db.prepare("INSERT INTO inventory_items (id,owner_id,name,sku,supplier,compatible_models,location,quantity,reorder_level,unit_cost,sale_price) VALUES (?,?,?,?,?,?,?,?,?,?,?)").bind(id, ownerId, ...values).run();
  } else if (action === "create_technician") {
    const name = textValue(input.name, 160);
    if (!name) throw new Error("Technician name is required.");
    await db.prepare("INSERT INTO shop_technicians (id,owner_id,name,email,role,specialty) VALUES (?,?,?,?,?,?)")
      .bind(`tech_${crypto.randomUUID()}`, ownerId, name, textValue(input.email, 200).toLowerCase(), textValue(input.role, 80) || "Technician", textValue(input.specialty, 180) || "General repair").run();
  } else if (action === "create_appointment") {
    const repairId = textValue(input.repairId, 100);
    const repair = repairId ? await getRepair(repairId, false, ownerId) : null;
    if (repairId && !repair) throw new Error("Repair not found.");
    const startsAt = textValue(input.startsAt, 60);
    if (!startsAt || Number.isNaN(new Date(startsAt).valueOf())) throw new Error("Choose a valid appointment date and time.");
    const technician = textValue(input.technician, 160);
    const title = textValue(input.title, 180) || (repair ? `${repair.device} · ${repair.customer}` : "Workshop appointment");
    await db.prepare("INSERT INTO shop_appointments (id,owner_id,repair_id,title,starts_at,ends_at,technician,status,notes) VALUES (?,?,?,?,?,?,?,?,?)")
      .bind(`appointment_${crypto.randomUUID()}`, ownerId, repairId, title, startsAt, textValue(input.endsAt, 60), technician, "Scheduled", textValue(input.notes, 800)).run();
    if (repair) {
      await db.prepare("UPDATE repairs SET appointment_at=?,assigned_technician=CASE WHEN ?<>'' THEN ? ELSE assigned_technician END,updated_at=CURRENT_TIMESTAMP WHERE id=? AND owner_id=?")
        .bind(startsAt, technician, technician, repairId, ownerId).run();
      await db.prepare("INSERT INTO repair_events (id,repair_id,title,detail) VALUES (?,?,?,?)")
        .bind(crypto.randomUUID(), repairId, "Workshop appointment scheduled", `${new Date(startsAt).toLocaleString("en-GB")}${technician ? ` · ${technician}` : ""}`).run();
    }
  } else if (action === "update_appointment") {
    const id = textValue(input.id, 100);
    const status = textValue(input.status, 30);
    if (!new Set(["Scheduled", "In progress", "Completed", "Cancelled"]).has(status)) throw new Error("Appointment status is invalid.");
    const result = await db.prepare("UPDATE shop_appointments SET status=?,updated_at=CURRENT_TIMESTAMP WHERE id=? AND owner_id=?").bind(status, id, ownerId).run();
    if (!result.meta.changes) throw new Error("Appointment not found.");
  } else {
    throw new Error("Unsupported operations action.");
  }
  return getOperationsSnapshot(ownerId);
}

export async function allocateInventoryForRepair(ownerId: string, repairId: string, sku: string, quantity: number) {
  if (!sku) return null;
  const db = database();
  const item = await db.prepare("SELECT id,name,quantity FROM inventory_items WHERE owner_id=? AND upper(sku)=upper(?) AND active=1 LIMIT 1").bind(ownerId, sku).first<Row>();
  if (!item) return null;
  const used = Math.max(1, Math.trunc(quantity));
  if(Number(item.quantity)<used)throw new Error(`Only ${Number(item.quantity)} unit${Number(item.quantity)===1?" is":"s are"} available for SKU ${sku}.`);
  const result=await db.prepare("UPDATE inventory_items SET quantity=quantity-?,updated_at=CURRENT_TIMESTAMP WHERE id=? AND owner_id=? AND quantity>=?").bind(used, String(item.id), ownerId,used).run();
  if(!result.meta.changes)throw new Error(`Inventory changed while allocating SKU ${sku}. Try again.`);
  return {id:String(item.id),name:String(item.name),used,repairId};
}

export async function getCommercialDocument(key: string, kind: "quote" | "invoice") {
  await ensureRepairDatabase();
  if (!/^(quote|invoice)_[A-Za-z0-9_-]{24,100}$/.test(key)) return null;
  const keyColumn = kind === "quote" ? "quote_key" : "invoice_key";
  const row = await database().prepare(`SELECT r.*,s.shop_name,s.currency,s.country_code FROM repairs r
    LEFT JOIN shop_settings s ON s.owner_id=r.owner_id WHERE r.${keyColumn}=?`).bind(key).first<Row>();
  if (!row) return null;
  const total = Number((kind === "invoice" && Number(row.final_cost ?? 0) > 0) ? row.final_cost : row.estimate ?? 0);
  const taxRate = Math.max(0, Number(row.tax_rate ?? 0));
  const subtotal = taxRate > 0 ? total / (1 + taxRate / 100) : total;
  return {
    kind, ticket: String(row.ticket), shopName: String(row.shop_name ?? "RepairTrace workshop"), currency: String(row.currency ?? "EUR"),
    countryCode: String(row.country_code ?? "PT"), customer: String(row.customer_name), device: String(row.device),
    issue: String(row.issue), diagnosis: String(row.diagnosis ?? ""), total, subtotal, tax: total - subtotal, taxRate,
    quoteStatus: String(row.quote_status ?? "draft"), quoteSentAt: row.quote_sent_at ? String(row.quote_sent_at) : null,
    quoteRespondedAt: row.quote_responded_at ? String(row.quote_responded_at) : null,
    invoiceNumber: String(row.invoice_number ?? ""), invoiceStatus: String(row.invoice_status ?? "not_created"),
    invoiceIssuedAt: row.invoice_issued_at ? String(row.invoice_issued_at) : null, amountPaid: Number(row.amount_paid ?? 0),
    warrantyDays: Number(row.warranty_days ?? 90), assignedTechnician: String(row.assigned_technician ?? ""),
  };
}

export async function respondToQuote(key: string, response: "approved" | "declined") {
  await ensureRepairDatabase();
  const db = database();
  const row = await db.prepare("SELECT id,quote_status FROM repairs WHERE quote_key=?").bind(key).first<Row>();
  if (!row) return null;
  const current=String(row.quote_status);if(current===response)return getCommercialDocument(key,"quote");
  if(current!=="sent")throw new Error("This quote has already been answered or is no longer active.");
  const result=await db.prepare("UPDATE repairs SET quote_status=?,quote_responded_at=CURRENT_TIMESTAMP,updated_at=CURRENT_TIMESTAMP WHERE id=? AND quote_status='sent'")
    .bind(response, String(row.id)).run();
  if(!result.meta.changes)throw new Error("This quote was answered in another session. Refresh to see the latest response.");
  await db.prepare("INSERT INTO repair_events (id,repair_id,title,detail) VALUES (?,?,?,?)")
    .bind(crypto.randomUUID(), String(row.id), response === "approved" ? "Quote approved by customer" : "Quote declined by customer", "Response recorded from the secure customer quote link.").run();
  return getCommercialDocument(key, "quote");
}
