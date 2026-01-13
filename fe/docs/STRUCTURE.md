# RRNET Frontend Structure

## Overview

RRNET frontend is built with **Next.js 14+ App Router** using **MVVM (Model-View-ViewModel)** architecture pattern for clean separation of concerns and testability.

## Tech Stack

- **Framework:** Next.js 14+ (App Router)
- **Language:** TypeScript
- **Styling:** Tailwind CSS
- **State Management:** React Context + Custom Hooks
- **HTTP Client:** fetch (native) or axios
- **Form Handling:** react-hook-form + zod validation
- **UI Components:** Radix UI primitives + custom components

## Architecture Pattern: MVVM

```
┌─────────────────────────────────────────────┐
│              View (React Component)          │
│  - Renders UI                                │
│  - Handles user interactions                 │
│  - Delegates logic to ViewModel              │
└─────────────────┬───────────────────────────┘
                  │
                  ↓
┌─────────────────────────────────────────────┐
│          ViewModel (Custom Hook)             │
│  - Manages component state                   │
│  - Handles business logic                    │
│  - Calls services for data                   │
│  - Transforms data for View                  │
└─────────────────┬───────────────────────────┘
                  │
                  ↓
┌─────────────────────────────────────────────┐
│            Service (API Layer)               │
│  - HTTP requests to backend                  │
│  - Data transformation                       │
│  - Error handling                            │
└─────────────────┬───────────────────────────┘
                  │
                  ↓
┌─────────────────────────────────────────────┐
│               Model (Types)                  │
│  - TypeScript interfaces                     │
│  - Data structures                           │
└─────────────────────────────────────────────┘
```

## Directory Structure

```
fe/
├── src/
│   ├── app/                          # Next.js App Router
│   │   ├── (auth)/                   # Auth layout group
│   │   │   ├── login/
│   │   │   └── layout.tsx
│   │   │
│   │   ├── (super-admin)/            # Super Admin layout group
│   │   │   ├── dashboard/
│   │   │   ├── tenants/
│   │   │   ├── plans/
│   │   │   ├── addons/
│   │   │   ├── billing/
│   │   │   ├── wa-providers/
│   │   │   ├── feature-toggles/
│   │   │   └── layout.tsx
│   │   │
│   │   ├── (tenant)/                 # Tenant layout group
│   │   │   ├── dashboard/
│   │   │   ├── routers/
│   │   │   ├── clients/
│   │   │   ├── billing/
│   │   │   ├── maps/
│   │   │   ├── hr/
│   │   │   ├── collector/
│   │   │   ├── technician/
│   │   │   ├── wa-gateway/
│   │   │   └── layout.tsx
│   │   │
│   │   ├── (client)/                 # Client portal layout group
│   │   │   ├── invoices/
│   │   │   ├── profile/
│   │   │   └── layout.tsx
│   │   │
│   │   ├── layout.tsx                # Root layout
│   │   ├── globals.css               # Global styles
│   │   └── page.tsx                  # Home page
│   │
│   ├── modules/                      # Feature modules
│   │   ├── auth/
│   │   │   ├── components/
│   │   │   ├── hooks/                # ViewModels
│   │   │   ├── services/
│   │   │   └── types.ts
│   │   │
│   │   ├── tenant/
│   │   │   ├── components/
│   │   │   ├── hooks/
│   │   │   ├── services/
│   │   │   └── types.ts
│   │   │
│   │   ├── billing/
│   │   ├── maps/
│   │   ├── hr/
│   │   ├── collector/
│   │   ├── technician/
│   │   ├── wa-gateway/
│   │   └── ...
│   │
│   ├── components/                   # Shared UI components
│   │   ├── ui/                       # Base UI primitives
│   │   │   ├── button.tsx
│   │   │   ├── input.tsx
│   │   │   ├── card.tsx
│   │   │   └── ...
│   │   │
│   │   ├── layout/
│   │   │   ├── header.tsx
│   │   │   ├── sidebar.tsx
│   │   │   └── footer.tsx
│   │   │
│   │   └── common/
│   │       ├── loading.tsx
│   │       ├── error-boundary.tsx
│   │       └── ...
│   │
│   ├── lib/                          # Utilities & config
│   │   ├── api-client.ts             # Base HTTP client
│   │   ├── auth.ts                   # Auth utilities
│   │   ├── rbac.ts                   # RBAC helpers
│   │   └── utils.ts                  # Common utilities
│   │
│   ├── contexts/                     # React Context providers
│   │   ├── auth-context.tsx
│   │   ├── tenant-context.tsx
│   │   └── theme-context.tsx
│   │
│   └── types/                        # Global TypeScript types
│       ├── api.ts
│       ├── user.ts
│       └── ...
│
├── public/                           # Static assets
├── docs/                             # Documentation
├── package.json
├── tsconfig.json
├── tailwind.config.ts
└── next.config.ts
```

