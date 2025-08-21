import {
  obtenerVentasEntreFechas,
  obtenerProductos,
  obtenerCategorias
} from "./firebase-config.js";

// 🕐 Utilidades para manejo de horarios del bar
class HorarioBarUtils {
  // El día del bar inicia a las 11:00 AM y termina a las 3:00 AM del día siguiente
  static HORA_INICIO_DIA = 11; // 11 AM
  static HORA_FIN_DIA = 3; // 3 AM del día siguiente

  /**
   * Convierte una fecha/hora real al día operativo del bar
   * @param {Date} fechaHora - Fecha y hora real
   * @returns {Date} - Fecha del día operativo del bar
   */
  static obtenerDiaOperativo(fechaHora) {
    const fecha = new Date(fechaHora);
    const hora = fecha.getHours();
    
    // Si son entre las 12:00 AM y las 3:00 AM, pertenece al día anterior
    if (hora >= 0 && hora < this.HORA_FIN_DIA) {
      fecha.setDate(fecha.getDate() - 1);
    }
    
    return new Date(fecha.getFullYear(), fecha.getMonth(), fecha.getDate());
  }

  /**
   * Obtiene el rango de fechas reales para un día operativo del bar
   * @param {string} diaOperativo - Fecha en formato YYYY-MM-DD
   * @returns {Object} - {inicio, fin} con las fechas reales
   */
  static obtenerRangoFechasReales(diaOperativo) {
    const fecha = new Date(diaOperativo + "T00:00:00");
    
    // Inicio: 11:00 AM del día operativo
    const inicio = new Date(fecha);
    inicio.setHours(this.HORA_INICIO_DIA, 0, 0, 0);
    
    // Fin: 3:00 AM del día siguiente
    const fin = new Date(fecha);
    fin.setDate(fin.getDate() + 1);
    fin.setHours(this.HORA_FIN_DIA, 0, 0, 0);
    
    return { inicio, fin };
  }

  /**
   * Formatea la hora para mostrar con indicador AM/PM
   * @param {Date} fecha 
   * @returns {string}
   */
  static formatearHora(fecha) {
    return fecha.toLocaleTimeString('es-CO', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: true
    });
  }

  /**
   * Formatea la fecha para mostrar
   * @param {Date} fecha 
   * @returns {string}
   */
  static formatearFecha(fecha) {
    return fecha.toLocaleDateString('es-CO', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  }

  /**
   * Formatea moneda colombiana
   * @param {number} valor 
   * @returns {string}
   */
  static formatearMoneda(valor) {
    return new Intl.NumberFormat('es-CO', {
      style: 'currency',
      currency: 'COP',
      minimumFractionDigits: 0
    }).format(valor || 0);
  }
}

// 📊 Procesador de datos de ventas
class ProcesadorDetalleVentas {
  constructor() {
    this.ventasPorDia = new Map();
    this.productos = new Map();
    this.categorias = new Map();
    this.estadisticasGenerales = {
      totalVentas: 0,
      totalIngresos: 0,
      promedioVenta: 0,
      ventaMasAlta: 0,
      ventaMasBaja: Infinity
    };
  }

  async inicializar() {
    try {
      const [productos, categorias] = await Promise.all([
        obtenerProductos(),
        obtenerCategorias()
      ]);

      // Crear mapas para búsqueda rápida
      productos.forEach(p => this.productos.set(p.id, p));
      categorias.forEach(c => this.categorias.set(c.id, c));
    } catch (error) {
      console.error('Error inicializando procesador:', error);
    }
  }

