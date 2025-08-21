import { obtenerVentasEntreFechas, obtenerGastosEntreFechas, obtenerPagosEntreFechas } from "./firebase-config.js";

// 🎨 Utilidades para formateo y cálculos
class InformeUtils {
  static formatearFecha(fechaISO) {
    if (!fechaISO) return "Fecha inválida";
    const [a, m, d] = fechaISO.split("-");
    return `${d}/${m}/${a}`;
  }

  static formatearMoneda(valor) {
    return new Intl.NumberFormat("es-CO", {
      style: "currency",
      currency: "COP",
      minimumFractionDigits: 0,
    }).format(valor || 0);
  }

  static normalizarFechaRegistro(fechaRaw) {
    if (typeof fechaRaw === "string") {
      return new Date(fechaRaw);
    } else if (fechaRaw?.seconds) {
      return new Date(fechaRaw.seconds * 1000);
    }
    return new Date(fechaRaw);
  }

  static obtenerTotalesDeVenta(venta) {
    let totalVenta = 0;
    let efectivo = 0,
      nequi = 0,
      tarjeta = 0;

    // Calcular total de productos si no existe
    const totalProductos =
      venta.productos?.reduce((acc, p) => acc + (p.precio || p.subtotal || 0) * (p.cantidad || 1), 0) || 0;

    if (typeof venta.metodoPago === "string") {
      totalVenta = venta.total || totalProductos;
      switch (venta.metodoPago.toLowerCase()) {
        case "efectivo":
          efectivo = totalVenta;
          break;
        case "nequi":
          nequi = totalVenta;
          break;
        case "tarjeta":
          tarjeta = totalVenta;
          break;
        default:
          efectivo = totalVenta; // Por defecto efectivo
      }
    } else if (typeof venta.metodoPago === "object" && venta.metodoPago) {
      efectivo = venta.metodoPago.efectivo || 0;
      nequi = venta.metodoPago.nequi || 0;
      tarjeta = venta.metodoPago.tarjeta || 0;
      totalVenta = efectivo + nequi + tarjeta;
    } else {
      totalVenta = totalProductos;
      efectivo = totalVenta; // Por defecto efectivo
    }

    return { totalVenta, efectivo, nequi, tarjeta };
  }
}

// 📊 Clase para manejar los datos del informe
class ProcesadorInforme {
  constructor() {
    this.porDia = {};
    this.porCategoria = {};
    this.productosVendidos = {};
    this.resumenGeneral = {
      totalVentas: 0,
      totalEfectivo: 0,
      totalNequi: 0,
      totalTarjeta: 0,
      totalGastos: 0,
      totalPagos: 0,
      totalUtilidad: 0,
    };
  }

  procesarVentas(ventas) {
    ventas.forEach((venta) => {
      try {
        const fechaVenta = InformeUtils.normalizarFechaRegistro(venta.fecha);

        // Ajuste para ventas después de medianoche (hasta las 3 AM cuenta como día anterior)
        if (fechaVenta.getHours() < 3) {
          fechaVenta.setDate(fechaVenta.getDate() - 1);
        }

        const fechaFormateada = InformeUtils.formatearFecha(fechaVenta.toISOString().split("T")[0]);

        // Inicializar datos del día si no existen
        if (!this.porDia[fechaFormateada]) {
          this.porDia[fechaFormateada] = {
            ventas: 0,
            efectivo: 0,
            nequi: 0,
            tarjeta: 0,
            gastos: 0,
            pagos: 0,
            cantidadVentas: 0,
          };
        }

        const { totalVenta, efectivo, nequi, tarjeta } = InformeUtils.obtenerTotalesDeVenta(venta);

        // Actualizar totales del día
        this.porDia[fechaFormateada].ventas += totalVenta;
        this.porDia[fechaFormateada].efectivo += efectivo;
        this.porDia[fechaFormateada].nequi += nequi;
        this.porDia[fechaFormateada].tarjeta += tarjeta;
        this.porDia[fechaFormateada].cantidadVentas += 1;

        // Procesar productos de la venta
        if (Array.isArray(venta.productos)) {
          this.procesarProductosVenta(venta.productos, fechaFormateada);
        }
      } catch (error) {
        console.error("Error procesando venta:", error, venta);
      }
    });
  }

