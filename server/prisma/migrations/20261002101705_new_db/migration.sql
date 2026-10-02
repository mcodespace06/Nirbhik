-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "vault";

-- CreateEnum
CREATE TYPE "public"."Role" AS ENUM ('STUDENT', 'TEACHER', 'ADMIN', 'SUPER_ADMIN', 'SECURITY');

-- CreateEnum
CREATE TYPE "public"."UserStatus" AS ENUM ('PENDING_VERIFY', 'ACTIVE', 'SUSPENDED');

-- CreateEnum
CREATE TYPE "public"."ComplaintMode" AS ENUM ('CONFIDENTIAL', 'ULTRA_ANON');

-- CreateEnum
CREATE TYPE "public"."ComplaintStatus" AS ENUM ('SUBMITTED', 'FLAGGED_REVIEW', 'TRIAGED', 'ASSIGNED', 'IN_PROGRESS', 'NEEDS_INFO', 'ESCALATED', 'RESOLVED', 'REOPENED', 'REJECTED', 'CLOSED');

-- CreateEnum
CREATE TYPE "public"."Priority" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL');

-- CreateEnum
CREATE TYPE "public"."RestrictedQueue" AS ENUM ('NONE', 'ICC', 'ANTI_RAGGING');

-- CreateEnum
CREATE TYPE "public"."Outcome" AS ENUM ('VALID', 'PARTIAL', 'DUPLICATE', 'UNVERIFIABLE', 'SPAM', 'MALICIOUS');

-- CreateEnum
CREATE TYPE "public"."TargetEntityType" AS ENUM ('DEPARTMENT', 'PLACE', 'ROLE_LABEL');

-- CreateEnum
CREATE TYPE "public"."AlertType" AS ENUM ('CRITICAL', 'PATTERN', 'RECURRENCE', 'SLA_BREACH', 'SPAM_BURST');

-- CreateEnum
CREATE TYPE "public"."AlertStatus" AS ENUM ('OPEN', 'ACK', 'DONE');

-- CreateEnum
CREATE TYPE "public"."SosStatus" AS ENUM ('TRIGGERED', 'DISPATCHED', 'ACK', 'RESPONDING', 'RESOLVED', 'FALSE_ALARM');

