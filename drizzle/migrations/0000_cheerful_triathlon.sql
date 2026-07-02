CREATE TABLE `applications` (
	`id` text PRIMARY KEY NOT NULL,
	`job_id` text NOT NULL,
	`status` text DEFAULT 'draft' NOT NULL,
	`applied_at` text,
	`submission_method` text,
	`resume_text` text,
	`cover_letter` text,
	`form_data` text,
	`screenshot_path` text,
	`notes` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`job_id`) REFERENCES `jobs`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `email_threads` (
	`id` text PRIMARY KEY NOT NULL,
	`application_id` text,
	`job_id` text,
	`subject` text,
	`from_email` text,
	`from_name` text,
	`received_at` text NOT NULL,
	`snippet` text,
	`classification` text DEFAULT 'other' NOT NULL,
	`action_required` integer DEFAULT 0,
	`read` integer DEFAULT 0,
	FOREIGN KEY (`application_id`) REFERENCES `applications`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`job_id`) REFERENCES `jobs`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `jobs` (
	`id` text PRIMARY KEY NOT NULL,
	`source` text NOT NULL,
	`external_id` text NOT NULL,
	`title` text NOT NULL,
	`company` text NOT NULL,
	`location` text,
	`remote` integer DEFAULT 0,
	`url` text NOT NULL,
	`description` text,
	`salary_min` real,
	`salary_max` real,
	`posted_at` text,
	`scraped_at` text NOT NULL,
	`fit_score` real,
	`fit_grade` text,
	`fit_summary` text,
	`status` text DEFAULT 'new' NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `jobs_url_unique` ON `jobs` (`url`);--> statement-breakpoint
CREATE UNIQUE INDEX `jobs_source_external_id` ON `jobs` (`source`,`external_id`);--> statement-breakpoint
CREATE TABLE `profile` (
	`id` text PRIMARY KEY NOT NULL,
	`full_name` text,
	`email` text,
	`phone` text,
	`location` text,
	`linkedin_url` text,
	`github_url` text,
	`portfolio_url` text,
	`summary` text,
	`experience` text,
	`education` text,
	`skills` text,
	`target_roles` text,
	`target_locations` text,
	`salary_min` real,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `scrape_runs` (
	`id` text PRIMARY KEY NOT NULL,
	`started_at` text NOT NULL,
	`completed_at` text,
	`sources` text,
	`jobs_found` integer DEFAULT 0,
	`jobs_new` integer DEFAULT 0,
	`status` text DEFAULT 'running' NOT NULL,
	`error` text
);
