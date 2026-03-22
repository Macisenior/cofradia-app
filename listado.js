window.volver = function () {
  window.location.href = "index.html";
};


window.onload = function () {
  db.collection("personas").get().then(snapshot => {
    todasLasPersonas = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));
  });
};

// 🔥 FUNCIÓN PRINCIPAL
window.generarPDFListado = function () {

  const orden = document.getElementById("ordenListado").value;

  let lista = [...todasLasPersonas];

  // 👉 AGRUPADO POR CALLE
  if (orden === "calle") {
    generarListadoAgrupado(lista);
    return;
  }

  // 🔀 ORDEN NORMAL
  lista.sort((a, b) => {

    if (orden === "nombre") {
      return (a.nombreCompleto || "").localeCompare(b.nombreCompleto || "");
    }

    if (orden === "poblacion") {
      return (a.poblacion || "").localeCompare(b.poblacion || "");
    }

    if (orden === "edad") {
      return calcularEdad(a.fechaNacimiento) - calcularEdad(b.fechaNacimiento);
    }

    return 0;
  });

  generarListadoSimple(lista);
};

// 🔥 EDAD
function calcularEdad(fecha) {
  if (!fecha) return "";

  const nacimiento = new Date(fecha);
  if (isNaN(nacimiento)) return "";

  const hoy = new Date();
  let edad = hoy.getFullYear() - nacimiento.getFullYear();
  const mes = hoy.getMonth() - nacimiento.getMonth();

  if (mes < 0 || (mes === 0 && hoy.getDate() < nacimiento.getDate())) {
    edad--;
  }

  return edad;
}
function formatearFecha(fecha) {

  if (!fecha) return "";

  // 🔹 Firestore timestamp
  if (fecha.seconds) {
    return new Date(fecha.seconds * 1000).toLocaleDateString();
  }

  // 🔹 string tipo "yyyy-mm-dd"
  if (typeof fecha === "string") {

    // si ya viene bien
    const f = new Date(fecha);
    if (!isNaN(f)) return f.toLocaleDateString();

    // 🔥 formato español dd/mm/yyyy
    const partes = fecha.split("/");
    if (partes.length === 3) {
      return `${partes[0]}/${partes[1]}/${partes[2]}`;
    }
  }

  return "";
}
// 🔥 LISTADO SIMPLE
function generarListadoSimple(lista) {

  let html = `
  <html>
  <head>
    <style>
      body { font-family: Arial; padding: 20px; }
      h1 { text-align: center; }

      table {
        width: 100%;
        border-collapse: collapse;
      }

      th, td {
        border: 1px solid #000;
        padding: 6px;
        font-size: 12px;
      }

      th { background: #eee; }

    </style>
  </head>
  <body>

  <h1>Listado de Personas</h1>

  <table>
    <tr>
      <th>Nombre</th>
      <th>Dirección</th>
      <th>Población</th>
      <th>Edad</th>
    </tr>
  `;

  lista.forEach(p => {
    html += `
      <tr>
        <td>${p.nombreCompleto || ""}</td>
        <td>${p.direccionCompleta || ""}</td>
        <td>${p.poblacion || ""}</td>
        <td>${calcularEdad(p.fechaNacimiento)}</td>
      </tr>
    `;
  });

  html += `
  </table>
  </body>
  </html>
  `;

 abrirPDF(lista);
}

// 🔥 LISTADO AGRUPADO
function generarListadoAgrupado(lista) {

  const grupos = {};

  lista.forEach(p => {
    const calle = p.direccionCompleta || "SIN DIRECCIÓN";

    if (!grupos[calle]) grupos[calle] = [];
    grupos[calle].push(p);
  });

  let html = `
  <html>
  <head>
    <style>
      body { font-family: Arial; padding: 20px; }
      h1 { text-align: center; }
      h2 { margin-top: 25px; border-bottom: 2px solid #000; }

      table {
        width: 100%;
        border-collapse: collapse;
        margin-bottom: 10px;
      }

      th, td {
        border: 1px solid #000;
        padding: 6px;
        font-size: 12px;
      }

      th { background: #eee; }

      .total {
        font-weight: bold;
        margin-bottom: 20px;
      }

    </style>
  </head>
  <body>

  <h1>Listado de Personas</h1>
  <div class="total">Total: ${lista.length}</div>
  `;

  Object.keys(grupos).sort().forEach(calle => {

    html += `<h2>${calle}</h2>`;

    html += `
    <table>
      <tr>
        <th>Nombre</th>
        <th>Población</th>
        <th>Edad</th>
      </tr>
    `;

    grupos[calle].forEach(p => {
      html += `
        <tr>
          <td>${p.nombreCompleto || ""}</td>
          <td>${p.poblacion || ""}</td>
          <td>${calcularEdad(p.fechaNacimiento)}</td>
        </tr>
      `;
    });

    html += `</table>`;
  });

  html += `
  </body>
  </html>
  `;

 abrirPDF(lista);
}

// 🔥 ESTA ERA LA QUE FALTABA (EL ERROR)
function abrirPDF(lista) {

  const { jsPDF } = window.jspdf;
  const doc = new jsPDF();

  doc.setFontSize(16);
  doc.text("COFRADÍA SAN CRISTOBAL", 10, 15);

  doc.setFontSize(12);
  doc.text("Listado de Personas", 10, 22);

  const filas = lista.map(p => {
    return [
      p.nombreCompleto || "",
      p.direccionCompleta || "",
      p.poblacion || "",
      p.fechaNacimiento ?formatearFecha(p.fechaNacimiento)  : ""
    ];
  });

  doc.autoTable({
    head: [["Nombre", "Dirección", "Población", "Nacimiento"]],
    body: filas,
    startY: 30,
    styles: { fontSize: 8 }
  });

  doc.save("listado.pdf");
}