/**
 * CronaSys — static/js/solicitacoes.js
 * -------------------------------------------------------
 * Carregado UMA VEZ no index.html.
 * Chamado pelo main.js: iniciarModuloSolicitacoes()
 *
 * Fluxo:
 *   - Qualquer usuário logado pode abrir uma solicitação
 *     (data + tipo de ocorrência + mensagem).
 *   - A lista é dividida em 3 abas: Pendentes / Aprovados / Negados.
 *   - Só o administrador vê a coluna "Funcionário" e os botões de
 *     Aprovar/Negar — um funcionário comum só vê as próprias.
 *
 * Prefixo _sol_ em todas as funções privadas.
 */

let _solAbaAtual = 'Pendente';

function _solUsuarioEhAdmin() {
    return typeof window.cronaUsuarioEhAdmin === 'function' && window.cronaUsuarioEhAdmin();
}

function _solAuthHeaders() {
    return typeof window.cronaAuthHeaders === 'function' ? window.cronaAuthHeaders() : {};
}

function _solHeadersJson() {
    return { 'Content-Type': 'application/json', ..._solAuthHeaders() };
}

/* ================================================================
   PONTO DE ENTRADA
================================================================ */
function iniciarModuloSolicitacoes() {
    _solAbaAtual = 'Pendente';

    _solAplicarPermissoes();
    _solBindTabs();
    _solBindFormulario();
    _solCarregar();
}

function _solAplicarPermissoes() {
    const admin = _solUsuarioEhAdmin();
    document.querySelectorAll('.sol-col-admin').forEach(el => {
        el.classList.toggle('sol-oculta', !admin);
    });
}

/* ================================================================
   ABAS (Pendentes / Aprovados / Negados)
================================================================ */
function _solBindTabs() {
    document.querySelectorAll('#solTabs button').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('#solTabs button').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            _solAbaAtual = btn.dataset.status;
            _solCarregar();
        });
    });
}

/* ================================================================
   FORMULÁRIO — Nova solicitação
================================================================ */
function _solBindFormulario() {
    document.getElementById('btnEnviarSolicitacao')?.addEventListener('click', _solEnviar);

    // Limita a data a hoje (não faz sentido solicitar ajuste de dia futuro)
    const campoData = document.getElementById('solData');
    if (campoData) campoData.max = new Date().toISOString().slice(0, 10);
}

function _solMostrarErro(mensagem) {
    const box = document.getElementById('solFormErro');
    const msg = document.getElementById('solFormErroMsg');
    if (msg) msg.textContent = mensagem;
    if (box) box.style.display = 'flex';
}

function _solLimparErro() {
    const box = document.getElementById('solFormErro');
    if (box) box.style.display = 'none';
}

async function _solEnviar() {
    _solLimparErro();

    const data = document.getElementById('solData')?.value;
    const ocorrencia = document.getElementById('solOcorrencia')?.value;
    const mensagem = document.getElementById('solMensagem')?.value?.trim();

    if (!data) return _solMostrarErro('Informe a data.');
    if (!mensagem) return _solMostrarErro('Explique o motivo da solicitação.');

    const botao = document.getElementById('btnEnviarSolicitacao');
    if (botao) { botao.disabled = true; botao.style.opacity = '0.6'; }

    try {
        const res = await fetch('/api/solicitacoes/', {
            method: 'POST',
            headers: _solHeadersJson(),
            body: JSON.stringify({ data_ref: data, ocorrencia, mensagem }),
        });
        const corpo = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(corpo.message || `HTTP ${res.status}`);

        document.getElementById('solData').value = '';
        document.getElementById('solMensagem').value = '';

        window.cronaAlert?.({ titulo: 'Solicitação enviada', mensagem: corpo.message || 'Enviada com sucesso!' });

        // Se a aba atual é "Pendentes", já mostra a nova solicitação.
        if (_solAbaAtual === 'Pendente') _solCarregar();
    } catch (err) {
        console.error('[Solicitacoes] enviar:', err);
        _solMostrarErro(err.message || 'Erro ao enviar solicitação.');
    } finally {
        if (botao) { botao.disabled = false; botao.style.opacity = ''; }
    }
}

