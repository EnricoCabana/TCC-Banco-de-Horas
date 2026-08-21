/**
 * CronaSys — static/js/envio-fichas.js
 * -------------------------------------------------------
 * Tela "Enviar Fichas por E-mail" (admin).
 * main.js chama iniciarModuloEnvioFichas().
 *
 * Fluxo: lista funcionários (com filtro por nome e setor) → seleciona
 * (individual / todos) → POST /api/email/fichas { mes, ano, ids }.
 */

let _efFuncionarios = [];
let _efSelecionados = new Set();
let _efSaldosTotais = {};

const _EF_CORES = ["#3b82f6", "#8b5cf6", "#10b981", "#f59e0b", "#ef4444", "#06b6d4", "#ec4899"];

function iniciarModuloEnvioFichas() {
    _efFuncionarios = [];
    _efSelecionados = new Set();

    // Mês/ano atuais como padrão
    const hoje = new Date();
    const selMes = document.getElementById("efMes");
    if (selMes) selMes.value = String(hoje.getMonth() + 1);
    const selAno = document.getElementById("efAno");
    if (selAno) {
        const anoAtual = hoje.getFullYear();
        selAno.innerHTML = "";
        for (let a = anoAtual; a >= anoAtual - 3; a--) {
            selAno.innerHTML += `<option value="${a}">${a}</option>`;
        }
        selAno.value = String(anoAtual);
    }

    document.getElementById("efBusca")?.addEventListener("input", _efRenderLista);
    document.getElementById("efSetor")?.addEventListener("change", _efRenderLista);
    document.getElementById("efTodos")?.addEventListener("change", _efToggleTodos);
    document.getElementById("btnEfEnviar")?.addEventListener("click", _efEnviar);

    _efCarregar();
}

async function _efCarregar() {
    try {
        const [resU, resS] = await Promise.all([
            fetch("/api/usuarios", { headers: _efAuth() }),
            fetch("/api/setores", { headers: _efAuth() }),
        ]);
        const usuarios = await resU.json();
        _efFuncionarios = (Array.isArray(usuarios) ? usuarios : [])
            .filter(u => (u.ativo === undefined || u.ativo) && !u.isento_ponto)
            .sort((a, b) => String(a.nome).localeCompare(String(b.nome)));

        await _efCarregarSaldos();

        // setores no filtro
        try {
            const setores = await resS.json();
            const sel = document.getElementById("efSetor");
            if (sel && Array.isArray(setores)) {
                setores.forEach(s => {
                    sel.innerHTML += `<option value="${s.nome_setor}">${s.nome_setor}</option>`;
                });
            }
        } catch { /* setores opcional */ }

        _efRenderLista();
    } catch {
        const el = document.getElementById("efLista");
        if (el) el.innerHTML = `<div class="ef-vazio">Erro ao carregar funcionários.</div>`;
    }
}

function _efRenderLista() {
    const el = document.getElementById("efLista");
    if (!el) return;
    const busca = (document.getElementById("efBusca")?.value || "").toLowerCase().trim();
    const setor = document.getElementById("efSetor")?.value || "";

    const lista = _efFuncionarios.filter(f => {
        const okBusca = !busca || String(f.nome).toLowerCase().includes(busca);
        const okSetor = !setor || f.nome_setor === setor;
        return okBusca && okSetor;
    });

    if (!lista.length) {
        el.innerHTML = `<div class="ef-vazio">Nenhum funcionário encontrado.</div>`;
        _efAtualizarContador();
        return;
    }

    el.innerHTML = lista.map((f, i) => {
        const semEmail = !f.email;
        const id = f.id_usuario;
        const _totMin = Number(_efSaldosTotais[id] || 0);
        const _totTxt = (_totMin >= 0 ? "+" : "-") + _efMinHora(_totMin);
        const _totCor = _totMin > 0 ? "#16a34a" : _totMin < 0 ? "#dc2626" : "var(--muted)";
        const checked = _efSelecionados.has(id) ? "checked" : "";
        const disabled = semEmail ? "disabled" : "";
        const sub = semEmail
            ? `<span class="ef-sub sem">sem e-mail cadastrado</span>`
            : `<span class="ef-sub">${f.email}</span>`;
        return `
        <label class="ef-item ${semEmail ? "sem-email" : ""}">
            <input type="checkbox" data-id="${id}" ${checked} ${disabled} onchange="_efToggleUm(${id}, this.checked)" />
            ${_efAvatar(f, i)}
            <div class="ef-info">
                <span class="ef-nome">${f.nome}</span>
                ${sub}
                <span class="ef-banco" style="font-size:11.5px;font-weight:700;color:${_totCor};">Saldo total: ${_totTxt}</span>
            </div>
            ${f.nome_setor ? `<span class="ef-tag-setor">${f.nome_setor}</span>` : ""}
        </label>`;
    }).join("");

    _efAtualizarContador();
}

function _efAvatar(f, i) {
    const cor = _EF_CORES[i % _EF_CORES.length];
    if (f.foto_perfil) {
        return `<div class="ef-avatar" style="overflow:hidden;background:transparent;"><img src="${f.foto_perfil}" alt="" style="width:100%;height:100%;object-fit:cover;border-radius:50%;display:block;"></div>`;
    }
    const ini = String(f.nome || "?").trim().split(/\s+/).slice(0, 2).map(p => p[0].toUpperCase()).join("");
    return `<div class="ef-avatar" style="background:${cor}">${ini}</div>`;
}

