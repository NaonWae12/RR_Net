'use client';

import React from 'react';
import { LimitMap, ClientStats } from '@/lib/api/dashboardService';

interface LimitsCardProps {
  limits: LimitMap;
  clientStats?: ClientStats;
  className?: string;
}

const limitLabels: Record<string, string> = {
  max_routers: 'Routers',
  max_users: 'Users',
  max_vouchers: 'Vouchers',
  max_odc: 'ODC',
  max_odp: 'ODP',
  max_clients: 'Clients',
  wa_quota_monthly: 'WA Quota',
};

export function LimitsCard({ limits, clientStats, className = '' }: LimitsCardProps) {
  const getLimitDisplay = (key: string, value: number, current?: number) => {
    const isUnlimited = value === -1;
    const percentage = isUnlimited || current === undefined ? 100 : Math.min((current / value) * 100, 100);
    const isNearLimit = !isUnlimited && current !== undefined && percentage >= 80;
    const isOverLimit = !isUnlimited && current !== undefined && percentage >= 100;

    return {
      display: isUnlimited ? 'Unlimited' : `${current !== undefined ? current : 0} / ${value}`,
      percentage,
      isNearLimit,
      isOverLimit,
      isUnlimited,
    };
  };

  return (
    <div className={`rounded-xl border border-slate-200 bg-white p-6 shadow-sm ${className}`}>
      <h3 className="text-lg font-semibold text-slate-900 mb-4">Resource Limits</h3>
      
      <div className="space-y-4">
        {Object.entries(limits).map(([key, value]) => {
          const current = key === 'max_clients' && clientStats ? clientStats.total : undefined;
          const { display, percentage, isNearLimit, isOverLimit, isUnlimited } = getLimitDisplay(key, value, current);

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
                  className={`h-full rounded-full transition-all ${
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


