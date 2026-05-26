/**
 * Servidor HTTP minimo para o Render.com (health check)
 * Tambem aciona o worker quando recebe GET /transmitir
 */
import http from "http";
import { run } from "./worker.js";

const PORT = process.env.PORT || 8080;
let rodando = false;

const server = http.createServer(async (req, res) => {
  const url = req.url?.split("?")[0];

  // Health check do Render
  if (url === "/" || url === "/health") {
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ ok: true, status: rodando ? "transmitindo" : "ocioso" }));
    return;
  }

  // Aciona a transmissao
  if (url === "/transmitir") {
    if (rodando) {
      res.writeHead(409, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ ok: false, erro: "Ja esta transmitindo" }));
      return;
    }
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ ok: true, mensagem: "Transmissao iniciada" }));
    rodando = true;
    run().finally(() => { rodando = false; });
    return;
  }

  res.writeHead(404);
  res.end("Not found");
});

server.listen(PORT, () => {
  console.log(`\uD83D\uDCE1 Empire TV Worker ouvindo na porta ${PORT}`);
});
