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

  const isStartDate = (date: Date, timeOff: TimeOff): boolean => {
    const start = parseISO(timeOff.start_date);
    return isSameDay(date, start);
  };

  const isEndDate = (date: Date, timeOff: TimeOff): boolean => {
    const end = parseISO(timeOff.end_date);
    return isSameDay(date, end);
  };

  const getStatusColor = (timeOff: TimeOff | undefined): string => {
    if (!timeOff) return "";
    
    switch (timeOff.status) {
      case "approved":
        return "bg-green-200 border-green-400";
      case "rejected":
        return "bg-red-200 border-red-400";
      case "pending_approval":
        return "bg-yellow-200 border-yellow-400";
      default:
        return "";
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
      <div className="grid grid-cols-7 gap-1">
        {/* Day Headers */}
        {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day) => (
          <div key={day} className="text-center text-xs font-medium text-slate-500 py-2">
            {day}
          </div>
        ))}

        {/* Empty cells for days before month start */}
        {Array.from({ length: monthStart.getDay() }).map((_, idx) => (
          <div key={`empty-${idx}`} className="h-12" />
        ))}

        {/* Days in month */}
        {daysInMonth.map((day) => {
          const timeOff = getTimeOffForDate(day);
          const isToday = isSameDay(day, new Date());
          const isStart = timeOff ? isStartDate(day, timeOff) : false;
          const isEnd = timeOff ? isEndDate(day, timeOff) : false;
          const colorClass = getStatusColor(timeOff);
          const typeLabel = getTypeLabel(timeOff);

          // Determine border radius based on position in range
          let roundedClass = "";
          if (timeOff) {
            if (isStart && isEnd) {
              roundedClass = "rounded-lg"; // Single day
            } else if (isStart) {
              roundedClass = "rounded-l-lg"; // Start of range
            } else if (isEnd) {
              roundedClass = "rounded-r-lg"; // End of range
            }
            // Middle dates get no rounding
          }

          return (
            <div key={day.toISOString()} className="relative">
              <button
                onClick={() => onDateClick?.(day)}
                className={`
                  w-full h-12 text-sm font-medium relative z-10
                  transition-all hover:scale-105
                  ${timeOff ? `${colorClass} ${roundedClass} border-2` : "bg-slate-50 hover:bg-slate-100 rounded-md"}
                  ${isToday ? "ring-2 ring-indigo-500 ring-offset-1" : ""}
                `}
              >
                <div className="flex flex-col items-center justify-center h-full">
                  <span className={`${timeOff ? "text-slate-900 font-semibold" : "text-slate-700"}`}>
                    {format(day, "d")}
                  </span>
                  {typeLabel && (
                    <span className="text-xs font-bold text-slate-800">{typeLabel}</span>
                  )}
                </div>
              </button>
            </div>
          );
        })}
      </div>

      {/* Legend */}
      <div className="mt-6 flex flex-wrap gap-4 text-xs">
        <div className="flex items-center gap-2">
          <div className="w-5 h-5 rounded border-2 bg-green-200 border-green-400" />
          <span className="text-slate-700 font-medium">Approved</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-5 h-5 rounded border-2 bg-yellow-200 border-yellow-400" />
          <span className="text-slate-700 font-medium">Pending</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-5 h-5 rounded border-2 bg-red-200 border-red-400" />
          <span className="text-slate-700 font-medium">Rejected</span>
        </div>
        <div className="flex items-center gap-2 ml-4">
          <span className="font-bold text-slate-700">L</span> = <span className="text-slate-700">Leave <span className="text-xs text-slate-500">(Cuti)</span></span>, 
          <span className="font-bold text-slate-700 ml-2">S</span> = <span className="text-slate-700">Sick</span>,
          <span className="font-bold text-slate-700 ml-2">E</span> = <span className="text-slate-700">Emergency</span>
        </div>
      </div>
    </div>
  );
}
