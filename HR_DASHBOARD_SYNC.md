# HR Dashboard - API Synchronization

## Summary
Successfully synchronized the HR Dashboard page (`/hr/dashboard`) with real backend APIs while maintaining the existing UI layout and design.

## Changes Made

### 1. **HRDashboardTab Component** ✅
   - **File**: `fe/src/components/hr/HRDashboardTab.tsx`
   - **Changes**:
     - ❌ Removed mock data (`mockSummary`, `mockRecentLeaveRequests`)
     - ✅ Added real API integration with `hrService`
     - ✅ Added `useEffect` to fetch data on mount
     - ✅ Added `fetchDashboardData()` function
     - ✅ Added loading state (full-screen spinner)
     - ✅ Added dynamic alerts based on real data
     - ✅ Updated field mappings for TimeOff data
     - ✅ Added helper functions: `getTypeLabel()`, `getStatusBadge()`

## Data Sources

### Summary Cards
| Card | Data Source | Status |
|------|-------------|--------|
| Total Employees | TODO: Employees API | ⏳ Placeholder (0) |
| Attendance Today | TODO: Attendance API | ⏳ Placeholder (0) |
| **Pending Leave** | `hrService.getTimeOffs("pending_approval")` | ✅ Real data |
| Payroll Pending | TODO: Payroll API | ⏳ Placeholder (0) |
| **Pending Reimbursements** | `hrService.getReimbursements("pending_approval")` | ✅ Real data |

### Recent Leave Requests Table
- **Source**: `hrService.getTimeOffs()` - all time offs, limited to 5 most recent
- **Fields**:
  - Employee: `user_name`
  - Type: `type` (mapped via `getTypeLabel()`)
  - Date: `start_date` - `end_date` (parsed with `parseISO()`)
  - Status: `status` (rendered via `getStatusBadge()`)

### Alerts Section
- **Dynamic alerts** based on real data:
  - Shows count of pending leave requests
  - Shows count of pending reimbursements
  - Only displays if there are pending items

## Features Implemented

### Data Loading
- ✅ Fetch data on component mount
- ✅ Full-screen loading spinner during initial load
- ✅ Error handling (console.error)
- ✅ Graceful fallback to empty state

### Summary Cards
- ✅ **Pending Leave Requests**: Real count from API
- ✅ **Pending Reimbursements**: Real count from API
- ⏳ Total Employees: Placeholder (TODO)
- ⏳ Attendance Today: Placeholder (TODO)
- ⏳ Payroll Pending: Placeholder (TODO)

### Alerts
- ✅ Dynamic alerts based on pending items
- ✅ Proper pluralization ("1 request" vs "2 requests")
- ✅ Only shows if there are alerts
- ✅ Clean, informative messages

### Recent Leave Requests
- ✅ Displays last 5 time off requests
- ✅ Employee name from joined user data
- ✅ Type label (human-readable)
- ✅ Date range formatted as "MMM d - MMM d, yyyy"
- ✅ Status badge with proper colors
- ✅ Empty state when no requests
- ✅ Click "View All" to navigate to full list

### Quick Actions
- ✅ Navigate to Manage Employees
- ✅ Navigate to Review Leave Requests
- ✅ Navigate to Process Payroll
- ✅ Navigate to Review Reimbursements

## UI Layout - Preserved ✅
- ✅ Same grid layout (4 columns for summary cards)
- ✅ Same card styling and icons
- ✅ Same alert box styling
- ✅ Same quick actions layout
- ✅ Same table structure for recent requests
- ✅ Same colors and spacing
- ✅ Same hover effects

## API Calls

### On Component Mount
```typescript
// Fetch pending leave requests
const pendingLeaves = await hrService.getTimeOffs("pending_approval");

// Fetch all leave requests
const allLeaves = await hrService.getTimeOffs();

// Fetch pending reimbursements
const pendingReimbursements = await hrService.getReimbursements("pending_approval");
```

