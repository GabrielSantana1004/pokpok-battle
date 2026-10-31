// Pokémon da conta como INSTÂNCIAS (funções puras, sem Firebase).
// Cada Pokémon que a conta tem é um registro próprio em usuarios/<nick>.pokemons = { <idDaInstância>: { esp, ivs, shiny } }
//  - esp: id da espécie no catálogo · ivs: valor individual (16 a 31) de cada atributo · shiny: sorteado quando o Pokémon é obtido.
// Golpes (builds), nível (niveis), habilidade (habilidades), item (itensEq) e times continuam guardados por id, agora o id da instância:
// assim dá para ter 2 Charizards (ou mais), cada um com IVs, golpes e nível próprios.
export const IV_STATS = ["hp", "atk", "def", "spa", "spd", "spe"];
export const IV_MIN = 16; // todo Pokémon (de jogador ou de bot) nasce com IVs de 16 a 31
export const IV_MAX = 31;
export const CHANCE_SHINY = 0.1; // chance de cada Pokémon novo ser shiny (só visual)

export const sortearIvs = (rng = Math.random) => Object.fromEntries(IV_STATS.map(k => [k, IV_MIN + Math.floor(rng() * (IV_MAX - IV_MIN + 1))]));
export const somaIvs = ivs => IV_STATS.reduce((t, k) => t + (ivs?.[k] ?? 0), 0);
export const novoIdPokemon = (rng = Math.random) => "p" + Date.now().toString(36) + Math.floor(rng() * 36 ** 8).toString(36).padStart(8, "0");
// Registro de um Pokémon recém-obtido (captura, caixa, inicial…): IVs aleatórios e 10% de chance de shiny
export const novoPokemon = (espId, rng = Math.random) => ({esp: String(espId), ivs: sortearIvs(rng), shiny: rng() < CHANCE_SHINY});

// Junta o catálogo com os registros da conta: devolve objetos no formato do catálogo, mas com id = id da instância
// (assim o resto do site, que identifica o Pokémon por p.id, continua funcionando) e esp = id da espécie.
export function instancias(catalogo, mapa) {
  const porEsp = new Map(catalogo.map(p => [p.id, p])), r = [];
  for (const [id, reg] of Object.entries(mapa || {})) {
    const e = porEsp.get(reg.esp); if (!e) continue; // espécie que saiu do catálogo
    r.push({...e, id, esp: e.id, ivs: reg.ivs || null, shiny: !!reg.shiny});
  }
  return r;
}
export const shinyPorInstancia = mapa => Object.fromEntries(Object.entries(mapa || {}).filter(([, r]) => r.shiny).map(([id]) => [id, true]));
export const shinyPorEspecie = mapa => Object.fromEntries(Object.values(mapa || {}).filter(r => r.shiny).map(r => [r.esp, true]));

// ----- os 27 iniciais (formas finais, nível 50): uma linha por geração, na ordem planta · fogo · água -----
export const INICIAIS = [
  ["Venusaur", "Charizard", "Blastoise"],
  ["Meganium", "Typhlosion", "Feraligatr"],
  ["Sceptile", "Blaziken", "Swampert"],
  ["Torterra", "Infernape", "Empoleon"],
  ["Serperior", "Emboar", "Samurott"],
  ["Chesnaught", "Delphox", "Greninja"],
  ["Decidueye", "Incineroar", "Primarina"],
  ["Rillaboom", "Cinderace", "Inteleon"],
  ["Meowscarada", "Skeledirge", "Quaquaval"]
];
export const chaveNome = n => String(n || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]/g, "");
// Casa cada inicial com o catálogo pelo nome (sem acento, maiúscula ou hífen). Devolve as mesmas linhas, com a espécie ou null se não estiver no catálogo.
export const acharIniciais = catalogo => {
  const porNome = new Map(catalogo.map(p => [chaveNome(p.nome), p]));
  return INICIAIS.map(linha => linha.map(n => ({nome: n, esp: porNome.get(chaveNome(n)) || null})));
};

