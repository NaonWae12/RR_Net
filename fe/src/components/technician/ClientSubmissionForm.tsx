"use client";

import React, { useState, useEffect } from "react";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SimpleSelect } from "@/components/ui/select";
import { CreateClientSubmissionRequest } from "@/lib/api/types";
import { PhotoIcon, TrashIcon, MapPinIcon } from "@heroicons/react/20/solid";

const clientSubmissionSchema = z.object({
    name: z.string().min(2, "Name must be at least 2 characters"),
    email: z.string().email("Invalid email address").optional().or(z.literal("")),
    phone: z.string().min(10, "Phone must be at least 10 characters").optional().or(z.literal("")),
    address: z.string().min(5, "Address must be at least 5 characters").optional().or(z.literal("")),
    category: z.enum(["regular", "business", "enterprise", "lite"]).optional(),
    service_package_id: z.string().optional(),
    latitude: z.coerce.number().min(-90).max(90).optional(),
    longitude: z.coerce.number().min(-180).max(180).optional(),
});

type ClientSubmissionFormValues = z.infer<typeof clientSubmissionSchema>;

interface ClientSubmissionFormProps {
    onSubmit: (data: CreateClientSubmissionRequest) => Promise<void>;
    onCancel: () => void;
    isLoading: boolean;
}

const categories = ["regular", "business", "enterprise", "lite"];

