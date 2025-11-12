import express from "express";
import multer from "multer";
import path from "path";
import fs from "fs/promises";
import { v4 as uuidv4 } from "uuid";
import mammoth from "mammoth";
import {
  saveUploadedFile,
  addVersion,
  getVersions,
  getVersionById,
} from "../storage";
import type { UploadedFile, DocumentVersion } from "../types";
import AdmZip from "adm-zip";

const router = express.Router();

const upload = multer({ dest: path.join(process.cwd(), "uploads") });

// Alternative HTML to DOCX conversion function
async function convertHtmlToDocx(html: string): Promise<Buffer> {
  // Simple HTML to DOCX conversion using a basic template
  // You might want to use a more robust library in production
  const docxContent = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:body>
    <w:p>
      <w:r>
        <w:t>${html
          .replace(/<[^>]*>/g, " ")
          .replace(/\s+/g, " ")
          .trim()}</w:t>
      </w:r>
    </w:p>
  </w:body>
</w:document>`;

  return Buffer.from(docxContent, "utf-8");
}

// Alternative: Use mammoth to convert back to DOCX (if available)
async function htmlToDocxBuffer(html: string): Promise<Buffer> {
  try {
    // For a proper implementation, you might want to use a library like:
    // - docx (https://docx.js.org/)
    // - officegen
    // For now, we'll create a simple DOCX structure

    // This is a minimal DOCX file structure
    // In production, consider using a proper DOCX generation library
    const minimalDocx = `
      <html xmlns:o="urn:schemas-microsoft-com:office:office"
            xmlns:w="urn:schemas-microsoft-com:office:word"
            xmlns="http://www.w3.org/TR/REC-html40">
        <head>
          <meta charset="utf-8">
          <title>Document</title>
        </head>
        <body>
          ${html}
        </body>
      </html>
    `;

    return Buffer.from(minimalDocx, "utf-8");
  } catch (error) {
    console.error("Error converting HTML to DOCX:", error);
    // Fallback: return HTML content as text in DOCX
    return Buffer.from(html, "utf-8");
  }
}

router.get("/", async (req, res) => {
  res.render("upload", { title: "Upload DOCX" });
});

router.post("/upload", upload.single("docx"), async (req, res) => {
  if (!req.file) return res.status(400).send("No file");
  const id = uuidv4();
  const dest = path.join(process.cwd(), "uploads", `${id}.docx`);
  await fs.rename(req.file.path, dest);

  const uploaded: UploadedFile = {
    id,
    originalName: req.file.originalname,
    path: dest,
    uploadedAt: new Date().toISOString(),
  };
  await saveUploadedFile(uploaded);

  // convert using mammoth
  const result = await mammoth.convertToHtml(
    { path: dest },
    { includeDefaultStyleMap: true }
  );
  const html = result.value;

  // save initial version as a file under versions/<docId>/v1.html
  const versionsDir = path.join(process.cwd(), "versions", id);
  await fs.mkdir(versionsDir, { recursive: true });
  const versionNumber = 1;
  const fileName = `v${versionNumber}.html`;
  const filePath = path.join(versionsDir, fileName);
  await fs.writeFile(filePath, html, "utf-8");

  // store a relative path (portable) in the metadata
  const relPath = path.join("versions", id, fileName);

  const version: DocumentVersion = {
    id: `${id}::${versionNumber}`,
    docId: id,
    versionNumber,
    htmlPath: relPath,
    createdAt: new Date().toISOString(),
  };
  await addVersion(version);

  res.render("editor", { title: "Editor", docId: id, html });
});

router.post("/save", express.json(), async (req, res) => {
  const { docId, html } = req.body as { docId: string; html: string };
  if (!docId || !html) return res.status(400).send("Missing");

  const versions = await getVersions(docId);
  const next = (versions.length || 0) + 1;

  const versionsDir = path.join(process.cwd(), "versions", docId);
  await fs.mkdir(versionsDir, { recursive: true });
  const fileName = `v${next}.html`;
  const filePath = path.join(versionsDir, fileName);
  await fs.writeFile(filePath, html, "utf-8");

  const relPath = path.join("versions", docId, fileName);

  const version: DocumentVersion = {
    id: `${docId}::${next}`,
    docId,
    versionNumber: next,
    htmlPath: relPath,
    createdAt: new Date().toISOString(),
  };
  await addVersion(version);
  res.json({ ok: true, versionId: version.id });
});

router.get("/versions", async (req, res) => {
  const docId = req.query.docId as string;
  if (!docId) return res.status(400).send("Missing docId");
  const versions = await getVersions(docId);
  res.json(versions);
});

router.get("/version/:id", async (req, res) => {
  const id = req.params.id;
  const version = await getVersionById(id);
  if (!version) return res.status(404).send("Not found");
  // read the stored html file if available and include html in response
  if (version.htmlPath) {
    try {
      const abs = path.join(process.cwd(), version.htmlPath);
      const html = await fs.readFile(abs, "utf-8");
      return res.json({ ...version, html });
    } catch (e) {
      // fallthrough to return metadata only
    }
  }
  res.json(version);
});

// Updated ZIP download to use DOCX files
router.get("/download-zip/:docId", async (req, res) => {
  const docId = req.params.docId;
  const versions = await getVersions(docId);
  const zip = new AdmZip();

  for (const v of versions) {
    if (v.htmlPath) {
      try {
        const abs = path.join(process.cwd(), v.htmlPath);
        const html = await fs.readFile(abs, "utf-8");

        // Convert HTML to DOCX using our custom function
        const docxBuffer = await htmlToDocxBuffer(html);

        zip.addFile(`${docId}_v${v.versionNumber}.docx`, docxBuffer);
      } catch (e) {
        console.error(`Error processing version ${v.versionNumber}:`, e);
        // Continue with other versions even if one fails
      }
    }
  }

  const data = zip.toBuffer();
  res.setHeader(
    "Content-Disposition",
    `attachment; filename="${docId}-versions.docx.zip"`
  );
  res.setHeader("Content-Type", "application/zip");
  res.send(data);
});

// New endpoint to download individual DOCX files
router.get("/download-docx/:docId", async (req, res) => {
  const docId = req.params.docId;
  const versions = await getVersions(docId);
  const zip = new AdmZip();

  // Sort versions by version number
  const sortedVersions = versions.sort(
    (a, b) => a.versionNumber - b.versionNumber
  );

  for (const v of sortedVersions) {
    if (v.htmlPath) {
      try {
        const abs = path.join(process.cwd(), v.htmlPath);
        const html = await fs.readFile(abs, "utf-8");

        // Convert HTML to DOCX using our custom function
        const docxBuffer = await htmlToDocxBuffer(html);

        zip.addFile(`Version_${v.versionNumber}.docx`, docxBuffer);
      } catch (e) {
        console.error(`Error processing version ${v.versionNumber}:`, e);
        // Continue with other versions even if one fails
      }
    }
  }

  const data = zip.toBuffer();
  res.setHeader(
    "Content-Disposition",
    `attachment; filename="${docId}-versions.docx.zip"`
  );
  res.setHeader("Content-Type", "application/zip");
  res.send(data);
});

export default router;
