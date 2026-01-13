'use client';

import React from 'react';
import { FeatureMap } from '@/lib/api/dashboardService';

interface FeaturesCardProps {
  features: FeatureMap;
  className?: string;
}

const featureLabels: Record<string, string> = {
  client_management: 'Client Management',
  billing_basic: 'Basic Billing',
  billing_full: 'Full Billing',
  radius_basic: 'Basic RADIUS',
  radius_full: 'Full RADIUS',
  mikrotik_api: 'MikroTik API',
  voucher_basic: 'Basic Vouchers',
  voucher_full: 'Full Vouchers',
  isolir_manual: 'Manual Isolir',
  isolir_auto: 'Auto Isolir',
  maps_basic: 'Basic Maps',
  maps_full: 'Full Maps',
  rbac_basic: 'Basic RBAC',
  rbac_full: 'Full RBAC',
  wa_gateway: 'WA Gateway',
  payment_gateway: 'Payment Gateway',
  hr_module: 'HR Module',
  collector_module: 'Collector Module',
  technician_module: 'Technician Module',
  custom_login_page: 'Custom Login',
  custom_domain: 'Custom Domain',
  reports_advanced: 'Advanced Reports',
  api_access: 'API Access',
  priority_support: 'Priority Support',
};

export function FeaturesCard({ features, className = '' }: FeaturesCardProps) {
  const enabledFeatures = Object.entries(features).filter(([_, enabled]) => enabled);
  const disabledFeatures = Object.entries(features).filter(([_, enabled]) => !enabled);

  return (
    <div className={`rounded-xl border border-slate-200 bg-white p-6 shadow-sm ${className}`}>
      <h3 className="text-lg font-semibold text-slate-900 mb-4">Features</h3>
      
      {enabledFeatures.length > 0 && (
        <div className="mb-4">
          <p className="text-sm font-medium text-slate-500 mb-2">Enabled</p>
          <div className="flex flex-wrap gap-2">
            {enabledFeatures.map(([key]) => (
              <span
                key={key}
                className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-3 py-1 text-xs font-medium text-emerald-700"
              >
                <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                </svg>
                {featureLabels[key] || key.replace(/_/g, ' ')}
              </span>
            ))}
          </div>
        </div>
      )}

      {disabledFeatures.length > 0 && (
        <div>
          <p className="text-sm font-medium text-slate-500 mb-2">Not Available</p>
          <div className="flex flex-wrap gap-2">
            {disabledFeatures.slice(0, 5).map(([key]) => (
              <span
                key={key}
                className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-500"
              >
                <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                </svg>
                {featureLabels[key] || key.replace(/_/g, ' ')}
              </span>
            ))}
            {disabledFeatures.length > 5 && (
              <span className="inline-flex items-center rounded-full bg-slate-50 px-3 py-1 text-xs font-medium text-slate-400">
                +{disabledFeatures.length - 5} more
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}


