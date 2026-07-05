import { HvsTemplate } from "./HvsTemplate";
import { ThermalTemplate } from "./ThermalTemplate";
import { SimpleTemplate } from "./SimpleTemplate";
import type { TemplateDefinition } from "./types";

export * from "./types";
export * from "./utils";

export const INVOICE_TEMPLATES: Record<string, {
  definition: TemplateDefinition;
  component: React.ComponentType<any>;
}> = {
  hvs: {
    definition: {
      id: "hvs",
      name: "Kertas HVS (A4)",
      description: "Format nota formal standar A4 perusahaan.",
      icon: "file-text",
      settings: {
        showBankSelection: true,
        showSigner: true,
        showAddress: true,
        showPhone: true,
        showFooterMsg: true,
      },
    },
    component: HvsTemplate,
  },
  thermal: {
    definition: {
      id: "thermal",
      name: "Thermal (Struk)",
      description: "Format struk kasir hemat kertas roll 80mm.",
      icon: "receipt",
      settings: {
        showBankSelection: false,
        showSigner: false,
        showAddress: true,
        showPhone: true,
        showFooterMsg: true,
      },
    },
    component: ThermalTemplate,
  },
  simple: {
    definition: {
      id: "simple",
      name: "Simple Minimalis",
      description: "Format kwitansi hemat tinta dengan border hitam minimalis A5.",
      icon: "simple",
      settings: {
        showBankSelection: false,
        showSigner: true,
        showAddress: true,
        showPhone: true,
        showFooterMsg: true,
      },
    },
    component: SimpleTemplate,
  },
};
