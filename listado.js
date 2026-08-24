const firebaseConfig = {
  apiKey: "AIzaSyD7DLEhlAKufj003MMlo1tkBe8k0xrkTyA",
  authDomain: "cofradia-app-28829.firebaseapp.com",
  projectId: "cofradia-app-28829"
};

firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();
const auth = firebase.auth();

window.volver = function () {
  window.location.href = "index.html";
};

const ADMIN_EMAIL_LISTADO = "macisenior@gmail.com";
let todasLasPersonas = [];
let usuarioListadoAutorizado = false;
let versionSesionListado = 0;

function actualizarAccesoListado(mensaje, autorizado = false) {
  usuarioListadoAutorizado = autorizado;
  const estado = document.getElementById("listadoEstado");
  const controles = document.getElementById("listadoControls");

  if (!autorizado) todasLasPersonas = [];
  if (estado) estado.textContent = mensaje;
  if (controles) controles.style.display = autorizado ? "" : "none";
}

auth.onAuthStateChanged(async user => {
  const versionLectura = ++versionSesionListado;

  if (!user) {
    actualizarAccesoListado("🔒 Inicia sesión desde la página principal para acceder.");
    return;
  }

  if (user.email?.toLowerCase() !== ADMIN_EMAIL_LISTADO) {
    actualizarAccesoListado("⛔ Esta cuenta no está autorizada.");
    return;
  }

  todasLasPersonas = [];
  actualizarAccesoListado("Cargando datos...", true);

  try {
    const snapshot = await db.collection("personas").get();
    const sesionActual = auth.currentUser;
    if (
      versionLectura !== versionSesionListado ||
      !sesionActual ||
      sesionActual.uid !== user.uid ||
      sesionActual.email?.toLowerCase() !== ADMIN_EMAIL_LISTADO
    ) {
      return;
    }

    todasLasPersonas = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    })).filter(persona => persona.eliminado !== true);
    actualizarAccesoListado("✅ Datos cargados.", true);
  } catch (error) {
    if (
      versionLectura !== versionSesionListado ||
      auth.currentUser?.uid !== user.uid ||
      auth.currentUser?.email?.toLowerCase() !== ADMIN_EMAIL_LISTADO
    ) {
      return;
    }

    console.error(error);

    if (error?.code === "permission-denied") {
      actualizarAccesoListado("⛔ No tienes permiso para leer los datos.");
    } else {
      actualizarAccesoListado("No se pudieron cargar los datos.");
    }
  }
}, error => {
  versionSesionListado++;
  console.error(error);
  actualizarAccesoListado("No se pudo comprobar la sesión.");
});

// 🔥 FUNCIÓN PRINCIPAL
window.generarPDFListado = function () {
  if (!usuarioListadoAutorizado) {
    actualizarAccesoListado("⛔ Acceso restringido a la cuenta administradora.");
    return;
  }

  const orden = document.getElementById("ordenListado").value;

  let lista = [...todasLasPersonas];

  // 👉 AGRUPADO POR CALLE
  if (orden === "calle") {
    abrirPDF(lista, "calle");
    return;
  }

  // 🔀 ORDEN NORMAL
  lista.sort((a, b) => {

    if (orden === "nombre") {
      return (a.nombreCompleto || "").localeCompare(b.nombreCompleto || "", "es");
    }

    if (orden === "poblacion") {
      return (a.poblacion || "").localeCompare(b.poblacion || "", "es");
    }

    if (orden === "edad") {
      return (calcularEdad(a.fechaNacimiento) || 0) -
             (calcularEdad(b.fechaNacimiento) || 0);
    }

    return 0;
  });

  abrirPDF(lista, orden);
};

// 🔥 EDAD
function calcularEdad(fecha) {
  if (!fecha) return 0;

  const nacimiento = new Date(fecha);
  if (isNaN(nacimiento)) return 0;

  const hoy = new Date();
  let edad = hoy.getFullYear() - nacimiento.getFullYear();
  const mes = hoy.getMonth() - nacimiento.getMonth();

  if (mes < 0 || (mes === 0 && hoy.getDate() < nacimiento.getDate())) {
    edad--;
  }

  return edad;
}

// 🔥 FORMATEAR FECHA
function formatearFecha(fecha) {

  if (!fecha) return "";

  if (fecha.seconds) {
    return new Date(fecha.seconds * 1000).toLocaleDateString();
  }

  if (typeof fecha === "string") {
    const f = new Date(fecha);
    if (!isNaN(f)) return f.toLocaleDateString();

    const partes = fecha.split("/");
    if (partes.length === 3) {
      return `${partes[0]}/${partes[1]}/${partes[2]}`;
    }
  }

  return "";
}

// 🔥 PDF FINAL (CLAVE)
function abrirPDF(lista, orden) {

  const { jsPDF } = window.jspdf;
  const doc = new jsPDF();

  doc.setFontSize(16);
  doc.text("COFRADÍA SAN CRISTOBAL", 10, 15);

  doc.setFontSize(12);
  doc.text("Listado de Personas", 10, 22);

  let filas = [];

  // 👉 AGRUPADO POR CALLE
  if (orden === "calle") {

    const grupos = {};

    lista.forEach(p => {
      const calle = p.direccionCompleta || "SIN DIRECCIÓN";
      if (!grupos[calle]) grupos[calle] = [];
      grupos[calle].push(p);
    });

    Object.keys(grupos).sort().forEach(calle => {      

      grupos[calle].forEach(p => {
        filas.push([
          p.nombreCompleto || "",
          p.direccionCompleta || "",
          p.poblacion || "",
          formatearFecha(p.fechaNacimiento)
        ]);
      });

    });

  } else {

    // 👉 LISTADO NORMAL
    filas = lista.map(p => [
      p.nombreCompleto || "",
      p.direccionCompleta || "",
      p.poblacion || "",
      formatearFecha(p.fechaNacimiento)
    ]);
  }

  doc.autoTable({
    head: [["Nombre", "Dirección", "Población", "Nacimiento"]],
    body: filas,
    startY: 30,
    styles: { fontSize: 8 }
  });

  doc.save("listado.pdf");
}

document.getElementById("btnGenerarListado")?.addEventListener("click", generarPDFListado);
document.getElementById("btnVolverListado")?.addEventListener("click", volver);