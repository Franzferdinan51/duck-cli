/**
 * 🦆 Duck Agent Web UI Server
 * Serves the web UI + API endpoints
 */

import { createServer } from 'http';
import { readFileSync, existsSync } from 'fs';
import { join, extname } from 'path';
import { Agent } from './agent/core.js';
import { TTSService } from './tools/tts.js';

const PORT = process.env.WEB_PORT || 3000;
const WEB_UI_PATH = join(process.cwd(), 'web-ui');

// Initialize agent
const agent = new Agent({ name: 'DuckWebAgent' });
agent.initialize();

// TTS instance
const tts = new TTSService({ 
  apiKey: process.env.MINIMAX_API_KEY || "sk-placeholder" 
});

const MIME_TYPES: Record<string, string> = {
  '.html': 'text/html',
  '.css': 'text/css',
  '.js': 'application/javascript',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
};

// Create server
const server = createServer(async (req, res) => {
  const url = new URL(req.url || '/', `http://localhost:${PORT}`);
  const path = url.pathname;
  
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  
  if (req.method === 'OPTIONS') {
    res.writeHead(200);
    res.end();
    return;
  }
  
  try {
    // API Routes
    if (path === '/api/status') {
      const status = agent.getStatus();
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        ...status,
        kairos: {
          enabled: false,
          heartbeatInterval: 30000,
          actionsToday: 0,
          patternsLearned: 0,
        }
      }));
      return;
    }
    
    if (path === '/api/chat') {
      let body = '';
      req.on('data', chunk => body += chunk);
      req.on('end', async () => {
        try {
          const { message } = JSON.parse(body);
          const response = await agent.think(message);
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ response }));
        } catch (error) {
          res.writeHead(500, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Chat failed' }));
        }
      });
      return;
    }
    
    if (path === '/api/tts') {
      let body = '';
      req.on('data', chunk => body += chunk);
      req.on('end', async () => {
        try {
          const { text, voice } = JSON.parse(body);
          tts.setVoice(voice || 'narrator');
          
          const result = await tts.speak({ 
            text, 
            outputPath: '/tmp/duck_tts.mp3' 
          });
          
          if (result.success) {
            const audio = readFileSync(result.path!);
            res.writeHead(200, { 
              'Content-Type': 'audio/mp3',
              'Content-Length': audio.length
            });
            res.end(audio);
          } else {
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: result.error }));
          }
        } catch (error) {
          res.writeHead(500, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'TTS failed' }));
        }
      });
      return;
    }
    
    if (path === '/api/tools') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        tools: agent.getStatus().toolList.map(t => ({
          name: t.name,
          description: t.description,
          dangerous: t.dangerous,
        })),
        count: agent.getStatus().tools,
      }));
      return;
    }
    
    if (path === '/api/think') {
      let body = '';
      req.on('data', chunk => body += chunk);
      req.on('end', async () => {
        try {
          const { prompt } = JSON.parse(body);
          const response = await agent.think(prompt);
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ response }));
        } catch (error) {
          res.writeHead(500, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Think failed' }));
        }
      });
      return;
    }
    
    // Static files
    let filePath = path === '/' ? '/index.html' : path;
    filePath = join(WEB_UI_PATH, filePath);
    
    // Security: prevent directory traversal
    if (!filePath.startsWith(WEB_UI_PATH)) {
      res.writeHead(403);
      res.end('Forbidden');
      return;
    }
    
    if (existsSync(filePath)) {
      const ext = extname(filePath);
      const mime = MIME_TYPES[ext] || 'application/octet-stream';
      
      const content = readFileSync(filePath);
      res.writeHead(200, { 'Content-Type': mime });
      res.end(content);
    } else {
      // Try index.html for SPA routing
      const indexPath = join(WEB_UI_PATH, 'index.html');
      if (existsSync(indexPath)) {
        const content = readFileSync(indexPath);
        res.writeHead(200, { 'Content-Type': 'text/html' });
        res.end(content);
      } else {
        res.writeHead(404);
        res.end('Not found');
      }
    }
  } catch (error) {
    console.error('Server error:', error);
    res.writeHead(500);
    res.end('Internal error');
  }
});

server.listen(PORT, () => {
  console.log(`
🦆 Duck Agent Web UI
━━━━━━━━━━━━━━━━━━━━
🌐 http://localhost:${PORT}
📁 Web UI: ${WEB_UI_PATH}
━━━━━━━━━━━━━━━━━━━━
  `);
});

export default server;
