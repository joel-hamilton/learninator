ALTER TABLE `lessons` ADD `parent_lesson_id` integer REFERENCES lessons(id);--> statement-breakpoint
ALTER TABLE `lessons` ADD `sub_number` integer;