export function ClientSubmissionForm({
    onSubmit,
    onCancel,
    isLoading,
}: ClientSubmissionFormProps) {
    const [selectedFile, setSelectedFile] = useState<File | null>(null);
    const [filePreview, setFilePreview] = useState<string | null>(null);
    const [location, setLocation] = useState<{ lat: number; lng: number } | null>(null);
    const [locationError, setLocationError] = useState<string | null>(null);
    const [gettingLocation, setGettingLocation] = useState(false);

    const {
        register,
        handleSubmit,
        setValue,
        watch,
        reset,
        formState: { errors },
    } = useForm<ClientSubmissionFormValues>({
        resolver: zodResolver(clientSubmissionSchema),
        defaultValues: {
            name: "",
            email: "",
            phone: "",
            address: "",
            category: "regular",
            service_package_id: "",
            latitude: undefined,
            longitude: undefined,
        },
    });

    // GPS requested on user action only (button click)
    // No auto-request on page load
    const requestLocation = () => {
        if (navigator.geolocation && !location && !gettingLocation) {
            setGettingLocation(true);
            navigator.geolocation.getCurrentPosition(
                (position) => {
                    const lat = position.coords.latitude;
                    const lng = position.coords.longitude;
                    setLocation({ lat, lng });
                    setValue("latitude", lat);
                    setValue("longitude", lng);
                    setLocationError(null);
                    setGettingLocation(false);
                },
                (error) => {
                    setLocationError("Unable to get location. You can enter coordinates manually.");
                    setGettingLocation(false);
                },
                {
                    enableHighAccuracy: false,
                    timeout: 10000,
                    maximumAge: 60000,
                }
            );
        } else if (!navigator.geolocation) {
            setLocationError("Geolocation is not supported by your browser. You can enter coordinates manually.");
        }
    };

    const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        if (event.target.files && event.target.files[0]) {
            const file = event.target.files[0];
            if (file.size > 5 * 1024 * 1024) {
                alert("File size must be less than 5MB");
                return;
            }
            setSelectedFile(file);
            const preview = URL.createObjectURL(file);
            setFilePreview(preview);
        }
    };

    const handleRemoveFile = () => {
        if (filePreview) {
            URL.revokeObjectURL(filePreview);
        }
        setSelectedFile(null);
        setFilePreview(null);
    };

    const handleFormSubmit = async (data: ClientSubmissionFormValues) => {
        const submitData: CreateClientSubmissionRequest = {
            name: data.name,
            email: data.email || undefined,
            phone: data.phone || undefined,
            address: data.address || undefined,
            category: data.category || undefined,
            service_package_id: data.service_package_id || undefined,
            latitude: data.latitude,
            longitude: data.longitude,
            photo: selectedFile || undefined,
        };
        await onSubmit(submitData);
        // Reset form
        reset();
        if (filePreview) {
            URL.revokeObjectURL(filePreview);
        }
        setSelectedFile(null);
        setFilePreview(null);
        setLocation(null);
    };

    return (
        <form onSubmit={handleSubmit(handleFormSubmit)} className="space-y-4">
            {/* Warning banner */}
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
                <p className="text-sm text-amber-800">
                    This client will be reviewed by admin before being added to the system.
                </p>
            </div>

            <div>
                <label className="text-sm font-medium text-slate-700">
                    Name <span className="text-red-500">*</span>
                </label>
                <Input {...register("name")} error={errors.name?.message} className="w-full" />
            </div>

            <div className="grid grid-cols-2 gap-4">
                <div>
                    <label className="text-sm font-medium text-slate-700">Email</label>
                    <Input type="email" {...register("email")} error={errors.email?.message} className="w-full" />
                </div>
                <div>
                    <label className="text-sm font-medium text-slate-700">Phone</label>
                    <Input {...register("phone")} error={errors.phone?.message} className="w-full" />
                </div>
            </div>

            <div>
                <label className="text-sm font-medium text-slate-700">Address</label>
                <textarea
                    {...register("address")}
                    className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-950"
                    rows={3}
                    placeholder="Client address..."
                />
                {errors.address && (
                    <p className="text-xs text-red-500 mt-1">{errors.address.message}</p>
                )}
            </div>

            <div className="grid grid-cols-2 gap-4">
                <div>
                    <label className="text-sm font-medium text-slate-700">Category</label>
                    <SimpleSelect
                        value={watch("category") || "regular"}
                        onValueChange={(value) => setValue("category", value as any)}
                        className="w-full"
                    >
                        {categories.map((cat) => (
                            <option key={cat} value={cat}>
                                {cat.charAt(0).toUpperCase() + cat.slice(1)}
                            </option>
                        ))}
                    </SimpleSelect>
                </div>
                <div>
                    <label className="text-sm font-medium text-slate-700">Service Package ID</label>
                    <Input {...register("service_package_id")} className="w-full" placeholder="Optional" />
                </div>
            </div>

            {/* Location */}
            <div>
                <label className="text-sm font-medium text-slate-700 mb-2 block">Location (Optional)</label>
                <div className="flex items-center gap-2 mb-2">
                    <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={requestLocation}
                        disabled={gettingLocation || !!location}
                    >
                        <MapPinIcon className="h-4 w-4 mr-1" />
                        {gettingLocation ? "Getting location..." : location ? "Location detected" : "Get My Location"}
                    </Button>
                </div>
                {gettingLocation && (
                    <p className="text-xs text-slate-500 mb-2">Getting your location...</p>
                )}
                {locationError && <p className="text-xs text-amber-600 mb-2">{locationError}</p>}
                {location && (
                    <div className="flex items-center gap-2 mb-2 text-sm text-green-600">
                        <MapPinIcon className="h-4 w-4" />
                        <span>Location detected</span>
                    </div>
                )}
                <div className="grid grid-cols-2 gap-2">
                    <Input
                        label="Latitude"
                        type="number"
                        step="any"
                        {...register("latitude")}
                        error={errors.latitude?.message}
                    />
                    <Input
                        label="Longitude"
                        type="number"
                        step="any"
                        {...register("longitude")}
                        error={errors.longitude?.message}
                    />
                </div>
            </div>

            {/* Photo Upload */}
            <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                    Photo (Optional, Max 5MB)
                </label>
                {!selectedFile ? (
                    <div className="mt-1 flex justify-center px-6 pt-5 pb-6 border-2 border-slate-300 border-dashed rounded-md hover:border-slate-400 transition-colors">
                        <div className="space-y-1 text-center">
                            <PhotoIcon className="mx-auto h-12 w-12 text-slate-400" />
                            <div className="flex text-sm text-slate-600">
                                <label
                                    htmlFor="photo-upload"
                                    className="relative cursor-pointer rounded-md font-medium text-indigo-600 hover:text-indigo-500"
                                >
                                    <span>Upload a photo</span>
                                    <input
                                        id="photo-upload"
                                        name="photo-upload"
                                        type="file"
                                        className="sr-only"
                                        accept="image/*"
                                        onChange={handleFileChange}
                                    />
                                </label>
                            </div>
                            <p className="text-xs text-slate-500">PNG, JPG up to 5MB</p>
                        </div>
                    </div>
                ) : (
                    <div className="mt-1 relative">
                        {filePreview && (
                            <div className="relative w-full h-48 rounded-md overflow-hidden border border-slate-200">
                                <img src={filePreview} alt="Preview" className="w-full h-full object-cover" />
                                <button
                                    type="button"
                                    onClick={handleRemoveFile}
                                    className="absolute top-2 right-2 bg-red-500 text-white rounded-full p-2"
                                >
                                    <TrashIcon className="h-4 w-4" />
                                </button>
                            </div>
                        )}
                    </div>
                )}
            </div>

            <div className="flex justify-end space-x-2 pt-4">
                <Button type="button" variant="outline" onClick={onCancel} disabled={isLoading}>
                    Cancel
                </Button>
                <Button type="submit" disabled={isLoading} variant="default">
                    {isLoading ? "Submitting..." : "Submit Client"}
                </Button>
            </div>
        </form>
    );
}

