-- Deduplicate — keep the earliest row per (mission_id, content_type)
DELETE FROM mission_content WHERE id NOT IN (
  SELECT MIN(id) FROM mission_content GROUP BY mission_id, content_type
);
--> statement-breakpoint
CREATE UNIQUE INDEX `uq_mission_content` ON `mission_content` (`mission_id`,`content_type`);
