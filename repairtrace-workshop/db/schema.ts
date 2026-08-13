import { sql } from "drizzle-orm";
import { index, integer, real, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

export const repairs = sqliteTable("repairs", {
  id: text("id").primaryKey(),
  ownerId: text("owner_id").notNull().default(""),
  intakeKey: text("intake_key").notNull().default(""),
  ticket: text("ticket").notNull().unique(),
  customerName: text("customer_name").notNull(),
  customerEmail: text("customer_email").notNull().default(""),
  customerPhone: text("customer_phone").notNull().default(""),
  customerId: text("customer_id").notNull().default(""),
  device: text("device").notNull(),
  category: text("category").notNull().default("Other"),
  serialNumber: text("serial_number").notNull().default(""),
  issue: text("issue").notNull(),
  diagnosis: text("diagnosis").notNull().default("Awaiting diagnosis."),
  status: text("status").notNull().default("Intake"),
  priority: text("priority").notNull().default("Standard"),
  due: text("due").notNull().default(""),
  estimate: real("estimate").notNull().default(0),
  laborRate: real("labor_rate").notNull().default(38),
  includeLabor: integer("include_labor", { mode: "boolean" }).notNull().default(true),
  actualLaborHours: real("actual_labor_hours").notNull().default(0),
  partQuality: text("part_quality").notNull().default("Unspecified"),
  repairOutcome: text("repair_outcome").notNull().default("Pending"),
  warrantyReturn: integer("warranty_return", { mode: "boolean" }).notNull().default(false),
  finalCost: real("final_cost").notNull().default(0),
  warrantyDays: integer("warranty_days").notNull().default(90),
  published: integer("published", { mode: "boolean" }).notNull().default(false),
  trackingKey: text("tracking_key").notNull().default(""),
  certificateKey: text("certificate_key").notNull().default(""),
  clientUpdate: text("client_update").notNull().default("Device received by the workshop."),
  clientUpdatedAt: text("client_updated_at"),
  assignedTechnician: text("assigned_technician").notNull().default(""),
  appointmentAt: text("appointment_at").notNull().default(""),
  internalNotes: text("internal_notes").notNull().default(""),
  quoteKey: text("quote_key").notNull().default(""),
  quoteStatus: text("quote_status").notNull().default("draft"),
  quoteSentAt: text("quote_sent_at"),
  quoteRespondedAt: text("quote_responded_at"),
  invoiceKey: text("invoice_key").notNull().default(""),
  invoiceNumber: text("invoice_number").notNull().default(""),
  invoiceStatus: text("invoice_status").notNull().default("not_created"),
  invoiceIssuedAt: text("invoice_issued_at"),
  taxRate: real("tax_rate").notNull().default(0),
  amountPaid: real("amount_paid").notNull().default(0),
  completedAt: text("completed_at"),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
}, (table) => [
  index("repairs_owner_idx").on(table.ownerId),
  index("repairs_customer_idx").on(table.customerId),
  uniqueIndex("repairs_quote_key_unique").on(table.quoteKey).where(sql`${table.quoteKey} <> ''`),
  uniqueIndex("repairs_invoice_key_unique").on(table.invoiceKey).where(sql`${table.invoiceKey} <> ''`),
  uniqueIndex("repairs_intake_key_unique").on(table.ownerId, table.intakeKey).where(sql`${table.intakeKey} <> ''`),
]);

export const customers = sqliteTable("customers", {
  id: text("id").primaryKey(),
  ownerId: text("owner_id").notNull(),
  name: text("name").notNull(),
  email: text("email").notNull().default(""),
  phone: text("phone").notNull().default(""),
  company: text("company").notNull().default(""),
  notes: text("notes").notNull().default(""),
  tags: text("tags").notNull().default(""),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
}, (table) => [
  index("customers_owner_idx").on(table.ownerId),
  index("customers_email_idx").on(table.ownerId, table.email),
]);

export const inventoryItems = sqliteTable("inventory_items", {
  id: text("id").primaryKey(),
  ownerId: text("owner_id").notNull(),
  name: text("name").notNull(),
  sku: text("sku").notNull().default(""),
  supplier: text("supplier").notNull().default(""),
  compatibleModels: text("compatible_models").notNull().default(""),
  location: text("location").notNull().default(""),
  quantity: integer("quantity").notNull().default(0),
  reorderLevel: integer("reorder_level").notNull().default(2),
  unitCost: real("unit_cost").notNull().default(0),
  salePrice: real("sale_price").notNull().default(0),
  active: integer("active", { mode: "boolean" }).notNull().default(true),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
}, (table) => [
  index("inventory_owner_idx").on(table.ownerId),
  uniqueIndex("inventory_owner_sku_unique").on(table.ownerId, table.sku).where(sql`${table.sku} <> ''`),
]);

export const shopTechnicians = sqliteTable("shop_technicians", {
  id: text("id").primaryKey(),
  ownerId: text("owner_id").notNull(),
  name: text("name").notNull(),
  email: text("email").notNull().default(""),
  role: text("role").notNull().default("Technician"),
  specialty: text("specialty").notNull().default("General repair"),
  active: integer("active", { mode: "boolean" }).notNull().default(true),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
}, (table) => [index("technicians_owner_idx").on(table.ownerId)]);

export const shopAppointments = sqliteTable("shop_appointments", {
  id: text("id").primaryKey(),
  ownerId: text("owner_id").notNull(),
  repairId: text("repair_id").notNull().default(""),
  title: text("title").notNull(),
  startsAt: text("starts_at").notNull(),
  endsAt: text("ends_at").notNull().default(""),
  technician: text("technician").notNull().default(""),
  status: text("status").notNull().default("Scheduled"),
  notes: text("notes").notNull().default(""),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
}, (table) => [
  index("appointments_owner_idx").on(table.ownerId),
  index("appointments_repair_idx").on(table.repairId),
]);

export const repairTests = sqliteTable("repair_tests", {
  id: text("id").primaryKey(),
  repairId: text("repair_id").notNull(),
  label: text("label").notNull(),
  result: text("result").notNull().default("pending"),
});

export const repairParts = sqliteTable("repair_parts", {
  id: text("id").primaryKey(),
  repairId: text("repair_id").notNull(),
  name: text("name").notNull(),
  sku: text("sku").notNull().default(""),
  supplier: text("supplier").notNull().default("Manual entry"),
  quantity: integer("quantity").notNull().default(1),
  cost: real("cost").notNull().default(0),
});

export const repairPhotos = sqliteTable("repair_photos", {
  id: text("id").primaryKey(),
  repairId: text("repair_id").notNull(),
  objectKey: text("object_key").notNull(),
  fileName: text("file_name").notNull(),
  contentType: text("content_type").notNull(),
  caption: text("caption").notNull().default("Repair evidence"),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
});

export const repairEvents = sqliteTable("repair_events", {
  id: text("id").primaryKey(),
  repairId: text("repair_id").notNull(),
  title: text("title").notNull(),
  detail: text("detail").notNull().default(""),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
});

export const repairClientUpdates = sqliteTable("repair_client_updates", {
  id: text("id").primaryKey(),
  repairId: text("repair_id").notNull(),
  status: text("status").notNull(),
  message: text("message").notNull(),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
}, (table) => [index("client_updates_repair_idx").on(table.repairId)]);

export const repairNotifications = sqliteTable("repair_notifications", {
  id: text("id").primaryKey(),
  repairId: text("repair_id").notNull(),
  channel: text("channel").notNull(),
  destinationMasked: text("destination_masked").notNull().default(""),
  status: text("status").notNull(),
  providerMessageId: text("provider_message_id").notNull().default(""),
  detail: text("detail").notNull().default(""),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
}, (table) => [index("notifications_repair_idx").on(table.repairId)]);

export const repairAiEstimates = sqliteTable("repair_ai_estimates", {
  id: text("id").primaryKey(),
  repairId: text("repair_id").notNull().unique(),
  recognizedModel: text("recognized_model").notNull(),
  faultKey: text("fault_key").notNull(),
  faultLabel: text("fault_label").notNull(),
  recommendedPart: text("recommended_part").notNull(),
  faultsJson: text("faults_json").notNull().default("[]"),
  confidence: text("confidence").notNull(),
  confidenceScore: real("confidence_score").notNull(),
  partLow: real("part_low").notNull(),
  partTypical: real("part_typical").notNull(),
  partHigh: real("part_high").notNull(),
  laborHours: real("labor_hours").notNull(),
  laborRate: real("labor_rate").notNull(),
  laborCost: real("labor_cost").notNull(),
  includeLabor: integer("include_labor", { mode: "boolean" }).notNull().default(true),
  quoteLow: real("quote_low").notNull(),
  quoteRecommended: real("quote_recommended").notNull(),
  quoteHigh: real("quote_high").notNull(),
  currency: text("currency").notNull().default("EUR"),
  rationale: text("rationale").notNull(),
  guideUrl: text("guide_url").notNull().default(""),
  status: text("status").notNull().default("ready"),
  researchedAt: text("researched_at").notNull().default(sql`CURRENT_TIMESTAMP`),
});

export const repairAiSources = sqliteTable("repair_ai_sources", {
  id: text("id").primaryKey(),
  estimateId: text("estimate_id").notNull(),
  merchant: text("merchant").notNull(),
  title: text("title").notNull(),
  url: text("url").notNull(),
  price: real("price"),
  currency: text("currency").notNull().default("EUR"),
  isLive: integer("is_live", { mode: "boolean" }).notNull().default(false),
  retrievedAt: text("retrieved_at").notNull().default(sql`CURRENT_TIMESTAMP`),
});

export const repairGuides = sqliteTable("repair_guides", {
  id: text("id").primaryKey(),
  repairId: text("repair_id").notNull().unique(),
  recognizedModel: text("recognized_model").notNull(),
  title: text("title").notNull(),
  difficulty: text("difficulty").notNull(),
  estimatedMinutes: integer("estimated_minutes").notNull(),
  riskLevel: text("risk_level").notNull(),
  overview: text("overview").notNull(),
  toolsJson: text("tools_json").notNull().default("[]"),
  partsJson: text("parts_json").notNull().default("[]"),
  precautionsJson: text("precautions_json").notNull().default("[]"),
  stepsJson: text("steps_json").notNull().default("[]"),
  sourceUrl: text("source_url").notNull().default(""),
  sourceLabel: text("source_label").notNull().default("Model-specific reference"),
  sourceGuideId: integer("source_guide_id"),
  sourceMatchLevel: text("source_match_level").notNull().default("Unverified"),
  sourceCheckedAt: text("source_checked_at").notNull().default(""),
  verifiedDetailCount: integer("verified_detail_count").notNull().default(0),
  generatedAt: text("generated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
});

export const repairIfixitGuides = sqliteTable("repair_ifixit_guides", {
  id: text("id").primaryKey(),
  repairId: text("repair_id").notNull(),
  guideId: integer("guide_id").notNull(),
  title: text("title").notNull(),
  subject: text("subject").notNull().default(""),
  category: text("category").notNull().default(""),
  url: text("url").notNull(),
  summary: text("summary").notNull().default(""),
  difficulty: text("difficulty").notNull().default(""),
  duration: text("duration").notNull().default(""),
  matchScore: real("match_score").notNull().default(0),
  matchLevel: text("match_level").notNull().default("Possible"),
  selected: integer("selected", { mode: "boolean" }).notNull().default(false),
  toolsJson: text("tools_json").notNull().default("[]"),
  specificsJson: text("specifics_json").notNull().default("[]"),
  stepCount: integer("step_count").notNull().default(0),
  searchQuery: text("search_query").notNull().default(""),
  retrievedAt: text("retrieved_at").notNull().default(sql`CURRENT_TIMESTAMP`),
}, (table) => [
  index("ifixit_guides_repair_idx").on(table.repairId),
  uniqueIndex("ifixit_guides_repair_guide_unique").on(table.repairId, table.guideId),
]);

export const shopSettings = sqliteTable("shop_settings", {
  ownerId: text("owner_id").primaryKey(),
  shopName: text("shop_name").notNull().default("Rush Electronics"),
  shareRepairData: integer("share_repair_data", { mode: "boolean" }).notNull().default(false),
  countryCode: text("country_code").notNull().default("PT"),
  currency: text("currency").notNull().default("EUR"),
  defaultLaborRate: real("default_labor_rate").notNull().default(38),
  includeLaborByDefault: integer("include_labor_by_default", { mode: "boolean" }).notNull().default(true),
  marketplaceEnabled: integer("marketplace_enabled", { mode: "boolean" }).notNull().default(false),
  marketplaceCity: text("marketplace_city").notNull().default(""),
  marketplaceRegion: text("marketplace_region").notNull().default(""),
  marketplaceAddressLabel: text("marketplace_address_label").notNull().default(""),
  marketplaceLatitude: real("marketplace_latitude"),
  marketplaceLongitude: real("marketplace_longitude"),
  marketplaceRadiusKm: integer("marketplace_radius_km").notNull().default(30),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
});

// This private link table allows a shop to revoke its contributions. It is never
// queried by the public benchmark response.
export const repairContributionLinks = sqliteTable("repair_contribution_links", {
  repairId: text("repair_id").primaryKey(),
  ownerId: text("owner_id").notNull(),
  contributionId: text("contribution_id").notNull().unique(),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
}, (table) => [index("contribution_links_owner_idx").on(table.ownerId)]);

// Sanitized repair facts only. Customer details, serial numbers, notes, photos,
// ticket identifiers and shop identity deliberately have no columns here.
export const repairIntelligenceRecords = sqliteTable("repair_intelligence_records", {
  id: text("id").primaryKey(),
  modelKey: text("model_key").notNull(),
  displayModel: text("display_model").notNull(),
  category: text("category").notNull().default("Other"),
  faultsJson: text("faults_json").notNull().default("[]"),
  partCost: real("part_cost"),
  laborHours: real("labor_hours"),
  laborRate: real("labor_rate"),
  totalPrice: real("total_price"),
  currency: text("currency").notNull().default("EUR"),
  countryCode: text("country_code").notNull().default("PT"),
  partQuality: text("part_quality").notNull().default("Unspecified"),
  outcome: text("outcome").notNull().default("Pending"),
  warrantyReturn: integer("warranty_return", { mode: "boolean" }).notNull().default(false),
  repairDate: text("repair_date").notNull(),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
}, (table) => [
  index("intelligence_model_idx").on(table.modelKey),
  index("intelligence_country_idx").on(table.countryCode),
]);
