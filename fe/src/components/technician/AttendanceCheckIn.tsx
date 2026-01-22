"use client";

import React, { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useNotificationStore } from "@/stores/notificationStore";
import { CheckInRequest, CheckOutRequest, Attendance } from "@/lib/api/types";
import { format } from "date-fns";

interface AttendanceCheckInProps {
    attendance: Attendance | null;
    onCheckIn: (data: CheckInRequest) => Promise<void>;
    onCheckOut: (data: CheckOutRequest) => Promise<void>;
    loading?: boolean;
}

export function AttendanceCheckIn({
    attendance,
    onCheckIn,
    onCheckOut,
    loading = false,
}: AttendanceCheckInProps) {
    const { showToast } = useNotificationStore();
    const [note, setNote] = useState("");
    const [location, setLocation] = useState<{ lat: number; lng: number } | null>(null);
    const [locationError, setLocationError] = useState<string | null>(null);
    const [gettingLocation, setGettingLocation] = useState(false);

    // GPS requested on user action only (check-in/check-out button click)
    // No auto-request on page load

    const isCheckedIn = attendance?.status === "checked_in";
    const isCheckedOut = attendance?.status === "checked_out";
    const isOnLeave = attendance?.status === "on_leave";

    // GPS requested on user action only
    const requestLocation = (): Promise<{ lat: number; lng: number } | null> => {
        return new Promise((resolve) => {
            if (navigator.geolocation && !location) {
                setGettingLocation(true);
                navigator.geolocation.getCurrentPosition(
                    (position) => {
                        const loc = {
                            lat: position.coords.latitude,
                            lng: position.coords.longitude,
                        };
                        setLocation(loc);
                        setLocationError(null);
                        setGettingLocation(false);
                        resolve(loc);
                    },
                    (error) => {
                        // Handle different error types gracefully
                        let errorMessage = "Unable to get location. You can still check in/out manually.";
                        if (error.code === error.PERMISSION_DENIED) {
                            errorMessage = "Location access denied. You can still check in/out manually.";
                        } else if (error.code === error.POSITION_UNAVAILABLE) {
                            errorMessage = "Location unavailable. You can still check in/out manually.";
                        } else if (error.code === error.TIMEOUT) {
                            errorMessage = "Location request timed out. You can still check in/out manually.";
                        }
                        setLocationError(errorMessage);
                        setGettingLocation(false);
                        resolve(null);
                    },
                    {
                        enableHighAccuracy: false,
                        timeout: 10000,
                        maximumAge: 60000,
                    }
                );
            } else if (!navigator.geolocation) {
                setLocationError("Geolocation is not supported by your browser. You can still check in/out manually.");
                resolve(null);
            } else {
                // Location already exists
                resolve(location);
            }
        });
    };

    const handleCheckIn = async () => {
        // Request location only when user clicks check-in
        let currentLocation = location;
        if (!currentLocation && !locationError) {
            currentLocation = await requestLocation();
        }
        try {
            await onCheckIn({
                note: note || undefined,
                location_latitude: currentLocation?.lat,
                location_longitude: currentLocation?.lng,
            });
            setNote("");
            showToast({
                title: "Checked in",
                description: "You have successfully checked in.",
                variant: "success",
            });
        } catch (err: any) {
            showToast({
                title: "Failed to check in",
                description: err?.message || "An unexpected error occurred.",
                variant: "error",
            });
        }
    };

    const handleCheckOut = async () => {
        // Request location only when user clicks check-out
        let currentLocation = location;
        if (!currentLocation && !locationError) {
            currentLocation = await requestLocation();
        }
        try {
            await onCheckOut({
                note: note || undefined,
                location_latitude: currentLocation?.lat,
                location_longitude: currentLocation?.lng,
            });
            setNote("");
            showToast({
                title: "Checked out",
                description: "You have successfully checked out.",
                variant: "success",
            });
        } catch (err: any) {
            showToast({
                title: "Failed to check out",
                description: err?.message || "An unexpected error occurred.",
                variant: "error",
            });
        }
    };

    const calculateHours = () => {
        if (!attendance?.check_in_time || !attendance?.check_out_time) return null;
        const checkIn = new Date(attendance.check_in_time);
        const checkOut = new Date(attendance.check_out_time);
        const diffMs = checkOut.getTime() - checkIn.getTime();
        const diffHours = diffMs / (1000 * 60 * 60);
        return diffHours.toFixed(1);
    };

    return (
        <div className="bg-white rounded-lg shadow p-6 space-y-4">
            <h2 className="text-xl font-semibold text-slate-900">Today's Attendance</h2>

            {/* Status Card */}
            <div
                className={`rounded-lg p-4 ${isCheckedOut
                        ? "bg-green-50 border border-green-200"
                        : isCheckedIn
                            ? "bg-blue-50 border border-blue-200"
                            : isOnLeave
                                ? "bg-purple-50 border border-purple-200"
                                : "bg-gray-50 border border-gray-200"
                    }`}
            >
                <div className="flex items-center justify-between">
                    <div>
                        <p className="text-sm font-medium text-slate-600">Status</p>
                        <p className="text-lg font-semibold text-slate-900 mt-1">
                            {isCheckedOut
                                ? "Present (Checked Out)"
                                : isCheckedIn
                                    ? "Present (Checked In)"
                                    : isOnLeave
                                        ? "On Leave"
                                        : "Absent"}
                        </p>
                    </div>
                    {attendance?.check_in_time && (
                        <div className="text-right">
                            <p className="text-sm text-slate-600">Check-in</p>
                            <p className="text-sm font-medium text-slate-900">
                                {format(new Date(attendance.check_in_time), "HH:mm")}
                            </p>
                        </div>
                    )}
                    {attendance?.check_out_time && (
                        <div className="text-right ml-4">
                            <p className="text-sm text-slate-600">Check-out</p>
                            <p className="text-sm font-medium text-slate-900">
                                {format(new Date(attendance.check_out_time), "HH:mm")}
                            </p>
                        </div>
                    )}
                </div>
                {attendance?.check_out_time && (
                    <div className="mt-3 pt-3 border-t border-slate-200">
                        <p className="text-sm text-slate-600">
                            Total Hours: <span className="font-semibold text-slate-900">{calculateHours()}h</span>
                        </p>
                    </div>
                )}
            </div>

            {/* Check In/Out Actions */}
            {!isOnLeave && (
                <div className="space-y-3">
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">Note (Optional)</label>
                        <textarea
                            value={note}
                            onChange={(e) => setNote(e.target.value)}
                            className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-950"
                            rows={2}
                            placeholder="Add a note about your attendance..."
                        />
                    </div>

                    {gettingLocation && (
                        <p className="text-xs text-slate-500">Getting location...</p>
                    )}
                    {locationError && (
                        <p className="text-xs text-amber-600">{locationError}</p>
                    )}

                    <div className="flex gap-3">
                        {!isCheckedIn && !isCheckedOut && (
                            <Button
                                onClick={handleCheckIn}
                                disabled={loading || gettingLocation}
                                className="flex-1 h-12 text-base font-medium"
                                size="lg"
                            >
                                {gettingLocation ? "Getting location..." : "Check In"}
                            </Button>
                        )}
                        {isCheckedIn && !isCheckedOut && (
                            <Button
                                onClick={handleCheckOut}
                                disabled={loading || gettingLocation}
                                className="flex-1 h-12 text-base font-medium"
                                size="lg"
                                variant="default"
                            >
                                {gettingLocation ? "Getting location..." : "Check Out"}
                            </Button>
                        )}
                        {isCheckedOut && (
                            <div className="flex-1 text-center text-sm text-slate-500 py-3">
                                You have already checked out for today.
                            </div>
                        )}
                    </div>
                </div>
            )}

            {isOnLeave && (
                <div className="text-center text-sm text-slate-500 py-3">
                    You are on leave today. <span className="text-xs">(Anda sedang cuti hari ini)</span>
                </div>
            )}
        </div>
    );
}

