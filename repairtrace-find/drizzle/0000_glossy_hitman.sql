CREATE TABLE `market_price_samples` (
	`id` text PRIMARY KEY NOT NULL,
	`model_key` text NOT NULL,
	`category` text NOT NULL,
	`issue_key` text NOT NULL,
	`country_code` text NOT NULL,
	`region` text DEFAULT '' NOT NULL,
	`total_price` real NOT NULL,
	`parts_cost` real,
	`labor_cost` real,
	`currency` text DEFAULT 'EUR' NOT NULL,
	`source_type` text DEFAULT 'anonymous_repair' NOT NULL,
	`observed_at` text NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE INDEX `market_samples_match_idx` ON `market_price_samples` (`model_key`,`issue_key`,`country_code`);--> statement-breakpoint
CREATE TABLE `partner_shops` (
	`id` text PRIMARY KEY NOT NULL,
	`external_id` text NOT NULL,
	`name` text NOT NULL,
	`city` text NOT NULL,
	`region` text DEFAULT '' NOT NULL,
	`country_code` text DEFAULT 'PT' NOT NULL,
	`address_label` text DEFAULT '' NOT NULL,
	`latitude` real,
	`longitude` real,
	`service_radius_km` integer DEFAULT 50 NOT NULL,
	`contact_mode` text DEFAULT 'in_app' NOT NULL,
	`verified` integer DEFAULT false NOT NULL,
	`marketplace_enabled` integer DEFAULT false NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `partner_shops_external_unique` ON `partner_shops` (`external_id`);--> statement-breakpoint
CREATE INDEX `partner_shops_location_idx` ON `partner_shops` (`country_code`,`city`);--> statement-breakpoint
CREATE TABLE `quote_requests` (
	`id` text PRIMARY KEY NOT NULL,
	`public_token` text NOT NULL,
	`shop_id` text NOT NULL,
	`status` text DEFAULT 'new' NOT NULL,
	`device_category` text NOT NULL,
	`brand` text DEFAULT '' NOT NULL,
	`model_key` text DEFAULT '' NOT NULL,
	`model_label` text NOT NULL,
	`issue_key` text NOT NULL,
	`issue_detail` text DEFAULT '' NOT NULL,
	`city` text DEFAULT '' NOT NULL,
	`customer_name` text NOT NULL,
	`contact_type` text NOT NULL,
	`contact_value` text NOT NULL,
	`message` text DEFAULT '' NOT NULL,
	`shop_reply` text DEFAULT '' NOT NULL,
	`shop_price` real,
	`currency` text DEFAULT 'EUR' NOT NULL,
	`consent` integer DEFAULT false NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `quote_requests_token_unique` ON `quote_requests` (`public_token`);--> statement-breakpoint
CREATE INDEX `quote_requests_shop_idx` ON `quote_requests` (`shop_id`,`status`);--> statement-breakpoint
CREATE TABLE `shop_services` (
	`id` text PRIMARY KEY NOT NULL,
	`shop_id` text NOT NULL,
	`category` text NOT NULL,
	`brand` text DEFAULT '' NOT NULL,
	`model_key` text DEFAULT '' NOT NULL,
	`model_label` text DEFAULT '' NOT NULL,
	`issue_key` text NOT NULL,
	`issue_label` text NOT NULL,
	`price_low` real NOT NULL,
	`price_high` real NOT NULL,
	`currency` text DEFAULT 'EUR' NOT NULL,
	`turnaround_days` integer DEFAULT 3 NOT NULL,
	`sample_size` integer DEFAULT 0 NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE INDEX `shop_services_match_idx` ON `shop_services` (`model_key`,`issue_key`);--> statement-breakpoint
CREATE UNIQUE INDEX `shop_services_unique` ON `shop_services` (`shop_id`,`model_key`,`issue_key`);