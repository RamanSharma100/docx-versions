# Docs Version POC (Bun + TypeScript + Express + Mammoth)

This is a proof-of-concept app that allows uploading a .docx, converting it to HTML with Mammoth, editing in Quill, and saving versions. Built to run with Bun.

Features

- Upload .docx and convert to HTML (Mammoth)
- Edit HTML using Quill
- Save versions (stored in local data + versions folder)
- View versions in a sidebar, restore as new version
- Download all versions as ZIP (Adm-Zip)

Run (after installing deps with Bun):

```bash
cd d:/projects/docs-version
bun install
bun run start
```

Open http://localhost:3000

Notes

- This is a POC. Storage is a simple JSON file at `data/store.json`. Uploaded files are in `uploads/`.
- Mammoth can have limitations preserving fonts/colors — it preserves most structural formatting (bold, italics, lists, tables, headings).
