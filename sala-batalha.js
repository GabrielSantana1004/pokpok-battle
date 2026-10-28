// Tela de batalha: miniaturas das equipes, caixas de vida, campo com os sprites e a caixa de ação (golpes, megaevolução, trocas).
import { escolher, trocaForcada } from "./salas.js";
import { esc } from "./common.js";
import { ativoDe, vivos, precisaTrocar, adv, megaBloqueada, nomeCond, nomeStat, NOME_CLIMA, NOME_TERRENO, NOME_VOL, nomeTela, nomeArmadilha } from "./motor.js";
import { spriteImg } from "./imagem.js";
import { E, badge, imgN, imgAttr, persp, jogada } from "./salaestado.js";
import { barra } from "./sala-fx.js";
import { xpTorre, xpTorreTotal } from "./nivel.js";
import { golpeZ, elegivelZ } from "./zmoves.js";

// efeitos "voláteis" (substituto, semente, preso...) que aparecem como etiquetas
const volChips = p => { const v = p.vol || {}, o = [];
  if (v.subst > 0) o.push(`substituto (${v.subst})`);
  for (const k of ["semente", "naoFugir", "enraizado", "aquaring", "maldicao", "pesadelo", "tormento", "foco", "mira", "destino", "recarga", "protegido"]) if (v[k]) o.push(NOME_VOL[k]);
  if (v.preso > 0) o.push(NOME_VOL.preso); if (v.provocar > 0) o.push(NOME_VOL.provocar); if (v.encore) o.push(NOME_VOL.encore); if (v.disable) o.push(NOME_VOL.disable);
  if (v.bocejo > 0) o.push(NOME_VOL.bocejo); if (v.perish > 0) o.push(`perish ${v.perish - 1}`); if (v.carga != null) o.push(NOME_VOL.carga);
  if (v.invul) o.push(NOME_VOL.invul); if (v.furia) o.push(NOME_VOL.furia);
  return o.map(t => `<span class="chip cond">${t}</span>`); };
const estadosHtml = p => `<div class="estados">${[p.cond && `<span class="chip cond">${nomeCond(p.cond)}</span>`, p.conf > 0 && `<span class="chip cond">confuso</span>`, ...volChips(p),
  ...Object.entries(p.est || {}).filter(([, n]) => n).map(([k, n]) => `<span class="chip ${n > 0 ? "up" : "down"}">${nomeStat(k)} ${n > 0 ? "+" : ""}${n}</span>`)].filter(Boolean).join("")}</div>`;

