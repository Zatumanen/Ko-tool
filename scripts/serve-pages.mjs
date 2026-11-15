import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../dist');
const prefix='/Ko-tool/';
const mime=new Map([['.html','text/html; charset=utf-8'],
  ['.js','text/javascript; charset=utf-8'],['.css','text/css; charset=utf-8'],
  ['.wasm','application/wasm'],['.json','application/json; charset=utf-8'],
  ['.png','image/png'],['.svg','image/svg+xml'],['.woff2','font/woff2']]);
const port=4174;

const server=http.createServer(async(req,res)=>{
  try{
    const pathname=new URL(req.url||'/', 'http://localhost').pathname;
    if(pathname==='/Ko-tool'){res.writeHead(308,{Location:prefix});res.end();return;}
    if(!pathname.startsWith(prefix)){res.writeHead(404);res.end('Not Found');return;}
    const relative=decodeURIComponent(pathname.slice(prefix.length));
    const requested=relative||'index.html';
    const file=path.resolve(root,requested);
    if(file!==root&&!file.startsWith(root+path.sep)){res.writeHead(403);res.end('Forbidden');return;}
    const bytes=await fs.readFile(file);
    res.writeHead(200,{'Content-Type':mime.get(path.extname(file))||'application/octet-stream',
      'Cache-Control':'no-store'});
    res.end(bytes);
  }catch(error){
    res.writeHead(error?.code==='ENOENT'?404:500);res.end('Not Found');
  }
});

server.listen(port,'127.0.0.1');
const stop=()=>server.close(()=>process.exit(0));
process.on('SIGTERM',stop);process.on('SIGINT',stop);
