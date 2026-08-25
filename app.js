
// ===============================
// 🚀 CONFIG + INICIO
// ===============================

console.log("APP PRO INICIADA");
let usuarioActual = null;
let todasLasPersonas = [];
let personaEditandoId = null;
let unsubscribePersonas = null;
let filtroActual = "";
let fichasOcultas = true;
let versionSesion = 0;
const añoActual = String(new Date().getFullYear());
let papeleraCargando = false;
let papeleraVistaSolicitada = false;
const operacionesPapelera = new Set();
const ADMIN_EMAIL = "macisenior@gmail.com";

const firebaseConfig = {
  apiKey: "AIzaSyD7DLEhlAKufj003MMlo1tkBe8k0xrkTyA",
  authDomain: "cofradia-app-28829.firebaseapp.com",
  projectId: "cofradia-app-28829",
  storageBucket: "cofradia-app-28829.firebasestorage.app",
  messagingSenderId: "650302836714",
  appId: "1:650302836714:web:66c9ceeaf6de536d3dec93"
};

// Initialize Firebase
firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();
const auth = firebase.auth();
function usuarioLogueado() {
  return usuarioActual?.email?.toLowerCase() === ADMIN_EMAIL;
}

function crearTestigoSesion() {
  return { version: versionSesion, uid: usuarioActual?.uid || null };
}

function sesionSigueAutorizada(testigo) {
  return Boolean(
    testigo &&
    testigo.version === versionSesion &&
    testigo.uid &&
    usuarioActual?.uid === testigo.uid &&
    auth.currentUser?.uid === testigo.uid &&
    usuarioLogueado()
  );
}

function invalidarOperacionesDeSesion() {
  versionSesion++;
}

function actualizarEstadoAcceso(mensaje) {
  const estado = document.getElementById("authStatus");
  if (estado) estado.textContent = mensaje;
}

function mostrarControlesAdministrativos(mostrar) {
  const controles = document.getElementById("adminControls");
  const btnLogin = document.getElementById("btnLogin");
  const btnLogout = document.getElementById("btnLogout");

  if (controles) controles.style.display = mostrar ? "" : "none";
  if (btnLogin) btnLogin.style.display = mostrar ? "none" : "";
  if (btnLogout) btnLogout.style.display = usuarioActual ? "" : "none";
}

function limpiarDatosPersonas() {
  if (unsubscribePersonas) {
    unsubscribePersonas();
    unsubscribePersonas = null;
  }

  todasLasPersonas = [];
  filtroActual = "";
  fichasOcultas = true;
  personaEditandoId = null;

  const lista = document.getElementById("lista");
  const resumen = document.getElementById("resumen");
  const buscador = document.getElementById("buscador");
  const modal = document.getElementById("modalForm");

  if (lista) lista.replaceChildren();
  if (resumen) resumen.replaceChildren();
  if (buscador) buscador.value = "";
  if (modal) modal.classList.add("hidden");
  if (typeof window.cerrarPapelera === "function") window.cerrarPapelera(true);
  if (typeof limpiarEstadosAdministrativos === "function") limpiarEstadosAdministrativos();
}

function exigirAdministrador() {
  if (usuarioLogueado()) return true;

  actualizarEstadoAcceso("⛔ Acceso restringido a la cuenta administradora.");
  mostrarControlesAdministrativos(false);
  limpiarDatosPersonas();
  return false;
}

function mensajeErrorAuth(error) {
  if (error?.code === "auth/popup-closed-by-user" ||
      error?.code === "auth/cancelled-popup-request") {
    return "Inicio de sesión cancelado.";
  }

  if (error?.code === "auth/unauthorized-domain") {
    return "Este dominio no está autorizado para iniciar sesión.";
  }

  return "No se pudo iniciar sesión. Inténtalo de nuevo.";
}
function manejarErrorFirestore(error, mensaje) {
  console.error(error);

  if (error?.code === "permission-denied") {
    limpiarDatosPersonas();
    mostrarControlesAdministrativos(false);
    actualizarEstadoAcceso("⛔ La sesión no tiene permisos para acceder a los datos.");
    return;
  }

  mostrarToast(mensaje);
}

// ===============================
// 🔐 AUTH
// ===============================

window.login = async function () {
  const provider = new firebase.auth.GoogleAuthProvider();
  provider.setCustomParameters({ prompt: "select_account" });
  actualizarEstadoAcceso("Comprobando la cuenta...");

  try {
    await auth.signInWithPopup(provider);
  } catch (error) {
    console.error(error);
    limpiarDatosPersonas();
    mostrarControlesAdministrativos(false);
    actualizarEstadoAcceso(mensajeErrorAuth(error));
  }
};

window.logout = async function () {
  actualizarEstadoAcceso("Cerrando sesión...");
  invalidarOperacionesDeSesion();
  limpiarDatosPersonas();
  mostrarControlesAdministrativos(false);

  try {
    await auth.signOut();
    usuarioActual = null;
    limpiarDatosPersonas();
    mostrarControlesAdministrativos(false);
    actualizarEstadoAcceso("🔒 Sesión cerrada. Inicia sesión para acceder.");
  } catch (error) {
    console.error(error);
    actualizarEstadoAcceso("No se pudo cerrar la sesión. Inténtalo de nuevo.");
  }
};

// ===============================
// ⚡ TIEMPO REAL
// ===============================

function escucharPersonas() {
  if (!exigirAdministrador()) return;
  const testigo = crearTestigoSesion();

  if (unsubscribePersonas) {
    unsubscribePersonas();
    unsubscribePersonas = null;
  }

  unsubscribePersonas = db.collection("personas")
    .orderBy("nombreCompleto")
    .onSnapshot(snapshot => {
      if (!sesionSigueAutorizada(testigo)) return;
      todasLasPersonas = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })).filter(persona => persona.eliminado !== true);

      if (filtroActual && filtroActual.trim() !== "") {
        buscar(filtroActual);
      } else if (fichasOcultas) {
        ocultarFichas();
      } else {
        render(todasLasPersonas);
      }
    }, error => {
      if (!sesionSigueAutorizada(testigo)) return;
      console.error(error);
      limpiarDatosPersonas();
      mostrarControlesAdministrativos(false);

      if (error?.code === "permission-denied") {
        actualizarEstadoAcceso("⛔ No tienes permiso para leer los datos.");
      } else {
        actualizarEstadoAcceso("No se pudieron cargar los datos. Inténtalo de nuevo.");
      }
    });
}

// ===============================
// 🎨 RENDER
// ===============================

function crearDato(texto) {
  const dato = document.createElement("div");
  dato.className = "dato";
  dato.textContent = texto;
  return dato;
}

function actualizarVistaFichasOcultas() {
  const lista = document.getElementById("lista");
  const estado = document.getElementById("estadoFichas");
  if (lista) lista.hidden = fichasOcultas;
  if (estado) estado.hidden = !fichasOcultas;
}

function mostrarFichas() {
  fichasOcultas = false;
  actualizarVistaFichasOcultas();
}

function ocultarFichas(boton = document.getElementById("btnOcultarFichas")) {
  fichasOcultas = true;
  filtroActual = "";

  const buscador = document.getElementById("buscador");
  const limpiar = document.getElementById("btnLimpiarBusqueda");
  if (buscador) buscador.value = "";
  if (limpiar) limpiar.classList.remove("visible");

  activarFiltro(boton);
  actualizarResumen(todasLasPersonas);
  actualizarVistaFichasOcultas();
}
function render(personas) {
  const contenedor = document.getElementById("lista");
  contenedor.replaceChildren();

  personas.forEach(p => {
    const añoActual = new Date().getFullYear().toString();
    const card = document.createElement("div");
    card.className = "card " + (p.activo ? "activo" : "inactivo");

    const top = document.createElement("div");
    top.className = "top";

    const nombre = document.createElement("span");
    nombre.className = "nombre";
    nombre.textContent = p.nombreCompleto || "";
    top.appendChild(nombre);

    card.append(
      top,
      crearDato(p.direccionCompleta || ""),
      crearDato((p.poblacion || "") + " (" + (p.codigoPostal || "") + ")"),
      crearDato("Provincia: " + (p.provincia || "-")),
      crearDato("Nacimiento: " + (p.fechaNacimiento || "-")),
      crearDato("Estado: " + (p.activo ? "🟢 Activo" : "🔴 Inactivo"))
    );

    const pago = document.createElement("div");
    pago.className = "dato";
    pago.append(document.createTextNode("Pago " + añoActual + ": "));

    const estadoPago = document.createElement("span");
    estadoPago.className = p.pagos?.[añoActual] ? "pago-ok" : "pago-pendiente";
    estadoPago.textContent = p.pagos?.[añoActual] ? "💳 Pagado" : "❌ Pendiente";
    pago.appendChild(estadoPago);
    card.appendChild(pago);

    if (usuarioLogueado()) {
      const btnEditar = crearBtn("✏️ Editar", () => editarPersona(p.id));
      card.appendChild(btnEditar);

      const acciones = document.createElement("div");

      const btnEstado = crearBtn("Cambiar estado", () =>
        toggleActivo(p.id, p.activo)
      );
      btnEstado.className = "btn-estado";

      const btnPago = crearBtn("Marcar pago", () =>
        togglePago(p.id, p.pagos?.[añoActual])
      );
      btnPago.className = "btn-pago";

      const btnEliminar = crearBtn("Eliminar", () =>
        eliminarPersona(p.id)
      );
      btnEliminar.className = "btn-eliminar";

      acciones.append(btnEstado, btnPago, btnEliminar);
      card.appendChild(acciones);
    } else {
      const aviso = document.createElement("div");
      aviso.textContent = "🔒 Inicia sesión para editar";
      aviso.className = "aviso-login";
      card.appendChild(aviso);
    }

    contenedor.appendChild(card);
  });

  actualizarResumen(personas);
}

