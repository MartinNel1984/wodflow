// Offline-first score queue. A judge's "Save" always writes here first
// and returns instantly — this is the reliability fix, the whole
// reason Wodflow exists. Sync to the server happens in the background,
// with retry, and is idempotent server-side via client_submission_id.

const DB_NAME = "wodflow-offline";
const DB_VERSION = 1;
const STORE_NAME = "pending_scores";

export type PendingScore = {
  clientSubmissionId: string;
  heatAssignmentId: string;
  workoutId: string;
  workoutRefId?: string | null;
  rxOrScaled?: "rx" | "scaled" | null;
  tiebreakValue?: Record<string, unknown> | null;
  valueRaw: Record<string, unknown>;
  submittedAt: string;
  syncStatus: "pending" | "syncing" | "synced" | "failed";
  syncAttempts: number;
  lastError?: string;
};

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: "clientSubmissionId" });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function withStore<T>(
  mode: IDBTransactionMode,
  fn: (store: IDBObjectStore) => IDBRequest<T>
): Promise<T> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, mode);
    const store = tx.objectStore(STORE_NAME);
    const req = fn(store);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function enqueueScore(input: {
  heatAssignmentId: string;
  workoutId: string;
  workoutRefId?: string | null;
  rxOrScaled?: "rx" | "scaled" | null;
  tiebreakValue?: Record<string, unknown> | null;
  valueRaw: Record<string, unknown>;
}): Promise<PendingScore> {
  const item: PendingScore = {
    clientSubmissionId: crypto.randomUUID(),
    heatAssignmentId: input.heatAssignmentId,
    workoutId: input.workoutId,
    workoutRefId: input.workoutRefId ?? null,
    rxOrScaled: input.rxOrScaled ?? null,
    tiebreakValue: input.tiebreakValue ?? null,
    valueRaw: input.valueRaw,
    submittedAt: new Date().toISOString(),
    syncStatus: "pending",
    syncAttempts: 0,
  };
  await withStore("readwrite", (store) => store.put(item));
  return item;
}

export async function getAllPending(): Promise<PendingScore[]> {
  const all = await withStore<PendingScore[]>("readonly", (store) => store.getAll());
  return all.filter((item) => item.syncStatus === "pending" || item.syncStatus === "failed");
}

export async function getAll(): Promise<PendingScore[]> {
  return withStore<PendingScore[]>("readonly", (store) => store.getAll());
}

async function updateItem(id: string, patch: Partial<PendingScore>) {
  const existing = await withStore<PendingScore>("readonly", (store) => store.get(id));
  if (!existing) return;
  await withStore("readwrite", (store) => store.put({ ...existing, ...patch }));
}

// Attempts to sync every pending/failed item. Safe to call repeatedly
// and concurrently — each item transitions through 'syncing' so a
// second overlapping call skips items already in flight in practice
// (single-tab usage is the expected case; this isn't cross-tab-safe).
export async function syncPendingScores(submitFn: (item: PendingScore) => Promise<Response>) {
  const pending = await getAllPending();
  for (const item of pending) {
    await updateItem(item.clientSubmissionId, { syncStatus: "syncing" });
    try {
      const res = await submitFn(item);
      if (res.ok) {
        await updateItem(item.clientSubmissionId, { syncStatus: "synced" });
      } else if (res.status >= 400 && res.status < 500) {
        // Permanent rejection (bad request, RLS denial) — don't retry forever.
        const text = await res.text().catch(() => "");
        await updateItem(item.clientSubmissionId, {
          syncStatus: "failed",
          syncAttempts: item.syncAttempts + 1,
          lastError: text || `HTTP ${res.status}`,
        });
      } else {
        await updateItem(item.clientSubmissionId, {
          syncStatus: "pending",
          syncAttempts: item.syncAttempts + 1,
        });
      }
    } catch {
      // Network error / offline — leave it pending, retry later.
      await updateItem(item.clientSubmissionId, {
        syncStatus: "pending",
        syncAttempts: item.syncAttempts + 1,
      });
    }
  }
}
