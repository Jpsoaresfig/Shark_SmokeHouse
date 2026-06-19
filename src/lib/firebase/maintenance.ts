import { collection, getDocs, writeBatch } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { invalidate } from "@/lib/firebase/cache";

/** Tamanho de lote abaixo do limite do Firestore (500 ops por batch). */
const BATCH_SIZE = 450;

/** Apaga todos os documentos de uma coleção em lotes. Retorna quantos removeu. */
async function deleteCollection(name: string): Promise<number> {
  const snap = await getDocs(collection(db, name));
  const docs = snap.docs;
  for (let i = 0; i < docs.length; i += BATCH_SIZE) {
    const batch = writeBatch(db);
    for (const d of docs.slice(i, i + BATCH_SIZE)) batch.delete(d.ref);
    await batch.commit();
  }
  return docs.length;
}

/**
 * Zera os dados de vendas para iniciar a operação limpa: remove as vendas do PDV
 * (`sales`) e os pedidos online (`orders`). NÃO mexe em produtos nem no estoque
 * atual — apenas limpa o histórico/transações. Como as métricas do dashboard e do
 * histórico derivam dessas coleções, elas zeram automaticamente após a limpeza.
 *
 * Restrito ao admin (regras do Firestore exigem isAdmin para apagar pedidos).
 */
export async function resetSalesData(): Promise<{ sales: number; orders: number }> {
  const sales = await deleteCollection("sales");
  const orders = await deleteCollection("orders");
  invalidate("sales");
  invalidate("orders");
  invalidate("products"); // estoque não muda, mas força releitura consistente
  return { sales, orders };
}
