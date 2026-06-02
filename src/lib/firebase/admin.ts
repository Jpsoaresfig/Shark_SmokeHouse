import { initializeApp, getApps, cert, type App } from "firebase-admin/app";
import { getAuth, type Auth } from "firebase-admin/auth";
import { getFirestore, type Firestore } from "firebase-admin/firestore";

/**
 * Firebase Admin SDK — usado APENAS no servidor (route handlers).
 * As credenciais vêm da service account, em variáveis de ambiente.
 *
 * Defina no .env.local e na Vercel:
 *   FIREBASE_PROJECT_ID
 *   FIREBASE_CLIENT_EMAIL
 *   FIREBASE_PRIVATE_KEY   (mantenha os \n; veja README/instruções)
 */
function getAdminApp(): App {
  const existing = getApps();
  if (existing.length > 0) return existing[0];

  const projectId   = process.env.FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  // Na Vercel a chave costuma vir com \n escapado — normalizamos aqui.
  const privateKey  = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n");

  if (!projectId || !clientEmail || !privateKey) {
    throw new Error(
      "Credenciais do Firebase Admin ausentes. Defina FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL e FIREBASE_PRIVATE_KEY."
    );
  }

  return initializeApp({
    credential: cert({ projectId, clientEmail, privateKey }),
  });
}

// Inicialização preguiçosa: só conecta ao Admin SDK quando a rota é chamada,
// evitando que o build quebre caso as variáveis não estejam definidas.
let cachedAuth: Auth | null = null;
export function getAdminAuth(): Auth {
  if (!cachedAuth) cachedAuth = getAuth(getAdminApp());
  return cachedAuth;
}

let cachedDb: Firestore | null = null;
/** Firestore via Admin SDK — escritas confiáveis do servidor (ex.: webhook do
 *  Asaas), ignorando as regras de segurança do cliente. */
export function getAdminDb(): Firestore {
  if (!cachedDb) cachedDb = getFirestore(getAdminApp());
  return cachedDb;
}