## MVVM Implementation Example

### Model (Type Definition)
```typescript
// modules/tenant/types.ts
export interface Tenant {
  id: string;
  name: string;
  subdomain: string;
  plan: string;
  status: 'active' | 'suspended';
  createdAt: string;
}
```

### Service (API Layer)
```typescript
// modules/tenant/services/tenant-service.ts
export class TenantService {
  async getTenants(): Promise<Tenant[]> {
    const response = await fetch('/api/v1/tenants');
    if (!response.ok) throw new Error('Failed to fetch tenants');
    return response.json();
  }

  async createTenant(data: CreateTenantDto): Promise<Tenant> {
    const response = await fetch('/api/v1/tenants', {
      method: 'POST',
      body: JSON.stringify(data),
    });
    if (!response.ok) throw new Error('Failed to create tenant');
    return response.json();
  }
}
```

### ViewModel (Custom Hook)
```typescript
// modules/tenant/hooks/use-tenant-list.ts
export function useTenantList() {
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const service = new TenantService();

  const loadTenants = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await service.getTenants();
      setTenants(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadTenants();
  }, []);

  return { tenants, loading, error, refetch: loadTenants };
}
```

### View (React Component)
```typescript
// app/(super-admin)/tenants/page.tsx
export default function TenantsPage() {
  const { tenants, loading, error } = useTenantList();

  if (loading) return <LoadingSpinner />;
  if (error) return <ErrorMessage message={error} />;

  return (
    <div>
      <h1>Tenants</h1>
      <TenantList tenants={tenants} />
    </div>
  );
}
```

## Routing Strategy

### Layout Groups
Next.js route groups for role-based layouts:

- `(auth)` - Login/register pages
- `(super-admin)` - Super admin panel
- `(tenant)` - Tenant admin/owner/staff pages
- `(client)` - End-user client portal

### Route Protection
Use middleware to check authentication and role:

```typescript
// middleware.ts
export function middleware(request: NextRequest) {
  const token = request.cookies.get('auth_token');
  const role = getUserRole(token);

  if (!token) {
    return NextResponse.redirect('/login');
  }

  // Role-based routing
  if (request.nextUrl.pathname.startsWith('/super-admin')) {
    if (role !== 'super_admin') {
      return NextResponse.redirect('/unauthorized');
    }
  }

  return NextResponse.next();
}
```

## Role-Based UI Surfaces

### Super Admin
- Tenant management (list, create, suspend, impersonate)
- Plan & add-on catalog
- SaaS billing overview
- Feature toggles (global & per-tenant)
- WA provider configuration
- System monitoring

### Owner/Admin (Tenant)
- Dashboard (revenue, active users, outages)
- Network management (routers, radius, vouchers)
- Client management
- Billing (invoices, payments)
- Maps (ODC/ODP/Client topology)
- HR (employees, attendance, payroll)
- Collector management
- Technician tasks
- WA gateway settings

### HR (Tenant)
- Employee CRUD
- Attendance input/review
- Leave approval
- Payroll management

### Finance (Tenant)
- Invoice management
- Payment recording
- Financial reports

