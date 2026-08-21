/* ================================================================
   setores.js — CRUD de setores (criar / editar / inativar).
   main.js chama iniciarModuloSetores() após injetar a página.
   Endpoints:
     GET   /api/setores/gerenciar     (todos, admin)
     POST  /api/setores               (criar)
     PUT   /api/setores/:id           (renomear)
     PATCH /api/setores/:id/ativo      (inativar/reativar)
================================================================ */

let _setLista = [];
let _setEditandoId = null;
const _setDetalheCarregado = new Set();

function iniciarModuloSetores() {
    _setLista = [];
    _setEditandoId = null;
    _setVincularEventos();
    _setCarregar();
}

function _setVincularEventos() {
    document.getElementById('btnAddSetor')?.addEventListener('click', _setSalvar);
    document.getElementById('btnCancelarSetor')?.addEventListener('click', _setResetForm);
    document.getElementById('setNome')?.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') _setSalvar();
    });
}

async function _setCarregar() {
    const corpo = document.getElementById('corpoSetores');
    try {
        const res = await fetch('/api/setores/gerenciar', { headers: _setAuthHeaders() });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        _setLista = await res.json();
        _setRenderizar();
    } catch (err) {
        console.error('[Setores] carregar:', err);
        if (corpo) corpo.innerHTML = `<tr><td colspan="4" class="set-vazia">
            <i class="fa-solid fa-triangle-exclamation"></i> Erro ao carregar setores.</td></tr>`;
    }
}

function _setRenderizar() {
    const corpo = document.getElementById('corpoSetores');
    const total = document.getElementById('setTotal');
    if (!corpo) return;

    if (total) {
        const ativos = _setLista.filter(s => s.ativo).length;
        total.textContent = `${_setLista.length} setor${_setLista.length !== 1 ? 'es' : ''} · ${ativos} ativo${ativos !== 1 ? 's' : ''}`;
    }

    if (!_setLista.length) {
        corpo.innerHTML = `<tr><td colspan="4" class="set-vazia">
            <i class="fa-regular fa-folder-open"></i> Nenhum setor cadastrado ainda.</td></tr>`;
        return;
    }

    _setDetalheCarregado.clear();
    corpo.innerHTML = _setLista.map(s => {
        const qtd = s.qtd_funcionarios || 0;
        const badge = s.ativo
            ? '<span class="set-badge ativo">Ativo</span>'
            : '<span class="set-badge inativo">Inativo</span>';
        const acaoStatus = s.ativo
            ? `<button class="acao-inativar" title="Inativar"
                   onclick="event.stopPropagation(); _setToggleAtivo(${s.id_setor}, false)">
                   <i class="fa-solid fa-ban"></i> Inativar</button>`
            : `<button class="acao-reativar" title="Reativar"
                   onclick="event.stopPropagation(); _setToggleAtivo(${s.id_setor}, true)">
                   <i class="fa-solid fa-rotate-left"></i> Reativar</button>`;
        return `
        <tr class="set-row ${s.ativo ? '' : 'set-inativo'}" onclick="_setToggleDetalhe(${s.id_setor})">
            <td>
              <i class="fa-solid fa-chevron-right set-chevron" id="chevron-${s.id_setor}"></i>
              <strong>${_setEsc(s.nome_setor)}</strong>
            </td>
            <td style="text-align:center;"><span class="set-qtd">${qtd}</span></td>
            <td style="text-align:center;">${badge}</td>
            <td>
              <div class="set-acoes">
                <button title="Renomear" onclick="event.stopPropagation(); _setEditar(${s.id_setor})">
                  <i class="fa-solid fa-pen"></i> Editar</button>
                ${acaoStatus}
              </div>
            </td>
        </tr>
        <tr class="set-detalhe-row" id="detalhe-${s.id_setor}" style="display:none;">
          <td colspan="4">
            <div class="set-detalhe" id="detalhe-conteudo-${s.id_setor}">
              <div class="set-detalhe-load"><i class="fa-solid fa-circle-notch fa-spin"></i> Carregando funcionários...</div>
            </div>
          </td>
        </tr>`;
    }).join('');
}

async function _setSalvar() {
    _setEsconderErro();
    const nome = (document.getElementById('setNome')?.value || '').trim();
    if (!nome) return _setMostrarErro('Informe o nome do setor.');

    const editando = _setEditandoId !== null;
    const url = editando ? `/api/setores/${_setEditandoId}` : '/api/setores';
    const metodo = editando ? 'PUT' : 'POST';

    const btn = document.getElementById('btnAddSetor');
    btn.disabled = true;
    try {
        const res = await fetch(url, {
            method: metodo,
            headers: _setHeadersJson(),
            body: JSON.stringify({ nome_setor: nome }),
        });
        const json = await res.json();
        if (!res.ok) throw new Error(json.message || `Erro ${res.status}`);

        _setResetForm();
        await _setCarregar();
        _setNotificar(editando ? 'Setor atualizado!' : 'Setor criado!', 'sucesso');
    } catch (e) {
        _setMostrarErro(e.message);
    } finally {
        btn.disabled = false;
    }
}

function _setEditar(id) {
    const s = _setLista.find(x => x.id_setor === id);
    if (!s) return;
    _setEditandoId = id;
    document.getElementById('setNome').value = s.nome_setor || '';
    document.getElementById('setFormTitulo').textContent = 'Editar setor';
    document.getElementById('btnAddSetorLabel').textContent = 'Salvar';
    document.getElementById('btnCancelarSetor').style.display = '';
    document.getElementById('setCardAdd')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    document.getElementById('setNome')?.focus();
}

