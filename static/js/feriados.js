/**
 * CronaSys — static/js/feriados.js
 * -------------------------------------------------------
 * Tela de Gestão de Feriados.
 *   • Admin (RH): pode adicionar e excluir.
 *   • Acesso padrão: somente visualização (sem formulário e sem excluir).
 * Carregado UMA VEZ no index.html. main.js chama iniciarModuloFeriados().
 *
 * Rotas:
 *   GET    /api/feriados/:ano   → lista os feriados do ano
 *   POST   /api/feriados        → cadastra (admin)
 *   DELETE /api/feriados/:data  → remove (admin)
 */

const FER_DIAS = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];
const FER_MESES = [
    'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
    'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
];

let _ferLista = [];     /* lista completa do ano carregado */
let _ferAdmin = false;  /* o usuário logado é admin? */

/* ================================================================
   PONTO DE ENTRADA — chamado pelo main.js
================================================================ */
function iniciarModuloFeriados() {
    console.log('[Feriados] init');
    _ferAdmin = _ferEhAdmin();
    _ferAplicarPermissao();
    _ferPopularAnos();
    _ferPopularMeses();
    _ferVincularEventos();
    _ferCarregar();
}

/* Esconde o que é exclusivo de admin quando o acesso é padrão */
function _ferAplicarPermissao() {
    const cardAdd = document.getElementById('ferCardAdd');
    const thAcoes = document.getElementById('ferThAcoes');
    if (cardAdd) cardAdd.style.display = _ferAdmin ? '' : 'none';
    if (thAcoes) thAcoes.style.display = _ferAdmin ? '' : 'none';
}

/* ================================================================
   EVENTOS
================================================================ */
function _ferVincularEventos() {
    document.getElementById('ferAno')?.addEventListener('change', _ferCarregar);
    document.getElementById('ferMes')?.addEventListener('change', _ferAplicarFiltro);

    if (_ferAdmin) {
        document.getElementById('btnAddFeriado')?.addEventListener('click', _ferAdicionar);
        document.getElementById('ferDescricao')?.addEventListener('keydown', e => {
            if (e.key === 'Enter') _ferAdicionar();
        });
    }
}

/* Seletor de ano (ano anterior até dois à frente) */
function _ferPopularAnos() {
    const sel = document.getElementById('ferAno');
    if (!sel) return;
    const atual = new Date().getFullYear();
    sel.innerHTML = '';
    for (let a = atual - 1; a <= atual + 2; a++) {
        const op = document.createElement('option');
        op.value = a;
        op.textContent = a;
        if (a === atual) op.selected = true;
        sel.appendChild(op);
    }
}

/* Filtro de mês ("Todos" + Janeiro..Dezembro) */
function _ferPopularMeses() {
    const sel = document.getElementById('ferMes');
    if (!sel) return;
    sel.innerHTML = '<option value="">Todos os meses</option>';
    FER_MESES.forEach((nome, i) => {
        const op = document.createElement('option');
        op.value = i + 1;
        op.textContent = nome;
        sel.appendChild(op);
    });
}

function _ferAnoSelecionado() {
    return parseInt(document.getElementById('ferAno')?.value, 10) || new Date().getFullYear();
}

function _ferMesSelecionado() {
    return parseInt(document.getElementById('ferMes')?.value, 10) || 0; /* 0 = todos */
}

/* ================================================================
   CARREGAR LISTA  →  GET /api/feriados/:ano
================================================================ */
async function _ferCarregar() {
    const ano = _ferAnoSelecionado();
    const corpo = document.getElementById('corpoFeriados');
    document.getElementById('ferTituloLista').textContent = `Feriados de ${ano}`;
    corpo.innerHTML = `
        <tr><td colspan="${_ferColspan()}" class="fer-carregando">
            <i class="fa-solid fa-circle-notch fa-spin"></i> Carregando...
        </td></tr>`;

    try {
        const res = await fetch(`/api/feriados/${ano}`, { headers: _ferAuthHeaders() });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        _ferLista = await res.json();
        _ferAplicarFiltro();
    } catch (e) {
        console.error('[Feriados]', e);
        corpo.innerHTML = `
            <tr><td colspan="${_ferColspan()}" class="fer-vazia">
                <i class="fa-solid fa-wifi"></i>
                <p>Não foi possível carregar os feriados.</p>
                <small>Verifique se o servidor está em execução.</small>
            </td></tr>`;
    }
}

