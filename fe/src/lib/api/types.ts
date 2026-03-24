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
  base_salary?: number;
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

export interface ProfileResponse {
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
  collector_name?: string | null;
  notes?: string;
  status: 'pending' | 'verified' | 'rejected';
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

export interface RevenueTrendItem {
  date: string;
  amount: number;
}

export interface RevenueByGroup {
  group_id: string;
  group_name: string;
  amount: number;
}

export interface RevenueByConn {
  connection_type: string;
  amount: number;
}

export interface RevenueAnalytics {
  trend: RevenueTrendItem[];
  by_group: RevenueByGroup[];
  by_connection_type: RevenueByConn[];
  period_total: number;
  previous_period_total: number;
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

export interface Settlement {
  collector_id: string;
  collector_name: string;
  date: string;
  amount: number;
  count: number;
  status: "pending" | "verified" | "rejected";
  first_payment_at: string;
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
  dns_name?: string;
  idle_timeout: number;
  interim_interval: number;
  created_at: string;
  updated_at: string;
}

export interface NetworkProfile {
  id: string;
  tenant_id: string;
  router_id?: string | null;
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
  dns_name?: string;
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
  dns_name?: string;
  remote_access_enabled?: boolean;
  idle_timeout?: number;
  interim_interval?: number;
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
  router_id?: string | null;
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
  router_id?: string | null;
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
  client_name?: string;
  is_reseller: boolean;
  reseller_radius: number;
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
  reseller_radius?: number;
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

// ========== Reimbursement Types ==========

// ========== Reimbursement Types ==========

export type ReimbursementStatus = "submitted" | "approved" | "rejected" | "paid";
export type ReimbursementCategory = "transport" | "meal" | "accommodation" | "equipment" | "other" | "medical" | "supplies";

export interface Reimbursement {
  id: string;
  tenant_id: string;
  user_id: string;
  user_name?: string;
  amount: number;
  category: ReimbursementCategory;
  description: string;
  date: string; // YYYY-MM-DD
  attachment_url?: string;
  status: ReimbursementStatus;
  rejection_reason?: string;
  approved_by?: string;
  approved_at?: string;
  paid_at?: string;
  pay_with_payroll: boolean;
  paid_with_payroll_id?: string;
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

// ========== Payroll Types ==========

export type PayrollStatus = "draft" | "processed" | "paid";
export type PayslipStatus = "pending" | "paid";
export type PayslipItemType = "allowance" | "deduction" | "reimbursement";

export interface PayrollRun {
  id: string;
  tenant_id: string;
  period: string;
  total_amount: number;
  status: PayrollStatus;
  created_at: string;
  updated_at: string;
  processed_at?: string;
  paid_at?: string;
  payslips?: Payslip[];
}

export interface Payslip {
  id: string;
  payroll_run_id: string;
  user_id: string;
  base_salary: number;
  total_allowances: number;
  total_deductions: number;
  total_reimbursements: number;
  net_salary: number;
  status: PayslipStatus;
  created_at: string;
  updated_at: string;
  paid_at?: string;
  user_name?: string;
  period?: string;
  items?: PayslipItem[];
}

export interface PayslipItem {
  id: string;
  payslip_id: string;
  description: string;
  type: PayslipItemType;
  amount: number;
  reference_id?: string;
}

export interface PayrollRunListResponse {
  data: PayrollRun[];
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

export interface ResourceUsage {
  resource_name: string;
  usage: number;
  limit: number;
}

export interface SuperAdminTenant {
  id: string;
  name: string;
  company_name?: string;
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
  owner_name?: string;
  owner_email?: string;
  owner_phone?: string;
  plan_code?: string;
  plan_name?: string;
  plan_price?: number;
  usage_stats?: ResourceUsage[];
  is_compliant?: boolean;
  routers?: Router[];
}

export interface Feature {
  id?: string;
  code: string;
  name: string;
  description?: string;
  category?: string;
  sort_order?: number;
  is_system?: boolean;
  is_enabled?: boolean;
  created_at?: string;
  updated_at?: string;
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
  hidden_features: string[];
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
  company_name?: string;
  slug?: string;
  domain?: string;
  status?: string;
}

export interface CreateTenantRequest {
  name: string;
  company_name?: string;
  slug: string;
  domain?: string;
  status?: "active" | "suspended" | "pending";
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
  hidden_features: string[];
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
  hidden_features: string[];
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


// ========== Reseller Types ==========

export type ResellerStatus = 'active' | 'suspended' | 'pending' | 'rejected';

export interface Reseller {
  id: string;
  tenant_id: string;
  client_id: string;
  // Included from join
  client_name?: string;
  client_phone?: string;
  client_email?: string;
  // Reseller specific
  status: ResellerStatus;
  join_date: string;
  notes?: string;
  balance: number;
  monthly_revenue?: number; // Calculated on FE or BE list response
  total_purchases?: number; // Calculated on FE or BE list response
  created_at: string;
  updated_at: string;
}

export interface ResellerPrice {
  id: string;
  tenant_id: string;
  reseller_id: string;
  voucher_package_id: string;
  voucher_package_name?: string; // Ideally returned by BE join
  reseller_price: number;
  retail_price: number;
  margin: number;
  created_at: string;
  updated_at: string;
}

export type ResellerDiscountType = 'fixed' | 'percentage';
export type ResellerDiscountStatus = 'active' | 'inactive';

export interface ResellerDiscount {
  id: string;
  tenant_id: string;
  code: string;
  rule_name: string;
  discount_type: ResellerDiscountType;
  discount_value: number;
  status: ResellerDiscountStatus;
  expires_at?: string;
  discount_id?: string; // Base discount ID
  created_at: string;
  updated_at: string;
}

export interface VoucherPackage {
  id: string;
  tenant_id: string;
  name: string;
  description?: string;
  download_speed: number;
  upload_speed: number;
  duration_hours?: number | null;
  validity?: string;
  quota_mb?: number | null;
  price: number;
  currency: string;
  rate_limit_mode: string;
  expiration_mode: 'wall_clock' | 'uptime_limit';
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export type ResellerPurchaseStatus = 'success' | 'pending' | 'failed' | 'paylater' | 'verifying';

export interface Voucher {
  id: string;
  tenant_id: string;
  package_id: string;
  router_id?: string | null;
  code: string;
  password?: string;
  status: string;
  isolated: boolean;
  used_at?: string | null;
  expires_at?: string | null;
  first_session_id?: string | null;
  notes?: string | null;
  package_name?: string | null;
  package_price?: number | null;
  router_name?: string | null;
  expiration_mode?: 'wall_clock' | 'uptime_limit';
  created_at: string;
  updated_at: string;
  total_uptime_seconds?: number;
  total_bytes_used?: number;
}

export interface ResellerPurchase {
  id: string;
  tenant_id: string;
  reseller_id: string;
  reseller_name?: string;
  voucher_package_id: string;
  voucher_package_name?: string;
  router_id?: string;
  quantity: number;
  unit_price: number;
  subtotal: number;
  discount_id?: string;
  discount_amount: number;
  promo_code?: string;
  total_amount: number;
  margin: number;
  payment_method: string;
  status: ResellerPurchaseStatus;
  notes?: string;
  created_at: string;
  updated_at: string;
  vouchers?: Voucher[];
}

export interface UpgradeClientRequest {
  client_id: string;
  notes?: string;
}

export interface SetResellerPriceRequest {
  voucher_package_id: string;
  reseller_price: number;
  retail_price: number;
}

export interface CreateResellerPromoRequest {
  code: string;
  rule_name: string;
  discount_type: ResellerDiscountType;
  discount_value: number;
  expires_at?: string; // YYYY-MM-DD
  discount_id?: string;
}

export interface ProcessResellerPurchaseRequest {
  voucher_package_id: string;
  router_id?: string;
  quantity: number;
  payment_method: string;
  promo_code?: string;
}

export interface ResellerListResponse {
  data: Reseller[];
  total: number;
  page: number;
}

export interface ResellerPurchaseListResponse {
  data: ResellerPurchase[];
  total: number;
  page: number;
}

export interface RevenueSummary {
  today_revenue: number;
  total_balance: number;
  voucher_revenue: number;
  reseller_revenue: number;
  billing_revenue: number;
}

export interface Transaction {
  id: string;
  tenant_id: string;
  type: 'income' | 'expense';
  source: 'voucher_usage' | 'reseller_purchase' | 'billing_payment';
  source_id: string;
  amount: number;
  currency: string;
  description: string;
  created_at: string;
}

// ========== Payment Method System Types ==========

export interface PaymentMethodAccount {
  id: string;
  tenant_id: string;
  name: string;
  category: "bank" | "cash" | "e-wallet" | "pay later";
  provider?: string;
  account_number?: string;
  account_name?: string;
  is_active: boolean;
  metadata?: any;
  created_at: string;
  updated_at: string;
}

export interface CreatePaymentMethodAccountRequest {
  name: string;
  category: "bank" | "cash" | "e-wallet" | "pay later";
  provider?: string;
  account_number?: string;
  account_name?: string;
}

export interface UpdatePaymentMethodAccountRequest {
  name?: string;
  category?: "bank" | "cash" | "e-wallet" | "pay later";
  provider?: string;
  account_number?: string;
  account_name?: string;
  is_active?: boolean;
}

// ========== Site Setting Types ==========

export interface LandingPageSEO {
  title: string;
  description: string;
  keywords: string[];
}

export interface LandingPagePricing {
  display_count: number;
  show_monthly: boolean;
  show_yearly: boolean;
  plans: string[];
  popular_plan_id: string;
  yearly_discount: number;
}

export interface SiteSetting {
  id: string;
  key: string;
  value: any;
  description: string;
  created_at: string;
  updated_at: string;
}
