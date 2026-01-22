"use client";

import * as React from "react";
import { Modal } from "./Modal";
import { Button } from "@/components/ui/button";
import { Download, ZoomIn, ZoomOut, RotateCw, X } from "lucide-react";
import Image from "next/image";
import { cn } from "@/lib/utils";

export interface ImageModalProps {
  isOpen: boolean;
  onClose: () => void;
  imageUrl: string;
  alt?: string;
  title?: string;
  downloadable?: boolean;
  onDownload?: () => void;
  className?: string;
}

export function ImageModal({
  isOpen,
  onClose,
  imageUrl,
  alt = "Image",
  title,
  downloadable = true,
  onDownload,
  className,
}: ImageModalProps) {
  const [zoom, setZoom] = React.useState(1);
  const [rotation, setRotation] = React.useState(0);

  React.useEffect(() => {
    if (!isOpen) {
      setZoom(1);
      setRotation(0);
    }
  }, [isOpen]);

  const handleZoomIn = () => setZoom((prev) => Math.min(prev + 0.25, 3));
  const handleZoomOut = () => setZoom((prev) => Math.max(prev - 0.25, 0.5));
  const handleRotate = () => setRotation((prev) => (prev + 90) % 360);
  const handleReset = () => {
    setZoom(1);
    setRotation(0);
  };

  const handleDownload = () => {
    if (onDownload) {
      onDownload();
    } else {
      const link = document.createElement("a");
      link.href = imageUrl;
      link.download = alt || "image";
      link.click();
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      size="full"
      title={title}
      className={className || "bg-white"}
      footer={
        <div className="flex items-center justify-between w-full">
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={handleZoomOut}>
              <ZoomOut className="h-4 w-4" />
            </Button>
            <span className="text-sm w-16 text-center">{Math.round(zoom * 100)}%</span>
            <Button variant="outline" size="sm" onClick={handleZoomIn}>
              <ZoomIn className="h-4 w-4" />
            </Button>
            <Button variant="outline" size="sm" onClick={handleRotate}>
              <RotateCw className="h-4 w-4" />
            </Button>
            <Button variant="outline" size="sm" onClick={handleReset}>
              Reset
            </Button>
          </div>
          {downloadable && (
            <Button variant="outline" size="sm" onClick={handleDownload}>
              <Download className="h-4 w-4 mr-2" />
              Download
            </Button>
          )}
        </div>
      }
    >
      <div className="flex items-center justify-center min-h-[400px] bg-muted rounded-lg overflow-hidden">
        <div
          className="relative transition-transform duration-200"
          style={{
            transform: `scale(${zoom}) rotate(${rotation}deg)`,
            transformOrigin: "center",
          }}
        >
          <Image
            src={imageUrl}
            alt={alt}
            width={800}
            height={600}
            className="max-w-full max-h-[70vh] object-contain"
            unoptimized
          />
        </div>
      </div>
    </Modal>
  );
}