  procesarProductosVenta(productos, fecha) {
    productos.forEach((producto) => {
      try {
        // Procesar por categoría
        const categoria = producto.nombreCategoria || "Sin categoría";
        const precio = producto.precio || producto.subtotal || 0;
        const cantidad = producto.cantidad || 1;
        const subtotal = precio * cantidad;

        this.porCategoria[categoria] = (this.porCategoria[categoria] || 0) + subtotal;

        // Procesar productos vendidos por día
        if (!this.productosVendidos[fecha]) {
          this.productosVendidos[fecha] = {};
        }

        const nombreProducto = producto.nombre || "Sin nombre";
        if (!this.productosVendidos[fecha][nombreProducto]) {
          this.productosVendidos[fecha][nombreProducto] = { cantidad: 0, subtotal: 0 };
        }

        this.productosVendidos[fecha][nombreProducto].cantidad += cantidad;
        this.productosVendidos[fecha][nombreProducto].subtotal += subtotal;
      } catch (error) {
        console.error("Error procesando producto:", error, producto);
      }
    });
  }

  procesarGastos(gastos) {
    gastos.forEach((gasto) => {
      try {
        const fechaObj = InformeUtils.normalizarFechaRegistro(gasto.fecha);
        const fecha = InformeUtils.formatearFecha(fechaObj.toISOString().split("T")[0]);

        if (!this.porDia[fecha]) {
          this.porDia[fecha] = {
            ventas: 0,
            efectivo: 0,
            nequi: 0,
            tarjeta: 0,
            gastos: 0,
            pagos: 0,
            cantidadVentas: 0,
          };
        }

        this.porDia[fecha].gastos += gasto.valor || 0;
      } catch (error) {
        console.error("Error procesando gasto:", error, gasto);
      }
    });
  }

  procesarPagos(pagos) {
    pagos.forEach((pago) => {
      try {
        const fechaObj = InformeUtils.normalizarFechaRegistro(pago.fecha);
        const fecha = InformeUtils.formatearFecha(fechaObj.toISOString().split("T")[0]);

        if (!this.porDia[fecha]) {
          this.porDia[fecha] = {
            ventas: 0,
            efectivo: 0,
            nequi: 0,
            tarjeta: 0,
            gastos: 0,
            pagos: 0,
            cantidadVentas: 0,
          };
        }

        this.porDia[fecha].pagos += pago.valor || 0;
      } catch (error) {
        console.error("Error procesando pago:", error, pago);
      }
    });
  }

  calcularResumen() {
    Object.values(this.porDia).forEach((dia) => {
      this.resumenGeneral.totalVentas += dia.ventas;
      this.resumenGeneral.totalEfectivo += dia.efectivo;
      this.resumenGeneral.totalNequi += dia.nequi;
      this.resumenGeneral.totalTarjeta += dia.tarjeta;
      this.resumenGeneral.totalGastos += dia.gastos;
      this.resumenGeneral.totalPagos += dia.pagos;
    });

    this.resumenGeneral.totalUtilidad =
      this.resumenGeneral.totalVentas - this.resumenGeneral.totalGastos - this.resumenGeneral.totalPagos;
  }

  obtenerFechasOrdenadas() {
    return Object.keys(this.porDia).sort((a, b) => {
      const [d1, m1, a1] = a.split("/").map(Number);
      const [d2, m2, a2] = b.split("/").map(Number);
      return new Date(a1, m1 - 1, d1) - new Date(a2, m2 - 1, d2);
    });
  }
}