  procesarVentas(ventas) {
    this.ventasPorDia.clear();
    this.estadisticasGenerales = {
      totalVentas: 0,
      totalIngresos: 0,
      promedioVenta: 0,
      ventaMasAlta: 0,
      ventaMasBaja: Infinity
    };

    ventas.forEach(venta => {
      try {
        const fechaVenta = this.normalizarFecha(venta.fecha);
        const diaOperativo = HorarioBarUtils.obtenerDiaOperativo(fechaVenta);
        const claveDir = diaOperativo.toISOString().split('T')[0];

        if (!this.ventasPorDia.has(claveDir)) {
          this.ventasPorDia.set(claveDir, {
            fecha: diaOperativo,
            ventas: [],
            resumen: {
              totalVentas: 0,
              totalIngresos: 0,
              efectivo: 0,
              nequi: 0,
              tarjeta: 0,
              cantidadProductos: 0
            }
          });
        }

        const ventaProcesada = this.procesarVentaIndividual(venta, fechaVenta);
        const diaData = this.ventasPorDia.get(claveDir);
        
        diaData.ventas.push(ventaProcesada);
        this.actualizarResumenDia(diaData, ventaProcesada);
        this.actualizarEstadisticasGenerales(ventaProcesada);

      } catch (error) {
        console.error('Error procesando venta:', error, venta);
      }
    });

    this.calcularEstadisticasFinales();
  }

  normalizarFecha(fechaRaw) {
    if (typeof fechaRaw === "string") {
      return new Date(fechaRaw + "T00:00:00");
    } else if (fechaRaw?.seconds) {
      return new Date(fechaRaw.seconds * 1000);
    } else if (fechaRaw?.toDate) {
      return fechaRaw.toDate();
    }
    return new Date(fechaRaw);
  }

  procesarVentaIndividual(venta, fechaVenta) {
    const total = this.calcularTotalVenta(venta);
    const metodosPago = this.procesarMetodosPago(venta, total);
    
    return {
      id: venta.id,
      hora: HorarioBarUtils.formatearHora(fechaVenta),
      fecha: fechaVenta,
      productos: this.procesarProductosVenta(venta.productos || []),
      metodoPago: metodosPago,
      total: total,
      estado: venta.estado || 'pagada',
      observaciones: venta.observaciones || '',
      cantidadProductos: (venta.productos || []).reduce((acc, p) => acc + (p.cantidad || 1), 0)
    };
  }

  calcularTotalVenta(venta) {
    if (venta.total && venta.total > 0) {
      return venta.total;
    }
    
    return (venta.productos || []).reduce((acc, producto) => {
      const precio = producto.precio || producto.subtotal || 0;
      const cantidad = producto.cantidad || 1;
      return acc + (precio * cantidad);
    }, 0);
  }

  procesarMetodosPago(venta, total) {
    let efectivo = 0, nequi = 0, tarjeta = 0;

    if (typeof venta.metodoPago === 'string') {
      switch (venta.metodoPago.toLowerCase()) {
        case 'efectivo': efectivo = total; break;
        case 'nequi': nequi = total; break;
        case 'tarjeta': tarjeta = total; break;
        default: efectivo = total;
      }
    } else if (typeof venta.metodoPago === 'object' && venta.metodoPago) {
      efectivo = venta.metodoPago.efectivo || 0;
      nequi = venta.metodoPago.nequi || 0;
      tarjeta = venta.metodoPago.tarjeta || 0;
    } else {
      efectivo = total;
    }

    return { efectivo, nequi, tarjeta, tipo: this.determinarTipoPago(efectivo, nequi, tarjeta) };
  }

  determinarTipoPago(efectivo, nequi, tarjeta) {
    const metodos = [];
    if (efectivo > 0) metodos.push('Efectivo');
    if (nequi > 0) metodos.push('Nequi');
    if (tarjeta > 0) metodos.push('Tarjeta');
    
    return metodos.length > 1 ? 'Mixto' : (metodos[0] || 'Efectivo');
  }

  procesarProductosVenta(productos) {
    return productos.map(producto => {
      const productoInfo = this.productos.get(producto.productoId) || {};
      const categoriaInfo = this.categorias.get(producto.categoriaId) || {};
      
      return {
        id: producto.productoId || '',
        nombre: producto.nombre || productoInfo.nombre || 'Producto desconocido',
        categoria: categoriaInfo.nombre || producto.nombreCategoria || 'Sin categoría',
        cantidad: producto.cantidad || 1,
        precio: producto.precio || producto.subtotal || 0,
        subtotal: (producto.precio || producto.subtotal || 0) * (producto.cantidad || 1)
      };
    });
  }

