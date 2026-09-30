import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
import{fileURLToPath}from 'node:url';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');
const types=new Map([
  ['.html','text/html; charset=utf-8'],
  ['.js','text/javascript; charset=utf-8'],
  ['.mjs','text/javascript; charset=utf-8'],
  ['.css','text/css; charset=utf-8'],
  ['.wasm','application/wasm'],
  ['.json','application/json; charset=utf-8']
]);

const server=http.createServer(async(req,res)=>{
  try{
    const url=new URL(req.url||'/', 'http://127.0.0.1');
    const relative=decodeURIComponent(url.pathname==='/'?'/index.html':url.pathname);
    const target=path.resolve(root,'.'+relative);
    if(target!==root&&!target.startsWith(root+path.sep)){
      res.writeHead(403);res.end('Forbidden');return;
    }
    const data=await fs.readFile(target);
    res.writeHead(200,{
      'Content-Type':types.get(path.extname(target))||'application/octet-stream',
      'Cache-Control':'no-store'
    });
    res.end(data);
  }catch(error){
    res.writeHead(error?.code==='ENOENT'?404:500);
    res.end(error?.code==='ENOENT'?'Not found':String(error?.message||error));
  }
});

server.listen(4173,'127.0.0.1');
const shutdown=()=>server.close(()=>process.exit(0));
process.on('SIGTERM',shutdown);
process.on('SIGINT',shutdown);
