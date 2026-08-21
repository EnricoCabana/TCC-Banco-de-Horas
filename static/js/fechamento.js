/**
 * CronaSys — static/js/fechamento.js
 * -------------------------------------------------------
 * Tela de Fechamento de Folha (somente admin/RH).
 * Mostra o consolidado do mês de todos os funcionários e baixa o Excel mestre.
 * main.js chama iniciarModuloFechamento().
 *
 * Rotas:
 *   GET /api/fechamento/:ano/:mes        → prévia (JSON)
 *   GET /api/fechamento/:ano/:mes/excel  → download do .xlsx
 */

const FECH_MESES = [
    "", "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
    "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
];

let _fechRelatorio = null; /* último relatório carregado */

function iniciarModuloFechamento() {
    console.log("[Fechamento] init");
    _fechPopularAnos();
    _fechPopularMeses();
    _fechVincularEventos();
    _fechGerar();
}

function _fechVincularEventos() {
    document.getElementById("btnFechGerar")?.addEventListener("click", _fechGerar);
    document.getElementById("btnFechExcel")?.addEventListener("click", _fechBaixarExcel);
    document.getElementById("btnFechFechar")?.addEventListener("click", _fechFecharMes);
    document.getElementById("btnFechReabrir")?.addEventListener("click", _fechReabrirMes);
}

function _fechPopularAnos() {
    const sel = document.getElementById("fechAno");
    if (!sel) return;
    const atual = new Date().getFullYear();
    sel.innerHTML = "";
    for (let a = atual - 1; a <= atual + 1; a++) {
        const op = document.createElement("option");
        op.value = a;
        op.textContent = a;
        if (a === atual) op.selected = true;
        sel.appendChild(op);
    }
}

function _fechPopularMeses() {
    const sel = document.getElementById("fechMes");
    if (!sel) return;
    sel.innerHTML = "";
    const mesAtual = new Date().getMonth() + 1;
    for (let m = 1; m <= 12; m++) {
        const op = document.createElement("option");
        op.value = m;
        op.textContent = FECH_MESES[m];
        if (m === mesAtual) op.selected = true;
        sel.appendChild(op);
    }
}

function _fechAnoSel() {
    return parseInt(document.getElementById("fechAno")?.value, 10) || new Date().getFullYear();
}

function _fechMesSel() {
    return parseInt(document.getElementById("fechMes")?.value, 10) || (new Date().getMonth() + 1);
}

/* ================================================================
   GERAR PRÉVIA  →  GET /api/fechamento/:ano/:mes
================================================================ */
async function _fechGerar() {
    const ano = _fechAnoSel();
    const mes = _fechMesSel();
    const corpo = document.getElementById("corpoFechamento");

    document.getElementById("fechTitulo").textContent = `Consolidado de ${FECH_MESES[mes]} / ${ano}`;
    corpo.innerHTML = `
        <tr><td colspan="7" class="fech-carregando">
            <i class="fa-solid fa-circle-notch fa-spin"></i><p>Calculando...</p>
        </td></tr>`;

    try {
        const res = await fetch(`/api/fechamento/${ano}/${mes}`, { headers: _fechAuthHeaders() });
        const json = await res.json();
        if (!res.ok) throw new Error(json.message || `Erro ${res.status}`);

        _fechRelatorio = json;
        await _fechCarregarSaldosTotais();
        _fechRenderizar(json);
        await _fechAtualizarStatus(ano, mes);
    } catch (e) {
        console.error("[Fechamento]", e);
        document.getElementById("fechResumoCard").style.display = "none";
        corpo.innerHTML = `
            <tr><td colspan="7" class="fech-vazia">
                <i class="fa-solid fa-circle-exclamation"></i>
                <p>${_fechEsc(e.message)}</p>
            </td></tr>`;
    }
}

