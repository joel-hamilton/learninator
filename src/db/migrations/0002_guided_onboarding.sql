ALTER TABLE `missions` ADD `onboarding_mode` text DEFAULT 'guided' NOT NULL;
--> statement-breakpoint
CREATE TABLE `guided_questions` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`mission_id` integer NOT NULL,
	`question` text NOT NULL,
	`options` text NOT NULL,
	`answer` text,
	`answer_text` text,
	`status` text DEFAULT 'pending' NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`mission_id`) REFERENCES `missions`(`id`) ON UPDATE no action ON DELETE no action
);
