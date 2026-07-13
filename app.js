(() => {
  "use strict";

  const DB_NAME = "panckoAutomotorDB";
  const DB_VERSION = 1;
  const STORE_QUOTES = "quotes";
  const SETTINGS_KEY = "panckoAutomotorSettings";
  const DEFAULT_SETTINGS = {
    discountPct: 5,
    pabloPct: 46,
    marginPabloPct: 30,
    marginOwnPct: 30
  };

  const $ = (selector, parent = document) => parent.querySelector(selector);
  const $$ = (selector, parent = document) => [...parent.querySelectorAll(selector)];

  const state = {
    db: null,
    currentResult: null,
    editingId: null,
    deferredInstallPrompt: null,
    settings: loadSettings()
  };

  const els = {
    form: $("#quote-form"),
    client: $("#client"),
    reference: $("#reference"),
    formulaTotal: $("#formula-total"),
    contributionsList: $("#contributions-list"),
    ownTotalDisplay: $("#own-total-display"),
    discountPct: $("#discount-pct"),
    pabloPct: $("#pablo-pct"),
    marginPabloPct: $("#margin-pablo-pct"),
    marginOwnPct: $("#margin-own-pct"),
    formError: $("#form-error"),
    resultCard: $("#result-card"),
    resultPayPablo: $("#result-pay-pablo"),
    resultChargeClient: $("#result-charge-client"),
    resultDetails: $("#result-details"),
    btnToggleDetails: $("#btn-toggle-details"),
    detailPabloFormula: $("#detail-pablo-formula"),
    detailOwnFormula: $("#detail-own-formula"),
    detailOwnBase: $("#detail-own-base"),
    detailPabloSale: $("#detail-pablo-sale"),
    detailOwnSale: $("#detail-own-sale"),
    detailProfit: $("#detail-profit"),
    btnSave: $("#btn-save"),
    editingBanner: $("#editing-banner"),
    historySearch: $("#history-search"),
    historyList: $("#history-list"),
    historyEmpty: $("#history-empty"),
    historyCount: $("#history-count"),
    settingsDiscount: $("#settings-discount"),
    settingsPablo: $("#settings-pablo"),
    settingsMarginPablo: $("#settings-margin-pablo"),
    settingsMarginOwn: $("#settings-margin-own"),
    importFile: $("#import-file"),
    btnInstall: $("#btn-install"),
    toast: $("#toast")
  };

  document.addEventListener("DOMContentLoaded", init);

  async function init() {
    try {
      state.db = await openDatabase();
      bindEvents();
      applySettingsToForm();
      applySettingsToSettingsView();
      addContributionRow();
      updateOwnTotal();
      await renderHistory();
      registerServiceWorker();
      updateInstallButton();
    } catch (error) {
      console.error(error);
      showToast("No se pudo iniciar el almacenamiento local.");
    }
  }

  function bindEvents() {
    $$(".nav-item").forEach(button => {
      button.addEventListener("click", () => switchView(button.dataset.view));
    });

    $("#btn-add-contribution").addEventListener("click", () => addContributionRow());
    $("#btn-new").addEventListener("click", resetForm);
    $("#btn-new-top").addEventListener("click", resetForm);
    $("#btn-cancel-edit").addEventListener("click", resetForm);
    els.form.addEventListener("submit", handleCalculate);
    els.btnSave.addEventListener("click", saveCurrentQuote);
    els.btnToggleDetails.addEventListener("click", toggleResultDetails);

    els.contributionsList.addEventListener("input", event => {
      if (event.target.classList.contains("currency-input")) updateOwnTotal();
    });

    els.contributionsList.addEventListener("click", event => {
      const button = event.target.closest(".delete-contribution");
      if (!button) return;
      button.closest(".contribution-row").remove();
      if (!els.contributionsList.children.length) addContributionRow();
      updateOwnTotal();
    });

    document.addEventListener("blur", event => {
      if (event.target.classList?.contains("currency-input")) {
        formatCurrencyInput(event.target);
      }
    }, true);

    els.historySearch.addEventListener("input", renderHistory);

    els.historyList.addEventListener("click", async event => {
      const button = event.target.closest("button[data-action]");
      if (!button) return;
      const id = button.dataset.id;
      const action = button.dataset.action;

      if (action === "open") await openQuote(id, false);
      if (action === "duplicate") await openQuote(id, true);
      if (action === "delete") await deleteQuote(id);
    });

    $("#btn-save-settings").addEventListener("click", saveSettingsFromView);
    $("#btn-export").addEventListener("click", exportBackup);
    $("#btn-import").addEventListener("click", () => els.importFile.click());
    els.importFile.addEventListener("change", importBackup);
    $("#btn-clear-history").addEventListener("click", clearHistory);

    window.addEventListener("beforeinstallprompt", event => {
      event.preventDefault();
      state.deferredInstallPrompt = event;
      updateInstallButton();
    });

    window.addEventListener("appinstalled", () => {
      state.deferredInstallPrompt = null;
      showToast("Pancko Automotor quedó instalada.");
      updateInstallButton();
    });

    els.btnInstall.addEventListener("click", installApp);
  }

  function switchView(viewName) {
    $$(".view").forEach(view => view.classList.remove("is-active"));
    $$(".nav-item").forEach(button => button.classList.remove("is-active"));

    $(`#view-${viewName}`).classList.add("is-active");
    $(`.nav-item[data-view="${viewName}"]`).classList.add("is-active");

    if (viewName === "historial") renderHistory();
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function addContributionRow(contribution = {}) {
    const row = document.createElement("div");
    row.className = "contribution-row";
    row.innerHTML = `
      <input class="contribution-label" type="text" autocomplete="off" placeholder="Básico / nota (opcional)" value="${escapeHtml(contribution.label || "")}">
      <input class="currency-input contribution-amount" type="text" inputmode="decimal" autocomplete="off" placeholder="Importe" value="${contribution.amount ? formatNumberInput(contribution.amount) : ""}">
      <button class="delete-contribution" type="button" title="Eliminar aporte" aria-label="Eliminar aporte">🗑️</button>
    `;
    els.contributionsList.appendChild(row);
  }

  function getContributions() {
    return $$(".contribution-row", els.contributionsList)
      .map(row => ({
        label: $(".contribution-label", row).value.trim(),
        amount: parseArgNumber($(".contribution-amount", row).value)
      }))
      .filter(item => item.amount > 0 || item.label);
  }

  function updateOwnTotal() {
    const total = getContributions().reduce((sum, item) => sum + (item.amount || 0), 0);
    els.ownTotalDisplay.textContent = formatCurrency(total);
  }

  function handleCalculate(event) {
    event.preventDefault();
    clearError();

    const input = collectFormInput();
    const validation = validateInput(input);
    if (!validation.ok) {
      showError(validation.message);
      return;
    }

    state.currentResult = calculate(input);
    renderResult(state.currentResult);
  }

  function collectFormInput() {
    return {
      client: els.client.value.trim(),
      reference: els.reference.value.trim(),
      formulaTotal: parseArgNumber(els.formulaTotal.value),
      contributions: getContributions(),
      discountPct: numberOrZero(els.discountPct.value),
      pabloPct: numberOrZero(els.pabloPct.value),
      marginPabloPct: numberOrZero(els.marginPabloPct.value),
      marginOwnPct: numberOrZero(els.marginOwnPct.value)
    };
  }

  function validateInput(input) {
    const ownTotal = input.contributions.reduce((sum, item) => sum + item.amount, 0);

    if (!(input.formulaTotal > 0)) {
      return { ok: false, message: "Ingresá el total de la fórmula." };
    }
    if (ownTotal < 0) {
      return { ok: false, message: "Los aportes propios no pueden ser negativos." };
    }
    if (ownTotal > input.formulaTotal + 0.009) {
      return { ok: false, message: "El material puesto por nosotros no puede superar el total de la fórmula." };
    }
    if (input.discountPct < 0 || input.discountPct > 100) {
      return { ok: false, message: "El descuento debe estar entre 0% y 100%." };
    }
    if (input.pabloPct < 0 || input.pabloPct > 100) {
      return { ok: false, message: "El porcentaje para Pablo debe estar entre 0% y 100%." };
    }
    if (input.marginPabloPct < -100 || input.marginOwnPct < -100) {
      return { ok: false, message: "La ganancia no puede ser menor a -100%." };
    }
    return { ok: true };
  }

  function calculate(input) {
    const ownFormulaTotal = roundMoney(input.contributions.reduce((sum, item) => sum + item.amount, 0));
    const pabloFormulaTotal = roundMoney(input.formulaTotal - ownFormulaTotal);
    const quantityFactor = 1 - input.discountPct / 100;
    const pabloFactor = input.pabloPct / 100;

    const payPablo = roundMoney(pabloFormulaTotal * quantityFactor * pabloFactor);
    const ownBase = roundMoney(ownFormulaTotal * quantityFactor * pabloFactor);

    const pabloSale = roundMoney(payPablo * (1 + input.marginPabloPct / 100));
    const ownSale = roundMoney(ownBase * (1 + input.marginOwnPct / 100));
    const chargeClient = roundMoney(pabloSale + ownSale);
    const commercialProfit = roundMoney((pabloSale - payPablo) + (ownSale - ownBase));

    return {
      ...input,
      ownFormulaTotal,
      pabloFormulaTotal,
      quantityFactor,
      payPablo,
      ownBase,
      pabloSale,
      ownSale,
      chargeClient,
      commercialProfit
    };
  }

  function renderResult(result) {
    els.resultPayPablo.textContent = formatCurrency(result.payPablo);
    els.resultChargeClient.textContent = formatCurrency(result.chargeClient);
    els.detailPabloFormula.textContent = formatCurrency(result.pabloFormulaTotal);
    els.detailOwnFormula.textContent = formatCurrency(result.ownFormulaTotal);
    els.detailOwnBase.textContent = formatCurrency(result.ownBase);
    els.detailPabloSale.textContent = formatCurrency(result.pabloSale);
    els.detailOwnSale.textContent = formatCurrency(result.ownSale);
    els.detailProfit.textContent = formatCurrency(result.commercialProfit);

    els.resultCard.classList.remove("hidden");
    els.resultDetails.classList.add("hidden");
    els.btnToggleDetails.textContent = "Ver detalle";

    setTimeout(() => {
      els.resultCard.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 80);
  }

  function toggleResultDetails() {
    const hidden = els.resultDetails.classList.toggle("hidden");
    els.btnToggleDetails.textContent = hidden ? "Ver detalle" : "Ocultar detalle";
  }

  async function saveCurrentQuote() {
    if (!state.currentResult) {
      showToast("Primero calculá la operación.");
      return;
    }

    const now = new Date().toISOString();
    const previous = state.editingId ? await dbGet(state.editingId) : null;
    const quote = {
      id: state.editingId || makeId(),
      createdAt: previous?.createdAt || now,
      updatedAt: now,
      ...state.currentResult
    };

    await dbPut(quote);
    state.editingId = quote.id;
    els.editingBanner.classList.remove("hidden");
    els.btnSave.textContent = "💾 Actualizar cálculo";
    showToast(previous ? "Cálculo actualizado." : "Cálculo guardado.");
    await renderHistory();
  }

  async function openQuote(id, duplicate) {
    const quote = await dbGet(id);
    if (!quote) {
      showToast("No se encontró ese cálculo.");
      return;
    }

    resetForm(false);
    els.client.value = quote.client || "";
    els.reference.value = quote.reference || "";
    els.formulaTotal.value = formatNumberInput(quote.formulaTotal);
    els.discountPct.value = quote.discountPct;
    els.pabloPct.value = quote.pabloPct;
    els.marginPabloPct.value = quote.marginPabloPct;
    els.marginOwnPct.value = quote.marginOwnPct;

    els.contributionsList.innerHTML = "";
    (quote.contributions?.length ? quote.contributions : [{}]).forEach(addContributionRow);
    updateOwnTotal();

    const currentInput = collectFormInput();
    state.currentResult = calculate(currentInput);
    renderResult(state.currentResult);

    state.editingId = duplicate ? null : quote.id;
    els.editingBanner.classList.toggle("hidden", duplicate);
    els.btnSave.textContent = duplicate ? "💾 Guardar copia" : "💾 Actualizar cálculo";

    switchView("cotizar");
    showToast(duplicate ? "Cálculo duplicado. Podés modificarlo." : "Cálculo abierto para editar.");
  }

  async function deleteQuote(id) {
    const quote = await dbGet(id);
    const name = quote?.reference || quote?.client || "este cálculo";
    if (!confirm(`¿Eliminar ${name}?`)) return;

    await dbDelete(id);
    if (state.editingId === id) resetForm(false);
    await renderHistory();
    showToast("Cálculo eliminado.");
  }

  function resetForm(scroll = true) {
    state.currentResult = null;
    state.editingId = null;
    els.form.reset();
    els.contributionsList.innerHTML = "";
    addContributionRow();
    applySettingsToForm();
    updateOwnTotal();
    clearError();
    els.resultCard.classList.add("hidden");
    els.editingBanner.classList.add("hidden");
    els.btnSave.textContent = "💾 Guardar cálculo";
    els.resultDetails.classList.add("hidden");
    if (scroll) window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function renderHistory() {
    if (!state.db) return;

    const query = els.historySearch.value.trim().toLocaleLowerCase("es-AR");
    let quotes = await dbGetAll();
    quotes.sort((a, b) => new Date(b.updatedAt || b.createdAt) - new Date(a.updatedAt || a.createdAt));

    if (query) {
      quotes = quotes.filter(quote => {
        const haystack = [
          quote.client,
          quote.reference,
          formatDate(quote.createdAt),
          formatCurrency(quote.chargeClient),
          formatCurrency(quote.payPablo)
        ].join(" ").toLocaleLowerCase("es-AR");
        return haystack.includes(query);
      });
    }

    els.historyCount.textContent = String(quotes.length);
    els.historyEmpty.classList.toggle("hidden", quotes.length > 0);
    els.historyList.innerHTML = quotes.map(quote => {
      const title = quote.reference || quote.client || "Cálculo sin referencia";
      const metaParts = [];
      if (quote.client && quote.reference) metaParts.push(quote.client);
      metaParts.push(`Fórmula ${formatCurrency(quote.formulaTotal)}`);

      return `
        <article class="history-card">
          <div class="history-card-head">
            <div>
              <h3>${escapeHtml(title)}</h3>
              <div class="meta">${escapeHtml(metaParts.join(" · "))}</div>
            </div>
            <div class="date">${escapeHtml(formatDateTime(quote.updatedAt || quote.createdAt))}</div>
          </div>

          <div class="history-results">
            <div>
              <span>PAGAR A PABLO</span>
              <strong>${formatCurrency(quote.payPablo)}</strong>
            </div>
            <div>
              <span>COBRAR AL CLIENTE</span>
              <strong>${formatCurrency(quote.chargeClient)}</strong>
            </div>
          </div>

          <div class="history-actions">
            <button type="button" data-action="open" data-id="${quote.id}">Abrir</button>
            <button type="button" data-action="duplicate" data-id="${quote.id}">Duplicar</button>
            <button class="delete" type="button" data-action="delete" data-id="${quote.id}" aria-label="Eliminar">🗑️</button>
          </div>
        </article>
      `;
    }).join("");
  }

  function loadSettings() {
    try {
      return { ...DEFAULT_SETTINGS, ...JSON.parse(localStorage.getItem(SETTINGS_KEY) || "{}") };
    } catch {
      return { ...DEFAULT_SETTINGS };
    }
  }

  function saveSettings(settings) {
    state.settings = { ...DEFAULT_SETTINGS, ...settings };
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(state.settings));
  }

  function applySettingsToForm() {
    els.discountPct.value = state.settings.discountPct;
    els.pabloPct.value = state.settings.pabloPct;
    els.marginPabloPct.value = state.settings.marginPabloPct;
    els.marginOwnPct.value = state.settings.marginOwnPct;
  }

  function applySettingsToSettingsView() {
    els.settingsDiscount.value = state.settings.discountPct;
    els.settingsPablo.value = state.settings.pabloPct;
    els.settingsMarginPablo.value = state.settings.marginPabloPct;
    els.settingsMarginOwn.value = state.settings.marginOwnPct;
  }

  function saveSettingsFromView() {
    const settings = {
      discountPct: numberOrZero(els.settingsDiscount.value),
      pabloPct: numberOrZero(els.settingsPablo.value),
      marginPabloPct: numberOrZero(els.settingsMarginPablo.value),
      marginOwnPct: numberOrZero(els.settingsMarginOwn.value)
    };

    const validation = validateInput({
      formulaTotal: 1,
      contributions: [],
      ...settings
    });

    if (!validation.ok) {
      showToast(validation.message);
      return;
    }

    saveSettings(settings);
    if (!state.currentResult && !state.editingId) applySettingsToForm();
    showToast("Valores predeterminados guardados.");
  }

  async function exportBackup() {
    const quotes = await dbGetAll();
    const payload = {
      app: "Pancko Automotor",
      schemaVersion: 1,
      exportedAt: new Date().toISOString(),
      settings: state.settings,
      quotes
    };

    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    const date = new Date().toISOString().slice(0, 10);
    link.href = url;
    link.download = `pancko-automotor-respaldo-${date}.json`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
    showToast(`Respaldo exportado con ${quotes.length} cálculo${quotes.length === 1 ? "" : "s"}.`);
  }

  async function importBackup(event) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;

    try {
      const text = await file.text();
      const data = JSON.parse(text);

      if (data.app !== "Pancko Automotor" || !Array.isArray(data.quotes)) {
        throw new Error("Formato de respaldo no válido.");
      }

      if (!confirm(`Se importarán ${data.quotes.length} cálculos. Los IDs repetidos se actualizarán. ¿Continuar?`)) return;

      for (const quote of data.quotes) {
        if (!quote.id || !(quote.formulaTotal >= 0)) continue;
        await dbPut(quote);
      }

      if (data.settings && typeof data.settings === "object") {
        saveSettings(data.settings);
        applySettingsToSettingsView();
      }

      await renderHistory();
      showToast("Respaldo importado correctamente.");
    } catch (error) {
      console.error(error);
      showToast("No se pudo importar el respaldo.");
    }
  }

  async function clearHistory() {
    if (!confirm("¿Borrar todo el historial local? Esta acción no se puede deshacer salvo que tengas un respaldo exportado.")) return;
    await dbClear();
    resetForm(false);
    await renderHistory();
    showToast("Historial eliminado.");
  }

  function installApp() {
    if (!state.deferredInstallPrompt) {
      showToast("Usá el menú del navegador y elegí “Agregar a pantalla principal”.");
      return;
    }

    state.deferredInstallPrompt.prompt();
    state.deferredInstallPrompt.userChoice.finally(() => {
      state.deferredInstallPrompt = null;
      updateInstallButton();
    });
  }

  function updateInstallButton() {
    els.btnInstall.disabled = !state.deferredInstallPrompt;
  }

  function registerServiceWorker() {
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("./sw.js").catch(error => {
        console.warn("Service worker no registrado:", error);
      });
    }
  }

  function parseArgNumber(value) {
    if (typeof value === "number") return Number.isFinite(value) ? value : 0;
    let raw = String(value ?? "").trim();
    if (!raw) return 0;

    raw = raw.replace(/[^\d,.\-]/g, "");
    const lastComma = raw.lastIndexOf(",");
    const lastDot = raw.lastIndexOf(".");

    if (lastComma !== -1 && lastDot !== -1) {
      if (lastComma > lastDot) {
        raw = raw.replace(/\./g, "").replace(",", ".");
      } else {
        raw = raw.replace(/,/g, "");
      }
    } else if (lastComma !== -1) {
      raw = raw.replace(/\./g, "").replace(",", ".");
    } else if (lastDot !== -1) {
      const dots = (raw.match(/\./g) || []).length;
      if (dots > 1) {
        const parts = raw.split(".");
        const decimal = parts.pop();
        raw = parts.join("") + "." + decimal;
      } else {
        const [integer, decimals = ""] = raw.split(".");
        if (decimals.length === 3 && integer.length >= 1) raw = integer + decimals;
      }
    }

    const parsed = Number(raw);
    return Number.isFinite(parsed) ? parsed : 0;
  }

  function formatCurrency(value) {
    return new Intl.NumberFormat("es-AR", {
      style: "currency",
      currency: "ARS",
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(Number(value) || 0);
  }

  function formatNumberInput(value) {
    return new Intl.NumberFormat("es-AR", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(Number(value) || 0);
  }

  function formatCurrencyInput(input) {
    const value = parseArgNumber(input.value);
    input.value = value ? formatNumberInput(value) : "";
    if (input.classList.contains("contribution-amount")) updateOwnTotal();
  }

  function formatDate(value) {
    return new Intl.DateTimeFormat("es-AR", {
      dateStyle: "short"
    }).format(new Date(value));
  }

  function formatDateTime(value) {
    return new Intl.DateTimeFormat("es-AR", {
      dateStyle: "short",
      timeStyle: "short"
    }).format(new Date(value));
  }

  function numberOrZero(value) {
    const number = Number(value);
    return Number.isFinite(number) ? number : 0;
  }

  function roundMoney(value) {
    return Math.round((Number(value) + Number.EPSILON) * 100) / 100;
  }

  function makeId() {
    if (crypto?.randomUUID) return crypto.randomUUID();
    return `quote-${Date.now()}-${Math.random().toString(16).slice(2)}`;
  }

  function escapeHtml(value) {
    return String(value ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function showError(message) {
    els.formError.textContent = message;
    els.formError.classList.remove("hidden");
    els.formError.scrollIntoView({ behavior: "smooth", block: "center" });
  }

  function clearError() {
    els.formError.textContent = "";
    els.formError.classList.add("hidden");
  }

  let toastTimer = null;
  function showToast(message) {
    els.toast.textContent = message;
    els.toast.classList.remove("hidden");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => els.toast.classList.add("hidden"), 3000);
  }

  function openDatabase() {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains(STORE_QUOTES)) {
          const store = db.createObjectStore(STORE_QUOTES, { keyPath: "id" });
          store.createIndex("createdAt", "createdAt");
          store.createIndex("updatedAt", "updatedAt");
        }
      };

      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  function withStore(mode, callback) {
    return new Promise((resolve, reject) => {
      const transaction = state.db.transaction(STORE_QUOTES, mode);
      const store = transaction.objectStore(STORE_QUOTES);
      let request;

      try {
        request = callback(store);
      } catch (error) {
        reject(error);
        return;
      }

      transaction.oncomplete = () => resolve(request?.result);
      transaction.onerror = () => reject(transaction.error);
      transaction.onabort = () => reject(transaction.error);
    });
  }

  function dbPut(value) {
    return withStore("readwrite", store => store.put(value));
  }

  function dbGet(id) {
    return withStore("readonly", store => store.get(id));
  }

  function dbGetAll() {
    return withStore("readonly", store => store.getAll());
  }

  function dbDelete(id) {
    return withStore("readwrite", store => store.delete(id));
  }

  function dbClear() {
    return withStore("readwrite", store => store.clear());
  }
})();