  actualizarResumenDia(diaData, venta) {
    diaData.resumen.totalVentas += 1;
    diaData.resumen.totalIngresos += venta.total;
    diaData.resumen.efectivo += venta.metodoPago.efectivo;
    diaData.resumen.nequi += venta.metodoPago.nequi;
    diaData.resumen.tarjeta += venta.metodoPago.tarjeta;
    diaData.resumen.cantidadProductos += venta.cantidadProductos;
  }

  actualizarEstadisticasGenerales(venta) {
    this.estadisticasGenerales.totalVentas += 1;
    this.estadisticasGenerales.totalIngresos += venta.total;
    this.estadisticasGenerales.ventaMasAlta = Math.max(this.estadisticasGenerales.ventaMasAlta, venta.total);
    this.estadisticasGenerales.ventaMasBaja = Math.min(this.estadisticasGenerales.ventaMasBaja, venta.total);
  }

  calcularEstadisticasFinales() {
    if (this.estadisticasGenerales.totalVentas > 0) {
      this.estadisticasGenerales.promedioVenta = this.estadisticasGenerales.totalIngresos / this.estadisticasGenerales.totalVentas;
    }
    
    if (this.estadisticasGenerales.ventaMasBaja === Infinity) {
      this.estadisticasGenerales.ventaMasBaja = 0;
    }
  }

  obtenerDiasOrdenados() {
    return Array.from(this.ventasPorDia.entries())
      .sort(([a], [b]) => new Date(b) - new Date(a)) // Más reciente primero
      .map(([fecha, data]) => ({ fecha, ...data }));
  }
}

// 🎨 Generador de HTML para detalle de ventas
class GeneradorHTMLDetalle {
  static crearResumenGeneral(estadisticas) {
    return `
      <div class="resumen-detalle">
        <h3>📊 Estadísticas Generales</h3>
        <div class="grid-estadisticas">
          <div class="stat-card">
            <div class="stat-icono">🛒</div>
            <div class="stat-info">
              <span class="stat-valor">${estadisticas.totalVentas}</span>
              <span class="stat-label">Ventas Totales</span>
            </div>
          </div>
          <div class="stat-card">
            <div class="stat-icono">💰</div>
            <div class="stat-info">
              <span class="stat-valor">${HorarioBarUtils.formatearMoneda(estadisticas.totalIngresos)}</span>
              <span class="stat-label">Ingresos Totales</span>
            </div>
          </div>
          <div class="stat-card">
            <div class="stat-icono">📈</div>
            <div class="stat-info">
              <span class="stat-valor">${HorarioBarUtils.formatearMoneda(estadisticas.promedioVenta)}</span>
              <span class="stat-label">Promedio por Venta</span>
            </div>
          </div>
          <div class="stat-card">
            <div class="stat-icono">⭐</div>
            <div class="stat-info">
              <span class="stat-valor">${HorarioBarUtils.formatearMoneda(estadisticas.ventaMasAlta)}</span>
              <span class="stat-label">Venta Más Alta</span>
            </div>
          </div>
        </div>
      </div>
    `;
  }

  static crearVentasPorDia(diasData) {
    let html = '<div class="ventas-por-dia">';
    
    diasData.forEach(dia => {
      html += this.crearSeccionDia(dia);
    });
    
    html += '</div>';
    return html;
  }

