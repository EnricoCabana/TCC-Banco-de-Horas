/**
 * CronaSys — static/js/config-email.js
 * -------------------------------------------------------
 * Tela de Configuração de E-mail (SMTP) — somente admin.
 * main.js chama iniciarModuloConfigEmail().
 *
 * Rotas:
 *   GET  /api/email/config   → config atual (sem a senha)
 *   PUT  /api/email/config   → salva a config
 *   POST /api/email/testar   → envia um e-mail de teste
 */

function iniciarModuloConfigEmail() {
    console.log("[Config E-mail] init");
    document.getElementById("btnCfgSalvar")?.addEventListener("click", _cfgSalvar);
    document.getElementById("btnCfgTestar")?.addEventListener("click", _cfgTestar);
    document.getElementById("cfgPorta")?.addEventListener("change", _cfgSugerirSeguranca);
    _cfgCarregar();
}

async function _cfgCarregar() {
    try {
        const res = await fetch("/api/email/config", { headers: _cfgAuth() });
        if (!res.ok) throw new Error();
        const c = await res.json();

        document.getElementById("cfgHost").value = c.host || "";
        document.getElementById("cfgPorta").value = c.porta || 587;
        document.getElementById("cfgSeguranca").value = c.seguranca || "STARTTLS";
        document.getElementById("cfgUsuario").value = c.usuario || "";
        document.getElementById("cfgRemetenteNome").value = c.remetente_nome || "";
        document.getElementById("cfgRemetenteEmail").value = c.remetente_email || "";
        document.getElementById("cfgAtivo").checked = !!c.ativo;

        // Se já existe senha salva, avisa que pode deixar em branco para manter.
        const hint = document.getElementById("cfgSenhaHint");
        if (hint) hint.textContent = c.temSenha ? "(há uma senha salva — deixe vazio para manter)" : "";
    } catch {
        _cfgNotificar("Erro ao carregar a configuração.", "erro");
    }
}

/* Ajuda: ao trocar a porta, sugere a segurança correspondente. */
function _cfgSugerirSeguranca() {
    const porta = Number(document.getElementById("cfgPorta").value);
    const sel = document.getElementById("cfgSeguranca");
    if (porta === 465) sel.value = "SSL";
    else if (porta === 587) sel.value = "STARTTLS";
}

async function _cfgSalvar() {
    const _senhaCfg = await window.cronaConfirmSenha({
        titulo: 'Salvar configuração de e-mail',
        mensagem: 'Você está alterando a configuração de envio de e-mails do sistema. Digite sua senha para confirmar.',
        textoOk: 'Salvar',
    });
    if (!_senhaCfg) return;
    _cfgEsconderErro();
    const host = document.getElementById("cfgHost").value.trim();
    const usuario = document.getElementById("cfgUsuario").value.trim();
    if (!host) return _cfgErro("Informe o servidor (host).");
    if (!usuario) return _cfgErro("Informe o usuário (e-mail da conta).");

    const corpo = {
        host,
        porta: Number(document.getElementById("cfgPorta").value) || 587,
        seguranca: document.getElementById("cfgSeguranca").value,
        usuario,
        remetente_nome: document.getElementById("cfgRemetenteNome").value.trim(),
        remetente_email: document.getElementById("cfgRemetenteEmail").value.trim(),
        ativo: document.getElementById("cfgAtivo").checked,
    };
    const senha = document.getElementById("cfgSenha").value;
    if (senha) corpo.senha = senha; // vazio = mantém a atual

    const btn = document.getElementById("btnCfgSalvar");
    btn.disabled = true;
    try {
        const res = await fetch("/api/email/config", {
            method: "PUT", headers: _cfgAuthJson(), body: JSON.stringify(corpo),
        });
        const json = await res.json();
        if (!res.ok) throw new Error(json.message || `Erro ${res.status}`);
        document.getElementById("cfgSenha").value = "";
        _cfgNotificar("Configuração salva!", "sucesso");
        _cfgCarregar();
    } catch (e) {
        _cfgErro(e.message);
    } finally {
        btn.disabled = false;
    }
}

async function _cfgTestar() {
    const destino = document.getElementById("cfgTesteDestino").value.trim();
    if (!destino) return _cfgNotificar("Informe um e-mail de destino.", "erro");

    const btn = document.getElementById("btnCfgTestar");
    btn.disabled = true;
    const original = btn.innerHTML;
    btn.innerHTML = '<i class="fa-solid fa-circle-notch fa-spin"></i> Enviando...';
    try {
        const res = await fetch("/api/email/testar", {
            method: "POST", headers: _cfgAuthJson(), body: JSON.stringify({ destino }),
        });
        const json = await res.json();
        if (!res.ok) throw new Error(json.message || `Erro ${res.status}`);
        _cfgNotificar(json.message || "E-mail de teste enviado!", "sucesso");
    } catch (e) {
        _cfgNotificar(e.message, "erro");
    } finally {
        btn.disabled = false;
        btn.innerHTML = original;
    }
}

/* ── helpers ── */
function _cfgAuth() {
    return typeof window.cronaAuthHeaders === "function" ? window.cronaAuthHeaders() : {};
}
function _cfgAuthJson() {
    return { "Content-Type": "application/json", ..._cfgAuth() };
}
function _cfgErro(msg) {
    const div = document.getElementById("cfgErro");
    const span = document.getElementById("cfgErroMsg");
    if (span) span.textContent = msg;
    if (div) div.style.display = "flex";
}
function _cfgEsconderErro() {
    const div = document.getElementById("cfgErro");
    if (div) div.style.display = "none";
}
function _cfgNotificar(msg, tipo = "sucesso") {
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

/* SEM auto-execução — o main.js chama iniciarModuloConfigEmail() */