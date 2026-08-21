/**
 * CronaSys — static/js/avisos.js
 * -------------------------------------------------------
 * Carregado UMA VEZ no index.html.
 * Chamado pelo main.js: iniciarModuloAvisos()
 *
 * Prefixo _av_ em todas as funções privadas.
 */

let _avFiltroTipo    = 'todos';
let _avFiltroPeriodo = 'hoje';
let _avDataEspec     = null;
let _avVistosSnapshot = new Set();

function _avUsuarioEhAdmin() {
    return typeof window.cronaUsuarioEhAdmin === 'function' && window.cronaUsuarioEhAdmin();
}

function _avAuthHeaders() {
    return typeof window.cronaAuthHeaders === 'function' ? window.cronaAuthHeaders() : {};
}

function _avHeadersJson() {
    return { 'Content-Type': 'application/json', ..._avAuthHeaders() };
}

/* ================================================================
   PONTO DE ENTRADA
================================================================ */
function iniciarModuloAvisos() {
    _avFiltroTipo    = 'todos';
    _avFiltroPeriodo = 'hoje';
    _avVistosSnapshot = _avCarregarVistos();
    _avDataEspec     = null;

    _avAplicarPermissoes();
    _avBindFormulario();
    _avBindFiltros();
    _avCarregar();
}

function _avAplicarPermissoes() {
    const admin = _avUsuarioEhAdmin();
    const btnNovo = document.getElementById('btnAbrirFormAviso');
    const form = document.getElementById('cardFormAviso');

    if (btnNovo) btnNovo.style.display = admin ? '' : 'none';
    if (form && !admin) form.style.display = 'none';
}

/* ================================================================
   BIND — Formulário
================================================================ */
function _avBindFormulario() {
    if (!_avUsuarioEhAdmin()) return;

    document.getElementById('btnAbrirFormAviso')
        ?.addEventListener('click', () => {
            _avLimparForm();
            const card = document.getElementById('cardFormAviso');
            if (card) {
                card.style.display = '';
                card.scrollIntoView({ behavior:'smooth', block:'start' });
            }
        });

    document.getElementById('btnCancelarAviso')
        ?.addEventListener('click', () => {
            const card = document.getElementById('cardFormAviso');
            if (card) card.style.display = 'none';
            _avLimparForm();
        });

    document.getElementById('btnSalvarAviso')?.addEventListener('click', _avSalvar);

    /* Chips de tipo no formulário */
    document.querySelectorAll('#avTipoGrid .av-tipo-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('#avTipoGrid .av-tipo-btn')
                .forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
        });
    });
}

/* ================================================================
   BIND — Filtros
================================================================ */
function _avBindFiltros() {
    document.querySelectorAll('#filtroTipoChips .av-chip').forEach(chip => {
        chip.addEventListener('click', () => {
            document.querySelectorAll('#filtroTipoChips .av-chip')
                .forEach(c => c.classList.remove('active'));
            chip.classList.add('active');
            _avFiltroTipo = chip.dataset.tipo;
            _avDataEspec  = null;
            _avCarregar();
        });
    });

    document.querySelectorAll('#filtroPeriodoChips .av-chip').forEach(chip => {
        chip.addEventListener('click', () => {
            document.querySelectorAll('#filtroPeriodoChips .av-chip')
                .forEach(c => c.classList.remove('active'));
            chip.classList.add('active');
            _avFiltroPeriodo = chip.dataset.periodo;
            _avDataEspec     = null;
            const inp = document.getElementById('filtroDataEspecifica');
            if (inp) inp.value = '';
            const btnL = document.getElementById('btnLimparData');
            if (btnL) btnL.style.display = 'none';
            _avCarregar();
        });
    });

    document.getElementById('btnFiltrarData')?.addEventListener('click', () => {
        const val = document.getElementById('filtroDataEspecifica')?.value;
        if (!val) return;
        _avDataEspec     = val;
        _avFiltroPeriodo = null;
        document.querySelectorAll('#filtroPeriodoChips .av-chip')
            .forEach(c => c.classList.remove('active'));
        const btnL = document.getElementById('btnLimparData');
        if (btnL) btnL.style.display = '';
        _avCarregar();
    });

    document.getElementById('btnLimparData')?.addEventListener('click', () => {
        _avDataEspec     = null;
        _avFiltroPeriodo = 'hoje';
        const inp = document.getElementById('filtroDataEspecifica');
        if (inp) inp.value = '';
        document.getElementById('btnLimparData').style.display = 'none';
        document.querySelectorAll('#filtroPeriodoChips .av-chip').forEach(c => {
            c.classList.toggle('active', c.dataset.periodo === 'hoje');
        });
        _avCarregar();
    });
}

