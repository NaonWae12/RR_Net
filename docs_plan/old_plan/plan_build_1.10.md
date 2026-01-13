plan build_1.10
architecture_final_force_spec_v1:
  meta:
    module: "final_architecture"
    version: "1.0-forced"
    notes:
      - "Defines how BE + FE are structured. All modules from Step 1–9 included."
      - "Cursor uses this as coding guideline & folder reference."
      - "Supports MVVM, modular-block coding, reusable components, and clean service architecture."

  tech_stack:
    backend:
      language: golang
      framework: fiber_or_echo_or_gin (bebas, prefer Echo)
      db: postgresql
      cache: redis
      queue: asynq
      worker: asynq_worker
      orm: gorm_or_sqlc (prefer sqlc for clean)
      auth: jwt + refresh_token + tenant_context
      deps_mgmt: go_mod
    frontend:
      language: typescript
      framework: nextjs
      ui_lib: shadcn_ui + tailwindcss
      state: zustand_or_recoil (prefer zustand)
      architecture: MVVM (View / ViewModel / Model)
      fetcher: tanstack_query + axios
      routing: next/router + middleware auth

  monorepo_structure:
    root:
      - backend/
      - frontend/
      - infra/
      - scripts/
      - docs/
      - shared/

  backend_structure:
    backend:
      cmd/:
        - api/
          - main.go
        - worker/
          - main.go

      internal/:
        config/
          - config.go
          - env_loader.go
        common/
          - errors/
          - responses/
          - utils/
          - constants/
          - validations/
        middleware/
          - auth_middleware.go
          - tenant_middleware.go
          - rbac_middleware.go
          - feature_toggle_middleware.go
        domain/:
          auth/
            - handler.go
            - service.go
            - repository.go
            - model.go
          tenant/
            - ...
          rbac/
            - ...
          network/
            router/
              - handler.go
              - service.go
              - repository.go
              - sync_jobs.go
            radius/
              - handler.go
              - service.go
              - accounting.go
          voucher/
            - handler.go
            - service.go
            - generator.go
            - model.go
          billing/
            saas/
              ...
            enduser/
              ...
            upstream/
              ...
          wa/
            - provider_adapter.go
            - fonnte_adapter.go
            - wwebjs_adapter.go
            - wa_service.go
          maps/
            odc/
              ...
            odp/
              ...
            client/
              ...
            outage/
              ...
          hr/
            employee/
            attendance/
            payroll/
            technician_activity/
          addon/
            catalog/
            tenant_addon/
            addon_requests/
          superadmin/
            ...
        repository/
          - postgres implementation
          - redis implementation
        service/
          - business logic per domain
        handler/
          - REST API per module
        jobs/
          - router_sync_job.go
          - billing_jobs.go
          - wa_jobs.go
          - outage_job.go
          - voucher_expiry.go
        server/
          - http_server.go
          - routes.go
          - worker_server.go

      pkg/:
        shared_libs/
          - logger/
          - crypto/
          - http_client/
          - pdf_generator/
          - file_exporter/

  backend_rules:
    - "Setiap module = folder domain sendiri (micro-services style inside monolith)."
    - "Tidak ada file besar, setiap fitur pecah menjadi handler/service/repo."
    - "Semua logic berat → masuk service layer."
    - "Repository = pure DB access."
    - "Handler = request/response only."
    - "Reusable logic masukkan ke internal/common atau pkg."
    - "Semua API tenant-protected memakai tenant_middleware."
    - "WA adapter harus interface-based."

  frontend_structure_mvvm:
    frontend:
      src/
        app/
          (routes)
        modules/:
          auth/
            view/
              - LoginPage.tsx
              - RegisterPage.tsx
            viewmodel/
              - useLoginVM.ts
              - useRegisterVM.ts
            model/
              - auth.model.ts
              - auth.types.ts
          tenant/
            view/
            viewmodel/
            model/
          billing/
            ...
          network/
            router/
              view/
                - RouterList.tsx
                - RouterDetail.tsx
              viewmodel/
                - useRouterListVM.ts
                - useRouterDetailVM.ts
              model/
                - router.model.ts
            radius/
              ...
          voucher/
          hr/
          maps/
            odc/
            odp/
            client/
            outage/
          addon/
          superadmin/
        components/
          ui/ (shadcn overrides)
          forms/
          table/
          chart/
          map/
        shared/
          hooks/
          helpers/
          constants/
          types/
          api/

  frontend_rules_mvvm:
    - "Setiap halaman = View (pure UI)."
    - "Logic & state → ViewModel (Zustand or hook)."
    - "Model = schema, API contracts, DTO, types."
    - "Jangan gabungkan UI dengan business logic.”
    - "Gunakan reusable components untuk form, table, modal, filter."
    - "Semua module = folder terpisah (micro-block style)."

  api_contract_general:
    - JSON format
    - snake_case payload
    - camelCase TypeScript types
    - Required: tenant_id comes from auth token
    - All routes behind middleware unless public (auth)

  communication_between_fe_be:
    method:
      - REST API
      - SSE/Websocket future (not v1)
      - Background jobs not exposed to frontend
    mapping:
      - FE ViewModel <-> BE Handler
      - Model types auto generated (optional)

  deployment_architecture:
    pattern: "Modular Monolith with Horizontal Scalability"
    components:
      - backend api container
      - backend worker container
      - frontend nextjs container
      - postgres container
      - redis container
      - s3/minio storage
      - nginx reverse proxy
    scaling:
      - api autoscale
      - worker autoscale
      - wa gateway adapter optional node

  coding_guidelines:
    general:
      - small files, small components
      - pure functions when possible
      - avoid duplication (DRY)
      - reusable components mandatory
      - follow consistent naming
    BE:
      - handler/service/repo separation
      - domain-driven folderization
    FE:
      - MVVM ALWAYS
      - no logic in views
      - ViewModel handles all state & fetching

  final_acceptance_criteria_architecture:
    - "FE MVVM berjalan mulus."
    - "BE modular-block jelas dan scalable."
    - "Semua step 1–9 sudah terhubung dalam arsitektur."
    - "Folder structure siap pakai untuk Cursor."
    - "Deployment architecture jelas."
    - "Cursor bisa generate code langsung pakai blueprint ini."

  next_step_instruction:
    - "Step 10 selesai."
    - "Siap disatukan ke MASTER PROMPT."
