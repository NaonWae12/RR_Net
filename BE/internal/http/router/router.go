package router

import (
	"context"
	"encoding/json"
	"net/http"
	"strings"
	"time"

	"github.com/rs/zerolog/log"

	"github.com/go-redis/redis/v8"
	"github.com/google/uuid"
	"github.com/hibiken/asynq"
	"github.com/jackc/pgx/v5/pgxpool"

	"rrnet/internal/auth"
	"rrnet/internal/config"
	"rrnet/internal/health"
	"rrnet/internal/http/handler"
	"rrnet/internal/http/middleware"
	asynqInfra "rrnet/internal/infra/asynq"
	wagw "rrnet/internal/infra/wa_gateway"
	"rrnet/internal/metrics"
	"rrnet/internal/rbac"
	"rrnet/internal/repository"
	"rrnet/internal/service"
	"rrnet/internal/version"
	"rrnet/pkg/utils"
)

// Dependencies holds all dependencies required by the router
type Dependencies struct {
	Config    *config.Config
	DB        *pgxpool.Pool
	Redis     *redis.Client
	Asynq     *asynq.Client
	WAGateway *wagw.Client
}

// New creates the HTTP router with all routes and middlewares.
// Middleware order (outermost to innermost):
// 1. RecoverPanic - Catch panics and prevent crashes
// 2. RequestID    - Inject unique request ID for tracing
// 3. RequestLogger - Log all requests with timing
// 4. TenantContext - Extract tenant from subdomain (for tenant routes)
// 5. Auth         - Verify JWT token (for protected routes)
// 6. RBAC         - Check capabilities (for protected routes)
func New(deps Dependencies) http.Handler {
	mux := http.NewServeMux()

	// ============================================
	// Initialize repositories and services
	// ============================================
	userRepo := repository.NewUserRepository(deps.DB)
	tenantRepo := repository.NewTenantRepository(deps.DB)
	planRepo := repository.NewPlanRepository(deps.DB)
	addonRepo := repository.NewAddonRepository(deps.DB)
	featureRepo := repository.NewFeatureRepository(deps.DB)
	affiliateRepo := repository.NewAffiliateRepository(deps.DB)

	jwtManager := auth.NewJWTManager(
		deps.Config.Auth.JWTSecret,
		deps.Config.Auth.AccessTokenTTL,
		deps.Config.Auth.RefreshTokenTTL,
	)
	oauthManager := auth.NewOAuthManager()

	clientRepo := repository.NewClientRepository(deps.DB)
	servicePackageRepo := repository.NewServicePackageRepository(deps.DB)
	clientGroupRepo := repository.NewClientGroupRepository(deps.DB)
	discountRepo := repository.NewDiscountRepository(deps.DB)
	routerRepo := repository.NewRouterRepository(deps.DB)
	profileRepo := repository.NewNetworkProfileRepository(deps.DB)
	pppoeRepo := repository.NewPPPoERepository(deps.DB)
	platformBillingRepo := repository.NewPlatformBillingRepository(deps.DB)
	invoiceRepo := repository.NewInvoiceRepository(deps.DB)
	paymentRepo := repository.NewPaymentRepository(deps.DB)
	siteSettingRepo := repository.NewSiteSettingRepository(deps.DB)
	platformDiscountRepo := repository.NewPlatformDiscountRepository(deps.DB)

	// Asynq client (optional injection; fallback to creating one)
	asynqClient := deps.Asynq
	if asynqClient == nil {
		asynqClient = asynqInfra.NewClient(deps.Config.Redis.Addr, deps.Config.Redis.Password, deps.Config.Redis.DB)
	}

	// Services
	authService := service.NewAuthService(userRepo, tenantRepo, jwtManager, oauthManager, deps.Redis, deps.WAGateway)
	platformBillingService := service.NewPlatformBillingService(platformBillingRepo, tenantRepo, planRepo, platformDiscountRepo)
	platformDiscountService := service.NewPlatformDiscountService(platformDiscountRepo)

	// Affiliate management
	affiliateService := service.NewAffiliateService(userRepo, affiliateRepo, siteSettingRepo)
	platformBillingService.SetAffiliateService(affiliateService)

	tenantService := service.NewTenantService(tenantRepo, userRepo, planRepo, jwtManager, deps.Redis, deps.WAGateway, platformBillingService, affiliateService)
	planService := service.NewPlanService(planRepo, tenantRepo)
	addonService := service.NewAddonService(addonRepo, planRepo, tenantRepo)
	featureResolver := service.NewFeatureResolver(planRepo, addonRepo, featureRepo)
	limitResolver := service.NewLimitResolver(planRepo, addonRepo)

	// RADIUS + Voucher (Hotspot)
	voucherRepo := repository.NewVoucherRepository(deps.DB)
	radiusRepo := repository.NewRadiusRepository(deps.DB)
	syncRepo := repository.NewRouterSyncRepository(deps.DB)
	financeRepo := repository.NewFinanceRepository(deps.DB)

	// Services
	financeService := service.NewFinanceService(financeRepo)
	voucherService := service.NewVoucherService(voucherRepo, radiusRepo, routerRepo, financeService, limitResolver)
	billingService := service.NewBillingService(invoiceRepo, paymentRepo, clientRepo, servicePackageRepo, discountRepo)

	pppoeService := service.NewPPPoEService(pppoeRepo, routerRepo, profileRepo, clientRepo, deps.Config.Auth.JWTSecret)
	clientService := service.NewClientService(clientRepo, servicePackageRepo, pppoeService, voucherService, billingService, featureResolver, limitResolver, userRepo, routerRepo, discountRepo, deps.Config.Auth.JWTSecret)
	servicePackageService := service.NewServicePackageService(servicePackageRepo)
	serviceSettingsService := service.NewServiceSettingsService(tenantRepo)
	clientGroupService := service.NewClientGroupService(clientGroupRepo)
	discountService := service.NewDiscountService(discountRepo)

	// Reseller management
	resellerRepo := repository.NewResellerRepository(deps.DB)
	resellerService := service.NewResellerService(resellerRepo, clientRepo, discountRepo, voucherService, financeService)

	// WhatsApp campaigns (async)
	waCampaignRepo := repository.NewWACampaignRepository(deps.DB)
	waCampaignService := service.NewWACampaignService(waCampaignRepo, clientRepo, asynqClient)
	waTemplateRepo := repository.NewWATemplateRepository(deps.DB)
	waTemplateService := service.NewWATemplateService(waTemplateRepo)
	waLogRepo := repository.NewWALogRepository(deps.DB)
	waLogService := service.NewWALogService(waLogRepo)

	// Handlers
	authHandler := handler.NewAuthHandler(authService, oauthManager)
	tenantHandler := handler.NewTenantHandler(tenantService)
	planHandler := handler.NewPlanHandler(planService, featureResolver, limitResolver, platformBillingService)
	addonHandler := handler.NewAddonHandler(addonService)
	clientHandler := handler.NewClientHandler(clientService)
	featureHandler := handler.NewFeatureHandler(featureRepo)
	networkService := service.NewNetworkService(routerRepo, profileRepo, limitResolver, deps.Redis)
	superAdminHandler := handler.NewSuperAdminHandler(tenantRepo, planRepo, addonRepo, planService, addonService, tenantService, userRepo, deps.WAGateway, networkService)
	employeeHandler := handler.NewEmployeeHandler(authService, userRepo)
	servicePackageHandler := handler.NewServicePackageHandler(servicePackageService)
	serviceSettingsHandler := handler.NewServiceSettingsHandler(serviceSettingsService)
	clientGroupHandler := handler.NewClientGroupHandler(clientGroupService)
	discountHandler := handler.NewDiscountHandler(discountService)
	resellerHandler := handler.NewResellerHandler(resellerService)
	waCampaignHandler := handler.NewWACampaignHandler(waCampaignService)
	waTemplateHandler := handler.NewWATemplateHandler(waTemplateService)
	waLogHandler := handler.NewWALogHandler(waLogRepo)
	dashboardHandler := handler.NewDashboardHandler(clientService, planService, featureResolver, limitResolver, routerRepo, voucherRepo)
	affiliateHandler := handler.NewAffiliateHandler(affiliateService)
	financeHandler := handler.NewFinanceHandler(financeService)
	siteSettingService := service.NewSiteSettingService(siteSettingRepo)
	siteSettingHandler := handler.NewSiteSettingHandler(siteSettingService)

	platformBillingHandler := handler.NewPlatformBillingHandler(platformBillingService)

	platformDiscountHandler := handler.NewPlatformDiscountHandler(platformDiscountService)

	// AI & Migration
	aiService := service.NewAIService(tenantRepo, siteSettingRepo, deps.Config.Auth.JWTSecret)
	migrationService := service.NewMigrationService(aiService, clientRepo, pppoeRepo, servicePackageRepo, voucherRepo, clientService)
	aiHandler := handler.NewAIHandler(aiService)
	migrationHandler := handler.NewMigrationHandler(migrationService)

	// WhatsApp Gateway (Baileys) proxy client + handler (tenant-scoped; protected)
	waGatewayClient := wagw.NewClient(deps.Config.WAGateway.URL, deps.Config.WAGateway.AdminToken)
	waGatewayHandler := handler.NewWAGatewayHandler(waGatewayClient, waLogService)

	// Technician module (repositories, service, handler)
	taskRepo := repository.NewTaskRepository(deps.DB)
	activityLogRepo := repository.NewActivityLogRepository(deps.DB)
	technicianService := service.NewTechnicianService(taskRepo, activityLogRepo)
	technicianHandler := handler.NewTechnicianHandler(technicianService)

	// HR module (repositories, service, handler)
	reimbursementRepo := repository.NewReimbursementRepository(deps.DB)
	timeOffRepo := repository.NewTimeOffRepository(deps.DB)
	hrService := service.NewHRService(reimbursementRepo, timeOffRepo, userRepo)
	hrHandler := handler.NewHRHandler(hrService)

	// Attendance module
	attendanceRepo := repository.NewAttendanceRepository(deps.DB)
	attendanceService := service.NewAttendanceService(attendanceRepo)
	attendanceHandler := handler.NewAttendanceHandler(attendanceService)

	// Payroll module
	payrollRepo := repository.NewPayrollRepository(deps.DB)
	payrollService := service.NewPayrollService(payrollRepo, userRepo, reimbursementRepo)
	payrollHandler := handler.NewPayrollHandler(payrollService)

	// Payment Method module
	paymentMethodRepo := repository.NewPaymentMethodRepository(deps.DB)
	paymentMethodService := service.NewPaymentMethodService(paymentMethodRepo)
	paymentMethodHandler := handler.NewPaymentMethodHandler(paymentMethodService)

	// Inventory module
	inventoryRepo := repository.NewInventoryRepository(deps.DB)
	inventoryService := service.NewInventoryService(inventoryRepo)
	inventoryHandler := handler.NewInventoryHandler(inventoryService)

	// Expense module
	expenseRepo := repository.NewExpenseRepository(deps.DB)
	expenseService := service.NewExpenseService(expenseRepo)
	expenseHandler := handler.NewExpenseHandler(expenseService)

	// RBAC service
	rbacService := rbac.NewService()

	// Middleware
	requireAuth := middleware.AuthMiddleware(jwtManager)
	requireSuperAdmin := middleware.SuperAdminMiddleware(jwtManager)

	// RBAC middleware helpers
	requireCapability := func(cap rbac.Capability) func(http.Handler) http.Handler {
		return middleware.RequireCapability(rbacService, cap)
	}
	requireAnyCapability := func(caps ...rbac.Capability) func(http.Handler) http.Handler {
		return middleware.RequireAnyCapability(rbacService, caps...)
	}
	_ = middleware.RequireTenantAdmin()

	// Feature-gate helpers (plan/addon/toggle gating; independent from RBAC)
	requireMapsFeature := middleware.RequireAnyFeature(featureResolver, "odp_maps", "client_maps")
	requireServicePackagesFeature := middleware.RequireFeature(featureResolver, "service_packages")
	requireWAGatewayFeature := middleware.RequireFeature(featureResolver, "wa_gateway")

	// Initialize Prometheus metrics
	metrics.Init()

	// ============================================
	// Public routes (no auth required)
	// ============================================
	mux.HandleFunc("/health", method("GET", handleHealth(deps)))
	mux.HandleFunc("/version", method("GET", handleVersion))
	mux.HandleFunc("/metrics", method("GET", handleMetrics))

	// ============================================
	// API v1 routes
	// NOTE: More specific routes must be registered BEFORE /api/v1/
	// because http.ServeMux uses longest prefix matching
	// ============================================

	// OAuth routes (public - registered before generic auth/login)
	log.Info().Msg("Registering Google OAuth routes")
	mux.HandleFunc("/api/v1/auth/google/login", func(w http.ResponseWriter, r *http.Request) {
		log.Info().Msg("Google Login endpoint hit")
		r = setPathParam(r, "provider", "google")
		authHandler.OAuthRedirect(w, r)
	})
	mux.HandleFunc("/api/v1/auth/google/callback", func(w http.ResponseWriter, r *http.Request) {
		log.Info().Msg("Google Callback endpoint hit")
		r = setPathParam(r, "provider", "google")
		authHandler.OAuthCallback(w, r)
	})

	// Auth routes (public)
	mux.HandleFunc("/api/v1/auth/login", method("POST", authHandler.Login))
	mux.HandleFunc("/api/v1/auth/register", method("POST", authHandler.Register))
	mux.HandleFunc("/api/v1/auth/refresh", method("POST", authHandler.RefreshToken))
	mux.HandleFunc("/api/v1/auth/logout", method("POST", authHandler.Logout))
	mux.HandleFunc("/api/v1/auth/forgot-password", method("POST", authHandler.ForgotPassword))
	mux.HandleFunc("/api/v1/auth/reset-password", method("POST", authHandler.ResetPassword))

	// Tenant registration (public)
	mux.HandleFunc("/api/v1/tenants/register", method("POST", tenantHandler.RegisterTenant))
	mux.HandleFunc("/api/v1/tenants/verify-otp", method("POST", tenantHandler.VerifyOTP))
	mux.HandleFunc("/api/v1/tenants/resend-otp", method("POST", tenantHandler.ResendOTP))
	mux.Handle("/api/v1/tenants/update-plan", requireAuth(methodHandler("PATCH", tenantHandler.UpdateRegistrationPlan)))

	// Affiliate registration (public)
	mux.HandleFunc("/api/v1/affiliate/register", method("POST", affiliateHandler.Register))
	mux.Handle("/api/v1/affiliate/settings", requireAuth(methodHandler("GET", affiliateHandler.GetSettings)))

	// Validation routes (public - for checking email/phone availability)
	validationHandler := handler.NewValidationHandler(userRepo, tenantRepo)
	mux.HandleFunc("/api/v1/validation/email", method("GET", validationHandler.CheckEmailAvailable))
	mux.HandleFunc("/api/v1/validation/phone", method("GET", validationHandler.CheckPhoneAvailable))
	mux.HandleFunc("/api/v1/validation/slug", method("GET", validationHandler.CheckSlugAvailable))

	// Public payment methods route (for registration/waiting approval pages)
	mux.HandleFunc("/api/v1/public/payment-methods", method("GET", paymentMethodHandler.ListActivePaymentMethods))
	mux.HandleFunc("/api/v1/public/payment-methods/", method("GET", paymentMethodHandler.ListActivePaymentMethods))

	// Feature catalog route (CRITICAL: Moved to support CRUD)
	mux.Handle("/api/v1/features", http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		switch r.Method {
		case http.MethodGet:
			featureHandler.List(w, r)
		case http.MethodPost:
			requireSuperAdmin(http.HandlerFunc(featureHandler.Create)).ServeHTTP(w, r)
		default:
			w.WriteHeader(http.StatusMethodNotAllowed)
		}
	}))

	mux.Handle("/api/v1/features/", http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		path := strings.TrimPrefix(r.URL.Path, "/api/v1/features/")
		if path == "" {
			w.WriteHeader(http.StatusBadRequest)
			return
		}
		r = setPathParam(r, "id", strings.TrimSuffix(path, "/"))

		switch r.Method {
		case http.MethodPut, http.MethodPatch:
			requireSuperAdmin(http.HandlerFunc(featureHandler.Update)).ServeHTTP(w, r)
		case http.MethodDelete:
			requireSuperAdmin(http.HandlerFunc(featureHandler.Delete)).ServeHTTP(w, r)
		default:
			w.WriteHeader(http.StatusMethodNotAllowed)
		}
	}))

	// Discount validation (public - for registration)
	mux.HandleFunc("/api/v1/public/validate-discount", method("POST", platformDiscountHandler.Validate))
	mux.HandleFunc("/api/v1/public/apply-discount", method("POST", platformBillingHandler.ApplyDiscount))
	mux.HandleFunc("/api/v1/public/remove-discount", method("POST", platformBillingHandler.RemoveDiscount))

	// Protected routes
	mux.Handle("/api/v1/auth/me", requireAuth(methodHandler("GET", authHandler.Me)))
	mux.Handle("/api/v1/affiliate/dashboard", requireAuth(methodHandler("GET", affiliateHandler.GetDashboard)))
	mux.Handle("/api/v1/affiliate/withdrawals", requireAuth(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		switch r.Method {
		case http.MethodGet:
			affiliateHandler.GetWithdrawals(w, r)
		case http.MethodPost:
			affiliateHandler.CreateWithdrawal(w, r)
		default:
			w.WriteHeader(http.StatusMethodNotAllowed)
		}
	})))
	mux.Handle("/api/v1/affiliate/profile/metadata", requireAuth(methodHandler("PATCH", affiliateHandler.UpdateMetadata)))

	// AI Settings
	// Tenants can only GET (check if configured)
	mux.Handle("/api/v1/ai/config", requireAuth(methodHandler("GET", aiHandler.GetConfig)))

	// Super Admin - Affiliate Management
	mux.Handle("/api/v1/superadmin/affiliates", requireSuperAdmin(methodHandler("GET", affiliateHandler.ListAll)))
	mux.Handle("/api/v1/superadmin/affiliates/stats", requireSuperAdmin(methodHandler("GET", affiliateHandler.GetGlobalStats)))
	mux.Handle("/api/v1/superadmin/affiliates/settings", requireSuperAdmin(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		switch r.Method {
		case http.MethodGet:
			affiliateHandler.GetSettings(w, r)
		case http.MethodPatch:
			affiliateHandler.UpdateSettings(w, r)
		default:
			w.WriteHeader(http.StatusMethodNotAllowed)
		}
	})))

	mux.Handle("/api/v1/superadmin/affiliates/campaigns", requireSuperAdmin(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		switch r.Method {
		case http.MethodGet:
			affiliateHandler.ListCampaigns(w, r)
		case http.MethodPost:
			affiliateHandler.CreateCampaign(w, r)
		default:
			w.WriteHeader(http.StatusMethodNotAllowed)
		}
	})))

	mux.Handle("/api/v1/superadmin/affiliates/campaigns/", requireSuperAdmin(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		path := strings.TrimPrefix(r.URL.Path, "/api/v1/superadmin/affiliates/campaigns/")
		if path == "" {
			w.WriteHeader(http.StatusBadRequest)
			return
		}
		idStr := strings.TrimSuffix(path, "/")
		r = setPathParam(r, "id", idStr)

		switch r.Method {
		case http.MethodGet:
			affiliateHandler.GetCampaign(w, r)
		case http.MethodPatch, http.MethodPut:
			affiliateHandler.UpdateCampaign(w, r)
		default:
			w.WriteHeader(http.StatusMethodNotAllowed)
		}
	})))

	mux.Handle("/api/v1/superadmin/affiliates/", requireSuperAdmin(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		path := strings.TrimPrefix(r.URL.Path, "/api/v1/superadmin/affiliates/")
		if path == "" {
			w.WriteHeader(http.StatusBadRequest)
			return
		}

		if strings.HasSuffix(path, "/status") {
			idStr := strings.TrimSuffix(path, "/status")
			idStr = strings.TrimSuffix(idStr, "/")
			r = setPathParam(r, "id", idStr)
			if r.Method == http.MethodPatch {
				affiliateHandler.UpdateStatus(w, r)
				return
			}
		}

		idStr := strings.TrimSuffix(path, "/")
		r = setPathParam(r, "id", idStr)
		if r.Method == http.MethodGet {
			affiliateHandler.GetDetail(w, r)
			return
		}

		w.WriteHeader(http.StatusMethodNotAllowed)
	})))

	// Super Admin can manage global AI
	mux.Handle("/api/v1/superadmin/ai/config", requireSuperAdmin(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		switch r.Method {
		case http.MethodGet:
			aiHandler.GetConfig(w, r)
		case http.MethodPost:
			aiHandler.SaveConfig(w, r)
		default:
			w.WriteHeader(http.StatusMethodNotAllowed)
		}
	})))

	// Migration Tool
	mux.Handle("/api/v1/migration/extract-image", requireAuth(methodHandler("POST", migrationHandler.ExtractFromImage)))
	mux.Handle("/api/v1/migration/process", requireAuth(methodHandler("POST", migrationHandler.ProcessImport)))
	mux.Handle("/api/v1/auth/change-password", requireAuth(methodHandler("POST", authHandler.ChangePassword)))

	// Tenant info route (protected)
	mux.Handle("/api/v1/tenant/me", requireAuth(methodHandler("GET", handleTenantMe(tenantRepo))))

	// ============================================
	// WhatsApp Gateway proxy routes (Protected, tenant-scoped)
	// ============================================
	mux.Handle("/api/v1/wa-gateway/connect", requireAuth(requireWAGatewayFeature(requireCapability(rbac.CapWAView)(methodHandler("POST", waGatewayHandler.Connect)))))
	mux.Handle("/api/v1/wa-gateway/connect/", requireAuth(requireWAGatewayFeature(requireCapability(rbac.CapWAView)(methodHandler("POST", waGatewayHandler.Connect)))))
	mux.Handle("/api/v1/wa-gateway/status", requireAuth(requireWAGatewayFeature(requireCapability(rbac.CapWAView)(methodHandler("GET", waGatewayHandler.Status)))))
	mux.Handle("/api/v1/wa-gateway/status/", requireAuth(requireWAGatewayFeature(requireCapability(rbac.CapWAView)(methodHandler("GET", waGatewayHandler.Status)))))
	mux.Handle("/api/v1/wa-gateway/qr", requireAuth(requireWAGatewayFeature(requireCapability(rbac.CapWAView)(methodHandler("GET", waGatewayHandler.QR)))))
	mux.Handle("/api/v1/wa-gateway/qr/", requireAuth(requireWAGatewayFeature(requireCapability(rbac.CapWAView)(methodHandler("GET", waGatewayHandler.QR)))))
	mux.Handle("/api/v1/wa-gateway/send", requireAuth(requireWAGatewayFeature(requireCapability(rbac.CapWAView)(methodHandler("POST", waGatewayHandler.Send)))))
	mux.Handle("/api/v1/wa-gateway/send/", requireAuth(requireWAGatewayFeature(requireCapability(rbac.CapWAView)(methodHandler("POST", waGatewayHandler.Send)))))

	// ============================================
	// WhatsApp Campaigns (Protected, tenant-scoped)
	// ============================================
	mux.Handle("/api/v1/wa-campaigns", requireAuth(requireWAGatewayFeature(requireCapability(rbac.CapWAView)(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		switch r.Method {
		case http.MethodPost:
			waCampaignHandler.Create(w, r)
		case http.MethodGet:
			waCampaignHandler.List(w, r)
		default:
			w.WriteHeader(http.StatusMethodNotAllowed)
		}
	})))))
	mux.Handle("/api/v1/wa-campaigns/", requireAuth(requireWAGatewayFeature(requireCapability(rbac.CapWAView)(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		path := strings.TrimPrefix(r.URL.Path, "/api/v1/wa-campaigns/")
		if path == "" {
			w.WriteHeader(http.StatusBadRequest)
			return
		}

		// /{id}/retry-failed
		if strings.HasSuffix(path, "/retry-failed") {
			idStr := strings.TrimSuffix(path, "/retry-failed")
			idStr = strings.TrimSuffix(idStr, "/")
			r = setPathParam(r, "id", idStr)
			if r.Method == http.MethodPost {
				waCampaignHandler.RetryFailed(w, r)
				return
			}
			w.WriteHeader(http.StatusMethodNotAllowed)
			return
		}

		// /{id}
		r = setPathParam(r, "id", strings.TrimSuffix(path, "/"))
		if r.Method == http.MethodGet {
			waCampaignHandler.Detail(w, r)
			return
		}
		w.WriteHeader(http.StatusMethodNotAllowed)
	})))))

	// ============================================
	// WhatsApp Templates (Protected, tenant-scoped)
	// ============================================
	mux.Handle("/api/v1/wa-templates", requireAuth(requireWAGatewayFeature(requireCapability(rbac.CapWAView)(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		switch r.Method {
		case http.MethodGet:
			waTemplateHandler.List(w, r)
		case http.MethodPost:
			waTemplateHandler.Create(w, r)
		default:
			w.WriteHeader(http.StatusMethodNotAllowed)
		}
	})))))
	mux.Handle("/api/v1/wa-templates/", requireAuth(requireWAGatewayFeature(requireCapability(rbac.CapWAView)(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		path := strings.TrimPrefix(r.URL.Path, "/api/v1/wa-templates/")
		if path == "" {
			w.WriteHeader(http.StatusBadRequest)
			return
		}
		r = setPathParam(r, "id", strings.TrimSuffix(path, "/"))
		switch r.Method {
		case http.MethodPut, http.MethodPatch:
			waTemplateHandler.Update(w, r)
		case http.MethodDelete:
			waTemplateHandler.Delete(w, r)
		default:
			w.WriteHeader(http.StatusMethodNotAllowed)
		}
	})))))

	// ============================================
	// WhatsApp Logs (Protected, tenant-scoped)
	// ============================================
	mux.Handle("/api/v1/wa-logs", requireAuth(requireWAGatewayFeature(requireCapability(rbac.CapWAView)(methodHandler("GET", waLogHandler.List)))))
	mux.Handle("/api/v1/wa-logs/", requireAuth(requireWAGatewayFeature(requireCapability(rbac.CapWAView)(methodHandler("GET", waLogHandler.List)))))

	// ============================================
	// Public Plan listing (no auth required for landing pages)
	mux.HandleFunc("/api/v1/plans/public", method("GET", planHandler.List))

	// Tenant management (Admin) - moved under /api/v1/superadmin/tenants/

	// Public Addon listing (optional)
	mux.HandleFunc("/api/v1/addons/public", method("GET", addonHandler.List))

	// Public Site Settings (SEO/Pricing)
	mux.HandleFunc("/api/v1/public/site-settings/seo", method("GET", siteSettingHandler.GetSEO))
	mux.HandleFunc("/api/v1/public/site-settings/pricing", method("GET", siteSettingHandler.GetPricingConfig))

	// Public Inventory
	mux.HandleFunc("/api/v1/public/inventory/instance/", func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodGet {
			w.WriteHeader(http.StatusMethodNotAllowed)
			return
		}
		path := strings.TrimPrefix(r.URL.Path, "/api/v1/public/inventory/instance/")
		r = setPathParam(r, "id", strings.TrimSuffix(path, "/"))
		inventoryHandler.GetPublicInstanceDetail(w, r)
	})

	// ============================================
	// Billing service initialization (needed for client routes)
	// ============================================
	// Billing service initialization (moved up)
	billingHandler := handler.NewBillingHandler(billingService)

	tempoTemplateRepo := repository.NewBillingTempoTemplateRepository(deps.DB)
	tempoTemplateService := service.NewBillingTempoTemplateService(tempoTemplateRepo)
	tempoTemplateHandler := handler.NewBillingTempoTemplateHandler(tempoTemplateService)

	portalService := service.NewPortalService(clientRepo, invoiceRepo, servicePackageRepo, paymentRepo)
	portalHandler := handler.NewPortalHandler(portalService)

	// ============================================
	// Client routes (Protected, tenant-scoped, requires client capabilities)
	// ============================================
	mux.Handle("/api/v1/clients", requireAuth(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		switch r.Method {
		case http.MethodGet:
			requireCapability(rbac.CapClientView)(http.HandlerFunc(clientHandler.List)).ServeHTTP(w, r)
		case http.MethodPost:
			requireCapability(rbac.CapClientCreate)(http.HandlerFunc(clientHandler.Create)).ServeHTTP(w, r)
		default:
			w.WriteHeader(http.StatusMethodNotAllowed)
		}
	})))
	mux.Handle("/api/v1/clients/stats", requireAuth(methodHandler("GET", clientHandler.GetStats)))
	mux.Handle("/api/v1/clients/", requireAuth(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		path := strings.TrimPrefix(r.URL.Path, "/api/v1/clients/")
		if path == "" || path == "stats" {
			w.WriteHeader(http.StatusBadRequest)
			return
		}

		parts := strings.Split(path, "/")
		r = setPathParam(r, "id", parts[0])

		// Check for billing routes: /api/v1/clients/{id}/invoices
		if len(parts) >= 2 && parts[1] == "invoices" {
			r = setPathParam(r, "client_id", parts[0])
			if r.Method == http.MethodGet {
				billingHandler.GetClientPendingInvoices(w, r)
			} else if r.Method == http.MethodPost && len(parts) == 3 && parts[2] == "generate" {
				billingHandler.GenerateMonthlyInvoice(w, r)
			} else {
				w.WriteHeader(http.StatusMethodNotAllowed)
			}
			return
		}

		// Check for status change: /api/v1/clients/{id}/status
		if len(parts) == 2 && parts[1] == "status" {
			if r.Method == http.MethodPatch {
				clientHandler.ChangeStatus(w, r)
			} else {
				w.WriteHeader(http.StatusMethodNotAllowed)
			}
			return
		}

		// Client CRUD operations
		switch r.Method {
		case http.MethodGet:
			clientHandler.Get(w, r)
		case http.MethodPut:
			clientHandler.Update(w, r)
		case http.MethodDelete:
			clientHandler.Delete(w, r)
		default:
			w.WriteHeader(http.StatusMethodNotAllowed)
		}
	})))

	// ============================================
	// Dashboard routes (Consolidated)
	// ============================================
	mux.Handle("/api/v1/dashboard/summary", requireAuth(methodHandler("GET", dashboardHandler.GetSummary)))
	mux.Handle("/api/v1/dashboard/bootstrap", requireAuth(methodHandler("GET", dashboardHandler.GetBootstrap)))

	// Portal routes
	mux.Handle("/api/v1/portal/dashboard", requireAuth(methodHandler("GET", portalHandler.GetDashboard)))
	mux.Handle("/api/v1/portal/invoices", requireAuth(methodHandler("GET", portalHandler.GetInvoices)))
	mux.Handle("/api/v1/portal/invoices/", requireAuth(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		path := strings.TrimPrefix(r.URL.Path, "/api/v1/portal/invoices/")
		path = strings.TrimSuffix(path, "/") // Remove trailing slash
		if path == "" {
			w.WriteHeader(http.StatusBadRequest)
			return
		}
		parts := strings.Split(path, "/")
		invoiceID := parts[0]
		r = setPathParam(r, "id", invoiceID)

		// Check for payment route: /api/v1/portal/invoices/{id}/payments
		if len(parts) >= 2 && parts[1] == "payments" {
			r = setPathParam(r, "invoice_id", invoiceID)
			if r.Method == http.MethodPost {
				portalHandler.RecordPayment(w, r)
			} else {
				w.WriteHeader(http.StatusMethodNotAllowed)
			}
			return
		}

		// Invoice detail route: /api/v1/portal/invoices/{id}
		if len(parts) == 1 {
			if r.Method == http.MethodGet {
				portalHandler.GetInvoiceDetail(w, r)
			} else {
				w.WriteHeader(http.StatusMethodNotAllowed)
			}
			return
		}

		w.WriteHeader(http.StatusNotFound)
	})))

	// ============================================
	// Tenant feature/limit routes (Protected, tenant context)
	// ============================================
	mux.Handle("/api/v1/my/plan", requireAuth(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		switch r.Method {
		case http.MethodGet:
			planHandler.GetTenantPlan(w, r)
		case http.MethodPatch:
			planHandler.ChangeMyPlan(w, r)
		case http.MethodPost:
			planHandler.RequestPlanChange(w, r)
		case http.MethodDelete:
			planHandler.CancelPlanChange(w, r)
		default:
			w.WriteHeader(http.StatusMethodNotAllowed)
		}
	})))
	mux.Handle("/api/v1/my/plan/pending", requireAuth(methodHandler("GET", planHandler.GetPendingPlanChange)))
	mux.Handle("/api/v1/my/features", requireAuth(methodHandler("GET", planHandler.GetTenantFeatures)))
	mux.Handle("/api/v1/my/limits", requireAuth(methodHandler("GET", planHandler.GetTenantLimits)))
	mux.Handle("/api/v1/my/addons", requireAuth(methodHandler("GET", addonHandler.GetTenantAddons)))
	mux.Handle("/api/v1/check/feature", requireAuth(methodHandler("GET", planHandler.CheckFeature)))
	mux.Handle("/api/v1/check/limit", requireAuth(methodHandler("GET", planHandler.CheckLimit)))

	// ============================================
	// Service setup routes (Protected, tenant-scoped, feature-gated: service_packages)
	// ============================================
	mux.Handle("/api/v1/service-packages", requireAuth(requireServicePackagesFeature(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		switch r.Method {
		case http.MethodGet:
			servicePackageHandler.List(w, r)
		case http.MethodPost:
			servicePackageHandler.Create(w, r)
		default:
			w.WriteHeader(http.StatusMethodNotAllowed)
		}
	}))))
	mux.Handle("/api/v1/service-packages/", requireAuth(requireServicePackagesFeature(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		path := strings.TrimPrefix(r.URL.Path, "/api/v1/service-packages/")
		if path == "" {
			w.WriteHeader(http.StatusBadRequest)
			return
		}
		r = setPathParam(r, "id", path)
		switch r.Method {
		case http.MethodGet:
			servicePackageHandler.Get(w, r)
		case http.MethodPut:
			servicePackageHandler.Update(w, r)
		case http.MethodDelete:
			servicePackageHandler.Delete(w, r)
		default:
			w.WriteHeader(http.StatusMethodNotAllowed)
		}
	}))))
	mux.Handle("/api/v1/service-settings", requireAuth(requireServicePackagesFeature(methodHandler("GET", serviceSettingsHandler.Get))))
	mux.Handle("/api/v1/service-settings/discount", requireAuth(requireServicePackagesFeature(methodHandler("PUT", serviceSettingsHandler.UpdateDiscount))))

	// ============================================
	// Discount routes (Protected, tenant-scoped, feature-gated: service_packages)
	// ============================================
	// Register exact path first (without trailing slash) for POST/GET
	mux.Handle("/api/v1/discounts", requireAuth(requireServicePackagesFeature(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		switch r.Method {
		case http.MethodGet:
			discountHandler.List(w, r)
		case http.MethodPost:
			discountHandler.Create(w, r)
		default:
			w.WriteHeader(http.StatusMethodNotAllowed)
		}
	}))))
	// Register path with trailing slash for ID-based operations (must be after exact path)
	mux.Handle("/api/v1/discounts/", requireAuth(requireServicePackagesFeature(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		path := strings.TrimPrefix(r.URL.Path, "/api/v1/discounts/")
		path = strings.TrimSuffix(path, "/") // Remove trailing slash if any
		if path == "" {
			// Empty path means request was to /api/v1/discounts/ (with trailing slash)
			// Redirect to exact route or return method not allowed
			w.WriteHeader(http.StatusBadRequest)
			return
		}
		r = setPathParam(r, "id", path)
		switch r.Method {
		case http.MethodGet:
			discountHandler.Get(w, r)
		case http.MethodPut:
			discountHandler.Update(w, r)
			discountHandler.Delete(w, r)
		default:
			w.WriteHeader(http.StatusMethodNotAllowed)
		}
	}))))

	// ============================================
	// Reseller routes (Protected, tenant-scoped, feature-gated: service_packages)
	// ============================================
	// Note: We use a combination of prefix matching and explicit sub-path handling
	// to avoid "Method Not Allowed" (405) errors caused by redirect collisions.

	mux.Handle("/api/v1/resellers", requireAuth(requireServicePackagesFeature(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Method == http.MethodGet {
			resellerHandler.ListResellers(w, r)
		} else {
			w.WriteHeader(http.StatusMethodNotAllowed)
		}
	}))))

	mux.Handle("/api/v1/resellers/global-prices", requireAuth(requireServicePackagesFeature(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		switch r.Method {
		case http.MethodGet:
			resellerHandler.GetGlobalPrices(w, r)
		case http.MethodPost:
			resellerHandler.SetGlobalPrice(w, r)
		default:
			w.WriteHeader(http.StatusMethodNotAllowed)
		}
	}))))

	mux.Handle("/api/v1/resellers/", requireAuth(requireServicePackagesFeature(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		path := strings.TrimPrefix(r.URL.Path, "/api/v1/resellers/")

		// 1. Explicit sub-paths (must check before ID logic)
		if path == "upgrade" || path == "upgrade/" {
			if r.Method == http.MethodPost {
				resellerHandler.UpgradeClient(w, r)
			} else {
				w.WriteHeader(http.StatusMethodNotAllowed)
			}
			return
		}

		if path == "" {
			w.WriteHeader(http.StatusBadRequest)
			return
		}

		parts := strings.Split(strings.Trim(path, "/"), "/")
		if len(parts) == 0 {
			w.WriteHeader(http.StatusBadRequest)
			return
		}

		resellerID := parts[0]
		r = setPathParam(r, "reseller_id", resellerID)

		// 2. Nested routes: /api/v1/resellers/{id}/status, /prices, /purchases, /active-vouchers
		if len(parts) >= 2 {
			action := parts[1]
			switch action {
			case "status":
				if r.Method == http.MethodPatch {
					resellerHandler.UpdateStatus(w, r)
					return
				}
			case "prices":
				if len(parts) == 2 {
					// /api/v1/resellers/{id}/prices
					switch r.Method {
					case http.MethodGet:
						resellerHandler.GetPrices(w, r)
					case http.MethodPost:
						resellerHandler.SetPrice(w, r)
					default:
						w.WriteHeader(http.StatusMethodNotAllowed)
					}
					return
				} else if len(parts) == 3 {
					// /api/v1/resellers/{id}/prices/{price_id}
					r = setPathParam(r, "price_id", parts[2])
					if r.Method == http.MethodDelete {
						resellerHandler.DeletePrice(w, r)
						return
					}
				}
			case "purchases":
				// /api/v1/resellers/{id}/purchases
				if r.Method == http.MethodPost {
					resellerHandler.ProcessPurchase(w, r)
					return
				}
			case "active-vouchers":
				// /api/v1/resellers/{id}/active-vouchers/count
				if len(parts) == 3 && parts[2] == "count" {
					if r.Method == http.MethodGet {
						resellerHandler.CountActiveVouchers(w, r)
						return
					}
				}
			}
			w.WriteHeader(http.StatusMethodNotAllowed)
			return
		}

		// 3. ID-specific routes (Method based on context)
		if len(parts) == 1 {
			// /api/v1/resellers/{id}
			if r.Method == http.MethodDelete {
				resellerHandler.DeleteReseller(w, r)
				return
			}
		}

		// 4. Fallback for illegal paths
		w.WriteHeader(http.StatusNotFound)
	}))))

	// Promo codes
	mux.Handle("/api/v1/resellers/promos", requireAuth(requireServicePackagesFeature(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		switch r.Method {
		case http.MethodGet:
			resellerHandler.ListPromos(w, r)
		case http.MethodPost:
			resellerHandler.CreatePromo(w, r)
		default:
			w.WriteHeader(http.StatusMethodNotAllowed)
		}
	}))))
	mux.Handle("/api/v1/resellers/promos/", requireAuth(requireServicePackagesFeature(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		path := strings.TrimPrefix(r.URL.Path, "/api/v1/resellers/promos/")
		if path == "" {
			w.WriteHeader(http.StatusBadRequest)
			return
		}

		parts := strings.Split(path, "/")
		promoID := parts[0]
		r = setPathParam(r, "promo_id", promoID)

		if len(parts) == 2 && parts[1] == "toggle" {
			if r.Method == http.MethodPost {
				resellerHandler.TogglePromoStatus(w, r)
			} else {
				w.WriteHeader(http.StatusMethodNotAllowed)
			}
			return
		}

		if len(parts) == 1 {
			if r.Method == http.MethodDelete {
				resellerHandler.DeletePromo(w, r)
			} else {
				w.WriteHeader(http.StatusMethodNotAllowed)
			}
			return
		}

		w.WriteHeader(http.StatusNotFound)
	}))))

	// Purchase history
	mux.Handle("/api/v1/resellers/purchases", requireAuth(requireServicePackagesFeature(methodHandler("GET", resellerHandler.GetPurchaseHistory))))
	mux.Handle("/api/v1/resellers/purchases/", requireAuth(requireServicePackagesFeature(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		path := strings.TrimPrefix(r.URL.Path, "/api/v1/resellers/purchases/")
		if path == "" {
			w.WriteHeader(http.StatusBadRequest)
			return
		}

		parts := strings.Split(path, "/")
		purchaseID := parts[0]
		r = setPathParam(r, "purchase_id", purchaseID)

		// Handle nested routes like /api/v1/resellers/purchases/{id}/confirm
		if len(parts) == 2 {
			action := parts[1]
			if action == "confirm" {
				if r.Method == http.MethodPost {
					resellerHandler.ConfirmPurchase(w, r)
					return
				}
			}
			if action == "submit-payment" {
				if r.Method == http.MethodPost {
					resellerHandler.SubmitPayment(w, r)
					return
				}
			}
			w.WriteHeader(http.StatusMethodNotAllowed)
			return
		}

		if len(parts) == 1 {
			switch r.Method {
			case http.MethodDelete:
				resellerHandler.DeletePurchase(w, r)
			case http.MethodGet:
				resellerHandler.GetPurchase(w, r)
			default:
				w.WriteHeader(http.StatusMethodNotAllowed)
			}
			return
		}

		w.WriteHeader(http.StatusNotFound)
	}))))

	// ============================================
	// Client Portal Reseller Routes
	// ============================================
	mux.Handle("/api/v1/portal/reseller/join", requireAuth(methodHandler("POST", resellerHandler.RegisterReseller)))
	mux.Handle("/api/v1/portal/reseller/me", requireAuth(methodHandler("GET", resellerHandler.GetMyResellerStatus)))
	mux.Handle("/api/v1/portal/reseller/prices", requireAuth(methodHandler("GET", resellerHandler.GetMyPrices)))
	mux.Handle("/api/v1/portal/reseller/purchases", requireAuth(methodHandler("POST", resellerHandler.ProcessMyPurchase)))
	mux.Handle("/api/v1/portal/reseller/payment-methods", requireAuth(methodHandler("GET", paymentMethodHandler.List)))

	// ============================================
	// Client group routes (Protected, tenant-scoped, feature-gated: service_packages)
	// Capabilities: view=list, update=create/update/delete
	// ============================================
	mux.Handle("/api/v1/client-groups", requireAuth(requireServicePackagesFeature(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		switch r.Method {
		case http.MethodGet:
			requireCapability(rbac.CapClientView)(http.HandlerFunc(clientGroupHandler.List)).ServeHTTP(w, r)
		case http.MethodPost:
			requireCapability(rbac.CapClientUpdate)(http.HandlerFunc(clientGroupHandler.Create)).ServeHTTP(w, r)
		default:
			w.WriteHeader(http.StatusMethodNotAllowed)
		}
	}))))
	mux.Handle("/api/v1/client-groups/", requireAuth(requireServicePackagesFeature(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		path := strings.TrimPrefix(r.URL.Path, "/api/v1/client-groups/")
		if path == "" {
			w.WriteHeader(http.StatusBadRequest)
			return
		}
		r = setPathParam(r, "id", path)
		switch r.Method {
		case http.MethodPut:
			requireCapability(rbac.CapClientUpdate)(http.HandlerFunc(clientGroupHandler.Update)).ServeHTTP(w, r)
		case http.MethodDelete:
			requireCapability(rbac.CapClientUpdate)(http.HandlerFunc(clientGroupHandler.Delete)).ServeHTTP(w, r)
		default:
			w.WriteHeader(http.StatusMethodNotAllowed)
		}
	}))))

	// ============================================
	// Employee routes (Protected, tenant-scoped, feature-gated: rbac_employee)
	// ============================================
	requireEmployeeFeature := middleware.RequireFeature(featureResolver, "rbac_employee")
	mux.Handle("/api/v1/employees", requireAuth(requireEmployeeFeature(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		switch r.Method {
		case http.MethodGet:
			requireCapability(rbac.CapUserView)(http.HandlerFunc(employeeHandler.List)).ServeHTTP(w, r)
		case http.MethodPost:
			requireCapability(rbac.CapUserCreate)(http.HandlerFunc(employeeHandler.Create)).ServeHTTP(w, r)
		default:
			w.WriteHeader(http.StatusMethodNotAllowed)
		}
	}))))
	mux.Handle("/api/v1/employees/", requireAuth(requireEmployeeFeature(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		path := strings.TrimPrefix(r.URL.Path, "/api/v1/employees/")
		if path == "" {
			w.WriteHeader(http.StatusBadRequest)
			return
		}
		r = setPathParam(r, "id", path)
		switch r.Method {
		case http.MethodGet:
			requireCapability(rbac.CapUserView)(http.HandlerFunc(employeeHandler.Get)).ServeHTTP(w, r)
		case http.MethodPatch:
			requireCapability(rbac.CapUserUpdate)(http.HandlerFunc(employeeHandler.Update)).ServeHTTP(w, r)
		default:
			w.WriteHeader(http.StatusMethodNotAllowed)
		}
	}))))

	// ============================================
	// Technician routes (Protected, tenant-scoped, RBAC-gated)
	// ============================================
	// Task summary route (must be before /tasks/ to avoid path matching conflicts)
	mux.Handle("/api/v1/technician/tasks/summary", requireAuth(requireCapability(rbac.CapTechnicianView)(methodHandler("GET", technicianHandler.GetTaskSummary))))

	// Task routes
	mux.Handle("/api/v1/technician/tasks", requireAuth(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		switch r.Method {
		case http.MethodGet:
			requireCapability(rbac.CapTechnicianView)(http.HandlerFunc(technicianHandler.ListTasks)).ServeHTTP(w, r)
		case http.MethodPost:
			requireCapability(rbac.CapTechnicianManage)(http.HandlerFunc(technicianHandler.CreateTask)).ServeHTTP(w, r)
		default:
			w.WriteHeader(http.StatusMethodNotAllowed)
		}
	})))

	// Task ID-specific routes
	mux.Handle("/api/v1/technician/tasks/", requireAuth(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		path := strings.TrimPrefix(r.URL.Path, "/api/v1/technician/tasks/")
		if path == "" {
			w.WriteHeader(http.StatusBadRequest)
			return
		}
		path = strings.TrimSuffix(path, "/")
		parts := strings.Split(path, "/")

		// Nested routes: /api/v1/technician/tasks/{id}/start, /complete, /cancel
		if len(parts) == 2 {
			id := parts[0]
			action := parts[1]
			r = setPathParam(r, "id", id)

			switch action {
			case "start":
				if r.Method == http.MethodPost {
					requireCapability(rbac.CapTechnicianManage)(http.HandlerFunc(technicianHandler.StartTask)).ServeHTTP(w, r)
					return
				}
			case "complete":
				if r.Method == http.MethodPost {
					requireCapability(rbac.CapTechnicianManage)(http.HandlerFunc(technicianHandler.CompleteTask)).ServeHTTP(w, r)
					return
				}
			case "cancel":
				if r.Method == http.MethodPost {
					requireCapability(rbac.CapTechnicianManage)(http.HandlerFunc(technicianHandler.CancelTask)).ServeHTTP(w, r)
					return
				}
			case "activities":
				if r.Method == http.MethodGet {
					r = setPathParam(r, "task_id", id)
					requireCapability(rbac.CapTechnicianView)(http.HandlerFunc(technicianHandler.GetTaskActivityLogs)).ServeHTTP(w, r)
					return
				}
			}
			w.WriteHeader(http.StatusMethodNotAllowed)
			return
		}

		// CRUD on specific task ID
		if len(parts) == 1 {
			r = setPathParam(r, "id", parts[0])
			switch r.Method {
			case http.MethodGet:
				requireCapability(rbac.CapTechnicianView)(http.HandlerFunc(technicianHandler.GetTask)).ServeHTTP(w, r)
			case http.MethodPut:
				requireCapability(rbac.CapTechnicianManage)(http.HandlerFunc(technicianHandler.UpdateTask)).ServeHTTP(w, r)
			case http.MethodDelete:
				requireCapability(rbac.CapTechnicianManage)(http.HandlerFunc(technicianHandler.DeleteTask)).ServeHTTP(w, r)
			default:
				w.WriteHeader(http.StatusMethodNotAllowed)
			}
			return
		}

		w.WriteHeader(http.StatusNotFound)
	})))

	mux.Handle("/api/v1/technician/activities", requireAuth(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		switch r.Method {
		case http.MethodGet:
			requireCapability(rbac.CapTechnicianView)(http.HandlerFunc(technicianHandler.ListActivityLogs)).ServeHTTP(w, r)
		case http.MethodPost:
			requireCapability(rbac.CapTechnicianManage)(http.HandlerFunc(technicianHandler.LogActivity)).ServeHTTP(w, r)
		default:
			w.WriteHeader(http.StatusMethodNotAllowed)
		}
	})))

	// Technician Time Off routes
	mux.Handle("/api/v1/technician/time-off", requireAuth(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		switch r.Method {
		case http.MethodGet:
			// List current user's time off requests
			userID, _ := auth.GetUserID(r.Context())
			q := r.URL.Query()
			q.Set("user_id", userID.String())
			r.URL.RawQuery = q.Encode()
			hrHandler.ListTimeOffs(w, r)
		case http.MethodPost:
			hrHandler.CreateTimeOff(w, r)
		default:
			w.WriteHeader(http.StatusMethodNotAllowed)
		}
	})))

	mux.Handle("/api/v1/technician/time-off/", requireAuth(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		path := strings.TrimPrefix(r.URL.Path, "/api/v1/technician/time-off/")
		id := strings.TrimSuffix(path, "/")
		r = setPathParam(r, "id", id)
		switch r.Method {
		case http.MethodGet:
			hrHandler.GetTimeOff(w, r)
		case http.MethodDelete:
			hrHandler.DeleteTimeOff(w, r)
		default:
			w.WriteHeader(http.StatusMethodNotAllowed)
		}
	})))

	// Attendance routes (Technician - for backward compatibility)
	mux.Handle("/api/v1/technician/attendance", requireAuth(methodHandler("GET", attendanceHandler.List)))
	mux.Handle("/api/v1/technician/attendance/today", requireAuth(methodHandler("GET", attendanceHandler.GetToday)))
	mux.Handle("/api/v1/technician/attendance/check-in", requireAuth(methodHandler("POST", attendanceHandler.CheckIn)))
	mux.Handle("/api/v1/technician/attendance/check-out", requireAuth(methodHandler("POST", attendanceHandler.CheckOut)))

	// Employee Self-Service Attendance routes (Available for all roles)
	mux.Handle("/api/v1/employee/attendance", requireAuth(methodHandler("GET", attendanceHandler.List)))
	mux.Handle("/api/v1/employee/attendance/today", requireAuth(methodHandler("GET", attendanceHandler.GetToday)))
	mux.Handle("/api/v1/employee/attendance/check-in", requireAuth(methodHandler("POST", attendanceHandler.CheckIn)))
	mux.Handle("/api/v1/employee/attendance/check-out", requireAuth(methodHandler("POST", attendanceHandler.CheckOut)))

	// Employee Self-Service Reimbursement routes (Available for all roles)
	mux.Handle("/api/v1/employee/reimbursements", requireAuth(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		switch r.Method {
		case http.MethodGet:
			// For list, we force filtering by current user
			userID, _ := auth.GetUserID(r.Context())
			// Add user_id to query params to ensure hrHandler.ListReimbursements filters by user
			q := r.URL.Query()
			q.Set("user_id", userID.String())
			r.URL.RawQuery = q.Encode()
			hrHandler.ListReimbursements(w, r)
		case http.MethodPost:
			hrHandler.CreateReimbursement(w, r)
		default:
			w.WriteHeader(http.StatusMethodNotAllowed)
		}
	})))

	mux.Handle("/api/v1/employee/reimbursements/", requireAuth(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		path := strings.TrimPrefix(r.URL.Path, "/api/v1/employee/reimbursements/")
		if path == "" {
			w.WriteHeader(http.StatusBadRequest)
			return
		}
		// Handle potential trailing slash
		id := strings.TrimSuffix(path, "/")
		r = setPathParam(r, "id", id)

		switch r.Method {
		case http.MethodGet:
			hrHandler.GetReimbursement(w, r)
		case http.MethodPut:
			hrHandler.UpdateReimbursement(w, r)
		default:
			w.WriteHeader(http.StatusMethodNotAllowed)
		}
	})))

	// Employee Self-Service Payroll routes
	mux.Handle("/api/v1/employee/payroll/mypayslips", requireAuth(http.HandlerFunc(payrollHandler.ListMyPayslips)))
	mux.Handle("/api/v1/employee/payroll/mypayslips/", requireAuth(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		path := strings.TrimPrefix(r.URL.Path, "/api/v1/employee/payroll/mypayslips/")
		if path == "" {
			payrollHandler.ListMyPayslips(w, r)
			return
		}
		path = strings.TrimSuffix(path, "/")
		parts := strings.Split(path, "/")

		if len(parts) == 2 && parts[1] == "download" {
			r = setPathParam(r, "id", parts[0])
			payrollHandler.DownloadMyPayslip(w, r)
			return
		}

		if len(parts) == 1 {
			r = setPathParam(r, "id", parts[0])
			payrollHandler.GetMyPayslip(w, r)
			return
		}

		w.WriteHeader(http.StatusNotFound)
	})))

	// ============================================
	// HR Reimbursement routes (Protected, tenant-scoped)
	// ============================================
	mux.Handle("/api/v1/hr/reimbursements", requireAuth(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		switch r.Method {
		case http.MethodGet:
			hrHandler.ListReimbursements(w, r)
		case http.MethodPost:
			hrHandler.CreateReimbursement(w, r)
		default:
			w.WriteHeader(http.StatusMethodNotAllowed)
		}
	})))

	mux.Handle("/api/v1/hr/reimbursements/", requireAuth(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		path := strings.TrimPrefix(r.URL.Path, "/api/v1/hr/reimbursements/")
		if path == "" {
			w.WriteHeader(http.StatusBadRequest)
			return
		}
		path = strings.TrimSuffix(path, "/")
		parts := strings.Split(path, "/")

		if len(parts) == 2 {
			id := parts[0]
			action := parts[1]
			r = setPathParam(r, "id", id)

			switch action {
			case "approve":
				if r.Method == http.MethodPost {
					requireCapability(rbac.CapHRManage)(http.HandlerFunc(hrHandler.ApproveReimbursement)).ServeHTTP(w, r)
					return
				}
			case "reject":
				if r.Method == http.MethodPost {
					requireCapability(rbac.CapHRManage)(http.HandlerFunc(hrHandler.RejectReimbursement)).ServeHTTP(w, r)
					return
				}
			case "pay":
				if r.Method == http.MethodPost {
					requireCapability(rbac.CapBillingUpdate)(http.HandlerFunc(hrHandler.MarkAsPaid)).ServeHTTP(w, r)
					return
				}
			case "payroll-consolidate":
				if r.Method == http.MethodPost {
					requireCapability(rbac.CapBillingUpdate)(http.HandlerFunc(hrHandler.SetPayWithPayroll)).ServeHTTP(w, r)
					return
				}
			}
		}

		if len(parts) == 1 {
			r = setPathParam(r, "id", parts[0])
			if r.Method == http.MethodGet {
				hrHandler.GetReimbursement(w, r)
				return
			}
		}

		w.WriteHeader(http.StatusNotFound)
	})))

	mux.Handle("/api/v1/hr/time-offs", requireAuth(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Method == http.MethodGet {
			requireCapability(rbac.CapHRView)(http.HandlerFunc(hrHandler.ListTimeOffs)).ServeHTTP(w, r)
		} else {
			w.WriteHeader(http.StatusMethodNotAllowed)
		}
	})))

	mux.Handle("/api/v1/hr/stats/employees", requireAuth(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Method == http.MethodGet {
			requireCapability(rbac.CapHRView)(http.HandlerFunc(hrHandler.GetEmployeeStats)).ServeHTTP(w, r)
		} else {
			w.WriteHeader(http.StatusMethodNotAllowed)
		}
	})))

	mux.Handle("/api/v1/hr/time-offs/", requireAuth(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		path := strings.TrimPrefix(r.URL.Path, "/api/v1/hr/time-offs/")
		path = strings.TrimSuffix(path, "/")
		parts := strings.Split(path, "/")

		if len(parts) == 2 {
			id := parts[0]
			action := parts[1]
			r = setPathParam(r, "id", id)

			switch action {
			case "approve":
				if r.Method == http.MethodPost {
					requireCapability(rbac.CapHRManage)(http.HandlerFunc(hrHandler.ApproveTimeOff)).ServeHTTP(w, r)
					return
				}
			case "reject":
				if r.Method == http.MethodPost {
					requireCapability(rbac.CapHRManage)(http.HandlerFunc(hrHandler.RejectTimeOff)).ServeHTTP(w, r)
					return
				}
			}
		}

		if len(parts) == 1 {
			r = setPathParam(r, "id", parts[0])
			if r.Method == http.MethodGet {
				requireCapability(rbac.CapHRView)(http.HandlerFunc(hrHandler.GetTimeOff)).ServeHTTP(w, r)
				return
			}
		}

		w.WriteHeader(http.StatusNotFound)
	})))

	// HR Attendance Settings
	mux.Handle("/api/v1/hr/attendance/settings", requireAuth(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		switch r.Method {
		case http.MethodGet:
			requireCapability(rbac.CapHRView)(http.HandlerFunc(attendanceHandler.GetSettings)).ServeHTTP(w, r)
		case http.MethodPut:
			requireCapability(rbac.CapHRManage)(http.HandlerFunc(attendanceHandler.UpdateSettings)).ServeHTTP(w, r)
		default:
			w.WriteHeader(http.StatusMethodNotAllowed)
		}
	})))

	mux.Handle("/api/v1/hr/attendance", requireAuth(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Method == http.MethodGet {
			requireCapability(rbac.CapHRView)(http.HandlerFunc(attendanceHandler.ListAll)).ServeHTTP(w, r)
		} else {
			w.WriteHeader(http.StatusMethodNotAllowed)
		}
	})))

	// HR Payroll
	payrollRunsHandler := requireAuth(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		// Remove both potential prefixes to handle exact and trailing slash cases
		path := strings.TrimPrefix(r.URL.Path, "/api/v1/hr/payroll/runs")
		path = strings.TrimPrefix(path, "/")

		if path == "" {
			// Base path: /api/v1/hr/payroll/runs or /api/v1/hr/payroll/runs/
			switch r.Method {
			case http.MethodGet:
				requireCapability(rbac.CapHRView)(http.HandlerFunc(payrollHandler.ListRuns)).ServeHTTP(w, r)
			case http.MethodPost:
				requireCapability(rbac.CapHRManage)(http.HandlerFunc(payrollHandler.CreateRun)).ServeHTTP(w, r)
			default:
				w.WriteHeader(http.StatusMethodNotAllowed)
			}
			return
		}

		// Specific ID: /api/v1/hr/payroll/runs/{id} or /api/v1/hr/payroll/runs/{id}/pay
		parts := strings.Split(path, "/")
		if len(parts) == 2 && parts[1] == "pay" {
			r = setPathParam(r, "id", parts[0])
			if r.Method == http.MethodPost {
				requireAnyCapability(rbac.CapHRManage, rbac.CapBillingUpdate)(http.HandlerFunc(payrollHandler.PayRun)).ServeHTTP(w, r)
				return
			}
		}

		r = setPathParam(r, "id", path)
		switch r.Method {
		case http.MethodGet:
			requireCapability(rbac.CapHRView)(http.HandlerFunc(payrollHandler.GetRun)).ServeHTTP(w, r)
		default:
			w.WriteHeader(http.StatusMethodNotAllowed)
		}
	}))

	mux.Handle("/api/v1/hr/payroll/runs", payrollRunsHandler)
	mux.Handle("/api/v1/hr/payroll/runs/", payrollRunsHandler)

	mux.Handle("/api/v1/hr/payroll/preview", requireAuth(requireCapability(rbac.CapHRView)(http.HandlerFunc(payrollHandler.GetPreview))))
	mux.Handle("/api/v1/hr/payroll/payslips", requireAuth(requireCapability(rbac.CapHRManage)(http.HandlerFunc(payrollHandler.UpsertPayslip))))
	mux.Handle("/api/v1/hr/payroll/payslips/", requireAuth(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		path := strings.TrimPrefix(r.URL.Path, "/api/v1/hr/payroll/payslips/")
		parts := strings.Split(path, "/")
		if len(parts) == 2 && parts[1] == "pay" {
			r = setPathParam(r, "id", parts[0])
			if r.Method == http.MethodPost {
				requireAnyCapability(rbac.CapHRManage, rbac.CapBillingUpdate)(http.HandlerFunc(payrollHandler.PayPayslip)).ServeHTTP(w, r)
				return
			}
		}
		w.WriteHeader(http.StatusNotFound)
	})))

	// ============================================
	// Super Admin routes (Protected, super admin only)
	// ============================================
	mux.Handle("/api/v1/superadmin/tenants", requireSuperAdmin(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		switch r.Method {
		case http.MethodGet:
			superAdminHandler.ListTenants(w, r)
		case http.MethodPost:
			superAdminHandler.CreateTenant(w, r)
		default:
			w.WriteHeader(http.StatusMethodNotAllowed)
		}
	})))
	// mux.Handle("/api/v1/superadmin/tenants/", ... already handled below or vice versa
	// Removing the redundant block to prevent panic
	mux.Handle("/api/v1/superadmin/tenants/", requireSuperAdmin(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		path := strings.TrimPrefix(r.URL.Path, "/api/v1/superadmin/tenants/")
		if path == "" {
			w.WriteHeader(http.StatusBadRequest)
			return
		}
		parts := strings.Split(path, "/")
		tenantID := parts[0]
		r = setPathParam(r, "id", tenantID)

		// Check for nested routes: /api/v1/superadmin/tenants/{id}/suspend
		if len(parts) >= 2 {
			switch parts[1] {
			case "suspend":
				if r.Method == http.MethodPost {
					superAdminHandler.SuspendTenant(w, r)
				} else {
					w.WriteHeader(http.StatusMethodNotAllowed)
				}
				return
			case "unsuspend":
				if r.Method == http.MethodPost {
					superAdminHandler.UnsuspendTenant(w, r)
				} else {
					w.WriteHeader(http.StatusMethodNotAllowed)
				}
				return
			case "assign-plan":
				if r.Method == http.MethodPost {
					superAdminHandler.AssignPlanToTenant(w, r)
				} else {
					w.WriteHeader(http.StatusMethodNotAllowed)
				}
				return
			case "plan": // /api/v1/superadmin/tenants/{id}/plan
				r = setPathParam(r, "tenant_id", tenantID)
				if r.Method == http.MethodPost {
					planHandler.AssignToTenant(w, r)
					return
				}
				w.WriteHeader(http.StatusMethodNotAllowed)
				return
			case "addons": // /api/v1/superadmin/tenants/{id}/addons
				r = setPathParam(r, "tenant_id", tenantID)
				if r.Method == http.MethodPost {
					addonHandler.AssignToTenant(w, r)
					return
				}
				w.WriteHeader(http.StatusMethodNotAllowed)
				return
			case "approve": // /api/v1/superadmin/tenants/{id}/approve
				if r.Method == http.MethodPatch {
					tenantHandler.ApproveTenant(w, r)
					return
				}
				w.WriteHeader(http.StatusMethodNotAllowed)
				return
			case "reject": // /api/v1/superadmin/tenants/{id}/reject
				if r.Method == http.MethodPatch {
					tenantHandler.RejectTenant(w, r)
					return
				}
				w.WriteHeader(http.StatusMethodNotAllowed)
				return
			}
		}

		// Regular tenant CRUD operations
		switch r.Method {
		case http.MethodGet:
			superAdminHandler.GetTenant(w, r)
		case http.MethodPatch:
			superAdminHandler.UpdateTenant(w, r)
		case http.MethodDelete:
			superAdminHandler.DeleteTenant(w, r)
		default:
			w.WriteHeader(http.StatusMethodNotAllowed)
		}
	})))

	mux.Handle("/api/v1/superadmin/routers/", requireSuperAdmin(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		path := strings.TrimPrefix(r.URL.Path, "/api/v1/superadmin/routers/")
		if path == "" {
			w.WriteHeader(http.StatusBadRequest)
			return
		}

		parts := strings.Split(path, "/")
		routerID := parts[0]
		r = setPathParam(r, "router_id", routerID)

		if len(parts) >= 2 && parts[1] == "decommission" {
			if r.Method == http.MethodPost {
				superAdminHandler.DecommissionRouter(w, r)
				return
			}
		}

		w.WriteHeader(http.StatusMethodNotAllowed)
	})))

	// Super Admin Plans
	mux.Handle("/api/v1/superadmin/plans", requireSuperAdmin(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		switch r.Method {
		case http.MethodGet:
			superAdminHandler.ListPlans(w, r)
		case http.MethodPost:
			superAdminHandler.CreatePlan(w, r)
		default:
			w.WriteHeader(http.StatusMethodNotAllowed)
		}
	})))
	mux.Handle("/api/v1/superadmin/plans/", requireSuperAdmin(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		path := strings.TrimPrefix(r.URL.Path, "/api/v1/superadmin/plans/")
		if path == "" {
			w.WriteHeader(http.StatusBadRequest)
			return
		}
		r = setPathParam(r, "id", path)
		switch r.Method {
		case http.MethodGet:
			superAdminHandler.GetPlan(w, r)
		case http.MethodPatch, http.MethodPut:
			superAdminHandler.UpdatePlan(w, r)
		case http.MethodDelete:
			superAdminHandler.DeletePlan(w, r)
		default:
			w.WriteHeader(http.StatusMethodNotAllowed)
		}
	})))

	// Super Admin Site Settings
	mux.Handle("/api/v1/superadmin/site-settings", requireSuperAdmin(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		switch r.Method {
		case http.MethodGet:
			siteSettingHandler.List(w, r)
		default:
			w.WriteHeader(http.StatusMethodNotAllowed)
		}
	})))
	mux.Handle("/api/v1/superadmin/site-settings/seo", requireSuperAdmin(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		switch r.Method {
		case http.MethodGet:
			siteSettingHandler.GetSEO(w, r)
		case http.MethodPost, http.MethodPut:
			siteSettingHandler.UpdateSEO(w, r)
		default:
			w.WriteHeader(http.StatusMethodNotAllowed)
		}
	})))
	mux.Handle("/api/v1/superadmin/site-settings/pricing", requireSuperAdmin(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		switch r.Method {
		case http.MethodGet:
			siteSettingHandler.GetPricingConfig(w, r)
		case http.MethodPost, http.MethodPut:
			siteSettingHandler.UpdatePricingConfig(w, r)
		default:
			w.WriteHeader(http.StatusMethodNotAllowed)
		}
	})))

	// Super Admin WhatsApp Management (Platform level)
	mux.Handle("/api/v1/superadmin/whatsapp/status", requireSuperAdmin(methodHandler("GET", superAdminHandler.GetWhatsAppStatus)))
	mux.Handle("/api/v1/superadmin/whatsapp/connect", requireSuperAdmin(methodHandler("POST", superAdminHandler.ConnectWhatsApp)))
	mux.Handle("/api/v1/superadmin/whatsapp/qr", requireSuperAdmin(methodHandler("GET", superAdminHandler.GetWhatsAppQR)))

	// Super Admin Network Monitoring
	mux.Handle("/api/v1/superadmin/network/stats", requireSuperAdmin(methodHandler("GET", superAdminHandler.GetNetworkStats)))

	// Super Admin Addons
	mux.Handle("/api/v1/superadmin/addons", requireSuperAdmin(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		switch r.Method {
		case http.MethodGet:
			superAdminHandler.ListAddons(w, r)
		case http.MethodPost:
			superAdminHandler.CreateAddon(w, r)
		default:
			w.WriteHeader(http.StatusMethodNotAllowed)
		}
	})))
	mux.Handle("/api/v1/superadmin/addons/", requireSuperAdmin(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		path := strings.TrimPrefix(r.URL.Path, "/api/v1/superadmin/addons/")
		if path == "" {
			w.WriteHeader(http.StatusBadRequest)
			return
		}
		r = setPathParam(r, "id", path)
		switch r.Method {
		case http.MethodGet:
			superAdminHandler.GetAddon(w, r)
		case http.MethodPatch, http.MethodPut:
			superAdminHandler.UpdateAddon(w, r)
		case http.MethodDelete:
			superAdminHandler.DeleteAddon(w, r)
		default:
			w.WriteHeader(http.StatusMethodNotAllowed)
		}
	})))

	// ============================================
	// Network routes (Protected, tenant-scoped)
	// ============================================
	networkService.StartHealthCheckScheduler(context.Background())
	// Restore iptables rules on startup (safety net after container/VPS restart).
	// Runs in background so it doesn't delay first HTTP response.
	go networkService.SyncRemoteAccessRules(context.Background())
	
	encryptionSecret := deps.Config.Auth.JWTSecret
	decommissionService := service.NewRouterDecommissionService(
		routerRepo,
		syncRepo,
		pppoeRepo,
		voucherRepo,
		profileRepo,
		encryptionSecret,
	)
	networkHandler := handler.NewNetworkHandler(networkService, decommissionService)

	// RADIUS + Voucher (Hotspot) - initialized above for clientService
	// RADIUS shared secret from env (for FreeRADIUS rlm_rest authentication)
	// Must match FreeRADIUS env: RRNET_RADIUS_REST_SECRET (see infra/freeradius + docker-compose).
	radiusSecret := utils.GetEnv("RRNET_RADIUS_REST_SECRET", "dev-radius-rest-secret")
	radiusHandler := handler.NewRadiusHandler(routerRepo, voucherService, radiusRepo, radiusSecret)
	
	// Start stale session cleaner (runs once at startup, then every 10 min)
	// Clears out any ghost/zombie active sessions from before container restart
	radiusHandler.StartStaleSessionCleaner(context.Background())
	
	voucherHandler := handler.NewVoucherHandler(voucherService)

	// Routers
	mux.Handle("/api/v1/network/routers", requireAuth(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		switch r.Method {
		case http.MethodGet:
			requireCapability(rbac.CapNetworkView)(http.HandlerFunc(networkHandler.ListRouters)).ServeHTTP(w, r)
		case http.MethodPost:
			requireCapability(rbac.CapNetworkManage)(http.HandlerFunc(networkHandler.CreateRouter)).ServeHTTP(w, r)
		default:
			w.WriteHeader(http.StatusMethodNotAllowed)
		}
	})))

	mux.Handle("/api/v1/network/routers/", requireAuth(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		path := strings.TrimPrefix(r.URL.Path, "/api/v1/network/routers/")
		if path == "" {
			w.WriteHeader(http.StatusBadRequest)
			return
		}
		path = strings.TrimSuffix(path, "/")
		parts := strings.Split(path, "/")

		// 1. Provision (POST /api/v1/network/routers/provision)
		if path == "provision" {
			if r.Method == http.MethodPost {
				requireCapability(rbac.CapNetworkManage)(http.HandlerFunc(networkHandler.ProvisionRouter)).ServeHTTP(w, r)
				return
			}
			w.WriteHeader(http.StatusMethodNotAllowed)
			return
		}

		// 2. Test Router Config (POST /api/v1/network/routers/test-config)
		if path == "test-config" {
			if r.Method == http.MethodPost {
				requireCapability(rbac.CapNetworkManage)(http.HandlerFunc(networkHandler.TestRouterConfig)).ServeHTTP(w, r)
				return
			}
			w.WriteHeader(http.StatusMethodNotAllowed)
			return
		}

		// 3. ID-specific routes
		if len(parts) == 2 {
			id := parts[0]
			action := parts[1]
			r = setPathParam(r, "id", id)

			switch action {
			case "test-connection":
				if r.Method == http.MethodPost {
					requireCapability(rbac.CapNetworkView)(http.HandlerFunc(networkHandler.TestRouterConnection)).ServeHTTP(w, r)
					return
				}
			case "disconnect":
				if r.Method == http.MethodPost {
					requireCapability(rbac.CapNetworkManage)(http.HandlerFunc(networkHandler.DisconnectRouter)).ServeHTTP(w, r)
					return
				}
			case "remote-access":
				if r.Method == http.MethodPost {
					requireCapability(rbac.CapNetworkManage)(http.HandlerFunc(networkHandler.ToggleRemoteAccess)).ServeHTTP(w, r)
					return
				}

			case "isolir-install":
				if r.Method == http.MethodPost {
					requireCapability(rbac.CapNetworkManage)(http.HandlerFunc(networkHandler.InstallIsolirFirewall)).ServeHTTP(w, r)
					return
				}
			case "isolir-status":
				if r.Method == http.MethodGet {
					requireCapability(rbac.CapNetworkView)(http.HandlerFunc(networkHandler.GetIsolirStatus)).ServeHTTP(w, r)
					return
				}
			case "isolir-uninstall":
				if r.Method == http.MethodPost {
					requireCapability(rbac.CapNetworkManage)(http.HandlerFunc(networkHandler.UninstallIsolirFirewall)).ServeHTTP(w, r)
					return
				}
			case "logs":
				if r.Method == http.MethodGet {
					requireCapability(rbac.CapNetworkView)(http.HandlerFunc(networkHandler.GetRouterLogs)).ServeHTTP(w, r)
					return
				}
			case "decommission":
				if r.Method == http.MethodPost {
					requireCapability(rbac.CapNetworkManage)(http.HandlerFunc(networkHandler.DecommissionRouter)).ServeHTTP(w, r)
					return
				}
			case "decommission-progress":
				if r.Method == http.MethodGet {
					requireCapability(rbac.CapNetworkView)(http.HandlerFunc(networkHandler.GetDecommissionProgress)).ServeHTTP(w, r)
					return
				}
			}
			w.WriteHeader(http.StatusMethodNotAllowed)
			return
		}

		// 4. CRUD on specific ID
		if len(parts) == 1 {
			r = setPathParam(r, "id", parts[0])
			switch r.Method {
			case http.MethodGet:
				requireCapability(rbac.CapNetworkView)(http.HandlerFunc(networkHandler.GetRouter)).ServeHTTP(w, r)
			case http.MethodPut:
				requireCapability(rbac.CapNetworkManage)(http.HandlerFunc(networkHandler.UpdateRouter)).ServeHTTP(w, r)
			case http.MethodDelete:
				requireCapability(rbac.CapNetworkManage)(http.HandlerFunc(networkHandler.DeleteRouter)).ServeHTTP(w, r)
			default:
				w.WriteHeader(http.StatusMethodNotAllowed)
			}
			return
		}

		w.WriteHeader(http.StatusNotFound)
	})))

	// Network Profiles
	mux.Handle("/api/v1/network/profiles", requireAuth(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		switch r.Method {
		case http.MethodGet:
			networkHandler.ListProfiles(w, r)
		case http.MethodPost:
			networkHandler.CreateProfile(w, r)
		default:
			w.WriteHeader(http.StatusMethodNotAllowed)
		}
	})))
	mux.Handle("/api/v1/network/profiles/", requireAuth(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		path := strings.TrimPrefix(r.URL.Path, "/api/v1/network/profiles/")
		if path == "" {
			w.WriteHeader(http.StatusBadRequest)
			return
		}
		path = strings.TrimSuffix(path, "/")
		parts := strings.Split(path, "/")

		// Special routes: sync and import
		if len(parts) == 1 {
			switch parts[0] {
			case "sync":
				// GET /api/v1/network/profiles/sync?router_id=xxx - list profiles from router
				if r.Method == http.MethodGet {
					requireCapability(rbac.CapNetworkView)(http.HandlerFunc(networkHandler.ListProfilesFromRouter)).ServeHTTP(w, r)
					return
				}
			case "import":
				// POST /api/v1/network/profiles/import?router_id=xxx - import profile from router
				if r.Method == http.MethodPost {
					requireCapability(rbac.CapNetworkManage)(http.HandlerFunc(networkHandler.ImportProfileFromRouter)).ServeHTTP(w, r)
					return
				}
			}
		}

		// Nested routes: /api/v1/network/profiles/{id}/sync?router_id=xxx
		if len(parts) == 2 {
			id := parts[0]
			action := parts[1]
			r = setPathParam(r, "id", id)

			switch action {
			case "sync":
				// POST /api/v1/network/profiles/{id}/sync?router_id=xxx - sync profile to router
				if r.Method == http.MethodPost {
					requireCapability(rbac.CapNetworkManage)(http.HandlerFunc(networkHandler.SyncProfileToRouter)).ServeHTTP(w, r)
					return
				}
			}
			w.WriteHeader(http.StatusMethodNotAllowed)
			return
		}

		// CRUD on specific ID
		if len(parts) == 1 {
			r = setPathParam(r, "id", parts[0])
			switch r.Method {
			case http.MethodGet:
				networkHandler.GetProfile(w, r)
			case http.MethodPut:
				networkHandler.UpdateProfile(w, r)
			case http.MethodDelete:
				networkHandler.DeleteProfile(w, r)
			default:
				w.WriteHeader(http.StatusMethodNotAllowed)
			}
			return
		}

		w.WriteHeader(http.StatusNotFound)
	})))

	// ============================================
	// RADIUS routes (PUBLIC - protected by shared secret header only)
	// These endpoints are called by FreeRADIUS rlm_rest
	// ============================================
	mux.Handle("/api/v1/radius/auth", methodHandler("POST", radiusHandler.Auth))
	mux.Handle("/api/v1/radius/acct", methodHandler("POST", radiusHandler.Acct))

	// ============================================
	// Voucher routes (Protected, tenant-scoped)
	// ============================================
	mux.Handle("/api/v1/voucher-packages", requireAuth(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		switch r.Method {
		case http.MethodGet:
			voucherHandler.ListPackages(w, r)
		case http.MethodPost:
			voucherHandler.CreatePackage(w, r)
		default:
			w.WriteHeader(http.StatusMethodNotAllowed)
		}
	})))
	mux.Handle("/api/v1/voucher-packages/", requireAuth(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		path := strings.TrimPrefix(r.URL.Path, "/api/v1/voucher-packages/")
		if path == "" {
			w.WriteHeader(http.StatusBadRequest)
			return
		}

		// Check for sync action: /api/v1/voucher-packages/{id}/sync
		parts := strings.Split(path, "/")
		if len(parts) == 2 && parts[1] == "sync" {
			r = setPathParam(r, "id", parts[0])
			if r.Method == http.MethodPost {
				voucherHandler.SyncPackageToRouters(w, r)
				return
			}
			w.WriteHeader(http.StatusMethodNotAllowed)
			return
		}

		// Single ID route: /api/v1/voucher-packages/{id}
		r = setPathParam(r, "id", path)
		switch r.Method {
		case http.MethodGet:
			voucherHandler.GetPackage(w, r)
		case http.MethodPut:
			voucherHandler.UpdatePackage(w, r)
		case http.MethodDelete:
			voucherHandler.DeletePackage(w, r)
		default:
			w.WriteHeader(http.StatusMethodNotAllowed)
		}
	})))

	mux.Handle("/api/v1/vouchers", requireAuth(methodHandler("GET", voucherHandler.ListVouchers)))
	mux.Handle("/api/v1/vouchers/generate", requireAuth(methodHandler("POST", voucherHandler.GenerateVouchers)))
	mux.Handle("/api/v1/vouchers/", requireAuth(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		// Log request for debugging
		log.Info().Str("method", r.Method).Str("path", r.URL.Path).Msg("Voucher request")

		// CORS fallback
		if r.Method == http.MethodOptions {
			w.WriteHeader(http.StatusNoContent)
			return
		}

		path := strings.TrimPrefix(r.URL.Path, "/api/v1/vouchers/")
		if path == "" {
			w.WriteHeader(http.StatusBadRequest)
			return
		}

		// Check for toggle-status action: /api/v1/vouchers/{id}/toggle-status
		parts := strings.Split(path, "/")
		if len(parts) == 2 && parts[1] == "toggle-status" {
			r = setPathParam(r, "id", parts[0])
			if r.Method == http.MethodPost {
				voucherHandler.ToggleVoucherStatus(w, r)
				return
			}
			w.WriteHeader(http.StatusMethodNotAllowed)
			return
		}

		// Check for toggle-isolate action: /api/v1/vouchers/{id}/toggle-isolate
		if len(parts) == 2 && parts[1] == "toggle-isolate" {
			r = setPathParam(r, "id", parts[0])
			if r.Method == http.MethodPost {
				voucherHandler.ToggleIsolate(w, r)
				return
			}
			w.WriteHeader(http.StatusMethodNotAllowed)
			return
		}

		// Single ID route: /api/v1/vouchers/{id}
		r = setPathParam(r, "id", path)
		switch r.Method {
		case http.MethodPut:
			voucherHandler.UpdateVoucher(w, r)
		case http.MethodDelete:
			voucherHandler.DeleteVoucher(w, r)
		default:
			log.Warn().Str("method", r.Method).Msg("Voucher method not allowed")
			w.WriteHeader(http.StatusMethodNotAllowed)
		}
	})))

	// RADIUS audit routes (Protected, tenant-scoped)
	mux.Handle("/api/v1/radius/auth-attempts", requireAuth(methodHandler("GET", radiusHandler.ListAuthAttempts)))
	mux.Handle("/api/v1/radius/sessions", requireAuth(methodHandler("GET", radiusHandler.ListActiveSessions)))

	// PPPoE Management
	pppoeHandler := handler.NewPPPoEHandler(pppoeService)

	// PPPoE secrets base route (GET list, POST create)
	mux.Handle("/api/v1/pppoe/secrets", requireAuth(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		switch r.Method {
		case http.MethodGet:
			requireCapability(rbac.CapNetworkView)(http.HandlerFunc(pppoeHandler.ListPPPoESecrets)).ServeHTTP(w, r)
		case http.MethodPost:
			requireCapability(rbac.CapNetworkManage)(http.HandlerFunc(pppoeHandler.CreatePPPoESecret)).ServeHTTP(w, r)
		default:
			w.WriteHeader(http.StatusMethodNotAllowed)
		}
	})))

	// PPPoE secrets with ID (nested routes) - handles /api/v1/pppoe/secrets/{id} and nested actions
	mux.Handle("/api/v1/pppoe/secrets/", requireAuth(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		path := strings.TrimPrefix(r.URL.Path, "/api/v1/pppoe/secrets/")
		path = strings.TrimSuffix(path, "/")
		if path == "" {
			// Empty path means request to /api/v1/pppoe/secrets/ - handle same as base route
			switch r.Method {
			case http.MethodGet:
				requireCapability(rbac.CapNetworkView)(http.HandlerFunc(pppoeHandler.ListPPPoESecrets)).ServeHTTP(w, r)
			case http.MethodPost:
				requireCapability(rbac.CapNetworkManage)(http.HandlerFunc(pppoeHandler.CreatePPPoESecret)).ServeHTTP(w, r)
			default:
				w.WriteHeader(http.StatusMethodNotAllowed)
			}
			return
		}
		parts := strings.Split(path, "/")

		// Nested routes: /api/v1/pppoe/secrets/{id}/toggle-status, /sync
		if len(parts) == 2 {
			id := parts[0]
			action := parts[1]
			r = setPathParam(r, "id", id)

			switch action {
			case "toggle-status":
				if r.Method == http.MethodPost {
					requireCapability(rbac.CapNetworkManage)(http.HandlerFunc(pppoeHandler.ToggleStatus)).ServeHTTP(w, r)
					return
				}
			case "sync":
				if r.Method == http.MethodPost {
					requireCapability(rbac.CapNetworkManage)(http.HandlerFunc(pppoeHandler.SyncToRouter)).ServeHTTP(w, r)
					return
				}
			}
			w.WriteHeader(http.StatusMethodNotAllowed)
			return
		}

		// CRUD on specific secret ID
		if len(parts) == 1 {
			r = setPathParam(r, "id", parts[0])
			switch r.Method {
			case http.MethodGet:
				requireCapability(rbac.CapNetworkView)(http.HandlerFunc(pppoeHandler.GetPPPoESecret)).ServeHTTP(w, r)
			case http.MethodPut:
				requireCapability(rbac.CapNetworkManage)(http.HandlerFunc(pppoeHandler.UpdatePPPoESecret)).ServeHTTP(w, r)
			case http.MethodDelete:
				requireCapability(rbac.CapNetworkManage)(http.HandlerFunc(pppoeHandler.DeletePPPoESecret)).ServeHTTP(w, r)
			default:
				w.WriteHeader(http.StatusMethodNotAllowed)
			}
			return
		}

		w.WriteHeader(http.StatusNotFound)
	})))

	mux.Handle("/api/v1/pppoe/active", requireAuth(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Method == http.MethodGet {
			requireCapability(rbac.CapNetworkView)(http.HandlerFunc(pppoeHandler.ListActiveConnections)).ServeHTTP(w, r)
		} else {
			w.WriteHeader(http.StatusMethodNotAllowed)
		}
	})))

	mux.Handle("/api/v1/pppoe/active/", requireAuth(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		path := strings.TrimPrefix(r.URL.Path, "/api/v1/pppoe/active/")
		if path == "" {
			w.WriteHeader(http.StatusBadRequest)
			return
		}
		path = strings.TrimSuffix(path, "/")
		parts := strings.Split(path, "/")

		// Disconnect: /api/v1/pppoe/active/{session_id}/disconnect
		if len(parts) == 2 && parts[1] == "disconnect" {
			r = setPathParam(r, "session_id", parts[0])
			if r.Method == http.MethodPost {
				requireCapability(rbac.CapNetworkManage)(http.HandlerFunc(pppoeHandler.DisconnectSession)).ServeHTTP(w, r)
				return
			}
			w.WriteHeader(http.StatusMethodNotAllowed)
			return
		}

		w.WriteHeader(http.StatusNotFound)
	})))

	// ============================================
	// Maps routes (Protected, tenant-scoped, feature-gated)
	// Requires: odp_maps OR client_maps (Business+; Enterprise via "*")
	// ============================================
	odcRepo := repository.NewODCRepository(deps.DB)
	odpRepo := repository.NewODPRepository(deps.DB)
	clientLocRepo := repository.NewClientLocationRepository(deps.DB)
	outageRepo := repository.NewOutageRepository(deps.DB)
	topologyRepo := repository.NewTopologyRepository(deps.DB)
	mapsService := service.NewMapsService(odcRepo, odpRepo, clientLocRepo, outageRepo, topologyRepo, resellerRepo)
	mapsHandler := handler.NewMapsHandler(mapsService)

	// ODCs
	mux.Handle("/api/v1/maps/odcs", requireAuth(requireMapsFeature(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		switch r.Method {
		case http.MethodGet:
			requireCapability(rbac.CapMapsView)(http.HandlerFunc(mapsHandler.ListODCs)).ServeHTTP(w, r)
		case http.MethodPost:
			requireCapability(rbac.CapMapsUpdate)(http.HandlerFunc(mapsHandler.CreateODC)).ServeHTTP(w, r)
		default:
			w.WriteHeader(http.StatusMethodNotAllowed)
		}
	}))))
	mux.Handle("/api/v1/maps/odcs/", requireAuth(requireMapsFeature(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		path := strings.TrimPrefix(r.URL.Path, "/api/v1/maps/odcs/")
		if path == "" {
			w.WriteHeader(http.StatusBadRequest)
			return
		}
		parts := strings.Split(path, "/")
		r = setPathParam(r, "id", parts[0])
		switch r.Method {
		case http.MethodGet:
			requireCapability(rbac.CapMapsView)(http.HandlerFunc(mapsHandler.GetODC)).ServeHTTP(w, r)
		case http.MethodPut, http.MethodPatch:
			requireCapability(rbac.CapMapsUpdate)(http.HandlerFunc(mapsHandler.UpdateODC)).ServeHTTP(w, r)
		case http.MethodDelete:
			requireCapability(rbac.CapMapsUpdate)(http.HandlerFunc(mapsHandler.DeleteODC)).ServeHTTP(w, r)
		default:
			w.WriteHeader(http.StatusMethodNotAllowed)
		}
	}))))

	// ODPs
	mux.Handle("/api/v1/maps/odps", requireAuth(requireMapsFeature(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		switch r.Method {
		case http.MethodGet:
			requireCapability(rbac.CapMapsView)(http.HandlerFunc(mapsHandler.ListODPs)).ServeHTTP(w, r)
		case http.MethodPost:
			requireCapability(rbac.CapMapsUpdate)(http.HandlerFunc(mapsHandler.CreateODP)).ServeHTTP(w, r)
		default:
			w.WriteHeader(http.StatusMethodNotAllowed)
		}
	}))))
	mux.Handle("/api/v1/maps/odps/", requireAuth(requireMapsFeature(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		path := strings.TrimPrefix(r.URL.Path, "/api/v1/maps/odps/")
		if path == "" {
			w.WriteHeader(http.StatusBadRequest)
			return
		}
		parts := strings.Split(path, "/")
		r = setPathParam(r, "id", parts[0])
		switch r.Method {
		case http.MethodGet:
			requireCapability(rbac.CapMapsView)(http.HandlerFunc(mapsHandler.GetODP)).ServeHTTP(w, r)
		case http.MethodPut, http.MethodPatch:
			requireCapability(rbac.CapMapsUpdate)(http.HandlerFunc(mapsHandler.UpdateODP)).ServeHTTP(w, r)
		case http.MethodDelete:
			requireCapability(rbac.CapMapsUpdate)(http.HandlerFunc(mapsHandler.DeleteODP)).ServeHTTP(w, r)
		default:
			w.WriteHeader(http.StatusMethodNotAllowed)
		}
	}))))

	// Client locations
	mux.Handle("/api/v1/maps/clients/nearest-odp", requireAuth(requireMapsFeature(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Method == http.MethodGet {
			requireCapability(rbac.CapMapsView)(http.HandlerFunc(mapsHandler.FindNearestODP)).ServeHTTP(w, r)
			return
		}
		w.WriteHeader(http.StatusMethodNotAllowed)
	}))))
	mux.Handle("/api/v1/maps/clients", requireAuth(requireMapsFeature(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		switch r.Method {
		case http.MethodGet:
			requireCapability(rbac.CapMapsView)(http.HandlerFunc(mapsHandler.ListClientLocations)).ServeHTTP(w, r)
		case http.MethodPost:
			requireCapability(rbac.CapMapsUpdate)(http.HandlerFunc(mapsHandler.CreateClientLocation)).ServeHTTP(w, r)
		default:
			w.WriteHeader(http.StatusMethodNotAllowed)
		}
	}))))
	mux.Handle("/api/v1/maps/clients/", requireAuth(requireMapsFeature(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		path := strings.TrimPrefix(r.URL.Path, "/api/v1/maps/clients/")
		if path == "" {
			w.WriteHeader(http.StatusBadRequest)
			return
		}
		parts := strings.Split(path, "/")
		r = setPathParam(r, "id", parts[0])
		switch r.Method {
		case http.MethodGet:
			requireCapability(rbac.CapMapsView)(http.HandlerFunc(mapsHandler.GetClientLocation)).ServeHTTP(w, r)
		case http.MethodPut, http.MethodPatch:
			requireCapability(rbac.CapMapsUpdate)(http.HandlerFunc(mapsHandler.UpdateClientLocation)).ServeHTTP(w, r)
		case http.MethodDelete:
			requireCapability(rbac.CapMapsUpdate)(http.HandlerFunc(mapsHandler.DeleteClientLocation)).ServeHTTP(w, r)
		default:
			w.WriteHeader(http.StatusMethodNotAllowed)
		}
	}))))

	// Outages
	mux.Handle("/api/v1/maps/outages", requireAuth(requireMapsFeature(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		switch r.Method {
		case http.MethodGet:
			requireCapability(rbac.CapMapsView)(http.HandlerFunc(mapsHandler.ListOutages)).ServeHTTP(w, r)
		case http.MethodPost:
			requireCapability(rbac.CapMapsUpdate)(http.HandlerFunc(mapsHandler.ReportOutage)).ServeHTTP(w, r)
		default:
			w.WriteHeader(http.StatusMethodNotAllowed)
		}
	}))))
	mux.Handle("/api/v1/maps/outages/", requireAuth(requireMapsFeature(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		path := strings.TrimPrefix(r.URL.Path, "/api/v1/maps/outages/")
		if path == "" {
			w.WriteHeader(http.StatusBadRequest)
			return
		}
		parts := strings.Split(path, "/")
		r = setPathParam(r, "id", parts[0])
		// POST /api/v1/maps/outages/{id}/resolve
		if len(parts) == 2 && parts[1] == "resolve" {
			if r.Method == http.MethodPost {
				requireCapability(rbac.CapMapsUpdate)(http.HandlerFunc(mapsHandler.ResolveOutage)).ServeHTTP(w, r)
			} else {
				w.WriteHeader(http.StatusMethodNotAllowed)
			}
			return
		}
		// GET /api/v1/maps/outages/{id}
		if r.Method == http.MethodGet {
			requireCapability(rbac.CapMapsView)(http.HandlerFunc(mapsHandler.GetOutage)).ServeHTTP(w, r)
			return
		}
		w.WriteHeader(http.StatusMethodNotAllowed)
	}))))

	// Topology
	mux.Handle("/api/v1/maps/topology", requireAuth(requireMapsFeature(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Method == http.MethodGet {
			requireCapability(rbac.CapMapsView)(http.HandlerFunc(mapsHandler.GetTopology)).ServeHTTP(w, r)
		} else {
			w.WriteHeader(http.StatusMethodNotAllowed)
		}
	}))))

	// ============================================
	// Billing routes (Protected, tenant-scoped)
	// ============================================
	// Invoices
	mux.Handle("/api/v1/billing/invoices", requireAuth(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		switch r.Method {
		case http.MethodGet:
			billingHandler.ListInvoices(w, r)
		case http.MethodPost:
			billingHandler.CreateInvoice(w, r)
		default:
			w.WriteHeader(http.StatusMethodNotAllowed)
		}
	})))
	mux.Handle("/api/v1/billing/invoices/overdue", requireAuth(methodHandler("GET", billingHandler.GetOverdueInvoices)))
	mux.Handle("/api/v1/billing/invoices/", requireAuth(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		path := strings.TrimPrefix(r.URL.Path, "/api/v1/billing/invoices/")
		parts := strings.Split(path, "/")
		if len(parts) == 0 || parts[0] == "" {
			w.WriteHeader(http.StatusBadRequest)
			return
		}
		r = setPathParam(r, "id", parts[0])

		if len(parts) == 2 && parts[1] == "payments" {
			r = setPathParam(r, "invoice_id", parts[0])
			if r.Method == http.MethodGet {
				billingHandler.GetInvoicePayments(w, r)
			} else {
				w.WriteHeader(http.StatusMethodNotAllowed)
			}
			return
		}
		if len(parts) == 2 && parts[1] == "cancel" {
			if r.Method == http.MethodPost {
				billingHandler.CancelInvoice(w, r)
			} else {
				w.WriteHeader(http.StatusMethodNotAllowed)
			}
			return
		}

		switch r.Method {
		case http.MethodGet:
			billingHandler.GetInvoice(w, r)
		default:
			w.WriteHeader(http.StatusMethodNotAllowed)
		}
	})))

	// Payments
	mux.Handle("/api/v1/billing/payments", requireAuth(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		switch r.Method {
		case http.MethodGet:
			billingHandler.ListPayments(w, r)
		case http.MethodPost:
			billingHandler.RecordPayment(w, r)
		default:
			w.WriteHeader(http.StatusMethodNotAllowed)
		}
	})))
	mux.Handle("/api/v1/billing/payments/", requireAuth(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		path := strings.TrimPrefix(r.URL.Path, "/api/v1/billing/payments/")
		if path == "" {
			w.WriteHeader(http.StatusBadRequest)
			return
		}
		r = setPathParam(r, "id", path)
		switch r.Method {
		case http.MethodGet:
			billingHandler.GetPayment(w, r)
		case http.MethodDelete:
			billingHandler.DeletePayment(w, r)
		default:
			w.WriteHeader(http.StatusMethodNotAllowed)
		}
	})))

	// Billing Summary
	mux.Handle("/api/v1/billing/summary", requireAuth(methodHandler("GET", billingHandler.GetBillingSummary)))

	// Payment Matrix (12-month view)
	mux.Handle("/api/v1/billing/payment-matrix", requireAuth(methodHandler("GET", billingHandler.GetPaymentMatrix)))

	// Revenue Analytics
	mux.Handle("/api/v1/billing/revenue-analytics", requireAuth(methodHandler("GET", billingHandler.GetRevenueAnalytics)))

	// Settlements
	mux.Handle("/api/v1/billing/settlements", requireAuth(methodHandler("GET", billingHandler.GetSettlements)))
	mux.Handle("/api/v1/billing/settlements/verify", requireAuth(methodHandler("POST", billingHandler.VerifySettlement)))

	// New Finance Management Routes
	mux.Handle("/api/v1/finance/summary", requireAuth(methodHandler("GET", financeHandler.GetSummary)))
	mux.Handle("/api/v1/finance/trend", requireAuth(methodHandler("GET", financeHandler.GetTrend)))
	mux.Handle("/api/v1/finance/balance", requireAuth(methodHandler("GET", financeHandler.GetBalance)))
	mux.Handle("/api/v1/finance/transactions", requireAuth(methodHandler("GET", financeHandler.ListTransactions)))

	// Tempo Templates (tenant-scoped, RBAC: billing.view/list, billing.update for mutations)
	mux.Handle("/api/v1/billing/tempo-templates", requireAuth(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		switch r.Method {
		case http.MethodGet:
			requireCapability(rbac.CapBillingView)(http.HandlerFunc(tempoTemplateHandler.List)).ServeHTTP(w, r)
		case http.MethodPost:
			requireCapability(rbac.CapBillingUpdate)(http.HandlerFunc(tempoTemplateHandler.Create)).ServeHTTP(w, r)
		default:
			w.WriteHeader(http.StatusMethodNotAllowed)
		}
	})))
	mux.Handle("/api/v1/billing/tempo-templates/", requireAuth(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		path := strings.TrimPrefix(r.URL.Path, "/api/v1/billing/tempo-templates/")
		if path == "" {
			w.WriteHeader(http.StatusBadRequest)
			return
		}
		r = setPathParam(r, "id", path)
		switch r.Method {
		case http.MethodPut:
			requireCapability(rbac.CapBillingUpdate)(http.HandlerFunc(tempoTemplateHandler.Update)).ServeHTTP(w, r)
		case http.MethodDelete:
			requireCapability(rbac.CapBillingUpdate)(http.HandlerFunc(tempoTemplateHandler.Delete)).ServeHTTP(w, r)
		default:
			w.WriteHeader(http.StatusMethodNotAllowed)
		}
	})))

	// ============================================
	// Subscription routes (Tenant-scoped)
	// ============================================
	mux.Handle("/api/v1/subscription/invoices", requireAuth(methodHandler("GET", platformBillingHandler.GetMyInvoices)))
	mux.Handle("/api/v1/subscription/pay", requireAuth(methodHandler("POST", platformBillingHandler.SubmitPayment)))

	// ============================================
	// Inventory routes (Protected, tenant-scoped)
	// ============================================
	mux.Handle("/api/v1/inventory/summary", requireAuth(requireCapability(rbac.CapInventoryView)(http.HandlerFunc(inventoryHandler.GetGlobalSummary))))
	mux.Handle("/api/v1/inventory/assets", requireAuth(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		switch r.Method {
		case http.MethodGet:
			requireCapability(rbac.CapInventoryView)(http.HandlerFunc(inventoryHandler.ListAssets)).ServeHTTP(w, r)
		case http.MethodPost:
			requireCapability(rbac.CapInventoryManage)(http.HandlerFunc(inventoryHandler.CreateAsset)).ServeHTTP(w, r)
		default:
			w.WriteHeader(http.StatusMethodNotAllowed)
		}
	})))

	mux.Handle("/api/v1/inventory/assets/", requireAuth(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		path := strings.TrimPrefix(r.URL.Path, "/api/v1/inventory/assets/")
		parts := strings.Split(strings.Trim(path, "/"), "/")
		if len(parts) == 0 || parts[0] == "" {
			w.WriteHeader(http.StatusBadRequest)
			return
		}

		assetID := parts[0]
		r = setPathParam(r, "id", assetID)

		// Nested routes: /api/v1/inventory/assets/{id}/instances, /bulk-update
		if len(parts) >= 2 {
			r = setPathParam(r, "asset_id", assetID)
			action := parts[1]
			switch action {
			case "instances":
				if len(parts) == 2 {
					switch r.Method {
					case http.MethodGet:
						requireCapability(rbac.CapInventoryView)(http.HandlerFunc(inventoryHandler.ListInstances)).ServeHTTP(w, r)
					case http.MethodPost:
						requireCapability(rbac.CapInventoryManage)(http.HandlerFunc(inventoryHandler.AddInstance)).ServeHTTP(w, r)
					default:
						w.WriteHeader(http.StatusMethodNotAllowed)
					}
					return
				}
				if len(parts) == 3 {
					r = setPathParam(r, "id", parts[2])
					if r.Method == http.MethodPut {
						requireCapability(rbac.CapInventoryManage)(http.HandlerFunc(inventoryHandler.UpdateInstance)).ServeHTTP(w, r)
						return
					}
				}
			case "bulk-update":
				if r.Method == http.MethodPost {
					requireCapability(rbac.CapInventoryManage)(http.HandlerFunc(inventoryHandler.BulkUpdate)).ServeHTTP(w, r)
					return
				}
			}
			w.WriteHeader(http.StatusMethodNotAllowed)
			return
		}

		// GET or DELETE asset
		switch r.Method {
		case http.MethodGet:
			requireCapability(rbac.CapInventoryView)(http.HandlerFunc(inventoryHandler.GetAsset)).ServeHTTP(w, r)
		case http.MethodDelete:
			requireCapability(rbac.CapInventoryManage)(http.HandlerFunc(inventoryHandler.DeleteAsset)).ServeHTTP(w, r)
		default:
			w.WriteHeader(http.StatusMethodNotAllowed)
		}
	})))

	mux.Handle("/api/v1/inventory/history", requireAuth(requireCapability(rbac.CapInventoryView)(methodHandler("GET", inventoryHandler.GetHistory))))

	// ============================================
	// Expense routes (Protected, tenant-scoped)
	// ============================================
	// Handle exact path /expenses
	mux.Handle("/api/v1/finance/expenses", requireAuth(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		switch r.Method {
		case http.MethodGet:
			requireCapability(rbac.CapBillingView)(http.HandlerFunc(expenseHandler.List)).ServeHTTP(w, r)
		case http.MethodPost:
			requireCapability(rbac.CapBillingUpdate)(http.HandlerFunc(expenseHandler.Create)).ServeHTTP(w, r)
		default:
			w.WriteHeader(http.StatusMethodNotAllowed)
		}
	})))

	// Handle /expenses/ and sub-routes (ID-based)
	mux.Handle("/api/v1/finance/expenses/", requireAuth(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		path := strings.TrimPrefix(r.URL.Path, "/api/v1/finance/expenses/")

		// If path is empty (root of expenses via trailing slash), handle same as above
		if path == "" {
			switch r.Method {
			case http.MethodGet:
				requireCapability(rbac.CapBillingView)(http.HandlerFunc(expenseHandler.List)).ServeHTTP(w, r)
			case http.MethodPost:
				requireCapability(rbac.CapBillingUpdate)(http.HandlerFunc(expenseHandler.Create)).ServeHTTP(w, r)
			default:
				w.WriteHeader(http.StatusMethodNotAllowed)
			}
			return
		}

		parts := strings.Split(strings.Trim(path, "/"), "/")
		expenseID := parts[0]
		r = setPathParam(r, "id", expenseID)

		// Handle nested routes like /expenses/{id}/pay
		if len(parts) == 2 && parts[1] == "pay" {
			if r.Method == http.MethodPost {
				requireCapability(rbac.CapBillingUpdate)(http.HandlerFunc(expenseHandler.MarkAsPaid)).ServeHTTP(w, r)
				return
			}
			w.WriteHeader(http.StatusMethodNotAllowed)
			return
		}

		// Handle single expense operations
		if len(parts) == 1 {
			switch r.Method {
			case http.MethodDelete:
				requireCapability(rbac.CapBillingUpdate)(http.HandlerFunc(expenseHandler.Delete)).ServeHTTP(w, r)
			default:
				w.WriteHeader(http.StatusMethodNotAllowed)
			}
			return
		}

		w.WriteHeader(http.StatusNotFound)
	})))

	// Payment Methods routes
	// Handle exact path /payment-methods
	mux.Handle("/api/v1/finance/payment-methods", requireAuth(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		switch r.Method {
		case http.MethodGet:
			requireCapability(rbac.CapBillingView)(http.HandlerFunc(paymentMethodHandler.List)).ServeHTTP(w, r)
		case http.MethodPost:
			requireCapability(rbac.CapBillingUpdate)(http.HandlerFunc(paymentMethodHandler.Create)).ServeHTTP(w, r)
		default:
			w.WriteHeader(http.StatusMethodNotAllowed)
		}
	})))

	// Handle /payment-methods/ and sub-routes
	mux.Handle("/api/v1/finance/payment-methods/", requireAuth(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		path := strings.TrimPrefix(r.URL.Path, "/api/v1/finance/payment-methods/")

		// If path is empty (root), handle List/Create
		if path == "" || strings.Trim(path, "/") == "" {
			switch r.Method {
			case http.MethodGet:
				requireCapability(rbac.CapBillingView)(http.HandlerFunc(paymentMethodHandler.List)).ServeHTTP(w, r)
			case http.MethodPost:
				requireCapability(rbac.CapBillingUpdate)(http.HandlerFunc(paymentMethodHandler.Create)).ServeHTTP(w, r)
			default:
				w.WriteHeader(http.StatusMethodNotAllowed)
			}
			return
		}

		r = setPathParam(r, "id", strings.TrimSuffix(path, "/"))
		switch r.Method {
		case http.MethodPut:
			requireCapability(rbac.CapBillingUpdate)(http.HandlerFunc(paymentMethodHandler.Update)).ServeHTTP(w, r)
		case http.MethodDelete:
			requireCapability(rbac.CapBillingUpdate)(http.HandlerFunc(paymentMethodHandler.Delete)).ServeHTTP(w, r)
		default:
			w.WriteHeader(http.StatusMethodNotAllowed)
		}
	})))

	// ============================================
	// Super Admin Billing routes
	// ============================================
	mux.Handle("/api/v1/superadmin/billing/invoices", requireSuperAdmin(methodHandler("GET", platformBillingHandler.ListAllInvoices)))
	mux.Handle("/api/v1/superadmin/billing/payments", requireSuperAdmin(methodHandler("GET", platformBillingHandler.ListAllPayments)))
	mux.Handle("/api/v1/superadmin/billing/payments/", requireSuperAdmin(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		path := strings.TrimPrefix(r.URL.Path, "/api/v1/superadmin/billing/payments/")
		if path == "" {
			w.WriteHeader(http.StatusBadRequest)
			return
		}
		path = strings.TrimSuffix(path, "/")
		parts := strings.Split(path, "/")

		if len(parts) == 2 && parts[1] == "verify" {
			r = setPathParam(r, "id", parts[0])
			if r.Method == http.MethodPost {
				platformBillingHandler.VerifyPayment(w, r)
				return
			}
		}
		w.WriteHeader(http.StatusNotFound)
	})))
	mux.Handle("/api/v1/superadmin/billing/generate", requireSuperAdmin(methodHandler("POST", platformBillingHandler.GenerateInvoices)))

	// Platform Discounts (Coupons)
	mux.Handle("/api/v1/superadmin/billing/discounts", requireSuperAdmin(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		log.Printf("[router] /superadmin/billing/discounts hit: %s", r.Method)
		switch r.Method {
		case http.MethodGet:
			platformDiscountHandler.List(w, r)
		case http.MethodPost:
			platformDiscountHandler.Create(w, r)
		default:
			log.Printf("[router] /superadmin/billing/discounts method not allowed: %s", r.Method)
			w.WriteHeader(http.StatusMethodNotAllowed)
		}
	})))
	mux.Handle("/api/v1/superadmin/billing/discounts/", requireSuperAdmin(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		path := strings.TrimPrefix(r.URL.Path, "/api/v1/superadmin/billing/discounts/")
		idStr := strings.TrimSuffix(path, "/")
		log.Printf("[router] /superadmin/billing/discounts/ subtree hit: %s path=%s id=%s", r.Method, path, idStr)

		if idStr == "" {
			// Subtree hit with no ID usually means trailing slash /discounts/
			switch r.Method {
			case http.MethodGet:
				platformDiscountHandler.List(w, r)
			case http.MethodPost:
				platformDiscountHandler.Create(w, r)
			default:
				log.Printf("[router] /superadmin/billing/discounts/ subtree no-id method not allowed: %s", r.Method)
				w.WriteHeader(http.StatusMethodNotAllowed)
			}
			return
		}

		r = setPathParam(r, "id", idStr)
		switch r.Method {
		case http.MethodGet:
			platformDiscountHandler.GetByID(w, r)
		case http.MethodPut:
			platformDiscountHandler.Update(w, r)
		case http.MethodDelete:
			platformDiscountHandler.Delete(w, r)
		default:
			log.Printf("[router] /superadmin/billing/discounts/ subtree id method not allowed: %s", r.Method)
			w.WriteHeader(http.StatusMethodNotAllowed)
		}
	})))

	// ============================================
	// Payment Methods Routes (Super Admin only)
	// ============================================
	mux.Handle("/api/v1/superadmin/payment-methods", requireSuperAdmin(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		switch r.Method {
		case http.MethodGet:
			paymentMethodHandler.ListPaymentMethods(w, r)
		case http.MethodPost:
			paymentMethodHandler.CreatePaymentMethod(w, r)
		default:
			w.WriteHeader(http.StatusMethodNotAllowed)
		}
	})))

	mux.Handle("/api/v1/superadmin/payment-methods/", requireSuperAdmin(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		path := strings.TrimPrefix(r.URL.Path, "/api/v1/superadmin/payment-methods/")
		if path == "" {
			w.WriteHeader(http.StatusNotFound)
			return
		}

		// /{id}/toggle
		if strings.HasSuffix(path, "/toggle") {
			if r.Method == http.MethodPatch {
				idStr := strings.TrimSuffix(path, "/toggle")
				idStr = strings.TrimSuffix(idStr, "/")
				r = setPathParam(r, "id", idStr)
				paymentMethodHandler.TogglePaymentMethodStatus(w, r)
				return
			}
		}

		// /{id}
		idStr := strings.TrimSuffix(path, "/")
		r = setPathParam(r, "id", idStr)

		switch r.Method {
		case http.MethodGet:
			paymentMethodHandler.GetPaymentMethod(w, r)
		case http.MethodPut:
			paymentMethodHandler.UpdatePaymentMethod(w, r)
		case http.MethodDelete:
			paymentMethodHandler.DeletePaymentMethod(w, r)
		default:
			w.WriteHeader(http.StatusMethodNotAllowed)
		}
	})))

	// ============================================
	// API Root (must be last to avoid catching all /api/v1/* routes)
	// ============================================
	mux.HandleFunc("/api/v1/", method("GET", handleAPIRoot))

	// ============================================
	// Apply global middlewares
	// Order matters! Applied bottom-to-top (last applied runs first)
	// ============================================
	var finalHandler http.Handler = mux

	// 9. TenantContext - Extract tenant from subdomain
	finalHandler = middleware.TenantContext(tenantRepo)(finalHandler)

	// 8. Rate Limiting - Per-tenant and per-IP rate limiting
	// Configure rate limits (default: 300 requests per minute for rich UI)
	defaultLimit := 300
	defaultWindow := 1 * time.Minute
	rateLimiter := middleware.NewRateLimiter(deps.Redis, defaultLimit, defaultWindow)

	// Set stricter limits for auth endpoints
	rateLimiter.SetEndpointLimit("/api/v1/auth/login", 60, 1*time.Minute)
	rateLimiter.SetEndpointLimit("/api/v1/auth/register", 10, 1*time.Minute)
	rateLimiter.SetEndpointLimit("/api/v1/auth/refresh", 30, 1*time.Minute)

	// WhatsApp gateway UI polls status/qr; allow higher throughput for these endpoints
	// (still scoped by tenant/user/ip via RateLimiter.getClientIdentifier)
	rateLimiter.SetEndpointLimit("/api/v1/wa-gateway/", 600, 1*time.Minute)
	// Keep connect endpoint lower to avoid accidental spam
	rateLimiter.SetEndpointLimit("/api/v1/wa-gateway/connect", 30, 1*time.Minute)
	rateLimiter.SetEndpointLimit("/api/v1/wa-gateway/connect/", 30, 1*time.Minute)

	finalHandler = rateLimiter.RateLimitMiddleware(finalHandler)

	// 7. CSRF Protection - Protect state-changing operations
	csrfProtection := middleware.DefaultCSRFProtection()
	finalHandler = csrfProtection.CSRFMiddleware(finalHandler)

	// 6. RequestLogger - Log all requests
	finalHandler = middleware.RequestLogger(finalHandler)

	// 5. RequestID - Inject unique request ID
	finalHandler = middleware.RequestID(finalHandler)

	// 4. Input Validation - Validate request input with configurable limits
	requestSizeLimits := middleware.NewRequestSizeLimits(
		deps.Config.Server.MaxRequestSize,
		deps.Config.Server.MaxJSONSize,
		deps.Config.Server.MaxMultipartSize,
	)
	finalHandler = middleware.InputValidationMiddleware(requestSizeLimits)(finalHandler)

	// 3. CORS - Handle cross-origin requests
	corsConfig := middleware.DefaultCORSConfig()
	finalHandler = middleware.CORS(corsConfig)(finalHandler)

	// 2. Security Headers - Add security headers to all responses
	finalHandler = middleware.SecurityHeaders(finalHandler)

	// 1. RecoverPanic - Must be outermost to catch all panics
	finalHandler = middleware.RecoverPanic(finalHandler)

	return finalHandler
}

