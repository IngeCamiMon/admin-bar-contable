// scripts/inventario.js
import { db } from "./firebase-config.js";
import {
  collection, addDoc, getDocs, updateDoc, doc
} from "https://www.gstatic.com/firebasejs/10.4.0/firebase-firestore.js";

const form = document.getElementById("formProducto");
const tabla = document.querySelector("#tablaInventario tbody");

form.addEventListener("submit", async (e) => {
  e.preventDefault();

  const nombre = document.getElementById("nombre").value;
  const categoria = document.getElementById("categoria").value;
  const cantidad = parseInt(document.getElementById("cantidad").value);
  const precioCosto = parseFloat(document.getElementById("precioCosto").value);
  const precioVenta = parseFloat(document.getElementById("precioVenta").value);

  const producto = {
    nombre,
    categoria,
    cantidad,
    precioCosto,
    precioVenta,
    creado: new Date()
  };

  try {
    await addDoc(collection(db, "productos"), producto);
    alert("Producto guardado");
    form.reset();
    cargarInventario();
  } catch (err) {
    alert("Error: " + err.message);
  }
});

async function cargarInventario() {
  tabla.innerHTML = "";
  const snapshot = await getDocs(collection(db, "productos"));
  snapshot.forEach((docSnap) => {
    const p = docSnap.data();
    const alerta = p.cantidad < 5 ? "⚠️ Bajo stock" : "";
    const fila = `
      <tr>
        <td>${p.nombre}</td>
        <td>${p.categoria}</td>
        <td>${p.cantidad}</td>
        <td>$${p.precioVenta.toFixed(2)}</td>
        <td>${alerta}</td>
      </tr>
    `;
    tabla.innerHTML += fila;
  });
}

cargarInventario();
