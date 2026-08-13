import { env } from "cloudflare:workers";

const STATUSES = new Set(["Intake", "Diagnosing", "Waiting for part", "Ready", "Completed"]);

type Row = Record<string, unknown>;

let readyPromise: Promise<void> | null = null;

export function createPublicKey(prefix: "track" | "certificate" | "quote" | "invoice") {
  const bytes = crypto.getRandomValues(new Uint8Array(24));
  const encoded = btoa(String.fromCharCode(...bytes)).replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/, "");
  return `${prefix}_${encoded}`;
}

export function defaultClientMessage(status: string) {
  if (status === "Diagnosing") return "A technician is diagnosing the reported issue.";
  if (status === "Waiting for part") return "The repair is waiting for the required part.";
  if (status === "Ready") return "Your device is ready to collect. Please follow the shop's collection instructions.";
  if (status === "Completed") return "The repair is complete. Your warranty and procedure record is now available.";
  return "Your device has been received and added to the workshop queue.";
}

function database() {
  if (!env.DB) throw new Error("RepairTrace database is unavailable.");
  return env.DB;
}

async function createTables() {
  const db = database();
  await db.batch([
    db.prepare(`CREATE TABLE IF NOT EXISTS app_meta (key TEXT PRIMARY KEY, value TEXT NOT NULL)`),
    db.prepare(`CREATE TABLE IF NOT EXISTS repairs (
      id TEXT PRIMARY KEY, owner_id TEXT NOT NULL DEFAULT '', intake_key TEXT NOT NULL DEFAULT '', ticket TEXT NOT NULL UNIQUE, customer_name TEXT NOT NULL,
      customer_email TEXT NOT NULL DEFAULT '', customer_phone TEXT NOT NULL DEFAULT '', customer_id TEXT NOT NULL DEFAULT '',
      device TEXT NOT NULL, category TEXT NOT NULL DEFAULT 'Other', serial_number TEXT NOT NULL DEFAULT '',
      issue TEXT NOT NULL, diagnosis TEXT NOT NULL DEFAULT 'Awaiting diagnosis.',
      status TEXT NOT NULL DEFAULT 'Intake', priority TEXT NOT NULL DEFAULT 'Standard', due TEXT NOT NULL DEFAULT '',
      estimate REAL NOT NULL DEFAULT 0, labor_rate REAL NOT NULL DEFAULT 38,
      include_labor INTEGER NOT NULL DEFAULT 1, actual_labor_hours REAL NOT NULL DEFAULT 0,
      part_quality TEXT NOT NULL DEFAULT 'Unspecified', repair_outcome TEXT NOT NULL DEFAULT 'Pending',
      warranty_return INTEGER NOT NULL DEFAULT 0, final_cost REAL NOT NULL DEFAULT 0,
      warranty_days INTEGER NOT NULL DEFAULT 90, published INTEGER NOT NULL DEFAULT 0,
      tracking_key TEXT NOT NULL DEFAULT '', certificate_key TEXT NOT NULL DEFAULT '',
      client_update TEXT NOT NULL DEFAULT 'Device received by the workshop.', client_updated_at TEXT,
      assigned_technician TEXT NOT NULL DEFAULT '', appointment_at TEXT NOT NULL DEFAULT '', internal_notes TEXT NOT NULL DEFAULT '',
      quote_key TEXT NOT NULL DEFAULT '', quote_status TEXT NOT NULL DEFAULT 'draft', quote_sent_at TEXT, quote_responded_at TEXT,
      invoice_key TEXT NOT NULL DEFAULT '', invoice_number TEXT NOT NULL DEFAULT '', invoice_status TEXT NOT NULL DEFAULT 'not_created',
      invoice_issued_at TEXT, tax_rate REAL NOT NULL DEFAULT 0, amount_paid REAL NOT NULL DEFAULT 0,
      completed_at TEXT, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    )`),
    db.prepare(`CREATE TABLE IF NOT EXISTS repair_tests (
      id TEXT PRIMARY KEY, repair_id TEXT NOT NULL, label TEXT NOT NULL,
      result TEXT NOT NULL DEFAULT 'pending', FOREIGN KEY (repair_id) REFERENCES repairs(id) ON DELETE CASCADE
    )`),
    db.prepare(`CREATE TABLE IF NOT EXISTS repair_parts (
      id TEXT PRIMARY KEY, repair_id TEXT NOT NULL, name TEXT NOT NULL, sku TEXT NOT NULL DEFAULT '',
      supplier TEXT NOT NULL DEFAULT 'Manual entry', quantity INTEGER NOT NULL DEFAULT 1,
      cost REAL NOT NULL DEFAULT 0, FOREIGN KEY (repair_id) REFERENCES repairs(id) ON DELETE CASCADE
    )`),
    db.prepare(`CREATE TABLE IF NOT EXISTS repair_photos (
      id TEXT PRIMARY KEY, repair_id TEXT NOT NULL, object_key TEXT NOT NULL, file_name TEXT NOT NULL,
      content_type TEXT NOT NULL, caption TEXT NOT NULL DEFAULT 'Repair evidence',
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (repair_id) REFERENCES repairs(id) ON DELETE CASCADE
    )`),
    db.prepare(`CREATE TABLE IF NOT EXISTS repair_events (
      id TEXT PRIMARY KEY, repair_id TEXT NOT NULL, title TEXT NOT NULL, detail TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (repair_id) REFERENCES repairs(id) ON DELETE CASCADE
    )`),
    db.prepare(`CREATE TABLE IF NOT EXISTS repair_client_updates (
      id TEXT PRIMARY KEY, repair_id TEXT NOT NULL, status TEXT NOT NULL, message TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (repair_id) REFERENCES repairs(id) ON DELETE CASCADE
    )`),
    db.prepare(`CREATE TABLE IF NOT EXISTS repair_notifications (
      id TEXT PRIMARY KEY, repair_id TEXT NOT NULL, channel TEXT NOT NULL,
      destination_masked TEXT NOT NULL DEFAULT '', status TEXT NOT NULL,
      provider_message_id TEXT NOT NULL DEFAULT '', detail TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (repair_id) REFERENCES repairs(id) ON DELETE CASCADE
    )`),
    db.prepare(`CREATE TABLE IF NOT EXISTS repair_ai_estimates (
      id TEXT PRIMARY KEY, repair_id TEXT NOT NULL UNIQUE, recognized_model TEXT NOT NULL,
      fault_key TEXT NOT NULL, fault_label TEXT NOT NULL, recommended_part TEXT NOT NULL,
      faults_json TEXT NOT NULL DEFAULT '[]',
      confidence TEXT NOT NULL, confidence_score REAL NOT NULL,
      part_low REAL NOT NULL, part_typical REAL NOT NULL, part_high REAL NOT NULL,
      labor_hours REAL NOT NULL, labor_rate REAL NOT NULL, labor_cost REAL NOT NULL,
      include_labor INTEGER NOT NULL DEFAULT 1,
      quote_low REAL NOT NULL, quote_recommended REAL NOT NULL, quote_high REAL NOT NULL,
      currency TEXT NOT NULL DEFAULT 'EUR', rationale TEXT NOT NULL, guide_url TEXT NOT NULL DEFAULT '',
      status TEXT NOT NULL DEFAULT 'ready', researched_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (repair_id) REFERENCES repairs(id) ON DELETE CASCADE
    )`),
    db.prepare(`CREATE TABLE IF NOT EXISTS repair_ai_sources (
      id TEXT PRIMARY KEY, estimate_id TEXT NOT NULL, merchant TEXT NOT NULL, title TEXT NOT NULL,
      url TEXT NOT NULL, price REAL, currency TEXT NOT NULL DEFAULT 'EUR', is_live INTEGER NOT NULL DEFAULT 0,
      retrieved_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (estimate_id) REFERENCES repair_ai_estimates(id) ON DELETE CASCADE
    )`),
    db.prepare(`CREATE TABLE IF NOT EXISTS repair_guides (
      id TEXT PRIMARY KEY, repair_id TEXT NOT NULL UNIQUE, recognized_model TEXT NOT NULL,
      title TEXT NOT NULL, difficulty TEXT NOT NULL, estimated_minutes INTEGER NOT NULL,
      risk_level TEXT NOT NULL, overview TEXT NOT NULL, tools_json TEXT NOT NULL DEFAULT '[]',
      parts_json TEXT NOT NULL DEFAULT '[]', precautions_json TEXT NOT NULL DEFAULT '[]',
      steps_json TEXT NOT NULL DEFAULT '[]', source_url TEXT NOT NULL DEFAULT '',
      source_label TEXT NOT NULL DEFAULT 'Model-specific reference',
      source_guide_id INTEGER, source_match_level TEXT NOT NULL DEFAULT 'Unverified',
      source_checked_at TEXT NOT NULL DEFAULT '', verified_detail_count INTEGER NOT NULL DEFAULT 0,
      generated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (repair_id) REFERENCES repairs(id) ON DELETE CASCADE
    )`),
    db.prepare(`CREATE TABLE IF NOT EXISTS repair_ifixit_guides (
      id TEXT PRIMARY KEY, repair_id TEXT NOT NULL, guide_id INTEGER NOT NULL,
      title TEXT NOT NULL, subject TEXT NOT NULL DEFAULT '', category TEXT NOT NULL DEFAULT '',
      url TEXT NOT NULL, summary TEXT NOT NULL DEFAULT '', difficulty TEXT NOT NULL DEFAULT '',
      duration TEXT NOT NULL DEFAULT '', match_score REAL NOT NULL DEFAULT 0,
      match_level TEXT NOT NULL DEFAULT 'Possible', selected INTEGER NOT NULL DEFAULT 0,
      tools_json TEXT NOT NULL DEFAULT '[]', specifics_json TEXT NOT NULL DEFAULT '[]',
      step_count INTEGER NOT NULL DEFAULT 0, search_query TEXT NOT NULL DEFAULT '',
      retrieved_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (repair_id) REFERENCES repairs(id) ON DELETE CASCADE,
      UNIQUE (repair_id,guide_id)
    )`),
    db.prepare(`CREATE TABLE IF NOT EXISTS shop_settings (
      owner_id TEXT PRIMARY KEY, shop_name TEXT NOT NULL DEFAULT 'Rush Electronics', share_repair_data INTEGER NOT NULL DEFAULT 0,
      country_code TEXT NOT NULL DEFAULT 'PT', currency TEXT NOT NULL DEFAULT 'EUR',
      default_labor_rate REAL NOT NULL DEFAULT 38, include_labor_by_default INTEGER NOT NULL DEFAULT 1,
      marketplace_enabled INTEGER NOT NULL DEFAULT 0, marketplace_city TEXT NOT NULL DEFAULT '',
      marketplace_region TEXT NOT NULL DEFAULT '', marketplace_address_label TEXT NOT NULL DEFAULT '',
      marketplace_latitude REAL, marketplace_longitude REAL, marketplace_radius_km INTEGER NOT NULL DEFAULT 30,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    )`),
    db.prepare(`CREATE TABLE IF NOT EXISTS customers (
      id TEXT PRIMARY KEY, owner_id TEXT NOT NULL, name TEXT NOT NULL, email TEXT NOT NULL DEFAULT '',
      phone TEXT NOT NULL DEFAULT '', company TEXT NOT NULL DEFAULT '', notes TEXT NOT NULL DEFAULT '', tags TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    )`),
    db.prepare(`CREATE TABLE IF NOT EXISTS inventory_items (
      id TEXT PRIMARY KEY, owner_id TEXT NOT NULL, name TEXT NOT NULL, sku TEXT NOT NULL DEFAULT '', supplier TEXT NOT NULL DEFAULT '',
      compatible_models TEXT NOT NULL DEFAULT '', location TEXT NOT NULL DEFAULT '', quantity INTEGER NOT NULL DEFAULT 0,
      reorder_level INTEGER NOT NULL DEFAULT 2, unit_cost REAL NOT NULL DEFAULT 0, sale_price REAL NOT NULL DEFAULT 0,
      active INTEGER NOT NULL DEFAULT 1, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    )`),
    db.prepare(`CREATE TABLE IF NOT EXISTS shop_technicians (
      id TEXT PRIMARY KEY, owner_id TEXT NOT NULL, name TEXT NOT NULL, email TEXT NOT NULL DEFAULT '', role TEXT NOT NULL DEFAULT 'Technician',
      specialty TEXT NOT NULL DEFAULT 'General repair', active INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    )`),
    db.prepare(`CREATE TABLE IF NOT EXISTS shop_appointments (
      id TEXT PRIMARY KEY, owner_id TEXT NOT NULL, repair_id TEXT NOT NULL DEFAULT '', title TEXT NOT NULL, starts_at TEXT NOT NULL,
      ends_at TEXT NOT NULL DEFAULT '', technician TEXT NOT NULL DEFAULT '', status TEXT NOT NULL DEFAULT 'Scheduled', notes TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    )`),
    db.prepare(`CREATE TABLE IF NOT EXISTS repair_contribution_links (
      repair_id TEXT PRIMARY KEY, owner_id TEXT NOT NULL, contribution_id TEXT NOT NULL UNIQUE,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    )`),
    db.prepare(`CREATE TABLE IF NOT EXISTS repair_intelligence_records (
      id TEXT PRIMARY KEY, model_key TEXT NOT NULL, display_model TEXT NOT NULL,
      category TEXT NOT NULL DEFAULT 'Other', faults_json TEXT NOT NULL DEFAULT '[]',
      part_cost REAL, labor_hours REAL, labor_rate REAL, total_price REAL,
      currency TEXT NOT NULL DEFAULT 'EUR', country_code TEXT NOT NULL DEFAULT 'PT',
      part_quality TEXT NOT NULL DEFAULT 'Unspecified', outcome TEXT NOT NULL DEFAULT 'Pending',
      warranty_return INTEGER NOT NULL DEFAULT 0, repair_date TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    )`),
    db.prepare(`CREATE INDEX IF NOT EXISTS repairs_status_idx ON repairs(status)`),
    db.prepare(`CREATE INDEX IF NOT EXISTS tests_repair_idx ON repair_tests(repair_id)`),
    db.prepare(`CREATE INDEX IF NOT EXISTS parts_repair_idx ON repair_parts(repair_id)`),
    db.prepare(`CREATE INDEX IF NOT EXISTS photos_repair_idx ON repair_photos(repair_id)`),
    db.prepare(`CREATE INDEX IF NOT EXISTS events_repair_idx ON repair_events(repair_id)`),
    db.prepare(`CREATE INDEX IF NOT EXISTS client_updates_repair_idx ON repair_client_updates(repair_id)`),
    db.prepare(`CREATE INDEX IF NOT EXISTS notifications_repair_idx ON repair_notifications(repair_id)`),
    db.prepare(`CREATE INDEX IF NOT EXISTS ai_sources_estimate_idx ON repair_ai_sources(estimate_id)`),
    db.prepare(`CREATE INDEX IF NOT EXISTS repair_guides_repair_idx ON repair_guides(repair_id)`),
    db.prepare(`CREATE INDEX IF NOT EXISTS ifixit_guides_repair_idx ON repair_ifixit_guides(repair_id)`),
    db.prepare(`CREATE INDEX IF NOT EXISTS contribution_links_owner_idx ON repair_contribution_links(owner_id)`),
    db.prepare(`CREATE INDEX IF NOT EXISTS intelligence_model_idx ON repair_intelligence_records(model_key)`),
    db.prepare(`CREATE INDEX IF NOT EXISTS intelligence_country_idx ON repair_intelligence_records(country_code)`),
    db.prepare(`CREATE INDEX IF NOT EXISTS customers_owner_idx ON customers(owner_id)`),
    db.prepare(`CREATE INDEX IF NOT EXISTS inventory_owner_idx ON inventory_items(owner_id)`),
    db.prepare(`CREATE INDEX IF NOT EXISTS technicians_owner_idx ON shop_technicians(owner_id)`),
    db.prepare(`CREATE INDEX IF NOT EXISTS appointments_owner_idx ON shop_appointments(owner_id)`),
    db.prepare(`CREATE INDEX IF NOT EXISTS appointments_repair_idx ON shop_appointments(repair_id)`),
  ]);
}

