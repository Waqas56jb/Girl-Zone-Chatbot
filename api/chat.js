// Vercel serverless function - imports handler from server.js
import 'dotenv/config';
import { handleChat } from '../server.js';

export default async function handler(req, res) {
  // Vercel automatically parses JSON body, so we set it on req
  if (req.body && typeof req.body === 'string') {
    try {
      req.body = JSON.parse(req.body);
    } catch (e) {
      // Already parsed or invalid
    }
  }
  return handleChat(req, res);
}

