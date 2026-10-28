// Itens segurados (funções puras, sem Firebase). Catálogo, sorteio das caixas e as contas que o motor usa em batalha.
//  - Cada conta guarda  usuarios/<nick>.itens = {idDoItem: cópias}  e  .itensEq = {idDoPokemon: idDoItem}
//  - Um Pokémon segura 1 item; um mesmo item só pode estar em tantos Pokémon quantas cópias a conta tiver.
//  - Em batalha, o item consumido (bagas, gemas, Focus Sash...) só some DAQUELA batalha: a cópia volta para a conta.
//  - Efeitos no motor.js (ganchos) — este arquivo só tem as tabelas e a matemática.
export const TIERS = {comum: {nome: "Comum", peso: 60, cor: "#6b7280"}, incomum: {nome: "Incomum", peso: 30, cor: "#2563eb"}, raro: {nome: "Raro", peso: 10, cor: "#c026d3"}};
const T = ["Normal", "Fire", "Water", "Electric", "Grass", "Ice", "Fighting", "Poison", "Ground", "Flying", "Psychic", "Bug", "Rock", "Ghost", "Dragon", "Dark", "Steel", "Fairy"];
// linhas: id|Nome|tier|descrição   (tier: c = comum, i = incomum, r = raro)
const L = `leftovers|Leftovers|r|Recupera 1/16 do HP máximo ao fim da rodada
black-sludge|Black Sludge|i|Recupera 1/16 do HP de tipo Poison; machuca (1/8) quem não é Poison
life-orb|Life Orb|r|Golpes de dano causam 30% a mais, mas o usuário perde 1/10 do HP máximo
choice-band|Choice Band|r|Ataque ×1,5, mas fica preso ao primeiro golpe usado
choice-specs|Choice Specs|r|Atq. Esp. ×1,5, mas fica preso ao primeiro golpe usado
choice-scarf|Choice Scarf|r|Velocidade ×1,5, mas fica preso ao primeiro golpe usado
assault-vest|Assault Vest|r|Def. Esp. ×1,5, mas não pode usar golpes de status
expert-belt|Expert Belt|i|Golpes super efetivos causam 20% a mais
muscle-band|Muscle Band|c|Golpes físicos causam 10% a mais
wise-glasses|Wise Glasses|c|Golpes especiais causam 10% a mais
metronome|Metronome (item)|i|Repetir o mesmo golpe aumenta o dano (+20% por uso, até +100%)
loaded-dice|Loaded Dice|i|Golpes de 2 a 5 acertos dão sempre 4 ou 5 golpes
big-root|Big Root|i|Golpes que drenam HP recuperam 30% a mais
rocky-helmet|Rocky Helmet|i|Quem acerta o portador com golpe de contato perde 1/6 do HP máximo
heavy-duty-boots|Heavy-Duty Boots|i|Ignora Stealth Rock, Spikes, Toxic Spikes e Sticky Web ao entrar
air-balloon|Air Balloon|i|Imune a golpes Ground até ser atingido (então estoura)
clear-amulet|Clear Amulet|r|Impede quedas de atributo causadas pelo adversário
covert-cloak|Covert Cloak|r|Bloqueia os efeitos secundários dos golpes que recebe
ability-shield|Ability Shield|r|A habilidade não pode ser ignorada (Mold Breaker)
safety-goggles|Safety Goggles|i|Imune a dano de clima (areia/granizo) e a golpes de pó
protective-pads|Protective Pads|i|Os golpes do portador não ativam efeitos de contato do alvo
punching-glove|Punching Glove|i|Golpes de soco +10% e sem contato
throat-spray|Throat Spray|i|+1 Atq. Esp. após usar um golpe de som (1 vez)
weakness-policy|Weakness Policy|r|Ao levar golpe super efetivo: Ataque e Atq. Esp. +2 (1 vez)
white-herb|White Herb|i|Desfaz as quedas de atributo (1 vez)
mental-herb|Mental Herb|i|Desfaz Taunt, Encore, Disable e Torment (1 vez)
focus-sash|Focus Sash|r|Com HP cheio, sobrevive a um golpe fatal com 1 de HP (1 vez)
focus-band|Focus Band|i|10% de chance de sobreviver a um golpe fatal com 1 de HP
sitrus-berry|Sitrus Berry|i|Cura 1/4 do HP máximo quando o HP chega a 50% (1 vez)
oran-berry|Oran Berry|c|Cura 10 HP quando o HP chega a 50% (1 vez)
figy-berry|Figy Berry|i|Cura 1/3 do HP máximo quando o HP chega a 25% (1 vez)
wiki-berry|Wiki Berry|i|Cura 1/3 do HP máximo quando o HP chega a 25% (1 vez)
mago-berry|Mago Berry|i|Cura 1/3 do HP máximo quando o HP chega a 25% (1 vez)
aguav-berry|Aguav Berry|i|Cura 1/3 do HP máximo quando o HP chega a 25% (1 vez)
iapapa-berry|Iapapa Berry|i|Cura 1/3 do HP máximo quando o HP chega a 25% (1 vez)
lum-berry|Lum Berry|i|Cura qualquer condição ou confusão (1 vez)
cheri-berry|Cheri Berry|c|Cura paralisia (1 vez)
chesto-berry|Chesto Berry|c|Cura sono (1 vez)
pecha-berry|Pecha Berry|c|Cura veneno (1 vez)
rawst-berry|Rawst Berry|c|Cura queimadura (1 vez)
aspear-berry|Aspear Berry|c|Cura congelamento (1 vez)
persim-berry|Persim Berry|c|Cura confusão (1 vez)
leppa-berry|Leppa Berry|c|Recupera PP — este jogo não tem PP, por isso não faz nada (não sai nas caixas)
liechi-berry|Liechi Berry|i|Ataque +1 quando o HP chega a 25% (1 vez)
ganlon-berry|Ganlon Berry|i|Defesa +1 quando o HP chega a 25% (1 vez)
salac-berry|Salac Berry|i|Velocidade +1 quando o HP chega a 25% (1 vez)
petaya-berry|Petaya Berry|i|Atq. Esp. +1 quando o HP chega a 25% (1 vez)
apicot-berry|Apicot Berry|i|Def. Esp. +1 quando o HP chega a 25% (1 vez)
lansat-berry|Lansat Berry|i|Aumenta a chance de crítico quando o HP chega a 25% (1 vez)
starf-berry|Starf Berry|i|Um atributo aleatório +2 quando o HP chega a 25% (1 vez)
micle-berry|Micle Berry|i|Próximo golpe com +20% de precisão quando o HP chega a 25% (1 vez)
custap-berry|Custap Berry|i|Age primeiro na mesma prioridade quando o HP chega a 25% (1 vez)
enigma-berry|Enigma Berry|i|Cura 1/4 do HP ao levar golpe super efetivo (1 vez)
jaboca-berry|Jaboca Berry|i|O atacante perde 1/8 do HP ao acertar o portador com golpe físico (1 vez)
rowap-berry|Rowap Berry|i|O atacante perde 1/8 do HP ao acertar o portador com golpe especial (1 vez)
RESBAGAS
flame-orb|Flame Orb|i|Queima o portador no fim da rodada
toxic-orb|Toxic Orb|i|Envenena gravemente o portador no fim da rodada
light-clay|Light Clay|i|Reflect, Light Screen e Aurora Veil duram 8 rodadas
damp-rock|Damp Rock|i|Chuva criada pelo portador dura 8 rodadas
heat-rock|Heat Rock|i|Sol criado pelo portador dura 8 rodadas
smooth-rock|Smooth Rock|i|Tempestade de areia criada pelo portador dura 8 rodadas
icy-rock|Icy Rock|i|Granizo/neve criado pelo portador dura 8 rodadas
terrain-extender|Terrain Extender|i|Terrenos criados pelo portador duram 8 rodadas
room-service|Room Service|i|Velocidade -1 quando o Trick Room é ativado (1 vez)
eject-button|Eject Button|i|Troca de Pokémon depois de ser atingido (1 vez)
eject-pack|Eject Pack|i|Troca de Pokémon depois de uma queda de atributo (1 vez)
red-card|Red Card|i|Força o atacante a sair depois de acertar o portador (1 vez)
shed-shell|Shed Shell|i|Pode trocar mesmo preso (Wrap, Mean Look...)
lagging-tail|Lagging Tail|i|Age por último na mesma prioridade
full-incense|Full Incense|i|Age por último na mesma prioridade
quick-claw|Quick Claw|i|20% de chance de agir primeiro na mesma prioridade
brightpowder|BrightPowder|c|Golpes contra o portador têm 10% menos precisão
lax-incense|Lax Incense|c|Golpes contra o portador têm 10% menos precisão
kings-rock|King's Rock|i|10% de chance de fazer o alvo recuar com golpes de dano
razor-fang|Razor Fang|i|10% de chance de fazer o alvo recuar com golpes de dano
scope-lens|Scope Lens|c|+1 no nível de chance de crítico
razor-claw|Razor Claw|c|+1 no nível de chance de crítico
wide-lens|Wide Lens|c|Precisão dos golpes +10%
zoom-lens|Zoom Lens|c|Precisão +20% se o alvo já agiu na rodada
power-herb|Power Herb|i|Golpes de 2 turnos saem na hora (1 vez)
binding-band|Binding Band|i|Golpes que prendem causam 1/6 por rodada em vez de 1/8
destiny-knot|Destiny Knot|c|Só afeta Attract, que não existe neste jogo (não sai nas caixas)
GEMAS
BOOSTS`;
const BOOST = [["silk-scarf", "Silk Scarf", "Normal"], ["charcoal", "Charcoal", "Fire"], ["mystic-water", "Mystic Water", "Water"], ["magnet", "Magnet", "Electric"], ["miracle-seed", "Miracle Seed", "Grass"],
  ["never-melt-ice", "Never-Melt Ice", "Ice"], ["black-belt", "Black Belt", "Fighting"], ["poison-barb", "Poison Barb", "Poison"], ["soft-sand", "Soft Sand", "Ground"], ["sharp-beak", "Sharp Beak", "Flying"],
  ["twisted-spoon", "Twisted Spoon", "Psychic"], ["silver-powder", "Silver Powder", "Bug"], ["hard-stone", "Hard Stone", "Rock"], ["spell-tag", "Spell Tag", "Ghost"], ["dragon-fang", "Dragon Fang", "Dragon"],
  ["black-glasses", "Black Glasses", "Dark"], ["metal-coat", "Metal Coat", "Steel"]];
