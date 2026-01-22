'use client';

import React from 'react';
import { PlanInfo } from '@/lib/api/dashboardService';

interface PlanCardProps {
  plan: PlanInfo | null;
  className?: string;
}

export function PlanCard({ plan, className = '' }: PlanCardProps) {
  if (!plan) {
    return (
      <div className={`rounded-xl border border-slate-200 bg-white p-6 shadow-sm ${className}`}>
        <div className="text-center py-8">
          <p className="text-slate-500">No plan assigned</p>
          <p className="text-sm text-slate-400 mt-1">Contact administrator to assign a plan</p>
        </div>
      </div>
    );
  }

  const formatPrice = (price: number, currency: string) => {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: currency,
      minimumFractionDigits: 0,
    }).format(price);
  };

  return (
    <div className={`rounded-xl border border-slate-200 bg-linear-to-br from-indigo-500 to-purple-600 p-6 shadow-sm text-white ${className}`}>
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm font-medium text-indigo-100">Current Plan</p>
          <h3 className="mt-1 text-2xl font-bold">{plan.name}</h3>
          {plan.description && (
            <p className="mt-2 text-sm text-indigo-100">{plan.description}</p>
          )}
        </div>
        <div className="text-right">
          <p className="text-2xl font-bold">{formatPrice(plan.price_monthly, plan.currency)}</p>
          <p className="text-sm text-indigo-100">/month</p>
        </div>
      </div>

      <div className="mt-6">
        <p className="text-sm font-medium text-indigo-100 mb-3">Features Included</p>
        <div className="flex flex-wrap gap-2">
          {plan.features.slice(0, 6).map((feature) => (
            <span
              key={feature}
              className="inline-flex items-center rounded-full bg-white/20 px-3 py-1 text-xs font-medium"
            >
              {feature.replace(/_/g, ' ')}
            </span>
          ))}
          {plan.features.length > 6 && (
            <span className="inline-flex items-center rounded-full bg-white/10 px-3 py-1 text-xs font-medium">
              +{plan.features.length - 6} more
            </span>
          )}
        </div>
      </div>
    </div>
  );
}


