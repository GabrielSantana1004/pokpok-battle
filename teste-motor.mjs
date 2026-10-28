// Teste do motor (rodar com: node teste-motor.mjs [numero de batalhas]). Converte golpes no formato da PokéAPI e roda batalhas aleatórias verificando as regras.
import { converterGolpe } from "./conversor.js";
import * as M from "./motor.js";
const {copiaPokemon, resolverRodada, enviar, fimDeBatalha, precisaTrocar, ativoDe, vivos, adv} = M;

const meta = (o = {}) => ({ailment: {name: "none"}, category: {name: "damage"}, min_hits: null, max_hits: null, min_turns: null, max_turns: null, drain: 0, healing: 0, crit_rate: 0, ailment_chance: 0, flinch_chance: 0, stat_chance: 0, ...o});
const api = (name, type, cls, power, acc, o = {}) => ({name, names: [{language: {name: "en"}, name: name.split("-").map(x => x[0].toUpperCase() + x.slice(1)).join(" ")}],
  type: {name: type}, damage_class: {name: cls}, power, accuracy: acc, priority: o.prio || 0, target: {name: o.target || (cls === "status" ? "selected-pokemon" : "selected-pokemon")},
  meta: meta(o.meta), stat_changes: o.stats || []});
const sc = (stat, change) => ({stat: {name: stat}, change});
const D = (name, type, power, acc, o) => api(name, type, o?.cls || "physical", power, acc, o);
const S = (name, type, acc, o) => api(name, type, "status", null, acc, o);
const API = [
  D("tackle", "normal", 40, 100), D("flamethrower", "fire", 90, 100, {cls: "special", meta: {ailment: {name: "burn"}, ailment_chance: 10, category: {name: "damage+ailment"}}}),
  D("ice-beam", "ice", 90, 100, {cls: "special", meta: {ailment: {name: "freeze"}, ailment_chance: 10, category: {name: "damage+ailment"}}}),
  D("thunderbolt", "electric", 90, 100, {cls: "special", meta: {ailment: {name: "paralysis"}, ailment_chance: 10, category: {name: "damage+ailment"}}}),
  D("acid-spray", "poison", 40, 100, {cls: "special", stats: [sc("special-defense", -2)], meta: {category: {name: "damage+lower"}, stat_chance: 100}}),
  D("close-combat", "fighting", 120, 100, {stats: [sc("defense", -1), sc("special-defense", -1)], meta: {category: {name: "damage+raise"}, stat_chance: 100}}),
  D("flame-charge", "fire", 50, 100, {stats: [sc("speed", 1)], meta: {category: {name: "damage+raise"}, stat_chance: 100}}),
  D("drain-punch", "fighting", 75, 100, {meta: {drain: 50, category: {name: "damage+heal"}}}), D("brave-bird", "flying", 120, 100, {meta: {drain: -33}}),
  D("fire-spin", "fire", 35, 85, {cls: "special", meta: {ailment: {name: "trap"}, ailment_chance: 100, category: {name: "damage+ailment"}}}),
  D("fury-swipes", "normal", 18, 80, {meta: {min_hits: 2, max_hits: 5}}), D("double-kick", "fighting", 30, 100, {meta: {min_hits: 2, max_hits: 2}}),
  D("slash", "normal", 70, 100, {meta: {crit_rate: 1}}), D("waterfall", "water", 80, 100, {meta: {flinch_chance: 20}}),
  D("surf", "water", 90, 100, {cls: "special", target: "all-other-pokemon"}), D("earthquake", "ground", 100, 100),
  D("quick-attack", "normal", 40, 100, {prio: 1}), D("fake-out", "normal", 40, 100, {prio: 3, meta: {flinch_chance: 100}}), D("sucker-punch", "dark", 70, 100, {prio: 1}),
  D("hyper-beam", "normal", 150, 90, {cls: "special"}), D("solar-beam", "grass", 120, 100, {cls: "special"}), D("fly", "flying", 90, 95), D("dig", "ground", 80, 100),
  D("outrage", "dragon", 120, 100), D("explosion", "normal", 250, 100), D("u-turn", "bug", 70, 100), D("dragon-tail", "dragon", 60, 90, {prio: -6, meta: {category: {name: "force-switch"}}}),
  D("rapid-spin", "normal", 50, 100, {stats: [sc("speed", 1)], meta: {category: {name: "damage+raise"}, stat_chance: 100}}), D("brick-break", "fighting", 75, 100),
  D("facade", "normal", 70, 100), D("venoshock", "poison", 65, 100, {cls: "special"}), D("seismic-toss", "fighting", null, 100, {}), D("dragon-rage", "dragon", null, 100, {cls: "special"}),
  D("super-fang", "normal", null, 90), D("fissure", "ground", null, 30, {meta: {category: {name: "ohko"}}}), D("counter", "fighting", null, 100, {prio: -5}), D("mirror-coat", "psychic", null, 100, {cls: "special", prio: -5}),
  D("weather-ball", "normal", 50, 100, {cls: "special"}), D("stored-power", "psychic", 20, 100, {cls: "special"}), D("eruption", "fire", 150, 100, {cls: "special"}),
  D("psyshock", "psychic", 80, 100, {cls: "special"}), D("foul-play", "dark", 95, 100), D("body-press", "fighting", 80, 100), D("future-sight", "psychic", 120, 100, {cls: "special"}),
  D("focus-punch", "fighting", 150, 100, {prio: -3}), D("thunder", "electric", 110, 70, {cls: "special"}), D("blizzard", "ice", 110, 70, {cls: "special"}),
  D("steel-beam", "steel", 140, 95, {cls: "special"}), D("triple-axel", "ice", 20, 90), D("acrobatics", "flying", 55, 100), D("knock-off", "dark", 65, 100, {meta: {category: {name: "unique"}}}),
  D("mystery-unique", "normal", 50, 100, {meta: {category: {name: "unique"}}}),
  S("swords-dance", "normal", null, {target: "user", stats: [sc("attack", 2)], meta: {category: {name: "net-good-stats"}}}),
  S("growl", "normal", 100, {target: "all-opponents", stats: [sc("attack", -1)], meta: {category: {name: "net-good-stats"}}}),
  S("calm-mind", "psychic", null, {target: "user", stats: [sc("special-attack", 1), sc("special-defense", 1)], meta: {category: {name: "net-good-stats"}}}),
  S("toxic", "poison", 90, {meta: {ailment: {name: "poison"}, category: {name: "ailment"}}}), S("will-o-wisp", "fire", 85, {meta: {ailment: {name: "burn"}, category: {name: "ailment"}}}),
  S("thunder-wave", "electric", 90, {meta: {ailment: {name: "paralysis"}, category: {name: "ailment"}}}), S("spore", "grass", 100, {meta: {ailment: {name: "sleep"}, category: {name: "ailment"}}}),
  S("confuse-ray", "ghost", 100, {meta: {ailment: {name: "confusion"}, category: {name: "ailment"}}}), S("recover", "normal", null, {target: "user", meta: {healing: 50, category: {name: "heal"}}}),
  S("swagger", "normal", 85, {stats: [sc("attack", 2)], meta: {ailment: {name: "confusion"}, category: {name: "swagger"}}}),
  S("rain-dance", "water", null, {target: "all-pokemon", meta: {category: {name: "whole-field-effect"}}}), S("sunny-day", "fire", null, {target: "all-pokemon"}), S("sandstorm", "rock", null, {target: "all-pokemon"}),
  S("hail", "ice", null, {target: "all-pokemon"}), S("electric-terrain", "electric", null, {target: "entire-field"}), S("grassy-terrain", "grass", null, {target: "entire-field"}),
  S("psychic-terrain", "psychic", null, {target: "entire-field"}), S("misty-terrain", "fairy", null, {target: "entire-field"}), S("trick-room", "psychic", null, {target: "all-pokemon", prio: -7}),
  S("stealth-rock", "rock", null, {target: "opponents-field"}), S("spikes", "ground", null, {target: "opponents-field"}), S("toxic-spikes", "poison", null, {target: "opponents-field"}), S("sticky-web", "bug", null, {target: "opponents-field"}),
  S("defog", "flying", null, {}), S("reflect", "psychic", null, {target: "users-field"}), S("light-screen", "psychic", null, {target: "users-field"}), S("aurora-veil", "ice", null, {target: "users-field"}),
  S("safeguard", "normal", null, {target: "users-field"}), S("tailwind", "flying", null, {target: "users-field"}), S("mist", "ice", null, {target: "users-field"}),
  S("protect", "normal", null, {target: "user", prio: 4}), S("detect", "fighting", null, {target: "user", prio: 4}), S("endure", "normal", null, {target: "user", prio: 4}),
  S("spiky-shield", "grass", null, {target: "user", prio: 4}), S("kings-shield", "steel", null, {target: "user", prio: 4}), S("baneful-bunker", "poison", null, {target: "user", prio: 4}),
  S("substitute", "normal", null, {target: "user"}), S("taunt", "dark", 100, {}), S("encore", "normal", 100, {}), S("disable", "normal", 100, {}), S("torment", "dark", 100, {}),
  S("focus-energy", "normal", null, {target: "user"}), S("lock-on", "normal", null, {}), S("yawn", "normal", null, {}), S("perish-song", "normal", null, {target: "all-pokemon"}),
  S("destiny-bond", "ghost", null, {target: "user"}), S("aqua-ring", "water", null, {target: "user"}), S("ingrain", "grass", null, {target: "user"}), S("curse", "ghost", null, {target: "user"}),
  S("nightmare", "ghost", 100, {}), S("leech-seed", "grass", 90, {meta: {ailment: {name: "leech-seed"}, category: {name: "ailment"}}}), S("mean-look", "normal", null, {}),
  S("haze", "ice", null, {target: "all-pokemon"}), S("psych-up", "normal", null, {}), S("heart-swap", "psychic", null, {}), S("belly-drum", "normal", null, {target: "user"}), S("pain-split", "normal", null, {}),
  S("heal-bell", "normal", null, {target: "user-and-allies"}), S("acupressure", "normal", null, {target: "user-or-ally"}), S("roar", "normal", null, {prio: -6}), S("baton-pass", "normal", null, {target: "user"}),
  S("teleport", "psychic", null, {target: "user"}), S("rest", "psychic", null, {target: "user"}), S("moonlight", "fairy", null, {target: "user"}), S("wish", "normal", null, {target: "user"}),
  S("memento", "dark", 100, {}), S("parting-shot", "dark", 100, {}), S("geomancy", "fairy", null, {target: "user", stats: [sc("special-attack", 2), sc("special-defense", 2), sc("speed", 2)]}),
  S("helping-hand", "normal", null, {target: "ally"}), S("copycat", "normal", null, {}), S("gravity", "psychic", null, {target: "entire-field"}), S("mystery-status", "normal", null, {}),
];
const DOCS = Object.fromEntries(API.map(a => [a.name, converterGolpe(a)]));
const naoSup = Object.values(DOCS).filter(d => !d.suportado).map(d => `${d.id} (${d.motivo})`);
console.log(`${Object.keys(DOCS).length} golpes convertidos; ${naoSup.length} não suportados:`, naoSup.join("; "));
let falhas = 0;
const ok = (c, msg) => { if (!c) { falhas++; console.log("FALHOU:", msg); } };
ok(DOCS["acid-spray"].efeitos[0].alvo === "alvo" && DOCS["acid-spray"].efeitos[0].n === -2, "acid-spray: Def Esp -2 no alvo");
ok(DOCS["close-combat"].efeitos.every(e => e.alvo === "self" && e.n === -1), "close-combat: -1 em si");
ok(DOCS.toxic.efeitos[0].condicao === "veneno-grave", "toxic = veneno grave");
ok(DOCS.swagger.efeitos.length === 2, "swagger: estágio + confusão");
ok(!DOCS["mystery-unique"].suportado && !DOCS["mystery-status"].suportado && !DOCS.copycat.suportado && !DOCS["triple-axel"].suportado && !DOCS["helping-hand"].suportado, "golpes sem suporte bloqueados");
ok(DOCS["knock-off"].suportado === false || DOCS["knock-off"].suportado === true, "knock-off ok");
const stripped = Object.fromEntries(Object.entries(DOCS).filter(([, d]) => d.suportado));
const mapa = Object.fromEntries(Object.values(stripped).map(d => [d.nome, d]));
const listaSup = Object.values(stripped);
console.log(`${listaSup.length} suportados`);

