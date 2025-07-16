// scripts/gastos.js
import { db } from "./firebase-config.js";
import {
  collection, addDoc, getDocs, query, orderBy
} from "https://www.gstatic.com/firebasejs/10.4.0/firebase-firestore.js";

const form = document.getElementById("formGasto");
const tabla = document.querySelector("#tablaGastos tbody");

form.addEventListener("submit", async (e) => {
  e.preventDefault();

  const descripcion = document.getElementById("descripcion").value;
  const valor = parseFloat(document.getElementById("valor").value);
  const fecha = document.getElementById("fecha").value;
  const categoria = document.getElementById("categoria").value;

  const gasto = {
    descripcion,
    valor,
    categoria,
    fecha: new Date(fecha)
  };

  try {
    await addDoc(collection(db, "gastos"), gasto);
    alert("Gasto registrado");
    form.reset();
    cargarGastos();
  } catch (err) {
    alert("Error: " + err.message);
  }
});

async function cargarGastos() {
  tabla.innerHTML = "";
  const q = query(collection(db, "gastos"), orderBy("fecha", "desc"));
  const snapshot = await getDocs(q);

  snapshot.forEach(docSnap => {
    const g = docSnap.data();
    const fila = `
      <tr>
        <td>${new Date(g.fecha.seconds * 1000).toLocaleDateString()}</td>
        <td>${g.descripcion}</td>
        <td>${g.categoria}</td>
        <td>$${g.valor.toFixed(2)}</td>
      </tr>
    `;
    tabla.innerHTML += fila;
  });
}

cargarGastos();
