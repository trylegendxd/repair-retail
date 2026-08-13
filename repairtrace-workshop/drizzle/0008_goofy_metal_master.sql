CREATE TABLE `customers` (
	`id` text PRIMARY KEY NOT NULL,
	`owner_id` text NOT NULL,
	`name` text NOT NULL,
	`email` text DEFAULT '' NOT NULL,
	`phone` text DEFAULT '' NOT NULL,
	`company` text DEFAULT '' NOT NULL,
	`notes` text DEFAULT '' NOT NULL,
	`tags` text DEFAULT '' NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE INDEX `customers_owner_idx` ON `customers` (`owner_id`);--> statement-breakpoint
CREATE INDEX `customers_email_idx` ON `customers` (`owner_id`,`email`);--> statement-breakpoint
CREATE TABLE `inventory_items` (
	`id` text PRIMARY KEY NOT NULL,
	`owner_id` text NOT NULL,
	`name` text NOT NULL,
	`sku` text DEFAULT '' NOT NULL,
	`supplier` text DEFAULT '' NOT NULL,
	`compatible_models` text DEFAULT '' NOT NULL,
	`location` text DEFAULT '' NOT NULL,
	`quantity` integer DEFAULT 0 NOT NULL,
	`reorder_level` integer DEFAULT 2 NOT NULL,
	`unit_cost` real DEFAULT 0 NOT NULL,
	`sale_price` real DEFAULT 0 NOT NULL,
	`active` integer DEFAULT true NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE INDEX `inventory_owner_idx` ON `inventory_items` (`owner_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `inventory_owner_sku_unique` ON `inventory_items` (`owner_id`,`sku`) WHERE "inventory_items"."sku" <> '';--> statement-breakpoint
CREATE TABLE `shop_appointments` (
	`id` text PRIMARY KEY NOT NULL,
	`owner_id` text NOT NULL,
	`repair_id` text DEFAULT '' NOT NULL,
	`title` text NOT NULL,
	`starts_at` text NOT NULL,
	`ends_at` text DEFAULT '' NOT NULL,
	`technician` text DEFAULT '' NOT NULL,
	`status` text DEFAULT 'Scheduled' NOT NULL,
	`notes` text DEFAULT '' NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE INDEX `appointments_owner_idx` ON `shop_appointments` (`owner_id`);--> statement-breakpoint
CREATE INDEX `appointments_repair_idx` ON `shop_appointments` (`repair_id`);--> statement-breakpoint
CREATE TABLE `shop_technicians` (
	`id` text PRIMARY KEY NOT NULL,
	`owner_id` text NOT NULL,
	`name` text NOT NULL,
	`email` text DEFAULT '' NOT NULL,
	`role` text DEFAULT 'Technician' NOT NULL,
	`specialty` text DEFAULT 'General repair' NOT NULL,
	`active` integer DEFAULT true NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE INDEX `technicians_owner_idx` ON `shop_technicians` (`owner_id`);--> statement-breakpoint
ALTER TABLE `repairs` ADD `customer_id` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `repairs` ADD `assigned_technician` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `repairs` ADD `appointment_at` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `repairs` ADD `internal_notes` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `repairs` ADD `quote_key` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `repairs` ADD `quote_status` text DEFAULT 'draft' NOT NULL;--> statement-breakpoint
ALTER TABLE `repairs` ADD `quote_sent_at` text;--> statement-breakpoint
ALTER TABLE `repairs` ADD `quote_responded_at` text;--> statement-breakpoint
ALTER TABLE `repairs` ADD `invoice_key` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `repairs` ADD `invoice_number` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `repairs` ADD `invoice_status` text DEFAULT 'not_created' NOT NULL;--> statement-breakpoint
ALTER TABLE `repairs` ADD `invoice_issued_at` text;--> statement-breakpoint
ALTER TABLE `repairs` ADD `tax_rate` real DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `repairs` ADD `amount_paid` real DEFAULT 0 NOT NULL;--> statement-breakpoint
UPDATE `repairs` SET `quote_key`='quote_' || lower(hex(randomblob(24))) WHERE `quote_key`='';--> statement-breakpoint
UPDATE `repairs` SET `invoice_key`='invoice_' || lower(hex(randomblob(24))) WHERE `invoice_key`='';--> statement-breakpoint
CREATE INDEX `repairs_customer_idx` ON `repairs` (`customer_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `repairs_quote_key_unique` ON `repairs` (`quote_key`) WHERE "repairs"."quote_key" <> '';--> statement-breakpoint
CREATE UNIQUE INDEX `repairs_invoice_key_unique` ON `repairs` (`invoice_key`) WHERE "repairs"."invoice_key" <> '';