/* ================================================================
   API — Carregar  →  GET /api/avisos
================================================================ */
async function _avCarregar() {
    const listagem = document.getElementById('avListagem');
    const resumo   = document.getElementById('avResumoTopo');
    if (!listagem) return;

    listagem.innerHTML = `
        <div class="av-loading">
            <i class="fa-solid fa-circle-notch fa-spin"></i>
            <p>Carregando avisos...</p>
        </div>`;
    if (resumo) resumo.style.display = 'none';

    try {
        const params = new URLSearchParams();
        if (_avFiltroTipo && _avFiltroTipo !== 'todos') params.set('tipo', _avFiltroTipo);

        if (_avDataEspec) {
            params.set('data', _avDataEspec);
        } else if (_avFiltroPeriodo) {
            params.set('periodo', _avFiltroPeriodo);
        }

        const resp = await fetch(`/api/avisos?${params}`, { headers: _avAuthHeaders() });
        if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
        const avisos = await resp.json();

        _avRenderizar(avisos, listagem, resumo);

    } catch (err) {
        console.error('[Avisos]', err);
        listagem.innerHTML = `
            <div class="av-empty">
                <i class="fa-solid fa-triangle-exclamation av-empty-icon"></i>
                <h3>Erro ao carregar avisos</h3>
                <p>Verifique a conexão com o servidor.</p>
            </div>`;
    }
}

/* ================================================================
   RENDER
================================================================ */
/* Selo "Novo": avisos ainda não vistos por este usuário (localStorage). */
function _avChaveVistos() {
    const u = (typeof usuarioAtual === 'function' ? usuarioAtual() : null) || {};
    const id = u.id != null ? u.id : 'anon';
    return `cronaAvisosVistos_${id}`;
}
function _avCarregarVistos() {
    try { const raw = localStorage.getItem(_avChaveVistos()); return new Set(raw ? JSON.parse(raw) : []); }
    catch (e) { return new Set(); }
}
function _avSalvarVistos(set) {
    try { localStorage.setItem(_avChaveVistos(), JSON.stringify([...set])); } catch (e) {}
}

function _avRenderizar(avisos, listagem, resumo) {
    if (resumo) {
        resumo.textContent = `${avisos.length} aviso${avisos.length !== 1 ? 's' : ''} encontrado${avisos.length !== 1 ? 's' : ''}`;
        resumo.style.display = avisos.length > 0 ? '' : 'none';
    }

    if (avisos.length === 0) {
        listagem.innerHTML = `
            <div class="av-empty">
                <i class="fa-regular fa-bell av-empty-icon"></i>
                <h3>Nenhum aviso</h3>
                <p>Nenhum aviso encontrado para este filtro.</p>
            </div>`;
        return;
    }

    listagem.innerHTML = `<div class="av-lista">${avisos.map(_avCardHTML).join('')}</div>`;

    const jaVistos = _avCarregarVistos();
    avisos.forEach(a => { if (a && a.id_aviso != null) jaVistos.add(a.id_aviso); });
    _avSalvarVistos(jaVistos);
}

function _avCardHTML(av) {
    const ICONES = { geral:'fa-bullhorn', importante:'fa-triangle-exclamation', comemorativo:'fa-champagne-glasses' };
    const LABELS = { geral:'Geral', importante:'Importante', comemorativo:'Comemorativo' };

    const tipo  = av.tipo || 'geral';
    const icone = ICONES[tipo] || 'fa-bullhorn';
    const label = LABELS[tipo] || tipo;
    const hora  = av.hora_criacao ? ` às ${av.hora_criacao}` : '';
    const dataCriada = av.data_criacao ? _avFormatarDataBR(av.data_criacao) : '';
    const quando = [dataCriada, hora.trim()].filter(Boolean).join(' ');
    const ehNovo = av.id_aviso != null && !_avVistosSnapshot.has(av.id_aviso);
    const badgeNovo = ehNovo ? `<span class="av-card-badge badge-novo">Novo</span>` : '';

    return `
    <div class="av-card tipo-${tipo}">
        <div class="av-card-icon"><i class="fa-solid ${icone}"></i></div>
        <div class="av-card-body">
            <div class="av-card-header">
                <div class="av-card-titulo">${_avEsc(av.titulo)}</div>
                <div class="av-card-meta">
                    ${badgeNovo}
                    <span class="av-card-badge badge-${tipo}">${label}</span>
                </div>
            </div>
            <div class="av-card-msg">${_avEsc(av.mensagem)}</div>
            <div class="av-card-footer">
                <span class="av-card-autor">
                    <i class="fa-solid fa-user-tie"></i>
                    ${_avEsc(av.autor || 'RH')}${quando ? ' · ' + quando : ''}
                </span>
                ${_avUsuarioEhAdmin() ? `<button class="av-btn-acao excluir" title="Excluir"
                    onclick="excluirAviso(${av.id_aviso})">
                    <i class="fa-solid fa-trash-can"></i>
                </button>` : ''}
            </div>
        </div>
    </div>`;
}

