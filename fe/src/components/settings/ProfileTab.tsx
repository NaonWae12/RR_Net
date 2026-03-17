"use client";

import React from "react";
import { useAuth } from "@/lib/hooks/useAuth";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { User, Mail, Phone, ShieldCheck } from "lucide-react";

export function ProfileTab() {
  const { user } = useAuth();

  if (!user) return null;

  return (
    <div className="space-y-6">
      <Card className="border-none shadow-none bg-transparent">
        <CardHeader className="px-0 pt-0">
          <CardTitle className="text-xl">Profile Information</CardTitle>
          <CardDescription>
            Your personal details and account status.
          </CardDescription>
        </CardHeader>
        <CardContent className="px-0 space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <Label htmlFor="name" className="text-slate-500">Full Name</Label>
              <div className="relative">
                <User className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                <Input
                  id="name"
                  value={user.name}
                  readOnly
                  className="pl-10 bg-slate-50 border-slate-200 cursor-default"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="email" className="text-slate-500">Email Address</Label>
              <div className="relative">
                <Mail className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                <Input
                  id="email"
                  value={user.email}
                  readOnly
                  className="pl-10 bg-slate-50 border-slate-200 cursor-default"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="phone" className="text-slate-500">WhatsApp Number</Label>
              <div className="relative">
                <Phone className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                <Input
                  id="phone"
                  value={user.phone || "-"}
                  readOnly
                  className="pl-10 bg-slate-50 border-slate-200 cursor-default"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label className="text-slate-500">Role</Label>
              <div className="flex items-center gap-2 pt-1">
                <Badge variant="outline" className="bg-indigo-50 text-indigo-700 border-indigo-200 capitalize py-1 px-3">
                  <ShieldCheck className="w-3 h-3 mr-1" />
                  {user.role}
                </Badge>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