function crearBtn(texto, fn) {
  const b = document.createElement("button");
  b.textContent = texto;
  b.addEventListener("click", fn);
  return b;
}

function verPendientes(btn) {
  mostrarFichas();
  activarFiltro(btn);

  const filtradas = todasLasPersonas.filter(p => !p.pagos?.[añoActual]);
  render(filtradas);
}

function verPagados(btn) {
  mostrarFichas();
  activarFiltro(btn);

  const filtradas = todasLasPersonas.filter(p => p.pagos?.[añoActual]);
  render(filtradas);
}

function verTodos(btn) {
  mostrarFichas();
  activarFiltro(btn);

  render(todasLasPersonas);
}
function prepararBotonGuardar(esEdicion = false) {
  const btn = document.getElementById("btnGuardar");
  if (!btn) return;

  btn.disabled = false;
  btn.textContent = esEdicion ? "💾 Guardar cambios" : "💾 Guardar";
  btn.style.background = esEdicion ? "#f39c12" : "";
}

function abrirFormulario(esEdicion = false) {
  if (!exigirAdministrador()) return;
  const modal = document.getElementById("modalForm");

  if (!esEdicion) {
    personaEditandoId = null;
  }

  // mostrar modal
  modal.classList.remove("hidden");

  // limpiar formulario
  limpiarFormulario();

  if (!esEdicion) {
    // valores por defecto para una persona nueva
    document.getElementById("poblacion").value = "GALLUR";
    document.getElementById("provincia").value = "ZARAGOZA";
    document.getElementById("cp").value = "50650";
  }

  prepararBotonGuardar(esEdicion);

  // foco automático
  document.getElementById("nombre").focus();
}

function cerrarFormulario() {
  document.getElementById("modalForm").classList.add("hidden");
  personaEditandoId = null;
  limpiarFormulario();
  prepararBotonGuardar(false);
}
async function guardarPersona() {
  if (!exigirAdministrador()) return;

  const btn = document.getElementById("btnGuardar");
  btn.disabled = true;
  btn.textContent = "Guardando...";

  const nombre = document.getElementById("nombre").value.trim();
  const apellido1 = document.getElementById("apellido1").value.trim();
  const apellido2 = document.getElementById("apellido2").value.trim();

  if (!nombre || !apellido1) {
    alert("Nombre y apellido obligatorios");
    prepararBotonGuardar(Boolean(personaEditandoId));
    return;
  }

  const apellidos = [apellido1, apellido2].filter(Boolean).join(" ");
  const datosEditables = {
    nombre,
    apellidos,
    nombreCompleto: apellidos + ", " + nombre,
    direccionCompleta: document.getElementById("direccion").value.trim(),
    poblacion: document.getElementById("poblacion").value.trim() || "GALLUR",
    provincia: document.getElementById("provincia").value.trim() || "ZARAGOZA",
    codigoPostal: document.getElementById("cp").value.trim() || "50650",
    fechaNacimiento: document.getElementById("fecha").value.trim()
  };

  try {
    if (personaEditandoId) {
      await db.collection("personas").doc(personaEditandoId).update(datosEditables);
      mostrarToast("✏️ Persona actualizada");
    } else {
      const personaNueva = {
        ...datosEditables,
        activo: true,
        pagos: {}
      };

      await db.collection("personas").add(personaNueva);
      mostrarToast("✅ Persona creada");
    }

    cerrarFormulario();

  } catch (err) {
    manejarErrorFirestore(err, "❌ Error al guardar");
  } finally {
    prepararBotonGuardar(Boolean(personaEditandoId));
  }
}
function limpiarFormulario() {
  document.getElementById("nombre").value = "";
  document.getElementById("apellido1").value = "";
  document.getElementById("apellido2").value = "";
  document.getElementById("direccion").value = "";
  document.getElementById("poblacion").value = "";
  document.getElementById("provincia").value = "";
  document.getElementById("cp").value = "";
  document.getElementById("fecha").value = "";
}
function mostrarToast(texto) {
  const toast = document.getElementById("toast");

  toast.textContent = texto;
  toast.classList.remove("hidden");

  setTimeout(() => {
    toast.classList.add("hidden");
  }, 2000);
}

async function editarPersona(id) {
  if (!exigirAdministrador()) return;
  const testigo = crearTestigoSesion();
  try {
    const doc = await db.collection("personas").doc(id).get();
    if (!sesionSigueAutorizada(testigo)) return;
    if (!doc.exists) {
      throw new Error("La persona ya no existe");
    }

    const p = doc.data();
    const apellidosGuardados = String(p.apellidos || p.nombreCompleto?.split(",")[0] || "").trim();
    const partesApellidos = apellidosGuardados.split(/\s+/).filter(Boolean);
    const apellido1 = partesApellidos.shift() || "";
    const apellido2 = partesApellidos.join(" ");

    personaEditandoId = id;

    abrirFormulario(true);

    document.getElementById("nombre").value = p.nombre || "";
    document.getElementById("apellido1").value = apellido1;
    document.getElementById("apellido2").value = apellido2;
    document.getElementById("direccion").value = p.direccionCompleta || "";
    document.getElementById("poblacion").value = p.poblacion || "";
    document.getElementById("provincia").value = p.provincia || "";
    document.getElementById("cp").value = p.codigoPostal || "";
    document.getElementById("fecha").value = p.fechaNacimiento || "";
  } catch (err) {
    personaEditandoId = null;
    prepararBotonGuardar(false);
    manejarErrorFirestore(err, "❌ Error al cargar la persona");
  }
}
function verActivos(btn) {
  mostrarFichas();
  activarFiltro(btn);

  const filtradas = todasLasPersonas.filter(p => p.activo);
  render(filtradas);
}
function activarFiltro(boton) {
  document.querySelectorAll(".btn-filtro").forEach(btn => {
    btn.classList.remove("activo");
  });

  boton?.classList.add("activo");
}
const BACKUP_FORMATO = "cofradia-firestore-backup";
const BACKUP_VERSION = 1;
const BACKUP_COLECCION = "personas";
const BACKUP_MAX_BYTES = 20 * 1024 * 1024;
const BACKUP_MAX_DOCUMENTOS = 20000;
const BACKUP_MAX_PROFUNDIDAD = 50;
const RESTAURACION_TAMANO_LOTE = 400;
let restauracionPendiente = null;
let restauracionEnCurso = false;
let backupParcialEnCurso = false;
let documentosBackupParcial = new Map();
let idsSeleccionBackupParcial = new Set();

function limpiarEstadosAdministrativos() {
  restauracionPendiente = null;
  documentosBackupParcial = new Map();
  idsSeleccionBackupParcial = new Set();
  papeleraVistaSolicitada = false;
  papeleraCargando = false;
  backupParcialEnCurso = false;
  operacionesPapelera.clear();

  const selectorParcial = document.getElementById("selectorBackupParcial");
  const listaParcial = document.getElementById("listaBackupParcial");
  const vistaRestauracion = document.getElementById("vistaPreviaRestauracion");
  const resumenRestauracion = document.getElementById("resumenVistaPrevia");
  const archivoRestauracion = document.getElementById("backupFile");
  const ejecutarRestauracion = document.getElementById("btnEjecutarRestauracion");
  const listaPapelera = document.getElementById("listaPapelera");

  if (selectorParcial) selectorParcial.hidden = true;
  if (listaParcial) listaParcial.replaceChildren();
  if (vistaRestauracion) vistaRestauracion.hidden = true;
  if (resumenRestauracion) resumenRestauracion.replaceChildren();
  if (archivoRestauracion) archivoRestauracion.value = "";
  if (ejecutarRestauracion) ejecutarRestauracion.disabled = true;
  if (listaPapelera) listaPapelera.replaceChildren();

  establecerEstadoBackupParcial("");
  establecerEstadoRestauracion("");
  establecerEstadoPapelera("");
  cambiarVistaPapelera(false);
}