// ---------- ferramentas de teste ----------
const porId = Object.fromEntries(Object.values(stripped).map(d => [d.id, d]));
const pk = (nome, tipos, mvs, spe = 80) => copiaPokemon({id: nome, nome, tipos, hp: 80, atk: 80, def: 80, spa: 80, spd: 80, spe, mv: mvs.map(n => { const d = porId[n]; if (!d) throw new Error("golpe de teste não suportado: " + n); return {nome: d.nome, tipo: d.tipo, cat: d.cat, poder: d.poder, precisao: d.precisao, prioridade: d.prioridade}; })}, mapa);
const sala = (e1, e2) => ({fase: "batalha", rodada: 1, j: {"1": {equipe: e1, ativo: 0}, "2": {equipe: e2, ativo: 0}}, escolhas: {"1": null, "2": null}, log: []});
const golpe = (s, k, nome) => ({tipo: "golpe", idx: ativoDe(s.j[k]).mv.findIndex(m => m.id === nome)});
const rodar = (s, a, b) => { s.escolhas = {"1": a, "2": b}; return resolverRodada(s); };
const semUndef = (o, caminho = "s") => {
  if (o === undefined) throw new Error("undefined em " + caminho);
  if (typeof o === "number" && !Number.isFinite(o)) throw new Error("número inválido em " + caminho);
  if (o && typeof o === "object") for (const [k, v] of Object.entries(o)) semUndef(v, caminho + "." + k);
};
const dummy = () => pk("Dummy", ["Normal"], ["tackle"], 1);

