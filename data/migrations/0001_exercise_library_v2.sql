CREATE TABLE `exercise_aliases` (
	`exercise_id` text NOT NULL,
	`alias` text NOT NULL,
	`updated_at` text NOT NULL,
	PRIMARY KEY(`exercise_id`, `alias`),
	FOREIGN KEY (`exercise_id`) REFERENCES `exercises`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `exercise_aliases_alias_nocase` ON `exercise_aliases` (lower("alias"));--> statement-breakpoint
PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_exercises` (
	`id` text PRIMARY KEY NOT NULL,
	`name_en` text NOT NULL,
	`name_pl` text,
	`training_type` text NOT NULL,
	`pattern` text,
	`subcategory` text,
	`equipment` text DEFAULT 'other' NOT NULL,
	`mechanic` text,
	`level` text,
	`unilateral` integer DEFAULT false NOT NULL,
	`uses_bodyweight` integer DEFAULT false NOT NULL,
	`importance` integer DEFAULT 1 NOT NULL,
	`is_custom` integer DEFAULT false NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
INSERT INTO `__new_exercises`("id", "name_en", "name_pl", "training_type", "pattern", "uses_bodyweight", "is_custom", "created_at", "updated_at") SELECT "id", "name_en", "name_pl", "training_type", "pattern", "uses_bodyweight", "is_custom", "created_at", "updated_at" FROM `exercises`;--> statement-breakpoint
DROP TABLE `exercises`;--> statement-breakpoint
ALTER TABLE `__new_exercises` RENAME TO `exercises`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE UNIQUE INDEX `exercises_name_en_nocase` ON `exercises` (lower("name_en"));--> statement-breakpoint
ALTER TABLE `exercise_muscles` ADD `role` text DEFAULT 'primary' NOT NULL;