function esObjetoPlano(valor) {
  if (!valor || typeof valor !== "object") return false;
  const prototipo = Object.getPrototypeOf(valor);
  return prototipo === Object.prototype || prototipo === null;
}

function tieneClavesExactas(objeto, esperadas) {
  if (!esObjetoPlano(objeto)) return false;
  const actuales = Object.keys(objeto).sort();
  const requeridas = [...esperadas].sort();
  return actuales.length === requeridas.length &&
    actuales.every((clave, indice) => clave === requeridas[indice]);
}

function esInstanciaFirestore(valor, constructor) {
  return typeof constructor === "function" && valor instanceof constructor;
}

function serializarValorFirestore(valor, profundidad = 0) {
  if (profundidad > BACKUP_MAX_PROFUNDIDAD) {
    throw new Error("Se superó la profundidad máxima permitida en los datos.");
  }

  if (valor === null || typeof valor === "string" || typeof valor === "boolean") {
    return valor;
  }

  if (typeof valor === "number") {
    if (Number.isFinite(valor)) return valor;
    return {
      __firestoreType: "number",
      value: Number.isNaN(valor) ? "NaN" : valor > 0 ? "Infinity" : "-Infinity"
    };
  }

  const firestore = firebase.firestore;
  if (esInstanciaFirestore(valor, firestore.Timestamp)) {
    return {
      __firestoreType: "timestamp",
      seconds: valor.seconds,
      nanoseconds: valor.nanoseconds
    };
  }

  if (esInstanciaFirestore(valor, firestore.GeoPoint)) {
    return {
      __firestoreType: "geopoint",
      latitude: valor.latitude,
      longitude: valor.longitude
    };
  }

  if (esInstanciaFirestore(valor, firestore.DocumentReference)) {
    return { __firestoreType: "reference", path: valor.path };
  }

  if (esInstanciaFirestore(valor, firestore.Blob)) {
    return { __firestoreType: "bytes", base64: valor.toBase64() };
  }

  if (valor instanceof Date) {
    return { __firestoreType: "date", iso: valor.toISOString() };
  }

  if (Array.isArray(valor)) {
    return {
      __firestoreType: "array",
      items: valor.map(item => serializarValorFirestore(item, profundidad + 1))
    };
  }

  if (esObjetoPlano(valor)) {
    return {
      __firestoreType: "map",
      entries: Object.entries(valor).map(([key, item]) => ({
        key,
        value: serializarValorFirestore(item, profundidad + 1)
      }))
    };
  }

  throw new Error("El backup contiene un tipo Firestore no compatible.");
}

function crearBackupDesdeDocumentos(documentos, fechaCreacion = new Date()) {
  const lista = documentos.map(documento => ({
    id: documento.id,
    data: serializarValorFirestore(documento.data)
  }));

  return {
    format: BACKUP_FORMATO,
    version: BACKUP_VERSION,
    createdAt: fechaCreacion.toISOString(),
    source: { projectId: firebaseConfig.projectId },
    collection: BACKUP_COLECCION,
    documentCount: lista.length,
    documents: lista
  };
}

function documentosDesdeSnapshot(snapshot) {
  return snapshot.docs.map(doc => ({ id: doc.id, data: doc.data() }));
}

function validarIdDocumento(id, indice) {
  if (typeof id !== "string" || !id || id === "." || id === ".." || id.includes("/")) {
    throw new Error("ID de documento no válido en la posición " + indice + ".");
  }
  if (/^__.*__$/.test(id) || new TextEncoder().encode(id).length > 1500) {
    throw new Error("ID de documento no permitido en la posición " + indice + ".");
  }
}

function validarRutaReferencia(path) {
  if (typeof path !== "string" || !path || path.length > 6144 || path.includes("//")) return false;
  const segmentos = path.split("/");
  return segmentos.length % 2 === 0 && segmentos.every(Boolean);
}

function validarNodoSerializado(nodo, ruta = "data", profundidad = 0) {
  if (profundidad > BACKUP_MAX_PROFUNDIDAD) {
    throw new Error("Profundidad excesiva en " + ruta + ".");
  }

  if (nodo === null || typeof nodo === "string" || typeof nodo === "boolean") return;
  if (typeof nodo === "number") {
    if (!Number.isFinite(nodo)) throw new Error("Número JSON no válido en " + ruta + ".");
    return;
  }
  if (!esObjetoPlano(nodo)) throw new Error("Estructura no válida en " + ruta + ".");

  const tipo = nodo.__firestoreType;
  if (typeof tipo !== "string") throw new Error("Falta el tipo serializado en " + ruta + ".");

  if (tipo === "timestamp") {
    if (!tieneClavesExactas(nodo, ["__firestoreType", "seconds", "nanoseconds"]) ||
        !Number.isSafeInteger(nodo.seconds) || !Number.isInteger(nodo.nanoseconds) ||
        nodo.nanoseconds < 0 || nodo.nanoseconds >= 1000000000) {
      throw new Error("Timestamp no válido en " + ruta + ".");
    }
    return;
  }

  if (tipo === "geopoint") {
    if (!tieneClavesExactas(nodo, ["__firestoreType", "latitude", "longitude"]) ||
        !Number.isFinite(nodo.latitude) || !Number.isFinite(nodo.longitude) ||
        nodo.latitude < -90 || nodo.latitude > 90 ||
        nodo.longitude < -180 || nodo.longitude > 180) {
      throw new Error("GeoPoint no válido en " + ruta + ".");
    }
    return;
  }

  if (tipo === "reference") {
    if (!tieneClavesExactas(nodo, ["__firestoreType", "path"]) || !validarRutaReferencia(nodo.path)) {
      throw new Error("Referencia no válida en " + ruta + ".");
    }
    return;
  }

  if (tipo === "bytes") {
    if (!tieneClavesExactas(nodo, ["__firestoreType", "base64"]) ||
        typeof nodo.base64 !== "string" ||
        !/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(nodo.base64)) {
      throw new Error("Bytes no válidos en " + ruta + ".");
    }
    return;
  }

  if (tipo === "date") {
    if (!tieneClavesExactas(nodo, ["__firestoreType", "iso"]) ||
        typeof nodo.iso !== "string" || !Number.isFinite(Date.parse(nodo.iso))) {
      throw new Error("Fecha no válida en " + ruta + ".");
    }
    return;
  }

  if (tipo === "number") {
    if (!tieneClavesExactas(nodo, ["__firestoreType", "value"]) ||
        !["NaN", "Infinity", "-Infinity"].includes(nodo.value)) {
      throw new Error("Número especial no válido en " + ruta + ".");
    }
    return;
  }

  if (tipo === "array") {
    if (!tieneClavesExactas(nodo, ["__firestoreType", "items"]) || !Array.isArray(nodo.items)) {
      throw new Error("Array no válido en " + ruta + ".");
    }
    nodo.items.forEach((item, indice) => validarNodoSerializado(item, ruta + "[" + indice + "]", profundidad + 1));
    return;
  }

  if (tipo === "map") {
    if (!tieneClavesExactas(nodo, ["__firestoreType", "entries"]) || !Array.isArray(nodo.entries)) {
      throw new Error("Mapa no válido en " + ruta + ".");
    }
    const claves = new Set();
    nodo.entries.forEach((entrada, indice) => {
      if (!tieneClavesExactas(entrada, ["key", "value"]) ||
          typeof entrada.key !== "string" || !entrada.key ||
          entrada.key.length > 1500 ||
          claves.has(entrada.key)) {
        throw new Error("Campo no válido o repetido en " + ruta + ", entrada " + indice + ".");
      }
      claves.add(entrada.key);
      validarNodoSerializado(entrada.value, ruta + "." + entrada.key, profundidad + 1);
    });
    return;
  }

  throw new Error("Tipo serializado desconocido '" + tipo + "' en " + ruta + ".");
}

function convertirValorBackupAntiguo(valor, ruta = "data", profundidad = 0) {
  if (profundidad > BACKUP_MAX_PROFUNDIDAD) throw new Error("Profundidad excesiva en " + ruta + ".");
  if (valor === null || typeof valor === "string" || typeof valor === "boolean") return valor;
  if (typeof valor === "number") {
    if (!Number.isFinite(valor)) throw new Error("Número no válido en " + ruta + ".");
    return valor;
  }
  if (Array.isArray(valor)) {
    return { __firestoreType: "array", items: valor.map((item, i) => convertirValorBackupAntiguo(item, ruta + "[" + i + "]", profundidad + 1)) };
  }
  if (!esObjetoPlano(valor)) throw new Error("Estructura antigua no válida en " + ruta + ".");

  const claves = Object.keys(valor);
  const esTimestamp = claves.length === 2 &&
    ((claves.includes("seconds") && claves.includes("nanoseconds")) ||
     (claves.includes("_seconds") && claves.includes("_nanoseconds")));
  if (esTimestamp) {
    const seconds = valor.seconds ?? valor._seconds;
    const nanoseconds = valor.nanoseconds ?? valor._nanoseconds;
    const timestamp = { __firestoreType: "timestamp", seconds, nanoseconds };
    validarNodoSerializado(timestamp, ruta, profundidad);
    return timestamp;
  }

  return {
    __firestoreType: "map",
    entries: claves.map(key => {
      if (!key || key.length > 1500) {
        throw new Error("Campo peligroso o no válido en " + ruta + ".");
      }
      return { key, value: convertirValorBackupAntiguo(valor[key], ruta + "." + key, profundidad + 1) };
    })
  };
}

