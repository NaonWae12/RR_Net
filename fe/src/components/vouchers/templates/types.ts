import { Voucher, VoucherPackage } from "@/lib/api/types";

export interface VoucherTemplateProps {
  voucher: Voucher;
  index: number;
  pkg?: VoucherPackage;
  headerTitle: string;
}
