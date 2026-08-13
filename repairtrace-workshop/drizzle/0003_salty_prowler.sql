CREATE TABLE `repair_contribution_links` (
	`repair_id` text PRIMARY KEY NOT NULL,
	`owner_id` text NOT NULL,
	`contribution_id` text NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `repair_contribution_links_contribution_id_unique` ON `repair_contribution_links` (`contribution_id`);--> statement-breakpoint
CREATE INDEX `contribution_links_owner_idx` ON `repair_contribution_links` (`owner_id`);--> statement-breakpoint
CREATE TABLE `repair_intelligence_records` (
	`id` text PRIMARY KEY NOT NULL,
	`model_key` text NOT NULL,
	`display_model` text NOT NULL,
	`category` text DEFAULT 'Other' NOT NULL,
	`faults_json` text DEFAULT '[]' NOT NULL,
	`part_cost` real,
	`labor_hours` real,
	`labor_rate` real,
	`total_price` real,
	`currency` text DEFAULT 'EUR' NOT NULL,
	`country_code` text DEFAULT 'PT' NOT NULL,
	`part_quality` text DEFAULT 'Unspecified' NOT NULL,
	`outcome` text DEFAULT 'Pending' NOT NULL,
	`warranty_return` integer DEFAULT false NOT NULL,
	`repair_date` text NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE INDEX `intelligence_model_idx` ON `repair_intelligence_records` (`model_key`);--> statement-breakpoint
CREATE INDEX `intelligence_country_idx` ON `repair_intelligence_records` (`country_code`);--> statement-breakpoint
CREATE TABLE `shop_settings` (
	`owner_id` text PRIMARY KEY NOT NULL,
	`share_repair_data` integer DEFAULT false NOT NULL,
	`country_code` text DEFAULT 'PT' NOT NULL,
	`currency` text DEFAULT 'EUR' NOT NULL,
	`default_labor_rate` real DEFAULT 38 NOT NULL,
	`include_labor_by_default` integer DEFAULT true NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
ALTER TABLE `repairs` ADD `owner_id` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `repairs` ADD `actual_labor_hours` real DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `repairs` ADD `part_quality` text DEFAULT 'Unspecified' NOT NULL;--> statement-breakpoint
ALTER TABLE `repairs` ADD `repair_outcome` text DEFAULT 'Pending' NOT NULL;--> statement-breakpoint
ALTER TABLE `repairs` ADD `warranty_return` integer DEFAULT false NOT NULL;--> statement-breakpoint
CREATE INDEX `repairs_owner_idx` ON `repairs` (`owner_id`);