// handleHealth returns the health check handler
func handleHealth(deps Dependencies) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		status := health.Check(r.Context(), deps.DB, deps.Redis)

		w.Header().Set("Content-Type", "application/json")
		if status.Status != "healthy" {
			w.WriteHeader(http.StatusServiceUnavailable)
		}

		_ = json.NewEncoder(w).Encode(status)
	}
}

// handleVersion returns the version info handler
func handleVersion(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(version.Get())
}

// handleMetrics returns the Prometheus metrics handler
func handleMetrics(w http.ResponseWriter, r *http.Request) {
	metrics.Handler().ServeHTTP(w, r)
}

// handleAPIRoot returns the API root handler
func handleAPIRoot(w http.ResponseWriter, r *http.Request) {
	log.Debug().Str("method", r.Method).Str("url", r.URL.String()).Msg("API Root hit")
	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(map[string]string{
		"message": "RRNET API v1",
		"status":  "ready",
	})
}

// method wraps a handler func to enforce HTTP method.
func method(expected string, fn http.HandlerFunc) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if r.Method != expected {
			w.WriteHeader(http.StatusMethodNotAllowed)
			return
		}
		fn(w, r)
	}
}

// methodHandler adapts to http.Handler
func methodHandler(expected string, fn http.HandlerFunc) http.Handler {
	return http.HandlerFunc(method(expected, fn))
}