function normalizarBackupAntiguo(datos) {
  if (!Array.isArray(datos)) throw new Error("El backup antiguo debe ser una lista de documentos.");
  if (datos.length > BACKUP_MAX_DOCUMENTOS) throw new Error("El backup contiene demasiados documentos.");
  const ids = new Set();
  const documents = datos.map((documento, indice) => {
    if (!esObjetoPlano(documento)) throw new Error("Documento antiguo no válido en la posición " + indice + ".");
    validarIdDocumento(documento.id, indice);
    if (ids.has(documento.id)) throw new Error("ID duplicado en el backup: " + documento.id + ".");
    ids.add(documento.id);
    const data = Object.create(null);
    Object.entries(documento).forEach(([key, value]) => {
      if (key !== "id") data[key] = value;
    });
    return { id: documento.id, data: convertirValorBackupAntiguo(data, "documents[" + indice + "].data") };
  });
  return {
    format: BACKUP_FORMATO,
    version: 0,
    createdAt: null,
    source: { projectId: null },
    collection: BACKUP_COLECCION,
    documentCount: documents.length,
    documents,
    legacy: true
  };
}

function validarYNormalizarBackup(datos) {
  if (Array.isArray(datos)) return normalizarBackupAntiguo(datos);
  if (!tieneClavesExactas(datos, ["format", "version", "createdAt", "source", "collection", "documentCount", "documents"])) {
    throw new Error("La estructura principal del backup no es válida.");
  }
  if (datos.format !== BACKUP_FORMATO) throw new Error("Formato de backup no reconocido.");
  if (datos.version !== BACKUP_VERSION) throw new Error("Versión de backup no reconocida: " + datos.version + ".");
  if (datos.collection !== BACKUP_COLECCION) throw new Error("La copia no pertenece a la colección personas.");
  if (typeof datos.createdAt !== "string" || !Number.isFinite(Date.parse(datos.createdAt))) {
    throw new Error("Fecha de creación del backup no válida.");
  }
  if (!tieneClavesExactas(datos.source, ["projectId"]) ||
      typeof datos.source.projectId !== "string" || !datos.source.projectId) {
    throw new Error("Proyecto de origen no válido.");
  }
  if (datos.source.projectId !== firebaseConfig.projectId) {
    throw new Error(
      "El backup pertenece al proyecto '" + datos.source.projectId +
      "' y esta aplicación solo admite copias de '" + firebaseConfig.projectId + "'."
    );
  }
  if (!Number.isInteger(datos.documentCount) || datos.documentCount < 0 ||
      !Array.isArray(datos.documents) || datos.documentCount !== datos.documents.length) {
    throw new Error("El número de documentos declarado no coincide con el contenido.");
  }
  if (datos.documents.length > BACKUP_MAX_DOCUMENTOS) throw new Error("El backup contiene demasiados documentos.");

  const ids = new Set();
  datos.documents.forEach((documento, indice) => {
    if (!tieneClavesExactas(documento, ["id", "data"])) {
      throw new Error("Documento no válido en la posición " + indice + ".");
    }
    validarIdDocumento(documento.id, indice);
    if (ids.has(documento.id)) throw new Error("ID duplicado en el backup: " + documento.id + ".");
    ids.add(documento.id);
    validarNodoSerializado(documento.data, "documents[" + indice + "].data");
    if (documento.data.__firestoreType !== "map") {
      throw new Error("Los datos del documento " + documento.id + " deben ser un mapa.");
    }
  });
  return { ...datos, legacy: false };
}

function deserializarValorFirestore(nodo) {
  if (nodo === null || typeof nodo === "string" || typeof nodo === "boolean" || typeof nodo === "number") return nodo;
  const tipo = nodo.__firestoreType;
  if (tipo === "timestamp") return new firebase.firestore.Timestamp(nodo.seconds, nodo.nanoseconds);
  if (tipo === "geopoint") return new firebase.firestore.GeoPoint(nodo.latitude, nodo.longitude);
  if (tipo === "reference") return db.doc(nodo.path);
  if (tipo === "bytes") return firebase.firestore.Blob.fromBase64String(nodo.base64);
  if (tipo === "date") return new Date(nodo.iso);
  if (tipo === "number") {
    if (nodo.value === "NaN") return NaN;
    return nodo.value === "Infinity" ? Infinity : -Infinity;
  }
  if (tipo === "array") return nodo.items.map(deserializarValorFirestore);
  if (tipo === "map") {
    const resultado = {};
    nodo.entries.forEach(entrada => {
      Object.defineProperty(resultado, entrada.key, {
        value: deserializarValorFirestore(entrada.value),
        enumerable: true,
        writable: true,
        configurable: true
      });
    });
    return resultado;
  }
  throw new Error("Tipo serializado desconocido durante la restauración.");
}

function crearNombreBackup(prefijo, fecha = new Date()) {
  return prefijo + "_personas_" + fecha.toISOString().replace(/[:.]/g, "-") + ".json";
}