async function _setToggleAtivo(id, ativo) {
    const s = _setLista.find(x => x.id_setor === id);
    if (!ativo && s && s.qtd_funcionarios > 0) {
        const ok = await window.cronaConfirm({
            titulo: 'Inativar setor',
            mensagem: `O setor "${s.nome_setor}" tem ${s.qtd_funcionarios} funcionário(s). Inativar não mexe em quem já está nele — só esconde o setor na hora de cadastrar novos funcionários. Inativar mesmo assim?`,
            textoOk: 'Inativar',
        });
        if (!ok) return;
    }
    try {
        const res = await fetch(`/api/setores/${id}/ativo`, {
            method: 'PATCH',
            headers: _setHeadersJson(),
            body: JSON.stringify({ ativo }),
        });
        const json = await res.json();
        if (!res.ok) throw new Error(json.message || `Erro ${res.status}`);
        await _setCarregar();
        _setNotificar(json.message || 'Pronto!', 'sucesso');
    } catch (e) {
        _setNotificar(e.message, 'erro');
    }
}

async function _setToggleDetalhe(id) {
    const linha = document.getElementById(`detalhe-${id}`);
    const chevron = document.getElementById(`chevron-${id}`);
    if (!linha) return;
    const abrindo = linha.style.display === 'none';
    linha.style.display = abrindo ? '' : 'none';
    if (chevron) chevron.classList.toggle('aberto', abrindo);
    if (abrindo && !_setDetalheCarregado.has(id)) {
        await _setCarregarFuncionarios(id);
    }
}

async function _setCarregarFuncionarios(id) {
    const cont = document.getElementById(`detalhe-conteudo-${id}`);
    if (!cont) return;
    try {
        const res = await fetch(`/api/setores/${id}/funcionarios`, { headers: _setAuthHeaders() });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const funcs = await res.json();
        _setDetalheCarregado.add(id);

        if (!funcs.length) {
            cont.innerHTML = `<div class="set-detalhe-vazio">
                <i class="fa-regular fa-user"></i> Nenhum funcionário neste setor.</div>`;
            return;
        }

        cont.innerHTML = `
          <div class="set-detalhe-titulo">Funcionários do setor (${funcs.length})</div>
          <div class="set-func-lista">
            ${funcs.map(f => `
              <div class="set-func-item ${f.ativo ? '' : 'inativo'}">
                <span class="set-func-nome">
                  <i class="fa-solid fa-user"></i> ${_setEsc(f.nome)}
                  ${f.matricula ? `<small>${_setEsc(String(f.matricula))}</small>` : ''}
                  ${f.ativo ? '' : '<small class="set-tag-inativo">inativo</small>'}
                </span>
                <span class="set-func-cargo">${f.cargo ? _setEsc(f.cargo) : '<em>Sem cargo</em>'}</span>
              </div>`).join('')}
          </div>`;
    } catch (e) {
        console.error('[Setores] funcionários:', e);
        cont.innerHTML = `<div class="set-detalhe-vazio">Erro ao carregar funcionários.</div>`;
    }
}

function _setResetForm() {
    _setEditandoId = null;
    const nome = document.getElementById('setNome');
    if (nome) nome.value = '';
    document.getElementById('setFormTitulo').textContent = 'Adicionar setor';
    document.getElementById('btnAddSetorLabel').textContent = 'Adicionar';
    document.getElementById('btnCancelarSetor').style.display = 'none';
    _setEsconderErro();
}

/* ---- helpers ---- */
function _setAuthHeaders() {
    return typeof window.cronaAuthHeaders === 'function' ? window.cronaAuthHeaders() : {};
}
function _setHeadersJson() {
    return { 'Content-Type': 'application/json', ..._setAuthHeaders() };
}
function _setMostrarErro(msg) {
    const div = document.getElementById('setErro');
    const span = document.getElementById('setErroMsg');
    if (span) span.textContent = msg;
    if (div) div.style.display = 'flex';
}
function _setEsconderErro() {
    const div = document.getElementById('setErro');
    if (div) div.style.display = 'none';
}
function _setEsc(v) {
    return String(v ?? '')
        .replace(/&/g, '&amp;').replace(/</g, '&lt;')
        .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
function _setNotificar(msg, tipo = 'sucesso') {
    document.getElementById('cronaNotif')?.remove();
    const c = {
        sucesso: { bg: '#f0fdf4', borda: '#86efac', texto: '#166534', icone: 'fa-circle-check' },
        info:    { bg: '#eff6ff', borda: '#93c5fd', texto: '#1e40af', icone: 'fa-circle-info' },
        erro:    { bg: '#fef2f2', borda: '#fca5a5', texto: '#991b1b', icone: 'fa-circle-exclamation' },
    }[tipo] || {};
    const el = document.createElement('div');
    el.id = 'cronaNotif';
    el.style.cssText = `position:fixed;top:20px;right:24px;z-index:9999;
        background:${c.bg};border:1px solid ${c.borda};color:${c.texto};
        border-radius: 0;padding:12px 18px;font-size:14px;font-weight:500;
        display:flex;align-items:center;gap:10px;
        box-shadow:0 4px 12px rgba(0,0,0,.1);max-width:380px;`;
    el.innerHTML = `<i class="fa-solid ${c.icone}"></i> ${_setEsc(msg)}`;
    document.body.appendChild(el);
    setTimeout(() => el.remove(), 3500);
}

/* SEM auto-execução — o main.js chama iniciarModuloSetores() */