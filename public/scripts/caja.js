// scripts/caja.js
import { db } from "./firebase-config.js";
import {
  collection, addDoc, getDocs, query, where, Timestamp
} from "https://www.gstatic.com/firebasejs/10.4.0/firebase-firestore.js";

const btnCalcular = document.getElementById("btnCalcular");
const ventasDia = document.getElementById("ventasDia");
const gastosDia = document.getElementById("gastosDia");
const totalNeto = document.getElementById("totalNeto");

const formMovimiento = document.getElementById("formMovimiento");
const btnCerrarCaja = document.getElementById("btnCerrarCaja");

let totalVentas = 0;
let totalGastos = 0;

// 🔍 Helper: obtener fecha de hoy desde 00:00
function obtenerRangoHoy() {
  const inicio = new Date();
  inicio.setHours(0, 0, 0, 0);
  const fin = new Date();
  fin.setHours(23, 59, 59, 999);
  return { inicio, fin };
}

btnCalcular.addEventListener("click", async () => {
  const { inicio, fin } = obtenerRangoHoy();

  // 🔸 Calcular ventas
  const qVentas = query(collection(db, "ventas"),
    where("fecha", ">=", Timestamp.fromDate(inicio)),
    where("fecha", "<=", Timestamp.fromDate(fin))
  );
  const snapVentas = await getDocs(qVentas);
  totalVentas = 0;
  snapVentas.forEach(doc => {
    totalVentas += doc.data().total || 0;
  });
  ventasDia.textContent = totalVentas.toFixed(2);

  // 🔸 Calcular gastos
  const qGastos = query(collection(db, "gastos"),
    where("fecha", ">=", Timestamp.fromDate(inicio)),
    where("fecha", "<=", Timestamp.fromDate(fin))
  );
  const snapGastos = await getDocs(qGastos);
  totalGastos = 0;
  snapGastos.forEach(doc => {
    totalGastos += doc.data().valor || 0;
  });
  gastosDia.textContent = totalGastos.toFixed(2);

  // 🔸 Total neto
  const neto = totalVentas - totalGastos;
  totalNeto.textContent = neto.toFixed(2);
});

formMovimiento.addEventListener("submit", async (e) => {
  e.preventDefault();
  const concepto = document.getElementById("concepto").value;
  const monto = parseFloat(document.getElementById("monto").value);
  const tipo = document.getElementById("tipo").value;

  try {
    await addDoc(collection(db, "movimientosCaja"), {
      concepto,
      monto,
      tipo,
      fecha: Timestamp.now()
    });
    alert("Movimiento registrado");
    formMovimiento.reset();
  } catch (err) {
    alert("Error: " + err.message);
  }
});

btnCerrarCaja.addEventListener("click", async () => {
  try {
    await addDoc(collection(db, "cierresCaja"), {
      fecha: Timestamp.now(),
      ventas: totalVentas,
      gastos: totalGastos,
      neto: totalVentas - totalGastos
    });
    alert("Caja cerrada correctamente");
  } catch (err) {
    alert("Error al cerrar caja: " + err.message);
  }
});
