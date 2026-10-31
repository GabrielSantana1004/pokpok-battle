// Cache local (IndexedDB) para gastar menos leituras do Firestore: o catálogo e os golpes mudam pouco, então ficam guardados no navegador por um tempo.
// Tudo é opcional: se o IndexedDB não funcionar (navegação privada, bloqueio…), cai para a memória da página e, no pior caso, para a leitura normal.
const BANCO = "pbb_cache", LOJA = "kv", mem = new Map(); // mem: {chave → {t, v}}
let abrindo;
const abrir = () => abrindo ||= new Promise((ok, erro) => {
  try { const r = indexedDB.open(BANCO, 1); r.onupgradeneeded = () => r.result.createObjectStore(LOJA); r.onsuccess = () => ok(r.result); r.onerror = () => erro(r.error); }
  catch(e) { erro(e); }
});
const transacao = async (modo, fn) => {
  const db = await abrir();
  return new Promise((ok, erro) => { const t = db.transaction(LOJA, modo), r = fn(t.objectStore(LOJA)); t.oncomplete = () => ok(r?.result); t.onerror = t.onabort = () => erro(t.error); });
};
const copia = v => v == null ? v : structuredClone(v); // quem pede recebe uma cópia: mexer no resultado não estraga o cache

// Devolve o valor guardado (pode ser null, se foi guardado null) ou undefined se não existe / venceu o prazo (ttlMs).
export async function lerCache(chave, ttlMs) {
  const m = mem.get(chave);
  if (m && Date.now() - m.t < ttlMs) return copia(m.v);
  try {
    const e = await transacao("readonly", s => s.get(chave));
    if (e && Date.now() - e.t < ttlMs) { mem.set(chave, e); return copia(e.v); }
  } catch(e) {}
  return undefined;
}
export async function gravarCache(chave, v) {
  const e = {t: Date.now(), v: copia(v)};
  mem.set(chave, e);
  try { await transacao("readwrite", s => s.put(e, chave)); } catch(e2) {} // sem espaço ou sem IndexedDB: fica só na memória
}
// Apaga tudo cujo nome começa com o prefixo (ex.: "golpe:" apaga todos os golpes guardados; "catalogo" só o catálogo).
export async function apagarCache(prefixo) {
  for (const k of [...mem.keys()]) if (k.startsWith(prefixo)) mem.delete(k);
  try {
    const db = await abrir();
    await new Promise((ok, erro) => {
      const t = db.transaction(LOJA, "readwrite"), s = t.objectStore(LOJA), c = s.openKeyCursor();
      c.onsuccess = () => { const cur = c.result; if (cur) { if (String(cur.key).startsWith(prefixo)) s.delete(cur.key); cur.continue(); } };
      t.oncomplete = ok; t.onerror = t.onabort = () => erro(t.error);
    });
  } catch(e) {}
}
