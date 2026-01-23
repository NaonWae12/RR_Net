"use client";

import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { UserGroupIcon } from "@heroicons/react/20/solid";

export function EmployeesTab() {
  const router = useRouter();

  return (
    <div className="space-y-6">
      <div className="bg-white border border-slate-200 rounded-lg p-6">
        <div className="text-center py-8">
          <UserGroupIcon className="w-16 h-16 text-slate-400 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-slate-900 mb-2">Employee Management</h3>
          <p className="text-slate-600 mb-4">
            Manage employees and user accounts. This feature is available in the Employees page.
          </p>
          <Button onClick={() => router.push("/employees")}>
            Go to Employees Page
          </Button>
        </div>
      </div>
    </div>
  );
}




