// scripts/pagos.js
import { db } from "./firebase-config.js";
import {
  collection, addDoc, getDocs, Timestamp
} from "https://www.gstatic.com/firebasejs/10.4.0/firebase-firestore.js";

const formPago = document.getElementById("formPago");
const tablaPagos = document.getElementById("tablaPagos");

formPago.addEventListener("submit", async (e) => {
  e.preventDefault();

  const beneficiario = document.getElementById("beneficiario").value;
  const monto = parseFloat(document.getElementById("monto").value);
  const categoria = document.getElementById("categoria").value;
  const fechaPago = new Date(document.getElementById("fechaPago").value);
  const referencia = document.getElementById("referencia").value;
  const estado = document.getElementById("estadoPago").value;

  const soporteInput = document.getElementById("soporte");
  const soporte = soporteInput.files[0] ? soporteInput.files[0].name : "";

  try {
    await addDoc(collection(db, "pagos"), {
      beneficiario,
      monto,
      categoria,
      fecha: Timestamp.fromDate(fechaPago),
      soporte,
      referencia,
      estado
    });

    alert("Pago registrado correctamente");
    formPago.reset();
    cargarPagos();
  } catch (err) {
    alert("Error al registrar el pago: " + err.message);
  }
});

async function cargarPagos() {
  tablaPagos.innerHTML = "";
  const snapshot = await getDocs(collection(db, "pagos"));
  snapshot.forEach(doc => {
    const p = doc.data();
    const fila = `
      <tr>
        <td>${p.beneficiario}</td>
        <td>$${p.monto.toFixed(2)}</td>
        <td>${p.categoria}</td>
        <td>${p.fecha.toDate().toLocaleDateString()}</td>
        <td>${p.estado}</td>
        <td>${p.referencia || ""}</td>
      </tr>
    `;
    tablaPagos.innerHTML += fila;
  });
}

cargarPagos();