// 🎨 Generador de HTML para los informes
class GeneradorHTML {
  static crearResumenGeneral(resumen) {
    return `
      <div class="resumen-destacado">
        <h3>📊 Resumen General del Período</h3>
        <div class="grid-resumen">
          <div class="tarjeta-resumen ventas">
            <h4>💰 Ventas Totales</h4>
            <span class="valor-grande">${InformeUtils.formatearMoneda(resumen.totalVentas)}</span>
          </div>
          <div class="tarjeta-resumen gastos">
            <h4>💸 Gastos Totales</h4>
            <span class="valor-grande">${InformeUtils.formatearMoneda(resumen.totalGastos)}</span>
          </div>
          <div class="tarjeta-resumen utilidad">
            <h4>📈 Utilidad Neta</h4>
            <span class="valor-grande ${resumen.totalUtilidad >= 0 ? "positivo" : "negativo"}">
              ${InformeUtils.formatearMoneda(resumen.totalUtilidad)}
            </span>
          </div>
        </div>
        <div class="metodos-pago">
          <div class="metodo"><span class="icono">💵</span>Efectivo: ${InformeUtils.formatearMoneda(
            resumen.totalEfectivo
          )}</div>
          <div class="metodo"><span class="icono">📱</span>Nequi: ${InformeUtils.formatearMoneda(resumen.totalNequi)}</div>
          <div class="metodo"><span class="icono">💳</span>Tarjeta: ${InformeUtils.formatearMoneda(
            resumen.totalTarjeta
          )}</div>
        </div>
      </div>
    `;
  }

  static crearTablaDiaria(porDia, fechasOrdenadas) {
    let html = `
      <div class="seccion-informe">
        <h3>📅 Resumen por Día</h3>
        <div class="tabla-wrapper">
          <table class="tabla-informe">
            <thead>
              <tr>
                <th>Fecha</th>
                <th>Ventas</th>
                <th>Efectivo</th>
                <th>Nequi</th>
                <th>Tarjeta</th>
                <th>Gastos</th>
                <th>Pagos</th>
                <th>Utilidad</th>
                <th># Ventas</th>
              </tr>
            </thead>
            <tbody>
    `;

    fechasOrdenadas.forEach((fecha) => {
      const dia = porDia[fecha];
      const utilidad = dia.ventas - dia.gastos - dia.pagos;
      const promedioVenta = dia.cantidadVentas > 0 ? dia.ventas / dia.cantidadVentas : 0;

      html += `
        <tr>
          <td class="fecha">${fecha}</td>
          <td class="monto">${InformeUtils.formatearMoneda(dia.ventas)}</td>
          <td class="monto efectivo">${InformeUtils.formatearMoneda(dia.efectivo)}</td>
          <td class="monto nequi">${InformeUtils.formatearMoneda(dia.nequi)}</td>
          <td class="monto tarjeta">${InformeUtils.formatearMoneda(dia.tarjeta)}</td>
          <td class="monto gastos">${InformeUtils.formatearMoneda(dia.gastos)}</td>
          <td class="monto pagos">${InformeUtils.formatearMoneda(dia.pagos)}</td>
          <td class="monto utilidad ${utilidad >= 0 ? "positivo" : "negativo"}">
            ${InformeUtils.formatearMoneda(utilidad)}
          </td>
          <td class="cantidad" title="Promedio por venta: ${InformeUtils.formatearMoneda(promedioVenta)}">
            ${dia.cantidadVentas}
          </td>
        </tr>
      `;
    });

    html += `</tbody></table></div></div>`;
    return html;
  }

