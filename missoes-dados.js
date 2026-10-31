// Missões: lendários que NÃO saem nas raids e são ganhos completando uma coleção. Funções puras (sem Firebase), usadas por missoes.js.
// Os nomes casam com o catálogo sem acento, maiúscula ou pontuação (ex.: "mr-rime" casa com "Mr. Rime"); quem não está no catálogo simplesmente não é exigido.
import { chaveNome, ehLendario } from "./pokemons.js";

// Pokémon de Galar = os da 8ª geração (Grookey … Calyrex, sem o próprio Eternatus) + qualquer forma "galariana" que exista no catálogo
export const GALAR = ["grookey", "thwackey", "rillaboom", "scorbunny", "raboot", "cinderace", "sobble", "drizzile", "inteleon", "skwovet", "greedent", "rookidee", "corvisquire", "corviknight", "blipbug", "dottler", "orbeetle", "nickit", "thievul", "gossifleur", "eldegoss", "wooloo", "dubwool", "chewtle", "drednaw", "yamper", "boltund", "rolycoly", "carkol", "coalossal", "applin", "flapple", "appletun", "silicobra", "sandaconda", "cramorant", "arrokuda", "barraskewda", "toxel", "toxtricity", "sizzlipede", "centiskorch", "clobbopus", "grapploct", "sinistea", "polteageist", "hatenna", "hattrem", "hatterene", "impidimp", "morgrem", "grimmsnarl", "obstagoon", "perrserker", "cursola", "sirfetchd", "mr-rime", "runerigus", "milcery", "alcremie", "falinks", "pincurchin", "snom", "frosmoth", "stonjourner", "eiscue", "indeedee", "morpeko", "cufant", "copperajah", "dracozolt", "arctozolt", "dracovish", "arctovish", "duraludon", "dreepy", "drakloak", "dragapult", "zacian", "zamazenta", "kubfu", "urshifu", "zarude", "regieleki", "regidrago", "glastrier", "spectrier", "calyrex"];
export const PARADOXO_PASSADO = ["Great Tusk", "Scream Tail", "Brute Bonnet", "Flutter Mane", "Slither Wing", "Sandy Shocks", "Roaring Moon", "Walking Wake", "Gouging Fire", "Raging Bolt"];
export const PARADOXO_FUTURO = ["Iron Treads", "Iron Bundle", "Iron Hands", "Iron Jugulis", "Iron Moth", "Iron Thorns", "Iron Valiant", "Iron Leaves", "Iron Boulder", "Iron Crown"];

// Lendários e míticos que não estão na lista LENDARIOS (nem têm a etiqueta), mas também ficam de fora das missões de tipo
export const OUTROS_LENDARIOS = ["celebi", "heatran", "cobalion", "terrakion", "virizion", "tornadus", "thundurus", "landorus", "keldeo", "meloetta", "cosmog", "cosmoem", "meltan", "kubfu", "zarude", "glastrier", "spectrier", "calyrex", "enamorus", "wo-chien", "ting-lu", "chi-yu", "okidogi", "munkidori", "fezandipiti", "ogerpon", "terapagos"];
const CHAVES_EXTRA = OUTROS_LENDARIOS.map(chaveNome);
export const ehLendarioOuMitico = nome => ehLendario(nome) || CHAVES_EXTRA.some(k => chaveNome(nome).startsWith(k));