/* ================================================================
   LISTAGEM
================================================================ */
async function _solCarregar() {
    const corpo = document.getElementById('corpoSolicitacoes');
    if (corpo) {
        corpo.innerHTML = `<tr><td colspan="7" class="sol-carregando">
            <i class="fa-solid fa-circle-notch fa-spin"></i><p>Carregando...</p></td></tr>`;
    }

    try {
        const res = await fetch(`/api/solicitacoes/?status=${encodeURIComponent(_solAbaAtual)}`, {
            headers: _solAuthHeaders(),
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);

        const lista = await res.json();
        _solRenderizar(lista);
    } catch (err) {
        console.error('[Solicitacoes] carregar:', err);
        if (corpo) corpo.innerHTML = `<tr><td colspan="7" class="sol-vazia">
            <i class="fa-solid fa-triangle-exclamation"></i><p>Erro ao carregar solicitações.</p></td></tr>`;
    }
}

function _solRenderizar(lista) {
    const corpo = document.getElementById('corpoSolicitacoes');
    if (!corpo) return;

    const admin = _solUsuarioEhAdmin();

    if (!lista.length) {
        corpo.innerHTML = `<tr><td colspan="7" class="sol-vazia">
            <i class="fa-solid fa-inbox"></i><p>Nenhuma solicitação ${_solLabelAba().toLowerCase()}.</p></td></tr>`;
        return;
    }

    corpo.innerHTML = lista.map(s => `
        <tr>
            <td class="sol-data">${_solFormatarData(s.data_ref)}</td>
            <td class="sol-col-admin ${admin ? '' : 'sol-oculta'}">${_solEscapar(s.nome_funcionario)}</td>
            <td>${_solEscapar(s.ocorrencia)}</td>
            <td class="sol-msg">${_solEscapar(s.mensagem)}</td>
            <td class="sol-quem">${s.data_solicitacao || '—'}</td>
            <td class="sol-quem">${s.nome_aprovador ? _solEscapar(s.nome_aprovador) : '—'}</td>
            <td class="sol-col-admin ${admin ? '' : 'sol-oculta'}">
                ${s.status === 'Pendente' && admin ? `
                    <div class="sol-acoes">
                        <button class="sol-btn-aprovar" onclick="_solResponder(${s.id_solicitacao}, 'aprovar')">
                            <i class="fa-solid fa-check"></i> Aprovar
                        </button>
                        <button class="sol-btn-negar" onclick="_solResponder(${s.id_solicitacao}, 'negar')">
                            <i class="fa-solid fa-xmark"></i> Negar
                        </button>
                    </div>
                ` : '—'}
            </td>
        </tr>
    `).join('');
}

async function _solResponder(id, acao) {
    const ok = await window.cronaConfirm?.({
        titulo: acao === 'aprovar' ? 'Aprovar solicitação' : 'Negar solicitação',
        mensagem: acao === 'aprovar'
            ? 'Confirma a aprovação? Lembre-se de aplicar o ajuste na tela de Gestão de Ponto.'
            : 'Confirma que deseja negar esta solicitação?',
        textoOk: acao === 'aprovar' ? 'Aprovar' : 'Negar',
    });
    if (!ok) return;

    try {
        const res = await fetch(`/api/solicitacoes/${id}/${acao}`, {
            method: 'PATCH',
            headers: _solAuthHeaders(),
        });
        const corpo = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(corpo.message || `HTTP ${res.status}`);

        _solCarregar();
    } catch (err) {
        console.error('[Solicitacoes] responder:', err);
        window.cronaAlert?.({ titulo: 'Erro', mensagem: err.message || 'Não foi possível responder a solicitação.' });
    }
}

/* ================================================================
   HELPERS
================================================================ */
function _solLabelAba() {
    return { Pendente: 'Pendente', Aprovado: 'Aprovada', Negado: 'Negada' }[_solAbaAtual] || _solAbaAtual;
}

function _solFormatarData(dataRef) {
    if (!dataRef) return '—';
    const [ano, mes, dia] = dataRef.split('-');
    return `${dia}/${mes}/${ano}`;
}

function _solEscapar(texto) {
    const div = document.createElement('div');
    div.textContent = texto ?? '';
    return div.innerHTML;
}