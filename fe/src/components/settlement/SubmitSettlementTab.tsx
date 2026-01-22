"use client";

import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { LoadingSpinner } from "@/components/utilities/LoadingSpinner";
import { useNotificationStore } from "@/stores/notificationStore";
import { QrCodeIcon, CameraIcon, PhotoIcon, CheckCircleIcon, XCircleIcon } from "@heroicons/react/20/solid";

type ScanMode = "idle" | "scanning" | "uploading" | "success" | "error";

export function SubmitSettlementTab() {
  const { showToast } = useNotificationStore();
  const [mode, setMode] = useState<ScanMode>("idle");
  const [qrData, setQrData] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [settlementInfo, setSettlementInfo] = useState<any>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const handleStartScan = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment" }, // Use back camera on mobile
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        setMode("scanning");
        setError(null);
      }
    } catch (err: any) {
      setError("Camera access denied. Please enable camera permission or use upload option.");
      showToast({
        title: "Camera Error",
        description: "Failed to access camera. Please use upload option instead.",
        variant: "error",
      });
    }
  };

  const handleStopScan = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setMode("idle");
    setQrData(null);
    setError(null);
  };

  const handleUploadClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setMode("uploading");
    setError(null);

    try {
      // Mock QR code extraction from image
      // In real implementation, use a QR code library like jsQR
      await new Promise((resolve) => setTimeout(resolve, 1000));

      // Simulate QR code reading
      const mockQRData = JSON.stringify({
        token: "SETTLEMENT-1234567890-collector-1",
        collectorId: "collector-1",
        settlementDate: new Date().toISOString().split("T")[0],
        expiresAt: new Date(Date.now() + 30 * 60 * 1000).toISOString(),
      });

      // Validate QR
      const qrInfo = JSON.parse(mockQRData);
      const expiresAt = new Date(qrInfo.expiresAt);
      const now = new Date();

      if (expiresAt < now) {
        setError("QR code has expired. Please request a new QR code from admin.");
        setMode("error");
        return;
      }

      setQrData(mockQRData);
      setSettlementInfo(qrInfo);
      setMode("success");
    } catch (err: any) {
      setError("Failed to read QR code from image. Please ensure the image is clear and contains a valid QR code.");
      setMode("error");
    }
  };

  const handleSubmit = async () => {
    if (!qrData) return;

    try {
      // Mock API call
      await new Promise((resolve) => setTimeout(resolve, 1500));

      showToast({
        title: "Settlement Submitted",
        description: "Your settlement has been submitted and is pending admin verification.",
        variant: "success",
      });

      // Reset
      setMode("idle");
      setQrData(null);
      setSettlementInfo(null);
      setError(null);
    } catch (err: any) {
      showToast({
        title: "Submission Failed",
        description: err?.message || "Failed to submit settlement. Please try again.",
        variant: "error",
      });
      setMode("error");
    }
  };

  const handleRetry = () => {
    setMode("idle");
    setQrData(null);
    setSettlementInfo(null);
    setError(null);
  };

  return (
    <div className="space-y-6">
      <div className="bg-white border border-slate-200 rounded-lg p-6">
        <h2 className="text-lg font-semibold text-slate-900 mb-4">Submit Settlement</h2>

        {mode === "idle" && (
          <div className="space-y-4">
            <p className="text-sm text-slate-600">
              Scan or upload the QR code provided by admin to submit your daily settlement.
            </p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Button onClick={handleStartScan} className="h-32 flex-col" variant="outline">
                <CameraIcon className="w-8 h-8 mb-2" />
                <span>Scan QR Code</span>
                <span className="text-xs text-slate-500 mt-1">Use camera to scan</span>
              </Button>

              <Button onClick={handleUploadClick} className="h-32 flex-col" variant="outline">
                <PhotoIcon className="w-8 h-8 mb-2" />
                <span>Upload QR Image</span>
                <span className="text-xs text-slate-500 mt-1">Upload QR code image</span>
              </Button>
            </div>

            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleFileUpload}
              className="hidden"
            />
          </div>
        )}

        {mode === "scanning" && (
          <div className="space-y-4">
            <div className="relative bg-slate-900 rounded-lg overflow-hidden aspect-square max-w-md mx-auto">
              <video
                ref={videoRef}
                autoPlay
                playsInline
                className="w-full h-full object-cover"
              />
              <div className="absolute inset-0 border-4 border-blue-500 rounded-lg pointer-events-none">
                <div className="absolute top-4 left-4 right-4 text-center">
                  <div className="inline-block bg-blue-500 text-white px-3 py-1 rounded text-sm">
                    Position QR code in frame
                  </div>
                </div>
              </div>
            </div>

            <div className="text-center space-y-2">
              <p className="text-sm text-slate-600">
                Point your camera at the QR code. Scanning will happen automatically.
              </p>
              <Button onClick={handleStopScan} variant="outline">
                Cancel Scan
              </Button>
            </div>

            {/* Mock QR detection - in real implementation, use jsQR library */}
            <div className="text-center">
              <Button
                onClick={() => {
                  // Simulate QR detection
                  const mockQRData = JSON.stringify({
                    token: "SETTLEMENT-1234567890-collector-1",
                    collectorId: "collector-1",
                    settlementDate: new Date().toISOString().split("T")[0],
                    expiresAt: new Date(Date.now() + 30 * 60 * 1000).toISOString(),
                  });
                  setQrData(mockQRData);
                  setSettlementInfo(JSON.parse(mockQRData));
                  handleStopScan();
                  setMode("success");
                }}
                variant="outline"
              >
                Simulate QR Detection (Dev Only)
              </Button>
            </div>
          </div>
        )}

        {mode === "uploading" && (
          <div className="text-center py-8">
            <LoadingSpinner size={40} />
            <p className="text-sm text-slate-600 mt-4">Processing QR code image...</p>
          </div>
        )}

        {mode === "success" && settlementInfo && (
          <div className="space-y-4">
            <div className="bg-green-50 border border-green-200 rounded-lg p-4">
              <div className="flex items-start">
                <CheckCircleIcon className="w-5 h-5 text-green-600 mr-2 mt-0.5" />
                <div>
                  <div className="font-medium text-green-900">QR Code Valid</div>
                  <div className="text-sm text-green-700 mt-1">
                    Settlement date: {new Date(settlementInfo.settlementDate).toLocaleDateString("id-ID")}
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-white border border-slate-200 rounded-lg p-4 space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-slate-500">Settlement Date:</span>
                <span className="font-medium text-slate-900">
                  {new Date(settlementInfo.settlementDate).toLocaleDateString("id-ID")}
                </span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-slate-500">QR Token:</span>
                <span className="font-mono text-xs text-slate-600">{settlementInfo.token}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-slate-500">Expires at:</span>
                <span className="text-slate-900">
                  {new Date(settlementInfo.expiresAt).toLocaleString("id-ID")}
                </span>
              </div>
            </div>

            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <div className="text-sm text-blue-900">
                <strong>Note:</strong> This will submit your settlement for today. Admin will verify and approve your
                submission.
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Button onClick={handleSubmit} className="flex-1">
                <QrCodeIcon className="w-5 h-5 mr-2" />
                Submit Settlement
              </Button>
              <Button variant="outline" onClick={handleRetry}>
                Cancel
              </Button>
            </div>
          </div>
        )}

        {mode === "error" && (
          <div className="space-y-4">
            <div className="bg-red-50 border border-red-200 rounded-lg p-4">
              <div className="flex items-start">
                <XCircleIcon className="w-5 h-5 text-red-600 mr-2 mt-0.5" />
                <div>
                  <div className="font-medium text-red-900">Error</div>
                  <div className="text-sm text-red-700 mt-1">{error || "Failed to process QR code"}</div>
                </div>
              </div>
            </div>

            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <div className="text-sm text-blue-900">
                <strong>Tips:</strong>
                <ul className="list-disc list-inside mt-2 space-y-1">
                  <li>Ensure QR code is clear and not blurry</li>
                  <li>Make sure QR code is not expired</li>
                  <li>Request a new QR code from admin if needed</li>
                </ul>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Button onClick={handleRetry} className="flex-1">
                Try Again
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

