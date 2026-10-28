// Reconstrói a coleção "golpes" a partir da PokéAPI (todos os golpes), no formato da versão 2 (veja conversor.js).
import "./firebase.js";
import { getFirestore, doc, writeBatch } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { nav } from "./common.js";
import { converterGolpe } from "./conversor.js";
nav();
const $ = id => document.getElementById(id);
const log = t => { $("log").textContent += t + "\n"; };
const db = getFirestore();
const API = "https://pokeapi.co/api/v2/";

$("go").onclick = async () => {
  $("go").disabled = true; $("log").textContent = "";
  try {
    const lista = (await (await fetch(API + "move?limit=3000")).json()).results
      .filter(m => +m.url.split("/").filter(Boolean).pop() < 10000); // ignora golpes Z, Max e de testes
    log(`${lista.length} golpes na PokéAPI. Consultando...`);
    const docs = [], falhas = []; const fila = [...lista]; let feitos = 0;
    await Promise.all(Array.from({length: 8}, async () => {
      while (fila.length) {
        const m = fila.shift();
        try {
          const r = await fetch(m.url); if (!r.ok) throw new Error(r.status);
          docs.push(converterGolpe(await r.json()));
        } catch(e) { falhas.push(m.name); }
        if (++feitos % 100 === 0 || feitos === lista.length) log(`  ${feitos}/${lista.length}`);
      }
    }));
    log(`\nGravando ${docs.length} golpes no Firestore...`);
    for (let i = 0; i < docs.length; i += 400) { // o Firestore aceita até 500 gravações por lote
      const lote = writeBatch(db);
      for (const d of docs.slice(i, i + 400)) lote.set(doc(db, "golpes", d.id), d, {merge: true}); // merge: mantém nomePt, descricao, secao...
      await lote.commit();
    }
    const ok = docs.filter(d => d.suportado).length;
    log(`\nPronto: ${ok} golpes funcionam na batalha e ${docs.length - ok} ficaram bloqueados.`);
    const motivos = {}; for (const d of docs) if (!d.suportado) motivos[d.motivo] = (motivos[d.motivo] || 0) + 1;
    for (const [m, n] of Object.entries(motivos).sort((a, b) => b[1] - a[1])) log(`  ${n} × ${m}`);
    if (falhas.length) log(`\nNão consegui consultar ${falhas.length} golpes (rode de novo): ${falhas.slice(0, 20).join(", ")}${falhas.length > 20 ? "..." : ""}`);
    log(`\nPróximo passo: abra "Atualizar golpes" e use o segundo botão para refazer a lista de golpes de cada Pokémon.`);
  } catch(e) { log("\nErro: " + e.message); }
  $("go").disabled = false;
};
