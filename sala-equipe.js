// Escolha do time antes da batalha: os times são montados e salvos em Meus Pokémon; aqui só se escolhe um (ou, contra o bot, sorteia).
import { confirmarEquipe } from "./salas.js";
import { golpesDe } from "./golpesdb.js";
import { sortearEquipe } from "./bot.js";
import { esc } from "./common.js";
import { usuario } from "./usuarios.js";
import { E, run, msg, imgAttr } from "./salaestado.js";

const doTime = t => t.ids.map(id => E.catalogo.find(p => p.id === id)).filter(Boolean); // só Pokémon que ainda têm golpes escolhidos

export function telaEquipe() {
  const s = E.s;
  if (s.j[E.papel].confirmada) return "<p>Equipe confirmada. Aguardando o adversário...</p>";
  const sorteio = s.bot ? `<p><button onclick="equipeAleatoria()">🎲 Lutar com equipe aleatória</button></p>` : "";
  const times = E.times.filter(t => doTime(t).length);
  if (!usuario()) return sorteio + `<p>Entre na sua conta em <a href="meus.html">Meus Pokémon</a> para usar seus times${s.bot ? ", ou lute com a equipe aleatória" : ""}.</p>`;
  if (!times.length) return sorteio + `<p>Você ainda não tem times salvos. Saia da sala (menu ☰) e crie um time em <b>Meus Pokémon → Times</b> (é preciso escolher os golpes dos Pokémon antes).</p>`;
  return sorteio + `<h3>Escolha seu time</h3><div class="times-sala">${times.map(t => { const eq = doTime(t), faltam = t.ids.length - eq.length;
    return `<article class="time-escolha"><h4>${esc(t.nome)} <small>${eq.length} Pokémon${faltam ? ` · ${faltam} indisponível(is)` : ""}</small></h4>
      <div class="time-minis">${eq.map(p => `<img class="foto mini" ${imgAttr(p)} title="${esc(p.nome)}${p.shiny ? " ✨" : ""} Nv ${p.nivel || 50}" alt="">`).join("")}</div>
      <button class="primario" onclick="usarTime('${esc(t.id)}')">Usar este time</button></article>`; }).join("")}</div>`;
}

async function confirmarAsync(equipe) {
  const mapa = await golpesDe(equipe.flatMap(p => p.mv.map(m => m.nome))); // golpes de status vêm da coleção "golpes"
  await confirmarEquipe(E.codigo, E.papel, equipe, mapa);
}
Object.assign(window, {
  usarTime: id => {
    const t = E.times.find(x => x.id === id), eq = t ? doTime(t) : [];
    if (!eq.length) return msg("Esse time não tem Pokémon disponíveis.");
    if (!confirm(`Usar o time "${t.nome}"? Depois de confirmar, não dá para trocar a equipe nesta sala.`)) return;
    run(confirmarAsync(eq));
  },
  equipeAleatoria: () => { // só em sala contra bot: sorteia 6 Pokémon com 4 golpes cada e já confirma
    if (!confirm("Sortear 6 Pokémon aleatórios e começar a batalha? Depois não dá para trocar a equipe.")) return;
    msg("Sorteando sua equipe…");
    run((async () => { const {equipe, mapa} = await sortearEquipe(E.todos, 6); await confirmarEquipe(E.codigo, E.papel, equipe, mapa); })());
  }
});
