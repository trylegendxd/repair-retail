CREATE TABLE `repair_events` (
	`id` text PRIMARY KEY NOT NULL,
	`repair_id` text NOT NULL,
	`title` text NOT NULL,
	`detail` text DEFAULT '' NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE TABLE `repair_parts` (
	`id` text PRIMARY KEY NOT NULL,
	`repair_id` text NOT NULL,
	`name` text NOT NULL,
	`sku` text DEFAULT '' NOT NULL,
	`supplier` text DEFAULT 'Manual entry' NOT NULL,
	`quantity` integer DEFAULT 1 NOT NULL,
	`cost` real DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE `repair_photos` (
	`id` text PRIMARY KEY NOT NULL,
	`repair_id` text NOT NULL,
	`object_key` text NOT NULL,
	`file_name` text NOT NULL,
	`content_type` text NOT NULL,
	`caption` text DEFAULT 'Repair evidence' NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE TABLE `repair_tests` (
	`id` text PRIMARY KEY NOT NULL,
	`repair_id` text NOT NULL,
	`label` text NOT NULL,
	`result` text DEFAULT 'pending' NOT NULL
);
--> statement-breakpoint
CREATE TABLE `repairs` (
	`id` text PRIMARY KEY NOT NULL,
	`ticket` text NOT NULL,
	`customer_name` text NOT NULL,
	`customer_email` text DEFAULT '' NOT NULL,
	`customer_phone` text DEFAULT '' NOT NULL,
	`device` text NOT NULL,
	`category` text DEFAULT 'Other' NOT NULL,
	`serial_number` text DEFAULT '' NOT NULL,
	`issue` text NOT NULL,
	`diagnosis` text DEFAULT 'Awaiting diagnosis.' NOT NULL,
	`status` text DEFAULT 'Intake' NOT NULL,
	`priority` text DEFAULT 'Standard' NOT NULL,
	`due` text DEFAULT '' NOT NULL,
	`estimate` real DEFAULT 0 NOT NULL,
	`final_cost` real DEFAULT 0 NOT NULL,
	`warranty_days` integer DEFAULT 90 NOT NULL,
	`published` integer DEFAULT false NOT NULL,
	`completed_at` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `repairs_ticket_unique` ON `repairs` (`ticket`);