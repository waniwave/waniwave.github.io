// 保存（仕様書 第11章）：IndexedDB に宿セーブ（inn）と潜行中セーブ（dive）。
// どちらも JSON の文字列で入れる（Big は Big.revive で戻す）。持ち込み確定・脱出・未帰還は putBoth で1つの書き込みにする。
// IndexedDB が使えないとき（プライベートブラウズ等）は localStorage に書く。

const DB = 'taabuka';
const STORE = 'save';
let dbp = null;

function open() {
  if (dbp) return dbp;
  dbp = new Promise((resolve) => {
    let req;
    try { req = indexedDB.open(DB, 1); } catch { resolve(null); return; }
    req.onupgradeneeded = () => req.result.createObjectStore(STORE);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => resolve(null);
  });
  return dbp;
}

/** 読む：{ inn: string|null, dive: string|null } */
export async function readAll() {
  const db = await open();
  if (!db) return { inn: localStorage.getItem('taabuka.inn'), dive: localStorage.getItem('taabuka.dive') };
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readonly');
    const st = tx.objectStore(STORE);
    const out = {};
    const a = st.get('inn'); const b = st.get('dive');
    a.onsuccess = () => { out.inn = a.result ?? null; };
    b.onsuccess = () => { out.dive = b.result ?? null; };
    tx.oncomplete = () => resolve(out);
    tx.onerror = () => reject(tx.error);
  });
}

/**
 * 書く。値が undefined の鍵は触らない、null なら消す。1つのトランザクションで書く
 * @param {{inn?: string|null, dive?: string|null}} kv
 */
export async function write(kv) {
  const db = await open();
  if (!db) {
    for (const [k, v] of Object.entries(kv)) { if (v === undefined) continue; if (v === null) localStorage.removeItem(`taabuka.${k}`); else localStorage.setItem(`taabuka.${k}`, v); }
    return;
  }
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite');
    const st = tx.objectStore(STORE);
    for (const [k, v] of Object.entries(kv)) { if (v === undefined) continue; if (v === null) st.delete(k); else st.put(v, k); }
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  });
}

// ───────── 書き出し・読み込み（JSON → deflate → base64） ─────────
const PREFIX = 'TAABUKA1:';

async function pipe(bytes, stream) {
  const s = new Blob([bytes]).stream().pipeThrough(stream);
  return new Uint8Array(await new Response(s).arrayBuffer());
}
function toB64(u8) { let s = ''; for (let i = 0; i < u8.length; i += 0x8000) s += String.fromCharCode(...u8.subarray(i, i + 0x8000)); return btoa(s); }
function fromB64(b) { const s = atob(b); const u = new Uint8Array(s.length); for (let i = 0; i < s.length; i++) u[i] = s.charCodeAt(i); return u; }

/** 宿と潜行中を1つの文字列に */
export async function exportText(innStr, diveStr) {
  const json = JSON.stringify({ inn: innStr, dive: diveStr ?? null });
  const bytes = new TextEncoder().encode(json);
  const z = typeof CompressionStream === 'function' ? await pipe(bytes, new CompressionStream('deflate')) : null;
  return z ? `${PREFIX}z:${toB64(z)}` : `${PREFIX}r:${toB64(bytes)}`;
}

/** 文字列から { inn, dive } に */
export async function importText(text) {
  const t = String(text || '').trim().replace(/\s+/g, '');
  if (!t.startsWith(PREFIX)) throw new Error('ター深の書き出しではない');
  const [mode, b64] = [t.slice(PREFIX.length, PREFIX.length + 1), t.slice(PREFIX.length + 2)];
  let bytes = fromB64(b64);
  if (mode === 'z') {
    if (typeof DecompressionStream !== 'function') throw new Error('このブラウザでは読み込めない');
    bytes = await pipe(bytes, new DecompressionStream('deflate'));
  }
  const o = JSON.parse(new TextDecoder().decode(bytes));
  if (typeof o.inn !== 'string') throw new Error('宿のセーブが入っていない');
  return o;
}