async function migrateLegacyTables() {
  const db=database();
  const [repairColumns,estimateColumns,guideColumns,settingsColumns]=await Promise.all([
    db.prepare("PRAGMA table_info(repairs)").all<Row>(),
    db.prepare("PRAGMA table_info(repair_ai_estimates)").all<Row>(),
    db.prepare("PRAGMA table_info(repair_guides)").all<Row>(),
    db.prepare("PRAGMA table_info(shop_settings)").all<Row>(),
  ]);
  const repairNames=new Set(repairColumns.results.map((column)=>String(column.name)));
  const estimateNames=new Set(estimateColumns.results.map((column)=>String(column.name)));
  const guideNames=new Set(guideColumns.results.map((column)=>String(column.name)));
  const settingsNames=new Set(settingsColumns.results.map((column)=>String(column.name)));
  const statements=[];
  if(!repairNames.has("owner_id"))statements.push(db.prepare("ALTER TABLE repairs ADD COLUMN owner_id TEXT NOT NULL DEFAULT ''"));
  if(!repairNames.has("intake_key"))statements.push(db.prepare("ALTER TABLE repairs ADD COLUMN intake_key TEXT NOT NULL DEFAULT ''"));
  if(!repairNames.has("labor_rate"))statements.push(db.prepare("ALTER TABLE repairs ADD COLUMN labor_rate REAL NOT NULL DEFAULT 38"));
  if(!repairNames.has("include_labor"))statements.push(db.prepare("ALTER TABLE repairs ADD COLUMN include_labor INTEGER NOT NULL DEFAULT 1"));
  if(!repairNames.has("actual_labor_hours"))statements.push(db.prepare("ALTER TABLE repairs ADD COLUMN actual_labor_hours REAL NOT NULL DEFAULT 0"));
  if(!repairNames.has("part_quality"))statements.push(db.prepare("ALTER TABLE repairs ADD COLUMN part_quality TEXT NOT NULL DEFAULT 'Unspecified'"));
  if(!repairNames.has("repair_outcome"))statements.push(db.prepare("ALTER TABLE repairs ADD COLUMN repair_outcome TEXT NOT NULL DEFAULT 'Pending'"));
  if(!repairNames.has("warranty_return"))statements.push(db.prepare("ALTER TABLE repairs ADD COLUMN warranty_return INTEGER NOT NULL DEFAULT 0"));
  if(!repairNames.has("tracking_key"))statements.push(db.prepare("ALTER TABLE repairs ADD COLUMN tracking_key TEXT NOT NULL DEFAULT ''"));
  if(!repairNames.has("certificate_key"))statements.push(db.prepare("ALTER TABLE repairs ADD COLUMN certificate_key TEXT NOT NULL DEFAULT ''"));
  if(!repairNames.has("client_update"))statements.push(db.prepare("ALTER TABLE repairs ADD COLUMN client_update TEXT NOT NULL DEFAULT 'Device received by the workshop.'"));
  if(!repairNames.has("client_updated_at"))statements.push(db.prepare("ALTER TABLE repairs ADD COLUMN client_updated_at TEXT"));
  if(!repairNames.has("customer_id"))statements.push(db.prepare("ALTER TABLE repairs ADD COLUMN customer_id TEXT NOT NULL DEFAULT ''"));
  if(!repairNames.has("assigned_technician"))statements.push(db.prepare("ALTER TABLE repairs ADD COLUMN assigned_technician TEXT NOT NULL DEFAULT ''"));
  if(!repairNames.has("appointment_at"))statements.push(db.prepare("ALTER TABLE repairs ADD COLUMN appointment_at TEXT NOT NULL DEFAULT ''"));
  if(!repairNames.has("internal_notes"))statements.push(db.prepare("ALTER TABLE repairs ADD COLUMN internal_notes TEXT NOT NULL DEFAULT ''"));
  if(!repairNames.has("quote_key"))statements.push(db.prepare("ALTER TABLE repairs ADD COLUMN quote_key TEXT NOT NULL DEFAULT ''"));
  if(!repairNames.has("quote_status"))statements.push(db.prepare("ALTER TABLE repairs ADD COLUMN quote_status TEXT NOT NULL DEFAULT 'draft'"));
  if(!repairNames.has("quote_sent_at"))statements.push(db.prepare("ALTER TABLE repairs ADD COLUMN quote_sent_at TEXT"));
  if(!repairNames.has("quote_responded_at"))statements.push(db.prepare("ALTER TABLE repairs ADD COLUMN quote_responded_at TEXT"));
  if(!repairNames.has("invoice_key"))statements.push(db.prepare("ALTER TABLE repairs ADD COLUMN invoice_key TEXT NOT NULL DEFAULT ''"));
  if(!repairNames.has("invoice_number"))statements.push(db.prepare("ALTER TABLE repairs ADD COLUMN invoice_number TEXT NOT NULL DEFAULT ''"));
  if(!repairNames.has("invoice_status"))statements.push(db.prepare("ALTER TABLE repairs ADD COLUMN invoice_status TEXT NOT NULL DEFAULT 'not_created'"));
  if(!repairNames.has("invoice_issued_at"))statements.push(db.prepare("ALTER TABLE repairs ADD COLUMN invoice_issued_at TEXT"));
  if(!repairNames.has("tax_rate"))statements.push(db.prepare("ALTER TABLE repairs ADD COLUMN tax_rate REAL NOT NULL DEFAULT 0"));
  if(!repairNames.has("amount_paid"))statements.push(db.prepare("ALTER TABLE repairs ADD COLUMN amount_paid REAL NOT NULL DEFAULT 0"));
  if(!estimateNames.has("faults_json"))statements.push(db.prepare("ALTER TABLE repair_ai_estimates ADD COLUMN faults_json TEXT NOT NULL DEFAULT '[]'"));
  if(!estimateNames.has("include_labor"))statements.push(db.prepare("ALTER TABLE repair_ai_estimates ADD COLUMN include_labor INTEGER NOT NULL DEFAULT 1"));
  if(!guideNames.has("source_guide_id"))statements.push(db.prepare("ALTER TABLE repair_guides ADD COLUMN source_guide_id INTEGER"));
  if(!guideNames.has("source_match_level"))statements.push(db.prepare("ALTER TABLE repair_guides ADD COLUMN source_match_level TEXT NOT NULL DEFAULT 'Unverified'"));
  if(!guideNames.has("source_checked_at"))statements.push(db.prepare("ALTER TABLE repair_guides ADD COLUMN source_checked_at TEXT NOT NULL DEFAULT ''"));
  if(!guideNames.has("verified_detail_count"))statements.push(db.prepare("ALTER TABLE repair_guides ADD COLUMN verified_detail_count INTEGER NOT NULL DEFAULT 0"));
  if(!settingsNames.has("shop_name"))statements.push(db.prepare("ALTER TABLE shop_settings ADD COLUMN shop_name TEXT NOT NULL DEFAULT 'Rush Electronics'"));
  if(!settingsNames.has("marketplace_enabled"))statements.push(db.prepare("ALTER TABLE shop_settings ADD COLUMN marketplace_enabled INTEGER NOT NULL DEFAULT 0"));
  if(!settingsNames.has("marketplace_city"))statements.push(db.prepare("ALTER TABLE shop_settings ADD COLUMN marketplace_city TEXT NOT NULL DEFAULT ''"));
  if(!settingsNames.has("marketplace_region"))statements.push(db.prepare("ALTER TABLE shop_settings ADD COLUMN marketplace_region TEXT NOT NULL DEFAULT ''"));
  if(!settingsNames.has("marketplace_address_label"))statements.push(db.prepare("ALTER TABLE shop_settings ADD COLUMN marketplace_address_label TEXT NOT NULL DEFAULT ''"));
  if(!settingsNames.has("marketplace_latitude"))statements.push(db.prepare("ALTER TABLE shop_settings ADD COLUMN marketplace_latitude REAL"));
  if(!settingsNames.has("marketplace_longitude"))statements.push(db.prepare("ALTER TABLE shop_settings ADD COLUMN marketplace_longitude REAL"));
  if(!settingsNames.has("marketplace_radius_km"))statements.push(db.prepare("ALTER TABLE shop_settings ADD COLUMN marketplace_radius_km INTEGER NOT NULL DEFAULT 30"));
  if(statements.length)await db.batch(statements);
  await db.batch([
    db.prepare("CREATE INDEX IF NOT EXISTS repairs_owner_idx ON repairs(owner_id)"),
    db.prepare("CREATE UNIQUE INDEX IF NOT EXISTS repairs_intake_key_unique ON repairs(owner_id,intake_key) WHERE intake_key <> ''"),
    db.prepare("CREATE UNIQUE INDEX IF NOT EXISTS repairs_tracking_key_idx ON repairs(tracking_key) WHERE tracking_key <> ''"),
    db.prepare("CREATE UNIQUE INDEX IF NOT EXISTS repairs_certificate_key_idx ON repairs(certificate_key) WHERE certificate_key <> ''"),
    db.prepare("CREATE INDEX IF NOT EXISTS repairs_customer_idx ON repairs(customer_id)"),
    db.prepare("CREATE UNIQUE INDEX IF NOT EXISTS repairs_quote_key_unique ON repairs(quote_key) WHERE quote_key <> ''"),
    db.prepare("CREATE UNIQUE INDEX IF NOT EXISTS repairs_invoice_key_unique ON repairs(invoice_key) WHERE invoice_key <> ''"),
    db.prepare("CREATE UNIQUE INDEX IF NOT EXISTS inventory_owner_sku_unique ON inventory_items(owner_id,sku) WHERE sku <> ''"),
    db.prepare("UPDATE repairs SET repair_outcome='Successful' WHERE status='Completed' AND repair_outcome='Pending'"),
    db.prepare("UPDATE repair_ifixit_guides SET specifics_json='[]' WHERE specifics_json<>'[]'"),
    db.prepare("UPDATE repair_guides SET verified_detail_count=0"),
  ]);
  const missingKeys=await db.prepare("SELECT id,status,client_update,client_updated_at FROM repairs WHERE tracking_key='' OR certificate_key='' OR quote_key='' OR invoice_key='' ").all<Row>();
  if(missingKeys.results.length){
    const keyStatements=[];
    for(const row of missingKeys.results){
      const message=String(row.client_update||defaultClientMessage(String(row.status)));
      keyStatements.push(db.prepare("UPDATE repairs SET tracking_key=CASE WHEN tracking_key='' THEN ? ELSE tracking_key END,certificate_key=CASE WHEN certificate_key='' THEN ? ELSE certificate_key END,quote_key=CASE WHEN quote_key='' THEN ? ELSE quote_key END,invoice_key=CASE WHEN invoice_key='' THEN ? ELSE invoice_key END,client_update=?,client_updated_at=COALESCE(client_updated_at,updated_at) WHERE id=?").bind(createPublicKey("track"),createPublicKey("certificate"),createPublicKey("quote"),createPublicKey("invoice"),message,String(row.id)));
      keyStatements.push(db.prepare("INSERT INTO repair_client_updates (id,repair_id,status,message,created_at) SELECT ?,?,?,?,COALESCE(client_updated_at,updated_at) FROM repairs WHERE id=? AND NOT EXISTS (SELECT 1 FROM repair_client_updates WHERE repair_id=?)").bind(crypto.randomUUID(),String(row.id),String(row.status),message,String(row.id),String(row.id)));
    }
    await db.batch(keyStatements);
  }
}

