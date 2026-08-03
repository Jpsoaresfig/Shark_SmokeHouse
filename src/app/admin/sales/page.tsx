"use client";

import SalePdv from "@/components/admin/SalePdv";
import { filterNormalSales, internalProductIdsOf } from "@/lib/sales/helpers";

export default function AdminSales() {
  return (
    <SalePdv
      title="Vendas"
      subtitle="Registre vendas e exporte relatórios"
      catalogFilter={(products) => products.filter(p => p.active && !p.internal)}
      historyFilter={(sales, products) =>
        filterNormalSales(sales, internalProductIdsOf(products))
      }
      showResetData
    />
  );
}
