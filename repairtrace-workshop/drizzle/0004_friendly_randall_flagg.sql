CREATE TABLE `repair_guides` (
	`id` text PRIMARY KEY NOT NULL,
	`repair_id` text NOT NULL,
	`recognized_model` text NOT NULL,
	`title` text NOT NULL,
	`difficulty` text NOT NULL,
	`estimated_minutes` integer NOT NULL,
	`risk_level` text NOT NULL,
	`overview` text NOT NULL,
	`tools_json` text DEFAULT '[]' NOT NULL,
	`parts_json` text DEFAULT '[]' NOT NULL,
	`precautions_json` text DEFAULT '[]' NOT NULL,
	`steps_json` text DEFAULT '[]' NOT NULL,
	`source_url` text DEFAULT '' NOT NULL,
	`source_label` text DEFAULT 'Model-specific reference' NOT NULL,
	`generated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `repair_guides_repair_id_unique` ON `repair_guides` (`repair_id`);