/* Aplica o filtro de mês sobre a lista já carregada */
function _ferAplicarFiltro() {
    const mes = _ferMesSelecionado();
    const filtrada = mes
        ? _ferLista.filter(f => Number(f.data.slice(5, 7)) === mes)
        : _ferLista;
    _ferRenderizar(filtrada);
}

function _ferRenderizar(lista) {
    const corpo = document.getElementById('corpoFeriados');
    const total = document.getElementById('ferTotal');

    total.textContent = `${lista.length} feriado${lista.length !== 1 ? 's' : ''}`;

    if (!lista.length) {
        corpo.innerHTML = `
            <tr><td colspan="${_ferColspan()}" class="fer-vazia">
                <i class="fa-regular fa-calendar"></i>
                <p>Nenhum feriado encontrado.</p>
                <small>${_ferAdmin ? 'Use o formulário acima para adicionar.' : 'Fale com o RH para incluir feriados.'}</small>
            </td></tr>`;
        return;
    }

    corpo.innerHTML = lista.map(f => {
        const [a, m, d] = f.data.split('-').map(Number);
        const dataObj = new Date(a, m - 1, d);
        const diaSemana = FER_DIAS[dataObj.getDay()];
        const dataBr = `${String(d).padStart(2, '0')}/${String(m).padStart(2, '0')}/${a}`;
        const acoes = _ferAdmin ? `
          <td>
            <div class="fer-acoes">
              <button class="btn-acao" title="Editar"
                      onclick="_ferEditar('${f.data}')">
                <i class="fa-solid fa-pen"></i>
              </button>
              <button class="btn-acao excluir" title="Excluir"
                      onclick="_ferExcluir('${f.data}')">
                <i class="fa-solid fa-trash"></i>
              </button>
            </div>
          </td>` : '';
        return `
        <tr>
          <td style="font-family:'Courier New',monospace;font-size:13px;">${dataBr}</td>
          <td style="color:#6b7280;">${diaSemana}</td>
          <td>${_ferEsc(f.descricao)}</td>
          <td>${_ferTipoBadge(f)}</td>
          ${acoes}
        </tr>`;
    }).join('');
}

/* Nº de colunas da tabela (3 para padrão, 4 para admin) */
function _ferColspan() {
    return _ferAdmin ? 5 : 4;
}

/* ================================================================
   ADICIONAR  →  POST /api/feriados   (somente admin)
================================================================ */
async function _ferAdicionar() {
    if (!_ferAdmin) return;
    _ferEsconderErro();
    const data = document.getElementById('ferData')?.value || '';
    const descricao = (document.getElementById('ferDescricao')?.value || '').trim();
    const tipo = document.getElementById('ferTipo')?.value || 'NACIONAL';

    if (!data) return _ferMostrarErro('Escolha a data do feriado.');
    if (!descricao) return _ferMostrarErro('Escreva a descrição do feriado.');

    const btn = document.getElementById('btnAddFeriado');
    btn.disabled = true;
    const editando = !!_ferEditandoData;

    try {
        const res = await fetch('/api/feriados', {
            method: 'POST',
            headers: _ferHeadersJson(),
            body: JSON.stringify({ data, descricao, tipo }),
        });
        const json = await res.json();
        if (!res.ok) throw new Error(json.message || `Erro ${res.status}`);

        _ferResetForm();

        /* Se a data for de outro ano disponível no seletor, troca para ele */
        const anoData = parseInt(data.slice(0, 4), 10);
        const sel = document.getElementById('ferAno');
        if (sel && parseInt(sel.value, 10) !== anoData &&
            [...sel.options].some(o => parseInt(o.value, 10) === anoData)) {
            sel.value = String(anoData);
        }

        await _ferCarregar();
        _ferNotificar(editando ? 'Feriado atualizado!' : 'Feriado adicionado!', 'sucesso');
    } catch (e) {
        _ferMostrarErro(e.message);
    } finally {
        btn.disabled = false;
    }
}

/* ---- edição ---- */
let _ferEditandoData = null;

function _ferAtualizarBotao() {
    const lbl = document.getElementById('btnAddFeriadoLabel');
    if (lbl) lbl.textContent = _ferEditandoData ? 'Salvar' : 'Adicionar';
}

function _ferResetForm() {
    ['ferData', 'ferDescricao'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.value = '';
    });
    const t = document.getElementById('ferTipo');
    if (t) t.value = 'NACIONAL';
    const dt = document.getElementById('ferData');
    if (dt) dt.readOnly = false;
    _ferEditandoData = null;
    _ferAtualizarBotao();
}