function descargarJSON(datos, nombreArchivo) {
  const json = JSON.stringify(datos, null, 2);
  const blob = new Blob([json], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const enlace = document.createElement("a");
  enlace.href = url;
  enlace.download = nombreArchivo;
  document.body.appendChild(enlace);
  enlace.click();
  enlace.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function establecerEstadoRestauracion(mensaje) {
  const estado = document.getElementById("estadoRestauracion");
  if (estado) estado.textContent = mensaje;
}

function bloquearControlesRestauracion(bloquear) {
  ["btnBackup", "btnElegirBackup", "btnCrearCopiaPrevia", "btnCancelarRestauracion"].forEach(id => {
    const control = document.getElementById(id);
    if (control) control.disabled = bloquear;
  });
  const input = document.getElementById("backupFile");
  if (input) input.disabled = bloquear;
}

function calcularVistaPrevia(backup, idsActuales) {
  const idsBackup = new Set(backup.documents.map(documento => documento.id));
  const coincidentes = backup.documents.filter(documento => idsActuales.has(documento.id)).length;
  return {
    total: backup.documents.length,
    coincidentes,
    nuevos: backup.documents.length - coincidentes,
    actualesFuera: [...idsActuales].filter(id => !idsBackup.has(id)).length
  };
}

function pintarVistaPrevia(backup, resumen) {
  const contenedor = document.getElementById("resumenVistaPrevia");
  const panel = document.getElementById("vistaPreviaRestauracion");
  if (!contenedor || !panel) return;
  const lineas = [
    "Documentos en la copia: " + resumen.total,
    "Documentos que se sobrescribirían: " + resumen.coincidentes,
    "Documentos que se crearían: " + resumen.nuevos,
    "Documentos actuales ajenos a la copia (no se borrarán): " + resumen.actualesFuera,
    "Fecha de la copia: " + (backup.createdAt || "No disponible (formato antiguo)"),
    "Versión: " + (backup.legacy ? "Antigua compatible" : backup.version),
    "Proyecto origen: " + (backup.source.projectId || "No disponible")
  ];
  contenedor.replaceChildren(...lineas.map(texto => {
    const p = document.createElement("p");
    p.textContent = texto;
    return p;
  }));
  panel.hidden = false;
}

window.hacerBackup = async function () {
  if (!exigirAdministrador() || restauracionEnCurso) return;
  const testigo = crearTestigoSesion();
  const boton = document.getElementById("btnBackup");
  if (boton) boton.disabled = true;
  try {
    const snapshot = await db.collection(BACKUP_COLECCION).get();
    if (!sesionSigueAutorizada(testigo)) return;
    const backup = crearBackupDesdeDocumentos(documentosDesdeSnapshot(snapshot));
    validarYNormalizarBackup(backup);
    descargarJSON(backup, crearNombreBackup("backup"));
    mostrarToast("✅ Copia de seguridad creada");
  } catch (error) {
    manejarErrorFirestore(error, "❌ No se pudo crear la copia de seguridad");
  } finally {
    if (boton) boton.disabled = false;
  }
};

function establecerEstadoBackupParcial(mensaje) {
  const estado = document.getElementById("estadoBackupParcial");
  if (estado) estado.textContent = mensaje;
}

function bloquearControlesBackupParcial(bloquear) {
  ["btnBackupParcial", "btnGenerarBackupParcial", "btnCancelarBackupParcial"].forEach(id => {
    const control = document.getElementById(id);
    if (control) control.disabled = bloquear;
  });
}

function crearBackupParcialDesdeSeleccion(idsSeleccionados, documentosDisponibles, fechaCreacion = new Date()) {
  const ids = [...new Set(idsSeleccionados)];
  if (ids.length === 0) throw new Error("No hay ninguna persona seleccionada.");

  const documentos = ids.map(id => {
    const documento = documentosDisponibles.get(id);
    if (!documento || documento.id !== id) {
      throw new Error("La selección contiene un documento que ya no está disponible.");
    }
    return { id: documento.id, data: documento.data };
  });

  const backup = crearBackupDesdeDocumentos(documentos, fechaCreacion);
  validarYNormalizarBackup(backup);
  return backup;
}

function pintarSelectorBackupParcial(documentos) {
  const lista = document.getElementById("listaBackupParcial");
  const panel = document.getElementById("selectorBackupParcial");
  if (!lista || !panel) return;
  lista.replaceChildren();

  documentos
    .slice()
    .sort((a, b) => String(a.data.nombreCompleto || "").localeCompare(String(b.data.nombreCompleto || ""), "es"))
    .forEach(documento => {
      const fila = document.createElement("label");
      fila.style.display = "block";

      const checkbox = document.createElement("input");
      checkbox.type = "checkbox";
      checkbox.checked = idsSeleccionBackupParcial.has(documento.id);
      checkbox.addEventListener("change", () => {
        if (checkbox.checked) idsSeleccionBackupParcial.add(documento.id);
        else idsSeleccionBackupParcial.delete(documento.id);
        establecerEstadoBackupParcial(idsSeleccionBackupParcial.size + " persona(s) seleccionada(s).");
      });

      const nombre = String(documento.data.nombreCompleto || "Sin nombre completo");
      const estado = documento.data.activo ? "Activo" : "Inactivo";
      const eliminado = documento.data.eliminado === true ? " · Eliminado lógicamente" : "";
      fila.append(checkbox, document.createTextNode(" " + nombre + " · ID: " + documento.id + " · " + estado + eliminado));
      lista.appendChild(fila);
    });

  panel.hidden = false;
  establecerEstadoBackupParcial("0 personas seleccionadas.");
}

window.abrirSeleccionBackupParcial = async function () {
  if (!exigirAdministrador()) return;
  const testigo = crearTestigoSesion();
  if (backupParcialEnCurso) {
    alert("Ya se está preparando una copia parcial.");
    return;
  }

  backupParcialEnCurso = true;
  bloquearControlesBackupParcial(true);
  establecerEstadoBackupParcial("Cargando personas, incluidas las eliminadas lógicamente...");
  try {
    const snapshot = await db.collection(BACKUP_COLECCION).get();
    if (!sesionSigueAutorizada(testigo)) return;
    const documentos = documentosDesdeSnapshot(snapshot);
    documentosBackupParcial = new Map(documentos.map(documento => [documento.id, documento]));
    idsSeleccionBackupParcial = new Set();
    pintarSelectorBackupParcial(documentos);
  } catch (error) {
    documentosBackupParcial = new Map();
    idsSeleccionBackupParcial = new Set();
    const panel = document.getElementById("selectorBackupParcial");
    if (panel) panel.hidden = true;
    manejarErrorFirestore(error, "❌ No se pudieron cargar las personas para la copia parcial");
  } finally {
    backupParcialEnCurso = false;
    bloquearControlesBackupParcial(false);
  }
};

window.generarBackupParcialSeleccionado = async function () {
  if (!exigirAdministrador()) return;
  if (backupParcialEnCurso) {
    alert("Ya se está generando una copia parcial.");
    return;
  }
  if (idsSeleccionBackupParcial.size === 0) {
    alert("Selecciona al menos una persona. No se ha generado ningún archivo.");
    return;
  }

  const seleccion = [...idsSeleccionBackupParcial].map(id => documentosBackupParcial.get(id));
  if (seleccion.some(documento => !documento)) {
    alert("La selección ya no es válida. Vuelve a abrir la lista.");
    return;
  }
  const resumen = seleccion.map(documento =>
    String(documento.data.nombreCompleto || "Sin nombre completo") + " · ID: " + documento.id
  );
  const confirmado = confirm(
    "Se incluirán " + seleccion.length + " persona(s):\n\n" + resumen.join("\n") +
    "\n\n¿Descargar esta copia parcial?"
  );
  if (!confirmado) return;

  backupParcialEnCurso = true;
  bloquearControlesBackupParcial(true);
  establecerEstadoBackupParcial("Generando y validando la copia parcial...");
  try {
    const backup = crearBackupParcialDesdeSeleccion(
      idsSeleccionBackupParcial,
      documentosBackupParcial
    );
    descargarJSON(backup, crearNombreBackup("copia_parcial"));
    mostrarToast("✅ Copia parcial creada con " + backup.documentCount + " persona(s)");
    cerrarSeleccionBackupParcial(true);
  } catch (error) {
    console.error(error);
    alert("No se pudo crear la copia parcial: " + error.message);
  } finally {
    backupParcialEnCurso = false;
    bloquearControlesBackupParcial(false);
  }
};

window.cerrarSeleccionBackupParcial = function (forzar = false) {
  if (backupParcialEnCurso && !forzar) return;
  documentosBackupParcial = new Map();
  idsSeleccionBackupParcial = new Set();
  const panel = document.getElementById("selectorBackupParcial");
  const lista = document.getElementById("listaBackupParcial");
  if (panel) panel.hidden = true;
  if (lista) lista.replaceChildren();
  establecerEstadoBackupParcial("");
};
function establecerEstadoPapelera(mensaje) {
  const estado = document.getElementById("estadoPapelera");
  if (estado) estado.textContent = mensaje;
}
function cambiarVistaPapelera(abierta) {
  const panel = document.getElementById("panelPapelera");
  const lista = document.getElementById("lista");
  const titulo = document.getElementById("tituloPersonas");
  const resumen = document.getElementById("resumen");
  if (panel) panel.hidden = !abierta;
  if (lista) lista.style.display = abierta ? "none" : "";
  if (titulo) titulo.style.display = abierta ? "none" : "";
  if (resumen) resumen.style.display = abierta ? "none" : "";
}
async function leerPersonasEliminadas(firestoreDb = db) {
  const snapshot = await firestoreDb.collection(BACKUP_COLECCION).where("eliminado", "==", true).get();
  return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }))
    .filter(persona => persona.eliminado === true);
}
function textoFechaEliminacion(valor) {
  if (!valor) return "No disponible";
  try {
    if (typeof valor.toDate === "function") return valor.toDate().toLocaleString("es-ES");
    if (valor instanceof Date) return valor.toLocaleString("es-ES");
  } catch (error) {
    console.error("Fecha de eliminación no válida:", error);
  }
  return "No disponible";
}
function actualizarPapeleraVacia() {
  const lista = document.getElementById("listaPapelera");
  if (!lista || lista.childElementCount > 0) return;
  const mensaje = document.createElement("p");
  mensaje.textContent = "La Papelera está vacía.";
  lista.replaceChildren(mensaje);
}
function retirarTarjetaPapelera(tarjeta) {
  if (tarjeta?.isConnected) tarjeta.remove();
  const lista = document.getElementById("listaPapelera");
  if (lista && lista.querySelectorAll(".card-papelera").length === 0) {
    lista.replaceChildren();
    actualizarPapeleraVacia();
  }
}
async function ejecutarOperacionPapelera(id, botones, operacion) {
  if (operacionesPapelera.has(id)) return false;
  operacionesPapelera.add(id);
  botones.forEach(boton => { boton.disabled = true; });
  try {
    await operacion();
    return true;
  } finally {
    operacionesPapelera.delete(id);
    botones.forEach(boton => { boton.disabled = false; });
  }
}
async function recuperarDocumentoEliminado(id, firestoreDb = db, fieldValue = firebase.firestore.FieldValue) {
  const referencia = firestoreDb.collection(BACKUP_COLECCION).doc(id);
  await firestoreDb.runTransaction(async transaction => {
    const snapshot = await transaction.get(referencia);
    if (!snapshot.exists) throw new Error("El documento ya no existe.");
    if (snapshot.data().eliminado !== true) throw new Error("El documento ya no está en la Papelera.");
    transaction.update(referencia, {
      eliminado: fieldValue.delete(),
      eliminadoEn: fieldValue.delete()
    });
  });
}
async function eliminarDocumentoDefinitivamente(id, firestoreDb = db) {
  const referencia = firestoreDb.collection(BACKUP_COLECCION).doc(id);
  await firestoreDb.runTransaction(async transaction => {
    const snapshot = await transaction.get(referencia);
    if (!snapshot.exists) throw new Error("El documento ya no existe.");
    if (snapshot.data().eliminado !== true) throw new Error("Solo se puede borrar definitivamente desde la Papelera.");
    transaction.delete(referencia);
  });
}
function confirmarEliminacionDefinitiva(persona, confirmar = confirm, solicitarTexto = prompt) {
  const primera = confirmar(
    "ELIMINACIÓN DEFINITIVA E IRREVERSIBLE\n\nPersona: " + String(persona.nombreCompleto || "Sin nombre") +
    "\nDocument ID: " + persona.id +
    "\n\nSe perderán todos los datos y todos los pagos de este documento.\n" +
    "Esta operación no se puede deshacer. ¿Deseas continuar?"
  );
  if (!primera) return false;
  const texto = solicitarTexto(
    "Segunda confirmación: escribe exactamente ELIMINAR para borrar definitivamente:\n" +
    String(persona.nombreCompleto || "Sin nombre") + "\nID: " + persona.id
  );
  return texto === "ELIMINAR";
}
function pintarPapelera(personas) {
  const lista = document.getElementById("listaPapelera");
  if (!lista) return;
  lista.replaceChildren();
  personas.slice().sort((a, b) => String(a.nombreCompleto || "").localeCompare(String(b.nombreCompleto || ""), "es"))
    .forEach(persona => {
      const tarjeta = document.createElement("article");
      tarjeta.className = "card card-papelera";
      const nombre = document.createElement("strong");
      nombre.textContent = persona.nombreCompleto || "Sin nombre completo";
      const id = document.createElement("div");
      id.textContent = "Document ID: " + persona.id;
      const estado = document.createElement("div");
      estado.textContent = "Estado: " + (persona.activo ? "Activo" : "Inactivo");
      const fecha = document.createElement("div");
      fecha.textContent = "Eliminado el: " + textoFechaEliminacion(persona.eliminadoEn);
      const direccion = document.createElement("div");
      direccion.textContent = "Dirección: " + (persona.direccionCompleta || "No disponible");
      const recuperar = document.createElement("button");
      recuperar.textContent = "♻️ Recuperar";
      const definitivo = document.createElement("button");
      definitivo.textContent = "Eliminar definitivamente";
      definitivo.className = "btn-eliminar";
      const botones = [recuperar, definitivo];
      recuperar.addEventListener("click", async () => {
        if (!exigirAdministrador()) return;
        try {
          const ejecutada = await ejecutarOperacionPapelera(persona.id, botones, () => recuperarDocumentoEliminado(persona.id));
          if (!ejecutada) return;
          retirarTarjetaPapelera(tarjeta);
          mostrarToast("♻️ Persona recuperada");
        } catch (error) {
          manejarErrorFirestore(error, "❌ No se pudo recuperar la persona");
        }
      });
      definitivo.addEventListener("click", async () => {
        if (!exigirAdministrador()) return;
        if (!confirmarEliminacionDefinitiva(persona)) {
          mostrarToast("Eliminación definitiva cancelada");
          return;
        }
        try {
          const ejecutada = await ejecutarOperacionPapelera(persona.id, botones, () => eliminarDocumentoDefinitivamente(persona.id));
          if (!ejecutada) return;
          retirarTarjetaPapelera(tarjeta);
          mostrarToast("🗑️ Persona eliminada definitivamente");
        } catch (error) {
          manejarErrorFirestore(error, "❌ No se pudo eliminar definitivamente");
        }
      });
      tarjeta.append(nombre, id, estado, fecha, direccion, recuperar, definitivo);
      lista.appendChild(tarjeta);
    });
  actualizarPapeleraVacia();
}
window.abrirPapelera = async function () {
  if (!exigirAdministrador()) return;
  const testigo = crearTestigoSesion();
  if (papeleraCargando) {
    alert("La Papelera ya se está cargando.");
    return;
  }
  papeleraVistaSolicitada = true;
  papeleraCargando = true;
  cambiarVistaPapelera(true);
  establecerEstadoPapelera("Cargando personas eliminadas...");
  const boton = document.getElementById("btnPapelera");
  if (boton) boton.disabled = true;
  try {
    const personas = await leerPersonasEliminadas();
    if (!papeleraVistaSolicitada || !sesionSigueAutorizada(testigo)) return;
    pintarPapelera(personas);
    establecerEstadoPapelera(personas.length + " persona(s) en la Papelera.");
  } catch (error) {
    papeleraVistaSolicitada = false;
    cambiarVistaPapelera(false);
    manejarErrorFirestore(error, "❌ No se pudo cargar la Papelera");
  } finally {
    papeleraCargando = false;
    if (boton) boton.disabled = false;
  }
};
window.cerrarPapelera = function (forzar = false) {
  if (operacionesPapelera.size > 0 && !forzar) {
    alert("Espera a que termine la operación de la Papelera.");
    return;
  }
  papeleraVistaSolicitada = false;
  cambiarVistaPapelera(false);
  const lista = document.getElementById("listaPapelera");
  if (lista) lista.replaceChildren();
  establecerEstadoPapelera("");
};
window.prepararRestauracion = async function (event) {
  if (!exigirAdministrador()) return;
  const testigo = crearTestigoSesion();
  if (restauracionEnCurso) {
    alert("Ya hay una restauración en curso.");
    return;
  }
  const file = event.target.files[0];
  if (!file) return;
  cancelarRestauracion(false);
  if (file.size > BACKUP_MAX_BYTES) {
    alert("El archivo supera el tamaño máximo permitido de 20 MB. Cero escrituras realizadas.");
    event.target.value = "";
    return;
  }

  bloquearControlesRestauracion(true);
  establecerEstadoRestauracion("Validando la copia y calculando la vista previa...");
  try {
    const texto = await file.text();
    if (!sesionSigueAutorizada(testigo)) return;
    if (!texto.trim()) throw new Error("El archivo está vacío.");
    let datos;
    try {
      datos = JSON.parse(texto);
    } catch (error) {
      throw new Error("El archivo no contiene JSON válido.");
    }
    const backup = validarYNormalizarBackup(datos);
    const snapshot = await db.collection(BACKUP_COLECCION).get();
    if (!sesionSigueAutorizada(testigo)) return;
    const idsActuales = new Set(snapshot.docs.map(doc => doc.id));
    const resumen = calcularVistaPrevia(backup, idsActuales);
    restauracionPendiente = { backup, resumen, copiaPreviaLista: false, idsActuales };
    pintarVistaPrevia(backup, resumen);
    const ejecutar = document.getElementById("btnEjecutarRestauracion");
    if (ejecutar) ejecutar.disabled = true;
    establecerEstadoRestauracion("Archivo válido. Revisa la vista previa y crea la copia previa obligatoria.");
  } catch (error) {
    console.error(error);
    restauracionPendiente = null;
    const panel = document.getElementById("vistaPreviaRestauracion");
    if (panel) panel.hidden = true;
    event.target.value = "";
    alert("No se puede restaurar: " + error.message + " Cero escrituras realizadas.");
  } finally {
    bloquearControlesRestauracion(false);
  }
};

