const http = require("http");
const fs = require("fs");
const path = require("path");

const args = process.argv.slice(2);
let port = process.env.PORT || 3000;
for (let i = 0; i < args.length; i++) {
  if (args[i] === "--port" && args[i + 1]) {
    port = parseInt(args[i + 1], 10);
  }
}

const WWW_DIR = path.resolve(__dirname, "www");

const MIME_TYPES = {
  ".html": "text/html; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".mjs": "application/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
  ".ttf": "font/ttf",
  ".map": "application/json"
};

const server = http.createServer((req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, HEAD, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "*");

  if (req.method === "OPTIONS") {
    res.writeHead(204);
    res.end();
    return;
  }

  const urlPath = req.url.split("?")[0];
  const targetPath = path.resolve(WWW_DIR, "." + urlPath);

  // Prevent directory traversal
  if (!targetPath.startsWith(WWW_DIR)) {
    res.writeHead(403, { "Content-Type": "text/plain" });
    res.end("Forbidden");
    return;
  }

  fs.stat(targetPath, (err, stats) => {
    if (!err && stats.isFile()) {
      const ext = path.extname(targetPath).toLowerCase();
      const contentType = MIME_TYPES[ext] || "application/octet-stream";
      res.writeHead(200, { "Content-Type": contentType });
      fs.createReadStream(targetPath).pipe(res);
    } else {
      const indexPath = path.join(WWW_DIR, "index.html");
      fs.readFile(indexPath, (readErr, content) => {
        if (readErr) {
          res.writeHead(404, { "Content-Type": "text/plain" });
          res.end("Not Found");
        } else {
          res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
          res.end(content);
        }
      });
    }
  });
});

server.listen(port, "0.0.0.0", () => {
  console.log("App serving from " + WWW_DIR + " on http://0.0.0.0:" + port);
});
