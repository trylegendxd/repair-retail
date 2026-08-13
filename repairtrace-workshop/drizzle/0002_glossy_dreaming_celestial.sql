ALTER TABLE `repair_ai_estimates` ADD `faults_json` text DEFAULT '[]' NOT NULL;--> statement-breakpoint
ALTER TABLE `repair_ai_estimates` ADD `include_labor` integer DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE `repairs` ADD `labor_rate` real DEFAULT 38 NOT NULL;--> statement-breakpoint
ALTER TABLE `repairs` ADD `include_labor` integer DEFAULT true NOT NULL;