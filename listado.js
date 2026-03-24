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