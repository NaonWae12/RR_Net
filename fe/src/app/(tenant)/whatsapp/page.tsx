"use client";

import { TabLayout } from "@/components/layouts/TabLayout";
import { CampaignsTab, ReminderTab, DeviceTab, LogsTab, SingleTab, TemplatesTab } from "@/components/whatsapp";

export default function WhatsAppGatewayPage() {
    const tabs = [
        {
            id: "device",
            label: "Perangkat tertaut",
            content: <DeviceTab />,
        },
        {
            id: "single",
            label: "Single",
            content: <SingleTab />,
        },
        {
            id: "reminder",
            label: "Reminder",
            content: <ReminderTab />,
        },
        {
            id: "campaigns",
            label: "Campaigns",
            content: <CampaignsTab />,
        },
        {
            id: "logs",
            label: "Logs",
            content: <LogsTab />,
        },
        {
            id: "templates",
            label: "Templates",
            content: <TemplatesTab />,
        },
    ];

    return (
        <div className="p-6 space-y-6">
            <div className="flex items-start justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-slate-900">WhatsApp</h1>
                    <p className="text-sm text-slate-600 mt-1">
                        Modul WhatsApp untuk tenant: perangkat tertaut, single chat, reminder, campaigns, logs, dan templates.
                    </p>
                </div>
            </div>

            <div className="rounded-lg border border-slate-200 bg-white overflow-hidden">
                <TabLayout tabs={tabs} defaultTab="device" className="w-full" />
            </div>
        </div>
    );
}


