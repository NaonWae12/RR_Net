# Database Migrations

## Overview
This folder contains SQL migration files for the RRNET database schema using [golang-migrate](https://github.com/golang-migrate/migrate).

## File Naming Convention
```
{version}_{description}.up.sql   - Apply migration
{version}_{description}.down.sql - Rollback migration
```

## Current Migrations

| Version | Description |
|---------|-------------|
| 000001 | Create tenants table (multi-tenant core) |
| 000002 | Create roles table (RBAC system) |
| 000003 | Create users table (authentication) |
| 000004 | Create plans table (SaaS pricing) |
| 000005 | Create addons table (add-on catalog) |
| 000006 | Create tenant_addons table (subscriptions) |
| 000007 | Create feature_toggles table (feature flags) |
| 000008 | Create clients table (end-user customers) |
| 000009 | Add FK constraints (deferred references) |

## Running Migrations

### Prerequisites
- PostgreSQL running (via Docker or native)
- golang-migrate CLI installed

### Install golang-migrate
```bash
# Windows (scoop)
scoop install migrate

# macOS
brew install golang-migrate

# Go install
go install -tags 'postgres' github.com/golang-migrate/migrate/v4/cmd/migrate@latest
```

### Apply All Migrations
```bash
migrate -path ./migrations -database "postgres://rrnet:rrnet_secret@localhost:5432/rrnet_dev?sslmode=disable" up
```

### Rollback Last Migration
```bash
migrate -path ./migrations -database "postgres://rrnet:rrnet_secret@localhost:5432/rrnet_dev?sslmode=disable" down 1
```

### Check Current Version
```bash
migrate -path ./migrations -database "postgres://rrnet:rrnet_secret@localhost:5432/rrnet_dev?sslmode=disable" version
```

### Force Version (fix dirty state)
```bash
migrate -path ./migrations -database "postgres://rrnet:rrnet_secret@localhost:5432/rrnet_dev?sslmode=disable" force VERSION
```

## Init Folder
The `init/` folder contains SQL files that run automatically when the PostgreSQL Docker container starts for the first time. These set up extensions.

## Schema Overview

```
tenants (1) ─────── (*) users
    │                    │
    │                    └── role_id → roles
    │
    ├── plan_id → plans
    │
    ├── (*) tenant_addons ── addon_id → addons
    │
    ├── (*) feature_toggles (tenant-specific)
    │
    └── (*) clients ── user_id → users (optional)
```

## Notes

1. **UUID Primary Keys**: All tables use UUID for better distribution and security
2. **Soft Deletes**: Tables with `deleted_at` support soft deletion
3. **JSONB Fields**: Flexible schema for settings, limits, permissions
4. **Triggers**: `updated_at` auto-updates on row modification
5. **Indexes**: Optimized for common query patterns

## Adding New Migrations

1. Create new files with next version number:
   ```bash
   touch migrations/000010_create_xyz.up.sql
   touch migrations/000010_create_xyz.down.sql
   ```

2. Write forward migration in `.up.sql`
3. Write rollback migration in `.down.sql`
4. Test both directions before committing