  static crearTablaCategorias(porCategoria) {
    const categoriasSorted = Object.entries(porCategoria).sort(([, a], [, b]) => b - a);

    let html = `
      <div class="seccion-informe">
        <h3>🏷️ Ventas por Categoría</h3>
        <div class="tabla-wrapper">
          <table class="tabla-informe tabla-categorias">
            <thead>
              <tr>
                <th>Categoría</th>
                <th>Total Vendido</th>
                <th>% del Total</th>
              </tr>
            </thead>
            <tbody>
    `;

    const totalCategorias = Object.values(porCategoria).reduce((a, b) => a + b, 0);

    categoriasSorted.forEach(([categoria, total]) => {
      const porcentaje = totalCategorias > 0 ? ((total / totalCategorias) * 100).toFixed(1) : 0;
      html += `
        <tr>
          <td class="categoria">${categoria}</td>
          <td class="monto">${InformeUtils.formatearMoneda(total)}</td>
          <td class="porcentaje">
            <div class="barra-progreso">
              <div class="progreso" style="width: ${porcentaje}%"></div>
              <span class="texto-progreso">${porcentaje}%</span>
            </div>
          </td>
        </tr>
      `;
    });

    html += `</tbody></table></div></div>`;
    return html;
  }

  static crearTablaProductos(productosVendidos, fechasOrdenadas) {
    let html = `
      <div class="seccion-informe">
        <h3>🛍️ Productos Vendidos por Día</h3>
    `;

    fechasOrdenadas.forEach((fecha) => {
      const productos = productosVendidos[fecha];
      if (!productos || Object.keys(productos).length === 0) return;

      const productosOrdenados = Object.entries(productos).sort(([, a], [, b]) => b.subtotal - a.subtotal);

      html += `
        <div class="dia-productos">
          <h4 class="fecha-productos">📅 ${fecha}</h4>
          <div class="tabla-wrapper">
            <table class="tabla-informe tabla-productos">
              <thead>
                <tr>
                  <th>Producto</th>
                  <th>Cantidad</th>
                  <th>Total</th>
                  <th>Promedio</th>
                </tr>
              </thead>
              <tbody>
      `;

      productosOrdenados.forEach(([nombre, datos]) => {
        const promedio = datos.cantidad > 0 ? datos.subtotal / datos.cantidad : 0;
        html += `
          <tr>
            <td class="producto">${nombre}</td>
            <td class="cantidad">${datos.cantidad}</td>
            <td class="monto">${InformeUtils.formatearMoneda(datos.subtotal)}</td>
            <td class="monto promedio">${InformeUtils.formatearMoneda(promedio)}</td>
          </tr>
        `;
      });

      html += `</tbody></table></div></div>`;
    });

    html += `</div>`;
    return html;
  }
}

// 🚀 Controlador principal
class ControladorInforme {
  constructor() {
    this.procesador = new ProcesadorInforme();
    this.isLoading = false;
  }

  mostrarLoading(mostrar) {
    const container = document.getElementById("detalleInforme");
    if (mostrar) {
      container.innerHTML = `
        <div class="loading-container">
          <div class="spinner"></div>
          <p>Generando informe...</p>
        </div>
      `;
    }
  }

  mostrarError(mensaje) {
    const container = document.getElementById("detalleInforme");
    container.innerHTML = `
      <div class="error-container">
        <h3>❌ Error al generar informe</h3>
        <p>${mensaje}</p>
        <button onclick="location.reload()" class="btn-retry">Intentar de nuevo</button>
      </div>
    `;
  }

  validarFechas(fechaInicio, fechaFin) {
    if (!fechaInicio || !fechaFin) {
      throw new Error("Selecciona un rango de fechas válido");
    }

    const inicio = new Date(fechaInicio);
    const fin = new Date(fechaFin);

    if (inicio > fin) {
      throw new Error("La fecha de inicio debe ser anterior a la fecha final");
    }

    const diferenciaDias = (fin - inicio) / (1000 * 60 * 60 * 24);
    if (diferenciaDias > 365) {
      throw new Error("El rango de fechas no puede ser mayor a 1 año");
    }
  }