// clima, terreno, Trick Room e o que há em cada lado do campo (armadilhas e telas)
function barraCampo(s) {
  const c = s.campo || {}, eu = persp(), op = adv(eu), chips = [];
  if (c.clima) chips.push(`${NOME_CLIMA[c.clima.t]} (${c.clima.n})`);
  if (c.terreno) chips.push(`${NOME_TERRENO[c.terreno.t]} (${c.terreno.n})`);
  if (c.sala > 0) chips.push(`Trick Room (${c.sala})`);
  const lado = k => { const l = s.j[k].lado || {}, o = [];
    if (l.rocha) o.push(nomeArmadilha("rocha")); if (l.espinhos) o.push(`Spikes ×${l.espinhos}`); if (l.venenosa) o.push(`Toxic Spikes ×${l.venenosa}`); if (l.teia) o.push(nomeArmadilha("teia"));
    for (const t of ["reflect", "luz", "veu", "vento", "protecaoStatus", "nevoa"]) if (l[t] > 0) o.push(`${nomeTela(t)} (${l[t]})`);
    return o; };
  const meu = lado(eu), dele = lado(op);
  if (!chips.length && !meu.length && !dele.length) return "";
  return `<div class="campo-info">${chips.map(t => `<span class="chip up">${t}</span>`).join("")}${meu.length ? `<span class="lado">Seu lado:</span>${meu.map(t => `<span class="chip cond">${t}</span>`).join("")}` : ""}${dele.length ? `<span class="lado">Lado adversário:</span>${dele.map(t => `<span class="chip cond">${t}</span>`).join("")}` : ""}</div>`;
}
// torre: o adversário só mostra o Pokémon em campo; no lugar das miniaturas vai o placar da subida
const torreInfo = T => `<div class="torre-info"><span>🗼 Andar ${T.andar}/${T.total}</span><span>${T.n} ${T.n === 1 ? "derrotado" : "derrotados"}</span><span title="XP da próxima vitória">próxima: +${xpTorre(T.n + 1)} XP</span><span title="XP acumulado, recebido ao fim da subida">acumulado: ${xpTorreTotal(T.n)} XP</span></div>`;
// bolinhas do time: uma por Pokémon (cinza = derrotado, borda amarela = em campo)
const bolas = j => `<div class="bolas" title="Pokémon restantes: ${vivos(j).length}/${j.equipe.length}">${j.equipe.map((q, i) => `<i class="${q.hpAtual <= 0 ? "caido" : ""}${i === j.ativo ? " ativa" : ""}"></i>`).join("")}</div>`;
function caixaVida(s, k) {
  const j = s.j[k], p = ativoDe(j);
  const est = s.fase !== "batalha" || E.reproz ? "" : precisaTrocar(j) ? "escolhendo o próximo" : s.escolhas[k] ? "✔ escolheu" : "pensando…";
  return `<div class="vida"><div class="vida-topo"><b>${esc(p.nome)}${p.shiny ? " ✨" : ""}${p.chefe ? " 👑" : ""}</b> <small class="nv-pk">Nv ${p.nivel || 50}</small><div class="tipos">${p.tipos.map(badge).join("")}</div>
    ${est ? `<span class="estado">${est}</span>` : ""}<span class="hp-num">${p.hpAtual}/${p.hp}</span></div>
    ${p.habilidade || p.item ? `<small class="hab-linha">${p.habilidade ? "🧬 " + esc(p.habilidade.nome) : ""}${p.item ? " · 🎒 " + esc(p.item.nome) : ""}</small>` : ""}
    ${estadosHtml(p)}<div class="hp-linha"><span class="hp-rot">HP</span>${barra(k, p, j)}</div>${bolas(j)}</div>`;
}
const miniaturas = j => j.equipe.map((q, i) =>
  `<img class="foto mini${q.hpAtual <= 0 ? " caido" : ""}${i === j.ativo ? " ativa" : ""}" ${imgAttr(q)} title="${esc(q.nome)}${q.shiny ? " ✨" : ""} ${q.hpAtual}/${q.hp}" alt="">`).join("");

const botoesTroca = (eu, fn) => vivos(eu).filter(i => i !== eu.ativo)
  .map(i => `<button onclick="${fn}(${i})">${esc(eu.equipe[i].nome)} (${eu.equipe[i].hpAtual}/${eu.equipe[i].hp})</button>`).join("") || "<p>Nenhum outro Pokémon disponível.</p>";

function fmt(l) { // texto na visão de quem joga: "Seu Absol usou...", "O Absol adversário usou..."
  if (!E.jogador) return l;
  const eu = k => k === E.papel;
  return l.replace(/^Jogador (\d) trocou para/, (_, k) => eu(k) ? "Você trocou para" : "O adversário trocou para")
    .replace(/^Jogador (\d) usou (uma Poção|um Reviver)/, (_, k, i) => eu(k) ? `Você usou ${i}` : `O adversário usou ${i}`)
    .replace(/^(.*?) \(J(\d)\)/, (_, n, k) => eu(k) ? `Seu ${n}` : `O ${n} adversário`);
}
const ESCOLHA = {golpe: (e, eu) => esc(ativoDe(eu).mv[e.idx].nome), pocao: (e, eu) => "usar uma Poção em " + esc(eu.equipe[e.idx].nome),
  reviver: (e, eu) => "usar um Reviver em " + esc(eu.equipe[e.idx].nome), troca: (e, eu) => "trocar para " + esc(eu.equipe[e.idx].nome)};