const seeds = [
  ["seed-421", "RT-2608-0421", "Sofia Martins", "sofia@example.com", "+351 912 345 678", "iPhone 14 Pro", "Phone", "F2LXL9R7J6", "Battery drains quickly and the phone becomes warm while charging.", "Battery health measured at 71%. Replacement completed and charging is stable.", "Ready", "Standard", "2026-08-08", 89, 89, 180, 0],
  ["seed-420", "RT-2608-0420", "Luís Costa", "luis@example.com", "+351 934 782 101", "Nintendo Switch OLED", "Console", "XTJ700412983", "Console no longer charges through USB-C.", "Port damage confirmed. Board inspection is in progress.", "Diagnosing", "Priority", "2026-08-09", 65, 0, 90, 0],
  ["seed-419", "RT-2608-0419", "Ana Ribeiro", "ana@example.com", "+351 966 234 014", "MacBook Air M2", "Laptop", "C02YV2KQJQ6L", "Liquid spilled near keyboard; device powers on intermittently.", "Upper case requires replacement. Logic board cleaned and stable.", "Waiting for part", "Standard", "2026-08-12", 174, 0, 90, 0],
  ["seed-418", "RT-2608-0418", "Duarte Silva", "duarte@example.com", "+351 918 440 227", "Sony WH-1000XM4", "Audio", "S01-446127", "Broken right hinge and loose headband.", "Awaiting bench inspection.", "Intake", "Standard", "2026-08-14", 48, 0, 90, 0],
  ["seed-417", "RT-2608-0417", "Inês Ferreira", "ines@example.com", "+351 927 188 347", "Samsung Galaxy S23", "Phone", "R5CW11D2X8M", "Display cracked after impact.", "Display assembly replaced; frame and cameras unaffected.", "Completed", "Standard", "2026-08-06", 219, 219, 180, 1],
] as const;

