console.log("APP CARGADA BIEN");
let todasLasPersonas = [];

const firebaseConfig = {
  apiKey: "AIzaSyD7DLEhlAKufj003MMlo1tkBe8k0xrkTyA",
  authDomain: "cofradia-app-28829.firebaseapp.com",
  projectId: "cofradia-app-28829",
  storageBucket: "cofradia-app-28829.firebasestorage.app",
  messagingSenderId: "650302836714",
  appId: "1:650302836714:web:66c9ceeaf6de536d3dec93"
};

// 🔥 Firebase
firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();

console.log("APP CARGADA");

const añoActual = String(new Date().getFullYear());
// 🔹 IMPORTAR CSV
window.importarCSV = function() {
  
 
  const file = document.getElementById("csvFile").files[0];

  if (!file) {
    alert("Selecciona un archivo");
    return;
  }

  Papa.parse(file, {
    header: true,
    skipEmptyLines: true,
    delimiter: "",
    

    complete: function(results) {
console.log("PRIMERA FILA:", results.data[0]);
      let guardados = 0;
      let duplicados = 0;
      let total = results.data.length;
      let procesados = 0;

      const personas = results.data
  .filter(row => row.nombre || row.apellido1) // 👈 FILTRO
  .map(row => {

        const limpio = {};
        Object.keys(row).forEach(key => {
          limpio[key.trim().replace(/\r/g, "").replace(/\uFEFF/g, "")] = row[key];
        });

        const apellidos = `${limpio.apellido1 || ""} ${limpio.apellido2 || ""}`.trim();

        const persona = {
          nombre: limpio.nombre || "",
          apellidos: apellidos,
          nombreCompleto: `${apellidos}, ${limpio.nombre || ""}`,
          direccionCompleta: `${limpio.via || ""} ${limpio.nombreVia || ""} ${limpio.numero || ""}`,
          codigoPostal: limpio.codigoPostal || "",
          poblacion: limpio.poblacion || "",
          provincia: limpio.provincia || "",
          fechaNacimiento: limpiarFecha(limpio.fechaNacimiento),
          activo: limpio.activo === "true" || limpio.activo === true,
            pagos: {} // 👈 AÑADIR 
        };
document.getElementById("csvFile").addEventListener("change", function() {
  const nombre = this.files[0]?.name || "";
  document.getElementById("nombreArchivo").textContent = nombre;
});
if (!persona.nombreCompleto.trim() || persona.nombreCompleto === ",") return null;
        // 🔍 comprobar duplicados
        db.collection("personas")
          .where("nombreCompleto", "==", persona.nombreCompleto)
          .where("direccionCompleta", "==", persona.direccionCompleta)
          .get()
          .then(snapshot => {

            if (!snapshot.empty) {
              duplicados++;
              procesados++;
              comprobarFin();
              return;
            }

            db.collection("personas").add(persona)
              .then(() => {
                guardados++;
                procesados++;
                comprobarFin();
              })
              .catch((error) => {
                console.error("❌ Error:", error);
                procesados++;
                comprobarFin();
              });

          });

        return persona;
      });

      mostrarPersonas(personas);

      function comprobarFin() {
        if (procesados === total) {
          alert(`Importacion terminada:
Nuevos: ${guardados}
Duplicados: ${duplicados}`);
        }
      }

    }
  });
}


// 🔹 LIMPIAR FECHA
function limpiarFecha(fecha) {
  if (!fecha) return null;

  let f = String(fecha).trim();

  if (/^\d{8}$/.test(f)) {
    const dia = f.substring(0, 2);
    const mes = f.substring(2, 4);
    const anio = f.substring(4, 8);
    return `${anio}-${mes}-${dia}`;
  }

  if (f.includes("-")) return f;

  return f;
}


// 🔹 MOSTRAR PERSONAS

function mostrarPersonas(personas) {
  actualizarResumen(personas);
  const contenedor = document.getElementById("lista");
  contenedor.innerHTML = "";

  personas.forEach(p => {
    const div = document.createElement("div");
 div.className = `card ${p.activo ? "activo" : "inactivo"}`;
 div.innerHTML = `
  <div class="nombre">${p.nombreCompleto}</div>
  <div class="dato">${p.direccionCompleta}</div>
  <div class="dato">${p.poblacion} (${p.codigoPostal})</div>
  <div class="dato">Provincia: ${p.provincia}</div>
  <div class="dato">Nacimiento: ${p.fechaNacimiento || "—"}</div>
  <div class="dato">Estado: ${p.activo ? "🟢 Activo" : "🔴 Inactivo"}</div>
<div class="dato">
<div class="dato">
  Pago ${añoActual}: 
  <span class="${p.pagos?.[añoActual] ? "pago-ok" : "pago-pendiente"}">
    ${p.pagos?.[añoActual] ? "💳 Pagado" : "❌ Pendiente"}
  </span>
</div>
 <button class="btn-estado" onclick="toggleActivo('${p.nombreCompleto}', '${p.direccionCompleta}', ${p.activo})">
  Cambiar estado
</button>

<button class="btn-pago" onclick="togglePago('${p.nombreCompleto}', '${p.direccionCompleta}', ${p.pagos?.[añoActual] ? true : false})">
  Marcar pago
</button> 
<button class="btn-eliminar" onclick="eliminarPersona('${p.nombreCompleto}', '${p.direccionCompleta}')">
  🗑️ Eliminar
</button>
`;  

    contenedor.appendChild(div);
  });
}
function toggleActivo(nombreCompleto, direccionCompleta, estadoActual) {

  db.collection("personas")
    .where("nombreCompleto", "==", nombreCompleto)
    .where("direccionCompleta", "==", direccionCompleta)
    .get()
    .then(snapshot => {
      snapshot.forEach(doc => {
        db.collection("personas").doc(doc.id).update({
          activo: !estadoActual
        })
        .then(() => {
          cargarPersonas();
        });
      });
    });
}