function caixaAcao(s) {
  const papel = E.papel, jogador = E.jogador;
  if (E.reproz) return `<div class="acao" data-quem="${E.reproz.k && jogador ? (E.reproz.k === papel ? "eu" : "adv") : ""}"><p class="texto">${E.reproz.linhas.map(l => esc(fmt(l))).join("<br>")}</p></div>`;
  const ult = s.log.length ? `<p class="ultima">${esc(s.log.slice(-2).join(" "))}</p>` : "";
  if (s.fase === "fim") {
    const res = jogador ? s.j[papel].resultado : null; // XP e nível ganhos (gravados na sala quando o resultado é creditado)
    const xpTxt = res ? ` ⭐ +${res.xp} XP${res.nivelNovo != null ? ` · 🎉 Subiu para o nível ${res.nivelNovo}! +1 ponto de treino (Meus Pokémon)` : ""}` : "";
    const premio = s.vitoriaContada ? ` 🏆 +1 vitória e +1 poção!${s.reviverGanho ? " 💫 E um Reviver (20 vitórias)!" : ""}` : "";
    if (s.torre) { // fim da torre: só XP (sem vitória, poção nem ranking)
      const T = s.torre, der = `${T.n} ${T.n === 1 ? "Pokémon derrotado" : "Pokémon derrotados"}`, quem = T.completa ? `🏆 Você chegou ao topo da torre! ${der}.` : T.encerrada ? `Você deixou a torre com ${der}.` : `Fim da subida: seu time caiu depois de ${der}.`;
      const x = !jogador ? "" : res ? xpTxt : ` ⭐ ${xpTorreTotal(T.n)} XP a receber…`;
      return `<div class="acao fim" data-quem="${jogador ? (T.completa ? "eu" : "adv") : ""}"><p class="texto">${quem}${x}</p>${ult}<button onclick="sairSala()">Sair da torre</button></div>`;
    }
    const t = !s.vencedor ? "A batalha terminou: um dos jogadores saiu." : s.vencedor === "empate" ? "Empate! Os dois jogadores ficaram sem Pokémon." + xpTxt : !jogador ? `${s.bot && s.vencedor === "2" ? "O bot" : "Jogador " + s.vencedor} venceu!` : s.vencedor === papel ? "Você venceu a batalha!" + premio + xpTxt : "Você perdeu a batalha." + xpTxt;
    return `<div class="acao fim" data-quem="${jogador && s.vencedor && s.vencedor !== "empate" ? (s.vencedor === papel ? "eu" : "adv") : ""}"><p class="texto">${t}</p>${ult}<button onclick="sairSala()">Sair da sala</button></div>`;
  }
  if (!jogador) return `<div class="acao"><p class="texto">${precisaTrocar(s.j["1"]) || precisaTrocar(s.j["2"]) ? "Um jogador está escolhendo o próximo Pokémon…" : "Você está assistindo."}</p>${ult}</div>`;
  const eu = s.j[papel], e = s.escolhas[papel];
  if (precisaTrocar(eu)) return `<div class="acao" data-quem="eu"><p class="dica">${ativoDe(eu).hpAtual > 0 ? "Escolha o Pokémon que vai entrar no lugar:" : "Seu Pokémon foi derrotado. Escolha o próximo:"}</p><div class="trocas">${botoesTroca(eu, "forcar")}</div></div>`;
  if (precisaTrocar(s.j[adv(papel)])) return `<div class="acao" data-quem="adv"><p class="texto">Aguardando o adversário escolher o próximo Pokémon…</p>${ult}</div>`;
  if (e) return `<div class="acao" data-quem="adv"><p class="texto">Você escolheu ${ESCOLHA[e.tipo](e, eu)}. Aguardando o adversário…</p>${ult}</div>`;
  const A = ativoDe(eu), V = A.vol || {};
  const forcado = V.recarga ? "Seu Pokémon precisa recarregar: qualquer escolha vale." : V.carga != null ? "Seu Pokémon continua o golpe de 2 turnos: qualquer escolha vale." : V.furia ? "Seu Pokémon está em fúria e repete o golpe." : V.encore ? "Encore: seu Pokémon repete o último golpe." : "";
  const bloq = (m, i) => (V.provocar > 0 && m.cat === "status") || (V.disable && V.disable.idx === i);
  const podeMega = !forcado && !megaBloqueada(s, eu) && !A.slugMega && A.megas?.length > 0;
  // golpe Z: 1 por batalha, gasta 1 cristal Z da conta; não vale junto com megaevolução nem para Pokémon já megaevoluído
  const podeZ = E.jogador && !!eu.chave && !forcado && !eu.zUsada && !A.slugMega && A.mv.some(elegivelZ), temZ = (E.status.zcristais || 0) > 0;
  if (!podeMega || E.zSel) E.megaSel = null;
  if (!podeZ || !temZ) E.zSel = false;
  const zBtn = podeZ ? `<div class="z-btn"><button type="button" class="${E.zSel ? "primario" : ""}" ${temZ ? "" : "disabled"} onclick="golpeZ()" title="Gasta 1 cristal Z; 1 por batalha">💎 ${E.zSel ? "Golpe Z ativado: escolha o golpe" : "Golpe Z"} (${E.status.zcristais || 0} ${E.status.zcristais === 1 ? "cristal" : "cristais"})</button></div>` : "";
  const megaBtn = podeMega && !E.zSel ? `<div class="mega-btn">${A.megas.map((m, i) => `<button type="button" class="${E.megaSel === i ? "primario" : ""}" onclick="mega(${i})">⚡ ${E.megaSel === i ? "Vai megaevoluir: " : "Megaevoluir: "}${esc(m.nome)}</button>`).join("")}</div>` : "";
  return `<div class="acao" data-quem="eu"><p class="dica">${forcado || "Escolha seu movimento (trocar de Pokémon e usar itens fica no menu ☰)"}</p>${megaBtn}${zBtn}<div class="golpes-btn">${A.mv.map((m, i) => {
    const z = E.zSel ? golpeZ(m) : null; // com o golpe Z ativado, cada golpe de dano mostra o seu golpe Z
    return `<button onclick="golpe(${i})" ${(!forcado && bloq(m, i)) || (E.zSel && !z) ? "disabled" : ""} title="${esc(z ? `Golpe Z de ${m.nome}: poder ${z.poder}, sempre acerta` : m.nota || "")}">${badge(m.tipo)}<span>${esc(z ? `💎 ${z.nome} (${z.poder})` : m.nome)}</span></button>`; }).join("")}</div>${ult}</div>`;
}

