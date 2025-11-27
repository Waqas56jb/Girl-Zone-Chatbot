// Vercel serverless function - imports handler from server.js
import { handleChat } from '../server.js';

export default async function handler(req, res) {
  return handleChat(req, res);
}