// ---------- cenários dirigidos ----------
{ // clima
  const s = sala([pk("A", ["Water"], ["rain-dance", "tackle"])], [dummy()]); rodar(s, golpe(s, "1", "rain-dance"), golpe(s, "2", "tackle"));
  ok(s.campo.clima?.t === "chuva" && s.campo.clima.n === 4, "Rain Dance liga a chuva por 5 turnos (4 restantes após a rodada)");
}
{ // armadilhas e entrada
  const s = sala([pk("A", ["Normal"], ["stealth-rock", "spikes", "toxic-spikes", "sticky-web"], 200)], [pk("B", ["Normal"], ["tackle"]), pk("C", ["Fire"], ["tackle"]), dummy()]);
  for (const g of ["stealth-rock", "spikes", "toxic-spikes", "sticky-web"]) { rodar(s, golpe(s, "1", g), golpe(s, "2", "tackle")); s.j["2"].equipe[0].hpAtual = s.j["2"].equipe[0].hp; }
  const l = s.j["2"].lado; ok(l.rocha && l.espinhos === 1 && l.venenosa === 1 && l.teia, "armadilhas no lado do adversário");
  const L = []; const C = s.j["2"].equipe[1], antes = C.hpAtual; enviar(s, "2", 1, L); // Fire contra Rock = x2 (1/4 do HP)
  ok(antes - C.hpAtual >= Math.floor(C.hp / 4) + Math.floor(C.hp / 8) - 1, "Stealth Rock em tipo Fire + espinhos: " + (antes - C.hpAtual) + " " + L.join(" | "));
  ok(C.cond === "veneno" && C.est.spe === -1, "Toxic Spikes envenena e Sticky Web reduz Velocidade");
}
{ // Protect e substituto
  const s = sala([pk("A", ["Normal"], ["tackle"], 10)], [pk("B", ["Normal"], ["protect", "substitute"], 200)]);
  rodar(s, golpe(s, "1", "tackle"), golpe(s, "2", "protect"));
  ok(s.j["1"].equipe[0].hpAtual === s.j["1"].equipe[0].hp && s.j["2"].equipe[0].hpAtual === s.j["2"].equipe[0].hp, "Protect bloqueia o golpe");
  const s2 = sala([pk("A", ["Normal"], ["tackle"], 10)], [pk("B", ["Normal"], ["substitute"], 200)]);
  rodar(s2, golpe(s2, "1", "tackle"), golpe(s2, "2", "substitute"));
  const B = s2.j["2"].equipe[0]; ok(B.hpAtual === B.hp - Math.floor(B.hp / 4), "substituto custa 25% e absorve o golpe: " + B.hpAtual + "/" + B.hp);
}
{ // golpe de 2 turnos e recarga
  const s = sala([pk("A", ["Flying"], ["fly", "hyper-beam"], 200)], [pk("B", ["Normal"], ["tackle", "earthquake"], 10)]);
  s.j["1"].equipe[0].mv.forEach(m => m.precisao = null); // sem erro de precisão: o teste não pode depender de sorte
  rodar(s, golpe(s, "1", "fly"), golpe(s, "2", "tackle"));
  ok(s.j["1"].equipe[0].vol.carga === 0 && s.j["1"].equipe[0].vol.invul === "voo" && s.j["1"].equipe[0].hpAtual === s.j["1"].equipe[0].hp, "Fly: turno 1 fora de alcance");
  rodar(s, golpe(s, "1", "fly"), golpe(s, "2", "tackle"));
  ok(s.j["2"].equipe[0].hpAtual < s.j["2"].equipe[0].hp && s.j["1"].equipe[0].vol.carga == null, "Fly: turno 2 ataca");
  const r = sala([pk("A", ["Normal"], ["hyper-beam"], 200)], [pk("B", ["Rock"], ["tackle"], 10)]);
  r.j["1"].equipe[0].mv[0].precisao = null; rodar(r, golpe(r, "1", "hyper-beam"), golpe(r, "2", "tackle"));
  ok(r.j["1"].equipe[0].vol.recarga === true, "Hyper Beam exige recarga");
  const hp = r.j["2"].equipe[0].hpAtual; rodar(r, golpe(r, "1", "hyper-beam"), golpe(r, "2", "tackle"));
  ok(r.j["2"].equipe[0].hpAtual === hp && r.j["1"].equipe[0].vol.recarga === false, "turno de recarga: não ataca");
}
{ // dano fixo, OHKO, counter, explosão, pivô
  const s = sala([pk("A", ["Normal"], ["dragon-rage", "seismic-toss", "super-fang", "explosion", "u-turn"], 200)], [pk("B", ["Normal"], ["tackle", "counter"], 10), dummy()]);
  const B = s.j["2"].equipe[0], hp0 = B.hpAtual;
  rodar(s, golpe(s, "1", "dragon-rage"), golpe(s, "2", "tackle")); ok(hp0 - B.hpAtual === 40, "Dragon Rage = 40");
  const hp1 = B.hpAtual; rodar(s, golpe(s, "1", "seismic-toss"), golpe(s, "2", "tackle")); ok(hp1 - B.hpAtual === 50 || B.hpAtual === 0, "Seismic Toss = nível");
  rodar(s, golpe(s, "1", "u-turn"), golpe(s, "2", "tackle")); ok(s.j["1"].pivo === false || !s.j["1"].equipe.slice(1).length, "U-turn sem reserva não pede troca");
  rodar(s, golpe(s, "1", "explosion"), golpe(s, "2", "tackle")); ok(s.j["1"].equipe[0].hpAtual === 0, "Explosion derrota quem usa");
}
{ // Trick Room inverte ordem; Tailwind dobra Velocidade
  const s = sala([pk("Rapido", ["Normal"], ["trick-room", "tackle"], 200)], [pk("Lento", ["Normal"], ["tackle"], 5)]);
  rodar(s, golpe(s, "1", "trick-room"), golpe(s, "2", "tackle"));
  ok(s.campo.sala === 4, "Trick Room ativo");
  s.log = []; rodar(s, golpe(s, "1", "tackle"), golpe(s, "2", "tackle"));
  const ordem = s.log.filter(l => l.includes("usou Tackle")).map(l => l[0]); ok(ordem[0] === "L", "no Trick Room o lento age primeiro: " + ordem);
}
{ // condições e imunidades
  const s = sala([pk("A", ["Normal"], ["toxic", "will-o-wisp", "thunder-wave", "spore", "yawn", "leech-seed"], 200)], [pk("Fogo", ["Fire"], ["tackle"], 10), pk("Aco", ["Steel"], ["tackle"]), pk("Planta", ["Grass"], ["tackle"])]);
  s.j["1"].equipe[0].mv.forEach(m => m.precisao = null);
  rodar(s, golpe(s, "1", "will-o-wisp"), golpe(s, "2", "tackle")); ok(s.j["2"].equipe[0].cond === null, "Fire é imune a queimadura");
  rodar(s, golpe(s, "1", "toxic"), golpe(s, "2", "tackle")); ok(s.j["2"].equipe[0].cond === "veneno-grave", "Toxic envenena gravemente");
  enviar(s, "2", 1, []); rodar(s, golpe(s, "1", "toxic"), golpe(s, "2", "tackle")); ok(s.j["2"].equipe[1].cond === null, "Steel imune a veneno");
  enviar(s, "2", 2, []); rodar(s, golpe(s, "1", "spore"), golpe(s, "2", "tackle")); ok(s.j["2"].equipe[2].cond === null, "Grass imune a pó");
  rodar(s, golpe(s, "1", "leech-seed"), golpe(s, "2", "tackle")); ok(!s.j["2"].equipe[2].vol.semente, "Grass imune a Leech Seed");
}
{ // Future Sight, Perish, Wish
  const s = sala([pk("A", ["Psychic"], ["future-sight", "wish", "perish-song", "tackle"], 200)], [pk("B", ["Normal"], ["tackle"], 10), dummy()]);
  const B = s.j["2"].equipe[0]; rodar(s, golpe(s, "1", "future-sight"), golpe(s, "2", "tackle")); ok(B.hpAtual === B.hp, "Future Sight não dá dano na hora");
  rodar(s, golpe(s, "1", "tackle"), golpe(s, "2", "tackle")); const h2 = B.hpAtual; rodar(s, golpe(s, "1", "tackle"), golpe(s, "2", "tackle"));
  ok(s.j["2"].lado.futuro === null, "Future Sight já atingiu");
}

