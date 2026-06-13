CREATE TABLE `learning_records` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`mission_id` integer NOT NULL,
	`number` integer NOT NULL,
	`title` text NOT NULL,
	`markdown_content` text NOT NULL,
	`status` text DEFAULT 'active' NOT NULL,
	`superseded_by` integer,
	`created_at` text NOT NULL,
	FOREIGN KEY (`mission_id`) REFERENCES `missions`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `lessons` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`mission_id` integer NOT NULL,
	`number` integer NOT NULL,
	`title` text NOT NULL,
	`slug` text NOT NULL,
	`html_content` text NOT NULL,
	`status` text DEFAULT 'active' NOT NULL,
	`feedback_rating` text,
	`feedback_text` text,
	`created_at` text NOT NULL,
	`completed_at` text,
	FOREIGN KEY (`mission_id`) REFERENCES `missions`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `mission_content` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`mission_id` integer NOT NULL,
	`content_type` text NOT NULL,
	`markdown_content` text DEFAULT '' NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`mission_id`) REFERENCES `missions`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `missions` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`user_id` integer NOT NULL,
	`title` text NOT NULL,
	`slug` text NOT NULL,
	`status` text DEFAULT 'onboarding' NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `reference_docs` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`mission_id` integer NOT NULL,
	`title` text NOT NULL,
	`slug` text NOT NULL,
	`html_content` text NOT NULL,
	`doc_type` text NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`mission_id`) REFERENCES `missions`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `users` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`email` text NOT NULL,
	`password_hash` text NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `users_email_unique` ON `users` (`email`);