### Summary Calculation
```typescript
setSummary({
  totalEmployees: 0, // TODO
  activeEmployees: 0, // TODO
  pendingLeaveRequests: pendingLeaves.length, // ✅ Real
  attendanceToday: 0, // TODO
  payrollPending: 0, // TODO
  pendingReimbursements: pendingReimbursements.length, // ✅ Real
});
```

### Recent Requests
```typescript
// Get last 5 leave requests
const recent = allLeaves.slice(0, 5);
setRecentLeaveRequests(recent);
```

### Alerts Generation
```typescript
const newAlerts = [];
if (pendingLeaves.length > 0) {
  newAlerts.push({
    type: "info",
    message: `${pendingLeaves.length} leave request${pendingLeaves.length > 1 ? "s" : ""} pending approval`,
  });
}
if (pendingReimbursements.length > 0) {
  newAlerts.push({
    type: "info",
    message: `${pendingReimbursements.length} reimbursement${pendingReimbursements.length > 1 ? "s" : ""} pending approval`,
  });
}
setAlerts(newAlerts);
```

## Type Mapping

| Backend Code | UI Label |
|--------------|----------|
| `sick` | Sick Leave |
| `leave` | Annual Leave |
| `emergency` | Emergency Leave |

## Status Badges

| Status | Color | Label |
|--------|-------|-------|
| `pending_approval` | Yellow | Pending |
| `approved` | Green | Approved |
| `rejected` | Red | Rejected |

## Loading States

### Initial Load
- Full-screen centered spinner (48px)
- Displays while fetching all dashboard data
- Replaces entire dashboard content

### No Loading State for Recent Requests
- Recent requests section shows immediately after data loads
- No separate loading state for the table

## TODO Items

The following features are placeholders and need to be implemented when the corresponding APIs are available:

1. **Total Employees**
   - Need: `GET /hr/employees` API
   - Should return: Total count and active count

2. **Attendance Today**
   - Need: `GET /hr/attendance/today` API
   - Should return: Count of employees who checked in today

3. **Payroll Pending**
   - Need: `GET /hr/payroll/pending` API
   - Should return: Count of pending payroll runs for current month

## Testing Checklist

- [ ] Dashboard loads without errors
- [ ] Loading spinner shows during initial load
- [ ] Pending leave requests count is accurate
- [ ] Pending reimbursements count is accurate
- [ ] Alerts show when there are pending items
- [ ] Alerts hide when there are no pending items
- [ ] Recent leave requests display correctly (max 5)
- [ ] Employee names display correctly
- [ ] Type labels display correctly (Sick Leave, Annual Leave, Emergency Leave)
- [ ] Date ranges format correctly
- [ ] Status badges show correct colors
- [ ] "View All" button navigates to `/hr/leave-requests`
- [ ] Quick action buttons navigate correctly
- [ ] Empty state shows when no recent requests
- [ ] Placeholder cards show 0 for TODO items

## Benefits

### Real-Time Data
- ✅ Dashboard now shows actual pending leave requests
- ✅ Dashboard now shows actual pending reimbursements
- ✅ Alerts are dynamic and accurate

### Better UX
- ✅ Loading state prevents showing stale data
- ✅ Alerts provide actionable information
- ✅ Recent requests give quick overview

### Maintainability
- ✅ No more mock data to maintain
- ✅ Single source of truth (API)
- ✅ Easy to add more data sources (TODO items)

## Next Steps

1. **Implement Employees API**
   - Create endpoint to get employee counts
   - Update dashboard to fetch and display

2. **Implement Attendance API**
   - Create endpoint to get today's attendance
   - Update dashboard to fetch and display

3. **Implement Payroll API**
   - Create endpoint to get pending payroll count
   - Update dashboard to fetch and display

4. **Add Refresh Button**
   - Allow manual refresh of dashboard data
   - Show loading state during refresh

5. **Add Auto-Refresh**
   - Refresh data every X minutes
   - Show last updated timestamp

## Status
✅ HR Dashboard successfully synchronized with Time Off and Reimbursement APIs!
⏳ Employees, Attendance, and Payroll APIs pending implementation.