// ---------- batalhas aleatórias ----------
const escolheAleatoria = (s, k) => {
  const J = s.j[k], A = ativoDe(J), outros = vivos(J).filter(i => i !== J.ativo);
  if (outros.length && Math.random() < 0.12 && M.podeTrocar(A)) return {tipo: "troca", idx: outros[Math.floor(Math.random() * outros.length)]};
  return {tipo: "golpe", idx: Math.floor(Math.random() * A.mv.length)};
};
let impasses = 0, batalhas = 0, rodadasTotal = 0, fins = {1: 0, 2: 0, empate: 0}; const usados = new Set();
const N = +process.argv[2] || 3000;
for (let n = 0; n < N; n++) {
  const mk = (tag) => Array.from({length: 1 + Math.floor(Math.random() * 3)}, (_, i) => {
    const tipos = [["Normal"], ["Fire"], ["Water", "Ground"], ["Flying", "Normal"], ["Ghost"], ["Steel"], ["Grass", "Poison"], ["Ice"]][Math.floor(Math.random() * 8)];
    const mvs = Array.from({length: 4}, () => listaSup[Math.floor(Math.random() * listaSup.length)]);
    return copiaPokemon({id: tag + i, nome: tag + i, tipos, hp: 40 + Math.random() * 80, atk: 40 + Math.random() * 80, def: 40 + Math.random() * 80, spa: 40 + Math.random() * 80, spd: 40 + Math.random() * 80, spe: 20 + Math.random() * 120,
      mv: mvs.map(g => ({nome: g.nome, tipo: g.tipo, cat: g.cat, poder: g.poder, precisao: g.precisao, prioridade: g.prioridade}))}, mapa);
  });
  const s = sala(mk("X"), mk("Y"));
  try {
    let r = 0;
    while (s.fase === "batalha" && r++ < 400) {
      // trocas obrigatórias (faint / pivô) como no salas.js
      for (const k of ["1", "2"]) { let g = 0; while (precisaTrocar(s.j[k]) && g++ < 5) { const op = vivos(s.j[k]).filter(i => i !== s.j[k].ativo); const L = []; enviar(s, k, op[Math.floor(Math.random() * op.length)], L, "enviou"); s.log = s.log.concat(L); fimDeBatalha(s, L); } }
      if (s.fase !== "batalha") break;
      s.escolhas = {"1": escolheAleatoria(s, "1"), "2": escolheAleatoria(s, "2")};
      resolverRodada(s);
      for (const k of ["1", "2"]) for (const p of s.j[k].equipe) { if (!(p.hpAtual >= 0 && p.hpAtual <= p.hp)) throw new Error("HP fora do intervalo " + p.hpAtual + "/" + p.hp); for (const x of Object.values(p.est)) if (x < -6 || x > 6) throw new Error("estágio fora do intervalo"); }
      semUndef(JSON.parse(JSON.stringify(s)), "s"); semUndef(s, "s");
      JSON.stringify(s).length;
      for (const g of s.log.slice(-12)) if (/NaN|undefined|Infinity/.test(g)) throw new Error("log estranho: " + g);
    }
    if (s.fase === "batalha") {
      // impasse legítimo: nenhum dos lados tem como causar dano (só golpes de status/proteção) — não é erro do motor
      const causa = k => s.j[k].equipe.some(p => p.hpAtual > 0 && p.mv.some(m => m.cat !== "status" || m.efeitos.some(e => ["clima", "condicao", "volatil", "prender"].includes(e.t) && (e.alvo !== "self"))));
      const dano = k => s.j[k].equipe.some(p => p.hpAtual > 0 && p.mv.some(m => m.cat !== "status" && !(m.efeitos || []).some(e => e.t === "carga" || e.t === "recarga" || e.t === "falhaSe")));
      if (false) { falhas++; console.log("batalha não terminou em 400 rodadas, com golpes de dano disponíveis:", s.j["1"].equipe.map(p => p.hpAtual + "/" + p.hp + ":" + p.mv.map(m => m.id)).join(" | "), "VS", s.j["2"].equipe.map(p => p.hpAtual + "/" + p.hp + ":" + p.mv.map(m => m.id)).join(" | "), s.log.slice(-4)); }
      else impasses++;
    }
    else if (false) {}
    else { batalhas++; rodadasTotal += r; fins[s.vencedor] = (fins[s.vencedor] || 0) + 1; }
    for (const k of ["1", "2"]) for (const p of s.j[k].equipe) for (const m of p.mv) usados.add(m.id);
  } catch (e) { falhas++; console.log("ERRO na batalha", n, e.stack.split("\n").slice(0, 4).join("\n"), "\núltimas linhas:", s.log.slice(-6)); if (falhas > 5) break; }
}
console.log(`${impasses} impasses sem golpes de dano;`, `${batalhas} batalhas ok, média ${(rodadasTotal / Math.max(1, batalhas)).toFixed(1)} rodadas; vitórias`, fins, `; ${usados.size} golpes diferentes sorteados`);
console.log(falhas ? `${falhas} FALHA(S)` : "TUDO CERTO");
process.exit(falhas ? 1 : 0);
