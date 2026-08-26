-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateTable
CREATE TABLE "companies" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "company_name" VARCHAR(255) NOT NULL,
    "contact_email" VARCHAR(255) NOT NULL,
    "password_hash" TEXT NOT NULL,
    "region_codes" VARCHAR(10)[],
    "business_reg_no_encrypted" BYTEA NOT NULL,
    "business_reg_no_digest" BYTEA NOT NULL,
    "verification_status" VARCHAR(20) NOT NULL DEFAULT 'pending',
    "verified_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "companies_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "company_classification_codes" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "company_id" UUID NOT NULL,
    "classification_code" VARCHAR(8) NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "company_classification_codes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "company_performances" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "company_id" UUID NOT NULL,
    "project_name" VARCHAR(255) NOT NULL,
    "contract_amount" DECIMAL(15,0),
    "contract_date" DATE,
    "agency_name" VARCHAR(255),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "company_performances_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "company_certifications" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "company_id" UUID NOT NULL,
    "cert_type" VARCHAR(100) NOT NULL,
    "cert_number" VARCHAR(100),
    "expires_at" DATE,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "company_certifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bid_announcements" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "source_bid_no" VARCHAR(50) NOT NULL,
    "source_revision_no" VARCHAR(10) NOT NULL DEFAULT '0',
    "is_latest_revision" BOOLEAN NOT NULL DEFAULT true,
    "title" TEXT NOT NULL,
    "classification_code" VARCHAR(8),
    "region_codes" VARCHAR(10)[],
    "agency_name" VARCHAR(255),
    "budget_amount" DECIMAL(15,0),
    "bid_open_at" TIMESTAMPTZ(6),
    "bid_close_at" TIMESTAMPTZ(6),
    "raw_payload" JSONB NOT NULL,
    "fetched_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "bid_announcements_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "matches" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "company_id" UUID NOT NULL,
    "announcement_id" UUID NOT NULL,
    "score" DECIMAL(5,2) NOT NULL,
    "matched_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "matches_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notification_logs" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "match_id" UUID NOT NULL,
    "channel" VARCHAR(20) NOT NULL,
    "status" VARCHAR(20) NOT NULL DEFAULT 'pending',
    "sent_at" TIMESTAMPTZ(6),
    "error_message" TEXT,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notification_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notification_settings" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "company_id" UUID NOT NULL,
    "email_enabled" BOOLEAN NOT NULL DEFAULT true,
    "push_enabled" BOOLEAN NOT NULL DEFAULT false,
    "min_score_threshold" DECIMAL(5,2) NOT NULL DEFAULT 60.00,
    "digest_frequency" VARCHAR(20) NOT NULL DEFAULT 'immediate',
    "quiet_hours_start" TIME(6),
    "quiet_hours_end" TIME(6),
    "deadline_reminder_enabled" BOOLEAN NOT NULL DEFAULT true,
    "deadline_reminder_days" SMALLINT NOT NULL DEFAULT 3,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notification_settings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "push_subscriptions" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "company_id" UUID NOT NULL,
    "endpoint" TEXT NOT NULL,
    "p256dh" TEXT NOT NULL,
    "auth" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "push_subscriptions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "uq_companies_business_reg_no_digest" ON "companies"("business_reg_no_digest");

-- CreateIndex
CREATE UNIQUE INDEX "company_classification_codes_company_id_classification_code_key" ON "company_classification_codes"("company_id", "classification_code");

-- CreateIndex
CREATE INDEX "idx_bid_announcements_classification_code_pattern" ON "bid_announcements"("classification_code");

-- CreateIndex
CREATE INDEX "idx_bid_announcements_bid_close_at" ON "bid_announcements"("bid_close_at");

-- CreateIndex
CREATE UNIQUE INDEX "uq_bid_announcements_source_bid_no_revision" ON "bid_announcements"("source_bid_no", "source_revision_no");

-- CreateIndex
CREATE INDEX "idx_matches_company_id_matched_at" ON "matches"("company_id", "matched_at" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "matches_company_id_announcement_id_key" ON "matches"("company_id", "announcement_id");

-- CreateIndex
CREATE UNIQUE INDEX "notification_logs_match_id_channel_key" ON "notification_logs"("match_id", "channel");

-- CreateIndex
CREATE UNIQUE INDEX "notification_settings_company_id_key" ON "notification_settings"("company_id");

-- CreateIndex
CREATE UNIQUE INDEX "push_subscriptions_endpoint_key" ON "push_subscriptions"("endpoint");

-- AddForeignKey
ALTER TABLE "company_classification_codes" ADD CONSTRAINT "company_classification_codes_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "company_performances" ADD CONSTRAINT "company_performances_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "company_certifications" ADD CONSTRAINT "company_certifications_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "matches" ADD CONSTRAINT "matches_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "matches" ADD CONSTRAINT "matches_announcement_id_fkey" FOREIGN KEY ("announcement_id") REFERENCES "bid_announcements"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notification_logs" ADD CONSTRAINT "notification_logs_match_id_fkey" FOREIGN KEY ("match_id") REFERENCES "matches"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notification_settings" ADD CONSTRAINT "notification_settings_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "push_subscriptions" ADD CONSTRAINT "push_subscriptions_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;
