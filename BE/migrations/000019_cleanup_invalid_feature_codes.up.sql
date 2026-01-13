-- Migration: Cleanup invalid feature codes from plans.features JSONB column
-- This removes feature codes that don't exist in the FeatureCatalog

-- Valid feature codes from FeatureCatalog (as of migration creation)
-- Network: radius_basic, mikrotik_api_basic, mikrotik_control_panel_advanced
-- Communication: wa_gateway, wa_gateway_basic
-- Security: rbac_employee, rbac_client_reseller
-- Billing: payment_gateway, payment_reporting_advanced, dashboard_pendapatan
-- Network: isolir_manual, isolir_auto
-- Maps: odp_maps, client_maps
-- HCM: hcm_module
-- AI: ai_agent_client_wa
-- Customization: custom_login_page, custom_isolir_page
-- Addon: addon_router, addon_user_packs
-- Integration: api_integration_partial, api_integration_full
-- Special: * (wildcard for enterprise)

-- Create function to clean invalid feature codes
CREATE OR REPLACE FUNCTION cleanup_invalid_feature_codes(features_jsonb JSONB)
RETURNS JSONB AS $$
DECLARE
    valid_codes TEXT[] := ARRAY[
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
    ];
    cleaned JSONB;
    code_text TEXT;
BEGIN
    -- If features is null or not an array, return empty array
    IF features_jsonb IS NULL OR jsonb_typeof(features_jsonb) != 'array' THEN
        RETURN '[]'::JSONB;
    END IF;
    
    -- Build cleaned array with only valid codes
    cleaned := '[]'::JSONB;
    
    FOR code_text IN SELECT jsonb_array_elements_text(features_jsonb)
    LOOP
        -- Check if code exists in valid_codes array (including wildcard "*")
        IF code_text = ANY(valid_codes) THEN
            cleaned := cleaned || jsonb_build_array(code_text);
        END IF;
    END LOOP;
    
    RETURN cleaned;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Update all plans to remove invalid feature codes
UPDATE plans
SET features = cleanup_invalid_feature_codes(features),
    updated_at = NOW()
WHERE features != cleanup_invalid_feature_codes(features);

-- Drop the temporary function
DROP FUNCTION IF EXISTS cleanup_invalid_feature_codes(JSONB);

COMMENT ON COLUMN plans.features IS 'JSON array of feature codes included in plan. Only codes from FeatureCatalog are valid.';