/* ================================================================
   API — Salvar  →  POST /api/avisos
================================================================ */
async function _avSalvar() {
    const titulo   = document.getElementById('avTitulo')?.value.trim();
    const mensagem = document.getElementById('avMensagem')?.value.trim();
    const tipoBtn  = document.querySelector('#avTipoGrid .av-tipo-btn.active');
    const tipo     = tipoBtn?.dataset.tipo || 'geral';

    if (!titulo)   return _avErroForm('Informe o título do aviso.');
    if (!mensagem) return _avErroForm('Escreva a mensagem.');

    document.getElementById('avFormErro').style.display = 'none';

    const btn = document.getElementById('btnSalvarAviso');
    if (btn) { btn.disabled = true; btn.innerHTML = '<i class="fa-solid fa-circle-notch fa-spin"></i> Publicando...'; }

    try {
        const resp = await fetch('/api/avisos', {
            method:  'POST',
            headers: _avHeadersJson(),
            body:    JSON.stringify({ titulo, mensagem, tipo }),
        });
        const dados = await resp.json();
        if (!resp.ok) throw new Error(dados.message || `HTTP ${resp.status}`);

        document.getElementById('cardFormAviso').style.display = 'none';
        _avLimparForm();

        await _avCarregar();
        _avNotificar(dados.message, 'sucesso');

    } catch (err) {
        _avErroForm(err.message || 'Erro ao publicar.');
    } finally {
        if (btn) {
            btn.disabled = false;
            btn.innerHTML = '<i class="fa-solid fa-paper-plane"></i> Publicar Aviso';
        }
    }
}

/* ================================================================
   API — Excluir (chamada via onclick no HTML)
================================================================ */
async function excluirAviso(id) {
    if (!_avUsuarioEhAdmin()) {
        _avNotificar('Apenas administradores podem excluir avisos.', 'erro');
        return;
    }

    if (!(await window.cronaConfirm({ titulo: 'Excluir aviso', mensagem: 'Excluir este aviso? Esta ação não pode ser desfeita.', textoOk: 'Excluir', perigo: true }))) return;
    try {
        const resp = await fetch(`/api/avisos/${id}`, { method: 'DELETE', headers: _avAuthHeaders() });
        if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
        await _avCarregar();
        _avNotificar('Aviso excluído.', 'info');
    } catch (err) {
        _avNotificar('Erro ao excluir: ' + err.message, 'erro');
    }
}

/* ================================================================
   HELPERS
================================================================ */
function _avLimparForm() {
    ['avTitulo','avMensagem'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.value = '';
    });
    document.querySelectorAll('#avTipoGrid .av-tipo-btn')
        .forEach((b, i) => b.classList.toggle('active', i === 0));

    const errEl = document.getElementById('avFormErro');
    if (errEl) errEl.style.display = 'none';
}

function _avErroForm(msg) {
    const div = document.getElementById('avFormErro');
    const txt = document.getElementById('avFormErroMsg');
    if (div) div.style.display = '';
    if (txt) txt.textContent   = msg;
}

function _avEsc(str) {
    return String(str ?? '')
        .replace(/&/g,'&amp;').replace(/</g,'&lt;')
        .replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

function _avFormatarDataBR(iso) {
    if (!iso) return '';
    const [y,m,d] = iso.split('-');
    return `${d}/${m}/${y}`;
}

function _avNotificar(msg, tipo = 'sucesso') {
    document.getElementById('cronaNotif')?.remove();
    const c = {
        sucesso: { bg:'#f0fdf4', borda:'#86efac', texto:'#166534', icone:'fa-circle-check' },
        info:    { bg:'#eff6ff', borda:'#93c5fd', texto:'#1e40af', icone:'fa-circle-info' },
        erro:    { bg:'#fef2f2', borda:'#fca5a5', texto:'#991b1b', icone:'fa-circle-exclamation' },
    }[tipo] || {};
    const el = document.createElement('div');
    el.id = 'cronaNotif';
    el.style.cssText = `position:fixed;top:20px;right:24px;z-index:9999;
        background:${c.bg};border:1px solid ${c.borda};color:${c.texto};
        border-radius: 0;padding:12px 18px;font-size:14px;font-weight:500;
        display:flex;align-items:center;gap:10px;
        box-shadow:0 4px 12px rgba(0,0,0,.1);max-width:380px;`;
    el.innerHTML = `<i class="fa-solid ${c.icone}"></i> ${_avEsc(msg)}`;
    document.body.appendChild(el);
    setTimeout(() => el.remove(), 4000);
}