window.imprimirRecibos = function () {

  const precio = document.getElementById("precio")?.value || "";
  const fecha = new Date().toLocaleDateString("es-ES");

  const lista = (todasLasPersonas || [])
    .filter(p => p && p.nombreCompleto)
    .sort((a, b) =>
      (a.direccionCompleta || "").localeCompare(b.direccionCompleta || "")
    );

  let calleActual = "";

  let html = `
  <html>
  <head>
    <style>
      body {
        font-family: Arial;
        margin: 0;
      }

      .recibo {
        height: 99mm;
        border-bottom: 1px dashed #000;
        padding: 8mm;
        display: flex;
        justify-content: space-between;
      }

      .izq {
        width: 65%;
      }

      .der {
        width: 30%;
        text-align: center;
      }

      .nombre {
        font-weight: bold;
        font-size: 15px;
        margin-bottom: 6px;
      }

      .direccion {
        font-size: 13px;
      }

      .texto {
        margin-top: 10px;
        font-size: 13px;
      }

      .fecha {
        margin-top: 8px;
        font-size: 12px;
      }

      .logo {
        width: 70px;
      }

      .firma {
        width: 90px;
        margin-top: 15px;
        max-height: 60px;
        object-fit: contain;
      }

      .calle {
        font-weight: bold;
        font-size: 14px;
        margin: 10px 0;
      }
    </style>
  </head>
  <body>
  `;

  lista.forEach((p, i) => {

    const calle = (p.direccionCompleta || "").split(" ")[0];

    if (calle !== calleActual) {
      html += `<div class="calle">📍 ${p.direccionCompleta}</div>`;
      calleActual = calle;
    }

    html += `
      <div class="recibo">

        <div class="izq">
          <div class="nombre">${p.nombreCompleto}</div>

          <div class="direccion">${p.direccionCompleta || ""}</div>
          <div class="direccion">${p.codigoPostal || ""} ${p.poblacion || ""}</div>
          <div class="direccion">${p.provincia || ""}</div>

          <div class="texto">
            CUOTA ${new Date().getFullYear()} COFRADÍA SAN CRISTOBAL<br>
            CANTIDAD: ${precio ? precio + " €" : "________"}
          </div>

          <div class="fecha">
            Fecha: ${fecha}
          </div>

          <div class="texto">
            FIRMADO: ____________________
          </div>
        </div>

        <div class="der">
          <img src="logo.png" class="logo"><br>
          <img src="firma.png" class="firma">
        </div>

      </div>
    `;

  });

  html += `
  </body>
  </html>
  `;

  const win = window.open("", "_blank");
  win.document.write(html);
  win.document.close();
  win.print();
};