"use client";

import React from "react";
import { TimeOff } from "@/lib/api/types";
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameDay, parseISO, isWithinInterval } from "date-fns";

interface TimeOffCalendarProps {
  timeOffs: TimeOff[];
  currentMonth: Date;
  onDateClick?: (date: Date) => void;
}

export function TimeOffCalendar({
  timeOffs,
  currentMonth,
  onDateClick,
}: TimeOffCalendarProps) {
  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(currentMonth);
  const daysInMonth = eachDayOfInterval({ start: monthStart, end: monthEnd });

  const getTimeOffForDate = (date: Date): TimeOff | undefined => {
    return timeOffs.find((to) => {
      const start = parseISO(to.start_date);
      const end = parseISO(to.end_date);
      return isWithinInterval(date, { start, end });
    });
  };

  const getStatusColor = (timeOff: TimeOff | undefined): string => {
    if (!timeOff) return "bg-slate-100 border-slate-300";
    switch (timeOff.status) {
      case "approved":
        return "bg-green-100 border-green-300";
      case "rejected":
        return "bg-red-100 border-red-300";
      case "pending_approval":
        return "bg-yellow-100 border-yellow-300";
      default:
        return "bg-slate-100 border-slate-300";
    }
  };

  const getTypeLabel = (timeOff: TimeOff | undefined): string => {
    if (!timeOff) return "";
    switch (timeOff.type) {
      case "sick":
        return "S";
      case "leave":
        return "L";
      case "emergency":
        return "E";
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
          const timeOff = getTimeOffForDate(day);
          const isToday = isSameDay(day, new Date());
          const colorClass = getStatusColor(timeOff);
          const typeLabel = getTypeLabel(timeOff);

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
                {typeLabel && (
                  <span className="text-xs mt-0.5 font-semibold text-slate-700">{typeLabel}</span>
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
          <span className="text-slate-700">Approved</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 rounded border-2 bg-yellow-100 border-yellow-300" />
          <span className="text-slate-700">Pending</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 rounded border-2 bg-red-100 border-red-300" />
          <span className="text-slate-700">Rejected</span>
        </div>
        <div className="flex items-center gap-2 ml-4">
          <span className="font-medium text-slate-700">L</span> = <span className="text-slate-700">Leave <span className="text-xs text-slate-500">(Cuti)</span></span>, <span className="font-medium text-slate-700">S</span> = <span className="text-slate-700">Sick</span>,{" "}
          <span className="font-medium text-slate-700">E</span> = <span className="text-slate-700">Emergency</span>
        </div>
      </div>
    </div>
  );
}


