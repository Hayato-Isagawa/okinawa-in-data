#!/usr/bin/env node
// VRT(playwright.vrt.config.ts)が撮るビルド結果を localhost で配る静的サーバー。
//
// 以前は serve を使っていたが、serve-handler が minimatch 3.1.5 を固定しており、
// 修正版(11 系)は CJS の export の形が違うので overrides で差し替えられない
// (serve-handler が minimatch を呼ぶ経路 = 設定の照合・ディレクトリ一覧で TypeError になる)。
// VRT が要るのは「dist のファイルをそのまま返す」ことだけなので、依存を持たない形で置き換えた。
//
// 使い方: node scripts/serve-dist.mjs <dir> <port>

import { createReadStream, statSync } from "node:fs";
import { createServer } from "node:http";
import path from "node:path";

const [dir, port] = process.argv.slice(2);

if (!dir || !port) {
  console.error("usage: serve-dist.mjs <dir> <port>");
  process.exit(2);
}

const root = path.resolve(dir);
if (!statSync(root, { throwIfNoEntry: false })?.isDirectory()) {
  console.error(`[serve-dist] not a directory: ${root}`);
  process.exit(2);
}

const TYPES = {
  ".css": "text/css; charset=utf-8",
  ".csv": "text/csv; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".ico": "image/x-icon",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".md": "text/markdown; charset=utf-8",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".txt": "text/plain; charset=utf-8",
  ".wasm": "application/wasm",
  ".woff2": "font/woff2",
  ".xml": "application/xml; charset=utf-8",
};

// throwIfNoEntry が握りつぶすのは ENOENT / ENOTDIR だけ。長すぎるパス(ENAMETOOLONG)や
// 読めないディレクトリの配下(EACCES)では投げるので、例外を値として返す
function statFile(file) {
  try {
    return { stat: statSync(file, { throwIfNoEntry: false }) };
  } catch (error) {
    return { error };
  }
}

function send(res, status, body) {
  res.writeHead(status, { "Content-Type": "text/plain; charset=utf-8" });
  res.end(body);
}

// 長すぎるパスはファイルとして存在しえないので 404。それ以外の I/O の失敗はサーバー側の
// 問題なので、VRT が status を見なくても気づけるよう stderr に出して 500 を返す
function fail(res, error, file) {
  if (error.code === "ENAMETOOLONG") return send(res, 404, "not found");
  console.error(`[serve-dist] ${error.code ?? error.message}: ${file}`);
  send(res, 500, "internal server error");
}

const server = createServer((req, res) => {
  if (req.method !== "GET" && req.method !== "HEAD") {
    return send(res, 405, "method not allowed");
  }

  let rawPath, pathname;
  try {
    rawPath = new URL(req.url, "http://localhost").pathname;
    pathname = decodeURIComponent(rawPath);
  } catch {
    return send(res, 400, "bad request");
  }
  // NUL を含むパスはファイル名として成り立たないので、404 ではなく不正な要求として返す
  if (pathname.includes("\0")) {
    return send(res, 400, "bad request");
  }

  // path.join が .. を畳んだ結果が root の外に出たら返さない
  let file = path.join(root, pathname);
  if (file !== root && !file.startsWith(root + path.sep)) {
    return send(res, 403, "forbidden");
  }

  let { stat, error } = statFile(file);
  if (stat?.isDirectory()) {
    if (!pathname.endsWith("/")) {
      // デコード前のパスを使う(URL がエンコード済みにしているので、ヘッダに入れても壊れない)
      res.writeHead(301, { Location: `${rawPath}/` });
      return res.end();
    }
    file = path.join(file, "index.html");
    ({ stat, error } = statFile(file));
  }
  if (error) return fail(res, error, file);
  if (!stat?.isFile()) {
    return send(res, 404, "not found");
  }

  // 開けたことを確かめてからヘッダを送る(読めないファイルで 200 を送った後に落ちないように)
  const stream = createReadStream(file);
  stream.on("error", (error) => {
    if (!res.headersSent) return fail(res, error, file);
    console.error(`[serve-dist] ${error.code ?? error.message}: ${file}`);
    res.destroy();
  });
  stream.on("open", () => {
    res.writeHead(200, {
      "Content-Type":
        TYPES[path.extname(file).toLowerCase()] ?? "application/octet-stream",
      "Content-Length": stat.size,
    });
    if (req.method === "HEAD") {
      stream.destroy();
      return res.end();
    }
    stream.pipe(res);
  });
});
server.listen(Number(port), "127.0.0.1", () => {
  // port に 0 を渡したとき(テスト)のために、実際に割り当てられたポートを出す
  console.log(
    `[serve-dist] ${root} -> http://localhost:${server.address().port}`
  );
});