window.crearCopiaPreviaRestauracion = async function () {
  if (!exigirAdministrador() || !restauracionPendiente || restauracionEnCurso) return;
  const testigo = crearTestigoSesion();
  bloquearControlesRestauracion(true);
  establecerEstadoRestauracion("Creando la copia automática previa...");
  try {
    const snapshot = await db.collection(BACKUP_COLECCION).get();
    if (!sesionSigueAutorizada(testigo)) return;
    const backupPrevio = crearBackupDesdeDocumentos(documentosDesdeSnapshot(snapshot));
    validarYNormalizarBackup(backupPrevio);
    descargarJSON(backupPrevio, crearNombreBackup("antes_de_restaurar"));
    const idsActuales = new Set(snapshot.docs.map(doc => doc.id));
    restauracionPendiente.idsActuales = idsActuales;
    restauracionPendiente.resumen = calcularVistaPrevia(restauracionPendiente.backup, idsActuales);
    restauracionPendiente.copiaPreviaLista = true;
    pintarVistaPrevia(restauracionPendiente.backup, restauracionPendiente.resumen);
    const ejecutar = document.getElementById("btnEjecutarRestauracion");
    if (ejecutar) ejecutar.disabled = false;
    establecerEstadoRestauracion("Copia previa generada. Comprueba la descarga antes de ejecutar la restauración.");
  } catch (error) {
    console.error(error);
    restauracionPendiente = null;
    const ejecutar = document.getElementById("btnEjecutarRestauracion");
    const panel = document.getElementById("vistaPreviaRestauracion");
    const input = document.getElementById("backupFile");
    if (ejecutar) ejecutar.disabled = true;
    if (panel) panel.hidden = true;
    if (input) input.value = "";
    alert("No se pudo crear la copia previa. Restauración cancelada y cero escrituras realizadas.");
  } finally {
    bloquearControlesRestauracion(false);
  }
};