const BAGA_RES = [["occa", "Fire"], ["passho", "Water"], ["wacan", "Electric"], ["rindo", "Grass"], ["yache", "Ice"], ["chople", "Fighting"], ["kebia", "Poison"], ["shuca", "Ground"], ["coba", "Flying"],
  ["payapa", "Psychic"], ["tanga", "Bug"], ["charti", "Rock"], ["kasib", "Ghost"], ["haban", "Dragon"], ["colbur", "Dark"], ["babiri", "Steel"], ["chilan", "Normal"], ["roseli", "Fairy"]];
const cap = s => s[0].toUpperCase() + s.slice(1);
const TXT = L.replace("RESBAGAS", BAGA_RES.map(([n, t]) => `${n}-berry|${cap(n)} Berry|i|${n === "chilan" ? "Reduz à metade o dano de golpes Normal" : `Reduz à metade o dano de um golpe ${t} super efetivo`} (1 vez)`).join("\n"))
  .replace("GEMAS", T.map(t => `${t.toLowerCase()}-gem|${t} Gem|i|Reforça em 30% o primeiro golpe ${t} de dano; some depois de usada`).join("\n"))
  .replace("BOOSTS", BOOST.map(([id, n, t]) => `${id}|${n}|c|Golpes ${t} causam 20% a mais`).join("\n"));
