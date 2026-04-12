import React from "react";
import SimpleTemplate from "./SimpleTemplate";
import BrandedTemplate from "./BrandedTemplate";
import MikhmonTemplate from "./MikhmonTemplate";
import ModernTemplate from "./ModernTemplate";
import { VoucherTemplateProps } from "./types";

export interface TemplateRegistryItem {
  id: string;
  name: string;
  component: React.FC<VoucherTemplateProps>;
  gridCols?: number;
}

export const VOUCHER_TEMPLATES: Record<string, TemplateRegistryItem> = {
  simple: {
    id: "simple",
    name: "Simple Card",
    component: SimpleTemplate,
    gridCols: 3,
  },
  branded: {
    id: "branded",
    name: "Branded Gradient",
    component: BrandedTemplate,
    gridCols: 3,
  },
  mikhmon: {
    id: "mikhmon",
    name: "Mikhmon Classic",
    component: MikhmonTemplate,
    gridCols: 5,
  },
  modern: {
    id: "modern",
    name: "Modern QR",
    component: ModernTemplate,
    gridCols: 5,
  },
};

export const getTemplateBySlug = (slug: string): TemplateRegistryItem => {
  return VOUCHER_TEMPLATES[slug] || VOUCHER_TEMPLATES.simple;
};
