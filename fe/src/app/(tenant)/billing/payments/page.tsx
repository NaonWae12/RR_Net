"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function PaymentsPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace("/billing?tab=payments");
  }, [router]);

  return null;
}

