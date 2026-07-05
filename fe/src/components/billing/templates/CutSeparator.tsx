import React from "react";

interface CutSeparatorProps {
  label?: string;
}

export function CutSeparator({ label = "Potong Di Sini" }: CutSeparatorProps) {
  return (
    <div className="cut-separator flex items-center gap-2 my-4 select-none">
      {/* Scissor icon SVG */}
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
        className="w-5 h-5 text-slate-400 flex-shrink-0 rotate-90"
      >
        <circle cx="6" cy="6" r="3" />
        <circle cx="6" cy="18" r="3" />
        <line x1="20" y1="4" x2="8.12" y2="15.88" />
        <line x1="14.47" y1="14.48" x2="20" y2="20" />
        <line x1="8.12" y1="8.12" x2="12" y2="12" />
      </svg>

      {/* Dashed line left */}
      <div className="flex-1 border-t-2 border-dashed border-slate-300" />

      {/* Label */}
      <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest whitespace-nowrap px-1">
        {label}
      </span>

      {/* Dashed line right */}
      <div className="flex-1 border-t-2 border-dashed border-slate-300" />

      {/* Scissor icon SVG (mirrored) */}
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
        className="w-5 h-5 text-slate-400 flex-shrink-0 -rotate-90 scale-x-[-1]"
      >
        <circle cx="6" cy="6" r="3" />
        <circle cx="6" cy="18" r="3" />
        <line x1="20" y1="4" x2="8.12" y2="15.88" />
        <line x1="14.47" y1="14.48" x2="20" y2="20" />
        <line x1="8.12" y1="8.12" x2="12" y2="12" />
      </svg>
    </div>
  );
}
