'use client';

import React from 'react';
import { LimitMap, ClientStats, ResourceUsageStats } from '@/lib/api/dashboardService';

interface LimitsCardProps {
  limits: LimitMap;
  clientStats?: ClientStats;
  resourceUsage?: ResourceUsageStats;
  className?: string;
}

const limitLabels: Record<string, string> = {
  max_routers: 'Routers',
  max_vouchers: 'Vouchers',
  max_odc: 'ODC',
  max_odp: 'ODP',
  max_clients: 'Clients',
  wa_quota_monthly: 'WA Quota',
};

export function LimitsCard({ limits, clientStats, resourceUsage, className = '' }: LimitsCardProps) {
  const getLimitDisplay = (key: string, value: number) => {
    let current: number | undefined;
    
    // 1. Try new resourceUsage first
    if (resourceUsage) {
      if (key === 'max_routers') current = resourceUsage.routers.used;
      else if (key === 'max_vouchers') current = resourceUsage.vouchers.used;
      else if (key === 'max_clients') current = resourceUsage.clients.used;
    }
    
    // 2. Fallback to legacy clientStats for clients if resourceUsage is missing
    if (current === undefined && key === 'max_clients' && clientStats) {
      current = clientStats.total;
    }

    const isUnlimited = value === -1;
    const percentage = isUnlimited || current === undefined ? 0 : Math.min((current / value) * 100, 100);
    const isNearLimit = !isUnlimited && current !== undefined && percentage >= 80;
    const isOverLimit = !isUnlimited && current !== undefined && percentage >= 100;

    return {
      display: isUnlimited ? 'Unlimited' : `${current !== undefined ? current : 0} / ${value}`,
      percentage,
      isNearLimit,
      isOverLimit,
      isUnlimited,
      current,
    };
  };

  return (
    <div className={`rounded-xl border border-slate-200 bg-white p-6 shadow-sm ${className}`}>
      <h3 className="text-lg font-semibold text-slate-900 mb-4">Resource Limits</h3>
      
      <div className="space-y-4">
        {Object.entries(limits).map(([key, value]) => {
          const { display, percentage, isNearLimit, isOverLimit, isUnlimited, current } = getLimitDisplay(key, value);

          // Hide if both current usage and limit are 0
          if (value === 0 && (current === 0 || current === undefined)) {
            return null;
          }

          return (
            <div key={key}>
              <div className="flex items-center justify-between mb-1">
                <span className="text-sm font-medium text-slate-600">
                  {limitLabels[key] || key}
                </span>
                <span className={`text-sm font-semibold ${
                  isOverLimit ? 'text-red-600' : 
                  isNearLimit ? 'text-amber-600' : 
                  'text-slate-900'
                }`}>
                  {display}
                </span>
              </div>
              <div className="h-2 rounded-full bg-slate-100 overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all duration-500 ${
                    isUnlimited ? 'bg-emerald-500' :
                    isOverLimit ? 'bg-red-500' :
                    isNearLimit ? 'bg-amber-500' :
                    'bg-indigo-500'
                  }`}
                  style={{ width: `${isUnlimited ? 100 : percentage}%` }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}


