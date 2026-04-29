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

  async function getGoogleAuthClient() {
    const clientId = process.env.GOOGLE_CLIENT_ID;
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
    const refreshToken = process.env.GOOGLE_REFRESH_TOKEN;

    const clientEmail = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
    const rawPrivateKey = process.env.GOOGLE_PRIVATE_KEY || '';
    let privateKey = rawPrivateKey.replace(/^["']|["']$/g, '').replace(/\\n/g, '\n');

    if (clientId && clientSecret && refreshToken) {
      const oauth2Client = new google.auth.OAuth2(
        clientId,
        clientSecret,
        "https://developers.google.com/oauthplayground"
      );
      oauth2Client.setCredentials({ refresh_token: refreshToken });
      return oauth2Client;
    } else if (clientEmail && privateKey && privateKey.trim() !== '') {
      const authClient = new google.auth.JWT({
        email: clientEmail,
        key: privateKey,
        scopes: ["https://www.googleapis.com/auth/drive.file"],
      });
      await authClient.authorize();
      return authClient;
    } else {
      throw new Error("Missing Google Drive credentials in environment variables.");
    }
  }

  app.post("/api/upload/init", async (req, res) => {
    try {
      const { name, mimeType } = req.body;
      const folderId = process.env.GOOGLE_DRIVE_FOLDER_ID;
      
      if (!folderId) {
        return res.status(500).json({ error: "Missing GOOGLE_DRIVE_FOLDER_ID" });
      }

      let authClient;
      let accessToken;
      try {
        authClient = await getGoogleAuthClient();
        accessToken = await authClient.getAccessToken();
      } catch (authError: any) {
        console.error("Google Drive Auth Error:", authError);
        const errorMsg = authError.message || authError.response?.data?.error || "Authentication failed";
        if (errorMsg === "invalid_grant" || errorMsg.includes("invalid_grant")) {
          return res.status(401).json({ error: "خطأ في تسجيل الدخول لـ Google Drive: يرجى تحديث GOOGLE_REFRESH_TOKEN الخاص بك في الإعدادات، فقد انتهت صلاحيته." });
        }
        return res.status(500).json({ error: `Google Drive Auth Error: ${errorMsg}` });
      }

      const metadata = {
        name: name,
        parents: [folderId],
      };

      const response = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=resumable&supportsAllDrives=true', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken.token || accessToken}`,
          'Content-Type': 'application/json',
          'X-Upload-Content-Type': mimeType,
          'Origin': req.headers.origin || '',
        },
        body: JSON.stringify(metadata)
      });

      if (!response.ok) {
        const errorText = await response.text();
        return res.status(500).json({ error: "Failed to initiate resumable upload", details: errorText });
      }

      const uploadUrl = response.headers.get('location');
      res.json({ uploadUrl });
    } catch (error: any) {
      console.error("Initiate upload error:", error);
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/upload/finalize", async (req, res) => {
    try {
      const { fileId } = req.body;
      if (!fileId) return res.status(400).json({ error: "Missing fileId" });

      let authClient;
      try {
        authClient = await getGoogleAuthClient();
      } catch (authError: any) {
        console.error("Google Drive Auth Error:", authError);
        const errorMsg = authError.message || authError.response?.data?.error || "Authentication failed";
        if (errorMsg === "invalid_grant" || errorMsg.includes("invalid_grant")) {
          return res.status(401).json({ error: "خطأ في تسجيل الدخول لـ Google Drive: يرجى تحديث GOOGLE_REFRESH_TOKEN الخاص بك في الإعدادات، فقد انتهت صلاحيته." });
        }
        return res.status(500).json({ error: `Google Drive Auth Error: ${errorMsg}` });
      }
      const drive = google.drive({ version: "v3", auth: authClient });
      
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
        console.warn("Could not set 'anyone' permission:", permError.message);
      }
      
      const driveFile = await drive.files.get({
        fileId: fileId,
        fields: "webViewLink, webContentLink",
        supportsAllDrives: true
      });
      
      res.json({
        url: driveFile.data.webViewLink || driveFile.data.webContentLink,
        id: fileId
      });
      
    } catch (error: any) {
      console.error("Finalize upload error:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // Legacy API Route for uploading to Google Drive
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
