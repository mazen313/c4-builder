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

/**
 * Vite plugin that discovers all .dsl files in a remote directory.
 * Supports Azure DevOps Server (on-prem) Items API for automatic file listing.
 *
 * Usage: GET /api/catalog-discover?url=<encoded-base-url>
 * Returns: JSON array of relative file paths (e.g., ["systemcatalog/cmdb.dsl", "platform/keycloak.dsl"])
 */
function catalogDiscoverPlugin() {
  return {
    name: 'catalog-discover',
    configureServer(server) {
      server.middlewares.use('/api/catalog-discover', (req, res) => {
        const parsed = new URL(req.url, 'http://localhost');
        const baseUrl = parsed.searchParams.get('url');

        if (!baseUrl) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Missing url query parameter' }));
          return;
        }

        // Detect Azure DevOps Server URL pattern and build Items API URL
        // Input: https://devops.company.com/Collection/Project/_git/Repo?path=/common&version=GBmain
        const adoMatch = baseUrl.match(
          /^(https?:\/\/[^/]+(?:\/[^/]+)?)\/([^/]+)\/_git\/([^?/]+)\?.*path=([^&]+)(?:&version=GB(.+))?/
        );

        if (!adoMatch) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'URL format not supported for discovery. Use Azure DevOps Server URL with ?path= parameter.' }));
          return;
        }

        const [, adoBase, project, repo, scopePath, branch] = adoMatch;
        const apiUrl = new URL(
          `${adoBase}/${project}/_apis/git/repositories/${repo}/items`
        );
        apiUrl.searchParams.set('scopePath', decodeURIComponent(scopePath));
        apiUrl.searchParams.set('recursionLevel', 'Full');
        apiUrl.searchParams.set('api-version', '7.0');
        if (branch) apiUrl.searchParams.set('versionDescriptor.version', branch);

        const transport = apiUrl.protocol === 'https:' ? https : http;
        const proxyHeaders = { 'Accept': 'application/json' };
        if (req.headers.authorization) {
          proxyHeaders['Authorization'] = req.headers.authorization;
        }

        const proxyReq = transport.request(apiUrl, {
          method: 'GET',
          headers: proxyHeaders,
          rejectUnauthorized: false,
        }, (proxyRes) => {
          let body = '';
          proxyRes.on('data', (chunk) => { body += chunk; });
          proxyRes.on('end', () => {
            if (proxyRes.statusCode !== 200) {
              res.writeHead(proxyRes.statusCode, {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*',
              });
              res.end(JSON.stringify({ error: `Azure DevOps API returned ${proxyRes.statusCode}`, body }));
              return;
            }

            try {
              const data = JSON.parse(body);
              const items = data.value || [];
              // Extract .dsl file paths relative to the scopePath
              const basePath = decodeURIComponent(scopePath).replace(/^\//, '').replace(/\/$/, '');
              const files = items
                .filter(item => !item.isFolder && item.path && item.path.endsWith('.dsl'))
                .map(item => {
                  // item.path is like "/common/systemcatalog/cmdb.dsl"
                  // Strip the base path prefix to get "systemcatalog/cmdb.dsl"
                  const fullPath = item.path.replace(/^\//, '');
                  return fullPath.startsWith(basePath + '/')
                    ? fullPath.slice(basePath.length + 1)
                    : fullPath;
                });

              res.writeHead(200, {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*',
              });
              res.end(JSON.stringify(files));
            } catch (err) {
              res.writeHead(500, {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*',
              });
              res.end(JSON.stringify({ error: `Failed to parse API response: ${err.message}` }));
            }
          });
        });

        proxyReq.on('error', (err) => {
          res.writeHead(502, {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
          });
          res.end(JSON.stringify({ error: `Proxy error: ${err.message}` }));
        });

        proxyReq.end();
      });
    },
  };
}

export default defineConfig({
  plugins: [react(), tailwindcss(), catalogProxyPlugin(), catalogDiscoverPlugin()],
})
