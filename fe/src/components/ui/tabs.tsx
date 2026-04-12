"use client"

import * as React from "react"
import { cn } from "@/lib/utils"

const TabsContext = React.createContext<{
  activeTab: string;
  setActiveTab: (value: string) => void;
} | null>(null)

const Tabs = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement> & { defaultValue: string; onValueChange?: (value: string) => void }
>(({ className, defaultValue, onValueChange, ...props }, ref) => {
  const [activeTab, setTab] = React.useState(defaultValue)

  const setActiveTab = React.useCallback((value: string) => {
    setTab(value)
    onValueChange?.(value)
  }, [onValueChange])

  return (
    <TabsContext.Provider value={{ activeTab, setActiveTab }}>
      <div ref={ref} className={cn("w-full space-y-2", className)} {...props} />
    </TabsContext.Provider>
  )
})
Tabs.displayName = "Tabs"

const TabsList = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn(
      "inline-flex h-11 items-center justify-center rounded-2xl bg-slate-100 p-1 text-slate-500",
      className
    )}
    {...props}
  />
))
TabsList.displayName = "TabsList"

const TabsTrigger = React.forwardRef<
  HTMLButtonElement,
  React.ButtonHTMLAttributes<HTMLButtonElement> & { value: string }
>(({ className, value, ...props }, ref) => {
  const context = React.useContext(TabsContext)
  if (!context) return null

  const isActive = context.activeTab === value

  return (
    <button
      ref={ref}
      type="button"
      onClick={() => context.setActiveTab(value)}
      className={cn(
        "inline-flex items-center justify-center whitespace-nowrap rounded-xl px-4 py-2 text-sm font-bold ring-offset-background transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50",
        isActive
          ? "bg-white text-slate-950 shadow-sm"
          : "hover:bg-slate-50 hover:text-slate-900",
        className
      )}
      {...props}
    />
  )
})
TabsTrigger.displayName = "TabsTrigger"

const TabsContent = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement> & { value: string }
>(({ className, value, ...props }, ref) => {
  const context = React.useContext(TabsContext)
  if (!context) return null

  if (context.activeTab !== value) return null

  return (
    <div
      ref={ref}
      className={cn(
        "mt-4 ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 animate-in fade-in-50 duration-200",
        className
      )}
      {...props}
    />
  )
})
TabsContent.displayName = "TabsContent"

export { Tabs, TabsList, TabsTrigger, TabsContent }
