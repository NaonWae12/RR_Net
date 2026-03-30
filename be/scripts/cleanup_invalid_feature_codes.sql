-- Standalone script to cleanup invalid feature codes
-- Can be run manually for testing before running the migration
-- Usage: psql -d rrnet -f cleanup_invalid_feature_codes.sql

-- Show current invalid codes before cleanup
SELECT 
    id,
    code,
    name,
    features as current_features,
    (
        SELECT jsonb_agg(elem)
        FROM jsonb_array_elements_text(features) elem
        WHERE elem NOT IN (
            'radius_basic',
            'mikrotik_api_basic',
            'mikrotik_control_panel_advanced',
            'wa_gateway',
            'wa_gateway_basic',
            'rbac_employee',
            'rbac_client_reseller',
            'payment_gateway',
            'payment_reporting_advanced',
            'dashboard_pendapatan',
            'isolir_manual',
            'isolir_auto',
            'odp_maps',
            'client_maps',
            'hcm_module',
            'ai_agent_client_wa',
            'custom_login_page',
            'custom_isolir_page',
            'addon_router',
            'addon_user_packs',
            'api_integration_partial',
            'api_integration_full',
            '*'
        )
    ) as invalid_codes
FROM plans
WHERE EXISTS (
    SELECT 1
    FROM jsonb_array_elements_text(features) elem
    WHERE elem NOT IN (
        'radius_basic',
        'mikrotik_api_basic',
        'mikrotik_control_panel_advanced',
        'wa_gateway',
        'wa_gateway_basic',
        'rbac_employee',
        'rbac_client_reseller',
        'payment_gateway',
        'payment_reporting_advanced',
        'dashboard_pendapatan',
        'isolir_manual',
        'isolir_auto',
        'odp_maps',
        'client_maps',
        'hcm_module',
        'ai_agent_client_wa',
        'custom_login_page',
        'custom_isolir_page',
        'addon_router',
        'addon_user_packs',
        'api_integration_partial',
        'api_integration_full',
        '*'
    )
);

