const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = 3000;
const ROOT_DIR = __dirname;
const APP_DIR = path.join(__dirname, 'app');

const MIME_TYPES = {
    '.html': 'text/html; charset=utf-8',
    '.css': 'text/css; charset=utf-8',
    '.js': 'application/javascript; charset=utf-8',
    '.json': 'application/json; charset=utf-8',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.gif': 'image/gif',
    '.svg': 'image/svg+xml',
    '.ico': 'image/x-icon',
    '.woff': 'font/woff',
    '.woff2': 'font/woff2',
    '.ttf': 'font/ttf'
};

const server = http.createServer(async (req, res) => {
    let reqUrl = req.url.split('?')[0];

    // CORS headers for local development
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS, PUT, DELETE');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-CSRF-Token');

    if (req.method === 'OPTIONS') {
        res.writeHead(204);
        res.end();
        return;
    }

    // Handle Vercel API routes if requested
    if (reqUrl.startsWith('/api/')) {
        const apiPath = reqUrl.replace('/api/', '');
        const handlerFile = path.join(__dirname, 'api', apiPath + '.js');
        const handlerFileIndex = path.join(__dirname, 'api', apiPath, 'index.js');
        
        let targetFile = null;
        if (fs.existsSync(handlerFile)) targetFile = handlerFile;
        else if (fs.existsSync(handlerFileIndex)) targetFile = handlerFileIndex;

        if (targetFile) {
            try {
                delete require.cache[require.resolve(targetFile)];
                const handler = require(targetFile);
                if (typeof handler === 'function') {
                    res.status = (code) => { res.statusCode = code; return res; };
                    res.json = (data) => {
                        res.setHeader('Content-Type', 'application/json');
                        res.end(JSON.stringify(data));
                    };
                    
                    let body = '';
                    req.on('data', chunk => { body += chunk.toString(); });
                    req.on('end', async () => {
                        try {
                            req.body = body ? JSON.parse(body) : {};
                        } catch (e) {
                            req.body = {};
                        }
                        try {
                            await handler(req, res);
                        } catch (err) {
                            console.error(`[API Error] ${reqUrl}:`, err);
                            if (!res.writableEnded) {
                                res.statusCode = 500;
                                res.setHeader('Content-Type', 'application/json');
                                res.end(JSON.stringify({ error: err.message }));
                            }
                        }
                    });
                    return;
                }
            } catch (err) {
                console.error(`[API Load Error] ${reqUrl}:`, err);
            }
        }
    }

    // Rewrite routes to app/index.html
    let filePath = path.join(APP_DIR, reqUrl);
    if (reqUrl === '/' || reqUrl === '/app' || reqUrl === '/app/') {
        filePath = path.join(APP_DIR, 'index.html');
    }

    // If path doesn't exist in APP_DIR, check ROOT_DIR
    if (!fs.existsSync(filePath)) {
        filePath = path.join(ROOT_DIR, reqUrl);
    }

    // If directory, append index.html
    if (fs.existsSync(filePath) && fs.statSync(filePath).isDirectory()) {
        filePath = path.join(filePath, 'index.html');
    }

    // Fallback to app/index.html for SPA routes
    if (!fs.existsSync(filePath)) {
        filePath = path.join(APP_DIR, 'index.html');
    }

    const ext = path.extname(filePath).toLowerCase();
    const contentType = MIME_TYPES[ext] || 'application/octet-stream';

    fs.readFile(filePath, (err, content) => {
        if (err) {
            res.writeHead(500);
            res.end(`Server Error: ${err.code}`);
        } else {
            res.writeHead(200, { 'Content-Type': contentType });
            res.end(content, 'utf-8');
        }
    });
});

server.listen(PORT, () => {
    console.log(`🚀 Servidor Local rodando em http://localhost:${PORT}`);
});
