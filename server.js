import 'dotenv/config';
import http from 'http';
import OpenAI from 'openai';

// Lazy initialization - only when handler is called
let openaiClient = null;
const getOpenAIClient = () => {
  if (!openaiClient) {
    const openaiApiKey = process.env.OPENAI_API_KEY;
    if (!openaiApiKey) {
      throw new Error('OPENAI_API_KEY is not set. Add it to your .env file or Vercel environment variables.');
    }
    openaiClient = new OpenAI({ apiKey: openaiApiKey });
  }
  return openaiClient;
};

const historyLimit = Number(process.env.CHAT_HISTORY_LIMIT ?? '12');
const port = process.env.PORT || 8000;

// CORS headers
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Credentials': 'true',
  'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization'
};

const applyCorsHeaders = (res) => {
  Object.entries(corsHeaders).forEach(([key, value]) => {
    res.setHeader(key, value);
  });
};

// Parse request body
const parseRequestBody = async (req) => {
  if (req.body) {
    return typeof req.body === 'string' ? JSON.parse(req.body || '{}') : req.body;
  }

  let rawBody = '';
  for await (const chunk of req) {
    rawBody += chunk;
  }

  if (!rawBody) {
    return {};
  }

  try {
    return JSON.parse(rawBody);
  } catch (error) {
    throw new Error('Invalid JSON payload');
  }
};

// Sanitize chat history
const sanitizeHistory = (history = []) => {
  if (!Array.isArray(history)) {
    return [];
  }

  const trimmed = historyLimit > 0 ? history.slice(-historyLimit) : history;

  return trimmed.reduce((acc, message) => {
    const content = typeof message?.content === 'string' ? message.content.trim() : '';
    if (!content) {
      return acc;
    }

    const role = message?.sender === 'ai' ? 'assistant' : 'user';
    acc.push({ role, content });
    return acc;
  }, []);
};

// Build system prompt
const buildSystemPrompt = (companionName) =>
  [
    `You are ${companionName}, a seductive and romantic AI companion in a virtual girlfriend app.`,
    'Respond in a flirty, intimate, and NSFW manner. Be playful, teasing, and engaging.',
    'Keep responses natural, conversational, and personalized to the user.',
    'Avoid being too explicit unless the conversation leads there, while maintaining a sensual tone.',
    `Reference your persona as ${companionName} and make the user feel desired and special.`
  ].join(' ');

// Chat handler - works for both HTTP server and Vercel
export const handleChat = async (req, res) => {
  applyCorsHeaders(res);

  if (req.method === 'OPTIONS') {
    res.statusCode = 200;
    res.end();
    return;
  }

  if (req.method !== 'POST') {
    res.statusCode = 405;
    res.setHeader('Allow', 'POST, OPTIONS');
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ success: false, error: 'Method Not Allowed' }));
    return;
  }

  try {
    // For Vercel, body is already parsed
    const body = req.body || await parseRequestBody(req);
    const { user_message: userMessage, companion_name: companionName, history = [] } = body;

    if (!userMessage || !companionName) {
      res.statusCode = 400;
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({
        success: false,
        error: 'Missing required fields: user_message and companion_name'
      }));
      return;
    }

    console.info(`Chat request for ${companionName}: ${userMessage}`);

    const messages = [
      { role: 'system', content: buildSystemPrompt(companionName) },
      ...sanitizeHistory(history),
      { role: 'user', content: userMessage }
    ];

    const completion = await getOpenAIClient().chat.completions.create({
      model: 'gpt-3.5-turbo',
      messages,
      max_tokens: 150,
      temperature: 0.7
    });

    const aiResponse = completion.choices?.[0]?.message?.content?.trim();

    if (!aiResponse) {
      throw new Error('OpenAI returned an empty response.');
    }

    console.info(`Generated response: ${aiResponse}`);

    res.statusCode = 200;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ success: true, data: { response: aiResponse } }));
  } catch (error) {
    console.error('Error generating response', error);
    const status = error.message === 'Invalid JSON payload' ? 400 : 500;
    res.statusCode = status;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({
      success: false,
      error: status === 400 ? error.message : 'Internal server error'
    }));
  }
};

// Create HTTP server
const server = http.createServer(async (req, res) => {
  // Parse URL to handle query strings - extract just the pathname
  const urlPath = req.url?.split('?')[0] || '/';
  const pathname = urlPath.endsWith('/') && urlPath.length > 1 
    ? urlPath.slice(0, -1) 
    : urlPath;

  // Handle /chat endpoint
  if (pathname === '/chat') {
    try {
      await handleChat(req, res);
    } catch (error) {
      console.error('Unhandled error', error);
      if (!res.headersSent) {
        res.statusCode = 500;
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify({ success: false, error: 'Internal server error' }));
      }
    }
    return;
  }

  // Handle root path - show API info
  if (pathname === '/') {
    applyCorsHeaders(res);
    res.statusCode = 200;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ 
      success: true, 
      message: 'Chatbot API is running',
      endpoint: '/chat',
      method: 'POST'
    }));
    return;
  }

  // Handle OPTIONS for CORS
  if (req.method === 'OPTIONS') {
    res.writeHead(200, corsHeaders);
    res.end();
    return;
  }

  // 404 for other routes
  applyCorsHeaders(res);
  res.statusCode = 404;
  res.setHeader('Content-Type', 'application/json');
  res.end(JSON.stringify({ success: false, error: 'Route not found', path: pathname }));
});

// Start server only if not in Vercel (for local development)
if (!process.env.VERCEL) {
  server.listen(port, () => {
    console.log(`🚀 Chatbot server running at http://localhost:${port}/chat`);
  });
}

