ALTER TABLE `market_price_samples` ADD `contributor_key` text DEFAULT '' NOT NULL;--> statement-breakpoint
CREATE INDEX `market_samples_contributor_idx` ON `market_price_samples` (`contributor_key`);