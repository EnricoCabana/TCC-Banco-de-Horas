/**
 * CronaSys — static/js/auditoria.js
 * -------------------------------------------------------
 * Tela de Trilha de Auditoria (somente admin/RH).
 * Lista os eventos (criar/editar/excluir) com filtros.
 * main.js chama iniciarModuloAuditoria().
 *
 * Rotas:
 *   GET /api/auditoria/opcoes        → entidades e executores p/ os filtros
 *   GET /api/auditoria?acao=&...     → eventos filtrados
 */

const AUD_BADGE = {
    CRIAR:   { cls: "aud-badge-criar",   txt: "Criação" },
    EDITAR:  { cls: "aud-badge-editar",  txt: "Edição" },
    EXCLUIR: { cls: "aud-badge-excluir", txt: "Exclusão" },
};

function iniciarModuloAuditoria() {
    console.log("[Auditoria] init");
    _audCarregarOpcoes();
    _audVincularEventos();
    _audCarregar();
}

function _audVincularEventos() {
    document.getElementById("btnAudFiltrar")?.addEventListener("click", _audCarregar);
    document.getElementById("btnAudLimpar")?.addEventListener("click", _audLimpar);
    document.getElementById("audBusca")?.addEventListener("keydown", e => {
        if (e.key === "Enter") _audCarregar();
    });
}

/* Popula os selects de entidade e executor a partir do que já existe. */
async function _audCarregarOpcoes() {
    try {
        const res = await fetch("/api/auditoria/opcoes", { headers: _audAuthHeaders() });
        if (!res.ok) return;
        const op = await res.json();

        const selEnt = document.getElementById("audEntidade");
        (op.entidades || []).forEach(e => {
            const o = document.createElement("option");
            o.value = e; o.textContent = e;
            selEnt.appendChild(o);
        });

        const selExe = document.getElementById("audExecutor");
        (op.executores || []).forEach(u => {
            const o = document.createElement("option");
            o.value = u.executor_id; o.textContent = u.executor_nome;
            selExe.appendChild(o);
        });
    } catch { /* sem opções ainda */ }
}

function _audLimpar() {
    ["audAcao", "audEntidade", "audExecutor", "audDataDe", "audDataAte", "audBusca"]
        .forEach(id => { const el = document.getElementById(id); if (el) el.value = ""; });
    _audCarregar();
}

/* Monta a query string a partir dos filtros preenchidos. */
function _audQuery() {
    const p = new URLSearchParams();
    const add = (id, chave) => {
        const v = document.getElementById(id)?.value;
        if (v) p.set(chave, v);
    };
    add("audAcao", "acao");
    add("audEntidade", "entidade");
    add("audExecutor", "executor");
    add("audDataDe", "data_de");
    add("audDataAte", "data_ate");
    add("audBusca", "busca");
    return p.toString();
}

async function _audCarregar() {
    const corpo = document.getElementById("corpoAuditoria");
    corpo.innerHTML = `<tr><td colspan="5" class="aud-carregando"><i class="fa-solid fa-circle-notch fa-spin"></i><p>Carregando...</p></td></tr>`;

    try {
        const qs = _audQuery();
        const res = await fetch(`/api/auditoria${qs ? "?" + qs : ""}`, { headers: _audAuthHeaders() });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        _audRenderizar(await res.json());
    } catch (e) {
        console.error("[Auditoria]", e);
        corpo.innerHTML = `<tr><td colspan="5" class="aud-vazia"><i class="fa-solid fa-wifi"></i><p>Não foi possível carregar a auditoria.</p></td></tr>`;
    }
}

function _audRenderizar(lista) {
    const corpo = document.getElementById("corpoAuditoria");
    document.getElementById("audTotal").textContent =
        `${lista.length} evento${lista.length !== 1 ? "s" : ""}`;

    if (!lista.length) {
        corpo.innerHTML = `<tr><td colspan="5" class="aud-vazia"><i class="fa-regular fa-folder-open"></i><p>Nenhum evento encontrado para esses filtros.</p></td></tr>`;
        return;
    }

    corpo.innerHTML = lista.map(ev => {
        const badge = AUD_BADGE[ev.acao] || { cls: "", txt: ev.acao };
        return `
        <tr>
          <td class="aud-data">${_audDataHora(ev.data_registro)}</td>
          <td><span class="aud-badge ${badge.cls}">${badge.txt}</span></td>
          <td><span class="aud-entidade">${_audEsc(ev.entidade)}</span>${ev.entidade_id ? `<br><small style="color:#9ca3af;">${_audEsc(ev.entidade_id)}</small>` : ""}</td>
          <td>${_audEsc(ev.descricao || "—")}</td>
          <td class="aud-quem">${_audEsc(ev.executor_nome || "Sistema")}</td>
        </tr>`;
    }).join("");
}

/* ================================================================
   HELPERS
================================================================ */
function _audAuthHeaders() {
    return typeof window.cronaAuthHeaders === "function" ? window.cronaAuthHeaders() : {};
}

function _audDataHora(iso) {
    // "2026-06-03 14:25:09" → "03/06/2026 14:25"
    if (!iso) return "—";
    const [data, hora] = String(iso).split(" ");
    const [a, m, d] = data.split("-");
    return `${d}/${m}/${a} ${(hora || "").slice(0, 5)}`;
}

function _audEsc(v) {
    return String(v ?? "")
        .replace(/&/g, "&amp;").replace(/</g, "&lt;")
        .replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

/* SEM auto-execução — o main.js chama iniciarModuloAuditoria() */