CREATE INDEX `market_samples_recent_idx` ON `market_price_samples` (`model_key`,`issue_key`,`country_code`,`observed_at`);--> statement-breakpoint
CREATE INDEX `quote_requests_contact_idx` ON `quote_requests` (`contact_value`,`created_at`);--> statement-breakpoint
CREATE INDEX `quote_requests_shop_contact_idx` ON `quote_requests` (`shop_id`,`contact_value`,`created_at`);--> statement-breakpoint
CREATE INDEX `shop_services_issue_idx` ON `shop_services` (`issue_key`,`shop_id`);