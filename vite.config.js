import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import https from 'node:https'
import http from 'node:http'

/**
 * Vite plugin that provides a proxy middleware at /api/catalog-proxy.
 * This allows the browser app to fetch files from corporate servers that
 * have custom SSL certificates or don't send CORS headers.
 *
 * Usage: GET /api/catalog-proxy?url=<encoded-target-url>
 * Forwards Authorization header if present.
 */
function catalogProxyPlugin() {
  return {
    name: 'catalog-proxy',
    configureServer(server) {
      server.middlewares.use('/api/catalog-proxy', (req, res) => {
        const parsed = new URL(req.url, 'http://localhost');
        const targetUrl = parsed.searchParams.get('url');

        if (!targetUrl) {
          res.writeHead(400, { 'Content-Type': 'text/plain' });
          res.end('Missing url query parameter');
          return;
        }

        let parsedTarget;
        try {
          parsedTarget = new URL(targetUrl);
        } catch {
          res.writeHead(400, { 'Content-Type': 'text/plain' });
          res.end('Invalid target URL');
          return;
        }

        const transport = parsedTarget.protocol === 'https:' ? https : http;
        const proxyHeaders = {};
        if (req.headers.authorization) {
          proxyHeaders['Authorization'] = req.headers.authorization;
        }

        const proxyReq = transport.request(parsedTarget, {
          method: 'GET',
          headers: proxyHeaders,
          rejectUnauthorized: false,
        }, (proxyRes) => {
          res.writeHead(proxyRes.statusCode, {
            'Content-Type': proxyRes.headers['content-type'] || 'text/plain',
            'Access-Control-Allow-Origin': '*',
          });
          proxyRes.pipe(res);
        });

        proxyReq.on('error', (err) => {
          res.writeHead(502, { 'Content-Type': 'text/plain' });
          res.end(`Proxy error: ${err.message}`);
        });

        proxyReq.end();
      });
    },
  };
}

export default defineConfig({
  plugins: [react(), tailwindcss(), catalogProxyPlugin()],
})
