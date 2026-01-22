# 🎯 RENCANA IMPLEMENTASI: TECHNICIAN + COLLECTOR FE ALIGNMENT

**Status:** Planning Phase (FE-only, Backend out of scope)  
**Asumsi:** Semua Technician = Collector (sementara)  
**Fokus:** UX, UI behavior, FE flow, submission-based approval mindset

---

## 📋 DAFTAR ISI

1. [Core Principles](#1-core-principles)
2. [Task Management (Revisi)](#2-task-management-revisi)
3. [Attendance](#3-attendance)
4. [Payslip](#4-payslip)
5. [Reimbursement](#5-reimbursement)
6. [Time Off](#6-time-off)
7. [Maps (Read-only + Contribution)](#7-maps-read-only--contribution)
8. [Collector Capabilities (Embedded)](#8-collector-capabilities-embedded)
9. [Create Client (Submission-based)](#9-create-client-submission-based)
10. [Shared Features Menu](#10-shared-features-menu)
11. [Implementation Checklist](#11-implementation-checklist)

---

## 1. CORE PRINCIPLES

### 1.1 Philosophy
- **Technician fokus eksekusi lapangan, bukan administrasi**
- **Semua aksi yang berdampak data utama harus melalui approval admin**
- **FE hanya menyiapkan submission flow + status visibility**
- **Mobile-first UX** (technician bekerja di lapangan)

### 1.2 Approval Flow Pattern
```
Technician Action → Submit → Status: pending_approval → Admin Review → Approved/Rejected
```

### 1.3 Status Visibility
Semua submission harus menampilkan:
- ✅ **Pending Approval** (waiting for admin)
- ✅ **Approved** (active/visible)
- ❌ **Rejected** (with feedback message)

---

## 2. TASK MANAGEMENT (REVISI)

### 2.1 Current State
- ✅ Task list sudah ada
- ✅ Technician bisa start/complete task
- ✅ Admin bisa create/edit/delete task
- ❌ Technician TIDAK bisa create task (sudah di-block)

### 2.2 Required Changes

#### A. Allow Technician to Create Task (Submission-based)

**File:** `fe/src/app/(tenant)/technician/tasks/create/page.tsx`

**Changes:**
1. Remove RoleGuard restriction untuk technician
2. Update `TaskForm` untuk technician:
   - Auto-set `technician_id` = current user
   - Add warning banner: "Task will be reviewed by admin before activation"
   - Status default: `pending_approval` (FE-only, backend belum support)

**File:** `fe/src/components/technician/TaskForm.tsx`

**Changes:**
1. Add `isTechnician` prop
2. If `isTechnician`:
   - Hide `technician_id` field (auto-filled)
   - Show info banner: "This task requires admin approval"
   - Disable `technician_id` selection

**File:** `fe/src/lib/api/types.ts`

**Changes:**
```typescript
// Extend TaskStatus
export type TaskStatus = 
  | "pending" 
  | "pending_approval"  // NEW: Technician-created, waiting for admin
  | "in_progress" 
  | "completed" 
  | "cancelled";

// Add to TechnicianTask interface
export interface TechnicianTask {
  // ... existing fields
  approval_status?: "pending" | "approved" | "rejected";  // NEW
  approval_feedback?: string;  // NEW (if rejected)
  approved_by?: string;  // NEW
  approved_at?: string;  // NEW
}
```

**File:** `fe/src/app/(tenant)/technician/tasks/page.tsx`

**Changes:**
1. Allow technician to see "Create Task" button
2. Filter tasks:
   - Technician: Show only `approved` tasks + own `pending_approval` tasks
   - Admin: Show all tasks
3. Add status filter: "Pending Approval" (untuk technician melihat submission mereka)

**File:** `fe/src/components/technician/TaskCard.tsx`

**Changes:**
1. Show approval status badge:
   - `pending_approval` → Yellow badge "Waiting for Approval"
   - `approved` → Green badge "Approved"
   - `rejected` → Red badge "Rejected" + feedback
2. Disable Start/Complete buttons jika status = `pending_approval`

#### B. Task Actions Restriction

**Technician CANNOT:**
- ❌ Approve task (tidak ada UI untuk ini)
- ❌ Assign task ke orang lain (technician_id auto-filled)
- ❌ Edit task setelah submit (jika pending_approval)

**Technician CAN:**
- ✅ Create task (submission)
- ✅ Start task (hanya jika approved)
- ✅ Complete task (hanya jika approved)
- ✅ View own pending_approval tasks

---

## 3. ATTENDANCE

### 3.1 New Feature: Attendance Module

**Route:** `/technician/attendance`

**Files to Create:**
- `fe/src/app/(tenant)/technician/attendance/page.tsx`
- `fe/src/components/technician/AttendanceCheckIn.tsx`
- `fe/src/components/technician/AttendanceCalendar.tsx`
- `fe/src/stores/attendanceStore.ts` (optional, bisa pakai technicianStore)

**Features:**
1. **Check-in / Check-out:**
   - Button besar: "Check In" / "Check Out"
   - Timestamp otomatis
   - Optional note (textarea)
   - Location (auto-detect atau manual input)

2. **Today's Status:**
   - Card menampilkan:
     - Status: Present / Absent / Leave
     - Check-in time
     - Check-out time (jika sudah)
     - Total hours (jika sudah check-out)

3. **Calendar View:**
   - Monthly calendar
   - Color coding:
     - Green: Present (full day)
     - Yellow: Present (partial - belum check-out)
     - Red: Absent
     - Blue: Leave
   - Click date → show detail

**UI/UX:**
- Mobile-first: Large touch targets
- One-hand usable
- Minimal text input
- Auto-save location (optional)

**Status:**
- `checked_in` → Waiting for check-out
- `checked_out` → Complete
- `absent` → No check-in today
- `on_leave` → Time-off approved

---

## 4. PAYSLIP

### 4.1 New Feature: Payslip View

**Route:** `/technician/payslip`

**Files to Create:**
- `fe/src/app/(tenant)/technician/payslip/page.tsx`
- `fe/src/components/technician/PayslipCard.tsx`
- `fe/src/components/technician/PayslipDetail.tsx`

**Features:**
1. **List Payslips:**
   - Group by periode (bulan/tahun)
   - Card per payslip:
     - Periode (e.g., "January 2024")
     - Status: Generated / Paid
     - Net amount
     - Download button

2. **Payslip Detail:**
   - Breakdown:
     - Gross salary
     - Deductions
     - Allowances
     - Net salary
   - Download PDF button
   - Print-friendly view

**UI/UX:**
- View-only (no edit)
- Download/print actions
- Mobile-friendly table

**Status:**
- `generated` → Payslip ready
- `paid` → Payment confirmed

---

## 5. REIMBURSEMENT

### 5.1 New Feature: Reimbursement Submission

**Route:** `/technician/reimbursement`

**Files to Create:**
- `fe/src/app/(tenant)/technician/reimbursement/page.tsx`
- `fe/src/components/technician/ReimbursementForm.tsx`
- `fe/src/components/technician/ReimbursementCard.tsx`

**Features:**
1. **Submit Reimbursement:**
   - Form fields:
     - Amount (number, required)
     - Category (dropdown: transport, meal, accommodation, equipment, other)
     - Description (textarea, required)
     - Attachment (file upload, optional, max 5MB)
     - Date (date picker, default: today)
   - Submit button → Status: `submitted`

2. **Reimbursement List:**
   - Filter: All / Pending / Approved / Rejected
   - Card per request:
     - Amount
     - Category
     - Date
     - Status badge
     - Attachment preview (jika ada)
   - Click → Detail view

3. **Status Visibility:**
   - `submitted` → Yellow "Pending Approval"
   - `approved` → Green "Approved"
   - `rejected` → Red "Rejected" + feedback message
   - Technician TIDAK bisa edit setelah submit

**UI/UX:**
- Mobile-first form
- File upload dengan preview
- Status-driven UX
- Clear feedback untuk rejected

---

## 6. TIME OFF

### 6.1 New Feature: Time Off Request

**Route:** `/technician/time-off`

**Files to Create:**
- `fe/src/app/(tenant)/technician/time-off/page.tsx`
- `fe/src/components/technician/TimeOffForm.tsx`
- `fe/src/components/technician/TimeOffCalendar.tsx`

**Features:**
1. **Submit Time Off:**
   - Form fields:
     - Type: Leave / Sick / Emergency
     - Start date (date picker)
     - End date (date picker)
     - Reason (textarea, required)
     - Attachment (optional: medical certificate, etc.)
   - Submit → Status: `pending_approval`

2. **Time Off List:**
   - Filter: All / Pending / Approved / Rejected
   - Card per request:
     - Type badge
     - Date range
     - Days count
     - Status badge
     - Reason preview

3. **Calendar Integration:**
   - Show approved time-off di attendance calendar
   - Auto-mark as "on_leave" di attendance

**Status:**
- `pending_approval` → Yellow "Waiting for Approval"
- `approved` → Green "Approved" (reflect di attendance)
- `rejected` → Red "Rejected" + feedback

**UI/UX:**
- Date range picker (mobile-friendly)
- Calendar view untuk visualisasi
- Status-driven UX

---

## 7. MAPS (READ-ONLY + CONTRIBUTION)

### 7.1 Current State
- ✅ Maps page sudah ada
- ✅ Technician bisa view maps (read-only)
- ❌ Technician TIDAK bisa create ODC/ODP nodes

### 7.2 Required Changes

**File:** `fe/src/app/(tenant)/maps/page.tsx`

**Changes:**
1. Add "Submit Location" button untuk technician
2. Modal/Form untuk submit koordinat:
   - Location type: Client / ODC / ODP
   - Latitude / Longitude (auto-detect atau manual)
   - Note (optional)
   - Photo (optional)
   - Submit → Status: `pending_admin_review`

**File:** `fe/src/components/maps/NetworkMap.tsx`

**Changes:**
1. Show pending submissions (different marker style)
2. Click pending marker → Show "Pending Review" info
3. Technician tidak bisa edit existing nodes

**New Component:** `fe/src/components/maps/SubmitLocationModal.tsx`

**Features:**
- Location type selector
- GPS auto-detect (optional)
- Manual coordinate input
- Photo upload
- Note field
- Submit button → `pending_admin_review`

**Status:**
- `pending_admin_review` → Yellow marker, "Pending Review"
- `approved` → Green marker, visible di map
- `rejected` → Red marker, "Rejected" + feedback

**UI/UX:**
- Mobile-friendly modal
- GPS integration (browser geolocation API)
- Photo capture (camera access)
- One-hand usable

---

## 8. COLLECTOR CAPABILITIES (EMBEDDED)

### 8.1 Client List (Assigned Only)

**File:** `fe/src/app/(tenant)/clients/page.tsx`

**Changes:**
1. If `isTechnician`:
   - Filter: Only assigned clients (collector assignment)
   - Hide "Create Client" button (akan ada di submission flow)
   - Add "My Assigned Clients" label

2. Client search:
   - Global search (read-only)
   - Untuk kebutuhan lapangan
   - Show: Name, Address, Phone, Status

### 8.2 Client Detail (Full Detail if Collector)

**File:** `fe/src/app/(tenant)/clients/[id]/page.tsx`

**Changes:**
1. If `isTechnician`:
   - Show full detail (karena technician = collector)
   - Hide edit/delete buttons
   - Show "Collect Payment" button (jika ada unpaid invoice)

### 8.3 Billing (Collect Action Only)

**File:** `fe/src/app/(tenant)/billing/page.tsx`

**Changes:**
1. Technician sudah di-block oleh RoleGuard (OK)
2. Jika nanti perlu collector-specific billing:
   - Route: `/technician/billing/collect`
   - Show assigned clients dengan unpaid invoices
   - "Mark as Collected" action
   - Amount input
   - Reference number

---

## 9. CREATE CLIENT (SUBMISSION-BASED)

### 9.1 New Feature: Client Submission

**Route:** `/technician/clients/submit` (atau `/technician/clients/create`)

**Files to Create:**
- `fe/src/app/(tenant)/technician/clients/submit/page.tsx`
- `fe/src/components/technician/ClientSubmissionForm.tsx`

**Features:**
1. **Submit Client:**
   - Form fields (sama seperti admin create client):
     - Name, Email, Phone, Address
     - Category, Service package
     - Location (lat/lng)
     - Photo (optional)
   - Submit → Status: `pending_admin_approval`

2. **Submission List:**
   - Route: `/technician/clients/submissions`
   - List semua client submissions:
     - Status: Pending / Approved / Rejected
     - Client name
     - Submitted date
     - Feedback (jika rejected)

3. **Admin Toggle (Future):**
   - Admin bisa enable/disable: `allow_technician_create_client`
   - Jika disabled, hide "Submit Client" button

**Status:**
- `pending_admin_approval` → Yellow "Waiting for Approval"
- `approved` → Green "Approved" (client aktif)
- `rejected` → Red "Rejected" + feedback

**UI/UX:**
- Mobile-friendly form
- GPS integration untuk location
- Photo upload
- Status visibility

---

## 10. SHARED FEATURES MENU

### 10.1 Sidebar Update

**File:** `fe/src/components/layout/Sidebar.tsx`

**Changes:**
1. Add menu items untuk technician:
   ```typescript
   {
     label: 'Attendance',
     href: '/technician/attendance',
     allowedRoles: ['owner', 'admin', 'technician'],
   },
   {
     label: 'Payslip',
     href: '/technician/payslip',
     allowedRoles: ['owner', 'admin', 'technician'],
   },
   {
     label: 'Reimbursement',
     href: '/technician/reimbursement',
     allowedRoles: ['owner', 'admin', 'technician'],
   },
   {
     label: 'Time Off',
     href: '/technician/time-off',
     allowedRoles: ['owner', 'admin', 'technician'],
   },
   ```

### 10.2 Bottom Navbar Update

**File:** `fe/src/components/layout/BottomNav.tsx`

**Changes:**
1. Add items:
   ```typescript
   const technicianNavItems = [
     { label: "Tasks", href: "/technician/tasks" },
     { label: "Activities", href: "/technician/activities" },
     { label: "Attendance", href: "/technician/attendance" },  // NEW
     { label: "Dashboard", href: "/dashboard" },
   ];
   ```

---

## 11. IMPLEMENTATION CHECKLIST

### Phase 1: Task Management Revision
- [ ] Update `TaskStatus` type (add `pending_approval`)
- [ ] Update `TechnicianTask` interface (add approval fields)
- [ ] Modify `TaskForm` untuk technician (auto-fill, warning banner)
- [ ] Update `technician/tasks/create/page.tsx` (allow technician)
- [ ] Update `technician/tasks/page.tsx` (filter pending_approval)
- [ ] Update `TaskCard` (show approval status badge)
- [ ] Update `TaskStatusBadge` (support pending_approval)

### Phase 2: Attendance Module
- [ ] Create `technician/attendance/page.tsx`
- [ ] Create `AttendanceCheckIn.tsx` component
- [ ] Create `AttendanceCalendar.tsx` component
- [ ] Add attendance API types
- [ ] Add attendance store (atau extend technicianStore)
- [ ] Add sidebar menu item
- [ ] Add bottom nav item

### Phase 3: Payslip Module
- [ ] Create `technician/payslip/page.tsx`
- [ ] Create `PayslipCard.tsx` component
- [ ] Create `PayslipDetail.tsx` component
- [ ] Add payslip API types
- [ ] Add sidebar menu item

### Phase 4: Reimbursement Module
- [ ] Create `technician/reimbursement/page.tsx`
- [ ] Create `ReimbursementForm.tsx` component
- [ ] Create `ReimbursementCard.tsx` component
- [ ] Add reimbursement API types
- [ ] Add file upload handling
- [ ] Add sidebar menu item

### Phase 5: Time Off Module
- [ ] Create `technician/time-off/page.tsx`
- [ ] Create `TimeOffForm.tsx` component
- [ ] Create `TimeOffCalendar.tsx` component
- [ ] Add time-off API types
- [ ] Integrate dengan attendance calendar
- [ ] Add sidebar menu item

### Phase 6: Maps Contribution
- [ ] Create `SubmitLocationModal.tsx` component
- [ ] Update `maps/page.tsx` (add submit button)
- [ ] Update `NetworkMap.tsx` (show pending submissions)
- [ ] Add GPS integration
- [ ] Add photo upload

### Phase 7: Client Submission
- [ ] Create `technician/clients/submit/page.tsx`
- [ ] Create `technician/clients/submissions/page.tsx`
- [ ] Create `ClientSubmissionForm.tsx` component
- [ ] Update `clients/page.tsx` (filter assigned untuk technician)
- [ ] Add client submission API types

### Phase 8: Collector Capabilities
- [ ] Update `clients/page.tsx` (assigned filter)
- [ ] Update `clients/[id]/page.tsx` (full detail untuk technician)
- [ ] Create `technician/billing/collect/page.tsx` (jika diperlukan)

### Phase 9: UI/UX Polish
- [ ] Mobile-first responsive design
- [ ] Large touch targets
- [ ] One-hand usable modals
- [ ] Status badges konsisten
- [ ] Loading states
- [ ] Error handling
- [ ] Toast notifications

---

## 📝 NOTES

### Backend Assumptions (Out of Scope)
- Backend akan support `pending_approval` status
- Backend akan support approval workflow
- Backend akan support submission endpoints
- Backend akan support file uploads

### FE-Only Implementation
- Status `pending_approval` bisa FE-only dulu (simulasi)
- Approval flow bisa mock dulu (admin approve via existing UI)
- File upload bisa prepare UI dulu (backend integration later)

### Mobile-First Priority
- Semua form harus mobile-friendly
- Large touch targets (min 44x44px)
- Minimal text input
- GPS integration untuk location
- Camera access untuk photo

---

## ✅ DEFINITION OF DONE

- [ ] Technician bisa create task (submission-based)
- [ ] Technician bisa view attendance, payslip, reimbursement, time-off
- [ ] Technician bisa submit location untuk maps
- [ ] Technician bisa submit client creation
- [ ] Semua submission menampilkan status (pending/approved/rejected)
- [ ] Mobile-first UX untuk semua fitur
- [ ] Status-driven UX konsisten
- [ ] Tidak ada breaking changes untuk admin workflow

---

**Last Updated:** 2024-12-19  
**Status:** Planning Phase