async function seed() {
  const db = database();
  const marker = await db.prepare("SELECT value FROM app_meta WHERE key = ?").bind("seeded-v1").first();
  if (marker) return;
  const statements = seeds.map((item) => db.prepare(`INSERT OR IGNORE INTO repairs
    (id,ticket,customer_name,customer_email,customer_phone,device,category,serial_number,issue,diagnosis,status,priority,due,estimate,final_cost,warranty_days,published,repair_outcome,completed_at,tracking_key,certificate_key,quote_key,invoice_key,client_update,client_updated_at)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,CURRENT_TIMESTAMP)`).bind(...item, item[10] === "Completed" ? "Successful" : "Pending", item[10] === "Completed" ? "2026-08-06T17:05:00Z" : null,createPublicKey("track"),createPublicKey("certificate"),createPublicKey("quote"),createPublicKey("invoice"),defaultClientMessage(item[10])));
  const labels = ["Power and charging", "Controls and ports", "Wireless connectivity", "Thermal stability", "Cosmetic inspection"];
  for (const item of seeds) {
    labels.forEach((label, index) => statements.push(db.prepare("INSERT OR IGNORE INTO repair_tests (id,repair_id,label,result) VALUES (?,?,?,?)").bind(`${item[0]}-test-${index}`, item[0], label, item[10] === "Completed" || item[10] === "Ready" ? "passed" : index === 4 ? "passed" : "pending")));
    statements.push(db.prepare("INSERT OR IGNORE INTO repair_events (id,repair_id,title,detail) VALUES (?,?,?,?)").bind(`${item[0]}-event`, item[0], "Device checked in", item[8]));
    statements.push(db.prepare("INSERT OR IGNORE INTO repair_client_updates (id,repair_id,status,message) VALUES (?,?,?,?)").bind(`${item[0]}-client-event`,item[0],item[10],defaultClientMessage(item[10])));
  }
  statements.push(db.prepare("INSERT OR REPLACE INTO app_meta (key,value) VALUES (?,?)").bind("seeded-v1", "true"));
  await db.batch(statements);
}