function _ferEditar(data) {
    if (!_ferAdmin) return;
    const f = (_ferLista || []).find(x => x.data === data);
    if (!f) return;
    document.getElementById('ferData').value      = f.data;
    document.getElementById('ferDescricao').value = f.descricao || '';
    document.getElementById('ferTipo').value      = (f.tipo || 'NACIONAL').toUpperCase();
    const dt = document.getElementById('ferData');
    if (dt) dt.readOnly = true;
    _ferEditandoData = data;
    _ferAtualizarBotao();
    document.getElementById('ferCardAdd')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function _ferTipoLabel(f) {
    const tipo = (f.tipo || 'NACIONAL').toUpperCase();
    if (tipo === 'MUNICIPAL') return 'Municipal';
    if (tipo === 'ESTADUAL')  return 'Estadual';
    return 'Nacional';
}

function _ferTipoBadge(f) {
    const tipo = (f.tipo || 'NACIONAL').toUpperCase();
    const cores = {
        NACIONAL:  ['var(--tint-blue)',   'var(--fg-blue)'],
        ESTADUAL:  ['var(--tint-orange)', '#ea580c'],
        MUNICIPAL: ['var(--tint-purple)', 'var(--fg-purple)'],
    };
    const [bg, fg] = cores[tipo] || cores.NACIONAL;
    return `<span style="display:inline-block;padding:3px 10px;border-radius: 0;font-size:12px;font-weight:600;background:${bg};color:${fg};white-space:nowrap;">${_ferTipoLabel(f)}</span>`;
}

/* ================================================================
   EXCLUIR  →  DELETE /api/feriados/:data   (somente admin)
================================================================ */
async function _ferExcluir(data) {
    if (!_ferAdmin) return;
    if (!(await window.cronaConfirm({ titulo: 'Excluir feriado', mensagem: 'Excluir este feriado?', textoOk: 'Excluir', perigo: true }))) return;

    try {
        const res = await fetch(`/api/feriados/${data}`, {
            method: 'DELETE',
            headers: _ferAuthHeaders(),
        });
        const json = await res.json();
        if (!res.ok) throw new Error(json.message || `Erro ${res.status}`);

        await _ferCarregar();
        _ferNotificar('Feriado removido.', 'info');
    } catch (e) {
        _ferNotificar(e.message, 'erro');
    }
}

/* ================================================================
   HELPERS
================================================================ */
function _ferEhAdmin() {
    return typeof window.cronaUsuarioEhAdmin === 'function' ? window.cronaUsuarioEhAdmin() : false;
}

function _ferAuthHeaders() {
    return typeof window.cronaAuthHeaders === 'function' ? window.cronaAuthHeaders() : {};
}

function _ferHeadersJson() {
    return { 'Content-Type': 'application/json', ..._ferAuthHeaders() };
}

function _ferMostrarErro(msg) {
    const div = document.getElementById('ferErro');
    const span = document.getElementById('ferErroMsg');
    if (span) span.textContent = msg;
    if (div) div.style.display = 'flex';
}

function _ferEsconderErro() {
    const div = document.getElementById('ferErro');
    if (div) div.style.display = 'none';
}

function _ferEsc(v) {
    return String(v ?? '')
        .replace(/&/g, '&amp;').replace(/</g, '&lt;')
        .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function _ferNotificar(msg, tipo = 'sucesso') {
    document.getElementById('cronaNotif')?.remove();
    const c = {
        sucesso: { bg: '#f0fdf4', borda: '#86efac', texto: '#166534', icone: 'fa-circle-check' },
        info: { bg: '#eff6ff', borda: '#93c5fd', texto: '#1e40af', icone: 'fa-circle-info' },
        erro: { bg: '#fef2f2', borda: '#fca5a5', texto: '#991b1b', icone: 'fa-circle-exclamation' },
    }[tipo] || {};
    const el = document.createElement('div');
    el.id = 'cronaNotif';
    el.style.cssText = `position:fixed;top:20px;right:24px;z-index:9999;
        background:${c.bg};border:1px solid ${c.borda};color:${c.texto};
        border-radius: 0;padding:12px 18px;font-size:14px;font-weight:500;
        display:flex;align-items:center;gap:10px;
        box-shadow:0 4px 12px rgba(0,0,0,.1);max-width:380px;`;
    el.innerHTML = `<i class="fa-solid ${c.icone}"></i> ${_ferEsc(msg)}`;
    document.body.appendChild(el);
    setTimeout(() => el.remove(), 3500);
}

/* SEM auto-execução — o main.js chama iniciarModuloFeriados() */