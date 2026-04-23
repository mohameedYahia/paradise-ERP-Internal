import express from "express";
import { createServer as createViteServer } from "vite";
import multer from "multer";
import { google } from "googleapis";
import * as stream from "stream";
import path from "path";
import fs from "fs";
import os from "os";

// Store on disk temporarily to allow up to 1GB files without crashing node's memory
const upload = multer({
  dest: os.tmpdir(),
  limits: {
    fileSize: 1024 * 1024 * 1024, // 1GB limit
  },
});

async function startServer() {
  const app = express();
  const PORT = 3000;

  // Middleware for parsing JSON
  app.use(express.json());

  // API Route for uploading to Google Drive
  app.post("/api/upload", (req, res, next) => {
    upload.single("file")(req, res, (err) => {
      if (err instanceof multer.MulterError) {
        return res.status(400).json({ error: `Upload Error (Multer): ${err.message}` });
      } else if (err) {
        return res.status(500).json({ error: `Server Error (Upload): ${err.message}` });
      }
      next();
    });
  }, async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: "No file uploaded" });
      }

      const folderId = process.env.GOOGLE_DRIVE_FOLDER_ID;
      
      // OAuth2 Approach (Recommended for personal @gmail.com accounts)
      const clientId = process.env.GOOGLE_CLIENT_ID;
      const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
      const refreshToken = process.env.GOOGLE_REFRESH_TOKEN;

      // Service Account Approach (Only works with Google Workspace Shared Drives)
      const clientEmail = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
      const rawPrivateKey = process.env.GOOGLE_PRIVATE_KEY || '';
      let privateKey = rawPrivateKey.replace(/^["']|["']$/g, '').replace(/\\n/g, '\n');

      let authClient: any;

      if (clientId && clientSecret && refreshToken) {
        // Use OAuth2
        const oauth2Client = new google.auth.OAuth2(
          clientId,
          clientSecret,
          "https://developers.google.com/oauthplayground"
        );
        oauth2Client.setCredentials({ refresh_token: refreshToken });
        authClient = oauth2Client;
      } else if (clientEmail && privateKey && privateKey.trim() !== '') {
        // Use Service Account
        authClient = new google.auth.JWT({
          email: clientEmail,
          key: privateKey,
          scopes: ["https://www.googleapis.com/auth/drive.file"],
        });
        await (authClient as any).authorize();
      } else {
        if (req.file?.path) fs.unlink(req.file.path, () => {});
        return res.status(500).json({
          error: "Missing Google Drive credentials in environment variables. Provide either OAuth2 tokens or Service Account keys.",
        });
      }

      if (!folderId) {
        if (req.file?.path) fs.unlink(req.file.path, () => {});
        return res.status(500).json({ error: "Missing GOOGLE_DRIVE_FOLDER_ID" });
      }

      const drive = google.drive({ version: "v3", auth: authClient });

      const fileMetadata = {
        name: req.file.originalname,
        parents: [folderId],
      };

      const media = {
        mimeType: req.file.mimetype,
        body: fs.createReadStream(req.file.path), // Stream directly from disk
      };

      const driveFile = await drive.files.create({
        requestBody: fileMetadata,
        media: media,
        fields: "id, webViewLink, webContentLink",
        supportsAllDrives: true,
      });

      // Clean up the temporary file from disk
      fs.unlink(req.file.path, (err) => {
        if (err) console.error("Failed to delete temp file:", err);
      });

      const fileId = driveFile.data.id;

      if (fileId) {
        // Set permissions so anyone with the link can view
        try {
          await drive.permissions.create({
            fileId: fileId,
            supportsAllDrives: true,
            requestBody: {
              role: "reader",
              type: "anyone",
            },
          });
        } catch (permError: any) {
          console.warn("Could not set 'anyone' permission on Drive file (might be blocked by Workspace sharing policy):", permError.message);
          // We don't throw here, we still want to return the file link!
        }
      }

      // We prefer webViewLink for viewing in browser, webContentLink for direct download
      res.json({
        url: driveFile.data.webViewLink || driveFile.data.webContentLink,
        id: fileId
      });
    } catch (error: any) {
      console.error("Upload error details:", error);
      // Ensure temp file is cleaned up on error
      if (req.file?.path) {
        fs.unlink(req.file.path, () => {});
      }
      res.status(500).json({ error: error.message || "Failed to upload file to Google Drive" });
    }
  });

  // Catch unmatched API routes so they don't fall through to Vite SPA fallback
  app.all("/api/*", (req, res) => {
    res.status(404).json({ error: `API Route not found: ${req.method} ${req.path}` });
  });

  // Fallback API error handler (prevents Vite from serving HTML on API crashes)
  app.use("/api", (err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
    console.error("Global API Error:", err);
    res.status(500).json({ error: err.message || "Internal Server Error" });
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    // In production, serve the built static files
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
