import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getFirestore, collection, getDocs, getDoc, doc, addDoc, setDoc, deleteDoc }
  from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { lerCache, gravarCache, apagarCache } from "./cache.js";

// COLE AQUI o firebaseConfig do seu projeto
// (Firebase Console > Configurações do projeto > Seus apps > App da Web)
const firebaseConfig = {
  apiKey: "AIzaSyCmAXdsYcTcc9A1FEqHIs9DN7FUyjVhxn0",
  authDomain: "pokpok-batle.firebaseapp.com",
  projectId: "pokpok-batle",
  storageBucket: "pokpok-batle.firebasestorage.app",
  messagingSenderId: "936852786881",
  appId: "1:936852786881:web:4b0dd01618e96a8a1dce40",
  measurementId: "G-H05X3LH3BX"
};

const db = getFirestore(initializeApp(firebaseConfig));
const col = collection(db, "pokemons");

// O catálogo é lido inteiro (1 leitura por Pokémon), então fica guardado no navegador por 6 horas. Editar/importar/remover limpa o cache deste navegador;
// para outros aparelhos pegarem uma mudança na hora, abra a página com ?atualizar na URL (ex.: catalogo.html?atualizar).
const CAT_TTL = 6 * 60 * 60 * 1000;
let lendo = null;
export async function listar() {
  if (!/[?&]atualizar\b/.test(location.search)) { const c = await lerCache("catalogo", CAT_TTL); if (c) return c; }
  lendo ||= (async () => {
    const s = await getDocs(col);
    const lista = s.docs.map(d => ({id: d.id, ...d.data()})).sort((a, b) => a.nome.localeCompare(b.nome));
    if (lista.length) await gravarCache("catalogo", lista); // catálogo vazio não é guardado: o primeiro import aparece na hora
    return lista;
  })().finally(() => { lendo = null; });
  return structuredClone(await lendo);
}
export async function obter(id) {
  const d = await getDoc(doc(db, "pokemons", id));
  return d.exists() ? {id: d.id, ...d.data()} : null;
}
export async function salvar(p, id) {
  const {id: _ignorar, ...dados} = p;
  if (id) { await setDoc(doc(db, "pokemons", id), dados, {merge: true}); await apagarCache("catalogo"); return id; } // merge: mantém campos que o formulário não conhece (ex.: aprende)
  const novo = (await addDoc(col, dados)).id; await apagarCache("catalogo"); return novo;
}
export async function remover(id) { await deleteDoc(doc(db, "pokemons", id)); await apagarCache("catalogo"); }

// Exemplos para popular o catálogo vazio (botão na página do catálogo)
export const EXEMPLOS = [
  {nome:"Garchomp", tipos:["Dragon","Ground"], hp:108, atk:130, def:95, spa:80, spd:85, spe:102,
   mv:[{nome:"Earthquake",tipo:"Ground",cat:"fisico"},{nome:"Dragon Claw",tipo:"Dragon",cat:"fisico"},
       {nome:"Stone Edge",tipo:"Rock",cat:"fisico"},{nome:"Swords Dance",tipo:"Normal",cat:"status"}]},
  {nome:"Charizard", tipos:["Fire","Flying"], hp:78, atk:84, def:78, spa:109, spd:85, spe:100,
   mv:[{nome:"Flamethrower",tipo:"Fire",cat:"especial"},{nome:"Air Slash",tipo:"Flying",cat:"especial"},
       {nome:"Dragon Pulse",tipo:"Dragon",cat:"especial"},{nome:"Roost",tipo:"Flying",cat:"status"}]},
  {nome:"Blastoise", tipos:["Water"], hp:79, atk:83, def:100, spa:85, spd:105, spe:78,
   mv:[{nome:"Hydro Pump",tipo:"Water",cat:"especial"},{nome:"Ice Beam",tipo:"Ice",cat:"especial"},
       {nome:"Flash Cannon",tipo:"Steel",cat:"especial"},{nome:"Earthquake",tipo:"Ground",cat:"fisico"}]}
];
