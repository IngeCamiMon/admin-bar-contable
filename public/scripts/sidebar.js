// sidebar.js
import { auth } from "./firebase-config.js";
import { signOut } from "https://www.gstatic.com/firebasejs/10.4.0/firebase-auth.js";

export function cargarSidebar(rol) {
  const sidebarHTML = `
    <div class="sidebar">
      <h2id id="nombar">🍺 LA WAPPA</h2id>
      <a href="dashboard.html">Inicio</a>
      <div id="sidebarLinks"></div>
      <span id="logout">Cerrar sesión</span>
      <p style="text-align:center; font-size: 13px; color: hsla(185, 82.50%, 79.80%, 0.96); margin-top: 30px; font-family: 'Segoe UI', Tahoma, sans-serif; opacity: 0; animation: fadeIn 1.5s ease forwards;">© 2025 CamiloMontano</p>

<style>
@keyframes fadeIn {
  to {
    opacity: 1;
  }
}
</style>

    </div>
  `;

  const estilo = `
    <style>
      .sidebar {
        width: 220px;
        background-color:rgb(17, 247, 231);
        color: white;
        padding-top: 20px;
        position: fixed;
        height: 100%;
      }
      .sidebar h2 {
        text-align: center;
        margin-bottom: 30px;
        font-size: 20px;
      }
      .sidebar a,
      #logout {
        display: block;
        padding: 15px 20px;
        text-decoration: none;
        color: #ecf0f1;
        font-weight: 500;
        transition: background 0.2s ease;
        cursor: pointer;
      }
      .sidebar a:hover,
      #logout:hover {
        background-color:rgb(17, 206, 240);
      }
    </style>
  `;

  document.body.insertAdjacentHTML("afterbegin", estilo + sidebarHTML);

  // Agregar links según rol
  const sidebarLinks = document.getElementById("sidebarLinks");
  const modulosPorRol = {
    admin: [
      { nombre: "Facturación", link: "facturacion.html" },
      { nombre: "Inventario", link: "inventario.html" },
      { nombre: "Ventas", link: "ventas.html" },
      { nombre: "Gastos", link: "gastos.html" },
      { nombre: "Pagos", link: "pagos.html" },
      { nombre: "Caja / Cierre", link: "caja.html" },
      { nombre: "Informes", link: "informes.html" },
      { nombre: "Usuarios", link: "registro.html" },
      { nombre: "Categorías", link: "categorias.html" },
    ],
    cajero: [
      { nombre: "Facturación", link: "facturacion.html" },
      { nombre: "Ventas", link: "ventas.html" },
      { nombre: "Caja / Cierre", link: "caja.html" },
      { nombre: "Categorías", link: "categorias.html" },
    ],
    mesero: [{ nombre: "Ventas", link: "ventas.html" }],
  };

  const modulos = modulosPorRol[rol] || [];
  modulos.forEach((mod) => {
    const link = document.createElement("a");
    link.href = mod.link;
    link.textContent = mod.nombre;
    sidebarLinks.appendChild(link);
  });

  // Manejo del logout
  const logoutBtn = document.getElementById("logout");
  if (logoutBtn) {
    logoutBtn.addEventListener("click", async () => {
      try {
        await signOut(auth);
        location.href = "login.html";
      } catch (error) {
        console.error("Error al cerrar sesión:", error);
        alert("Error al cerrar sesión. Intenta de nuevo.");
      }
    });
  }
}
