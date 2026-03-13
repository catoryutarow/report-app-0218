import {
  collection,
  doc,
  addDoc,
  setDoc,
  updateDoc,
  deleteDoc,
  getDocs,
  getDoc,
  query,
  where,
  orderBy,
  writeBatch,
  Timestamp,
  type DocumentData,
  type QueryConstraint,
} from "firebase/firestore";
import { db } from "./config";

// Helper: all Firestore operations call db() to get the lazy-initialized instance

// ---- Accounts ----

export type Platform =
  | "ig_feed"
  | "ig_reel"
  | "yt_long"
  | "yt_short"
  | "tiktok"
  | "x"
  | "ga4"
  | "gsc";

export type Account = {
  id?: string;
  platform: Platform;
  name: string;
  handle: string;
  avatarUrl?: string;
  targets: Record<string, number>;
  tags: {
    formats: string[];
    themes: string[];
    ctas: string[];
    hooks: string[];
  };
  createdAt?: Timestamp;
};

function accountsRef() {
  return collection(db(), "accounts");
}

export async function getAccounts(): Promise<Account[]> {
  const snap = await getDocs(query(accountsRef(), orderBy("createdAt", "desc")));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Account);
}

export async function getAccount(id: string): Promise<Account | null> {
  const snap = await getDoc(doc(db(), "accounts", id));
  if (!snap.exists()) return null;
  return { id: snap.id, ...snap.data() } as Account;
}

export async function createAccount(data: Omit<Account, "id" | "createdAt">) {
  return addDoc(accountsRef(), { ...data, createdAt: Timestamp.now() });
}

export async function updateAccount(id: string, data: Partial<Account>) {
  return updateDoc(doc(db(), "accounts", id), data as DocumentData);
}

export async function deleteAccount(id: string) {
  return deleteDoc(doc(db(), "accounts", id));
}

// ---- Posts ----

export type Post = {
  id?: string;
  postKey: string;
  title?: string;
  publishedAt: Timestamp;
  /** When the metrics were actually recorded/observed (for data freshness tracking) */
  capturedAt?: Timestamp;
  permalink?: string;
  tags: {
    format?: string;
    theme?: string;
    cta?: string;
    hook?: string;
  };
  metrics: Record<string, number>;
  calculatedKpis: Record<string, number>;
  source: "manual" | "csv" | "api";
  notes?: string;
};

function postsRef(accountId: string) {
  return collection(db(), "accounts", accountId, "posts");
}

export async function getPosts(
  accountId: string,
  ...constraints: QueryConstraint[]
): Promise<Post[]> {
  const q = query(postsRef(accountId), orderBy("publishedAt", "desc"), ...constraints);
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Post);
}

export async function getPostsByPeriod(
  accountId: string,
  start: Date,
  end: Date
): Promise<Post[]> {
  const q = query(
    postsRef(accountId),
    where("publishedAt", ">=", Timestamp.fromDate(start)),
    where("publishedAt", "<=", Timestamp.fromDate(end)),
    orderBy("publishedAt", "desc")
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Post);
}

export async function createPost(accountId: string, data: Omit<Post, "id">) {
  return addDoc(postsRef(accountId), data);
}

export async function updatePost(accountId: string, postId: string, data: Partial<Post>) {
  return updateDoc(doc(db(), "accounts", accountId, "posts", postId), data as DocumentData);
}

export async function deletePost(accountId: string, postId: string) {
  return deleteDoc(doc(db(), "accounts", accountId, "posts", postId));
}

export async function batchCreatePosts(accountId: string, posts: Omit<Post, "id">[]) {
  const batch = writeBatch(db());
  for (const post of posts) {
    const ref = doc(postsRef(accountId));
    batch.set(ref, post);
  }
  return batch.commit();
}

// ---- Snapshots ----

