export interface UploadedFile {
  id: string; // document id
  originalName: string;
  path: string; // server path
  uploadedAt: string; // ISO
}

export interface DocumentVersion {
  id: string; // version id (docId::versionNumber)
  docId: string;
  versionNumber: number;
  // path on server to the stored HTML file for this version
  htmlPath?: string;
  // optional: HTML may be provided when returning content to client
  html?: string;
  createdAt: string; // ISO
}
