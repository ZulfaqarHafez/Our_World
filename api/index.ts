/**
 * Vercel Serverless Function entry point.
 * Proxies all /api/* requests to the Express app.
 */
import app from "../server/index.js";

// Disable Vercel's built-in body parser so multer can handle
// multipart file uploads (avoids 413 Payload Too Large errors)
export const config = {
  api: {
    bodyParser: false,
  },
};

export default app;
