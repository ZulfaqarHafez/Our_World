/**
 * Vercel Serverless Function entry point.
 * Proxies all /api/* requests to the Express app.
 */
import app from "../server/index.js";

/**
 * Disable Vercel's built-in body parser (default 4.5 MB limit).
 * This lets Express + multer handle multipart uploads directly,
 * allowing file uploads up to our own 6 MB multer limit.
 */
export const config = {
  api: {
    bodyParser: false,
  },
};

export default app;
