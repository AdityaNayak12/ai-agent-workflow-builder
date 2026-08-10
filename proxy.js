const http = require('http');
const https = require('https');

function createProxy(localPort, targetHost) {
  const server = http.createServer((req, res) => {
    // Add CORS headers for browser requests
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS, PATCH');
    res.setHeader('Access-Control-Allow-Headers', '*');

    if (req.method === 'OPTIONS') {
      res.writeHead(204);
      res.end();
      return;
    }

    // Special handling for Nhost functions on port 1337
    if (localPort === 1337 && req.url.startsWith('/v1/functions/')) {
      const targetPath = req.url.replace('/v1/functions', '');
      const options = {
        hostname: 'localhost',
        port: 5050,
        path: targetPath,
        method: req.method,
        headers: req.headers,
      };

      const proxyReq = http.request(options, proxyRes => {
        res.writeHead(proxyRes.statusCode, proxyRes.headers);
        proxyRes.pipe(res, { end: true });
      });

      proxyReq.on('error', err => {
        console.error(`Functions Proxy Error on port 1337:`, err.message);
        res.writeHead(502);
        res.end('Bad Gateway: ' + err.message);
      });

      req.pipe(proxyReq, { end: true });
      return;
    }

    const options = {
      hostname: targetHost,
      port: 443,
      path: req.url,
      method: req.method,
      headers: {
        ...req.headers,
        host: targetHost,
      },
      rejectUnauthorized: false, // Bypass self-signed SSL check for local dev
    };

    const proxyReq = https.request(options, proxyRes => {
      res.writeHead(proxyRes.statusCode, proxyRes.headers);
      proxyRes.pipe(res, { end: true });
    });

    proxyReq.on('error', err => {
      console.error(`Proxy Error on port ${localPort}:`, err.message);
      res.writeHead(502);
      res.end('Bad Gateway: ' + err.message);
    });

    req.pipe(proxyReq, { end: true });
  });

  server.listen(localPort, () => console.log(`HTTP Local Proxy listening on http://localhost:${localPort} -> https://${targetHost}:443`));
}

// Proxy 1337 -> Hasura Auth & Local Functions
createProxy(1337, 'local.auth.local.nhost.run');

// Proxy 8080 -> Hasura GraphQL
createProxy(8080, 'local.hasura.local.nhost.run');
