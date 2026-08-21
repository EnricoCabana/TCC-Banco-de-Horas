/**
 * CronaSys — static/js/backup.js
 * -------------------------------------------------------
 * Tela de Backup do banco — somente admin.
 * main.js chama iniciarModuloBackup().
 *
 * Rotas:
 *   POST /api/backup/baixar → gera e devolve o .sql para download
 *   POST /api/backup/email  → gera e envia o .sql por e-mail
 */

function iniciarModuloBackup() {
    console.log("[Backup] init");
    document.getElementById("btnBkpBaixar")?.addEventListener("click", _bkpBaixar);
    document.getElementById("btnBkpImportar")?.addEventListener("click", () => document.getElementById("bkpArquivo")?.click());
    document.getElementById("bkpArquivo")?.addEventListener("change", _bkpImportar);
}

/* Baixar: gera o backup e faz o download no navegador. */
async function _bkpBaixar() {
    const _senhaBaixar = await window.cronaConfirmSenha({
        titulo: 'Baixar backup',
        mensagem: 'O arquivo de backup contém todos os dados do sistema. Digite sua senha para confirmar o download.',
        textoOk: 'Baixar',
    });
    if (!_senhaBaixar) return;
    const btn = document.getElementById("btnBkpBaixar");
    _bkpBloquear(btn, true, "Gerando...");
    _bkpStatus("Gerando o backup, aguarde...", "carregando");
    try {
        const res = await fetch("/api/backup/baixar", { method: "POST", headers: _bkpAuth() });
        if (!res.ok) {
            // Quando falha, o backend responde em JSON (não é o arquivo).
            let msg = `Erro ${res.status}`;
            try { const j = await res.json(); msg = j.message || msg; } catch { /* ignora */ }
            throw new Error(msg);
        }
        const blob = await res.blob();
        _bkpDownloadBlob(blob, _bkpNomeArquivo(res) || "cronasys-backup.zip");
        _bkpStatus("Backup gerado e baixado (.zip com verificação de integridade).", "ok");
    } catch (e) {
        _bkpStatus(e.message || "Erro ao gerar o backup.", "erro");
    } finally {
        _bkpBloquear(btn, false);
    }
}

/* Restaurar: sobe um .sql e recarrega o banco (destrutivo — pede confirmação). */
async function _bkpImportar(ev) {
    const input = ev.target;
    const arquivo = input.files && input.files[0];
    if (!arquivo) return;

    const _senhaRestore = await window.cronaConfirmSenha({
        titulo: 'Restaurar backup',
        mensagem: `Restaurar a partir de "${arquivo.name}"? ATENÇÃO: isso vai SOBRESCREVER todos os dados atuais do banco e não pode ser desfeito. Digite sua senha para confirmar.`,
        textoOk: 'Restaurar',
    });
    if (!_senhaRestore) { input.value = ""; return; }

    const btn = document.getElementById("btnBkpImportar");
    _bkpBloquear(btn, true, "Restaurando...");
    _bkpStatus("Restaurando o banco, aguarde...", "carregando");
    try {
        /* Envia o arquivo como binário: o .zip não pode passar por conversão
           para texto, senão corrompe. O backend aceita .zip e .sql. */
        const conteudo = await arquivo.arrayBuffer();
        const res = await fetch("/api/backup/importar", {
            method: "POST",
            headers: { ..._bkpAuth(), "Content-Type": "application/octet-stream" },
            body: conteudo,
        });
        const json = await res.json();
        if (!res.ok) throw new Error(json.message || `Erro ${res.status}`);
        _bkpStatus(json.message || "Backup restaurado com sucesso.", "ok");
    } catch (e) {
        _bkpStatus(e.message || "Erro ao restaurar o backup.", "erro");
    } finally {
        _bkpBloquear(btn, false);
        input.value = "";
    }
}

/* ── helpers ── */
function _bkpAuth() {
    return typeof window.cronaAuthHeaders === "function" ? window.cronaAuthHeaders() : {};
}

function _bkpStatus(msg, tipo) {
    const div = document.getElementById("bkpStatus");
    if (!div) return;
    const icone = { ok: "fa-circle-check", erro: "fa-circle-exclamation", carregando: "fa-circle-notch fa-spin" }[tipo] || "fa-circle-info";
    div.className = `bkp-status ${tipo}`;
    div.innerHTML = `<i class="fa-solid ${icone}"></i> <span>${String(msg || "").replace(/</g, "&lt;")}</span>`;
    div.style.display = "flex";
}

function _bkpBloquear(btn, bloquear, texto) {
    if (!btn) return;
    if (bloquear) {
        btn._orig = btn.innerHTML;
        btn.disabled = true;
        btn.innerHTML = `<i class="fa-solid fa-circle-notch fa-spin"></i> ${texto || "Aguarde..."}`;
    } else {
        btn.disabled = false;
        if (btn._orig) btn.innerHTML = btn._orig;
    }
}

/* Lê o nome do arquivo do cabeçalho Content-Disposition. */
function _bkpNomeArquivo(res) {
    const cd = res.headers.get("Content-Disposition") || "";
    const m = cd.match(/filename="?([^"]+)"?/i);
    return m ? m[1] : null;
}

/* Dispara o download de um Blob no navegador. */
function _bkpDownloadBlob(blob, nome) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = nome;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
}