async function restaurarDocumentosPorLotes(documentos, idsActuales, onProgress = () => {}) {
  const resultado = {
    restaurados: 0,
    nuevos: 0,
    sobrescritos: 0,
    errores: 0,
    lotesCompletados: 0,
    lotesFallidos: 0
  };

  const preparados = documentos.map(documento => ({
    id: documento.id,
    data: deserializarValorFirestore(documento.data),
    existia: idsActuales.has(documento.id)
  }));

  for (let inicio = 0; inicio < preparados.length; inicio += RESTAURACION_TAMANO_LOTE) {
    const grupo = preparados.slice(inicio, inicio + RESTAURACION_TAMANO_LOTE);
    const batch = db.batch();
    grupo.forEach(documento => {
      batch.set(db.collection(BACKUP_COLECCION).doc(documento.id), documento.data);
    });
    try {
      await batch.commit();
      resultado.lotesCompletados++;
      resultado.restaurados += grupo.length;
      resultado.nuevos += grupo.filter(documento => !documento.existia).length;
      resultado.sobrescritos += grupo.filter(documento => documento.existia).length;
    } catch (error) {
      console.error("Falló un lote de restauración:", error);
      resultado.lotesFallidos++;
      resultado.errores += grupo.length;
    }
    onProgress(Math.min(inicio + grupo.length, preparados.length), preparados.length);
  }
  return resultado;
}

function mensajeResultadoRestauracion(resultado) {
  const completa = resultado.errores === 0;
  return [
    completa ? "Restauración completa" : "ATENCIÓN: restauración parcial",
    "Documentos restaurados: " + resultado.restaurados,
    "Documentos nuevos: " + resultado.nuevos,
    "Documentos sobrescritos: " + resultado.sobrescritos,
    "Errores: " + resultado.errores,
    "Lotes completados: " + resultado.lotesCompletados,
    "Lotes fallidos: " + resultado.lotesFallidos
  ].join("\n");
}

window.ejecutarRestauracionConfirmada = async function () {
  if (!exigirAdministrador()) return;
  if (restauracionEnCurso) {
    alert("Ya hay una restauración en curso.");
    return;
  }
  if (!restauracionPendiente?.copiaPreviaLista) {
    alert("Antes debes crear correctamente la copia previa obligatoria.");
    return;
  }
  const resumen = restauracionPendiente.resumen;
  const confirmado = confirm(
    "Se sobrescribirán exactamente " + resumen.coincidentes +
    " documentos y se crearán " + resumen.nuevos +
    ". Los documentos ajenos a la copia no se borrarán. ¿Continuar?"
  );
  if (!confirmado) return;

  restauracionEnCurso = true;
  bloquearControlesRestauracion(true);
  const ejecutar = document.getElementById("btnEjecutarRestauracion");
  if (ejecutar) ejecutar.disabled = true;
  try {
    const resultado = await restaurarDocumentosPorLotes(
      restauracionPendiente.backup.documents,
      restauracionPendiente.idsActuales,
      (procesados, total) => establecerEstadoRestauracion("Restaurando: " + procesados + " de " + total + " documentos...")
    );
    const mensaje = mensajeResultadoRestauracion(resultado);
    establecerEstadoRestauracion(mensaje.replace(/\n/g, " · "));
    alert(mensaje);
    restauracionPendiente = null;
    const input = document.getElementById("backupFile");
    if (input) input.value = "";
  } catch (error) {
    console.error(error);
    establecerEstadoRestauracion("Restauración no iniciada: falló la preparación de los datos.");
    alert("No se inició la restauración: " + error.message + ".");
  } finally {
    restauracionEnCurso = false;
    bloquearControlesRestauracion(false);
  }
};

window.cancelarRestauracion = function (limpiarInput = true) {
  if (restauracionEnCurso) return;
  restauracionPendiente = null;
  const panel = document.getElementById("vistaPreviaRestauracion");
  const resumen = document.getElementById("resumenVistaPrevia");
  const estado = document.getElementById("estadoRestauracion");
  const ejecutar = document.getElementById("btnEjecutarRestauracion");
  const input = document.getElementById("backupFile");
  if (panel) panel.hidden = true;
  if (resumen) resumen.replaceChildren();
  if (estado) estado.textContent = "";
  if (ejecutar) ejecutar.disabled = true;
  if (limpiarInput && input) input.value = "";
};
function limpiarBusqueda() {
  const input = document.getElementById("buscador");
  ocultarFichas();
  input?.focus();
}

document.addEventListener("DOMContentLoaded", () => {

  const input = document.getElementById("buscador");
  const clearBtn = document.querySelector(".btn-limpiar");

  if (!input || !clearBtn) return;

  input.addEventListener("input", () => {
    clearBtn.classList.toggle("visible", input.value.trim() !== "");
  });

});




// ===============================
// 🔥 ACCIONES FIREBASE
// ===============================

async function toggleActivo(id, estado) {
  if (!exigirAdministrador()) return;
  try {
    await db.collection("personas").doc(id).update({
      activo: !estado
    });
  } catch (err) {
    manejarErrorFirestore(err, "❌ Error al cambiar el estado");
  }
}

async function togglePago(id, estado) {
  if (!exigirAdministrador()) return;
  try {
    await db.collection("personas").doc(id).update({
      ["pagos." + añoActual]: !estado
    });
  } catch (err) {
    manejarErrorFirestore(err, "❌ Error al cambiar el pago");
  }
}

async function eliminarPersona(id) {
  if (!exigirAdministrador()) return;
  if (!confirm("¿Eliminar persona?")) return;

  try {
    await db.collection("personas").doc(id).update({
      eliminado: true,
      eliminadoEn: firebase.firestore.FieldValue.serverTimestamp()
    });
    mostrarToast("🗑️ Persona movida a eliminados");
  } catch (err) {
    manejarErrorFirestore(err, "❌ Error al eliminar");
  }
}

// ===============================
// 📊 RESUMEN
// ===============================

function actualizarResumen(personas) {
  const total = personas.length;
  const pagados = personas.filter(p => p.pagos?.[añoActual]).length;
  const pendientes = total - pagados;
  const div = document.getElementById("resumen");

  const totalSpan = document.createElement("span");
  totalSpan.className = "total";
  totalSpan.textContent = "👥 Total: " + total;

  const pagadosSpan = document.createElement("span");
  pagadosSpan.className = "pagados";
  pagadosSpan.textContent = "💳 Pagados: " + pagados;

  const pendientesSpan = document.createElement("span");
  pendientesSpan.className = "pendientes";
  pendientesSpan.textContent = "❌ Pendientes: " + pendientes;

  div.replaceChildren(totalSpan, pagadosSpan, pendientesSpan);
}

// ===============================
// 🔍 BUSCADOR
// ===============================

function normalizarTexto(texto) {
  return (texto || "")
    .toLowerCase()
    .normalize("NFD") // quita tildes
    .replace(/[\u0300-\u036f]/g, "");
}
function buscar(texto) {

  filtroActual = texto;

  const filtro = normalizarTexto(texto);

  if (!filtro) {
    ocultarFichas();
    return;
  }

  mostrarFichas();
  activarFiltro(null);

  const filtradas = todasLasPersonas.filter(p => {

    const contenido = `
      ${p.nombreCompleto || ""}
      ${p.direccionCompleta || ""}
      ${p.poblacion || ""}
      ${p.provincia || ""}
      ${p.codigoPostal || ""}
    `;

    return normalizarTexto(contenido).includes(filtro);
  });

  render(filtradas);
}
// ===============================
// 📥 CSV IMPORT (MEJORADO)
// ===============================

let importacionCSVEnCurso = false;

function textoCSV(valor) {
  return String(valor ?? "").trim();
}

function normalizarClaveDuplicado(valor) {
  return textoCSV(valor)
    .replace(/\s+/g, " ")
    .toLocaleLowerCase("es-ES");
}

function claveDuplicado(persona) {
  return normalizarClaveDuplicado(persona.nombreCompleto) + "\u0000" +
    normalizarClaveDuplicado(persona.direccionCompleta);
}

function filaCSVVacia(fila) {
  return Object.values(fila || {}).every(valor => textoCSV(valor) === "");
}

function validarCabecerasCSV(campos) {
  const cabeceras = new Set((campos || []).map(textoCSV));
  const faltan = ["nombre", "apellido1"].filter(campo => !cabeceras.has(campo));
  const tieneDireccion = ["via", "nombreVia", "numero"].some(campo => cabeceras.has(campo));

  if (!tieneDireccion) faltan.push("via/nombreVia/numero");
  return faltan;
}