const TIER = {c: "comum", i: "incomum", r: "raro"};
export const SEM_EFEITO = {"leppa-berry": "o jogo não tem PP", "destiny-knot": "o jogo não tem Attract"};
export const ITENS = TXT.split("\n").map(l => { const [id, nome, t, desc] = l.split("|"); return {id, nome, tier: TIER[t], desc, semEfeito: SEM_EFEITO[id] || null}; });
const MAPA = new Map(ITENS.map(i => [i.id, i]));
export const itemPorId = id => MAPA.get(id) || null;
export const itensDeCaixa = ITENS.filter(i => !i.semEfeito);
export const ehBaga = id => /-berry$/.test(id || "");

// ----- tabelas usadas pelo motor -----
export const BOOST_TIPO = Object.fromEntries(BOOST.map(([id, , t]) => [id, t]));
export const GEMA_TIPO = Object.fromEntries(T.map(t => [`${t.toLowerCase()}-gem`, t]));
export const BAGA_TIPO = Object.fromEntries(BAGA_RES.map(([n, t]) => [`${n}-berry`, t]));
const BAGA_BAIXO = ["figy-berry", "wiki-berry", "mago-berry", "aguav-berry", "iapapa-berry"]; // curam 1/3 com HP ≤ 25%
const BAGA_ESTAGIO = {"liechi-berry": "atk", "ganlon-berry": "def", "salac-berry": "spe", "petaya-berry": "spa", "apicot-berry": "spd"};
const CURA_COND = {"cheri-berry": ["paralisia"], "chesto-berry": ["sono"], "pecha-berry": ["veneno", "veneno-grave"], "rawst-berry": ["queimadura"], "aspear-berry": ["congelamento"]};
export const BAGA_ESPERA = {BAGA_BAIXO, BAGA_ESTAGIO, CURA_COND};
export const ESCOLHA = {"choice-band": "atk", "choice-specs": "spa", "choice-scarf": "spe"};
export const ehEscolha = id => id in ESCOLHA;
export const ehPoder25 = id => id === "lansat-berry" || id === "starf-berry" || id === "micle-berry" || id === "custap-berry" || id in BAGA_ESTAGIO || BAGA_BAIXO.includes(id);

// item em vigor (Klutz anula o item)
export const itemId = P => (P?.item?.id && P?.habilidade?.id !== "klutz") ? P.item.id : null;

