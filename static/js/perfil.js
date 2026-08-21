/**
 * CronaSys — static/js/perfil.js
 * -------------------------------------------------------
 * Tela "Meu Perfil" (autoatendimento — qualquer usuário logado).
 * Edita só dados pessoais: foto, nome, e-mail, telefone, aniversário e senha.
 * main.js chama iniciarModuloPerfil().
 *
 * Rotas:
 *   GET /api/perfil  → dados do próprio usuário
 *   PUT /api/perfil  → salva alterações do próprio usuário
 */

let _perfilFoto = "";          // data URL atual (preview)
let _perfilFotoTocada = false; // o usuário mexeu na foto nesta sessão da tela?

function iniciarModuloPerfil() {
    console.log("[Perfil] init");
    _perfilVincular();
    _perfilCarregar();
    if (window.cronaSyncTemaUI) window.cronaSyncTemaUI();
}

function _perfilVincular() {
    document.getElementById("btnTrocarFoto")
        ?.addEventListener("click", () => document.getElementById("perfilFotoInput")?.click());
    document.getElementById("perfilFotoInput")
        ?.addEventListener("change", _perfilSelecionarFoto);
    document.getElementById("btnRemoverFoto")
        ?.addEventListener("click", _perfilRemoverFoto);
    document.getElementById("btnSalvarPerfil")
        ?.addEventListener("click", _perfilSalvar);
    document.getElementById("perfilNome")
        ?.addEventListener("input", _perfilPintarAvatar);
}

/* ── Carregar ─────────────────────────────────── */
async function _perfilCarregar() {
    try {
        const res = await fetch("/api/perfil", { headers: _perfilAuth() });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const p = await res.json();

        document.getElementById("perfilNome").value = p.nome || "";
        document.getElementById("perfilEmail").value = p.email || "";
        document.getElementById("perfilCelular").value = _perfilFmtTel(p.celular);
        document.getElementById("perfilAniversario").value = p.data_aniversario || "";
        document.getElementById("perfilMatricula").textContent = p.matricula || "—";
        document.getElementById("perfilCargo").textContent = p.cargo || "—";
        document.getElementById("perfilSetor").textContent = p.nome_setor || "—";
        document.getElementById("perfilAcesso").textContent = p.tipo_acesso === "ADM" ? "Administrador" : "Padrão";

        _perfilFoto = p.foto_perfil || "";
        _perfilFotoTocada = false;
        _perfilPintarAvatar();
    } catch (e) {
        console.error("[Perfil]", e);
        _perfilNotificar("Erro ao carregar o perfil.", "erro");
    }
}

function _perfilPintarAvatar() {
    const el = document.getElementById("perfilAvatar");
    if (!el) return;
    if (_perfilFoto) {
        el.innerHTML = `<img src="${_perfilFoto}" alt="Foto de perfil">`;
    } else {
        el.textContent = _perfilIniciais(document.getElementById("perfilNome")?.value || "");
    }
    const btnRem = document.getElementById("btnRemoverFoto");
    if (btnRem) btnRem.style.display = _perfilFoto ? "inline-block" : "none";
}

/* ── Foto ─────────────────────────────────────── */
async function _perfilSelecionarFoto(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
        _perfilNotificar("Escolha um arquivo de imagem.", "erro");
        e.target.value = "";
        return;
    }
    try {
        _perfilFoto = await _perfilRedimensionar(file);
        _perfilFotoTocada = true;
        _perfilPintarAvatar();
    } catch {
        _perfilNotificar("Não foi possível processar a imagem.", "erro");
    }
    e.target.value = "";
}

function _perfilRemoverFoto() {
    _perfilFoto = "";
    _perfilFotoTocada = true;
    _perfilPintarAvatar();
}

/* Redimensiona a imagem para um quadrado de 256px (corte central) e
   devolve um data URL JPEG leve — pronto para guardar no banco. */
function _perfilRedimensionar(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
            const img = new Image();
            img.onload = () => {
                const size = 256;
                const canvas = document.createElement("canvas");
                canvas.width = size;
                canvas.height = size;
                const ctx = canvas.getContext("2d");
                const min = Math.min(img.width, img.height);
                const sx = (img.width - min) / 2;
                const sy = (img.height - min) / 2;
                ctx.drawImage(img, sx, sy, min, min, 0, 0, size, size);
                resolve(canvas.toDataURL("image/jpeg", 0.82));
            };
            img.onerror = reject;
            img.src = reader.result;
        };
        reader.onerror = reject;
        reader.readAsDataURL(file);
    });
}