### Technician (Tenant)
- Task list
- Activity logging with photos
- Map view (ODC/ODP/Client)

### Collector (Tenant)
- Assigned client list
- Visit status update (3-phase flow)
- Cash deposit tracking

### Client (End-User)
- Invoice list & payment
- Profile management
- Service status

## Component Reusability

### Base UI Components (`components/ui/`)
Reusable primitives built on Radix UI:
- Button
- Input, Textarea, Select
- Card, Dialog, Dropdown
- Table, Tabs, Accordion
- Alert, Badge, Toast

### Layout Components (`components/layout/`)
- Header with role-based navigation
- Sidebar with dynamic menu per role
- Footer
- Breadcrumbs

### Common Components (`components/common/`)
- LoadingSpinner
- ErrorMessage
- EmptyState
- Pagination
- SearchBar
- DataTable

## State Management

### Global State (React Context)
- AuthContext - User session, role, permissions
- TenantContext - Current tenant info (for multi-tenant)
- ThemeContext - Dark/light mode

### Local State (useState/useReducer)
- Form state
- UI toggles (modals, dropdowns)
- Temporary data

### Server State (React Query - future)
- API data caching
- Background refetching
- Optimistic updates

## Styling Conventions

### Tailwind CSS
- Use utility-first approach
- Extract repeated patterns to components
- Use `@apply` sparingly for complex patterns

### Color Scheme
```css
:root {
  --primary: #3b82f6;
  --secondary: #8b5cf6;
  --success: #10b981;
  --warning: #f59e0b;
  --danger: #ef4444;
  --background: #ffffff;
  --foreground: #0f172a;
}
```

### Responsive Design
- Mobile-first approach
- Breakpoints: sm (640px), md (768px), lg (1024px), xl (1280px)

## API Integration

### Base Client
```typescript
// lib/api-client.ts
export class ApiClient {
  private baseURL = process.env.NEXT_PUBLIC_API_URL;

  async request<T>(endpoint: string, options?: RequestInit): Promise<T> {
    const response = await fetch(`${this.baseURL}${endpoint}`, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...options?.headers,
      },
    });

    if (!response.ok) {
      throw new Error(`API error: ${response.statusText}`);
    }

    return response.json();
  }
}
```

### Environment Variables
```bash
NEXT_PUBLIC_API_URL=http://localhost:8080/api/v1
NEXT_PUBLIC_WS_URL=ws://localhost:8080/ws
```

## Testing Strategy (Future)

### Unit Tests
- ViewModel hooks (custom hooks)
- Utility functions
- Service layer

### Integration Tests
- API service calls
- Form submissions
- Navigation flows

### E2E Tests (Playwright/Cypress)
- Critical user flows
- Multi-role scenarios

## Performance Optimization

### Code Splitting
- Dynamic imports for heavy components
- Route-based splitting (automatic with App Router)

### Image Optimization
- Use Next.js `<Image>` component
- Lazy loading
- WebP format

### Caching
- API response caching
- Static page generation where possible
- ISR (Incremental Static Regeneration)

## Accessibility

- Semantic HTML
- ARIA labels
- Keyboard navigation
- Screen reader support
- Focus management

## Next Steps

**Phase 1** (Current) ✅ - Project structure and documentation

**Phase 2** - Core UI foundations:
1. Authentication pages (login, forgot password)
2. Layout components (header, sidebar, navigation)
3. Base UI component library
4. RBAC helper utilities

**Phase 3** - Super Admin UI:
1. Tenant management pages
2. Plan & add-on catalog
3. Feature toggle center
4. Monitoring dashboard

**Phase 4** - Tenant UI:
1. Dashboard
2. Network management (routers, radius, vouchers)
3. Client management
4. Billing pages

**Phase 5** - Advanced modules:
1. Maps (ODC/ODP/Client topology)
2. HR module
3. Collector interface
4. Technician mobile-friendly UI
5. Client portal

---

**Current Status:** Phase 1 - Structure documented, ready for implementation.

