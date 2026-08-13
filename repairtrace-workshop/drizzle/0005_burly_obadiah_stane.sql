CREATE TABLE `repair_ifixit_guides` (
	`id` text PRIMARY KEY NOT NULL,
	`repair_id` text NOT NULL,
	`guide_id` integer NOT NULL,
	`title` text NOT NULL,
	`subject` text DEFAULT '' NOT NULL,
	`category` text DEFAULT '' NOT NULL,
	`url` text NOT NULL,
	`summary` text DEFAULT '' NOT NULL,
	`difficulty` text DEFAULT '' NOT NULL,
	`duration` text DEFAULT '' NOT NULL,
	`match_score` real DEFAULT 0 NOT NULL,
	`match_level` text DEFAULT 'Possible' NOT NULL,
	`selected` integer DEFAULT false NOT NULL,
	`tools_json` text DEFAULT '[]' NOT NULL,
	`specifics_json` text DEFAULT '[]' NOT NULL,
	`step_count` integer DEFAULT 0 NOT NULL,
	`search_query` text DEFAULT '' NOT NULL,
	`retrieved_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE INDEX `ifixit_guides_repair_idx` ON `repair_ifixit_guides` (`repair_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `ifixit_guides_repair_guide_unique` ON `repair_ifixit_guides` (`repair_id`,`guide_id`);--> statement-breakpoint
ALTER TABLE `repair_guides` ADD `source_guide_id` integer;--> statement-breakpoint
ALTER TABLE `repair_guides` ADD `source_match_level` text DEFAULT 'Unverified' NOT NULL;--> statement-breakpoint
ALTER TABLE `repair_guides` ADD `source_checked_at` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `repair_guides` ADD `verified_detail_count` integer DEFAULT 0 NOT NULL;