// multiplicador de atributo por item
export function multStatItem(P, stat) {
  const i = itemId(P); if (!i) return 1;
  if (ESCOLHA[i] === stat) return 1.5;
  if (i === "assault-vest" && stat === "spd") return 1.5;
  return 1;
}
// dano final: Life Orb, Expert Belt, Muscle Band, Wise Glasses, Metronome, itens de tipo, Punching Glove
export function danoItemMult({A, m, tipo, mult, fis, metro = 0}) {
  const i = itemId(A); if (!i) return 1;
  let f = 1;
  if (i === "life-orb") f *= 1.3;
  if (i === "expert-belt" && mult > 1) f *= 1.2;
  if (i === "muscle-band" && fis) f *= 1.1;
  if (i === "wise-glasses" && !fis) f *= 1.1;
  if (i === "metronome") f *= 1 + Math.min(1, 0.2 * metro);
  if (BOOST_TIPO[i] === tipo) f *= 1.2;
  if (i === "punching-glove" && /(punch|punching|fists|mash)$/.test(m?.id || "")) f *= 1.1;
  return f;
}
// duração extra de clima, terreno e telas (+3 rodadas)
export function extensao(P, tipo, nome) {
  const i = itemId(P);
  if (tipo === "clima") return (i === "damp-rock" && nome === "chuva") || (i === "heat-rock" && nome === "sol") || (i === "smooth-rock" && nome === "areia") || (i === "icy-rock" && (nome === "granizo" || nome === "neve")) ? 3 : 0;
  if (tipo === "terreno") return i === "terrain-extender" ? 3 : 0;
  if (tipo === "tela") return i === "light-clay" ? 3 : 0;
  return 0;
}

// ----- caixas: 30% cristais Z (1 a 3) · 70% cinco itens; raridade sorteada por item (60% comum · 30% incomum · 10% raro) -----
export const CAIXA = {chanceCristal: 0.3, cristaisMin: 1, cristaisMax: 3, itens: 5};
export function sortearItem(rng = Math.random, pesos = Object.fromEntries(Object.entries(TIERS).map(([k, v]) => [k, v.peso]), ), pool = itensDeCaixa) {
  const total = Object.values(pesos).reduce((a, b) => a + b, 0); let r = rng() * total, tier = "comum";
  for (const [k, p] of Object.entries(pesos)) { if (r < p) { tier = k; break; } r -= p; }
  const lista = pool.filter(i => i.tier === tier), usa = lista.length ? lista : pool;
  return usa[Math.floor(rng() * usa.length)];
}
export function sortearCaixa(rng = Math.random) {
  if (rng() < CAIXA.chanceCristal) return {tipo: "cristais", n: CAIXA.cristaisMin + Math.floor(rng() * (CAIXA.cristaisMax - CAIXA.cristaisMin + 1))};
  return {tipo: "itens", itens: Array.from({length: CAIXA.itens}, () => sortearItem(rng).id)};
}
// itens dos bots: 'facil' 30% de chance e só comuns · 'normal' 60% comuns/incomuns · 'dificil' sempre, qualquer raridade · 'torre' 50% · 'chefe' sempre e raros
const BOT_MODO = {facil: [0.3, {comum: 80, incomum: 20}], normal: [0.6, {comum: 50, incomum: 40, raro: 10}], dificil: [1, {comum: 30, incomum: 45, raro: 25}], torre: [0.5, {comum: 50, incomum: 40, raro: 10}], chefe: [1, {incomum: 30, raro: 70}]};
export function itemDeBot(modo = "normal", rng = Math.random) {
  const [chance, pesos] = BOT_MODO[modo] || BOT_MODO.normal;
  if (rng() >= chance) return null;
  const i = sortearItem(rng, pesos); return {id: i.id, nome: i.nome};
}

// ----- inventário da conta -----
export const contarEquipados = eq => { const c = {}; for (const id of Object.values(eq || {})) c[id] = (c[id] || 0) + 1; return c; };
// cópias livres de um item para equipar neste Pokémon (as que já estão em outros Pokémon não contam)
export function copiasLivres(itens, eq, itemIdX, pokemonId) {
  const outros = Object.entries(eq || {}).filter(([pid, id]) => id === itemIdX && pid !== pokemonId).length;
  return Math.max(0, (itens?.[itemIdX] || 0) - outros);
}
// item de um Pokémon na batalha (só vale se a conta ainda tem a cópia)
export function itemEquipado(pokemonId, itens, eq) {
  const id = eq?.[pokemonId], i = id && itemPorId(id);
  return i && (itens?.[id] || 0) > 0 ? {id: i.id, nome: i.nome} : null;
}
export const marcaItem = i => i?.semEfeito ? ` ⚠ sem efeito (${i.semEfeito})` : "";