function _efToggleUm(id, marcado) {
    if (marcado) _efSelecionados.add(id);
    else _efSelecionados.delete(id);
    _efAtualizarContador();
}

function _efToggleTodos(e) {
    const marcar = e.target.checked;
    // só os visíveis (respeitando filtro) e com e-mail
    const busca = (document.getElementById("efBusca")?.value || "").toLowerCase().trim();
    const setor = document.getElementById("efSetor")?.value || "";
    _efFuncionarios.forEach(f => {
        if (!f.email) return;
        const okBusca = !busca || String(f.nome).toLowerCase().includes(busca);
        const okSetor = !setor || f.nome_setor === setor;
        if (okBusca && okSetor) {
            if (marcar) _efSelecionados.add(f.id_usuario);
            else _efSelecionados.delete(f.id_usuario);
        }
    });
    _efRenderLista();
}

function _efAtualizarContador() {
    const el = document.getElementById("efContador");
    if (el) el.textContent = `${_efSelecionados.size} selecionado${_efSelecionados.size === 1 ? "" : "s"}`;
}

async function _efEnviar() {
    if (!_efSelecionados.size) return _efNotificar("Selecione ao menos um funcionário.", "erro");

    const mes = Number(document.getElementById("efMes").value);
    const ano = Number(document.getElementById("efAno").value);
    const ids = Array.from(_efSelecionados);

    const btn = document.getElementById("btnEfEnviar");
    const original = btn.innerHTML;
    btn.disabled = true;
    btn.innerHTML = '<i class="fa-solid fa-circle-notch fa-spin"></i> Enviando...';
    try {
        const res = await fetch("/api/email/fichas", {
            method: "POST",
            headers: { "Content-Type": "application/json", ..._efAuth() },
            body: JSON.stringify({ mes, ano, ids }),
        });
        const json = await res.json();
        if (!res.ok) throw new Error(json.message || `Erro ${res.status}`);
        _efRenderResultado(json);
    } catch (e) {
        _efNotificar(e.message, "erro");
    } finally {
        btn.disabled = false;
        btn.innerHTML = original;
    }
}

function _efRenderResultado(json) {
    const box = document.getElementById("efResultados");
    const resumo = document.getElementById("efResumo");
    const lista = document.getElementById("efResultadoLista");
    if (!box) return;
    box.style.display = "block";

    resumo.innerHTML = `<i class="fa-solid fa-circle-check" style="color:#16a34a;"></i> ${json.enviados} enviada(s)`
        + (json.falhas ? ` &nbsp; · &nbsp; <i class="fa-solid fa-circle-xmark" style="color:#dc2626;"></i> ${json.falhas} falha(s)` : "");

    lista.innerHTML = (json.resultados || []).map(r => `
        <div class="ef-res-item">
            <i class="fa-solid ${r.ok ? "fa-circle-check ok" : "fa-circle-xmark falha"}"></i>
            <span>${r.nome}</span>
            ${r.ok ? "" : `<span class="ef-res-erro">${r.erro || "falhou"}</span>`}
        </div>`).join("");

    box.scrollIntoView({ behavior: "smooth", block: "nearest" });
    _efNotificar(`${json.enviados} ficha(s) enviada(s).`, json.falhas ? "erro" : "sucesso");
}

/* ── helpers ── */
function _efAuth() {
    return typeof window.cronaAuthHeaders === "function" ? window.cronaAuthHeaders() : {};
}

/* Saldo Total acumulado (banco) de cada funcionário — { idUsuario: saldoMin } */
async function _efCarregarSaldos() {
    try {
        const res = await fetch("/api/saldos-acumulados", { headers: _efAuth() });
        _efSaldosTotais = res.ok ? await res.json() : {};
    } catch {
        _efSaldosTotais = {};
    }
}
function _efMinHora(min) {
    min = Math.abs(Number(min) || 0);
    return `${String(Math.floor(min / 60)).padStart(2, "0")}:${String(min % 60).padStart(2, "0")}`;
}
function _efNotificar(msg, tipo = "sucesso") {
    document.getElementById("cronaNotif")?.remove();
    const c = {
        sucesso: { bg: "#f0fdf4", borda: "#86efac", texto: "#166534", icone: "fa-circle-check" },
        erro: { bg: "#fef2f2", borda: "#fca5a5", texto: "#991b1b", icone: "fa-circle-exclamation" },
    }[tipo] || {};
    const el = document.createElement("div");
    el.id = "cronaNotif";
    el.style.cssText = `position:fixed;top:20px;right:24px;z-index:9999;
        background:${c.bg};border:1px solid ${c.borda};color:${c.texto};
        border-radius: 0;padding:12px 18px;font-size:14px;font-weight:500;
        display:flex;align-items:center;gap:10px;box-shadow:0 4px 12px rgba(0,0,0,.1);max-width:420px;`;
    el.innerHTML = `<i class="fa-solid ${c.icone}"></i> ${String(msg || "").replace(/</g, "&lt;")}`;
    document.body.appendChild(el);
    setTimeout(() => el.remove(), 4000);
}

/* SEM auto-execução — o main.js chama iniciarModuloEnvioFichas() */