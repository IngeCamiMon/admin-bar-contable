import { db } from "./firebase-config.js";
import {
  collection,
  query,
  where,
  getDocs,
  addDoc,
  Timestamp,
  orderBy,
  doc,
  getDoc
} from "https://www.gstatic.com/firebasejs/10.4.0/firebase-firestore.js";

document.addEventListener("DOMContentLoaded", () => {
  let estadoCaja = {
    totalVentas: 0,
    totalEfectivo: 0,
    totalNequi: 0,
    totalTarjeta: 0,
    ingresosManuales: 0,
    egresosManuales: 0,
    totalGastos: 0
  };

  const ventasDia = document.getElementById("ventasDia");
  const ventasEfectivo = document.getElementById("ventasEfectivo");
  const ventasNequi = document.getElementById("ventasNequi");
  const ventasTarjeta = document.getElementById("ventasTarjeta");
  const gastosDia = document.getElementById("gastosDia");
  const totalNeto = document.getElementById("totalNeto");
  const btnCalcular = document.getElementById("btnCalcular");
  const btnCerrarCaja = document.getElementById("btnCerrarCaja");
  const historialCierres = document.getElementById("tablaCierresBody");
  const alertaFaltantes = document.getElementById("alertaFaltantes");

  const fechaSeleccionadaInput = document.getElementById("fechaSeleccionada");

  function obtenerRangoContable(fechaBase = new Date()) {
    const inicio = new Date(fechaBase.getFullYear(), fechaBase.getMonth(), fechaBase.getDate(), 11, 0, 0);
    const fin = new Date(inicio);
    fin.setDate(fin.getDate() + 1);
    fin.setHours(3, 0, 0, 0);
    return { inicio, fin };
  }

  btnCalcular.addEventListener("click", async () => {
    const fechaSel = fechaSeleccionadaInput.value
      ? new Date(fechaSeleccionadaInput.value)
      : new Date();

    const { inicio, fin } = obtenerRangoContable(fechaSel);

    const qCierreExistente = query(
      collection(db, "cierresCaja"),
      where("desde", "==", Timestamp.fromDate(inicio)),
      where("hasta", "==", Timestamp.fromDate(fin))
    );
    const snapCierre = await getDocs(qCierreExistente);

    if (!snapCierre.empty) {
      alert("Ya se realizó el cierre para este turno.");
      btnCerrarCaja.disabled = true;
      return;
    } else {
      btnCerrarCaja.disabled = false;
    }

    await calcularCaja(inicio, fin);
  });

  async function calcularCaja(inicio, fin) {
    const qVentas = query(
      collection(db, "ventas"),
      where("fecha", ">=", Timestamp.fromDate(inicio)),
      where("fecha", "<", Timestamp.fromDate(fin)),
      where("estado", "==", "pagada")
    );
    const snapVentas = await getDocs(qVentas);

    estadoCaja.totalVentas = 0;
    estadoCaja.totalEfectivo = 0;
    estadoCaja.totalNequi = 0;
    estadoCaja.totalTarjeta = 0;

    snapVentas.forEach(doc => {
      const data = doc.data();
      const total = data.total || 0;
      const efectivo = data.metodoPago?.efectivo || 0;
      const nequi = data.metodoPago?.nequi || 0;
      const tarjeta = data.metodoPago?.tarjeta || 0;

      estadoCaja.totalVentas += total;
      estadoCaja.totalEfectivo += efectivo;
      estadoCaja.totalNequi += nequi;
      estadoCaja.totalTarjeta += tarjeta;
    });

    ventasDia.textContent = estadoCaja.totalVentas.toFixed(2);
    ventasEfectivo.textContent = estadoCaja.totalEfectivo.toFixed(2);
    ventasNequi.textContent = estadoCaja.totalNequi.toFixed(2);
    ventasTarjeta.textContent = estadoCaja.totalTarjeta.toFixed(2);

    const qGastos = query(
      collection(db, "gastos"),
      where("fecha", ">=", Timestamp.fromDate(inicio)),
      where("fecha", "<", Timestamp.fromDate(fin))
    );
    const snapGastos = await getDocs(qGastos);
    let gastosGastos = 0;
    snapGastos.forEach(doc => {
      gastosGastos += doc.data().valor || 0;
    });

    const qMov = query(
      collection(db, "movimientosCaja"),
      where("fecha", ">=", Timestamp.fromDate(inicio)),
      where("fecha", "<", Timestamp.fromDate(fin))
    );
    const snapMov = await getDocs(qMov);

    estadoCaja.ingresosManuales = 0;
    estadoCaja.egresosManuales = 0;

    snapMov.forEach(doc => {
      const data = doc.data();
      if (data.tipo === "ingreso") estadoCaja.ingresosManuales += data.monto || 0;
      if (data.tipo === "egreso") estadoCaja.egresosManuales += data.monto || 0;
    });

    estadoCaja.totalGastos = gastosGastos + estadoCaja.egresosManuales;
    gastosDia.textContent = estadoCaja.totalGastos.toFixed(2);

    const netoFinal = estadoCaja.totalVentas + estadoCaja.ingresosManuales - estadoCaja.totalGastos;
    totalNeto.textContent = netoFinal.toFixed(2);
  }

  btnCerrarCaja.addEventListener("click", async () => {
    const {
      totalVentas,
      totalEfectivo,
      totalNequi,
      totalTarjeta,
      ingresosManuales,
      egresosManuales,
      totalGastos
    } = estadoCaja;

    const netoFinal = totalVentas + ingresosManuales - totalGastos;

    const fechaSel = fechaSeleccionadaInput.value
      ? new Date(fechaSeleccionadaInput.value)
      : new Date();

    const { inicio: desde, fin: hasta } = obtenerRangoContable(fechaSel);

    if (totalVentas === 0 && ingresosManuales === 0 && totalGastos === 0) {
      alert("Debes calcular la caja antes de cerrarla.");
      return;
    }

    try {
      await addDoc(collection(db, "cierresCaja"), {
        fecha: Timestamp.now(),
        desde: Timestamp.fromDate(desde),
        hasta: Timestamp.fromDate(hasta),
        ventas: totalVentas,
        efectivo: totalEfectivo,
        nequi: totalNequi,
        tarjeta: totalTarjeta,
        ingresosManuales,
        egresosManuales,
        gastos: totalGastos,
        neto: netoFinal
      });

      alert("Caja cerrada correctamente");
      mostrarHistorialCierres();
    } catch (err) {
      alert("Error al cerrar caja: " + err.message);
    }
  });

  async function mostrarHistorialCierres() {
    historialCierres.innerHTML = "";
    const q = query(collection(db, "cierresCaja"), orderBy("desde", "desc"));
    const snap = await getDocs(q);

    snap.forEach(doc => {
      const data = doc.data();
      const fecha = data.fecha?.toDate().toLocaleString() || "-";
      const desde = data.desde?.toDate().toLocaleString() || "-";
      const hasta = data.hasta?.toDate().toLocaleString() || "-";
      const row = `
        <tr>
          <td>${fecha}</td>
          <td>${desde}</td>
          <td>${hasta}</td>
          <td>${(data.ventas || 0).toFixed(2)}</td>
          <td>${(data.efectivo || 0).toFixed(2)}</td>
          <td>${(data.nequi || 0).toFixed(2)}</td>
          <td>${(data.tarjeta || 0).toFixed(2)}</td>
          <td>${(data.ingresosManuales || 0).toFixed(2)}</td>
          <td>${(data.egresosManuales || 0).toFixed(2)}</td>
          <td>${(data.gastos || 0).toFixed(2)}</td>
          <td><strong>${(data.neto || 0).toFixed(2)}</strong></td>
        </tr>
      `;
      historialCierres.innerHTML += row;
    });
  }

  async function verificarFaltantes() {
    const hoy = new Date();
    const inicio = new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate() - 10);
    const dias = [];

    for (let i = 0; i < 11; i++) {
      const fechaBase = new Date(inicio);
      fechaBase.setDate(inicio.getDate() + i);
      const { inicio: desde, fin: hasta } = obtenerRangoContable(fechaBase);

      const q = query(
        collection(db, "cierresCaja"),
        where("desde", "==", Timestamp.fromDate(desde)),
        where("hasta", "==", Timestamp.fromDate(hasta))
      );
      const snap = await getDocs(q);
      if (snap.empty && desde < new Date()) {
        dias.push(desde.toLocaleDateString());
      }
    }

    if (dias.length > 0) {
      alertaFaltantes.innerHTML = `
        <div class="alerta">
          Días sin cierre detectados: <strong>${dias.join(", ")}</strong>
        </div>
      `;
    }
  }

  const formMovimiento = document.getElementById("formMovimiento");
  const conceptoInput = document.getElementById("concepto");
  const montoInput = document.getElementById("monto");
  const tipoInput = document.getElementById("tipo");

  formMovimiento.addEventListener("submit", async (e) => {
    e.preventDefault();

    const concepto = conceptoInput.value.trim();
    const monto = parseFloat(montoInput.value);
    const tipo = tipoInput.value;

    if (!concepto || isNaN(monto) || monto <= 0) {
      alert("Por favor, ingresa un concepto y un monto válido.");
      return;
    }

    try {
      await addDoc(collection(db, "movimientosCaja"), {
        fecha: Timestamp.now(),
        tipo,
        monto,
        concepto
      });

      alert(`Movimiento registrado correctamente como ${tipo}.`);
      btnCalcular.click();

      conceptoInput.value = "";
      montoInput.value = "";
      tipoInput.value = "ingreso";
    } catch (err) {
      alert("Error al registrar el movimiento: " + err.message);
    }
  });

  mostrarHistorialCierres();
  verificarFaltantes();
});