// ----- captura: a bola é a Pokébola comum, grátis e sem limite de tentativas; cada lançamento termina em uma de 3 coisas:
//   capturou (o Pokémon vai para a conta) · escapou (continua lá, dá para tentar de novo) · fugiu (a chance acabou)
// Pokémon do bot: 47,5% captura · 47,5% escapa · 5% foge. Lendário (prêmio da torre): captura 2x menor (23,75%), foge 5%, escapa o resto (71,25%).
export const CAPTURA = {bot: {captura: 0.475, fuga: 0.05}, lendario: {captura: 0.2375, fuga: 0.05}, raid: {captura: 0.2375, fuga: 0}}; // raid: mesma chance do lendário, mas o chefe derrotado nunca foge (dá para tentar até capturar)
export function tentativaCaptura(tipo, rng = Math.random) {
  const c = CAPTURA[tipo] || CAPTURA.bot, r = rng();
  if (r < c.captura) return "capturou";
  if (r < c.captura + c.fuga) return "fugiu";
  return "escapou";
}
// Lendários (e míticos) que podem aparecer ao vencer uma torre: a lista é sua. Casam com o catálogo pelo nome (sem acento, maiúscula ou pontuação); quem não está no catálogo é ignorado.
export const LENDARIOS = [
  "Arceus", "Articuno", "Azelf", "Chien-Pao", "Cresselia", "Darkrai", "Deoxys", "Dialga",
  "Diancie", "Entei", "Eternatus", "Genesect", "Giratina", "Groudon", "Ho-Oh", "Hoopa",
  "Jirachi", "Koraidon", "Kyogre", "Kyurem", "Latias", "Latios", "Lugia", "Lunala",
  "Magearna", "Manaphy", "Marshadow", "Melmetal", "Mesprit", "Mew", "Mewtwo", "Miraidon",
  "Moltres", "Necrozma", "Palkia", "Pecharunt", "Phione", "Raikou", "Rayquaza", "Regice",
  "Regidrago", "Regieleki", "Regigigas", "Regirock", "Registeel", "Reshiram", "Shaymin", "Silvally",
  "Solgaleo", "Suicune", "Tapu Bulu", "Tapu Fini", "Tapu Koko", "Tapu Lele", "Type: Null", "Urshifu",
  "Uxie", "Victini", "Volcanion", "Xerneas", "Yveltal", "Zacian", "Zamazenta", "Zapdos",
  "Zekrom", "Zeraora", "Zygarde"
];
// Pokémon aleatório da Pokébola da caixa: qualquer um do catálogo, menos os lendários da lista (esses vêm da torre)
export function sortearPokemonAleatorio(catalogo, rng = Math.random) {
  const lista = catalogo.filter(p => !ehLendario(p.nome));
  return lista.length ? lista[Math.floor(rng() * lista.length)] : null;
}
// Nomes da lista que não aparecem no catálogo (nome diferente, forma separada, ainda não cadastrado): o botão do admin mostra essa lista
export const lendariosForaDoCatalogo = catalogo => { const chaves = catalogo.map(p => chaveNome(p.nome)); return LENDARIOS.filter(n => !chaves.some(c => c.startsWith(chaveNome(n)))); };
// um nome é lendário se é um da lista ou uma forma dele (ex.: "Kyurem Black", "Urshifu Rapid Strike", "Giratina Origin")
const CHAVES_LEND = LENDARIOS.map(chaveNome);
export const ehLendario = nome => { const k = chaveNome(nome); return CHAVES_LEND.some(l => k.startsWith(l)); };
// Lendários que só se ganham nas Missões (nunca saem na torre nem na raid)
export const LENDARIOS_MISSAO = [
  "Arceus", "Darkrai", "Eternatus", "Koraidon", "Miraidon", "Kyurem", "Zygarde", "Regigigas", "Rayquaza", "Necrozma", "Mewtwo", "Silvally", // coleções especiais
  "Registeel", "Kyogre", "Regidrago", "Regieleki", "Diancie", "Marshadow", "Ho-Oh", "Regice", "Genesect", "Urshifu", "Type: Null", "Regirock", "Shaymin", "Deoxys", "Groudon", "Pecharunt", "Lugia" // um por tipo (Darkrai já está acima)
];
const CHAVES_MISSAO = LENDARIOS_MISSAO.map(chaveNome);
// Etiqueta "lendário" mostrada no catálogo e em Meus Pokémon (vale para todos da lista LENDARIOS e para as formas deles)
export const tagLendario = nome => ehLendario(nome) ? '<span class="tag-lendario" title="Pokémon lendário ou mítico">⭐ Lendário</span>' : "";
export const ehMissao = nome => { const k = chaveNome(nome); return CHAVES_MISSAO.some(m => k.startsWith(m)); };
// Lendário do prêmio da torre: da lista, sem os de missão (a torre pode repetir uma espécie que a conta já tem)
export function sortearLendario(catalogo, rng = Math.random) {
  const lista = catalogo.filter(p => ehLendario(p.nome) && !ehMissao(p.nome));
  return lista.length ? lista[Math.floor(rng() * lista.length)] : null;
}

