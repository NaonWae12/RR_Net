export type Role = "super_admin" | "owner" | "admin" | "hr" | "finance" | "technician" | "collector" | "client";

export interface User {
  id: string;
  tenant_id?: string | null;
  email: string;
  name: string;
  phone?: string | null;
  avatar_url?: string | null;
  role: Role;
  capabilities?: string[];
}

export interface Tenant {
  id: string;
  name: string;
  slug: string;
  status: string;
  billing_status?: string;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface LoginResponse {
  access_token: string;
  refresh_token: string;
  expires_in: number;
  user: User;
  tenant?: Tenant;
}

// ========== Billing Types ==========

export type InvoiceStatus = "draft" | "pending" | "paid" | "overdue" | "cancelled";
export type PaymentMethod = "cash" | "bank_transfer" | "e_wallet" | "qris" | "virtual_account" | "collector";

// ========== Collector Types (FE-only) ==========
export type CollectorWorkflowStatus = "assigned" | "visit_success" | "visit_failed" | "deposited" | "confirmed";

export interface CollectorAssignment {
  invoice_id: string;
  invoice: Invoice;
  workflow_status: CollectorWorkflowStatus;
  assigned_at?: string;
  visit_notes?: string;
  visit_photo_url?: string;
  deposit_proof_url?: string;
  deposit_submitted_at?: string;
  confirmed_at?: string;
  // FE-only fields for state management
  _local_state?: {
    visit_notes?: string;
    visit_photo_file?: File;
    deposit_proof_file?: File;
  };
}

export interface TempoTemplate {
  id: string;
  tenant_id?: string;
  name: string;
  due_day: number; // 1-31
  description?: string | null;
  created_at?: string;
  updated_at?: string;
}

export interface InvoiceItem {
  id: string;
  invoice_id: string;
  description: string;
  quantity: number;
  unit_price: number;
  amount: number;
  created_at: string;
}

export interface Invoice {
  id: string;
  tenant_id: string;
  client_id: string;
  client_name?: string | null;
  client_phone?: string | null;
  client_address?: string | null;
  client_group_name?: string | null;
  invoice_number: string;
  period_start: string;
  period_end: string;
  due_date: string;
  subtotal: number;
  tax_amount: number;
  discount_amount: number;
  total_amount: number;
  paid_amount: number;
  currency: string;
  status: InvoiceStatus;
  notes?: string;
  items?: InvoiceItem[];
  created_at: string;
  updated_at: string;
  paid_at?: string | null;
}

export interface Payment {
  id: string;
  tenant_id: string;
  invoice_id: string;
  client_id: string;
  client_name?: string | null;
  amount: number;
  currency: string;
  method: PaymentMethod;
  reference?: string;
  collector_id?: string | null;
  notes?: string;
  received_at: string;
  created_at: string;
  created_by_user_id: string;
}

export interface BillingSummary {
  total_invoices: number;
  pending_invoices: number;
  overdue_invoices: number;
  paid_invoices: number;
  total_revenue: number;
  pending_amount: number;
  overdue_amount: number;
  collected_this_month: number;
}

export interface InvoiceListResponse {
  data: Invoice[];
  total: number;
  page: number;
}

export interface PaymentListResponse {
  data: Payment[];
  total: number;
  page: number;
}

export type PaymentMatrixCellStatus =
  | "paid_on_time"
  | "paid_late"
  | "pending"
  | "overdue"
  | "empty"
  | "cancelled";

export interface PaymentMonthStatus {
  month: number; // 1-12
  status: PaymentMatrixCellStatus;
  amount?: number;
}

export interface PaymentMatrixEntry {
  client_id: string;
  client_name: string;
  client_group_name?: string | null;
  package_name?: string | null;
  amount: number;
  months: PaymentMonthStatus[]; // backend returns 12 entries
}

export interface PaymentMatrixResponse {
  data: PaymentMatrixEntry[];
  year: number;
  available_years?: number[];
}

export interface CreateInvoiceRequest {
  client_id: string;
  period_start: string;
  period_end: string;
  due_date: string;
  items: InvoiceItemRequest[];
  tax_percent?: number;
  discount_amount?: number;
  notes?: string;
}

export interface InvoiceItemRequest {
  description: string;
  quantity: number;
  unit_price: number;
}

export interface RecordPaymentRequest {
  invoice_id: string;
  amount: number;
  method: PaymentMethod;
  reference?: string;
  collector_id?: string;
  notes?: string;
  received_at?: string;
}

// ========== Network Types ==========

export type RouterType = "mikrotik" | "cisco" | "ubiquiti" | "other";
export type RouterStatus = "online" | "offline" | "maintenance" | "provisioning";
export type RouterConnectivityMode = "direct_public" | "vpn";

export interface Router {
  id: string;
  tenant_id: string;
  name: string;
  description?: string;
  type: RouterType;
  host: string;
  nas_ip?: string;
  port: number;
  username: string;
  password?: string; // Never exposed in API
  api_port?: number;
  api_use_tls: boolean;
  connectivity_mode: RouterConnectivityMode;
  status: RouterStatus;
  last_seen?: string | null;
  is_default: boolean;
  radius_enabled: boolean;
  remote_access_enabled?: boolean;
  remote_access_port?: number;
  vpn_username?: string;
  vpn_password?: string;
  vpn_script?: string;
  created_at: string;
  updated_at: string;
}

export interface NetworkProfile {
  id: string;
  tenant_id: string;
  name: string;
  description?: string;
  download_speed: number; // in Kbps
  upload_speed: number; // in Kbps
  burst_download?: number;
  burst_upload?: number;
  priority: number;
  shared_users?: number;
  address_pool?: string;
  local_address?: string;
  remote_address?: string;
  dns_servers?: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface CreateRouterRequest {
  name: string;
  description?: string;
  type: RouterType;
  host: string;
  nas_ip?: string;
  port?: number;
  username: string;
  password: string;
  api_port?: number;
  api_use_tls?: boolean;
  connectivity_mode?: RouterConnectivityMode;
  is_default?: boolean;
  radius_enabled?: boolean;
  radius_secret?: string;
  auto_create_vpn?: boolean;
  enable_remote_access?: boolean;
}

export interface UpdateRouterRequest {
  name?: string;
  description?: string;
  type?: RouterType;
  host?: string;
  nas_ip?: string;
  port?: number;
  username?: string;
  password?: string;
  api_port?: number;
  api_use_tls?: boolean;
  connectivity_mode?: RouterConnectivityMode;
  is_default?: boolean;
  radius_enabled?: boolean;
  radius_secret?: string;
  remote_access_enabled?: boolean;
}

export interface ProvisionRouterRequest {
  name: string;
  connectivity_mode: RouterConnectivityMode;
}

export interface ProvisionResponse {
  router_id: string;
  vpn_username: string;
  vpn_password: string;
  vpn_ipsec_psk: string;
  vpn_script: string;
  remote_access_port: number;
  tunnel_ip: string;
  public_ip: string;
}

export interface CreateNetworkProfileRequest {
  name: string;
  description?: string;
  download_speed: number;
  upload_speed: number;
  burst_download?: number;
  burst_upload?: number;
  priority?: number;
  shared_users?: number;
  address_pool?: string;
  dns_servers?: string;
  is_active?: boolean;
}

export interface UpdateNetworkProfileRequest {
  name?: string;
  description?: string;
  download_speed?: number;
  upload_speed?: number;
  burst_download?: number;
  burst_upload?: number;
  priority?: number;
  shared_users?: number;
  address_pool?: string;
  dns_servers?: string;
  is_active?: boolean;
}

export interface RouterListResponse {
  data: Router[];
  total: number;
}

export interface NetworkProfileListResponse {
  data: NetworkProfile[];
  total: number;
}

// ========== Maps Types ==========

export type NodeType = "odc" | "odp" | "client";
export type NodeStatus = "ok" | "warning" | "full" | "outage";
export type ConnectionType = "pppoe" | "hotspot" | "static";

export interface ODC {
  id: string;
  tenant_id: string;
  name: string;
  latitude: number;
  longitude: number;
  capacity_info?: string;
  notes?: string;
  status: NodeStatus;
  created_at: string;
  updated_at: string;
}

export interface ODP {
  id: string;
  tenant_id: string;
  odc_id: string;
  name: string;
  latitude: number;
  longitude: number;
  port_count: number;
  used_ports: number;
  notes?: string;
  status: NodeStatus;
  created_at: string;
  updated_at: string;
}

export interface ClientLocation {
  id: string;
  tenant_id: string;
  client_id: string;
  odp_id: string;
  latitude: number;
  longitude: number;
  connection_type: ConnectionType;
  signal_info?: string;
  notes?: string;
  status: NodeStatus;
  created_at: string;
  updated_at: string;
}

export interface OutageEvent {
  id: string;
  tenant_id: string;
  node_type: NodeType;
  node_id: string;
  reason: string;
  reported_by: string;
  reported_at: string;
  resolved_at?: string | null;
  resolved_by?: string | null;
  is_resolved: boolean;
  affected_nodes?: string[];
  created_at: string;
  updated_at: string;
}

export interface TopologyLink {
  id: string;
  tenant_id: string;
  from_type: NodeType;
  from_id: string;
  to_type: NodeType;
  to_id: string;
  created_at: string;
}

export interface CreateODCRequest {
  name: string;
  latitude: number;
  longitude: number;
  capacity_info?: string;
  notes?: string;
}

export interface UpdateODCRequest {
  name?: string;
  latitude?: number;
  longitude?: number;
  capacity_info?: string;
  notes?: string;
}

export interface CreateODPRequest {
  odc_id: string;
  name: string;
  latitude: number;
  longitude: number;
  port_count?: number;
  notes?: string;
}

export interface UpdateODPRequest {
  name?: string;
  latitude?: number;
  longitude?: number;
  port_count?: number;
  notes?: string;
}

export interface CreateClientLocationRequest {
  client_id: string;
  odp_id: string;
  latitude: number;
  longitude: number;
  connection_type: ConnectionType;
  signal_info?: string;
  notes?: string;
}

export interface UpdateClientLocationRequest {
  odp_id?: string;
  latitude?: number;
  longitude?: number;
  connection_type?: ConnectionType;
  signal_info?: string;
  notes?: string;
}

export interface ReportOutageRequest {
  node_type: NodeType;
  node_id: string;
  reason: string;
}

export interface ResolveOutageRequest {
  outage_id: string;
}

export interface MapsListResponse<T> {
  data: T[];
  total: number;
}

export interface NearestODPResponse {
  odp_ids: string[];
}

// ========== Technician Types ==========

export type TaskStatus = "pending" | "pending_approval" | "in_progress" | "completed" | "cancelled";
export type TaskType = "installation" | "maintenance" | "repair" | "inspection" | "outage" | "other";
export type TaskPriority = "low" | "normal" | "high" | "critical";

export interface TechnicianTask {
  id: string;
  tenant_id: string;
  technician_id: string;
  assigned_by: string;
  task_type: TaskType;
  priority: TaskPriority;
  title: string;
  description: string;
  location_type?: string;
  location_id?: string;
  address?: string;
  latitude?: number;
  longitude?: number;
  status: TaskStatus;
  scheduled_at?: string;
  started_at?: string;
  completed_at?: string;
  estimated_hours?: number;
  actual_hours?: number;
  notes?: string;
  created_at: string;
  updated_at: string;
  // Approval fields (FE-only for now, backend will support later)
  approval_status?: "pending" | "approved" | "rejected";
  approval_feedback?: string; // Feedback if rejected
  approved_by?: string;
  approved_at?: string;
}

export interface ActivityLog {
  id: string;
  tenant_id: string;
  technician_id: string;
  task_id?: string;
  activity_type: string;
  description: string;
  location_type?: string;
  location_id?: string;
  latitude?: number;
  longitude?: number;
  photo_urls?: string[];
  metadata?: string;
  created_at: string;
}

export interface TaskSummary {
  total_tasks: number;
  pending_tasks: number;
  in_progress_tasks: number;
  completed_tasks: number;
  overdue_tasks: number;
}

export interface CreateTaskRequest {
  technician_id: string;
  task_type: TaskType;
  priority?: TaskPriority;
  title: string;
  description: string;
  location_type?: string;
  location_id?: string;
  address?: string;
  latitude?: number;
  longitude?: number;
  scheduled_at?: string;
  estimated_hours?: number;
  notes?: string;
}

export interface UpdateTaskRequest {
  task_type?: TaskType;
  priority?: TaskPriority;
  title?: string;
  description?: string;
  location_type?: string;
  location_id?: string;
  address?: string;
  latitude?: number;
  longitude?: number;
  scheduled_at?: string;
  estimated_hours?: number;
  notes?: string;
}

export interface CompleteTaskRequest {
  actual_hours?: number;
  notes?: string;
}

export interface LogActivityRequest {
  task_id?: string;
  activity_type: string;
  description: string;
  location_type?: string;
  location_id?: string;
  latitude?: number;
  longitude?: number;
  photo_urls?: string[];
  metadata?: Record<string, any>;
}

export interface TaskListResponse {
  data: TechnicianTask[];
  total: number;
}

export interface ActivityLogListResponse {
  data: ActivityLog[];
  total: number;
}

// ========== Attendance Types ==========

export type AttendanceStatus = "checked_in" | "checked_out" | "absent" | "on_leave";

export interface Attendance {
  id: string;
  tenant_id: string;
  user_id: string;
  date: string; // YYYY-MM-DD
  check_in_time?: string;
  check_out_time?: string;
  status: AttendanceStatus;
  note?: string;
  location_latitude?: number;
  location_longitude?: number;
  total_hours?: number;
  created_at: string;
  updated_at: string;
}

export interface CheckInRequest {
  note?: string;
  location_latitude?: number;
  location_longitude?: number;
}

export interface CheckOutRequest {
  note?: string;
  location_latitude?: number;
  location_longitude?: number;
}

export interface AttendanceListResponse {
  data: Attendance[];
  total: number;
}

// ========== Payslip Types ==========

export type PayslipStatus = "generated" | "paid";

export interface Payslip {
  id: string;
  tenant_id: string;
  user_id: string;
  period: string; // YYYY-MM format
  gross_salary: number;
  deductions: number;
  allowances: number;
  net_salary: number;
  status: PayslipStatus;
  paid_at?: string;
  pdf_url?: string;
  breakdown?: PayslipBreakdown;
  created_at: string;
  updated_at: string;
}

export interface PayslipBreakdown {
  basic_salary?: number;
  overtime?: number;
  bonuses?: number;
  allowances?: PayslipAllowance[];
  tax?: number;
  insurance?: number;
  other_deductions?: PayslipDeduction[];
}

export interface PayslipAllowance {
  name: string;
  amount: number;
}

export interface PayslipDeduction {
  name: string;
  amount: number;
}

export interface PayslipListResponse {
  data: Payslip[];
  total: number;
}

// ========== Reimbursement Types ==========

export type ReimbursementStatus = "submitted" | "approved" | "rejected";
export type ReimbursementCategory = "transport" | "meal" | "accommodation" | "equipment" | "other";

export interface Reimbursement {
  id: string;
  tenant_id: string;
  user_id: string;
  amount: number;
  category: ReimbursementCategory;
  description: string;
  date: string; // YYYY-MM-DD
  attachment_url?: string;
  status: ReimbursementStatus;
  rejection_reason?: string;
  approved_by?: string;
  approved_at?: string;
  created_at: string;
  updated_at: string;
}

export interface CreateReimbursementRequest {
  amount: number;
  category: ReimbursementCategory;
  description: string;
  date: string; // YYYY-MM-DD
  attachment?: File; // Will be handled separately for upload
}

export interface ReimbursementListResponse {
  data: Reimbursement[];
  total: number;
}

// ========== Time Off Types ==========

export type TimeOffType = "leave" | "sick" | "emergency";
export type TimeOffStatus = "pending_approval" | "approved" | "rejected";

export interface TimeOff {
  id: string;
  tenant_id: string;
  user_id: string;
  type: TimeOffType;
  start_date: string; // YYYY-MM-DD
  end_date: string; // YYYY-MM-DD
  reason: string;
  attachment_url?: string;
  status: TimeOffStatus;
  rejection_reason?: string;
  approved_by?: string;
  approved_at?: string;
  days_count: number;
  created_at: string;
  updated_at: string;
}

export interface CreateTimeOffRequest {
  type: TimeOffType;
  start_date: string; // YYYY-MM-DD
  end_date: string; // YYYY-MM-DD
  reason: string;
  attachment?: File; // Will be handled separately for upload
}

export interface TimeOffListResponse {
  data: TimeOff[];
  total: number;
}

// ========== Location Submission Types ==========

export type LocationType = "client" | "odc" | "odp";
export type LocationSubmissionStatus = "pending_admin_review" | "approved" | "rejected";

export interface LocationSubmission {
  id: string;
  tenant_id: string;
  user_id: string;
  location_type: LocationType;
  latitude: number;
  longitude: number;
  note?: string;
  photo_url?: string;
  status: LocationSubmissionStatus;
  rejection_reason?: string;
  approved_by?: string;
  approved_at?: string;
  created_at: string;
  updated_at: string;
}

export interface CreateLocationSubmissionRequest {
  location_type: LocationType;
  latitude: number;
  longitude: number;
  note?: string;
  photo?: File;
}

export interface LocationSubmissionListResponse {
  data: LocationSubmission[];
  total: number;
}

// ========== Client Submission Types ==========

export type ClientSubmissionStatus = "pending_admin_approval" | "approved" | "rejected";

export interface ClientSubmission {
  id: string;
  tenant_id: string;
  user_id: string;
  name: string;
  email?: string;
  phone?: string;
  address?: string;
  category?: string;
  service_package_id?: string;
  latitude?: number;
  longitude?: number;
  photo_url?: string;
  status: ClientSubmissionStatus;
  rejection_reason?: string;
  approved_by?: string;
  approved_at?: string;
  created_at: string;
  updated_at: string;
}

export interface CreateClientSubmissionRequest {
  name: string;
  email?: string;
  phone?: string;
  address?: string;
  category?: string;
  service_package_id?: string;
  latitude?: number;
  longitude?: number;
  photo?: File;
}

export interface ClientSubmissionListResponse {
  data: ClientSubmission[];
  total: number;
}

// ========== Super Admin Types ==========

export interface SuperAdminTenant {
  id: string;
  name: string;
  slug: string;
  domain?: string;
  status: "active" | "suspended" | "pending" | "deleted";
  plan_id?: string;
  billing_status: "active" | "overdue" | "suspended";
  trial_ends_at?: string;
  settings: Record<string, any>;
  created_at: string;
  updated_at: string;
  deleted_at?: string;
}

export interface Feature {
  code: string;
  name: string;
  description?: string;
  category?: string;
}

export interface Plan {
  id: string;
  code: string;
  name: string;
  description?: string;
  price_monthly: number;
  price_yearly?: number;
  currency: string;
  limits: Record<string, number>;
  features: string[];
  is_active: boolean;
  is_public: boolean;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export interface Addon {
  id: string;
  code: string;
  name: string;
  description?: string;
  price: number;
  billing_cycle: "one_time" | "monthly" | "yearly";
  currency: string;
  addon_type: "limit_boost" | "feature";
  value: Record<string, any>;
  is_active: boolean;
  available_for_plans: string[];
  created_at: string;
  updated_at: string;
}

export interface UpdateTenantRequest {
  name?: string;
  slug?: string;
  domain?: string;
  status?: string;
}

export interface CreatePlanRequest {
  code: string;
  name: string;
  description?: string;
  price_monthly: number;
  price_yearly?: number;
  currency?: string;
  limits: Record<string, number>;
  features: string[];
  is_active: boolean;
  is_public: boolean;
  sort_order: number;
}

export interface UpdatePlanRequest {
  name: string;
  description?: string;
  price_monthly: number;
  price_yearly?: number;
  currency?: string;
  limits: Record<string, number>;
  features: string[];
  is_active: boolean;
  is_public: boolean;
  sort_order: number;
}

export interface CreateAddonRequest {
  code: string;
  name: string;
  description?: string;
  price: number;
  billing_cycle: "one_time" | "monthly" | "yearly";
  currency?: string;
  addon_type: "limit_boost" | "feature";
  value: Record<string, any>;
  is_active: boolean;
  available_for_plans: string[];
}

export interface UpdateAddonRequest {
  name: string;
  description?: string;
  price: number;
  billing_cycle: "one_time" | "monthly" | "yearly";
  currency?: string;
  addon_type: "limit_boost" | "feature";
  value: Record<string, any>;
  is_active: boolean;
  available_for_plans: string[];
}

export interface TenantListResponse {
  data: SuperAdminTenant[];
  total: number;
}

export interface PlanListResponse {
  data: Plan[];
  total: number;
}

export interface AddonListResponse {
  data: Addon[];
  total: number;
}