-- CreateTable
CREATE TABLE "public"."users" (
    "id" TEXT NOT NULL,
    "username" TEXT NOT NULL,
    "password_hash" TEXT NOT NULL,
    "role" "public"."Role" NOT NULL DEFAULT 'STUDENT',
    "college_email" TEXT NOT NULL,
    "roster_id" TEXT,
    "status" "public"."UserStatus" NOT NULL DEFAULT 'PENDING_VERIFY',
    "department" TEXT,
    "phone" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."college_roster" (
    "id" TEXT NOT NULL,
    "enrollment_no" TEXT NOT NULL,
    "full_name" TEXT NOT NULL,
    "college_email" TEXT NOT NULL,
    "role" "public"."Role" NOT NULL,
    "department" TEXT NOT NULL,
    "claimed" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "college_roster_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."verification_requests" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "method" TEXT NOT NULL,
    "otp_hash" TEXT,
    "otp_expires" TIMESTAMP(3),
    "id_card_file_key" TEXT,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "reviewed_by" TEXT,
    "rejection_reason" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "verification_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."complaints" (
    "id" TEXT NOT NULL,
    "tracking_key_hash" TEXT NOT NULL,
    "category_id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "location_id" TEXT NOT NULL,
    "incident_at" TIMESTAMP(3) NOT NULL,
    "mode" "public"."ComplaintMode" NOT NULL DEFAULT 'CONFIDENTIAL',
    "status" "public"."ComplaintStatus" NOT NULL DEFAULT 'SUBMITTED',
    "priority" "public"."Priority" NOT NULL DEFAULT 'MEDIUM',
    "pseudonym" TEXT NOT NULL,
    "assigned_to" TEXT,
    "cluster_id" TEXT,
    "target_entity_id" TEXT,
    "restricted_queue" "public"."RestrictedQueue" NOT NULL DEFAULT 'NONE',
    "satisfaction_rating" INTEGER,
    "outcome" "public"."Outcome",
    "outcome_reason" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "resolved_at" TIMESTAMP(3),

    CONSTRAINT "complaints_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."complaint_events" (
    "id" TEXT NOT NULL,
    "complaint_id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "actor_role" "public"."Role",
    "payload" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "complaint_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."complaint_messages" (
    "id" TEXT NOT NULL,
    "complaint_id" TEXT NOT NULL,
    "sender" TEXT NOT NULL,
    "admin_id" TEXT,
    "body" TEXT NOT NULL,
    "read_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "complaint_messages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."internal_notes" (
    "id" TEXT NOT NULL,
    "complaint_id" TEXT NOT NULL,
    "admin_id" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "internal_notes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."attachments" (
    "id" TEXT NOT NULL,
    "complaint_id" TEXT NOT NULL,
    "message_id" TEXT,
    "file_key" TEXT NOT NULL,
    "mime" TEXT NOT NULL,
    "size" INTEGER NOT NULL,
    "sanitized" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "attachments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."categories" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "severity_weight" INTEGER NOT NULL DEFAULT 10,
    "routes_to_queue" "public"."RestrictedQueue" NOT NULL DEFAULT 'NONE',
    "is_safety" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "categories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."locations" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "lat" DOUBLE PRECISION NOT NULL,
    "lng" DOUBLE PRECISION NOT NULL,

    CONSTRAINT "locations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."target_entities" (
    "id" TEXT NOT NULL,
    "type" "public"."TargetEntityType" NOT NULL,
    "label" TEXT NOT NULL,

    CONSTRAINT "target_entities_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."complaint_clusters" (
    "id" TEXT NOT NULL,
    "size" INTEGER NOT NULL DEFAULT 1,
    "first_seen" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "last_seen" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "complaint_clusters_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."ai_analyses" (
    "id" TEXT NOT NULL,
    "complaint_id" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "prompt_version" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "suggested_category" TEXT NOT NULL,
    "severity_score" INTEGER NOT NULL,
    "priority" "public"."Priority" NOT NULL,
    "spam_probability" DOUBLE PRECISION NOT NULL,
    "anomaly_flags" JSONB NOT NULL DEFAULT '[]',
    "reasoning" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "overridden_by" TEXT,

    CONSTRAINT "ai_analyses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."risk_alerts" (
    "id" TEXT NOT NULL,
    "type" "public"."AlertType" NOT NULL,
    "complaint_id" TEXT,
    "cluster_id" TEXT,
    "target_entity_id" TEXT,
    "message" TEXT NOT NULL,
    "recommended_actions" JSONB NOT NULL DEFAULT '[]',
    "status" "public"."AlertStatus" NOT NULL DEFAULT 'OPEN',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "risk_alerts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."rule_documents" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "body_md" TEXT NOT NULL,
    "file_key" TEXT,
    "version" INTEGER NOT NULL DEFAULT 1,
    "updated_by" TEXT NOT NULL,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "rule_documents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."rule_versions" (
    "id" TEXT NOT NULL,
    "rule_id" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "body_md" TEXT NOT NULL,
    "changed_by" TEXT NOT NULL,
    "change_note" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "rule_versions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."rule_chunks" (
    "id" TEXT NOT NULL,
    "rule_id" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "chunk_text" TEXT NOT NULL,
    "section_label" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "rule_chunks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."assistant_sessions" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "title" TEXT NOT NULL DEFAULT 'New Session',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "assistant_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."assistant_messages" (
    "id" TEXT NOT NULL,
    "session_id" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "citations" JSONB NOT NULL DEFAULT '[]',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "assistant_messages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."notifications" (
    "id" TEXT NOT NULL,
    "user_id" TEXT,
    "channel" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "read_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."sos_events" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "lat" DOUBLE PRECISION NOT NULL,
    "lng" DOUBLE PRECISION NOT NULL,
    "accuracy" DOUBLE PRECISION,
    "status" "public"."SosStatus" NOT NULL DEFAULT 'TRIGGERED',
    "dispatched_to" JSONB NOT NULL DEFAULT '[]',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sos_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."sos_location_pings" (
    "id" TEXT NOT NULL,
    "sos_id" TEXT NOT NULL,
    "lat" DOUBLE PRECISION NOT NULL,
    "lng" DOUBLE PRECISION NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sos_location_pings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."police_stations" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "lat" DOUBLE PRECISION NOT NULL,
    "lng" DOUBLE PRECISION NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "police_stations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."sla_policies" (
    "id" TEXT NOT NULL,
    "priority" "public"."Priority" NOT NULL,
    "first_response_hours" INTEGER NOT NULL,
    "resolution_hours" INTEGER NOT NULL,

    CONSTRAINT "sla_policies_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."audit_logs" (
    "id" TEXT NOT NULL,
    "actor_id" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "entity" TEXT NOT NULL,
    "entity_id" TEXT NOT NULL,
    "meta" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."break_glass_requests" (
    "id" TEXT NOT NULL,
    "complaint_id" TEXT NOT NULL,
    "requested_by" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "approver_id" TEXT,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "decided_at" TIMESTAMP(3),

    CONSTRAINT "break_glass_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "vault"."reporter_links" (
    "complaint_id" TEXT NOT NULL,
    "enc_user_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "reporter_links_pkey" PRIMARY KEY ("complaint_id")
);

-- CreateTable
CREATE TABLE "vault"."reporter_scores" (
    "user_id" TEXT NOT NULL,
    "score" INTEGER NOT NULL DEFAULT 60,
    "tier" TEXT NOT NULL DEFAULT 'Normal',
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "reporter_scores_pkey" PRIMARY KEY ("user_id")
);

-- CreateTable
CREATE TABLE "vault"."score_events" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "complaint_id" TEXT,
    "delta" INTEGER NOT NULL,
    "reason" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "score_events_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_username_key" ON "public"."users"("username");

-- CreateIndex
CREATE UNIQUE INDEX "users_college_email_key" ON "public"."users"("college_email");

-- CreateIndex
CREATE UNIQUE INDEX "users_roster_id_key" ON "public"."users"("roster_id");

-- CreateIndex
CREATE UNIQUE INDEX "college_roster_enrollment_no_key" ON "public"."college_roster"("enrollment_no");

-- CreateIndex
CREATE UNIQUE INDEX "college_roster_college_email_key" ON "public"."college_roster"("college_email");

-- CreateIndex
CREATE UNIQUE INDEX "complaints_tracking_key_hash_key" ON "public"."complaints"("tracking_key_hash");

-- CreateIndex
CREATE UNIQUE INDEX "categories_name_key" ON "public"."categories"("name");

-- CreateIndex
CREATE UNIQUE INDEX "locations_name_key" ON "public"."locations"("name");

-- CreateIndex
CREATE UNIQUE INDEX "target_entities_label_key" ON "public"."target_entities"("label");

-- CreateIndex
CREATE UNIQUE INDEX "sla_policies_priority_key" ON "public"."sla_policies"("priority");

-- AddForeignKey
ALTER TABLE "public"."users" ADD CONSTRAINT "users_roster_id_fkey" FOREIGN KEY ("roster_id") REFERENCES "public"."college_roster"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."verification_requests" ADD CONSTRAINT "verification_requests_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."complaints" ADD CONSTRAINT "complaints_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "public"."categories"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."complaints" ADD CONSTRAINT "complaints_location_id_fkey" FOREIGN KEY ("location_id") REFERENCES "public"."locations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."complaints" ADD CONSTRAINT "complaints_assigned_to_fkey" FOREIGN KEY ("assigned_to") REFERENCES "public"."users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."complaints" ADD CONSTRAINT "complaints_cluster_id_fkey" FOREIGN KEY ("cluster_id") REFERENCES "public"."complaint_clusters"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."complaints" ADD CONSTRAINT "complaints_target_entity_id_fkey" FOREIGN KEY ("target_entity_id") REFERENCES "public"."target_entities"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."complaint_events" ADD CONSTRAINT "complaint_events_complaint_id_fkey" FOREIGN KEY ("complaint_id") REFERENCES "public"."complaints"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."complaint_messages" ADD CONSTRAINT "complaint_messages_complaint_id_fkey" FOREIGN KEY ("complaint_id") REFERENCES "public"."complaints"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."internal_notes" ADD CONSTRAINT "internal_notes_complaint_id_fkey" FOREIGN KEY ("complaint_id") REFERENCES "public"."complaints"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."internal_notes" ADD CONSTRAINT "internal_notes_admin_id_fkey" FOREIGN KEY ("admin_id") REFERENCES "public"."users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."attachments" ADD CONSTRAINT "attachments_complaint_id_fkey" FOREIGN KEY ("complaint_id") REFERENCES "public"."complaints"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."attachments" ADD CONSTRAINT "attachments_message_id_fkey" FOREIGN KEY ("message_id") REFERENCES "public"."complaint_messages"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ai_analyses" ADD CONSTRAINT "ai_analyses_complaint_id_fkey" FOREIGN KEY ("complaint_id") REFERENCES "public"."complaints"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."risk_alerts" ADD CONSTRAINT "risk_alerts_complaint_id_fkey" FOREIGN KEY ("complaint_id") REFERENCES "public"."complaints"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."risk_alerts" ADD CONSTRAINT "risk_alerts_cluster_id_fkey" FOREIGN KEY ("cluster_id") REFERENCES "public"."complaint_clusters"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."risk_alerts" ADD CONSTRAINT "risk_alerts_target_entity_id_fkey" FOREIGN KEY ("target_entity_id") REFERENCES "public"."target_entities"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."rule_versions" ADD CONSTRAINT "rule_versions_rule_id_fkey" FOREIGN KEY ("rule_id") REFERENCES "public"."rule_documents"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."rule_chunks" ADD CONSTRAINT "rule_chunks_rule_id_fkey" FOREIGN KEY ("rule_id") REFERENCES "public"."rule_documents"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."assistant_sessions" ADD CONSTRAINT "assistant_sessions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."assistant_messages" ADD CONSTRAINT "assistant_messages_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "public"."assistant_sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."sos_events" ADD CONSTRAINT "sos_events_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."sos_location_pings" ADD CONSTRAINT "sos_location_pings_sos_id_fkey" FOREIGN KEY ("sos_id") REFERENCES "public"."sos_events"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."audit_logs" ADD CONSTRAINT "audit_logs_actor_id_fkey" FOREIGN KEY ("actor_id") REFERENCES "public"."users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."break_glass_requests" ADD CONSTRAINT "break_glass_requests_complaint_id_fkey" FOREIGN KEY ("complaint_id") REFERENCES "public"."complaints"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
