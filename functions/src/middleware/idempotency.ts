import { getFirestore, FieldValue } from "firebase-admin/firestore";
import { Collections, Timeouts } from "../config/constants";
import { IdempotencyError } from "../utils/errors";
import * as logger from "../utils/logger";

const db = () => getFirestore();

export async function checkIdempotency(key: string): Promise<boolean> {
  const docRef = db().collection(Collections.IDEMPOTENCY_KEYS).doc(key);

  try {
    const result = await db().runTransaction(async (tx) => {
      const doc = await tx.get(docRef);

      if (doc.exists) {
        const data = doc.data();
        const createdAt = data?.createdAt?.toDate?.();
        if (createdAt) {
          const ttlMs = Timeouts.IDEMPOTENCY_KEY_TTL_HOURS * 60 * 60 * 1000;
          if (Date.now() - createdAt.getTime() < ttlMs) {
            return false; // duplicate
          }
        }
        // expired — overwrite
      }

      tx.set(docRef, {
        createdAt: FieldValue.serverTimestamp(),
        processedAt: null,
        result: null,
      });

      return true; // new key
    });

    return result;
  } catch (err) {
    logger.error("Idempotency check failed", err);
    throw err;
  }
}

export async function markIdempotencyProcessed(
  key: string,
  result: string
): Promise<void> {
  const docRef = db().collection(Collections.IDEMPOTENCY_KEYS).doc(key);
  await docRef.update({
    processedAt: FieldValue.serverTimestamp(),
    result,
  });
}

export async function ensureIdempotent(key: string): Promise<void> {
  const isNew = await checkIdempotency(key);
  if (!isNew) {
    throw new IdempotencyError(key);
  }
}
