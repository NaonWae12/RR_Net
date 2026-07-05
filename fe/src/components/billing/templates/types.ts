import type { Invoice, PaymentMethodAccount } from "@/lib/api/types";

export interface InvoiceTemplateProps {
  invoice: Invoice;
  companyName: string;
  companyAddress: string;
  companyPhone: string;
  notes: string;
  footerMessage: string;
  signerName: string;
  selectedAccount?: PaymentMethodAccount;
  formatCurrency: (amount: number) => string;
}

export interface TemplateDefinition {
  id: string;
  name: string;
  description: string;
  icon: string; // "file-text" | "receipt" | "simple"
  settings: {
    showBankSelection: boolean;
    showSigner: boolean;
    showAddress: boolean;
    showPhone: boolean;
    showFooterMsg: boolean;
  };
}
