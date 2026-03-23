'use client';

import React, { useEffect, useState } from 'react';
import { AlertTriangle, X } from 'lucide-react';
import { dashboardService, DashboardData } from '@/lib/api/dashboardService';
import { useAuth } from '@/lib/hooks/useAuth';

interface LimitWarningBannerProps {
  resource: 'vouchers' | 'routers' | 'clients';
  className?: string;
}

export function LimitWarningBanner({ resource, className = '' }: LimitWarningBannerProps) {
  const { isAuthenticated } = useAuth();
  const [usage, setUsage] = useState<{ used: number; limit: number } | null>(null);
  const [isVisible, setIsVisible] = useState(true);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!isAuthenticated) return;

    const fetchUsage = async () => {
      try {
        setLoading(true);
        const data: DashboardData = await dashboardService.getDashboardData();
        if (data.resourceUsage && data.resourceUsage[resource]) {
          setUsage(data.resourceUsage[resource]);
        }
      } catch (err) {
        console.error('Failed to fetch resource usage for warning banner', err);
      } finally {
        setLoading(false);
      }
    };

    fetchUsage();
  }, [isAuthenticated, resource]);

  if (!isVisible || !usage || usage.limit === -1) return null;

  const percentage = (usage.used / usage.limit) * 100;
  const isFull = usage.used >= usage.limit;
  const isNear = percentage >= 80;

  if (!isFull && !isNear) return null;

  return (
    <div className={`relative overflow-hidden rounded-lg border ${
      isFull ? 'bg-red-50 border-red-200 text-red-800' : 'bg-amber-50 border-amber-200 text-amber-800'
    } p-4 mb-6 shadow-sm ${className}`}>
      <div className="flex items-start gap-3">
        <div className={`mt-0.5 rounded-full p-1 ${isFull ? 'bg-red-100' : 'bg-amber-100'}`}>
          <AlertTriangle className="h-4 w-4" />
        </div>
        <div className="flex-1">
          <h4 className="text-sm font-bold uppercase tracking-tight">
            Voucher Limit {isFull ? 'Reached' : 'Near Limit'}
          </h4>
          <p className="mt-1 text-sm opacity-90 leading-relaxed">
            {isFull 
              ? `You have reached the maximum limit of ${usage.limit} vouchers for your current plan. Vouchers cannot be generated until the limit recovers (old vouchers expire or are deleted).`
              : `You are using ${usage.used} out of ${usage.limit} vouchers. Consider deleting or letting old vouchers expire to free up space.`
            }
          </p>
        </div>
        <button 
          onClick={() => setIsVisible(false)}
          className="rounded-full p-1 hover:bg-black/5 transition-colors"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
      
      {/* Progress mini-bar */}
      <div className="absolute bottom-0 left-0 h-1 bg-black/5 w-full">
        <div 
          className={`h-full transition-all duration-1000 ${isFull ? 'bg-red-500' : 'bg-amber-500'}`}
          style={{ width: `${Math.min(percentage, 100)}%` }}
        />
      </div>
    </div>
  );
}