  async generarInforme(fechaInicio, fechaFin) {
    if (this.isLoading) return;

    try {
      this.isLoading = true;
      this.validarFechas(fechaInicio, fechaFin);
      this.mostrarLoading(true);

      // Reinicializar procesador
      this.procesador = new ProcesadorInforme();

      // Obtener datos en paralelo
      const [ventas, gastos, pagos] = await Promise.all([
        obtenerVentasEntreFechas(fechaInicio, fechaFin),
        obtenerGastosEntreFechas(fechaInicio, fechaFin),
        obtenerPagosEntreFechas(fechaInicio, fechaFin),
      ]);

      console.log(`📊 Datos obtenidos: ${ventas.length} ventas, ${gastos.length} gastos, ${pagos.length} pagos`);

      // Procesar datos
      this.procesador.procesarVentas(ventas);
      this.procesador.procesarGastos(gastos);
      this.procesador.procesarPagos(pagos);
      this.procesador.calcularResumen();

      // Generar HTML
      this.renderizarInforme();
    } catch (error) {
      console.error("Error generando informe:", error);
      this.mostrarError(error.message);
    } finally {
      this.isLoading = false;
    }
  }

  renderizarInforme() {
    const fechasOrdenadas = this.procesador.obtenerFechasOrdenadas();

    const html = `
      <div id="contenidoInforme" class="contenido-informe">
        ${GeneradorHTML.crearResumenGeneral(this.procesador.resumenGeneral)}
        ${GeneradorHTML.crearTablaDiaria(this.procesador.porDia, fechasOrdenadas)}
        ${GeneradorHTML.crearTablaCategorias(this.procesador.porCategoria)}
        ${GeneradorHTML.crearTablaProductos(this.procesador.productosVendidos, fechasOrdenadas)}
        
        <div class="acciones-informe">
          <button id="btnExportarPDF" class="btn-exportar">📄 Exportar a PDF</button>
          <button id="btnImprimir" class="btn-imprimir">🖨️ Imprimir</button>
        </div>
      </div>
    `;

    document.getElementById("detalleInforme").innerHTML = html;
    this.configurarBotones();
  }

  configurarBotones() {
    // Botón exportar PDF
    document.getElementById("btnExportarPDF")?.addEventListener("click", async () => {
      try {
        const elemento = document.getElementById("contenidoInforme");
        const doc = new jsPDF("p", "pt", "a4");

        const canvas = await html2canvas(elemento, {
          scale: 0.8,
          useCORS: true,
          backgroundColor: "#ffffff",
        });

        const imgData = canvas.toDataURL("image/png");
        const imgProps = doc.getImageProperties(imgData);
        const pdfWidth = doc.internal.pageSize.getWidth();
        const pdfHeight = (imgProps.height * pdfWidth) / imgProps.width;

        doc.addImage(imgData, "PNG", 0, 0, pdfWidth, pdfHeight);

        const fechaActual = new Date().toLocaleDateString("es-CO").replace(/\//g, "-");
        doc.save(`informe-general-${fechaActual}.pdf`);
      } catch (error) {
        alert("Error al exportar PDF: " + error.message);
      }
    });

    // Botón imprimir
    document.getElementById("btnImprimir")?.addEventListener("click", () => {
      window.print();
    });
  }
}

// 🎯 Inicialización
document.addEventListener("DOMContentLoaded", () => {
  const controlador = new ControladorInforme();
  const form = document.getElementById("formInforme");

  // Establecer fechas por defecto (último mes)
  const hoy = new Date();
  const hace30Dias = new Date();
  hace30Dias.setDate(hoy.getDate() - 30);

  document.getElementById("fechaFin").value = hoy.toISOString().split("T")[0];
  document.getElementById("fechaInicio").value = hace30Dias.toISOString().split("T")[0];

  form.addEventListener("submit", async (e) => {
    e.preventDefault();

    const fechaInicio = document.getElementById("fechaInicio").value;
    const fechaFin = document.getElementById("fechaFin").value;

    await controlador.generarInforme(fechaInicio, fechaFin);
  });
});

export { InformeUtils, ProcesadorInforme, GeneradorHTML, ControladorInforme };
