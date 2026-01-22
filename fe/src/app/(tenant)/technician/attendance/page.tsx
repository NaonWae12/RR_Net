"use client";

import { useEffect, useState } from "react";
import { useRole } from "@/lib/hooks/useRole";
import { RoleGuard } from "@/components/guards/RoleGuard";
import { AttendanceCheckIn } from "@/components/technician/AttendanceCheckIn";
import { AttendanceCalendar } from "@/components/technician/AttendanceCalendar";
import { technicianService } from "@/lib/api/technicianService";
import { Attendance, CheckInRequest, CheckOutRequest } from "@/lib/api/types";
import { useNotificationStore } from "@/stores/notificationStore";
import { LoadingSpinner } from "@/components/utilities/LoadingSpinner";
import { format, startOfMonth, endOfMonth } from "date-fns";
import { Button } from "@/components/ui/button";
import { ChevronLeftIcon, ChevronRightIcon } from "@heroicons/react/20/solid";
import { useAuth } from "@/lib/hooks/useAuth";

export default function AttendancePage() {
    const { userId } = useRole();
    const { showToast } = useNotificationStore();
    const { isAuthenticated } = useAuth();
    const [todayAttendance, setTodayAttendance] = useState<Attendance | null>(null);
    const [attendances, setAttendances] = useState<Attendance[]>([]);
    const [currentMonth, setCurrentMonth] = useState<Date>(startOfMonth(new Date()));
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const fetchTodayAttendance = async () => {
        if (!userId || !isAuthenticated) return;
        try {
            setLoading(true);
            setError(null);
            const attendance = await technicianService.getTodayAttendance(userId);
            setTodayAttendance(attendance);
        } catch (err: any) {
            setError(err?.message || "Failed to load today's attendance");
        } finally {
            setLoading(false);
        }
    };

    const fetchMonthAttendances = async () => {
        if (!userId || !isAuthenticated) return;
        try {
            const startDate = format(startOfMonth(currentMonth), "yyyy-MM-dd");
            const endDate = format(endOfMonth(currentMonth), "yyyy-MM-dd");
            const data = await technicianService.getAttendanceList(userId, startDate, endDate);
            setAttendances(data);
        } catch (err: any) {
            console.error("Failed to load attendances:", err);
        }
    };

    useEffect(() => {
        fetchTodayAttendance();
    }, [userId, isAuthenticated]);

    useEffect(() => {
        fetchMonthAttendances();
    }, [userId, currentMonth, isAuthenticated]);

    const handleCheckIn = async (data: CheckInRequest) => {
        try {
            const attendance = await technicianService.checkIn(data);
            setTodayAttendance(attendance);
            await fetchMonthAttendances();
        } catch (err: any) {
            throw err;
        }
    };

    const handleCheckOut = async (data: CheckOutRequest) => {
        try {
            const attendance = await technicianService.checkOut(data);
            setTodayAttendance(attendance);
            await fetchMonthAttendances();
        } catch (err: any) {
            throw err;
        }
    };

    const handlePreviousMonth = () => {
        setCurrentMonth((prev) => {
            const newDate = new Date(prev);
            newDate.setMonth(prev.getMonth() - 1);
            return startOfMonth(newDate);
        });
    };

    const handleNextMonth = () => {
        setCurrentMonth((prev) => {
            const newDate = new Date(prev);
            newDate.setMonth(prev.getMonth() + 1);
            return startOfMonth(newDate);
        });
    };

    if (error && !todayAttendance) {
        return (
            <RoleGuard allowedRoles={["admin", "technician"]} redirectTo="/dashboard">
                <div className="p-6">
                    <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
                        {error}
                    </div>
                </div>
            </RoleGuard>
        );
    }

    return (
        <RoleGuard allowedRoles={["admin", "technician"]} redirectTo="/dashboard">
            <div className="p-6 space-y-6">
                <h1 className="text-2xl font-bold text-slate-900">Attendance</h1>

                {/* Check In/Out Card */}
                <AttendanceCheckIn
                    attendance={todayAttendance}
                    onCheckIn={handleCheckIn}
                    onCheckOut={handleCheckOut}
                    loading={loading}
                />

                {/* Calendar */}
                <div className="space-y-4">
                    <div className="flex items-center justify-between">
                        <h2 className="text-lg font-semibold text-slate-900">Monthly Calendar</h2>
                        <div className="flex items-center gap-2">
                            <Button variant="outline" size="sm" onClick={handlePreviousMonth}>
                                <ChevronLeftIcon className="h-4 w-4" />
                            </Button>
                            <Button variant="outline" size="sm" onClick={handleNextMonth}>
                                <ChevronRightIcon className="h-4 w-4" />
                            </Button>
                        </div>
                    </div>
                    <AttendanceCalendar
                        attendances={attendances}
                        currentMonth={currentMonth}
                        onDateClick={(date) => {
                            // Could show detail modal for selected date
                            console.log("Selected date:", date);
                        }}
                    />
                </div>
            </div>
        </RoleGuard>
    );
}