function _fechRenderizar(rel) {
    const corpo = document.getElementById("corpoFechamento");
    document.getElementById("fechTotalReg").textContent =
        `${rel.itens.length} funcionário${rel.itens.length !== 1 ? "s" : ""}`;

    // Resumo (KPIs)
    document.getElementById("fechResumoCard").style.display = "block";
    document.getElementById("fechKpiFuncionarios").textContent = rel.totais.funcionarios;
    document.getElementById("fechKpiTotal").textContent = rel.totais.total_horas;
    const kpiSaldo = document.getElementById("fechKpiSaldo");
    kpiSaldo.textContent = rel.totais.saldo_horas;
    kpiSaldo.style.color = rel.totais.saldo_horas.startsWith("-") ? "#dc2626" : "#16a34a";

    if (!rel.itens.length) {
        corpo.innerHTML = `
            <tr><td colspan="7" class="fech-vazia">
                <i class="fa-regular fa-folder-open"></i>
                <p>Nenhum funcionário ativo encontrado.</p>
            </td></tr>`;
        return;
    }

    const linhas = rel.itens.map(i => {
        const cls = i.saldo_horas.startsWith("-") ? "fech-saldo-neg"
                  : i.saldo_minutos > 0 ? "fech-saldo-pos" : "fech-saldo-zero";
        const totMin = Number(_fechSaldosTotais[i.id_usuario] || 0);
        const totCls = totMin < 0 ? "fech-saldo-neg" : totMin > 0 ? "fech-saldo-pos" : "fech-saldo-zero";
        const totTxt = (totMin >= 0 ? "+" : "-") + _fechMinHora(totMin);
        return `
        <tr>
          <td class="col-mono">${_fechEsc(i.matricula)}</td>
          <td>${_fechEsc(i.nome)}</td>
          <td style="color:#6b7280;">${_fechEsc(i.setor)}</td>
          <td style="text-align:center;">${i.dias_lancados}</td>
          <td class="col-mono">${_fechEsc(i.total_horas)}</td>
          <td class="col-mono ${cls}">${_fechEsc(i.saldo_horas)}</td>
          <td class="col-mono ${totCls}">${totTxt}</td>
        </tr>`;
    }).join("");

    const bancoEquipeMin = rel.itens.reduce((s, i) => s + Number(_fechSaldosTotais[i.id_usuario] || 0), 0);
    const bancoEquipeTxt = (bancoEquipeMin >= 0 ? "+" : "-") + _fechMinHora(bancoEquipeMin);
    const total = `
        <tr class="fech-linha-total">
          <td colspan="4" style="text-align:right;">TOTAL</td>
          <td class="col-mono">${_fechEsc(rel.totais.total_horas)}</td>
          <td class="col-mono">${_fechEsc(rel.totais.saldo_horas)}</td>
          <td class="col-mono">${bancoEquipeTxt}</td>
        </tr>`;

    corpo.innerHTML = linhas + total;
}

/* ================================================================
   BAIXAR EXCEL  →  GET /api/fechamento/:ano/:mes/excel
================================================================ */
async function _fechBaixarExcel() {
    const ano = _fechAnoSel();
    const mes = _fechMesSel();
    const btn = document.getElementById("btnFechExcel");
    btn.disabled = true;

    try {
        const res = await fetch(`/api/fechamento/${ano}/${mes}/excel`, { headers: _fechAuthHeaders() });
        if (!res.ok) {
            const json = await res.json().catch(() => ({}));
            throw new Error(json.message || `Erro ${res.status}`);
        }
        const blob = await res.blob();
        const a = document.createElement("a");
        a.href = URL.createObjectURL(blob);
        a.download = `Fechamento_${ano}-${String(mes).padStart(2, "0")}.xlsx`;
        a.click();
        URL.revokeObjectURL(a.href);
        _fechNotificar("Excel gerado!", "sucesso");
    } catch (e) {
        _fechNotificar(e.message, "erro");
    } finally {
        btn.disabled = false;
    }
}

/* ================================================================
   FECHAR / REABRIR / STATUS
================================================================ */
async function _fechAtualizarStatus(ano, mes) {
    const badge = document.getElementById("fechStatusBadge");
    const btnFechar = document.getElementById("btnFechFechar");
    const btnReabrir = document.getElementById("btnFechReabrir");
    try {
        const res = await fetch(`/api/fechamento/${ano}/${mes}/status`, { headers: _fechAuthHeaders() });
        if (!res.ok) throw new Error();
        const st = await res.json();

        if (st.fechado) {
            const data = st.data_fechamento ? ` em ${_fechDataBr(st.data_fechamento)}` : "";
            badge.className = "fech-badge fech-badge-fechado";
            badge.innerHTML = `<i class="fa-solid fa-lock"></i> Mês fechado${data}`;
            btnFechar.style.display = "none";
            btnReabrir.style.display = "inline-flex";
        } else {
            badge.className = "fech-badge fech-badge-aberto";
            badge.innerHTML = `<i class="fa-solid fa-lock-open"></i> Mês aberto`;
            btnFechar.style.display = "inline-flex";
            btnReabrir.style.display = "none";
        }
    } catch {
        badge.className = "fech-badge";
        badge.textContent = "Status indisponível";
    }
}

