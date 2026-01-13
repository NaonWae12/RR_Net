execution_prompt:
id: "RRNET_EXEC_01_BACKEND_FOUNDATIONS"
purpose: >
Implement backend infrastructure foundations for RRNet SaaS
based on the master force_spec. This step sets up the core
runtime, configuration, infra clients, and HTTP server skeleton.
No business logic yet.

tech_stack:
language: golang
framework: net_http
database: postgresql
cache_and_event_bus: redis + asynq
architecture_style: modular_block
target_env: local_dev

scope:
include: - go_module_initialization - project_folder_structure - config_loader (env-based) - structured_logger (json) - postgres_connection_pool - redis_client - asynq_worker_client - http_server_bootstrap - base_middlewares - versioned_routing_structure
exclude: - auth_logic - rbac_enforcement - tenant_business_logic - billing - maps - mikrotik - radius - wa_gateway - addons - collector - hr - technician

deliverables: - "Complete backend folder tree" - "Compilable Go code" - "Clear TODO comments for next modules" - "README or docs comment explaining structure"

backend_structure:
root: "backend/"
folders: - cmd/api/main.go - internal/config/ - internal/logger/ - internal/infra/postgres/ - internal/infra/redis/ - internal/infra/asynq/ - internal/http/server/ - internal/http/middleware/ - internal/http/router/ - internal/version/ - internal/health/ - pkg/utils/ - go.mod - go.sum

configuration:
env_vars: - APP_ENV - APP_NAME - APP_PORT - DATABASE_URL - REDIS_ADDR - REDIS_PASSWORD - REDIS_DB
rules: - "Fail fast if required env vars are missing" - "Use sane defaults for local development"

infra_requirements:
postgres:
library: "pgxpool"
behavior: - connection_pooling - ping_on_startup
redis:
library: "go-redis"
behavior: - lazy_connect
asynq:
behavior: - client_init - server_init (worker placeholder) - queue_names: - default - billing - notification

http_server:
behavior: - graceful_shutdown - configurable_port - structured_request_logging
routes:
public: - GET /health - GET /version
versioned_api:
base_path: "/api/v1"
note: "Business routes will be added later"

middlewares:
required: - request_id - recover_panic - request_logger - tenant_context_placeholder
notes: - "tenant_context only extracts sub-domain for now" - "no tenant validation yet"

coding_rules: - "Keep code simple and readable" - "No premature abstractions" - "Each infra client in its own package" - "Do not implement business logic" - "Add TODO markers for next execution steps"

output_expectations: - "Show generated file tree" - "Provide full Go code per file" - "Explain briefly how to run the server"

stop_condition: - "Stop after backend foundation compiles and runs" - "Do NOT continue to auth, RBAC, or tenant logic"

instruction_to_ai: - "Use the RRNet master force_spec as architectural reference" - "Focus only on infrastructure and server bootstrap" - "Do not over-engineer" - "Produce working, clean, minimal code"
