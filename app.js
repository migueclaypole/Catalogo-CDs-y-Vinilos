(() => {
  "use strict";

  const STORAGE_KEY = "catalogo-cds-vinilos";
  const fields = ["IDInterno", "NúmeroOrden", "Artista", "Título", "Año", "Género", "Subgénero", "Discográfica", "Edición", "Formato", "Repetido", "Motivo", "Portada"];
  const form = document.getElementById("album-form");
  const tabs = Array.from(document.querySelectorAll(".tab"));
  const panels = Array.from(document.querySelectorAll('[role="tabpanel"]'));
  const rows = document.getElementById("collection-body");
  const emptyState = document.getElementById("empty-state");
  const emptyMessage = document.getElementById("empty-message");
  const idInput = document.getElementById("internal-id");
  const orderInput = form.elements["NúmeroOrden"];
  const duplicateSelect = document.getElementById("duplicate-select");
  const reasonSelect = document.getElementById("reason-select");
  const coverUrl = document.getElementById("cover-url");
  const coverPreview = document.getElementById("cover-preview");
  const coverImage = document.getElementById("cover-image");
  const coverModal = document.getElementById("cover-modal");
  const coverModalImage = document.getElementById("cover-modal-image");
  const coverModalClose = document.getElementById("cover-modal-close");
  const message = document.getElementById("form-message");
  const collectionMessage = document.getElementById("collection-message");
  const searchInput = document.getElementById("collection-search");
  const cancelEditButton = document.getElementById("cancel-edit-button");
  const deleteEditButton = document.getElementById("delete-edit-button");
  const saveButton = document.getElementById("save-button");
  const formTitle = document.getElementById("form-title");
  const formEyebrow = document.getElementById("form-eyebrow");
  const individualVariable = document.getElementById("individual-variable");
  const crossVariableOne = document.getElementById("cross-variable-one");
  const crossVariableTwo = document.getElementById("cross-variable-two");
  let albums = loadAlbums();
  let editingId = null;
  let coverModalTrigger = null;

  function loadAlbums() {
    try {
      const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
      return Array.isArray(saved) ? saved.filter((album) => album && typeof album === "object") : [];
    } catch (error) {
      console.error("No se pudo leer la colección guardada.", error);
      return [];
    }
  }

  function normalizeArtistArticle(value) {
    const match = String(value || "").trim().match(/^(The|La|Las|Los|El)\s+(.+)$/i);
    if (!match) return String(value || "").trim();
    return match[2].trim() + ", " + match[1];
  }

  function openCoverModal(image) {
    coverModalTrigger = image;
    coverModalImage.src = image.src;
    coverModalImage.alt = image.alt;
    coverModal.hidden = false;
    coverModal.setAttribute("aria-hidden", "false");
    coverModalClose.focus();
  }

  function closeCoverModal() {
    coverModal.hidden = true;
    coverModal.setAttribute("aria-hidden", "true");
    coverModalImage.removeAttribute("src");
    if (coverModalTrigger && coverModalTrigger.isConnected) coverModalTrigger.focus();
    coverModalTrigger = null;
  }

  function persistCollection(collection) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(collection));
  }

  function nextId(collection = albums) {
    const maxId = collection.reduce((max, album) => {
      const match = String(album.IDInterno || "").match(/^ALB-(\d+)$/i);
      return match ? Math.max(max, Number(match[1])) : max;
    }, 0);
    return "ALB-" + String(maxId + 1).padStart(4, "0");
  }

  function parseDate(value) {
    const match = String(value || "").match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
    if (!match) return null;
    const day = Number(match[1]);
    const month = Number(match[2]);
    const year = Number(match[3]);
    const date = new Date(0);
    date.setUTCHours(0, 0, 0, 0);
    date.setUTCFullYear(year, month - 1, day);
    if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) return null;
    return date.getTime();
  }

  function sortedAlbums(collection) {
    return collection.map((album, index) => ({ album, index })).sort((left, right) => {
      const artistOrder = String(left.album.Artista || "").localeCompare(String(right.album.Artista || ""), "es", { sensitivity: "base" });
      if (artistOrder !== 0) return artistOrder;
      const leftDate = parseDate(left.album.Año);
      const rightDate = parseDate(right.album.Año);
      if (leftDate !== null && rightDate !== null && leftDate !== rightDate) return leftDate - rightDate;
      if (leftDate !== null && rightDate === null) return -1;
      if (leftDate === null && rightDate !== null) return 1;
      return left.index - right.index;
    }).map((entry) => entry.album);
  }

  function reindexAlbums(collection) {
    return sortedAlbums(collection).map((album, index) => ({
      ...album,
      "NúmeroOrden": String(index + 1).padStart(3, "0")
    }));
  }

  function updateOrderPreview() {
    const artist = form.elements["Artista"].value.trim();
    if (!artist && editingId === null) {
      orderInput.value = "Automático";
      return;
    }

    const draft = Object.fromEntries(new FormData(form).entries());
    const collection = editingId === null
      ? albums
      : albums.filter((album) => String(album.IDInterno) !== editingId);
    const ordered = sortedAlbums(collection.concat(draft));
    orderInput.value = String(ordered.indexOf(draft) + 1).padStart(3, "0");
  }

  function showTab(tabId) {
    tabs.forEach((tab) => {
      const selected = tab.id === tabId;
      tab.classList.toggle("active", selected);
      tab.setAttribute("aria-selected", String(selected));
    });
    panels.forEach((panel) => {
      panel.hidden = panel.id !== document.getElementById(tabId).getAttribute("aria-controls");
    });
    if (tabId === "add-tab") {
      if (editingId === null) idInput.value = nextId();
      updateOrderPreview();
    }
  }

  function makeTextCell(value, className = "") {
    const cell = document.createElement("td");
    cell.textContent = value || "—";
    if (className) cell.className = className;
    return cell;
  }

  function renderRow(album) {
    const row = document.createElement("tr");
    row.className = "album-row";
    row.dataset.albumId = album.IDInterno;
    row.tabIndex = 0;
    row.setAttribute("aria-label", "Abrir " + (album.Título || "álbum") + " de " + (album.Artista || "artista desconocido") + " para editar o eliminar");
    row.title = "Seleccionar para editar o eliminar";
    row.appendChild(makeTextCell(album["NúmeroOrden"]));

    const coverCell = document.createElement("td");
    if (album.Portada) {
      const image = document.createElement("img");
      image.className = "table-cover";
      image.src = album.Portada;
      image.alt = "Portada de " + (album.Título || album.Artista || "álbum");
      image.tabIndex = 0;
      image.setAttribute("role", "button");
      image.setAttribute("aria-label", "Ampliar portada de " + (album.Título || album.Artista || "álbum"));
      image.loading = "lazy";
      image.addEventListener("error", () => {
        image.remove();
        coverCell.textContent = "—";
      }, { once: true });
      coverCell.appendChild(image);
    } else {
      coverCell.textContent = "—";
    }
    row.appendChild(coverCell);

    ["Artista", "Título", "Año", "Género", "Subgénero", "Discográfica", "Edición", "Formato", "Repetido", "Motivo"].forEach((field) => {
      const className = field === "Título" ? "album-cell album-title-cell" : field === "Artista" ? "album-cell" : "";
      row.appendChild(makeTextCell(album[field], className));
    });

    return row;
  }

  function updateCollection() {
    rows.replaceChildren();
    const query = searchInput.value.trim().toLocaleLowerCase("es");
    const visibleAlbums = sortedAlbums(albums).filter((album) => {
      if (!query) return true;
      return [album.Artista, album.Título, album["NúmeroOrden"]]
        .some((value) => String(value || "").toLocaleLowerCase("es").includes(query));
    });
    visibleAlbums.forEach((album) => rows.appendChild(renderRow(album)));

    const count = albums.length;
    document.getElementById("album-count").textContent = count;
    emptyState.hidden = visibleAlbums.length > 0;
    document.getElementById("empty-add-button").hidden = count > 0;
    if (count === 0) {
      emptyMessage.textContent = "Agrega tu primer álbum para verlo en esta lista.";
    } else if (visibleAlbums.length === 0) {
      emptyMessage.textContent = "No se encontraron álbumes para esa búsqueda.";
    }
    renderStatistics();
  }

  function categoryFor(album, variable) {
    if (variable === "Año" || variable === "Década") {
      const match = String(album.Año || "").match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
      if (!match || parseDate(album.Año) === null) return "Sin dato";
      const year = Number(match[3]);
      if (variable === "Año") return String(year);
      if (year < 1950) return "Antes de 1950";
      const decade = 1950 + Math.floor((year - 1950) / 10) * 10;
      return decade + "-" + (decade + 9);
    }
    const value = String(album[variable] || "").trim();
    return value || "Sin dato";
  }

  function formatPercent(count, total) {
    const percent = total ? (count / total) * 100 : 0;
    return percent.toLocaleString("es", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + " %";
  }

  function renderIndividualStatistics() {
    const variable = individualVariable.value;
    const counts = new Map();
    albums.forEach((album) => {
      const category = categoryFor(album, variable);
      counts.set(category, (counts.get(category) || 0) + 1);
    });

    const body = document.getElementById("individual-stats-body");
    body.replaceChildren();
    document.getElementById("individual-name-heading").textContent = variable;
    Array.from(counts.entries())
      .sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0], "es", { sensitivity: "base" }))
      .forEach(([category, count]) => {
        const row = document.createElement("tr");
        const name = document.createElement("th");
        name.scope = "row";
        name.textContent = category;
        const quantity = document.createElement("td");
        quantity.textContent = String(count);
        const percentage = document.createElement("td");
        percentage.textContent = formatPercent(count, albums.length);
        row.append(name, quantity, percentage);
        body.appendChild(row);
      });

    document.getElementById("individual-total-count").textContent = String(albums.length);
    document.getElementById("individual-total-percent").textContent = formatPercent(albums.length, albums.length);
    document.getElementById("individual-stats-empty").hidden = albums.length > 0;
  }

  function renderCrossStatistics() {
    const rowVariable = crossVariableOne.value;
    const columnVariable = crossVariableTwo.value;
    const matrix = new Map();
    const rowTotals = new Map();
    const columnTotals = new Map();

    albums.forEach((album) => {
      const rowCategory = categoryFor(album, rowVariable);
      const columnCategory = categoryFor(album, columnVariable);
      if (!matrix.has(rowCategory)) matrix.set(rowCategory, new Map());
      const row = matrix.get(rowCategory);
      row.set(columnCategory, (row.get(columnCategory) || 0) + 1);
      rowTotals.set(rowCategory, (rowTotals.get(rowCategory) || 0) + 1);
      columnTotals.set(columnCategory, (columnTotals.get(columnCategory) || 0) + 1);
    });

    const byCountThenName = (totals) => (left, right) =>
      totals.get(right) - totals.get(left) || left.localeCompare(right, "es", { sensitivity: "base" });
    const rowCategories = Array.from(rowTotals.keys()).sort(byCountThenName(rowTotals));
    const columnCategories = Array.from(columnTotals.keys()).sort(byCountThenName(columnTotals));
    const head = document.getElementById("cross-stats-head");
    const body = document.getElementById("cross-stats-body");
    const foot = document.getElementById("cross-stats-foot");
    head.replaceChildren();
    body.replaceChildren();
    foot.replaceChildren();

    const headerRow = document.createElement("tr");
    const rowHeader = document.createElement("th");
    rowHeader.scope = "col";
    rowHeader.textContent = rowVariable + " / " + columnVariable;
    headerRow.appendChild(rowHeader);
    columnCategories.forEach((category) => {
      const header = document.createElement("th");
      header.scope = "col";
      header.textContent = category;
      headerRow.appendChild(header);
    });
    const totalHeader = document.createElement("th");
    totalHeader.scope = "col";
    totalHeader.textContent = "Total";
    headerRow.appendChild(totalHeader);
    head.appendChild(headerRow);

    rowCategories.forEach((category) => {
      const row = document.createElement("tr");
      const label = document.createElement("th");
      label.scope = "row";
      label.textContent = category;
      row.appendChild(label);
      columnCategories.forEach((column) => {
        const cell = document.createElement("td");
        cell.textContent = String(matrix.get(category).get(column) || 0);
        row.appendChild(cell);
      });
      const total = document.createElement("td");
      total.textContent = String(rowTotals.get(category));
      row.appendChild(total);
      body.appendChild(row);
    });

    const totalRow = document.createElement("tr");
    const totalLabel = document.createElement("th");
    totalLabel.scope = "row";
    totalLabel.textContent = "Total";
    totalRow.appendChild(totalLabel);
    columnCategories.forEach((category) => {
      const cell = document.createElement("td");
      cell.textContent = String(columnTotals.get(category));
      totalRow.appendChild(cell);
    });
    const grandTotal = document.createElement("td");
    grandTotal.textContent = String(albums.length);
    totalRow.appendChild(grandTotal);
    foot.appendChild(totalRow);
  }

  function renderStatistics() {
    renderIndividualStatistics();
    renderCrossStatistics();
  }

  function syncReasonField() {
    reasonSelect.disabled = duplicateSelect.value !== "Sí";
    if (reasonSelect.disabled) reasonSelect.value = "";
  }

  function resetForm() {
    form.reset();
    editingId = null;
    reasonSelect.disabled = true;
    idInput.value = nextId();
    updateOrderPreview();
    coverPreview.hidden = true;
    coverImage.removeAttribute("src");
    formEyebrow.textContent = "NUEVO REGISTRO";
    formTitle.textContent = "Agregar Album";
    saveButton.innerHTML = 'Guardar álbum <span aria-hidden="true">→</span>';
    cancelEditButton.hidden = true;
    deleteEditButton.hidden = true;
  }

  function beginEdit(id) {
    const album = albums.find((entry) => String(entry.IDInterno) === id);
    if (!album) return;
    showTab("add-tab");
    editingId = id;
    fields.forEach((field) => {
      if (form.elements[field]) form.elements[field].value = album[field] || "";
    });
    idInput.value = album.IDInterno;
    duplicateSelect.value = album.Repetido || "No";
    reasonSelect.disabled = duplicateSelect.value !== "Sí";
    formEyebrow.textContent = "EDITAR REGISTRO";
    formTitle.textContent = "Editar Album";
    saveButton.textContent = "Actualizar";
    cancelEditButton.hidden = false;
    deleteEditButton.hidden = false;
    message.textContent = "";
    coverImage.src = album.Portada || "";
    coverPreview.hidden = !album.Portada;
    if (album.Portada) coverImage.onerror = () => { coverPreview.hidden = true; };
    updateOrderPreview();
  }

  tabs.forEach((tab) => tab.addEventListener("click", () => showTab(tab.id)));
  document.getElementById("empty-add-button").addEventListener("click", () => showTab("add-tab"));
  searchInput.addEventListener("input", updateCollection);
  individualVariable.addEventListener("change", renderIndividualStatistics);
  crossVariableOne.addEventListener("change", renderCrossStatistics);
  crossVariableTwo.addEventListener("change", renderCrossStatistics);

  duplicateSelect.addEventListener("change", syncReasonField);
  form.elements["Artista"].addEventListener("input", updateOrderPreview);
  form.elements["Año"].addEventListener("input", updateOrderPreview);
  form.elements["Artista"].addEventListener("blur", (event) => {
    event.target.value = normalizeArtistArticle(event.target.value);
    updateOrderPreview();
  });

  coverUrl.addEventListener("input", () => {
    const value = coverUrl.value.trim();
    if (!value) {
      coverImage.removeAttribute("src");
      coverPreview.hidden = true;
      return;
    }
    coverImage.src = value;
  });
  coverImage.addEventListener("load", () => { coverPreview.hidden = false; });
  coverImage.addEventListener("error", () => { coverPreview.hidden = true; });

  form.addEventListener("submit", (event) => {
    event.preventDefault();
    form.elements["Artista"].value = normalizeArtistArticle(form.elements["Artista"].value);
    if (!form.reportValidity()) return;
    const album = Object.fromEntries(new FormData(form).entries());
    album.Repetido = duplicateSelect.value;
    if (album.Repetido !== "Sí") album.Motivo = "";

    const wasEditing = editingId !== null;
    let updatedAlbums;
    if (wasEditing) {
      updatedAlbums = albums.map((entry) => String(entry.IDInterno) === editingId ? album : entry);
    } else {
      album.IDInterno = nextId();
      updatedAlbums = albums.concat(album);
    }
    updatedAlbums = reindexAlbums(updatedAlbums);
    try {
      persistCollection(updatedAlbums);
      albums = updatedAlbums;
    } catch (error) {
      message.textContent = "No se pudo guardar el álbum en este dispositivo.";
      console.error("No se pudo guardar la colección.", error);
      return;
    }

    resetForm();
    message.textContent = wasEditing ? "Cambios guardados." : "Álbum guardado en tu colección.";
    updateCollection();
  });

  cancelEditButton.addEventListener("click", () => {
    resetForm();
    message.textContent = "Edición cancelada.";
  });

  function deleteAlbum(id) {
    const album = albums.find((entry) => String(entry.IDInterno) === id);
    if (!album || !window.confirm("¿Eliminar " + (album.Título || "este álbum") + " de la colección?")) return;
    const wasEditing = editingId === id;
    const updatedAlbums = reindexAlbums(albums.filter((entry) => String(entry.IDInterno) !== id));
    try {
      persistCollection(updatedAlbums);
      albums = updatedAlbums;
      if (wasEditing) resetForm();
      else if (editingId === null) idInput.value = nextId();
      updateOrderPreview();
      collectionMessage.textContent = "Álbum eliminado.";
      if (wasEditing) message.textContent = "Álbum eliminado.";
      updateCollection();
    } catch (error) {
      if (wasEditing) message.textContent = "No se pudo eliminar el álbum.";
      else collectionMessage.textContent = "No se pudo eliminar el álbum.";
      console.error("No se pudo actualizar la colección.", error);
    }
  }

  rows.addEventListener("click", (event) => {
    const row = event.target.closest("tr[data-album-id]");
    if (!row || !rows.contains(row)) return;
    const cover = event.target.closest(".table-cover");
    if (cover) {
      event.preventDefault();
      event.stopPropagation();
      openCoverModal(cover);
      return;
    }
    beginEdit(row.dataset.albumId);
  });
  rows.addEventListener("keydown", (event) => {
    if (event.key !== "Enter" && event.key !== " ") return;
    const cover = event.target.closest(".table-cover");
    if (cover) {
      event.preventDefault();
      event.stopPropagation();
      openCoverModal(cover);
      return;
    }
    const row = event.target.closest("tr[data-album-id]");
    if (!row || !rows.contains(row)) return;
    event.preventDefault();
    beginEdit(row.dataset.albumId);
  });
  coverModalClose.addEventListener("click", closeCoverModal);
  coverModal.addEventListener("click", (event) => {
    if (event.target === coverModal) closeCoverModal();
  });
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && !coverModal.hidden) closeCoverModal();
  });
  deleteEditButton.addEventListener("click", () => {
    if (editingId !== null) deleteAlbum(editingId);
  });

  function csvEscape(value) {
    return '"' + String(value ?? "").replace(/"/g, '""') + '"';
  }

  document.getElementById("export-button").addEventListener("click", () => {
    const separator = ";";
    const csv = [fields.map(csvEscape).join(separator), ...sortedAlbums(albums).map((album) => fields.map((field) => csvEscape(album[field] || "")).join(separator))].join("\r\n");
    downloadFile("\uFEFF" + csv, "text/csv;charset=utf-8", "catalogo-cds-vinilos.csv");
  });

  function downloadFile(content, type, filename) {
    const blob = new Blob([content], { type });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  document.getElementById("export-json-button").addEventListener("click", () => {
    const backup = {
      app: "Catálogo de CDs y Vinilos",
      version: 1,
      exportedAt: new Date().toISOString(),
      albums: sortedAlbums(albums)
    };
    downloadFile(JSON.stringify(backup, null, 2), "application/json;charset=utf-8", "respaldo-catalogo-cds-vinilos.json");
  });

  function detectSeparator(text) {
    let quoted = false;
    let semicolons = 0;
    let commas = 0;
    let tabs = 0;
    for (let index = 0; index < text.length; index++) {
      const char = text[index];
      if (quoted && char === '"' && text[index + 1] === '"') index++;
      else if (char === '"') quoted = !quoted;
      else if (!quoted && char === ";") semicolons++;
      else if (!quoted && char === ",") commas++;
      else if (!quoted && char === "\t") tabs++;
      else if (!quoted && (char === "\n" || char === "\r")) break;
    }
    const separators = [
      { character: ";", count: semicolons },
      { character: ",", count: commas },
      { character: "\t", count: tabs }
    ];
    separators.sort((left, right) => right.count - left.count);
    return separators[0].count > 0 ? separators[0].character : ";";
  }

  function normalizeCsvHeader(header) {
    return String(header || "")
      .replace(/[\u0000-\u001F\u007F-\u009F\u200B-\u200F\u202A-\u202E\u2060\uFEFF]/g, "")
      .replace(/["']/g, "")
      .trim()
      .replace(/\s+/g, " ")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLocaleLowerCase("es")
      .replace(/[^a-z0-9]/g, "");
  }

  const fieldByHeader = new Map(fields.map((field) => [normalizeCsvHeader(field), field]));

  function parseCsv(text, separator) {
    const records = [];
    let record = [];
    let value = "";
    let quoted = false;
    let quoteClosed = false;

    function finishRecord() {
      record.push(value);
      if (record.some((item) => item !== "")) records.push(record);
      record = [];
      value = "";
      quoteClosed = false;
    }

    for (let index = 0; index < text.length; index++) {
      const char = text[index];
      if (quoted) {
        if (char === '"' && text[index + 1] === '"') {
          value += '"';
          index++;
        } else if (char === '"') {
          quoted = false;
          quoteClosed = true;
        } else {
          value += char;
        }
      } else if (quoteClosed) {
        if (char === separator) {
          record.push(value);
          value = "";
          quoteClosed = false;
        } else if (char === "\n" || char === "\r") {
          finishRecord();
          if (char === "\r" && text[index + 1] === "\n") index++;
        } else if (!/\s/.test(char)) {
          throw new Error("El archivo CSV contiene texto después de un campo entre comillas.");
        }
      } else if (char === '"') {
        if (value.trim() !== "") throw new Error("El archivo CSV contiene comillas fuera de lugar.");
        value = "";
        quoted = true;
      } else if (char === separator) {
        record.push(value);
        value = "";
      } else if (char === "\n" || char === "\r") {
        finishRecord();
        if (char === "\r" && text[index + 1] === "\n") index++;
      } else {
        value += char;
      }
    }
    if (quoted) throw new Error("El archivo CSV contiene comillas sin cerrar.");
    if (value !== "" || record.length || quoteClosed) finishRecord();
    return records;
  }

  document.getElementById("import-button").addEventListener("click", () => document.getElementById("import-file").click());
  document.getElementById("import-file").addEventListener("change", async (event) => {
    const file = event.target.files[0];
    if (!file) return;
    try {
      const text = (await file.text()).replace(/^\uFEFF+/, "");
      const trimmedText = text.trimStart();
      const isJson = /\.json$/i.test(file.name) || trimmedText.startsWith("{") || trimmedText.startsWith("[");
      let importedRecords;

      if (isJson) {
        const backup = JSON.parse(text);
        importedRecords = Array.isArray(backup) ? backup : backup && backup.albums;
        if (!Array.isArray(importedRecords)) {
          throw new Error("El respaldo JSON debe contener una lista de álbumes.");
        }
      } else {
        let csvText = text;
        const separatorDirective = csvText.match(/^sep=(;|,|\t)(?:\r\n|\n|\r)/i);
        let separator;
        if (separatorDirective) {
          separator = separatorDirective[1];
          csvText = csvText.slice(separatorDirective[0].length);
        } else {
          separator = detectSeparator(csvText);
        }

        const records = parseCsv(csvText, separator);
        if (!records.length) throw new Error("El archivo no contiene datos.");
        const rawHeaders = records.shift();
        while (rawHeaders.length && !normalizeCsvHeader(rawHeaders[rawHeaders.length - 1])) rawHeaders.pop();

        const headerFields = rawHeaders.map((header) => fieldByHeader.get(normalizeCsvHeader(header)) || "");
        const requiredFields = fields.filter((field) => field !== "IDInterno" && field !== "NúmeroOrden");
        const presentFields = new Set(headerFields);
        const missingFields = requiredFields.filter((field) => !presentFields.has(field));
        if (missingFields.length) {
          throw new Error("Faltan columnas requeridas: " + missingFields.join(", ") + ".");
        }
        const recognizedHeaders = headerFields.filter(Boolean);
        if (new Set(recognizedHeaders).size !== recognizedHeaders.length) {
          throw new Error("El CSV contiene encabezados duplicados.");
        }

        importedRecords = records.map((record, rowIndex) => {
          while (record.length > rawHeaders.length && record[record.length - 1] === "") record.pop();
          if (record.length > rawHeaders.length) {
            throw new Error("La fila " + (rowIndex + 2) + " tiene más columnas de las indicadas en el encabezado.");
          }
          while (record.length < rawHeaders.length) record.push("");
          const album = {};
          headerFields.forEach((field, index) => {
            if (field) album[field] = record[index];
          });
          return album;
        });
      }

      const updatedAlbums = albums.slice();
      const importedIds = new Set();
      importedRecords.forEach((record) => {
        if (!record || typeof record !== "object" || Array.isArray(record)) {
          throw new Error("El respaldo contiene un álbum con formato inválido.");
        }
        const album = Object.fromEntries(fields.map((field) => [field, String(record[field] ?? "")]));
        if (album.Repetido !== "Sí") album.Motivo = "";
        const importedId = album.IDInterno.trim();
        if (importedId) {
          const idKey = importedId.toLocaleUpperCase();
          if (importedIds.has(idKey)) throw new Error("El archivo repite el IDInterno " + importedId + ".");
          importedIds.add(idKey);
          album.IDInterno = importedId;
          const existingIndex = updatedAlbums.findIndex((entry) => String(entry.IDInterno || "").toLocaleUpperCase() === idKey);
          if (existingIndex < 0) updatedAlbums.push(album);
          else updatedAlbums[existingIndex] = album;
        } else {
          album.IDInterno = nextId(updatedAlbums);
          updatedAlbums.push(album);
        }
      });

      const orderedAlbums = reindexAlbums(updatedAlbums);
      persistCollection(orderedAlbums);
      albums = orderedAlbums;
      collectionMessage.textContent = importedRecords.length + (importedRecords.length === 1 ? " álbum importado." : " álbumes importados.");
      if (editingId === null) idInput.value = nextId();
      updateOrderPreview();
      updateCollection();
    } catch (error) {
      collectionMessage.textContent = "No se pudo importar el archivo: " + error.message;
      console.error("No se pudo importar el archivo de respaldo.", error);
    } finally {
      event.target.value = "";
    }
  });

  const initialAlbums = reindexAlbums(albums);
  if (JSON.stringify(initialAlbums) !== JSON.stringify(albums)) {
    try {
      persistCollection(initialAlbums);
    } catch (error) {
      console.error("No se pudo actualizar el orden de la colección guardada.", error);
    }
    albums = initialAlbums;
  }
  updateCollection();
  idInput.value = nextId();
  updateOrderPreview();
})();

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("./sw.js").catch((error) => {
      console.error("No se pudo registrar el Service Worker de la aplicación.", error);
    });
  });
}