  static crearSeccionDia(dia) {
    const rangoHorario = HorarioBarUtils.obtenerRangoFechasReales(dia.fecha.toISOString().split('T')[0]);
    
    return `
      <div class="seccion-dia" data-fecha="${dia.fecha.toISOString().split('T')[0]}">
        <div class="header-dia">
          <div class="info-dia">
            <h3 class="fecha-dia">📅 ${HorarioBarUtils.formatearFecha(dia.fecha)}</h3>
            <p class="horario-operativo">
              🕐 Horario: ${HorarioBarUtils.formatearHora(rangoHorario.inicio)} - ${HorarioBarUtils.formatearHora(rangoHorario.fin)}
            </p>
          </div>
          <div class="resumen-dia">
            <div class="resumen-item">
              <span class="resumen-valor">${dia.resumen.totalVentas}</span>
              <span class="resumen-label">Ventas</span>
            </div>
            <div class="resumen-item">
              <span class="resumen-valor">${HorarioBarUtils.formatearMoneda(dia.resumen.totalIngresos)}</span>
              <span class="resumen-label">Total</span>
            </div>
            <div class="resumen-item">
              <span class="resumen-valor">${dia.resumen.cantidadProductos}</span>
              <span class="resumen-label">Productos</span>
            </div>
          </div>
          <button class="btn-toggle-dia" onclick="toggleDiaVentas(this)">
            <span class="toggle-text">Ver ventas</span>
            <span class="toggle-icon">▼</span>
          </button>
        </div>
        
        <div class="metodos-pago-dia">
          <div class="metodo-pago-item efectivo">
            <span class="metodo-icono">💵</span>
            <span class="metodo-valor">${HorarioBarUtils.formatearMoneda(dia.resumen.efectivo)}</span>
          </div>
          <div class="metodo-pago-item nequi">
            <span class="metodo-icono">📱</span>
            <span class="metodo-valor">${HorarioBarUtils.formatearMoneda(dia.resumen.nequi)}</span>
          </div>
          <div class="metodo-pago-item tarjeta">
            <span class="metodo-icono">💳</span>
            <span class="metodo-valor">${HorarioBarUtils.formatearMoneda(dia.resumen.tarjeta)}</span>
          </div>
        </div>

        <div class="ventas-lista" style="display: none;">
          ${this.crearListaVentas(dia.ventas)}
        </div>
      </div>
    `;
  }

  static crearListaVentas(ventas) {
    let html = '<div class="tabla-wrapper"><table class="tabla-ventas"><thead><tr>';
    html += '<th>Hora</th><th>Productos</th><th>Método Pago</th><th>Total</th><th>Acciones</th>';
    html += '</tr></thead><tbody>';

    ventas.forEach(venta => {
      html += `
        <tr class="fila-venta" data-venta-id="${venta.id}">
          <td class="venta-hora">${venta.hora}</td>
          <td class="venta-productos">
            <div class="productos-resumen">
              <span class="productos-count">${venta.cantidadProductos} productos</span>
              <div class="productos-detalle">
                ${venta.productos.map(p => 
                  `<div class="producto-item">
                    <span class="producto-nombre">${p.nombre}</span>
                    <span class="producto-cantidad">x${p.cantidad}</span>
                    <span class="producto-precio">${HorarioBarUtils.formatearMoneda(p.subtotal)}</span>
                  </div>`
                ).join('')}
              </div>
            </div>
          </td>
          <td class="venta-metodo">
            <span class="metodo-badge metodo-${venta.metodoPago.tipo.toLowerCase()}">${venta.metodoPago.tipo}</span>
            ${this.crearDetalleMetodoPago(venta.metodoPago)}
          </td>
          <td class="venta-total">
            <span class="total-valor">${HorarioBarUtils.formatearMoneda(venta.total)}</span>
          </td>
          <td class="venta-acciones">
            <button class="btn-detalle" onclick="verDetalleVenta('${venta.id}')" title="Ver detalle completo">
              👁️
            </button>
            <button class="btn-reimprimir" onclick="reimprimirVenta('${venta.id}')" title="Reimprimir ticket">
              🖨️
            </button>
          </td>
        </tr>
      `;
    });

    html += '</tbody></table></div>';
    return html;
  }