export function telaBatalha() {
  const s = E.s, eu = persp(), op = adv(eu), pEu = ativoDe(s.j[eu]), pOp = ativoDe(s.j[op]);
  return `<div class="batalha">
    <div class="sala-id">Sala ${esc(E.codigo)} <span class="papel">${E.jogador ? "Jogador " + E.papel : "Espectador"}</span>${s.torre ? ` <span class="papel">Torre</span>` : s.bot ? ` <span class="papel">Bot: ${{facil: "fácil", normal: "normal", dificil: "difícil"}[s.botNivel] || "fácil"}</span>` : ""}</div>
    ${s.torre ? torreInfo(s.torre) : `<div class="eq-adv">${miniaturas(s.j[op])}</div>`}
    ${barraCampo(s)}
    <div class="campo" data-clima="${(s.campo && s.campo.clima && s.campo.clima.t) || ""}" data-terreno="${(s.campo && s.campo.terreno && s.campo.terreno.t) || ""}">
      <div class="hud adv">${caixaVida(s, op)}</div>
      <div class="spot adv${pOp.hpAtual <= 0 ? " caido" : ""}">${spriteImg(imgN(pOp), "frente", pOp.shiny)}</div>
      <div class="spot eu${pEu.hpAtual <= 0 ? " caido" : ""}">${spriteImg(imgN(pEu), "costas", pEu.shiny)}</div>
      <div class="hud eu">${caixaVida(s, eu)}</div>
    </div>
    ${caixaAcao(s)}
  </div>`;
}

Object.assign(window, {
  mega: i => { E.megaSel = E.megaSel === i ? null : i; E.zSel = false; E.render(); },
  golpeZ: () => { E.zSel = !E.zSel; E.megaSel = null; E.render(); },
  golpe: i => { const m = E.megaSel, z = E.zSel; E.megaSel = null; E.zSel = false; jogada(escolher(E.codigo, E.papel, {tipo: "golpe", idx: i, mega: m, z})); },
  forcar: i => jogada(trocaForcada(E.codigo, E.papel, i))
});
