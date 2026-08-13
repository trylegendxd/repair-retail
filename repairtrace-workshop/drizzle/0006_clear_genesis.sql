CREATE TABLE `repair_client_updates` (
	`id` text PRIMARY KEY NOT NULL,
	`repair_id` text NOT NULL,
	`status` text NOT NULL,
	`message` text NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE INDEX `client_updates_repair_idx` ON `repair_client_updates` (`repair_id`);--> statement-breakpoint
CREATE TABLE `repair_notifications` (
	`id` text PRIMARY KEY NOT NULL,
	`repair_id` text NOT NULL,
	`channel` text NOT NULL,
	`destination_masked` text DEFAULT '' NOT NULL,
	`status` text NOT NULL,
	`provider_message_id` text DEFAULT '' NOT NULL,
	`detail` text DEFAULT '' NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE INDEX `notifications_repair_idx` ON `repair_notifications` (`repair_id`);--> statement-breakpoint
ALTER TABLE `repairs` ADD `tracking_key` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `repairs` ADD `certificate_key` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `repairs` ADD `client_update` text DEFAULT 'Device received by the workshop.' NOT NULL;--> statement-breakpoint
ALTER TABLE `repairs` ADD `client_updated_at` text;--> statement-breakpoint
ALTER TABLE `shop_settings` ADD `shop_name` text DEFAULT 'Rush Electronics' NOT NULL;