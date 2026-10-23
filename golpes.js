import { listar, salvar } from "./firebase.js";
import { dadosDoGolpe, golpesAprendidos } from "./golpesapi.js";
import { golpesDe } from "./golpesdb.js";
import { nav } from "./common.js";
nav();
const $ = id => document.getElementById(id);
const log = t => { $("log").textContent += t + "\n"; };

$("go").onclick = async () => {
  $("go").disabled = true; $("log").textContent = "";
  try {
    const refazer = $("sobrescrever").checked;
    const lista = await listar();
    const precisa = m => refazer || m.poder === undefined;
    const nomes = [...new Set(lista.flatMap(p => p.mv.filter(precisa).map(m => m.nome)))];
    log(`${lista.length} Pokémon no catálogo; ${nomes.length} golpes para buscar.`);
    const dados = {}, falhas = [];
    for (const [i, n] of nomes.entries()) {
      try { dados[n] = await dadosDoGolpe(n); } catch(e) { falhas.push(n); }
      if ((i + 1) % 10 === 0 || i + 1 === nomes.length) log(`  ${i + 1}/${nomes.length} golpes consultados`);
    }
    let atualizados = 0; const avisos = [];
    for (const p of lista) {
      let mudou = false;
      const mv = p.mv.map(m => {
        const d = dados[m.nome];
        if (!d || !precisa(m)) return m;
        mudou = true;
        if (d.cat && d.cat !== m.cat) avisos.push(`${p.nome}: ${m.nome} é "${d.cat}" na PokéAPI, mas está como "${m.cat}" no catálogo`);
        if (d.tipo && d.tipo.toLowerCase() !== m.tipo.toLowerCase()) avisos.push(`${p.nome}: ${m.nome} é do tipo ${d.tipo} na PokéAPI, mas está como ${m.tipo} no catálogo`);
        if (m.cat !== "status" && !(d.poder > 0)) avisos.push(`${p.nome}: ${m.nome} não tem poder fixo na PokéAPI (não funciona na batalha)`);
        return {...m, poder: d.poder, precisao: d.precisao, prioridade: d.prioridade};
      });
      if (mudou) { await salvar({...p, mv}, p.id); atualizados++; }
    }
    log(`\n${atualizados} Pokémon atualizados.`);
    if (falhas.length) log(`\nNão encontrados na PokéAPI: ${falhas.join(", ")}`);
    if (avisos.length) log(`\nAvisos:\n- ` + avisos.join("\n- "));
    if (!falhas.length && !avisos.length) log("Tudo certo, sem avisos.");
  } catch(e) { log("\nErro: " + e.message); }
  $("go").disabled = false;
};

// ---- lista de golpes que cada Pokémon pode aprender (campo "aprende" do Pokémon) ----
const cap = s => s ? s[0].toUpperCase() + s.slice(1) : s;
$("go2").onclick = async () => {
  $("go2").disabled = true; $("log").textContent = "";
  try {
    const lista = await listar();
    log(`${lista.length} Pokémon no catálogo.`);
    // 1) golpes de cada Pokémon (união de todas as gerações; cada golpe uma vez só)
    const por = {}, falhas = [];
    for (const p of lista) {
      try { por[p.id] = await golpesAprendidos(p.nome); log(`  ${p.nome}: ${por[p.id].length} golpes na PokéAPI`); }
      catch(e) { falhas.push(p.nome); }
    }
    // 2) dados de cada golpe (uma busca por golpe, vários ao mesmo tempo)
    const fila = [...new Set(Object.values(por).flat())], total = fila.length, dados = {}; let feitos = 0;
    log(`\n${total} golpes diferentes para consultar...`);
    await Promise.all(Array.from({length: 8}, async () => {
      while (fila.length) {
        const sl = fila.shift();
        try { dados[sl] = await dadosDoGolpe(sl); } catch(e) {}
        if (++feitos % 25 === 0 || feitos === total) log(`  ${feitos}/${total} golpes consultados`);
      }
    }));
    // 3) golpes de status só entram se estiverem na coleção "golpes" e funcionarem na batalha
    const colecao = await golpesDe(Object.values(dados).filter(d => d.nome).map(d => d.nome));
    const montar = d => {
      if (!d || !d.nome) return null;
      const c2 = colecao[d.nome]; // coleção "golpes" já sincronizada (versão 2): vale para golpes de dano e de status
      if (c2 && c2.versao >= 2) return c2.suportado ? {nome: c2.nome, tipo: c2.tipo, cat: c2.cat, poder: c2.poder ?? null, precisao: c2.precisao ?? null, prioridade: c2.prioridade || 0} : null;
      if (d.cat === "status") {
        const g = colecao[d.nome];
        return g?.suportado ? {nome: g.nome, tipo: g.tipo, cat: "status", poder: null, precisao: g.precisao ?? null, prioridade: g.prioridade || 0} : null;
      }
      return d.poder > 0 && ["fisico", "especial"].includes(d.cat)
        ? {nome: d.nome, tipo: cap(d.tipo), cat: d.cat, poder: d.poder, precisao: d.precisao ?? null, prioridade: d.prioridade || 0} : null;
    };
    let salvos = 0;
    for (const p of lista) {
      if (!por[p.id]) continue;
      const mapa = new Map(); // nome em minúsculas -> golpe (repetidos são sobrescritos)
      for (const sl of por[p.id]) { const g = montar(dados[sl]); if (g) mapa.set(g.nome.toLowerCase(), g); }
      for (const m of p.mv) { // os golpes já cadastrados no Pokémon sempre ficam disponíveis
        if (mapa.has(m.nome.toLowerCase()) || (m.cat !== "status" && !(m.poder > 0))) continue;
        mapa.set(m.nome.toLowerCase(), {nome: m.nome, tipo: m.tipo, cat: m.cat, poder: m.cat === "status" ? null : m.poder, precisao: m.precisao ?? null, prioridade: m.prioridade || 0});
      }
      const aprende = [...mapa.values()].sort((a, b) => a.nome.localeCompare(b.nome));
      await salvar({...p, aprende}, p.id); salvos++;
      log(`  ${p.nome}: ${aprende.length} golpes disponíveis para escolha`);
    }
    log(`\n${salvos} Pokémon atualizados.`);
    if (falhas.length) log(`\nNão encontrados na PokéAPI (ficam sem lista de golpes): ${falhas.join(", ")}`);
    const semDados = Object.keys(dados).length < total;
    if (semDados) log(`\n${total - Object.keys(dados).length} golpes não puderam ser consultados; rode de novo para tentar outra vez.`);
  } catch(e) { log("\nErro: " + e.message); }
  $("go2").disabled = false;
};
