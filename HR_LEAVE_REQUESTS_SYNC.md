# HR Leave Requests Page - API Synchronization

## Summary
Successfully synchronized the HR Leave Requests page (`/hr/leave-requests`) with the backend Time Off API while maintaining the existing UI layout and design.

## Changes Made

### 1. **Backend API Methods** ✅
   - **File**: `fe/src/lib/api/hrService.ts`
   - **Added Methods**:
     ```typescript
     getTimeOffs(status?: string): Promise<TimeOff[]>
     getTimeOff(id: string): Promise<TimeOff>
     approveTimeOff(id: string): Promise<TimeOff>
     rejectTimeOff(id: string, reason: string): Promise<TimeOff>
     ```
   - **Endpoints**:
     - `GET /hr/time-offs` - List all time off requests with optional status filter
     - `GET /hr/time-offs/{id}` - Get specific time off request
     - `POST /hr/time-offs/{id}/approve` - Approve request
     - `POST /hr/time-offs/{id}/reject` - Reject request with reason

### 2. **LeaveRequestsTab Component** ✅
   - **File**: `fe/src/components/hr/LeaveRequestsTab.tsx`
   - **Changes**:
     - ❌ Removed mock data (`mockLeaveRequests`)
     - ✅ Added real API integration with `hrService`
     - ✅ Added `useEffect` to fetch data on mount and filter change
     - ✅ Added `fetchTimeOffs()` function for data loading
     - ✅ Updated status mapping: `"pending"` → `"pending_approval"`
     - ✅ Added `getTypeLabel()` helper to map type codes to labels
     - ✅ Added rejection reason prompt
     - ✅ Added "Days" column to show `days_count`
     - ✅ Updated field mappings:
       - `employeeName` → `user_name`
       - `dateFrom/dateTo` → `start_date/end_date` (with `parseISO`)
       - `submittedAt` → `created_at`
       - `reviewedAt` → `approved_at`

### 3. **UI Layout Preserved** ✅
   - ✅ Same table structure and styling
   - ✅ Same filter dropdown
   - ✅ Same status badges (green/yellow/red)
   - ✅ Same action buttons (Approve/Reject)
   - ✅ Same loading states
   - ✅ Same empty state message
   - ✅ Same hover effects and spacing

## Field Mapping

| UI Label | Backend Field | Type | Notes |
|----------|---------------|------|-------|
| Employee | `user_name` | string | From JOIN with users table |
| Type | `type` | enum | Mapped via `getTypeLabel()` |
| Date Range | `start_date`, `end_date` | ISO string | Parsed with `parseISO()` |
| Days | `days_count` | number | Calculated by backend |
| Reason | `reason` | string | Truncated with CSS |
| Status | `status` | enum | `pending_approval`, `approved`, `rejected` |
| Submitted | `created_at` | ISO string | Parsed with `parseISO()` |
| Actions | - | - | Conditional based on status |

## Type Mapping

| Backend Code | UI Label |
|--------------|----------|
| `sick` | Sick Leave |
| `leave` | Annual Leave |
| `emergency` | Emergency Leave |

## Status Mapping

| Backend Status | UI Badge | Color |
|----------------|----------|-------|
| `pending_approval` | Pending | Yellow |
| `approved` | Approved | Green |
| `rejected` | Rejected | Red |

## Features Implemented

### Data Loading
- ✅ Fetch time offs on component mount
- ✅ Fetch time offs when status filter changes
- ✅ Loading spinner during fetch
- ✅ Error handling with toast notifications
- ✅ Empty state when no data

### Filtering
- ✅ Filter by status: All, Pending, Approved, Rejected
- ✅ Real-time filter updates

### Actions
- ✅ **Approve**: One-click approval for pending requests
- ✅ **Reject**: Prompts for rejection reason before submitting
- ✅ Loading states on buttons during API calls
- ✅ Success/error toast notifications
- ✅ Auto-refresh after approve/reject

### Display
- ✅ Employee name from joined user data
- ✅ Type label (human-readable)
- ✅ Date range formatted as "MMM d - MMM d, yyyy"
- ✅ Days count with proper pluralization
- ✅ Reason text (truncated if too long)
- ✅ Status badge with icon
- ✅ Submitted date
- ✅ Approved date (for non-pending requests)

## User Experience

### Approval Flow
1. HR clicks "Approve" button
2. Button shows loading spinner
3. API call to `/hr/time-offs/{id}/approve`
4. Success toast notification
5. Table auto-refreshes
6. Status changes to "Approved"

### Rejection Flow
1. HR clicks "Reject" button
2. Prompt appears asking for rejection reason
3. If user cancels, nothing happens
4. If user provides reason:
   - Button shows loading spinner
   - API call to `/hr/time-offs/{id}/reject` with reason
   - Success toast notification
   - Table auto-refreshes
   - Status changes to "Rejected"

## Testing Checklist

- [ ] Page loads without errors
- [ ] Time off requests display correctly
- [ ] Status filter works (All, Pending, Approved, Rejected)
- [ ] Employee names display correctly
- [ ] Type labels display correctly (Sick Leave, Annual Leave, Emergency Leave)
- [ ] Date ranges format correctly
- [ ] Days count displays correctly
- [ ] Approve button works for pending requests
- [ ] Reject button prompts for reason
- [ ] Rejection with reason works
- [ ] Rejection can be cancelled
- [ ] Loading states show during API calls
- [ ] Success toasts appear after actions
- [ ] Error toasts appear on failures
- [ ] Table refreshes after approve/reject
- [ ] No approve/reject buttons for non-pending requests
- [ ] Approved date shows for approved/rejected requests

## API Endpoints Used

```
GET    /hr/time-offs              - List all time off requests
GET    /hr/time-offs/{id}         - Get specific request
POST   /hr/time-offs/{id}/approve - Approve request
POST   /hr/time-offs/{id}/reject  - Reject request (body: { reason })
```

## Notes

- ✅ UI layout completely preserved - no visual changes
- ✅ All existing styling maintained
- ✅ Table structure unchanged
- ✅ Filter dropdown unchanged
- ✅ Action buttons unchanged
- ✅ Only backend integration changed from mock to real API
- ✅ Added "Days" column for better UX
- ✅ Rejection reason is now required (via prompt)

## Status
✅ HR Leave Requests page successfully synchronized with backend Time Off API!