export type Snapshot = {
  id?: string;
  periodStart: Timestamp;
  periodEnd: Timestamp;
  importedAt: Timestamp;
  label: string;
  postCount: number;
  /** Aggregated metric totals across all posts in this snapshot */
  totals: Record<string, number>;
  /** Manually entered channel-level summary (e.g. from TikTok overview).
   *  Used as the channel-overview KPI perspective alongside per-post initial performance data. */
  channelSummary?: Record<string, number>;
};

function snapshotsRef(accountId: string) {
  return collection(db(), "accounts", accountId, "snapshots");
}

function snapshotPostsRef(accountId: string, snapshotId: string) {
  return collection(db(), "accounts", accountId, "snapshots", snapshotId, "posts");
}

export async function getSnapshots(accountId: string): Promise<Snapshot[]> {
  try {
    // Try with orderBy (needs index)
    const q = query(snapshotsRef(accountId), orderBy("periodEnd", "desc"));
    const snap = await getDocs(q);
    return snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Snapshot);
  } catch {
    // Fallback: no ordering, sort client-side
    const snap = await getDocs(snapshotsRef(accountId));
    const results = snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Snapshot);
    return results.sort((a, b) => {
      const aTime = a.periodEnd?.toDate?.()?.getTime() ?? 0;
      const bTime = b.periodEnd?.toDate?.()?.getTime() ?? 0;
      return bTime - aTime;
    });
  }
}

export async function getSnapshotPosts(accountId: string, snapshotId: string): Promise<Post[]> {
  const snap = await getDocs(snapshotPostsRef(accountId, snapshotId));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Post);
}

export async function createSnapshotWithPosts(
  accountId: string,
  snapshotData: Omit<Snapshot, "id">,
  posts: Omit<Post, "id">[]
): Promise<string> {
  const snapshotDocRef = await addDoc(snapshotsRef(accountId), snapshotData);

  // Batch create posts under snapshot (500 per batch)
  for (let i = 0; i < posts.length; i += 500) {
    const batch = writeBatch(db());
    const chunk = posts.slice(i, i + 500);
    for (const post of chunk) {
      const ref = doc(snapshotPostsRef(accountId, snapshotDocRef.id));
      batch.set(ref, post);
    }
    await batch.commit();
  }

  return snapshotDocRef.id;
}

export async function updateSnapshot(
  accountId: string,
  snapshotId: string,
  data: Partial<Omit<Snapshot, "id">>
) {
  return updateDoc(
    doc(db(), "accounts", accountId, "snapshots", snapshotId),
    data as DocumentData
  );
}

export async function addPostsToSnapshot(
  accountId: string,
  snapshotId: string,
  posts: Omit<Post, "id">[]
): Promise<void> {
  for (let i = 0; i < posts.length; i += 500) {
    const batch = writeBatch(db());
    const chunk = posts.slice(i, i + 500);
    for (const post of chunk) {
      const ref = doc(snapshotPostsRef(accountId, snapshotId));
      batch.set(ref, post);
    }
    await batch.commit();
  }
  // Update snapshot post count and totals
  const allPosts = await getSnapshotPosts(accountId, snapshotId);
  const totals: Record<string, number> = {};
  for (const p of allPosts) {
    for (const [key, val] of Object.entries(p.metrics)) {
      totals[key] = (totals[key] ?? 0) + val;
    }
  }
  await updateSnapshot(accountId, snapshotId, {
    postCount: allPosts.length,
    totals,
  });
}

export async function deleteSnapshot(accountId: string, snapshotId: string) {
  // Delete all posts under snapshot first
  const postsSnap = await getDocs(snapshotPostsRef(accountId, snapshotId));
  for (let i = 0; i < postsSnap.docs.length; i += 500) {
    const batch = writeBatch(db());
    postsSnap.docs.slice(i, i + 500).forEach((d) => batch.delete(d.ref));
    await batch.commit();
  }
  await deleteDoc(doc(db(), "accounts", accountId, "snapshots", snapshotId));
}

// ---- Instagram API Settings (per-account, managed via src/app/api/ig/lib.ts) ----