function crearPersonaDesdeFilaCSV(fila) {
  const nombre = textoCSV(fila.nombre);
  const apellido1 = textoCSV(fila.apellido1);
  const apellido2 = textoCSV(fila.apellido2);
  const apellidos = [apellido1, apellido2].filter(Boolean).join(" ");
  const direccionCompleta = [fila.via, fila.nombreVia, fila.numero]
    .map(textoCSV)
    .filter(Boolean)
    .join(" ");

  if (!nombre || !apellido1 || !direccionCompleta) return null;

  return {
    nombre,
    apellidos,
    nombreCompleto: apellidos + ", " + nombre,
    direccionCompleta,
    codigoPostal: textoCSV(fila.codigoPostal),
    poblacion: textoCSV(fila.poblacion),
    provincia: textoCSV(fila.provincia),
    fechaNacimiento: textoCSV(fila.fechaNacimiento),
    activo: true,
    pagos: {}
  };
}

function parsearCSV(file) {
  return new Promise((resolve, reject) => {
    Papa.parse(file, {
      header: true,
      skipEmptyLines: "greedy",
      transformHeader: cabecera => textoCSV(cabecera).replace(/^\uFEFF/, ""),
      complete: resolve,
      error: reject
    });
  });
}

async function importarPersonasValidadas(personas, existentes, guardar) {
  const resumen = {
    añadidos: 0,
    duplicados: 0,
    eliminadosOmitidos: 0,
    errores: 0
  };
  const activas = new Set();
  const eliminadas = new Set();

  existentes.forEach(persona => {
    const clave = claveDuplicado(persona);
    if (persona.eliminado === true) eliminadas.add(clave);
    else activas.add(clave);
  });

  for (const persona of personas) {
    const clave = claveDuplicado(persona);

    if (eliminadas.has(clave)) {
      resumen.eliminadosOmitidos++;
      continue;
    }

    if (activas.has(clave)) {
      resumen.duplicados++;
      continue;
    }

    // Reserva la clave para detectar filas repetidas dentro del mismo CSV.
    activas.add(clave);

    try {
      await guardar(persona);
      resumen.añadidos++;
    } catch (error) {
      console.error("Error al importar una persona:", error);
      resumen.errores++;
    }
  }

  return resumen;
}

function mensajeResumenImportacion(resumen) {
  return [
    "Importación finalizada",
    "Añadidos: " + resumen.añadidos,
    "Duplicados/omitidos: " + resumen.duplicados,
    "Coinciden con personas eliminadas: " + resumen.eliminadosOmitidos,
    "Filas inválidas: " + resumen.invalidos,
    "Errores: " + resumen.errores
  ].join("\n");
}

window.importarCSV = async function () {
  if (!exigirAdministrador()) return;
  if (importacionCSVEnCurso) {
    alert("Ya hay una importación en curso.");
    return;
  }

  const input = document.getElementById("csvFile");
  const file = input?.files[0];
  if (!file) return alert("Selecciona un CSV");

  const boton = document.querySelector(".btn-importar");
  importacionCSVEnCurso = true;
  if (boton) {
    boton.disabled = true;
    boton.textContent = "Importando...";
  }

  try {
    const results = await parsearCSV(file);
    const erroresParseo = results.errors || [];
    const cabecerasFaltantes = validarCabecerasCSV(results.meta?.fields);

    if (erroresParseo.length > 0 || cabecerasFaltantes.length > 0) {
      const detalles = [];
      if (cabecerasFaltantes.length) {
        detalles.push("Faltan cabeceras necesarias: " + cabecerasFaltantes.join(", "));
      }
      if (erroresParseo.length) {
        detalles.push("PapaParse detectó " + erroresParseo.length + " error(es) de formato.");
      }
      alert("CSV incompatible o mal formado. No se ha escrito ningún dato.\n" + detalles.join("\n"));
      return;
    }

    const filas = (results.data || []).filter(fila => !filaCSVVacia(fila));
    const personas = [];
    let invalidos = 0;

    filas.forEach(fila => {
      const persona = crearPersonaDesdeFilaCSV(fila);
      if (persona) personas.push(persona);
      else invalidos++;
    });

    if (personas.length === 0) {
      alert("El CSV no contiene filas válidas. No se ha escrito ningún dato.\nFilas inválidas: " + invalidos);
      return;
    }

    let snapshot;
    try {
      // Una sola lectura inicial para comparar todos los duplicados localmente.
      snapshot = await db.collection("personas").get();
    } catch (error) {
      console.error("No se pudieron comprobar los duplicados:", error);
      alert("No se pudieron comprobar los duplicados. No se ha escrito ningún dato.\nErrores: " + personas.length);
      return;
    }

    const existentes = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    const resumen = await importarPersonasValidadas(
      personas,
      existentes,
      persona => db.collection("personas").add(persona)
    );
    resumen.invalidos = invalidos;
    alert(mensajeResumenImportacion(resumen));
  } catch (error) {
    console.error("Error al leer el CSV:", error);
    alert("No se pudo leer el CSV. No se ha iniciado ninguna importación.");
  } finally {
    importacionCSVEnCurso = false;
    if (input) input.value = "";
    if (boton) {
      boton.disabled = false;
      boton.textContent = "⬆️ Importar";
    }
  }
};
// ===============================
// ➕ AÑADIR PERSONA
// ===============================



// ===============================
// 🚀 INIT
// ===============================

window.onload = function () {

  const buscador = document.getElementById("buscador");

  if (buscador) {
    buscador.addEventListener("input", e =>
      buscar(e.target.value)
    );
  }
};
document.addEventListener("DOMContentLoaded", () => {
  const alClic = (id, accion) => {
    document.getElementById(id)?.addEventListener("click", accion);
  };

  alClic("btnLogin", () => login());
  alClic("btnLogout", () => logout());
  alClic("btnElegirCsv", () => document.getElementById("csvFile")?.click());
  alClic("btnImportarCsv", () => importarCSV());
  alClic("btnLimpiarBusqueda", () => limpiarBusqueda());
  alClic("btnDescargarRecibos", () => descargarRecibosPDF());
  alClic("btnImprimirRecibos", () => imprimirRecibos());
  alClic("btnPendientes", event => verPendientes(event.currentTarget));
  alClic("btnPagados", event => verPagados(event.currentTarget));
  alClic("btnActivos", event => verActivos(event.currentTarget));
  alClic("btnTodos", event => verTodos(event.currentTarget));
  alClic("btnOcultarFichas", event => ocultarFichas(event.currentTarget));
  alClic("btnIrListado", () => irListado());
  alClic("btnIrFiltros", () => irAFiltros());
  alClic("btnPapelera", () => abrirPapelera());
  alClic("btnBackup", () => hacerBackup());
  alClic("btnBackupParcial", () => abrirSeleccionBackupParcial());
  alClic("btnGenerarBackupParcial", () => generarBackupParcialSeleccionado());
  alClic("btnCancelarBackupParcial", () => cerrarSeleccionBackupParcial());
  alClic("btnElegirBackup", () => document.getElementById("backupFile")?.click());
  alClic("btnCrearCopiaPrevia", () => crearCopiaPreviaRestauracion());
  alClic("btnEjecutarRestauracion", () => ejecutarRestauracionConfirmada());
  alClic("btnCancelarRestauracion", () => cancelarRestauracion());
  alClic("btnCerrarPapelera", () => cerrarPapelera());
  alClic("btnVerResultados", () => verResultados());
  alClic("btnPdfFiltrado", () => pdfFiltrado());
  alClic("btnVolverFiltros", () => volver());
  alClic("btnGuardar", () => guardarPersona());
  alClic("btnCancelarFormulario", () => cerrarFormulario());
  alClic("btnAbrirFormulario", () => abrirFormulario());
  alClic("btnCerrarFormularioSecundario", () => cerrarFormulario());

  document.getElementById("backupFile")?.addEventListener("change", prepararRestauracion);
});

auth.onAuthStateChanged(user => {
  invalidarOperacionesDeSesion();
  limpiarDatosPersonas();
  usuarioActual = user;

  if (!user) {
    mostrarControlesAdministrativos(false);
    actualizarEstadoAcceso("🔒 Inicia sesión con la cuenta autorizada para acceder.");
    return;
  }

  if (!usuarioLogueado()) {
    mostrarControlesAdministrativos(false);
    actualizarEstadoAcceso("⛔ La cuenta " + (user.email || "") + " no está autorizada.");
    return;
  }

  mostrarControlesAdministrativos(true);
  actualizarEstadoAcceso("✅ Sesión autorizada: " + user.email);
  escucharPersonas();
}, error => {
  console.error(error);
  usuarioActual = null;
  limpiarDatosPersonas();
  mostrarControlesAdministrativos(false);
  actualizarEstadoAcceso("No se pudo comprobar la sesión. Inicia sesión de nuevo.");
});
function irListado() {
  if (!exigirAdministrador()) return;
  window.location.href = "listado.html";
}