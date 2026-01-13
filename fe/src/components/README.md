# RRNet Common Components Library

Comprehensive, reusable component library for RRNet SaaS platform built with Next.js, TypeScript, and Tailwind CSS.

## Overview

This library provides enterprise-grade, reusable components following the design principles:
- **Highly reusable and configurable**
- **Type-safe with TypeScript**
- **Accessibility-first design**
- **Responsive design for all screen sizes**
- **Performance optimized with React.memo**
- **Consistent design system**

## Component Categories

### 📊 Tables (`components/tables/`)

Advanced data table component with comprehensive features:

- **DataTable**: Main table component with pagination, sorting, filtering, export
- **DataTablePagination**: Pagination controls with page size options
- **DataTableFilters**: Advanced filtering system
- **DataTableColumnVisibility**: Column visibility toggle
- **DataTableExport**: Export to CSV, Excel, PDF

**Usage:**
```tsx
import { DataTable } from "@/components/tables";

<DataTable
  data={users}
  columns={columns}
  pagination={{ pageSize: 10 }}
  searchable
  filterable
  selectable
  onExport={(format) => handleExport(format)}
/>
```

### 📈 Charts (`components/charts/`)

Comprehensive chart components using Recharts:

- **ChartContainer**: Base container for all charts
- **LineChart**: Interactive line charts with zoom, annotations
- **BarChart**: Vertical/horizontal, grouped/stacked bars
- **PieChart**: Pie/donut charts with exploded slices
- **GaugeChart**: KPI gauge visualization
- **HeatMap**: Heat map visualization
- **ChartLegend**: Customizable legend component

**Usage:**
```tsx
import { LineChart } from "@/components/charts";

<LineChart
  data={chartData}
  xAxis={{ dataKey: "date", label: "Date" }}
  yAxis={{ dataKey: "value", label: "Value" }}
  lines={[{ dataKey: "sales", name: "Sales" }]}
  title="Sales Trend"
/>
```

### 📤 File Upload (`components/uploads/`)

Advanced file upload components:

- **FileUpload**: Drag & drop, multiple files, validation
- **FileUploadProgress**: Progress tracking with speed/time
- **FilePreview**: Image, video, audio, PDF preview
- **FileGallery**: Multi-file gallery with navigation
- **ImageCropper**: Image cropping with zoom/rotate
- **DocumentViewer**: Document viewer with zoom controls

**Usage:**
```tsx
import { FileUpload } from "@/components/uploads";

<FileUpload
  accept={["image/*", "application/pdf"]}
  maxSize={10 * 1024 * 1024}
  multiple
  onUpload={handleUpload}
  preview
/>
```

### 📝 Forms (`components/forms/`)

Dynamic form generation system:

- **FormGenerator**: Schema-based form generation
- **FormField**: Dynamic form fields with validation
- **FormSection**: Section grouping for forms
- **FormWizard**: Multi-step form wizard
- **FormActions**: Form action buttons
- **FormValidation**: Validation error display

**Usage:**
```tsx
import { FormGenerator } from "@/components/forms";

<FormGenerator
  schema={{
    name: { type: "text", label: "Name", validation: [{ type: "required", message: "Required" }] },
    email: { type: "email", label: "Email" },
  }}
  onSubmit={handleSubmit}
/>
```

### 🪟 Modals (`components/modals/`)

Modal system with variants:

- **Modal**: Base modal component
- **ConfirmModal**: Confirmation modal with countdown
- **FormModal**: Modal with form integration
- **ImageModal**: Image viewer modal
- **VideoModal**: Video player modal
- **Drawer**: Side drawer component

**Usage:**
```tsx
import { ConfirmModal } from "@/components/modals";

<ConfirmModal
  isOpen={isOpen}
  onClose={handleClose}
  onConfirm={handleConfirm}
  title="Delete Item"
  message="Are you sure?"
  danger
  requireConfirmation
  confirmationText="DELETE"
/>
```

### 🛠️ Utilities (`components/utilities/`)

Utility components:

- **LoadingSpinner**: Multiple variants (spinner, dots, pulse)
- **StatusBadge**: Status indicators with icons
- **ProgressIndicator**: Linear & circular progress
- **SkeletonLoader**: Loading skeletons
- **EmptyState**: Empty state with actions
- **ErrorBoundary**: Error boundary component

**Usage:**
```tsx
import { LoadingSpinner, StatusBadge } from "@/components/utilities";

<LoadingSpinner size="lg" variant="dots" overlay text="Loading..." />
<StatusBadge status="Active" variant="success" icon={<CheckIcon />} />
```

### 📐 Layouts (`components/layouts/`)

Layout components:

- **PageLayout**: Standard page layout with header/sidebar
- **SidebarLayout**: Collapsible sidebar layout
- **CardLayout**: Grid-based card layout
- **TabLayout**: Tab-based layout
- **AccordionLayout**: Accordion layout
- **GridLayout**: Flexible grid layout

**Usage:**
```tsx
import { PageLayout } from "@/components/layouts";

<PageLayout
  title="Dashboard"
  breadcrumbs={[{ label: "Home", href: "/" }, { label: "Dashboard" }]}
  actions={<Button>New Item</Button>}
>
  {children}
</PageLayout>
```

### 💬 Feedback (`components/feedback/`)

User feedback components:

- **Toast**: Toast notifications (using Sonner)
- **Alert**: Alert banners with variants
- **Notification**: Notification list with actions
- **Tooltip**: Tooltip component
- **Popover**: Popover component
- **Dropdown**: Dropdown menu

**Usage:**
```tsx
import { toast, Alert, Tooltip } from "@/components/feedback";

toast({ type: "success", title: "Success!", message: "Item created" });
<Alert variant="info" message="Information" dismissible />
<Tooltip content="Help text"><Button>Hover me</Button></Tooltip>
```

## Performance Optimization

All components are optimized with:
- **React.memo** for expensive components
- **useMemo** for expensive calculations
- **useCallback** for function references
- **Code splitting** for large components
- **Lazy loading** where appropriate

## Accessibility

All components include:
- **ARIA attributes** for screen readers
- **Semantic HTML** elements
- **Keyboard navigation** support
- **Focus management**
- **Screen reader** announcements

## TypeScript Support

All components are fully typed with:
- Comprehensive prop interfaces
- Generic types where applicable
- Type-safe event handlers
- IntelliSense support

## Usage Guidelines

1. **Import from index files**: Always import from category index files
   ```tsx
   import { DataTable } from "@/components/tables";
   ```

2. **Use reusable components**: Never duplicate component implementations
   - Use DataTable instead of custom tables
   - Use FormGenerator instead of manual forms
   - Use Chart components instead of custom charts

3. **Follow design system**: Use consistent styling and spacing
   - Use Tailwind utility classes
   - Follow color scheme
   - Maintain responsive design

4. **Performance**: Use React.memo for expensive components
   - Already applied to all utility, layout, and feedback components
   - Apply to custom components when needed

## Examples

See individual component files for detailed usage examples and prop documentation.

## Contributing

When adding new components:
1. Follow existing patterns
2. Add TypeScript types
3. Include accessibility attributes
4. Use React.memo for performance
5. Add to appropriate index file
6. Update this README

