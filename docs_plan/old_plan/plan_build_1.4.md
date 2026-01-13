plan build_1.4
communication_force_spec_v1:
  meta:
    module: "communication"
    parts: ["wa_gateway", "notifications", "templates", "queues", "logs"]
    version: "1.0-forced"
    notes:
      - "Force-applied revisions from user: preferred providers Fonnte (free) or wwebjs (no pricing)."
      - "WA Gateway used for billing reminders, voucher notifications, upstream reminders, and tenant messages."
      - "Feature toggles control which events are enabled per-tenant."
      - "This spec is designed to be safe for Cursor generation and implementable in Golang backend + Asynq workers."

  wa_gateway:
    summary: "WhatsApp integration layer supporting multiple providers, tenant-scoped settings, templating, throttling and queueing."
    supported_providers:
      - key: "fonnte_free_tier"
        description: "Recommended free-tier gateway (tenant supplies API key/instance as configured)."
        notes: "Use provider's API contract; implement provider adapter."
      - key: "wwebjs_local"
        description: "wwebjs-based self-hosted adapter (no pricing)."
        notes: "Requires running a wwebjs instance; implement adapter with QR/session management."
    provider_adapter_pattern:
      - "Implement provider adapter interface: SendSingleMessage, SendTemplateMessage, GetStatus, HealthCheck"
      - "Adapter returns standardized response (success/failure + provider_msg_id + error_code)."
    tenant_settings:
      table: "wa_settings"
      fields:
        - tenant_id
        - provider_key
        - api_url
        - api_key
        - sender_number
        - enabled_events (jsonb)
        - rate_limit_per_second (int, nullable -> default system rate)
        - created_at
        - updated_at
      default_defaults:
        provider_key: "fonnte_free_tier"
        rate_limit_per_second: 10
    security:
      - "Store api_key encrypted (Vault/KMS recommended)."
      - "Per-tenant isolation: tenant cannot see other tenant's WA logs or keys."
      - "Restrict template content to avoid injection (escape placeholders)."

  events_and_triggers:
    supported_events:
      - invoice_created
      - invoice_due_reminder
      - invoice_overdue
      - invoice_paid
      - tenant_isolated
      - tenant_unisolated
      - voucher_generated
      - voucher_expiring (configurable window)
      - voucher_used
      - upstream_reminder
      - manual_broadcast_by_tenant
    event_flow:
      - "Event triggered (e.g., invoice generated) -> create WA job -> enqueue into tenant queue -> worker sends via provider adapter -> log result -> update job status"
    event_config_per_tenant:
      - "Tenant can toggle which events to receive (wa_settings.enabled_events)."
      - "Tenant can set hours for sending (do-not-disturb window)."
      - "Tenant can set additional recipients (admin phone list)."

  templates:
    summary: "Template management for messages with placeholders and per-tenant templates."
    model:
      table: "wa_templates"
      fields:
        - id
        - tenant_id
        - name
        - content (string with placeholders like {name}, {amount}, {due_date}, {invoice_code}, {voucher_code})
        - variables (jsonb list)
        - is_system (bool) # default system templates
        - created_at
        - updated_at
    system_templates:
      - invoice_created: "Halo {name}, invoice Anda sebesar {amount} untuk periode {period}. ID: {invoice_code}."
      - invoice_due: "Halo {name}, tagihan {amount} jatuh tempo pada {due_date}. Silakan bayar untuk menghindari isolir."
      - invoice_paid: "Pembayaran diterima: {amount}. Terima kasih."
      - voucher_generated: "Voucher Anda: {voucher_code}. Berlaku sampai {expire_at}."
    template_rules:
      - "Placeholders must be declared in templates.variables."
      - "When sending, variables provided must match declared placeholders; missing variables -> error."
      - "Limit template length to prevent provider rejections (configurable)."

  queueing_and_throttling:
    architecture:
      - "Use Redis + Asynq for job queueing."
      - "Per-tenant queue or shared queue with tenant-scoped rate limiting."
    rate_limiting:
      default_rate_per_second: 10
      tenant_override: true (tenant can set lower/higher within global cap)
      global_cap: 50 messages/sec (platform-wide)
    job_types:
      - send_single_message_job
      - send_template_message_job
      - broadcast_job (batch)
      - health_check_job
      - retry_job
    retry_policy:
      attempts: 3
      backoff_strategy: "exponential"
      backoff_initial_seconds: 2
      max_backoff_seconds: 60
    broadcast_behavior:
      - "Broadcast jobs are chunked and enqueued in batches to respect tenant rate limits."
      - "Provide progress tracking (queued, sending, success_count, fail_count)."

  logging_and_monitoring:
    wa_logs:
      table: "wa_logs"
      fields:
        - id
        - tenant_id
        - to_number
        - template_id (nullable)
        - content
        - provider_response
        - provider_msg_id
        - status: ["queued","sent","failed","delivered","undelivered"]
        - error_code (nullable)
        - created_at
      retention:
        - default_retention_days: 365
        - tenant_basic_purge: "optional purge > 1 year as policy"
    monitoring_metrics:
      - messages_sent_total
      - messages_failed_total
      - queue_depth
      - send_latency_ms
      - provider_error_rate
    observability:
      - "Expose Prometheus metrics for workers & gateway adapters."
      - "Integrate Sentry for worker exceptions."

  api_endpoints:
    wa_management:
      - POST /api/v1/wa/test-send
        description: "Send single test message via tenant settings (for verifying config)."
      - GET /api/v1/wa/templates
      - POST /api/v1/wa/templates
      - PATCH /api/v1/wa/templates/:id
      - POST /api/v1/wa/send
        body: {to_number, template_id or content, variables}
      - POST /api/v1/wa/broadcast
        body: {filter_criteria, template_id, schedule_time(optional)}
      - GET /api/v1/wa/logs?tenant_id=...
    admin_endpoints:
      - GET /api/v1/admin/wa/queues
      - GET /api/v1/admin/wa/providers/status

  ui_pages:
    - wa_settings (tenant)
    - wa_templates (tenant)
    - wa_broadcast (tenant)
    - wa_logs (tenant)
    - wa_admin_dashboard (super_admin)
    - wa_provider_status (super_admin)

  integrations_and_triggers:
    billing_integration:
      - "Invoice events trigger WA notifications (invoice_created, due_reminder, overdue)."
      - "When invoice_paid -> send invoice_paid event."
    voucher_integration:
      - "Voucher batch generation optionally triggers voucher_generated messages to admin or customers."
    radius_integration:
      - "On auto-isolir events, send tenant_isolated/tenant_unisolated messages."
    maps_and_tech_integration:
      - "Technician assignment or task completion can trigger manual WA alerts to customer/admin."
    upstream_integration:
      - "Upstream billing reminders trigger upstream_reminder event."

  security_and_compliance:
    opt_out_handling:
      - "Tenants must manage opt-out compliance for end-users; platform provides opt-out flag handling in wa_logs and broadcast filters."
    pii_handling:
      - "Avoid storing sensitive personal message content in plaintext logs; mask if required."
    rate_limit_abuse:
      - "Super admin can temporarily suspend tenant WA sending if abuse detected."

  acceptance_criteria_communication:
    - "Tenant can configure provider and send test message successfully."
    - "Templates can be created and validated with placeholders."
    - "Broadcast respects tenant and global rate limits and shows progress."
    - "Retry policy handles transient provider failures."
    - "WA logs contain enough info for troubleshooting and are tenant-scoped."

  next_step_instruction:
    - "Step 4 (communication/WA gateway) complete. Please REVIEW YAML."
    - "If OK, reply: 'lanjut step 5' to proceed to Step 5 (HCM & Maps final adjustments or as chosen)."
