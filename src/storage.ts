import fs from "fs/promises";
import path from "path";
import type { UploadedFile, DocumentVersion } from "./types";

const DATA_FILE = path.join(process.cwd(), "data", "store.json");

type StoreShape = {
  files: Record<string, UploadedFile>;
  versions: Record<string, DocumentVersion[]>; // keyed by docId
};

const defaultStore: StoreShape = { files: {}, versions: {} };

async function ensureDataDir() {
  const dir = path.join(process.cwd(), "data");
  try {
    await fs.mkdir(dir, { recursive: true });
  } catch (e) {
    // ignore
  }
}

export async function readStore(): Promise<StoreShape> {
  await ensureDataDir();
  try {
    const raw = await fs.readFile(DATA_FILE, "utf-8");
    return JSON.parse(raw) as StoreShape;
  } catch (e) {
    return defaultStore;
  }
}

export async function writeStore(store: StoreShape) {
  await ensureDataDir();
  await fs.writeFile(DATA_FILE, JSON.stringify(store, null, 2), "utf-8");
}

export async function saveUploadedFile(file: UploadedFile) {
  const store = await readStore();
  store.files[file.id] = file;
  if (!store.versions[file.id]) store.versions[file.id] = [];
  await writeStore(store);
}

export async function addVersion(version: DocumentVersion) {
  const store = await readStore();
  if (!store.versions[version.docId]) store.versions[version.docId] = [];
  store.versions[version.docId].push(version);
  await writeStore(store);
}

export async function getVersions(docId: string): Promise<DocumentVersion[]> {
  const store = await readStore();
  return store.versions[docId] || [];
}

export async function getVersionById(
  versionId: string
): Promise<DocumentVersion | null> {
  const store = await readStore();
  for (const key of Object.keys(store.versions)) {
    const found = store.versions[key].find((v) => v.id === versionId);
    if (found) return found;
  }
  return null;
}
