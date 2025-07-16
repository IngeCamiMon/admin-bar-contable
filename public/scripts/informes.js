import { db } from "./firebase-config.js";
import {
  collection, getDocs, query, where, Timestamp
} from "https://www.gstatic.com/firebasejs/10.4.0/firebase-firestore.js";

import "https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js";
import "https://cdn.jsdelivr.net/npm/chart.js";

const ventasTotal = document.getElementById("ventasTotal");
const gastosTotal = document.getElementById("gastosTotal");
const utilidad = document.getElementById("utilidad");
const detalleDiv = document.getElementById("detalleInforme");
const filtroCategoria = document.getElementById("filtroCategoria");
const filtroProducto = document.getElementById("filtroProducto");
const chartCanvas = document.getElementById("grafico");
let chart;

const resumen = {
  totalVentas: 0,
  totalGastos: 0,
  detalle: [],
  porProducto: {},
  porCategoria: {}
};

document.getElementById("formInforme").addEventListener("submit", async (e) => {
  e.preventDefault();
  const inicio = new Date(document.getElementById("fechaInicio").value);
  const fin = new Date(document.getElementById("fechaFin").value);
  const tipo = document.getElementById("tipoInforme").value;
  fin.setHours(23, 59, 59, 999);

  resumen.totalVentas = 0;
  resumen.totalGastos = 0;
  resumen.detalle = [];
  resumen.porProducto = {};
  resumen.porCategoria = {};

  const qVentas = query(collection(db, "ventas"),
    where("fecha", ">=", Timestamp.fromDate(inicio)),
    where("fecha", "<=", Timestamp.fromDate(fin))
  );
  const snapVentas = await getDocs(qVentas);

  snapVentas.forEach(doc => {
    const v = doc.data();
    resumen.totalVentas += v.total || 0;

    v.productos.forEach(p => {
      if (filtroCategoria.value && filtroCategoria.value !== p.categoria) return;
      if (filtroProducto.value && filtroProducto.value !== p.nombre) return;

      resumen.porProducto[p.nombre] = (resumen.porProducto[p.nombre] || 0) + p.cantidad;
      const cat = p.categoria || "Sin categoría";
      resumen.porCategoria[cat] = (resumen.porCategoria[cat] || 0) + p.cantidad;
    });
  });

  const qGastos = query(collection(db, "gastos"),
    where("fecha", ">=", Timestamp.fromDate(inicio)),
    where("fecha", "<=", Timestamp.fromDate(fin))
  );
  const snapGastos = await getDocs(qGastos);
  snapGastos.forEach(doc => {
    resumen.totalGastos += doc.data().valor || 0;
  });

  ventasTotal.textContent = resumen.totalVentas.toFixed(2);
  gastosTotal.textContent = resumen.totalGastos.toFixed(2);
  utilidad.textContent = (resumen.totalVentas - resumen.totalGastos).toFixed(2);

  const fuente = tipo === "producto" ? resumen.porProducto :
                 tipo === "categoria" ? resumen.porCategoria : {};

  resumen.detalle = [];
  detalleDiv.innerHTML = "<h4>Detalle</h4><table><thead><tr><th>Nombre</th><th>Cantidad</th></tr></thead><tbody>";
  for (let [k, v] of Object.entries(fuente)) {
    resumen.detalle.push({ nombre: k, cantidad: v });
    detalleDiv.innerHTML += `<tr><td>${k}</td><td>${v}</td></tr>`;
  }
  detalleDiv.innerHTML += "</tbody></table>";

  renderChart(fuente);
});

// 🔸 Exportar PDF corregido (sin import dinámico)
document.getElementById("btnExportarPDF").addEventListener("click", () => {
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF();

  doc.text("Informe de Ventas y Gastos", 10, 10);
  doc.text(`Ventas: $${resumen.totalVentas.toFixed(2)}`, 10, 20);
  doc.text(`Gastos: $${resumen.totalGastos.toFixed(2)}`, 10, 30);
  doc.text(`Utilidad: $${(resumen.totalVentas - resumen.totalGastos).toFixed(2)}`, 10, 40);

  let y = 60;
  doc.text("Detalle:", 10, 50);
  resumen.detalle.forEach(r => {
    doc.text(`${r.nombre}: ${r.cantidad}`, 10, y);
    y += 10;
  });

  doc.save("informe.pdf");
});

// 🔸 Exportar Excel
document.getElementById("btnExportarExcel").addEventListener("click", () => {
  const wb = XLSX.utils.book_new();
  const wsResumen = XLSX.utils.aoa_to_sheet([
    ["Ventas", resumen.totalVentas],
    ["Gastos", resumen.totalGastos],
    ["Utilidad", resumen.totalVentas - resumen.totalGastos]
  ]);
  const wsDetalle = XLSX.utils.json_to_sheet(resumen.detalle);
  XLSX.utils.book_append_sheet(wb, wsResumen, "Resumen");
  XLSX.utils.book_append_sheet(wb, wsDetalle, "Detalle");
  XLSX.writeFile(wb, "informe.xlsx");
});

// 🔸 Gráfico
function renderChart(data) {
  if (chart) chart.destroy();
  const labels = Object.keys(data);
  const values = Object.values(data);

  chart = new Chart(chartCanvas, {
    type: 'bar',
    data: {
      labels: labels,
      datasets: [{
        label: 'Cantidad',
        data: values,
        backgroundColor: 'rgba(54, 162, 235, 0.5)'
      }]
    },
    options: {
      responsive: true,
      scales: {
        y: { beginAtZero: true }
      }
    }
  });
}

// 🔸 Cargar filtros dinámicos
async function cargarFiltros() {
  const snap = await getDocs(collection(db, "ventas"));
  const productos = new Set();
  const categorias = new Set();

  snap.forEach(doc => {
    (doc.data().productos || []).forEach(p => {
      productos.add(p.nombre);
      categorias.add(p.categoria || "Sin categoría");
    });
  });

  filtroProducto.innerHTML = '<option value="">Todos</option>';
  filtroCategoria.innerHTML = '<option value="">Todas</option>';
  [...productos].sort().forEach(p => {
    filtroProducto.innerHTML += `<option value="${p}">${p}</option>`;
  });
  [...categorias].sort().forEach(c => {
    filtroCategoria.innerHTML += `<option value="${c}">${c}</option>`;
  });
}

cargarFiltros();