  static crearDetalleMetodoPago(metodoPago) {
    if (metodoPago.tipo === 'Mixto') {
      let detalle = '<div class="metodo-mixto">';
      if (metodoPago.efectivo > 0) detalle += `<span>Efectivo: ${HorarioBarUtils.formatearMoneda(metodoPago.efectivo)}</span>`;
      if (metodoPago.nequi > 0) detalle += `<span>Nequi: ${HorarioBarUtils.formatearMoneda(metodoPago.nequi)}</span>`;
      if (metodoPago.tarjeta > 0) detalle += `<span>Tarjeta: ${HorarioBarUtils.formatearMoneda(metodoPago.tarjeta)}</span>`;
      detalle += '</div>';
      return detalle;
    }
    return '';
  }
}

// 🎮 Controlador principal
class ControladorDetalleVentas {
  constructor() {
    this.procesador = new ProcesadorDetalleVentas();
    this.isLoading = false;
    this.filtroActual = 'todos';
    this.ordenActual = 'reciente';
  }

  async inicializar() {
    await this.procesador.inicializar();
    this.configurarEventos();
    this.establecerFechasPorDefecto();
  }

  configurarEventos() {
    const form = document.getElementById("formDetalleVentas");
    form?.addEventListener("submit", (e) => this.manejarSubmit(e));

    // Filtros y ordenamiento
    document.getElementById("filtroMetodo")?.addEventListener("change", (e) => this.aplicarFiltros());
    document.getElementById("ordenVentas")?.addEventListener("change", (e) => this.aplicarOrden());

    // Búsqueda en tiempo real
    document.getElementById("busquedaVentas")?.addEventListener("input", (e) => this.buscarVentas(e.target.value));
  }

  establecerFechasPorDefecto() {
    const hoy = new Date();
    const hace7Dias = new Date();
    hace7Dias.setDate(hoy.getDate() - 7);

    document.getElementById("fechaInicio").value = hace7Dias.toISOString().split("T")[0];
    document.getElementById("fechaFin").value = hoy.toISOString().split("T")[0];
  }

  async manejarSubmit(e) {
    e.preventDefault();
    
    if (this.isLoading) return;

    const fechaInicio = document.getElementById("fechaInicio").value;
    const fechaFin = document.getElementById("fechaFin").value;

    if (!this.validarFechas(fechaInicio, fechaFin)) return;

    await this.cargarDetalleVentas(fechaInicio, fechaFin);
  }

  validarFechas(fechaInicio, fechaFin) {
    if (!fechaInicio || !fechaFin) {
      this.mostrarError("Selecciona un rango de fechas válido");
      return false;
    }

    const inicio = new Date(fechaInicio);
    const fin = new Date(fechaFin);
    
    if (inicio > fin) {
      this.mostrarError("La fecha de inicio debe ser anterior a la fecha final");
      return false;
    }

    const diferenciaDias = (fin - inicio) / (1000 * 60 * 60 * 24);
    if (diferenciaDias > 90) {
      this.mostrarError("El rango de fechas no puede ser mayor a 90 días");
      return false;
    }

    return true;
  }

  async cargarDetalleVentas(fechaInicio, fechaFin) {
    try {
      this.isLoading = true;
      this.mostrarLoading(true);

      // Ajustar fechas para incluir horarios del bar
      const inicioAjustado = new Date(fechaInicio + "T11:00:00");
      const finAjustado = new Date(fechaFin + "T23:59:59");
      finAjustado.setDate(finAjustado.getDate() + 1);
      finAjustado.setHours(3, 0, 0, 0);

      const ventas = await obtenerVentasEntreFechas(
        inicioAjustado.toISOString().split("T")[0],
        finAjustado.toISOString().split("T")[0]
      );

      console.log(`📊 Obtenidas ${ventas.length} ventas para el período`);

      this.procesador.procesarVentas(ventas);
      this.renderizarDetalle();

    } catch (error) {
      console.error("Error cargando detalle de ventas:", error);
      this.mostrarError("Error al cargar las ventas: " + error.message);
    } finally {
      this.isLoading = false;
    }
  }

