// ===============================
// 🚀 CONFIG + INICIO
// ===============================

console.log("APP PRO INICIADA");

let todasLasPersonas = [];
let personaEditandoId = null;
const añoActual = String(new Date().getFullYear());

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


// ===============================
// 🔐 AUTH
// ===============================

window.login = function () {
  const provider = new firebase.auth.GoogleAuthProvider();

  auth.signInWithPopup(provider)
    .then(r => console.log("✔️ Login:", r.user.email))
    .catch(console.error);
};

window.logout = function () {
  auth.signOut();
};

// ===============================
// ⚡ TIEMPO REAL
// ===============================

function escucharPersonas() {
  db.collection("personas")
    .orderBy("nombreCompleto")
    .onSnapshot(snapshot => {

      todasLasPersonas = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));

      render(todasLasPersonas);
    });
}

// ===============================
// 🎨 RENDER
// ===============================

function render(personas) {
  const contenedor = document.getElementById("lista");
  contenedor.innerHTML = "";

  personas.forEach(p => {

    const card = document.createElement("div");
    card.className = `card ${p.activo ? "activo" : "inactivo"}`;

  card.innerHTML = `
  <div class="top">
    <span class="nombre">${p.nombreCompleto}</span>
  </div>

  <div class="dato">${p.direccionCompleta}</div>
  <div class="dato">${p.poblacion} (${p.codigoPostal})</div>
  <div class="dato">Provincia: ${p.provincia || "-"}</div>
  <div class="dato">Nacimiento: ${p.fechaNacimiento || "-"}</div>

  <div class="dato">
    Estado: ${p.activo ? "🟢 Activo" : "🔴 Inactivo"}
  </div>

  <div class="dato">
    Pago ${añoActual}:
    <span class="${p.pagos?.[añoActual] ? "pago-ok" : "pago-pendiente"}">
      ${p.pagos?.[añoActual] ? "💳 Pagado" : "❌ Pendiente"}
    </span>
  </div>

  <button onclick="editarPersona('${p.nombreCompleto}', '${p.direccionCompleta}')">
    ✏️ Editar
  </button>
`;
    // 🔥 BOTONES LIMPIOS
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
  activarFiltro(btn);

  const filtradas = todasLasPersonas.filter(p => !p.pagos?.[añoActual]);
  render(filtradas);
}

function verPagados(btn) {
  activarFiltro(btn);

  const filtradas = todasLasPersonas.filter(p => p.pagos?.[añoActual]);
  render(filtradas);
}

function verTodos(btn) {
  activarFiltro(btn);

  render(todasLasPersonas);
}
function abrirFormulario() {
  const modal = document.getElementById("modalForm");

  // mostrar modal
  modal.classList.remove("hidden");

  // limpiar formulario
  limpiarFormulario();

  // valores por defecto
  document.getElementById("poblacion").value = "GALLUR";
  document.getElementById("provincia").value = "ZARAGOZA";
  document.getElementById("cp").value = "50650";

  // foco automático
  document.getElementById("nombre").focus();
}

function cerrarFormulario() {
  document.getElementById("modalForm").classList.add("hidden");
}
async function guardarPersona() {

  const btn = document.getElementById("btnGuardar");
  btn.disabled = true;
  btn.textContent = "Guardando...";

  const nombre = document.getElementById("nombre").value.trim();
  const apellido1 = document.getElementById("apellido1").value.trim();

  if (!nombre || !apellido1) {
    alert("Nombre y apellido obligatorios");
    btn.disabled = false;
    btn.textContent = "💾 Guardar";
    return;
  }

  const persona = {
    nombre,
    apellidos: `${apellido1} ${document.getElementById("apellido2").value}`,
    nombreCompleto: `${apellido1}, ${nombre}`,
    direccionCompleta: document.getElementById("direccion").value,
    poblacion: document.getElementById("poblacion").value || "GALLUR",
    provincia: document.getElementById("provincia").value || "ZARAGOZA",
    codigoPostal: document.getElementById("cp").value || "50650",
    fechaNacimiento: document.getElementById("fecha").value,
    activo: true,
    pagos: {}
  };

  try {
    if (personaEditandoId) {
      await db.collection("personas").doc(personaEditandoId).update(persona);
      mostrarToast("✏️ Persona actualizada");
      personaEditandoId = null;
    } else {
      await db.collection("personas").add(persona);
      mostrarToast("✅ Persona creada");
    }

    limpiarFormulario();
    cerrarFormulario();

  } catch (err) {
    console.error(err);
    mostrarToast("❌ Error al guardar");
  }

  btn.disabled = false;
  btn.textContent = "💾 Guardar";
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

function editarPersona(nombreCompleto, direccionCompleta) {

  db.collection("personas")
    .where("nombreCompleto", "==", nombreCompleto)
    .where("direccionCompleta", "==", direccionCompleta)
    .get()
    .then(snapshot => {

      snapshot.forEach(doc => {
        const p = doc.data();

        personaEditandoId = doc.id;

        abrirFormulario();

        // rellenar formulario
        document.getElementById("nombre").value = p.nombre || "";
        document.getElementById("apellido1").value = p.apellidos?.split(" ")[0] || "";
        document.getElementById("apellido2").value = p.apellidos?.split(" ")[1] || "";
        document.getElementById("direccion").value = p.direccionCompleta || "";
        document.getElementById("poblacion").value = p.poblacion || "";
        document.getElementById("provincia").value = p.provincia || "";
        document.getElementById("cp").value = p.codigoPostal || "";
        document.getElementById("fecha").value = p.fechaNacimiento || "";

        // 🔥 CAMBIAR BOTÓN
        const btn = document.getElementById("btnGuardar");
        btn.textContent = "💾 Guardar cambios";
        btn.style.background = "#f39c12"; // naranja
      });

    });
}
function verActivos(btn) {
  activarFiltro(btn);

  const filtradas = todasLasPersonas.filter(p => p.activo);
  render(filtradas);
}
function activarFiltro(boton) {
  document.querySelectorAll(".btn-filtro").forEach(btn => {
    btn.classList.remove("activo");
  });

  boton.classList.add("activo");
}


// ===============================
// 🔥 ACCIONES FIREBASE
// ===============================

function toggleActivo(id, estado) {
  db.collection("personas").doc(id).update({
    activo: !estado
  });
}

function togglePago(id, estado) {
  db.collection("personas").doc(id).update({
    [`pagos.${añoActual}`]: !estado
  });
}

function eliminarPersona(id) {
  if (!confirm("¿Eliminar persona?")) return;

  db.collection("personas").doc(id).delete();
}

// ===============================
// 📊 RESUMEN
// ===============================

function actualizarResumen(personas) {
  const total = personas.length;
  const pagados = personas.filter(p => p.pagos?.[añoActual]).length;
  const pendientes = total - pagados;
  const div = document.getElementById("resumen");
  document.getElementById("resumen").innerHTML = `
    <span class="total">👥 Total: ${total}</span>
    <span class="pagados">💳 Pagados: ${pagados}</span>
    <span class="pendientes">❌ Pendientes: ${pendientes}</span>
  `;
}

// ===============================
// 🔍 BUSCADOR
// ===============================

function buscar(texto) {
  const f = texto.toLowerCase();

  const filtradas = todasLasPersonas.filter(p =>
    p.nombreCompleto?.toLowerCase().includes(f) ||
    p.direccionCompleta?.toLowerCase().includes(f)
  );

  render(filtradas);
}

// ===============================
// 📥 CSV IMPORT (MEJORADO)
// ===============================

window.importarCSV = function () {
  const file = document.getElementById("csvFile")?.files[0];
  if (!file) return alert("Selecciona un CSV");

  Papa.parse(file, {
    header: true,
    skipEmptyLines: true,

    complete: function (results) {

      const filas = results.data.filter(r => r.nombre || r.apellido1);

      let guardados = 0;
      let duplicados = 0;
      let procesados = 0;

      filas.forEach(row => {

        const apellidos = `${row.apellido1 || ""} ${row.apellido2 || ""}`.trim();

        const persona = {
          nombre: row.nombre || "",
          apellidos,
          nombreCompleto: `${apellidos}, ${row.nombre || ""}`,
          direccionCompleta: `${row.via || ""} ${row.nombreVia || ""} ${row.numero || ""}`,
          codigoPostal: row.codigoPostal || "",
          poblacion: row.poblacion || "",
          provincia: row.provincia || "",
          fechaNacimiento: row.fechaNacimiento || "",
          activo: true,
          pagos: {}
        };

        db.collection("personas")
          .where("nombreCompleto", "==", persona.nombreCompleto)
          .where("direccionCompleta", "==", persona.direccionCompleta)
          .get()
          .then(snap => {

            if (!snap.empty) {
              duplicados++;
            } else {
              db.collection("personas").add(persona);
              guardados++;
            }

            procesados++;

            if (procesados === filas.length) {
              alert(`Importado\nNuevos: ${guardados}\nDuplicados: ${duplicados}`);
            }
          });
      });
    }
  });
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

  auth.onAuthStateChanged(user => {
    if (user) {
      escucharPersonas(); // 🔥 TIEMPO REAL
    }
  });
};