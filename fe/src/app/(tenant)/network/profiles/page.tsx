"use client";

import { useEffect } from "react";
import { useNetworkStore } from "@/stores/networkStore";
import { NetworkProfileTable } from "@/components/network";
import { Button } from "@/components/ui/button";
import { useRouter } from "next/navigation";
import { PlusIcon } from "@heroicons/react/20/solid";

export default function NetworkProfilesPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace("/pppoe?tab=profiles");
  }, [router]);

  return null;
}