import { pontosDoNivel } from "./nivel.js";
// ----- troca: o Pokémon vai para a outra conta com TUDO que tem: IVs, shiny, golpes, nível, habilidade e o item que segura (a cópia do item sai do inventário
// de quem deu e entra no de quem recebeu). Quem deu o perde de qualquer time. O Pokémon vai no nível atual: quem deu NÃO recupera os pontos de treino
// que gastou nele e quem recebeu não os paga (ajuste em pontosTrocados). O id da instância continua o mesmo. Funções puras sobre os documentos das contas.
const sem = (m, id) => { const c = {...(m || {})}; delete c[id]; return c; };
export function retirarPokemon(d, id) {
  const reg = d.pokemons?.[id]; if (!reg) throw new Error("Esse Pokémon não está mais na conta.");
  const item = d.itensEq?.[id] || null;
  const pacote = {id, reg, build: d.builds?.[id] ?? null, nivel: d.niveis?.[id] ?? null, hab: d.habilidades?.[id] ?? null, item};
  const upd = {pokemons: sem(d.pokemons, id), builds: sem(d.builds, id), niveis: sem(d.niveis, id), habilidades: sem(d.habilidades, id), itensEq: sem(d.itensEq, id),
    times: (d.times || []).map(t => ({...t, ids: (t.ids || []).filter(i => i !== id)}))};
  const k = pacote.nivel == null ? 0 : pontosDoNivel(pacote.nivel); if (k) upd.pontosTrocados = (d.pontosTrocados || 0) + k;
  if (item) { const itens = {...(d.itens || {})}; itens[item] = Math.max(0, (itens[item] || 0) - 1); if (!itens[item]) delete itens[item]; upd.itens = itens; }
  return {pacote, upd};
}
export function receberPokemon(d, pacote) {
  const {id} = pacote, upd = {pokemons: {...(d.pokemons || {}), [id]: pacote.reg}};
  if (pacote.build) upd.builds = {...(d.builds || {}), [id]: pacote.build};
  if (pacote.nivel != null) { upd.niveis = {...(d.niveis || {}), [id]: pacote.nivel}; const k = pontosDoNivel(pacote.nivel); if (k) upd.pontosTrocados = (d.pontosTrocados || 0) - k; }
  if (pacote.hab) upd.habilidades = {...(d.habilidades || {}), [id]: pacote.hab};
  if (pacote.item) { upd.itens = {...(d.itens || {}), [pacote.item]: ((d.itens || {})[pacote.item] || 0) + 1}; upd.itensEq = {...(d.itensEq || {}), [id]: pacote.item}; }
  return upd;
}
// Troca x (da conta dA) por y (da conta dB): devolve as atualizações de cada conta (mapas inteiros, prontos para tx.update)
export function trocarPokemons(dA, x, dB, y) {
  const a = retirarPokemon(dA, x), b = retirarPokemon(dB, y);
  return {A: {...a.upd, ...receberPokemon({...dA, ...a.upd}, b.pacote)}, B: {...b.upd, ...receberPokemon({...dB, ...b.upd}, a.pacote)}};
}
