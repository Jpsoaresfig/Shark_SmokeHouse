import {
  collection, getDocs, addDoc, updateDoc, deleteDoc,
  doc, serverTimestamp, query, orderBy,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import type { Report, ReportStatus } from "@/types";

const COL = "reports";

/** Admin: lista todos os reportes (mais recentes primeiro). */
export async function getReports(): Promise<Report[]> {
  const snap = await getDocs(query(collection(db, COL), orderBy("createdAt", "desc")));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() } as Report));
}

/**
 * Público: cria um reporte de problema. Status inicial "open". Remove campos
 * opcionais vazios/undefined (Firestore rejeita undefined).
 */
export async function createReport(
  data: Omit<Report, "id" | "status" | "createdAt">
): Promise<string> {
  const clean = Object.fromEntries(
    Object.entries(data).filter(([, v]) => v !== undefined && v !== "")
  );
  const ref = await addDoc(collection(db, COL), {
    ...clean,
    status: "open" as ReportStatus,
    createdAt: serverTimestamp(),
  });
  return ref.id;
}

/** Admin: marca um reporte como resolvido/reaberto. */
export async function updateReportStatus(id: string, status: ReportStatus): Promise<void> {
  await updateDoc(doc(db, COL, id), { status, updatedAt: serverTimestamp() });
}

/** Admin: exclui um reporte. */
export async function deleteReport(id: string): Promise<void> {
  await deleteDoc(doc(db, COL, id));
}