async function _fechFecharMes() {
    const ano = _fechAnoSel(), mes = _fechMesSel();
    if (!(await window.cronaConfirm({ titulo: 'Fechar mês', mensagem: `Fechar ${FECH_MESES[mes]}/${ano}? Isso bloqueia novas edições do ponto nesse mês. Você poderá reabrir depois.`, textoOk: 'Fechar mês', perigo: true }))) return;
    const btn = document.getElementById("btnFechFechar");
    btn.disabled = true;
    try {
        const res = await fetch(`/api/fechamento/${ano}/${mes}/fechar`, { method: "POST", headers: _fechAuthHeaders() });
        const json = await res.json();
        if (!res.ok) throw new Error(json.message || `Erro ${res.status}`);
        await _fechGerar();
        _fechNotificar(json.message || "Mês fechado!", "sucesso");
    } catch (e) {
        _fechNotificar(e.message, "erro");
    } finally {
        btn.disabled = false;
    }
}

async function _fechReabrirMes() {
    const ano = _fechAnoSel(), mes = _fechMesSel();
    if (!(await window.cronaConfirm({ titulo: 'Reabrir mês', mensagem: `Reabrir ${FECH_MESES[mes]}/${ano}? As edições do ponto nesse mês voltam a ser permitidas.`, textoOk: 'Reabrir mês' }))) return;
    const btn = document.getElementById("btnFechReabrir");
    btn.disabled = true;
    try {
        const res = await fetch(`/api/fechamento/${ano}/${mes}/reabrir`, { method: "POST", headers: _fechAuthHeaders() });
        const json = await res.json();
        if (!res.ok) throw new Error(json.message || `Erro ${res.status}`);
        await _fechGerar();
        _fechNotificar(json.message || "Mês reaberto!", "info");
    } catch (e) {
        _fechNotificar(e.message, "erro");
    } finally {
        btn.disabled = false;
    }
}

function _fechDataBr(iso) {
    const d = String(iso).slice(0, 10).split("-");
    return d.length === 3 ? `${d[2]}/${d[1]}/${d[0]}` : iso;
}

/* ================================================================
   HELPERS
================================================================ */
function _fechAuthHeaders() {
    return typeof window.cronaAuthHeaders === "function" ? window.cronaAuthHeaders() : {};
}

/* Saldo Total acumulado (banco) de cada funcionário — { idUsuario: saldoMin } */
let _fechSaldosTotais = {};
async function _fechCarregarSaldosTotais() {
    try {
        const res = await fetch("/api/saldos-acumulados", { headers: _fechAuthHeaders() });
        _fechSaldosTotais = res.ok ? await res.json() : {};
    } catch {
        _fechSaldosTotais = {};
    }
}
function _fechMinHora(min) {
    min = Math.abs(Number(min) || 0);
    return `${String(Math.floor(min / 60)).padStart(2, "0")}:${String(min % 60).padStart(2, "0")}`;
}

function _fechEsc(v) {
    return String(v ?? "")
        .replace(/&/g, "&amp;").replace(/</g, "&lt;")
        .replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function _fechNotificar(msg, tipo = "sucesso") {
    document.getElementById("cronaNotif")?.remove();
    const c = {
        sucesso: { bg: "#f0fdf4", borda: "#86efac", texto: "#166534", icone: "fa-circle-check" },
        info: { bg: "#eff6ff", borda: "#93c5fd", texto: "#1e40af", icone: "fa-circle-info" },
        erro: { bg: "#fef2f2", borda: "#fca5a5", texto: "#991b1b", icone: "fa-circle-exclamation" },
    }[tipo] || {};
    const el = document.createElement("div");
    el.id = "cronaNotif";
    el.style.cssText = `position:fixed;top:20px;right:24px;z-index:9999;
        background:${c.bg};border:1px solid ${c.borda};color:${c.texto};
        border-radius: 0;padding:12px 18px;font-size:14px;font-weight:500;
        display:flex;align-items:center;gap:10px;
        box-shadow:0 4px 12px rgba(0,0,0,.1);max-width:380px;`;
    el.innerHTML = `<i class="fa-solid ${c.icone}"></i> ${_fechEsc(msg)}`;
    document.body.appendChild(el);
    setTimeout(() => el.remove(), 3500);
}

/* SEM auto-execução — o main.js chama iniciarModuloFechamento() */