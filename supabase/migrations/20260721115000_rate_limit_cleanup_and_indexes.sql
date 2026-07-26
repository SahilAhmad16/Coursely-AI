-- The public AI endpoint uses a process-local limiter. A public SECURITY DEFINER
-- RPC is deliberately avoided so anonymous users cannot write to the database.
drop function if exists public.consume_assistant_rate_limit(text);
drop table if exists public.assistant_rate_limits;

-- Cover foreign keys introduced by marketplace safety and messaging features.
create index if not exists audit_logs_actor_created_idx on public.audit_logs(actor_id, created_at desc);
create index if not exists listing_reports_reporter_idx on public.listing_reports(reporter_id);
create index if not exists listing_reports_reviewed_by_idx on public.listing_reports(reviewed_by) where reviewed_by is not null;
create index if not exists message_attachments_sender_idx on public.message_attachments(sender_id);
create index if not exists wishlists_product_idx on public.wishlists(product_id);
