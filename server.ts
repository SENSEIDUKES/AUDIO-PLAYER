import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { createAgentScoutHandler } from "./src/server/agentScout";

async function startServer() {
  const app = express();
  const PORT = 3000;

  // The agentScoutHandler expects a Web Request/Response. We can adapt it manually.
  const scoutHandler = createAgentScoutHandler({
    rateLimit: async () => ({ allowed: true }),
  });

  app.post("/api/agent-scout", express.raw({ type: 'application/json' }), async (req, res) => {
    try {
      const fullUrl = `${req.protocol}://${req.get('host')}${req.originalUrl}`;
      const webReq = new Request(fullUrl, {
        method: req.method,
        headers: req.headers as any,
        body: req.method === "POST" ? req.body : undefined,
      });
      
      const webRes = await scoutHandler.fetch(webReq);
      
      res.status(webRes.status);
      webRes.headers.forEach((value, key) => {
        res.setHeader(key, value);
      });
      
      const body = await webRes.text();
      res.send(body);
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