/**
 * Retained only as an explicit recovery utility for databases created before
 * deploy-time migrations were available. Never call this from a request.
 */
export async function runLegacyRepairBootstrapForRecovery() {
  if (!readyPromise) readyPromise = createTables().then(migrateLegacyTables).then(seed).catch((error) => { readyPromise = null; throw error; });
  await readyPromise;
}

export async function ensureRepairDatabase() {
  // Sites applies the checked-in Drizzle migrations before serving traffic.
  // Runtime DDL caused concurrent mobile requests to wait on the same database
  // lock, so request handlers now only verify that the binding exists.
  database();
}

function repairFromRow(row: Row) {
  return {
    id: String(row.id), ticket: String(row.ticket), customer: String(row.customer_name),
    customerEmail: String(row.customer_email ?? ""), customerPhone: String(row.customer_phone ?? ""),
    device: String(row.device), category: String(row.category ?? "Other"), serialNumber: String(row.serial_number ?? ""),
    issue: String(row.issue), diagnosis: String(row.diagnosis ?? "Awaiting diagnosis."),
    status: String(row.status), priority: String(row.priority ?? "Standard"), due: String(row.due ?? ""),
    estimate: Number(row.estimate ?? 0), laborRate: Number(row.labor_rate ?? 38), includeLabor: Boolean(row.include_labor ?? 1),
    actualLaborHours: Number(row.actual_labor_hours ?? 0), partQuality: String(row.part_quality ?? "Unspecified"),
    repairOutcome: String(row.repair_outcome ?? "Pending"), warrantyReturn: Boolean(row.warranty_return ?? 0),
    finalCost: Number(row.final_cost ?? 0), warrantyDays: Number(row.warranty_days ?? 90),
    published: Boolean(row.published), completedAt: row.completed_at ? String(row.completed_at) : null,
    trackingPath: row.tracking_key ? `/track/${String(row.tracking_key)}` : "",
    certificatePath: row.certificate_key ? `/c/${String(row.certificate_key)}` : "",
    quotePath: row.quote_key ? `/quote/${String(row.quote_key)}` : "",
    quoteStatus: String(row.quote_status ?? "draft"),
    quoteSentAt: row.quote_sent_at ? String(row.quote_sent_at) : null,
    quoteRespondedAt: row.quote_responded_at ? String(row.quote_responded_at) : null,
    invoicePath: row.invoice_key ? `/invoice/${String(row.invoice_key)}` : "",
    invoiceNumber: String(row.invoice_number ?? ""), invoiceStatus: String(row.invoice_status ?? "not_created"),
    invoiceIssuedAt: row.invoice_issued_at ? String(row.invoice_issued_at) : null,
    taxRate: Number(row.tax_rate ?? 0), amountPaid: Number(row.amount_paid ?? 0),
    assignedTechnician: String(row.assigned_technician ?? ""), appointmentAt: String(row.appointment_at ?? ""),
    internalNotes: String(row.internal_notes ?? ""), customerId: String(row.customer_id ?? ""),
    clientUpdate: String(row.client_update ?? defaultClientMessage(String(row.status))),
    clientUpdatedAt: row.client_updated_at ? String(row.client_updated_at) : String(row.updated_at),
    createdAt: String(row.created_at), updatedAt: String(row.updated_at),
  };
}

