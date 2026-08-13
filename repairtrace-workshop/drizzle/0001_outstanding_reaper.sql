CREATE TABLE `repair_ai_estimates` (
	`id` text PRIMARY KEY NOT NULL,
	`repair_id` text NOT NULL,
	`recognized_model` text NOT NULL,
	`fault_key` text NOT NULL,
	`fault_label` text NOT NULL,
	`recommended_part` text NOT NULL,
	`confidence` text NOT NULL,
	`confidence_score` real NOT NULL,
	`part_low` real NOT NULL,
	`part_typical` real NOT NULL,
	`part_high` real NOT NULL,
	`labor_hours` real NOT NULL,
	`labor_rate` real NOT NULL,
	`labor_cost` real NOT NULL,
	`quote_low` real NOT NULL,
	`quote_recommended` real NOT NULL,
	`quote_high` real NOT NULL,
	`currency` text DEFAULT 'EUR' NOT NULL,
	`rationale` text NOT NULL,
	`guide_url` text DEFAULT '' NOT NULL,
	`status` text DEFAULT 'ready' NOT NULL,
	`researched_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `repair_ai_estimates_repair_id_unique` ON `repair_ai_estimates` (`repair_id`);--> statement-breakpoint
CREATE TABLE `repair_ai_sources` (
	`id` text PRIMARY KEY NOT NULL,
	`estimate_id` text NOT NULL,
	`merchant` text NOT NULL,
	`title` text NOT NULL,
	`url` text NOT NULL,
	`price` real,
	`currency` text DEFAULT 'EUR' NOT NULL,
	`is_live` integer DEFAULT false NOT NULL,
	`retrieved_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
