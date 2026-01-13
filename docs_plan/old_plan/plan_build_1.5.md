plan build_1.5
hr_module_force_spec_v1:
  meta:
    module: "hr_module"
    version: "1.0-forced"
    notes:
      - "Force-applied based on user revisions: no shift management, GPS future only, rename Employee role -> HR, separate Technician role."
      - "Scope includes employee CRUD, attendance, leave, payroll, and technician activity log."

  scope:
    included:
      - employee_management
      - attendance (manual only for v1)
      - leave_requests
      - payroll
      - technician_activity
    excluded_for_v1:
      - gps_attendance (future version)
      - shift_management
      - overtime_engine (advanced future)
      - task_assignment_engine (future)

  employee_management:
    summary: "CRUD employees for tenant with roles HR, Technician, Admin."
    model:
      table: "employees"
      fields:
        - id: uuid
        - tenant_id: uuid
        - name: string
        - phone: string
        - role: ["HR","Technician","Finance","Admin (optional)"]
        - address: text
        - salary_base: numeric
        - status: ["active", "inactive"]
        - joined_at: timestamp
        - photo_url: string (optional)
        - created_at
        - updated_at
    role_rules:
      - "Employee is NOT a system user by default (optional create user credential)."
      - "Technician role has special integration with maps module."
      - "HR role manages attendance & payroll."
    ui_pages:
      - employee_list
      - employee_create
      - employee_edit
      - employee_profile

  attendance:
    summary: "Simple attendance system; manual check-in/out; GPS future placeholder."
    modes_supported:
      manual:
        flow:
          - employee or HR/admin inputs check-in time
          - check-out recorded later
          - daily record stored in attendance table
      gps_future:
        enabled: false
        note: "GPS check-in will be enabled in future version; reserved fields included."
    model:
      table: "attendance_records"
      fields:
        - id
        - tenant_id
        - employee_id
        - check_in: timestamp
        - check_out: timestamp
        - method: ["manual","gps_future"]
        - notes
        - created_at
    constraints:
      - "One check-in per employee per day (unless admin override)."
      - "If no check-out by midnight → auto-assign system check_out = check_in + 8h (fallback)."
    ui_pages:
      - attendance_dashboard
      - attendance_input
      - attendance_records_list

  leave_requests:
    summary: "Employee requests leave; HR/Admin approves or declines."
    model:
      table: "leave_requests"
      fields:
        - id
        - tenant_id
        - employee_id
        - type: ["sick","leave","permit","other"]
        - date_from
        - date_to
        - reason
        - status: ["pending","approved","declined"]
        - reviewed_by (HR/Admin)
        - created_at
        - updated_at
    flow:
      - employee submits request
      - HR/Admin reviews
      - status updated + notification optional
    ui_pages:
      - leave_request_list
      - leave_request_detail
      - leave_request_approval

  payroll:
    summary: "Lightweight payroll system; simple formula and payslip generation."
    model:
      table: "payroll_records"
      fields:
        - id
        - tenant_id
        - employee_id
        - month
        - base_salary
        - additional: jsonb {bonus,overtime,allowances}
        - deductions: jsonb {punishments,late_deductions}
        - final_salary
        - generated_at
        - approved_by
    formula:
      default:
        final_salary = base_salary + sum(additional) - sum(deductions)
    payslip:
      format: "PDF generation via backend worker"
      fields:
        - employee_name
        - salary_base
        - breakdowns
        - final_salary
        - period
    ui_pages:
      - payroll_list
      - payroll_generate
      - payroll_detail

  technician_activity:
    summary: "Technician logs field activities; integrated with Maps (ODP/ODC/Client)."
    model:
      table: "technician_activity"
      fields:
        - id
        - tenant_id
        - technician_id
        - related_node_type: ["ODC","ODP","Client"]
        - related_node_id
        - description
        - photo_url (optional)
        - timestamp
    flow:
      - technician inputs activity via mobile-friendly UI
      - optional photo upload (MinIO/S3)
      - activity appears in maps node detail page
    ui_pages:
      - technician_activity_list
      - technician_activity_create
      - technician_activity_map_link

  integration_points:
    maps_integration:
      - "Technician activity lists shown in node detail (ODC/ODP/Client)."
      - "Future: technician check-in can sync with GPS location."
    billing_integration:
      - "Payroll cost not directly billed → only tenant internal."
    notification_integration:
      - "Optional WA notification when leave approved (configurable per tenant)."

  acceptance_criteria_hr_module:
    - "Employees can be created, edited, and deactivated."
    - "Attendance records can be logged manually."
    - "Leave requests workflow works (pending → approved/declined)."
    - "Payroll records are generated with correct formula."
    - "Technician activity logs appear on maps module nodes."
    - "GPS attendance disabled but model supports future expansion."

  next_step_instruction:
    - "Step 5 (HR Module) complete. Please REVIEW YAML."
    - "Jika sudah oke → balas: 'lanjut step 6' untuk masuk ke Maps Module."