function togglePago(nombreCompleto, direccionCompleta, estadoActual) {

  db.collection("personas")
    .where("nombreCompleto", "==", nombreCompleto)
    .where("direccionCompleta", "==", direccionCompleta)
    .get()
    .then(snapshot => {
      snapshot.forEach(doc => {

        const nuevoEstado = !estadoActual;

        db.collection("personas").doc(doc.id).update({
          [`pagos.${añoActual}`]: nuevoEstado
        })
        .then(() => {
          console.log("Pago actualizado");
          cargarPersonas();
        });

      });
    });
}
function verPendientes() {
  const pendientes = todasLasPersonas.filter(p =>
    !p.pagos?.[añoActual]
  );

  mostrarPersonas(pendientes);
}
function eliminarPersona(nombreCompleto, direccionCompleta) {

  if (!confirm("¿Seguro que quieres eliminar esta persona?")) return;

  db.collection("personas")
    .where("nombreCompleto", "==", nombreCompleto)
    .where("direccionCompleta", "==", direccionCompleta)
    .get()
    .then(snapshot => {
      snapshot.forEach(doc => {
        db.collection("personas").doc(doc.id).delete()
          .then(() => {
            console.log("🗑️ Eliminado");
            cargarPersonas();
          });
      });
    });
}
function actualizarResumen(personas) {

  const total = personas.length;

  const pagados = personas.filter(p => p.pagos?.[añoActual]).length;

  const pendientes = total - pagados;

  const div = document.getElementById("resumen");

  div.innerHTML = `
    <span class="total">👥 Total: ${total}</span>
    <span class="pagados">💳 Pagados: ${pagados}</span>
    <span class="pendientes">❌ Pendientes: ${pendientes}</span>
  `;
}
function verPendientes() {

  const pendientes = todasLasPersonas.filter(p => {
    return !p.pagos || !p.pagos[añoActual];
  });

  mostrarPersonas(pendientes);
}
function verTodos() {
  mostrarPersonas(todasLasPersonas);
}
window.añadirPersona = function () {

  const nombre = document.getElementById("nombre").value.trim();
  const apellido1 = document.getElementById("apellido1").value.trim();
  const apellido2 = document.getElementById("apellido2").value.trim();
  const direccion = document.getElementById("direccion").value.trim();
  const poblacion = document.getElementById("poblacion").value.trim();
  const provincia = document.getElementById("provincia").value.trim();
  const codigoPostal = document.getElementById("cp").value.trim();
  const fechaNacimiento = document.getElementById("fecha").value.trim();

  // 🔴 VALIDACIÓN
  if (!nombre || !apellido1) {
    alert("Nombre y apellido son obligatorios");
    return;
  }

  const apellidos = `${apellido1} ${apellido2}`.trim();

  const persona = {
    nombre,
    apellidos,
    nombreCompleto: `${apellidos}, ${nombre}`,
    direccionCompleta: direccion,
    poblacion,
    provincia,
    codigoPostal,
    fechaNacimiento,
    activo: true,
    pagos: {}
  };

  db.collection("personas").add(persona)
    .then(() => {
      console.log("✔️ Persona añadida");

      limpiarFormulario();
      cargarPersonas();
    })
    .catch(err => console.error(err));
};
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
// 🔹 CARGAR DESDE FIREBASE
function cargarPersonas() {
  db.collection("personas").get()
    .then(snapshot => {
      const personas = snapshot.docs.map(doc => doc.data());

      todasLasPersonas = personas;

      mostrarPersonas(personas);
      console.log("📥 Datos cargados desde Firebase");
    })
    .catch(error => {
      console.error("❌ Error cargando:", error);
    });
}


// 🔍 BUSCADOR
function buscarPersonas(texto) {
  const filtro = texto.toLowerCase();

  const filtradas = todasLasPersonas.filter(p =>
    (p.nombreCompleto && p.nombreCompleto.toLowerCase().includes(filtro)) ||
    (p.direccionCompleta && p.direccionCompleta.toLowerCase().includes(filtro))
  );

  mostrarPersonas(filtradas);
}


// 🔹 AL CARGAR LA WEB
window.onload = function () {
  console.log("DOM cargado");

  cargarPersonas();

  const buscador = document.getElementById("buscador");

  if (!buscador) {
    console.log("❌ No encuentra el input buscador");
    return;
  }

  buscador.addEventListener("input", (e) => {
    buscarPersonas(e.target.value);
  });
};
