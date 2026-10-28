// Página descartável: cadastra Pokémon só pelo nome, puxando tudo da PokéAPI.
import { listar, salvar } from "./firebase.js";
import { valid, nav } from "./common.js";
import { slug } from "./imagem.js";
import { dadosDoGolpe } from "./golpesapi.js";
import { golpesDe } from "./golpesdb.js";
import { buscarMegas } from "./megas.js";
nav();
const $ = id => document.getElementById(id);
const log = t => { $("log").textContent += t + "\n"; };
const cap = s => s ? s[0].toUpperCase() + s.slice(1) : s;
const API = "https://pokeapi.co/api/v2/";
const STATS = {hp: "hp", attack: "atk", defense: "def", "special-attack": "spa", "special-defense": "spd", speed: "spe"};
const EVITAR = ["explosion", "self-destruct", "misty-explosion"]; // golpes que se derrotam: não servem de golpe padrão

async function buscarPokemon(nome) {
  const s = slug(nome);
  let r = await fetch(API + "pokemon/" + s);
  if (!r.ok) { // espécies com várias formas: usa a forma padrão
    const e = await fetch(API + "pokemon-species/" + s);
    const v = e.ok ? (await e.json()).varieties.find(v => v.is_default) : null;
    r = v ? await fetch(v.pokemon.url) : null;
  }
  if (!r || !r.ok) throw new Error("não encontrado na PokéAPI");
  return r.json();
}
async function nomeOficial(d) {
  if (d.is_default) {
    try { const e = await (await fetch(d.species.url)).json(); const n = e.names.find(x => x.language.name === "en")?.name; if (n) return n; } catch(e) {}
  }
  return d.name.split("-").map(cap).join(" ");
}
// dados de todos os golpes citados, buscando vários ao mesmo tempo (o cache do dadosDoGolpe evita repetir golpes de outros Pokémon)
async function buscarGolpes(slugs) {
  const fila = [...slugs], dados = {}; let feitos = 0;
  await Promise.all(Array.from({length: 8}, async () => {
    while (fila.length) {
      const sl = fila.shift();
      try { dados[sl] = await dadosDoGolpe(sl); } catch(e) {}
      if (++feitos % 25 === 0 || feitos === slugs.length) log(`    ${feitos}/${slugs.length} golpes consultados`);
    }
  }));
  return dados;
}

$("go").onclick = async () => {
  $("go").disabled = true; $("log").textContent = "";
  try {
    const nomes = [...new Set($("nomes").value.split(/[\n,;]+/).map(n => n.trim()).filter(Boolean))];
    if (!nomes.length) return log("Digite pelo menos um nome.");
    const existentes = await listar(), atualizar = $("atualizar").checked;
    let novos = 0, atualizados = 0, ignorados = 0; const falhas = [];
    for (const nome of nomes) {
      log(`\n${nome}`);
      try {
        const d = await buscarPokemon(nome), oficial = await nomeOficial(d);
        const jaTem = existentes.find(p => p.nome.toLowerCase() === oficial.toLowerCase());
        if (jaTem && !atualizar) { log(`  ${oficial} já está no catálogo (ignorado).`); ignorados++; continue; }
        const tipos = d.types.sort((a, b) => a.slot - b.slot).map(t => cap(t.type.name));
        const base = {}; for (const s of d.stats) base[STATS[s.stat.name]] = s.base_stat;
        const slugs = [...new Set(d.moves.map(m => m.move.name))];
        log(`  ${oficial}: ${tipos.join("/")}, ${slugs.length} golpes na PokéAPI`);
        const dados = await buscarGolpes(slugs);
        const colecao = await golpesDe(Object.values(dados).filter(g => g.nome).map(g => g.nome));
        const mapa = new Map(); // repetidos são sobrescritos
        for (const g of Object.values(dados)) {
          if (!g.nome) continue;
          let m = null;
          const c2 = colecao[g.nome]; // coleção "golpes" já sincronizada (versão 2): vale para golpes de dano e de status
          if (c2 && c2.versao >= 2) { if (c2.suportado) m = {nome: c2.nome, tipo: c2.tipo, cat: c2.cat, poder: c2.poder ?? null, precisao: c2.precisao ?? null, prioridade: c2.prioridade || 0}; }
          else if (g.cat === "status") { const c = colecao[g.nome]; if (c?.suportado) m = {nome: c.nome, tipo: c.tipo, cat: "status", poder: null, precisao: c.precisao ?? null, prioridade: c.prioridade || 0}; }
          else if (g.poder > 0 && ["fisico", "especial"].includes(g.cat)) m = {nome: g.nome, tipo: cap(g.tipo), cat: g.cat, poder: g.poder, precisao: g.precisao ?? null, prioridade: g.prioridade || 0};
          if (m) mapa.set(m.nome.toLowerCase(), m);
        }
        const aprende = [...mapa.values()].sort((a, b) => a.nome.localeCompare(b.nome));
        // golpes padrão: os 4 de dano com melhor nota (poder, bônus de mesmo tipo e precisão)
        const nota = m => m.poder * (tipos.includes(m.tipo) ? 1.5 : 1) * (m.precisao ?? 100) / 100;
        const mv = aprende.filter(m => m.cat !== "status" && !EVITAR.includes(m.nome.toLowerCase().replace(/ /g, "-")))
          .sort((a, b) => nota(b) - nota(a)).slice(0, 4);
        const mega = await buscarMegas(oficial).catch(() => ({podeMega: false, megas: []})); // megaevoluções (se houver)
        const p = {nome: oficial, tipos, ...base, mv, aprende, ...mega};
        if (!valid(p)) throw new Error("não há golpes de dano suficientes para montar o Pokémon");
        await salvar(p, jaTem?.id);
        if (jaTem) atualizados++; else { novos++; existentes.push({...p, id: "novo"}); }
        log(`  ${oficial} salvo: ${aprende.length} golpes disponíveis; padrão: ${mv.map(m => m.nome).join(", ")}`);
      } catch(e) { falhas.push(nome); log(`  Falhou: ${e.message}`); }
    }
    log(`\nPronto: ${novos} novos, ${atualizados} atualizados, ${ignorados} já existiam, ${falhas.length} falharam${falhas.length ? " (" + falhas.join(", ") + ")" : ""}.`);
  } catch(e) { log("\nErro: " + e.message); }
  $("go").disabled = false;
};
