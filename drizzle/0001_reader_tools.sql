CREATE TABLE `feedback` (
	`id` text PRIMARY KEY NOT NULL,
	`product_id` text NOT NULL,
	`page_id` text NOT NULL,
	`version` text DEFAULT '' NOT NULL,
	`helpful` integer NOT NULL,
	`comment` text DEFAULT '' NOT NULL,
	`visitor` text NOT NULL,
	`created` text NOT NULL,
	FOREIGN KEY (`product_id`) REFERENCES `products`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "feedback_helpful" CHECK("feedback"."helpful" IN (0,1))
);

--> statement-breakpoint
CREATE UNIQUE INDEX `feedback_visitor_page` ON `feedback` (`product_id`,`page_id`,`version`,`visitor`);
--> statement-breakpoint
CREATE INDEX `feedback_product` ON `feedback` (`product_id`,`created`);
--> statement-breakpoint
CREATE TABLE `feedback_limits` (
	`key` text PRIMARY KEY NOT NULL,
	`count` integer NOT NULL,
	`reset` integer NOT NULL
);

--> statement-breakpoint
CREATE TABLE `versions` (
	`id` text PRIMARY KEY NOT NULL,
	`product_id` text NOT NULL,
	`label` text NOT NULL,
	`slug` text NOT NULL,
	`snapshot` text NOT NULL,
	`created` text NOT NULL,
	FOREIGN KEY (`product_id`) REFERENCES `products`(`id`) ON UPDATE no action ON DELETE cascade
);

--> statement-breakpoint
CREATE UNIQUE INDEX `versions_product_slug` ON `versions` (`product_id`,`slug`);