// handleTenantMe returns the current tenant info handler
func handleTenantMe(tenantRepo *repository.TenantRepository) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		// Get tenant ID from auth context
		tenantID, ok := auth.GetTenantID(r.Context())
		if !ok || tenantID == (uuid.UUID{}) {
			w.Header().Set("Content-Type", "application/json")
			w.WriteHeader(http.StatusBadRequest)
			_ = json.NewEncoder(w).Encode(map[string]string{
				"error": "No tenant context",
			})
			return
		}

		tenant, err := tenantRepo.GetByID(r.Context(), tenantID)
		if err != nil {
			w.Header().Set("Content-Type", "application/json")
			w.WriteHeader(http.StatusNotFound)
			_ = json.NewEncoder(w).Encode(map[string]string{
				"error": "Tenant not found",
			})
			return
		}

		w.Header().Set("Content-Type", "application/json")
		_ = json.NewEncoder(w).Encode(map[string]interface{}{
			"id":             tenant.ID,
			"name":           tenant.Name,
			"slug":           tenant.Slug,
			"status":         tenant.Status,
			"billing_status": tenant.BillingStatus,
		})
	}
}

// setPathParam sets a path parameter in the request context
func setPathParam(r *http.Request, key, value string) *http.Request {
	params, ok := r.Context().Value(handler.PathParamsKey).(map[string]string)
	if !ok || params == nil {
		params = make(map[string]string)
	}
	params[key] = value
	ctx := context.WithValue(r.Context(), handler.PathParamsKey, params)
	return r.WithContext(ctx)
}
