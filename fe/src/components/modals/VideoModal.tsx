"use client";

import * as React from "react";
import { Modal } from "./Modal";
import { Button } from "@/components/ui/button";
import { Download, X } from "lucide-react";

export interface VideoModalProps {
  isOpen: boolean;
  onClose: () => void;
  videoUrl: string;
  title?: string;
  downloadable?: boolean;
  onDownload?: () => void;
  className?: string;
  autoplay?: boolean;
  controls?: boolean;
}

export function VideoModal({
  isOpen,
  onClose,
  videoUrl,
  title,
  downloadable = true,
  onDownload,
  className,
  autoplay = false,
  controls = true,
}: VideoModalProps) {
  const handleDownload = () => {
    if (onDownload) {
      onDownload();
    } else {
      const link = document.createElement("a");
      link.href = videoUrl;
      link.download = title || "video";
      link.click();
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      size="xl"
      title={title}
      className={className || "bg-white"}
      footer={
        downloadable && (
          <Button variant="outline" onClick={handleDownload}>
            <Download className="h-4 w-4 mr-2" />
            Download
          </Button>
        )
      }
    >
      <div className="w-full aspect-video bg-black rounded-lg overflow-hidden">
        <video
          src={videoUrl}
          controls={controls}
          autoPlay={autoplay}
          className="w-full h-full"
        />
      </div>
    </Modal>
  );
}

