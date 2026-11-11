CREATE TABLE `app_settings` (
	`key` text PRIMARY KEY NOT NULL,
	`value` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `clients` (
	`id` text PRIMARY KEY NOT NULL,
	`first_name` text NOT NULL,
	`last_name` text,
	`gender` text,
	`date_of_birth` text,
	`height_cm` real,
	`is_self` integer DEFAULT false NOT NULL,
	`notes` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	`archived_at` text
);
--> statement-breakpoint
CREATE UNIQUE INDEX `clients_one_self` ON `clients` (`is_self`) WHERE "clients"."is_self" = 1;--> statement-breakpoint
CREATE TABLE `exercise_muscles` (
	`exercise_id` text NOT NULL,
	`muscle` text NOT NULL,
	`updated_at` text NOT NULL,
	PRIMARY KEY(`exercise_id`, `muscle`),
	FOREIGN KEY (`exercise_id`) REFERENCES `exercises`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `exercises` (
	`id` text PRIMARY KEY NOT NULL,
	`name_en` text NOT NULL,
	`name_pl` text,
	`category` text NOT NULL,
	`training_type` text NOT NULL,
	`pattern` text NOT NULL,
	`uses_bodyweight` integer DEFAULT false NOT NULL,
	`is_custom` integer DEFAULT false NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `exercises_name_en_nocase` ON `exercises` (lower("name_en"));--> statement-breakpoint
CREATE TABLE `measurements` (
	`id` text PRIMARY KEY NOT NULL,
	`client_id` text NOT NULL,
	`date` text NOT NULL,
	`type` text NOT NULL,
	`value` real NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`client_id`) REFERENCES `clients`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `measurements_client_type_date` ON `measurements` (`client_id`,`type`,`date`);--> statement-breakpoint
CREATE TABLE `one_rep_maxes` (
	`id` text PRIMARY KEY NOT NULL,
	`client_id` text NOT NULL,
	`exercise_id` text NOT NULL,
	`value_kg` real NOT NULL,
	`source` text NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`client_id`) REFERENCES `clients`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`exercise_id`) REFERENCES `exercises`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `one_rep_maxes_client_exercise` ON `one_rep_maxes` (`client_id`,`exercise_id`);--> statement-breakpoint
CREATE TABLE `session_exercises` (
	`id` text PRIMARY KEY NOT NULL,
	`session_id` text NOT NULL,
	`exercise_id` text NOT NULL,
	`position` integer NOT NULL,
	`finished_at` text,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`session_id`) REFERENCES `sessions`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`exercise_id`) REFERENCES `exercises`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `session_exercises_session` ON `session_exercises` (`session_id`);--> statement-breakpoint
CREATE TABLE `sessions` (
	`id` text PRIMARY KEY NOT NULL,
	`client_id` text NOT NULL,
	`date` text NOT NULL,
	`status` text NOT NULL,
	`started_at` text NOT NULL,
	`finished_at` text,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`client_id`) REFERENCES `clients`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `sessions_one_draft` ON `sessions` (`status`) WHERE "sessions"."status" = 'draft';--> statement-breakpoint
CREATE INDEX `sessions_client_date` ON `sessions` (`client_id`,`date`);--> statement-breakpoint
CREATE TABLE `sets` (
	`id` text PRIMARY KEY NOT NULL,
	`session_exercise_id` text NOT NULL,
	`set_no` integer NOT NULL,
	`weight_kg` real,
	`reps` integer,
	`side` text,
	`height_cm` real,
	`speed_kmh` real,
	`minutes` real,
	`note` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`session_exercise_id`) REFERENCES `session_exercises`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `sets_session_exercise` ON `sets` (`session_exercise_id`);