CREATE TABLE `marketplace_accounts` (
	`id` text PRIMARY KEY NOT NULL,
	`email` text NOT NULL,
	`role` text NOT NULL,
	`display_name` text NOT NULL,
	`phone` text DEFAULT '' NOT NULL,
	`city` text NOT NULL,
	`region` text DEFAULT '' NOT NULL,
	`country_code` text DEFAULT 'PT' NOT NULL,
	`latitude` real,
	`longitude` real,
	`provider_kind` text DEFAULT '' NOT NULL,
	`business_name` text DEFAULT '' NOT NULL,
	`bio` text DEFAULT '' NOT NULL,
	`service_radius_km` integer DEFAULT 50 NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `marketplace_accounts_email_unique` ON `marketplace_accounts` (`email`);--> statement-breakpoint
CREATE INDEX `marketplace_accounts_role_location_idx` ON `marketplace_accounts` (`role`,`country_code`,`city`);--> statement-breakpoint
CREATE TABLE `repair_announcement_photos` (
	`id` text PRIMARY KEY NOT NULL,
	`announcement_id` text NOT NULL,
	`object_key` text NOT NULL,
	`content_type` text NOT NULL,
	`size_bytes` integer NOT NULL,
	`sort_order` integer DEFAULT 0 NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE INDEX `repair_announcement_photos_post_idx` ON `repair_announcement_photos` (`announcement_id`,`sort_order`);--> statement-breakpoint
CREATE UNIQUE INDEX `repair_announcement_photos_object_unique` ON `repair_announcement_photos` (`object_key`);--> statement-breakpoint
CREATE TABLE `repair_announcements` (
	`id` text PRIMARY KEY NOT NULL,
	`owner_account_id` text NOT NULL,
	`status` text DEFAULT 'open' NOT NULL,
	`device_category` text NOT NULL,
	`brand` text DEFAULT '' NOT NULL,
	`model_key` text NOT NULL,
	`model_label` text NOT NULL,
	`issue_key` text DEFAULT 'diagnostic' NOT NULL,
	`problem_detail` text NOT NULL,
	`customer_display_name` text NOT NULL,
	`city` text NOT NULL,
	`region` text DEFAULT '' NOT NULL,
	`country_code` text DEFAULT 'PT' NOT NULL,
	`latitude` real,
	`longitude` real,
	`photo_count` integer DEFAULT 0 NOT NULL,
	`offer_count` integer DEFAULT 0 NOT NULL,
	`accepted_offer_id` text,
	`expires_at` text NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE INDEX `repair_announcements_feed_idx` ON `repair_announcements` (`status`,`country_code`,`created_at`);--> statement-breakpoint
CREATE INDEX `repair_announcements_owner_idx` ON `repair_announcements` (`owner_account_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `repair_announcements_match_idx` ON `repair_announcements` (`device_category`,`issue_key`,`status`);--> statement-breakpoint
CREATE TABLE `repair_offers` (
	`id` text PRIMARY KEY NOT NULL,
	`announcement_id` text NOT NULL,
	`provider_account_id` text NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`offer_type` text DEFAULT 'repair' NOT NULL,
	`price_low` real NOT NULL,
	`price_high` real NOT NULL,
	`currency` text DEFAULT 'EUR' NOT NULL,
	`estimated_days` integer DEFAULT 3 NOT NULL,
	`message` text NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `repair_offers_provider_post_unique` ON `repair_offers` (`announcement_id`,`provider_account_id`);--> statement-breakpoint
CREATE INDEX `repair_offers_post_idx` ON `repair_offers` (`announcement_id`,`status`,`created_at`);--> statement-breakpoint
CREATE INDEX `repair_offers_provider_idx` ON `repair_offers` (`provider_account_id`,`created_at`);