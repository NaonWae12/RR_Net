# Frontend Performance Optimization Guide

## Overview

This guide documents the performance optimizations applied to the RRNet frontend application, focusing on bundle size reduction, code splitting, and component reusability.

## Component Consolidation

### Removed Duplicate Components

The following duplicate components have been removed and replaced with FE_12 reusable components:

1. **LoadingSpinner**
   - ❌ `components/common/LoadingSpinner.tsx` (removed)
   - ✅ `components/utilities/LoadingSpinner.tsx` (use this)

2. **EmptyState**
   - ❌ `components/common/EmptyState.tsx` (removed)
   - ✅ `components/utilities/EmptyState.tsx` (use this)

3. **SkeletonLoader**
   - ❌ `components/common/SkeletonLoader.tsx` (removed)
   - ✅ `components/utilities/SkeletonLoader.tsx` (use this)

4. **StatusBadge**
   - ❌ `components/common/StatusBadge.tsx` (removed)
   - ✅ `components/utilities/StatusBadge.tsx` (use this)

5. **DataTable**
   - ❌ `components/common/DataTable.tsx` (removed)
   - ✅ `components/tables/DataTable.tsx` (use this)

## Import Migration

### Before (Old)
```tsx
import { LoadingSpinner } from "@/components/common/LoadingSpinner";
import { EmptyState } from "@/components/common/EmptyState";
import { StatusBadge } from "@/components/common/StatusBadge";
```

### After (New)
```tsx
import { LoadingSpinner } from "@/components/utilities/LoadingSpinner";
import { EmptyState } from "@/components/utilities/EmptyState";
import { StatusBadge } from "@/components/utilities/StatusBadge";
```

## Bundle Optimization

### Code Splitting Strategy

1. **Vendor Chunks**: All node_modules dependencies are split into separate chunks
2. **Common Components Chunk**: All FE_12 reusable components are bundled together
3. **UI Primitives Chunk**: shadcn/ui components are in a separate chunk
4. **Route-based Splitting**: Next.js automatically splits by route

### Package Import Optimization

The following packages are optimized for tree-shaking:
- `@tanstack/react-table`
- `recharts`
- `react-hook-form`
- `zod`
- `@radix-ui/react-dialog`
- `@radix-ui/react-dropdown-menu`
- `sonner`

## Performance Best Practices

### 1. Use Reusable Components

Always use components from FE_12 instead of creating duplicates:

```tsx
// ✅ Good
import { DataTable } from "@/components/tables";
import { LoadingSpinner } from "@/components/utilities";

// ❌ Bad
import { CustomTable } from "./CustomTable"; // Don't create duplicates
```

### 2. Lazy Loading

Use dynamic imports for heavy components:

```tsx
import dynamic from "next/dynamic";

const HeavyChart = dynamic(() => import("@/components/charts/LineChart"), {
  loading: () => <LoadingSpinner />,
  ssr: false,
});
```

### 3. React.memo

All FE_12 components are wrapped with React.memo for performance. When creating new components, consider using React.memo for expensive renders.

### 4. Image Optimization

Use Next.js Image component for all images:

```tsx
import Image from "next/image";

<Image
  src="/image.jpg"
  alt="Description"
  width={500}
  height={300}
  priority={false} // Set to true for above-the-fold images
/>
```

## Bundle Size Monitoring

### Check Bundle Size

```bash
npm run build
```

The build output will show bundle sizes for each route and chunk.

### Analyze Bundle

```bash
npm run build -- --analyze
```

This will generate a bundle analysis report.

## Migration Checklist

- [x] Remove duplicate components from `components/common/`
- [x] Update all imports to use FE_12 components
- [x] Configure Next.js for optimal code splitting
- [x] Optimize package imports
- [x] Add security headers
- [ ] Update all remaining files using old imports
- [ ] Verify bundle sizes are optimized
- [ ] Test all pages after migration

## Next Steps

1. Run migration script to update all imports automatically
2. Verify no duplicate components remain
3. Monitor bundle sizes after changes
4. Test application functionality

