"use client";

import React from "react";
import { Attendance } from "@/lib/api/types";
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameDay, parseISO } from "date-fns";

interface AttendanceCalendarProps {
    attendances?: Attendance[];
    currentMonth: Date;
    onDateClick?: (date: Date) => void;
}

export function AttendanceCalendar({
    attendances = [],
    currentMonth,
    onDateClick,
}: AttendanceCalendarProps) {
    const monthStart = startOfMonth(currentMonth);
    const monthEnd = endOfMonth(currentMonth);
    const daysInMonth = eachDayOfInterval({ start: monthStart, end: monthEnd });

    const getAttendanceForDate = (date: Date): Attendance | undefined => {
        return attendances.find((att) => isSameDay(parseISO(att.date), date));
    };

    const getStatusColor = (attendance: Attendance | undefined): string => {
        if (!attendance) return "bg-slate-100 border-slate-300";
        switch (attendance.status) {
            case "checked_out":
                return "bg-green-100 border-green-300";
            case "checked_in":
                return "bg-yellow-100 border-yellow-300";
            case "on_leave":
                return "bg-blue-100 border-blue-300";
            case "absent":
                return "bg-red-100 border-red-300";
            default:
                return "bg-slate-100 border-slate-300";
        }
    };

    const getStatusLabel = (attendance: Attendance | undefined): string => {
        if (!attendance) return "";
        switch (attendance.status) {
            case "checked_out":
                return "✓";
            case "checked_in":
                return "⏳";
            case "on_leave":
                return "L";
            case "absent":
                return "✗";
            default:
                return "";
        }
    };

    return (
        <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-xl font-semibold text-slate-900 mb-4">
                {format(currentMonth, "MMMM yyyy")}
            </h2>

            {/* Calendar Grid */}
            <div className="grid grid-cols-7 gap-2">
                {/* Day Headers */}
                {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day) => (
                    <div key={day} className="text-center text-xs font-medium text-slate-500 py-2">
                        {day}
                    </div>
                ))}

                {/* Empty cells for days before month start */}
                {Array.from({ length: monthStart.getDay() }).map((_, idx) => (
                    <div key={`empty-${idx}`} className="h-10" />
                ))}

                {/* Days in month */}
                {daysInMonth.map((day) => {
                    const attendance = getAttendanceForDate(day);
                    const isToday = isSameDay(day, new Date());
                    const colorClass = getStatusColor(attendance);
                    const statusLabel = getStatusLabel(attendance);

                    return (
                        <button
                            key={day.toISOString()}
                            onClick={() => onDateClick?.(day)}
                            className={`
                h-10 rounded-md border-2 text-sm font-medium
                transition-colors hover:opacity-80
                ${colorClass}
                ${isToday ? "ring-2 ring-indigo-500 ring-offset-2" : ""}
              `}
                        >
                            <div className="flex flex-col items-center justify-center h-full">
                                <span className="text-slate-900 font-medium">{format(day, "d")}</span>
                                {statusLabel && (
                                    <span className="text-xs mt-0.5 font-semibold text-slate-700">{statusLabel}</span>
                                )}
                            </div>
                        </button>
                    );
                })}
            </div>

            {/* Legend */}
            <div className="mt-6 flex flex-wrap gap-4 text-xs">
                <div className="flex items-center gap-2">
                    <div className="w-4 h-4 rounded border-2 bg-green-100 border-green-300" />
                    <span className="text-slate-700">Present (Full Day)</span>
                </div>
                <div className="flex items-center gap-2">
                    <div className="w-4 h-4 rounded border-2 bg-yellow-100 border-yellow-300" />
                    <span className="text-slate-700">Present (Partial)</span>
                </div>
                <div className="flex items-center gap-2">
                    <div className="w-4 h-4 rounded border-2 bg-blue-100 border-blue-300" />
                    <span className="text-slate-700">On Leave <span className="text-xs text-slate-500">(Cuti)</span></span>
                </div>
                <div className="flex items-center gap-2">
                    <div className="w-4 h-4 rounded border-2 bg-red-100 border-red-300" />
                    <span className="text-slate-700">Absent</span>
                </div>
            </div>
        </div>
    );
}