export async function claimLegacyRepairs(ownerId: string) {
  await ensureRepairDatabase();
  // Legacy rows may be claimed only during the one-time transition into an empty
  // ownership namespace. Once any owner exists, unowned rows stay quarantined.
  const claimedOwner=await database().prepare("SELECT owner_id FROM repairs WHERE owner_id<>'' AND owner_id IS NOT NULL LIMIT 1").first<Row>();
  if(claimedOwner)return;
  const legacy=await database().prepare("SELECT id FROM repairs WHERE owner_id='' OR owner_id IS NULL LIMIT 1").first<Row>();
  if(!legacy)return;
  await database().prepare("UPDATE repairs SET owner_id=? WHERE owner_id='' OR owner_id IS NULL").bind(ownerId).run();
}

export async function listRepairs(ownerId: string) {
  await ensureRepairDatabase();
  await claimLegacyRepairs(ownerId);
  const result = await database().prepare("SELECT * FROM repairs WHERE owner_id=? ORDER BY datetime(created_at) DESC, ticket DESC").bind(ownerId).all<Row>();
  return result.results.map(repairFromRow);
}

function storedArray(value: unknown) {
  try {
    const parsed = JSON.parse(String(value ?? "[]"));
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export async function getRepair(idOrTicket: string, byTicket = false, ownerId?: string) {
  await ensureRepairDatabase();
  const db = database();
  if (ownerId) await claimLegacyRepairs(ownerId);
  const ownerClause = ownerId ? " AND owner_id = ?" : "";
  const statement = db.prepare(`SELECT * FROM repairs WHERE ${byTicket ? "ticket" : "id"} = ?${ownerClause}`);
  const row = ownerId ? await statement.bind(idOrTicket, ownerId).first<Row>() : await statement.bind(idOrTicket).first<Row>();
  if (!row) return null;
  const id = String(row.id);
  const [tests, parts, photos, events, clientUpdates, notifications, aiEstimateRow, aiSources, repairGuideRow] = await Promise.all([
    db.prepare("SELECT id,label,result FROM repair_tests WHERE repair_id = ? ORDER BY rowid").bind(id).all<Row>(),
    db.prepare("SELECT id,name,sku,supplier,quantity,cost FROM repair_parts WHERE repair_id = ? ORDER BY rowid").bind(id).all<Row>(),
    db.prepare("SELECT id,file_name,caption,created_at FROM repair_photos WHERE repair_id = ? ORDER BY datetime(created_at) DESC").bind(id).all<Row>(),
    db.prepare("SELECT id,title,detail,created_at FROM repair_events WHERE repair_id = ? ORDER BY datetime(created_at) DESC").bind(id).all<Row>(),
    db.prepare("SELECT id,status,message,created_at FROM repair_client_updates WHERE repair_id=? ORDER BY datetime(created_at) DESC").bind(id).all<Row>(),
    db.prepare("SELECT id,channel,destination_masked,status,detail,created_at FROM repair_notifications WHERE repair_id=? ORDER BY datetime(created_at) DESC LIMIT 12").bind(id).all<Row>(),
    db.prepare("SELECT * FROM repair_ai_estimates WHERE repair_id = ?").bind(id).first<Row>(),
    db.prepare("SELECT s.* FROM repair_ai_sources s JOIN repair_ai_estimates e ON e.id=s.estimate_id WHERE e.repair_id=? ORDER BY s.is_live DESC,s.rowid").bind(id).all<Row>(),
    db.prepare("SELECT * FROM repair_guides WHERE repair_id = ?").bind(id).first<Row>(),
  ]);
  let detectedFaults:Array<Record<string,unknown>>=[];
  if(aiEstimateRow){
    try{const parsed=JSON.parse(String(aiEstimateRow.faults_json??"[]"));if(Array.isArray(parsed))detectedFaults=parsed.filter((item)=>item&&typeof item==="object");}catch{/* Legacy estimate: use the single stored fault below. */}
    if(!detectedFaults.length)detectedFaults=[{key:String(aiEstimateRow.fault_key),label:String(aiEstimateRow.fault_label),recommendedPart:String(aiEstimateRow.recommended_part),matchedTerms:[],confidenceScore:Number(aiEstimateRow.confidence_score)}];
  }
  const aiEstimate=aiEstimateRow?{
    id:String(aiEstimateRow.id),recognizedModel:String(aiEstimateRow.recognized_model),faultKey:String(aiEstimateRow.fault_key),faultLabel:String(aiEstimateRow.fault_label),recommendedPart:String(aiEstimateRow.recommended_part),confidence:String(aiEstimateRow.confidence),confidenceScore:Number(aiEstimateRow.confidence_score),
    faults:detectedFaults,partLow:Number(aiEstimateRow.part_low),partTypical:Number(aiEstimateRow.part_typical),partHigh:Number(aiEstimateRow.part_high),laborHours:Number(aiEstimateRow.labor_hours),laborRate:Number(aiEstimateRow.labor_rate),laborCost:Number(aiEstimateRow.labor_cost),includeLabor:Boolean(aiEstimateRow.include_labor??1),quoteLow:Number(aiEstimateRow.quote_low),quoteRecommended:Number(aiEstimateRow.quote_recommended),quoteHigh:Number(aiEstimateRow.quote_high),currency:String(aiEstimateRow.currency),rationale:String(aiEstimateRow.rationale),guideUrl:String(aiEstimateRow.guide_url??""),status:String(aiEstimateRow.status),researchedAt:String(aiEstimateRow.researched_at),
    sources:aiSources.results.map((source)=>({id:String(source.id),merchant:String(source.merchant),title:String(source.title),url:String(source.url),price:source.price===null?null:Number(source.price),currency:String(source.currency),isLive:Boolean(source.is_live),retrievedAt:String(source.retrieved_at)})),
  }:null;
  const repairGuide=repairGuideRow?{
    id:String(repairGuideRow.id),recognizedModel:String(repairGuideRow.recognized_model),title:String(repairGuideRow.title),
    difficulty:String(repairGuideRow.difficulty),estimatedMinutes:Number(repairGuideRow.estimated_minutes),riskLevel:String(repairGuideRow.risk_level),
    overview:String(repairGuideRow.overview),tools:storedArray(repairGuideRow.tools_json),parts:storedArray(repairGuideRow.parts_json),
    precautions:storedArray(repairGuideRow.precautions_json),steps:storedArray(repairGuideRow.steps_json),sourceUrl:String(repairGuideRow.source_url??""),
    sourceLabel:String(repairGuideRow.source_label??"Model-specific reference"),sourceGuideId:repairGuideRow.source_guide_id===null?null:Number(repairGuideRow.source_guide_id),
    sourceMatchLevel:String(repairGuideRow.source_match_level??"Unverified"),sourceCheckedAt:String(repairGuideRow.source_checked_at??""),
    generatedAt:String(repairGuideRow.generated_at),updatedAt:String(repairGuideRow.updated_at),
  }:null;
  return {
    ...repairFromRow(row),
    tests: tests.results.map((test) => ({ id:String(test.id), label:String(test.label), result:String(test.result) })),
    parts: parts.results.map((part) => ({ id:String(part.id), name:String(part.name), sku:String(part.sku), supplier:String(part.supplier), quantity:Number(part.quantity), cost:Number(part.cost) })),
    photos: photos.results.map((photo) => ({ id:String(photo.id), fileName:String(photo.file_name), caption:String(photo.caption), createdAt:String(photo.created_at), url:`/api/photos/${photo.id}` })),
    events: events.results.map((event) => ({ id:String(event.id), title:String(event.title), detail:String(event.detail), createdAt:String(event.created_at) })),
    clientUpdates:clientUpdates.results.map((event)=>({id:String(event.id),status:String(event.status),message:String(event.message),createdAt:String(event.created_at)})),
    notifications:notifications.results.map((item)=>({id:String(item.id),channel:String(item.channel),destinationMasked:String(item.destination_masked),status:String(item.status),detail:String(item.detail),createdAt:String(item.created_at)})),
    aiEstimate,
    repairGuide,
  };
}

export async function getRepairByCertificateKey(certificateKey: string) {
  await ensureRepairDatabase();
  const row=await database().prepare("SELECT id FROM repairs WHERE certificate_key=?").bind(certificateKey).first<Row>();
  return row ? getRepair(String(row.id)) : null;
}

export function validStatus(value: unknown): value is string { return typeof value === "string" && STATUSES.has(value); }
export { database };
