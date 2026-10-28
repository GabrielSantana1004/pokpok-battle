// Estado e atalhos compartilhados pelos módulos da sala (sala.js, sala-equipe.js, sala-batalha.js, sala-menu.js, sala-replay.js, sala-fx.js).
import { sessao } from "./salas.js";
import { esc } from "./common.js";

export const $ = id => document.getElementById(id);
export const ses = sessao.ler();
export const E = {
  s: null,                         // estado da sala (durante a reprodução de uma rodada, é a "visão" daquele momento)
  codigo: ses?.codigo, papel: ses?.papel, jogador: ses?.papel !== "E",
  catalogo: [], todos: [],         // catalogo: Pokémon do jogador com golpes escolhidos (com shiny); todos: catálogo inteiro
  times: [],                       // times salvos na conta
  meusShiny: {}, niveis: {},      // niveis: nível de cada Pokémon da conta (treino)
  status: {vitorias: 0, pocoes: 0, revives: 0, zcristais: 0, caixas: 0, nivel: 0, xp: 0, falta: 100},
  reproz: null,                    // passo da rodada que está sendo mostrado
  menuAberto: false, megaSel: null, zSel: false, saindo: false,
  render: () => {}, carregaStatus: () => {}   // preenchidos por sala.js
};

export const badge = t => `<span class="tipo t-${esc(t)}">${esc(t)}</span>`;
export const nivelHp = (hp, max) => { const p = max ? hp / max * 100 : 0; return p >= 50 ? "alto" : p >= 20 ? "medio" : "baixo"; };
export const imgN = q => q.slugMega || q.nome; // nome para buscar a imagem (a mega tem a própria forma na PokéAPI)
export const imgAttr = q => `data-pokemon="${esc(imgN(q))}"${q.shiny ? ' data-shiny="1"' : ""}`;
// de quem é a visão: o jogador vê a si mesmo embaixo à esquerda (de costas); o espectador vê pelo lado do Jogador 1
export const persp = () => E.papel === "2" ? "2" : "1";
export const msg = t => { $("msg-sala").textContent = t || ""; };
export async function run(p) { try { msg(); await p; } catch(e) { msg(e.message); } }
export const jogada = p => { E.menuAberto = false; run(p).then(() => E.carregaStatus()); };