  renderizarDetalle() {
    const diasData = this.procesador.obtenerDiasOrdenados();
    
    const html = `
      <div id="contenidoDetalle" class="contenido-detalle">
        ${GeneradorHTMLDetalle.crearResumenGeneral(this.procesador.estadisticasGenerales)}
        
        <div class="controles-detalle">
          <div class="filtros-avanzados">
            <select id="filtroMetodo" class="filtro-select">
              <option value="todos">Todos los métodos</option>
              <option value="efectivo">Solo Efectivo</option>
              <option value="nequi">Solo Nequi</option>
              <option value="tarjeta">Solo Tarjeta</option>
              <option value="mixto">Pagos Mixtos</option>
            </select>
            
            <select id="ordenVentas" class="filtro-select">
              <option value="reciente">Más reciente</option>
              <option value="antiguo">Más antiguo</option>
              <option value="mayor">Mayor valor</option>
              <option value="menor">Menor valor</option>
            </select>
            
            <input type="text" id="busquedaVentas" placeholder="Buscar productos..." class="input-busqueda">
          </div>
          
          <div class="acciones-detalle">
            <button id="btnExportarDetalle" class="btn-accion">📊 Exportar Excel</button>
            <button id="btnImprimirDetalle" class="btn-accion">🖨️ Imprimir</button>
          </div>
        </div>

        ${GeneradorHTMLDetalle.crearVentasPorDia(diasData)}
      </div>
    `;

    document.getElementById("contenidoDetalleVentas").innerHTML = html;
    this.configurarBotonesDetalle();
  }

  configurarBotonesDetalle() {
    document.getElementById("btnExportarDetalle")?.addEventListener("click", () => this.exportarExcel());
    document.getElementById("btnImprimirDetalle")?.addEventListener("click", () => window.print());
  }

  mostrarLoading(mostrar) {
    const container = document.getElementById("contenidoDetalleVentas");
    if (mostrar) {
      container.innerHTML = `
        <div class="loading-container">
          <div class="spinner"></div>
          <p>Cargando detalle de ventas...</p>
          <small>Esto puede tomar unos segundos</small>
        </div>
      `;
    }
  }

  mostrarError(mensaje) {
    const container = document.getElementById("contenidoDetalleVentas");
    container.innerHTML = `
      <div class="error-container">
        <h3>❌ Error</h3>
        <p>${mensaje}</p>
        <button onclick="location.reload()" class="btn-retry">Intentar de nuevo</button>
      </div>
    `;
  }

  exportarExcel() {
    // Implementar exportación a Excel
    console.log("Exportar a Excel - Funcionalidad pendiente");
    alert("Funcionalidad de exportación a Excel próximamente");
  }
}

// 🌍 Funciones globales para interactividad
window.toggleDiaVentas = function(button) {
  const seccionDia = button.closest('.seccion-dia');
  const ventasLista = seccionDia.querySelector('.ventas-lista');
  const toggleIcon = button.querySelector('.toggle-icon');
  const toggleText = button.querySelector('.toggle-text');
  
  if (ventasLista.style.display === 'none' || !ventasLista.style.display) {
    ventasLista.style.display = 'block';
    toggleIcon.textContent = '▲';
    toggleText.textContent = 'Ocultar ventas';
    seccionDia.classList.add('expandida');
  } else {
    ventasLista.style.display = 'none';
    toggleIcon.textContent = '▼';
    toggleText.textContent = 'Ver ventas';
    seccionDia.classList.remove('expandida');
  }
};

window.verDetalleVenta = function(ventaId) {
  console.log("Ver detalle de venta:", ventaId);
  // Implementar modal o navegación al detalle
  alert(`Ver detalle de venta ${ventaId} - Funcionalidad pendiente`);
};

window.reimprimirVenta = function(ventaId) {
  console.log("Reimprimir venta:", ventaId);
  // Implementar reimpresión
  alert(`Reimprimir venta ${ventaId} - Funcionalidad pendiente`);
};

// 🚀 Inicialización
document.addEventListener("DOMContentLoaded", async () => {
  const controlador = new ControladorDetalleVentas();
  await controlador.inicializar();
});

export { HorarioBarUtils, ProcesadorDetalleVentas, GeneradorHTMLDetalle, ControladorDetalleVentas };