ALTER TABLE `repairs` ADD `intake_key` text DEFAULT '' NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX `repairs_intake_key_unique` ON `repairs` (`owner_id`,`intake_key`) WHERE "repairs"."intake_key" <> '';--> statement-breakpoint
UPDATE `repairs` SET
  `tracking_key`=CASE WHEN `tracking_key`='' THEN 'track_' || lower(hex(randomblob(24))) ELSE `tracking_key` END,
  `certificate_key`=CASE WHEN `certificate_key`='' THEN 'certificate_' || lower(hex(randomblob(24))) ELSE `certificate_key` END
WHERE `tracking_key`='' OR `certificate_key`='';--> statement-breakpoint
UPDATE `repairs` SET
  `client_update`=CASE `status`
    WHEN 'Diagnosing' THEN 'A technician is diagnosing the reported issue.'
    WHEN 'Waiting for part' THEN 'The repair is waiting for the required part.'
    WHEN 'Ready' THEN 'Your device is ready to collect. Please follow the shop''s collection instructions.'
    WHEN 'Completed' THEN 'The repair is complete. Your warranty and procedure record is now available.'
    ELSE 'Your device has been received and added to the workshop queue.'
  END,
  `client_updated_at`=COALESCE(`updated_at`,CURRENT_TIMESTAMP)
WHERE `client_updated_at` IS NULL;--> statement-breakpoint
INSERT INTO `repair_client_updates` (`id`,`repair_id`,`status`,`message`,`created_at`)
SELECT lower(hex(randomblob(16))),r.`id`,r.`status`,r.`client_update`,COALESCE(r.`client_updated_at`,r.`updated_at`,CURRENT_TIMESTAMP)
FROM `repairs` r
WHERE NOT EXISTS (SELECT 1 FROM `repair_client_updates` u WHERE u.`repair_id`=r.`id`);--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS `repairs_tracking_key_idx` ON `repairs` (`tracking_key`) WHERE `tracking_key` <> '';--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS `repairs_certificate_key_idx` ON `repairs` (`certificate_key`) WHERE `certificate_key` <> '';--> statement-breakpoint
UPDATE `repair_ifixit_guides` SET `specifics_json`='[]' WHERE `specifics_json`<>'[]';--> statement-breakpoint
UPDATE `repair_guides` SET `verified_detail_count`=0 WHERE `verified_detail_count`<>0;