/* ── Salvar ───────────────────────────────────── */
async function _perfilSalvar() {
    _perfilEsconderErro();
    const nome = document.getElementById("perfilNome").value.trim();
    const email = document.getElementById("perfilEmail").value.trim();
    const senha = document.getElementById("perfilSenha").value;
    const senha2 = document.getElementById("perfilSenha2").value;

    if (!nome) return _perfilMostrarErro("Informe seu nome.");
    if (!email) return _perfilMostrarErro("Informe seu e-mail.");
    if (senha || senha2) {
        if (senha !== senha2) return _perfilMostrarErro("As senhas não conferem.");
        if (senha.length < 8) return _perfilMostrarErro("A nova senha deve ter pelo menos 8 caracteres.");
    }

    /* Celular: valida o formato se preenchido (reusa o validador global) */
    const celLimpo = document.getElementById("perfilCelular").value.replace(/\D/g, "");
    if (celLimpo && typeof _funcValidarCelular === "function" && !_funcValidarCelular(celLimpo)) {
        return _perfilMostrarErro("Celular inválido. Use (DD) 9XXXX-XXXX.");
    }

    const corpo = {
        nome,
        email,
        celular: document.getElementById("perfilCelular").value,
        data_aniversario: document.getElementById("perfilAniversario").value || null,
    };
    if (_perfilFotoTocada) corpo.foto_perfil = _perfilFoto;
    if (senha) corpo.senha = senha;

    const btn = document.getElementById("btnSalvarPerfil");
    btn.disabled = true;
    try {
        const res = await fetch("/api/perfil", {
            method: "PUT",
            headers: _perfilAuthJson(),
            body: JSON.stringify(corpo),
        });
        const json = await res.json();
        if (!res.ok) throw new Error(json.message || `Erro ${res.status}`);

        document.getElementById("perfilSenha").value = "";
        document.getElementById("perfilSenha2").value = "";
        _perfilFotoTocada = false;

        // Atualiza a barra lateral (nome + foto) na hora.
        if (typeof window.cronaAtualizarUsuarioLogado === "function") {
            window.cronaAtualizarUsuarioLogado({ nome, foto_perfil: _perfilFoto });
        }
        _perfilNotificar("Perfil atualizado!", "sucesso");
    } catch (e) {
        _perfilMostrarErro(e.message);
    } finally {
        btn.disabled = false;
    }
}

/* ── Helpers ──────────────────────────────────── */
function _perfilAuth() {
    return typeof window.cronaAuthHeaders === "function" ? window.cronaAuthHeaders() : {};
}
function _perfilAuthJson() {
    return { "Content-Type": "application/json", ..._perfilAuth() };
}

function _perfilIniciais(nome) {
    return String(nome || "")
        .trim().split(/\s+/).filter(Boolean).slice(0, 2)
        .map(p => p[0].toUpperCase()).join("") || "--";
}

function _perfilFmtTel(digitos) {
    const d = String(digitos || "").replace(/\D/g, "");
    if (d.length === 11) return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
    if (d.length === 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
    return d;
}

function _perfilMostrarErro(msg) {
    const div = document.getElementById("perfilErro");
    const span = document.getElementById("perfilErroMsg");
    if (span) span.textContent = msg;
    if (div) div.style.display = "flex";
}
function _perfilEsconderErro() {
    const div = document.getElementById("perfilErro");
    if (div) div.style.display = "none";
}

function _perfilNotificar(msg, tipo = "sucesso") {
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
        display:flex;align-items:center;gap:10px;box-shadow:0 4px 12px rgba(0,0,0,.1);max-width:380px;`;
    el.innerHTML = `<i class="fa-solid ${c.icone}"></i> ${String(msg || "").replace(/</g, "&lt;")}`;
    document.body.appendChild(el);
    setTimeout(() => el.remove(), 3500);
}

/* SEM auto-execução — o main.js chama iniciarModuloPerfil() */