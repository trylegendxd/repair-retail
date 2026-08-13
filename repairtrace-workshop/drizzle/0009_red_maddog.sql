ALTER TABLE `shop_settings` ADD `marketplace_enabled` integer DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `shop_settings` ADD `marketplace_city` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `shop_settings` ADD `marketplace_region` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `shop_settings` ADD `marketplace_address_label` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `shop_settings` ADD `marketplace_latitude` real;--> statement-breakpoint
ALTER TABLE `shop_settings` ADD `marketplace_longitude` real;--> statement-breakpoint
ALTER TABLE `shop_settings` ADD `marketplace_radius_km` integer DEFAULT 30 NOT NULL;