CREATE TABLE `sponsor_history` (
	`employer_norm` text NOT NULL,
	`employer_raw` text NOT NULL,
	`fy` integer NOT NULL,
	`total_lcas` integer DEFAULT 0 NOT NULL,
	`new_employment` integer DEFAULT 0,
	`tech_lcas` integer DEFAULT 0,
	`median_wage` integer,
	`source` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `sponsor_history_employer_fy` ON `sponsor_history` (`employer_norm`,`fy`,`source`);--> statement-breakpoint
ALTER TABLE `applications` ADD `keyword_gap` text;--> statement-breakpoint
ALTER TABLE `jobs` ADD `sponsor_status` text;--> statement-breakpoint
ALTER TABLE `jobs` ADD `sponsor_evidence` text;--> statement-breakpoint
ALTER TABLE `jobs` ADD `sponsor_lca_count` integer;--> statement-breakpoint
ALTER TABLE `jobs` ADD `years_required` integer;--> statement-breakpoint
ALTER TABLE `jobs` ADD `entry_level` integer;--> statement-breakpoint
ALTER TABLE `jobs` ADD `everify` integer;