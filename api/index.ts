/**
 * Vercel Serverless Function entry point.
 * Proxies all /api/* requests to the Express app.
 */
import app from "../server/index.js";

export default app;