// req: {dex: true} = todos do catálogo · {tipo} = todos de um tipo (sem lendários e míticos) · {nomes, contem?} = esta lista (e quem tiver "contem" no nome)
const ESPECIAIS = [
  {id: "arceus", nome: "Arceus", titulo: "Pokédex completa", texto: "Tenha um exemplar de cada Pokémon do catálogo.", req: {dex: true}},
  {id: "eternatus", nome: "Eternatus", titulo: "Herói de Galar", texto: "Tenha um exemplar de cada Pokémon de Galar.", req: {nomes: GALAR, contem: "galar"}},
  {id: "koraidon", nome: "Koraidon", titulo: "Ecos do passado", texto: "Tenha um exemplar de cada Pokémon Paradoxo do passado.", req: {nomes: PARADOXO_PASSADO}},
  {id: "miraidon", nome: "Miraidon", titulo: "Visões do futuro", texto: "Tenha um exemplar de cada Pokémon Paradoxo do futuro.", req: {nomes: PARADOXO_FUTURO}},
  {id: "kyurem", nome: "Kyurem", titulo: "O vazio entre os dragões", texto: "Tenha um Zekrom e um Reshiram.", req: {nomes: ["Zekrom", "Reshiram"]}},
  {id: "zygarde", nome: "Zygarde", titulo: "Equilíbrio da ordem", texto: "Tenha um Yveltal e um Xerneas.", req: {nomes: ["Yveltal", "Xerneas"]}},
  {id: "regigigas", nome: "Regigigas", titulo: "O gigante dos regis", texto: "Tenha todos os outros regis: Regirock, Regice, Registeel, Regieleki e Regidrago.", req: {nomes: ["Regirock", "Regice", "Registeel", "Regieleki", "Regidrago"]}},
  {id: "rayquaza", nome: "Rayquaza", titulo: "Senhor dos céus", texto: "Tenha um Kyogre e um Groudon.", req: {nomes: ["Kyogre", "Groudon"]}},
  {id: "necrozma", nome: "Necrozma", titulo: "Luz e escuridão", texto: "Tenha um Solgaleo e um Lunala.", req: {nomes: ["Solgaleo", "Lunala"]}},
  {id: "mewtwo", nome: "Mewtwo", titulo: "A criação", texto: "Tenha um Mew.", req: {nomes: ["Mew"]}},
  {id: "silvally", nome: "Silvally", titulo: "A quimera", texto: "Tenha um Type: Null.", req: {nomes: ["Type: Null"]}}
].map(m => ({grupo: "especiais", ...m}));

// Uma missão por tipo: um exemplar de cada Pokémon do tipo (sem lendários e míticos) rende o lendário do tipo
const POR_TIPO = [["Steel", "Aço", "Registeel"], ["Water", "Água", "Kyogre"], ["Dragon", "Dragão", "Regidrago"], ["Electric", "Elétrico", "Regieleki"], ["Fairy", "Fada", "Diancie"],
  ["Ghost", "Fantasma", "Marshadow"], ["Fire", "Fogo", "Ho-Oh"], ["Ice", "Gelo", "Regice"], ["Bug", "Inseto", "Genesect"], ["Fighting", "Lutador", "Urshifu"], ["Normal", "Normal", "Type: Null"],
  ["Rock", "Pedra", "Regirock"], ["Grass", "Planta", "Shaymin"], ["Psychic", "Psíquico", "Deoxys"], ["Dark", "Sombrio", "Darkrai"], ["Ground", "Terrestre", "Groudon"], ["Poison", "Veneno", "Pecharunt"], ["Flying", "Voador", "Lugia"]];
const DO_TIPO = POR_TIPO.map(([tipo, pt, nome]) => ({id: chaveNome(nome), grupo: "tipos", nome, titulo: `Mestre do tipo ${pt}`, texto: `Tenha um exemplar de cada Pokémon do tipo ${pt} (sem lendários e míticos).`, req: {tipo}}));
export const MISSOES = [...ESPECIAIS, ...DO_TIPO];

export const acharEspecie = (catalogo, nome) => catalogo.find(p => chaveNome(p.nome) === chaveNome(nome));

// Espécies do catálogo que a missão exige (nunca inclui o próprio prêmio)
export function requisitos(m, catalogo) {
  const premio = acharEspecie(catalogo, m.nome);
  let lista;
  if (m.req.dex) lista = catalogo;
  else if (m.req.tipo) lista = catalogo.filter(p => p.tipos?.includes(m.req.tipo) && !ehLendarioOuMitico(p.nome));
  else {
    const chaves = new Set(m.req.nomes.map(chaveNome));
    lista = catalogo.filter(p => { const k = chaveNome(p.nome); return chaves.has(k) || (m.req.contem && k.includes(m.req.contem)); });
  }
  return lista.filter(p => !premio || p.id !== premio.id);
}

// Situação de uma missão: tem = Set com os ids das espécies que a conta possui · resgatadas = {idDaMissão: true}
export function progresso(m, catalogo, tem, resgatadas = {}) {
  const premio = acharEspecie(catalogo, m.nome), req = requisitos(m, catalogo);
  const falta = req.filter(p => !tem.has(String(p.id))), tenho = req.length - falta.length;
  const resgatada = !!resgatadas[m.id], disponivel = !!premio && req.length > 0;
  return {premio, req, falta, tenho, total: req.length, resgatada, disponivel, pronta: disponivel && !resgatada && falta.length === 0};
}
