/**
 * CronaSys — static/js/funcionarios.js
 * -------------------------------------------------------
 * Carregado UMA VEZ no index.html.
 * Chamado pelo main.js: iniciarModuloFuncionarios()
 *
 * Prefixo _func_ em todas as funções privadas para
 * não colidir com outros módulos.
 *
 * Rotas consumidas:
 *   GET    /api/setores
 *   GET    /api/usuarios
 *   GET    /api/usuarios/:id   → dados completos para edição
 *   POST   /api/usuarios
 *   PUT    /api/usuarios/:id
 *   DELETE /api/usuarios/:id
 */

let _funcFuncionarios = [];

function _funcUsuarioPodeEditarSenha() {
    return typeof window.cronaUsuarioEhAdmin === 'function' && window.cronaUsuarioEhAdmin();
}

function _funcUsuarioAtual() {
    return typeof window.cronaUsuarioAtual === 'function' ? window.cronaUsuarioAtual() : null;
}

function _funcEhUsuarioAtual(idUsuario) {
    const usuario = _funcUsuarioAtual();
    return usuario?.id !== undefined && String(usuario.id) === String(idUsuario);
}

function _funcHeadersJson() {
    return {
        'Content-Type': 'application/json',
        ...(typeof window.cronaAuthHeaders === 'function' ? window.cronaAuthHeaders() : {}),
    };
}

function _funcAplicarPermissaoSenhaEdicao() {
    const grupoSenha = document.getElementById('eSenhaGrupo');
    const inputSenha = document.getElementById('eSenha');
    const podeEditar = _funcUsuarioPodeEditarSenha();

    if (grupoSenha) grupoSenha.style.display = podeEditar ? '' : 'none';
    if (!podeEditar && inputSenha) inputSenha.value = '';
}

/* ================================================================
   PONTO DE ENTRADA
================================================================ */
function _funcEhAdmin() {
    return typeof window.cronaUsuarioEhAdmin === 'function' && window.cronaUsuarioEhAdmin();
}

/* Acesso padrão: esconde o botão "Novo Funcionário" (só visualiza). */
function _funcAplicarPermissaoFuncionarios() {
    if (_funcEhAdmin()) return;
    const btnNovo = document.getElementById('btnAbrirFormulario');
    if (btnNovo) btnNovo.style.display = 'none';
}

/* Clique na linha: admin edita; acesso padrão vê só as infos básicas. */
function _funcClicarLinha(id) {
    if (_funcEhAdmin()) editarFuncionario(id);
    else _funcAbrirVisualizacao(id);
}

/* Modal somente-leitura para acesso padrão. */
async function _funcAbrirVisualizacao(id) {
    const overlay = document.getElementById('funcViewOverlay');
    overlay?.classList.add('aberto');
    document.body.style.overflow = 'hidden';
    const corpo = document.getElementById('funcViewCorpo');
    if (corpo) corpo.innerHTML = '<div style="padding:24px;text-align:center;color:var(--muted-2);"><i class="fa-solid fa-circle-notch fa-spin"></i> Carregando...</div>';
    try {
        const res = await fetch(`/api/usuarios/${id}`, { headers: window.cronaAuthHeaders() });
        const f = await res.json();
        if (!res.ok) throw new Error(f.message);
        const ini = _funcIniciais(f.nome);
        const cor = _funcCorAvatar(f.nome);
        const av  = f.foto_perfil
            ? `<img src="${f.foto_perfil}" alt="" style="width:100%;height:100%;object-fit:cover;border-radius:50%;display:block;">`
            : ini;
        const linha = (rotulo, valor) =>
            `<div class="func-view-linha"><span>${rotulo}</span><strong>${_funcEsc(valor || '—')}</strong></div>`;
        corpo.innerHTML = `
            <div class="func-view-header">
              <div class="func-view-avatar" style="background:${f.foto_perfil ? 'transparent' : cor};overflow:hidden;">${av}</div>
              <div class="func-view-nome">${_funcEsc(f.nome)}</div>
            </div>
            ${linha('Matrícula', f.matricula)}
            ${linha('Cargo', f.cargo)}
            ${linha('E-mail', f.email)}
            ${linha('Telefone', f.celular)}
            ${linha('Setor', f.nome_setor)}`;
    } catch (e) {
        if (corpo) corpo.innerHTML = '<div style="padding:24px;text-align:center;color:#dc2626;">Não foi possível carregar os dados.</div>';
    }
}
function _funcFecharVisualizacao() {
    document.getElementById('funcViewOverlay')?.classList.remove('aberto');
    document.body.style.overflow = '';
}

function iniciarModuloFuncionarios() {
    console.log('[Funcionários] init');
    _funcVincularEventos();
    _funcAplicarPermissaoFuncionarios();
    _funcAplicarPermissaoSenhaEdicao();
    _funcCarregarSetores();
    _funcCarregarLista();
}

/* ================================================================
   EVENTOS
================================================================ */
function _funcVincularEventos() {
    /* Botão abrir formulário */
    document.getElementById('btnAbrirFormulario')
        .addEventListener('click', () => _funcAbrirFormulario(false));

    /* Botão cancelar formulário */
    document.getElementById('btnCancelar')
        .addEventListener('click', _funcFecharFormulario);

    /* Botão salvar (cadastro) */
    document.getElementById('btnSalvar')
        .addEventListener('click', _funcSalvar);

    /* Botão salvar edição (modal) */
    document.getElementById('btnSalvarEdicao')
        .addEventListener('click', _funcSalvarEdicao);

    /* Fechar modal */
    document.getElementById('funcModalFechar')
        .addEventListener('click', _funcFecharModal);
    document.getElementById('funcModalCancelar')
        .addEventListener('click', _funcFecharModal);
    document.getElementById('funcModalOverlay')
        .addEventListener('click', e => {
            if (e.target.id === 'funcModalOverlay') _funcFecharModal();
        });

    /* Abas do formulário de cadastro */
    document.querySelectorAll('#formTabs .func-tab').forEach(btn => {
        btn.addEventListener('click', () => {
            _funcTrocarAba('formTabs', btn.dataset.tab);
        });
    });

    /* Abas do modal de edição */
    document.querySelectorAll('#modalTabs .func-tab').forEach(btn => {
        btn.addEventListener('click', () => {
            _funcTrocarAba('modalTabs', btn.dataset.tab);
            if (btn.dataset.tab === 'mtab-ferias') _funcFerAbrirAba();
        });
    });

    /* Aba Férias — navegação de mês (o salvamento acontece junto do
       "Salvar Alterações" principal do modal, veja _funcSalvarEdicao) */
    document.getElementById('btnFeriasMesAnterior')?.addEventListener('click', () => _funcFerMudarMes(-1));
    document.getElementById('btnFeriasProximoMes')?.addEventListener('click', () => _funcFerMudarMes(1));

    /* Modal de visualização (acesso padrão) */
    document.getElementById('funcViewFechar')?.addEventListener('click', _funcFecharVisualizacao);
    document.getElementById('funcViewOverlay')?.addEventListener('click', e => {
        if (e.target.id === 'funcViewOverlay') _funcFecharVisualizacao();
    });

    /* Fecha modais com ESC */
    document.addEventListener('keydown', e => {
        if (e.key === 'Escape') { _funcFecharModal(); _funcFecharVisualizacao(); }
    });
}

/* ================================================================
   ABAS — troca o painel ativo dentro de um container
================================================================ */
function _funcTrocarAba(containerId, tabId) {
    const container = document.getElementById(containerId);
    if (!container) return;

    /* Desativa todos os botões e painéis do container */
    container.querySelectorAll('.func-tab').forEach(b => b.classList.remove('active'));
    /* Painéis ficam no mesmo pai do container (irmãos seguintes) */
    const painel = container.closest('.card, .func-modal')
                            ?.querySelectorAll('.func-tab-panel');
    painel?.forEach(p => p.classList.remove('active'));

    /* Ativa o selecionado */
    container.querySelector(`[data-tab="${tabId}"]`)?.classList.add('active');
    document.getElementById(tabId)?.classList.add('active');
}

/* ================================================================
   1. SETORES  →  GET /api/setores
================================================================ */
async function _funcCarregarSetores() {
    try {
        const res = await fetch('/api/setores', { headers: window.cronaAuthHeaders() });
        if (!res.ok) throw new Error();
        const setores = await res.json();

        /* Preenche os dois selects (form + modal) */
        ['fSetor', 'eSetor'].forEach(id => {
            const sel = document.getElementById(id);
            if (!sel) return;
            sel.innerHTML = '<option value="">— Selecione —</option>';
            setores.forEach(s => {
                const op = document.createElement('option');
                op.value = s.id_setor;
                op.textContent = s.nome_setor;
                sel.appendChild(op);
            });
        });
    } catch {
        ['fSetor','eSetor'].forEach(id => {
            const el = document.getElementById(id);
            if (el) el.innerHTML = '<option value="">Erro ao carregar</option>';
        });
    }
}

/* ================================================================
   2. LISTAR  →  GET /api/usuarios
================================================================ */
async function _funcCarregarLista() {
    const corpo = document.getElementById('corpoTabela');
    corpo.innerHTML = `
        <tr><td colspan="6" class="tabela-carregando">
            <i class="fa-solid fa-circle-notch fa-spin"></i> Carregando...
        </td></tr>`;

    try {
        const res = await fetch('/api/usuarios', { headers: window.cronaAuthHeaders() });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        _funcFuncionarios = await res.json();
        _funcRenderizarTabela(_funcFuncionarios);
    } catch (e) {
        console.error('[Funcionários]', e);
        corpo.innerHTML = `
            <tr><td colspan="6" class="tabela-vazia">
                <i class="fa-solid fa-wifi"></i>
                <p>Não foi possível conectar ao servidor.</p>
                <small>Verifique se o backend Node.js está em execução.</small>
            </td></tr>`;
    }
}

/* ================================================================
   3. CADASTRAR  →  POST /api/usuarios
================================================================ */
async function _funcSalvar() {
    _funcEsconderErro();
    const dados = _funcColetarFormCadastro();
    if (!dados) return;

    _funcSetBtnLoading('btnSalvar', 'btnSalvarLabel', true, 'Salvando...');

    try {
        const res  = await fetch('/api/usuarios', {
            method: 'POST',
            headers: _funcHeadersJson(),
            body: JSON.stringify(dados),
        });
        const json = await res.json();
        if (!res.ok) throw new Error(json.message || `Erro ${res.status}`);

        _funcFecharFormulario();
        await _funcCarregarLista();
        _funcNotificar(`"${dados.nome}" cadastrado com sucesso!`, 'sucesso');

    } catch (e) {
        _funcMostrarErro(e.message);
    } finally {
        _funcSetBtnLoading('btnSalvar', 'btnSalvarLabel', false, 'Cadastrar Funcionário');
    }
}

/* ================================================================
   4. ABRIR EDIÇÃO  →  GET /api/usuarios/:id
   Busca todos os dados completos e preenche o modal.
================================================================ */
async function editarFuncionario(id) {
    /* Abre modal com loading */
    document.getElementById('funcModalAvatar').textContent = '...';
    document.getElementById('funcModalNome').textContent   = 'Carregando...';
    document.getElementById('funcModalSub').textContent    = '';
    document.getElementById('funcModalOverlay').classList.add('aberto');
    document.body.style.overflow = 'hidden';

    /* Reseta abas para a primeira */
    _funcTrocarAba('modalTabs', 'mtab-principal');

    /* Reseta o estado da aba Férias — mês atual, sem seleção carregada ainda */
    const agoraFer = new Date();
    _funcFerAno = agoraFer.getFullYear();
    _funcFerMes = agoraFer.getMonth() + 1;
    _funcFerDiasOriginais = new Set();
    _funcFerDiasSelecionados = new Set();
    _funcFerCarregado = false;

    try {
        const res  = await fetch(`/api/usuarios/${id}`, { headers: window.cronaAuthHeaders() });
        const f    = await res.json();
        if (!res.ok) throw new Error(f.message);

        /* Preenche cabeçalho do modal */
        const ini = _funcIniciais(f.nome);
        const cor = _funcCorAvatar(f.nome);
        const av  = document.getElementById('funcModalAvatar');
        av.style.overflow = 'hidden';
        if (f.foto_perfil) {
            av.innerHTML = `<img src="${f.foto_perfil}" alt="" style="width:100%;height:100%;object-fit:cover;border-radius:50%;display:block;">`;
            av.style.background = 'transparent';
        } else {
            av.innerHTML = '';
            av.textContent = ini;
            av.style.background = cor;
        }
        document.getElementById('funcModalNome').textContent =
            f.nome;
        document.getElementById('funcModalSub').textContent  =
            `${f.matricula} · ${f.nome_setor || '—'} · ${f.cargo || 'Sem cargo'}`;

        /* Limpa erros de uma edição anterior (senão o vermelho "gruda") */
        document.querySelectorAll('#funcModalOverlay .func-error').forEach(el => el.textContent = '');
        document.querySelectorAll('#funcModalOverlay .form-input.erro').forEach(el => el.classList.remove('erro'));

        /* Preenche campos */
        document.getElementById('editId').value         = f.id_usuario;
        document.getElementById('eNome').value          = f.nome          || '';
        document.getElementById('eCargo').value         = f.cargo         || '';
        document.getElementById('eAniversario').value   = f.data_aniversario || '';
        document.getElementById('eCelular').value       = _funcFormatarCelular(f.celular || '');
        document.getElementById('eMatricula').value     = f.matricula      || '';
        document.getElementById('eEmail').value         = f.email          || '';
        document.getElementById('eSenha').value         = '';
        document.getElementById('eSetor').value         = f.id_setor       || '';
        document.getElementById('eTipoAcesso').value    = f.tipo_acesso    || 'PADRAO';
        document.getElementById('eStatus').value        = f.status_conta   || 'ativo';
        _funcAplicarIsento(!!f.isento_ponto);

        /* Não deixa o usuário inativar a própria conta (trava o campo Status). */
        const _eStatus = document.getElementById('eStatus');
        if (_eStatus) {
            if (_funcEhUsuarioAtual(f.id_usuario)) {
                _eStatus.value = 'ativo';
                _eStatus.disabled = true;
                _eStatus.title = 'Você não pode inativar a própria conta.';
            } else {
                _eStatus.disabled = false;
                _eStatus.title = '';
            }
        }
        _funcPreencherEscala('e', f.escala);

        /* Documentos */
        document.getElementById('eCpf').value          = _funcFormatarCpf(f.cpf          || '');
        document.getElementById('eRg').value           = _funcFormatarRg(f.rg            || '');
        document.getElementById('eCartaoSus').value    = _funcFormatarSus(f.cartao_sus   || '');
        document.getElementById('eCarteiraTrab').value = f.carteira_trabalho || '';

        /* Endereço */
        document.getElementById('eCep').value    = _funcFormatarCep(f.cep    || '');
        document.getElementById('eRua').value    = f.rua    || '';
        document.getElementById('eNum').value    = f.num    || '';
        document.getElementById('eBairro').value = f.bairro || '';
        document.getElementById('eCidade').value = f.cidade || '';

        /* Emergência */
        document.getElementById('eContatoNome').value = f.contato_emergencia_nome || '';
        document.getElementById('eContatoTel').value  = f.contato_emergencia_tel  || '';
        _funcAplicarPermissaoSenhaEdicao();

    } catch (e) {
        console.error('[Funcionários] Editar:', e);
        _funcFecharModal();
        _funcNotificar('Não foi possível carregar os dados. Tente novamente.', 'erro');
    }
}

/* ================================================================
   5. SALVAR EDIÇÃO  →  PUT /api/usuarios/:id
================================================================ */
async function _funcSalvarEdicao() {
    const id    = document.getElementById('editId').value;
    const dados = _funcColetarFormEdicao();
    if (!dados) return;

    _funcSetBtnLoading('btnSalvarEdicao', 'btnSalvarEdicaoLabel', true, 'Salvando...');

    try {
        const res  = await fetch(`/api/usuarios/${id}`, {
            method:  'PUT',
            headers: _funcHeadersJson(),
            body:    JSON.stringify(dados),
        });
        const json = await res.json();
        if (!res.ok) throw new Error(json.message || `Erro ${res.status}`);

        /* Aba Férias: se houve marcação/desmarcação de dias, salva junto. */
        if (_funcFerTemAlteracoes()) {
            await _funcFerSalvarAlteracoes();
        }

        _funcFecharModal();
        await _funcCarregarLista();
        _funcNotificar('Dados atualizados com sucesso!', 'sucesso');

    } catch (e) {
        console.error('[Funcionários] Salvar edição:', e);
        _funcNotificar(e.message, 'erro');
    } finally {
        _funcSetBtnLoading('btnSalvarEdicao', 'btnSalvarEdicaoLabel', false, 'Salvar Alterações');
    }
}

/* ============================================================
   ISENTO DE PONTO — ação isolada, confirmada por senha do admin
============================================================ */
let _funcIsentoAtual = false;

function _funcAplicarIsento(isento) {
    _funcIsentoAtual = !!isento;
    const hidden = document.getElementById('eIsentoAtual');
    if (hidden) hidden.value = _funcIsentoAtual ? '1' : '0';
    const badge = document.getElementById('eIsentoBadge');
    if (badge) {
        badge.textContent = _funcIsentoAtual ? 'Isento de ponto' : 'Participa do ponto';
        badge.className   = 'badge ' + (_funcIsentoAtual ? 'badge-adm' : 'badge-ativo');
    }
}

async function _funcAbrirConfirmIsento() {
    const alvo = !_funcIsentoAtual;
    const senha = await window.cronaConfirmSenha({
        titulo: alvo ? 'Tornar isento de ponto' : 'Voltar a participar do ponto',
        mensagem: alvo
            ? 'Esta pessoa deixará de participar do controle de ponto (sem ficha nem banco de horas). Digite sua senha para aplicar.'
            : 'Esta pessoa voltará a participar do controle de ponto. Digite sua senha para aplicar.',
        textoOk: 'Confirmar',
    });
    if (!senha) return;

    const id   = document.getElementById('editId').value;
    const alvoAtual = !_funcIsentoAtual;
    try {
        const res = await fetch(`/api/usuarios/${id}/isento-ponto`, {
            method:  'PATCH',
            headers: _funcHeadersJson(),
            body:    JSON.stringify({ isento: alvoAtual, senha }),
        });
        const json = await res.json();
        if (!res.ok) throw new Error(json.message || `Erro ${res.status}`);

        _funcAplicarIsento(!!json.isento_ponto);
        await _funcCarregarLista();
        _funcNotificar(
            alvoAtual ? 'Funcionário agora é isento de ponto.' : 'Funcionário voltou a participar do ponto.',
            'sucesso'
        );
    } catch (e) {
        _funcNotificar(e.message || 'Erro ao alterar.', 'erro');
    }
}

/* ================================================================
   6. EXCLUIR  →  DELETE /api/usuarios/:id
================================================================ */
async function eliminarFuncionario(id) {
    const f    = _funcFuncionarios.find(x => String(x.id_usuario) === String(id));
    const nome = f ? f.nome : `ID ${id}`;

    if (_funcEhUsuarioAtual(id)) {
        _funcNotificar('Você não pode excluir a própria conta de administrador.', 'erro');
        return;
    }

    const _senhaExcluir = await window.cronaConfirmSenha({
        titulo: 'Excluir funcionário',
        mensagem: `Excluir "${nome}"? Esta ação não pode ser desfeita. Digite sua senha para confirmar.`,
        textoOk: 'Excluir',
    });
    if (!_senhaExcluir) return;

    try {
        const res  = await fetch(`/api/usuarios/${id}`, {
            method: 'DELETE',
            headers: typeof window.cronaAuthHeaders === 'function' ? window.cronaAuthHeaders() : {},
        });
        const json = await res.json();
        if (!res.ok) throw new Error(json.message);

        _funcFuncionarios = _funcFuncionarios.filter(x => String(x.id_usuario) !== String(id));
        _funcRenderizarTabela(_funcFuncionarios);
        _funcNotificar(`"${nome}" removido.`, 'info');

    } catch (e) {
        _funcNotificar('Não foi possível excluir. ' + e.message, 'erro');
    }
}

/* ================================================================
   RENDERIZAR TABELA
================================================================ */
function _funcRenderizarTabela(lista) {
    const corpo = document.getElementById('corpoTabela');
    const total = document.getElementById('totalRegistros');

    total.textContent = `${lista.length} registro${lista.length !== 1 ? 's' : ''}`;

    if (lista.length === 0) {
        corpo.innerHTML = `
            <tr><td colspan="6" class="tabela-vazia">
                <i class="fa-solid fa-users-slash"></i>
                <p>Nenhum funcionário cadastrado.</p>
                <small>Use o botão "Novo Funcionário" para começar.</small>
            </td></tr>`;
        return;
    }

    const ordenada = lista.slice().sort((a, b) =>
        (a.status_conta === 'ativo' ? 0 : 1) - (b.status_conta === 'ativo' ? 0 : 1));

    corpo.innerHTML = ordenada.map(f => {
        const ini = _funcIniciais(f.nome);
        const cor = _funcCorAvatar(f.nome);
        const inativo = f.status_conta !== 'ativo';
        return `
        <tr class="func-linha-click${inativo ? ' func-linha-inativa' : ''}" onclick="_funcClicarLinha('${f.id_usuario}')">
          <td class="matricula-cell">${_funcEsc(f.matricula)}</td>
          <td>
            <div style="display:flex;align-items:center;gap:10px;">
              <div style="width:32px;height:32px;border-radius:50%;background:${cor};overflow:hidden;
                          display:flex;align-items:center;justify-content:center;
                          font-size:11px;font-weight:700;color:#fff;flex-shrink:0;">
                ${f.foto_perfil ? `<img src="${f.foto_perfil}" alt="" style="width:100%;height:100%;object-fit:cover;display:block;">` : ini}
              </div>
              <div>
                <div style="font-weight:500;color:var(--text);">${_funcEsc(f.nome)}</div>
                <div style="font-size:12px;color:var(--muted-2);">${_funcEsc(f.email || '—')}</div>
              </div>
            </div>
          </td>
          <td>${_funcEsc(f.nome_setor || '—')}</td>
          <td style="font-size:12.5px;color:var(--muted);">
            ${_funcEsc(_funcResumoEscala(f.escala))}
          </td>
          <td>
            <span class="badge ${f.tipo_acesso === 'ADM' ? 'badge-adm' : ''}">
              ${f.tipo_acesso === 'ADM' ? 'Admin' : 'Padrão'}
            </span>
          </td>
          <td>
            <span class="badge ${f.status_conta === 'ativo' ? 'badge-ativo' : 'badge-inativo'}">
              ${f.status_conta === 'ativo' ? 'Ativo' : 'Inativo'}
            </span>
          </td>
        </tr>`;
    }).join('');
}

/* ================================================================
   FILTRO EM TEMPO REAL
================================================================ */
function filtrarTabela(termo) {
    const t = termo.toLowerCase().trim();
    _funcRenderizarTabela(
        _funcFuncionarios.filter(f =>
            (f.nome      || '').toLowerCase().includes(t) ||
            (f.matricula || '').toLowerCase().includes(t) ||
            (f.email     || '').toLowerCase().includes(t)
        )
    );
}

/* ================================================================
   FORMULÁRIO — abrir / fechar
================================================================ */
function _funcAbrirFormulario(modoEdicao = false) {
    document.getElementById('tituloFormulario').innerHTML =
        modoEdicao
            ? '<i class="fa-solid fa-user-pen" style="color:#3b82f6;margin-right:8px;"></i> Editar Funcionário'
            : '<i class="fa-solid fa-user-plus" style="color:#3b82f6;margin-right:8px;"></i> Novo Funcionário';

    document.getElementById('btnSalvarLabel').textContent =
        modoEdicao ? 'Salvar Alterações' : 'Cadastrar Funcionário';

    const dica = document.getElementById('fSenhaDica');
    dica.textContent = modoEdicao ? '(vazio = não altera)' : '';

    if (!modoEdicao) _funcLimparForm();

    document.getElementById('cardFormulario').style.display = 'block';
    document.getElementById('cardFormulario').scrollIntoView({ behavior: 'smooth' });
    _funcEsconderErro();
    _funcTrocarAba('formTabs', 'tab-principal');
}

function _funcFecharFormulario() {
    document.getElementById('cardFormulario').style.display = 'none';
    _funcLimparForm();
    _funcEsconderErro();
}

function _funcFecharModal() {
    document.getElementById('funcModalOverlay').classList.remove('aberto');
    document.body.style.overflow = '';
}

/* ================================================================
   COLETA E VALIDAÇÃO — formulário de cadastro
================================================================ */
function _funcColetarFormCadastro() {
    /* Limpa erros anteriores */
    document.querySelectorAll('.func-error').forEach(el => el.textContent = '');
    document.querySelectorAll('#cardFormulario .form-input')
        .forEach(el => el.classList.remove('erro'));

    let valido = true;

    const get = id => document.getElementById(id)?.value?.trim() || '';

    /* Obrigatórios */
    const nome     = get('fNome');
    const matricula= get('fMatricula');
    const email    = get('fEmail');
    const senha    = get('fSenha');
    const setor    = get('fSetor');
    const cpf      = get('fCpf');

    if (!nome)      { _funcErroField('fNome',     'err-fNome',     'Nome obrigatório.'); valido = false; }
    if (!matricula) { _funcErroField('fMatricula','err-fMatricula','Matrícula obrigatória.'); valido = false; }
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        _funcErroField('fEmail', 'err-fEmail', 'E-mail inválido.'); valido = false;
    }
    if (!senha || senha.length < 8) {
        _funcErroField('fSenha', 'err-fSenha', 'Mínimo 8 caracteres.'); valido = false;
    }
    if (!setor) { _funcErroField('fSetor', 'err-fSetor', 'Setor obrigatório.'); valido = false; }

    /* CPF obrigatório com validação */
    const cpfLimpo = cpf.replace(/\D/g, '');
    if (!cpfLimpo) {
        _funcErroField('fCpf', 'err-fCpf', 'CPF obrigatório.'); valido = false;
    } else if (!_funcValidarCPF(cpfLimpo)) {
        _funcErroField('fCpf', 'err-fCpf', 'CPF inválido.'); valido = false;
    }

    /* Celular: valida o formato se preenchido */
    const celLimpo = get('fCelular').replace(/\D/g, '');
    if (celLimpo && !_funcValidarCelular(celLimpo)) {
        _funcErroField('fCelular', 'err-fCelular', 'Celular inválido. Use (DD) 9XXXX-XXXX.'); valido = false;
    }

    if (!valido) {
        _funcMostrarErro('Corrija os campos marcados em vermelho.');
        /* Vai para a aba com erro */
        if (!nome || !matricula || !email || !senha || !setor) {
            _funcTrocarAba('formTabs', 'tab-principal');
        } else {
            _funcTrocarAba('formTabs', 'tab-documentos');
        }
        return null;
    }

    return {
        nome,       matricula,      email,          senha,
        cargo:      get('fCargo'),
        id_setor:   parseInt(setor),
        tipo_acesso:get('fTipoAcesso'),
        status_conta:get('fStatus'),
        isento_ponto: get('fIsento') === '1',
        escala: _funcColetarEscala('f'),
        data_aniversario: document.getElementById('fAniversario')?.value || null,
        celular:    get('fCelular'),
        contato_emergencia_nome: get('fContatoNome'),
        contato_emergencia_tel:  get('fContatoTel'),
        /* documentos */
        cpf,
        rg:               get('fRg'),
        cartao_sus:       get('fCartaoSus'),
        carteira_trabalho:get('fCarteiraTrab'),
        /* enderecos */
        cep:    get('fCep'),
        rua:    get('fRua'),
        num:    get('fNum'),
        bairro: get('fBairro'),
        cidade: get('fCidade'),
    };
}

/* ================================================================
   COLETA — formulário de edição (modal)
================================================================ */
function _funcColetarFormEdicao() {
    const get = id => document.getElementById(id)?.value?.trim() || '';

    /* Limpa erros anteriores antes de revalidar */
    document.querySelectorAll('#funcModalOverlay .func-error').forEach(el => el.textContent = '');
    document.querySelectorAll('#funcModalOverlay .form-input.erro').forEach(el => el.classList.remove('erro'));

    /* Valida CPF se preenchido */
    const cpf = get('eCpf');
    if (cpf) {
        const cpfLimpo = cpf.replace(/\D/g, '');
        if (!_funcValidarCPF(cpfLimpo)) {
            const errEl = document.getElementById('err-eCpf');
            if (errEl) errEl.textContent = 'CPF inválido.';
            document.getElementById('eCpf')?.classList.add('erro');
            _funcTrocarAba('modalTabs', 'mtab-documentos');
            return null;
        }
    }

    /* Valida celular se preenchido */
    const celE = get('eCelular');
    if (celE) {
        if (!_funcValidarCelular(celE)) {
            const errEl = document.getElementById('err-eCelular');
            if (errEl) errEl.textContent = 'Celular inválido.';
            document.getElementById('eCelular')?.classList.add('erro');
            _funcTrocarAba('modalTabs', 'mtab-principal');
            return null;
        }
    }

    const payload = {
        nome:        get('eNome'),
        cargo:       get('eCargo'),
        matricula:   get('eMatricula'),
        email:       get('eEmail'),
        id_setor:    parseInt(get('eSetor')) || undefined,
        tipo_acesso: get('eTipoAcesso'),
        status_conta:get('eStatus'),
        escala: _funcColetarEscala('e'),
        data_aniversario:  document.getElementById('eAniversario')?.value || null,
        celular:     get('eCelular'),
        contato_emergencia_nome: get('eContatoNome'),
        contato_emergencia_tel:  get('eContatoTel'),
        cpf,
        rg:               get('eRg'),
        cartao_sus:       get('eCartaoSus'),
        carteira_trabalho:get('eCarteiraTrab'),
        cep:    get('eCep'),
        rua:    get('eRua'),
        num:    get('eNum'),
        bairro: get('eBairro'),
        cidade: get('eCidade'),
    };

    /* Inclui senha só se preenchida */
    const senha = get('eSenha');
    if (senha) {
        if (!_funcUsuarioPodeEditarSenha()) {
            _funcTrocarAba('modalTabs', 'mtab-principal');
            _funcNotificar('Apenas administradores podem alterar senhas.', 'erro');
            return null;
        }

        if (senha.length < 8) {
            _funcTrocarAba('modalTabs', 'mtab-principal');
            _funcNotificar('A nova senha deve ter pelo menos 8 caracteres.', 'erro');
            return null;
        }

        payload.senha = senha;
    }

    return payload;
}

/* ================================================================
   ESCALA SEMANAL (7 dias) — coleta, preenchimento e resumo
================================================================ */
const _FUNC_DIAS = [
    { chave: 'dom', sufixo: 'Dom', rotulo: 'Dom' },
    { chave: 'seg', sufixo: 'Seg', rotulo: 'Seg' },
    { chave: 'ter', sufixo: 'Ter', rotulo: 'Ter' },
    { chave: 'qua', sufixo: 'Qua', rotulo: 'Qua' },
    { chave: 'qui', sufixo: 'Qui', rotulo: 'Qui' },
    { chave: 'sex', sufixo: 'Sex', rotulo: 'Sex' },
    { chave: 'sab', sufixo: 'Sab', rotulo: 'Sáb' },
];

function _funcColetarEscala(prefixo) {
    const escala = {};
    _FUNC_DIAS.forEach(d => {
        const el = document.getElementById(`${prefixo}Meta${d.sufixo}`);
        escala[d.chave] = el?.value || '00:00';
    });
    return escala;
}

function _funcPreencherEscala(prefixo, escala) {
    const padrao = { dom: '00:00', seg: '08:00', ter: '08:00', qua: '08:00', qui: '08:00', sex: '08:00', sab: '00:00' };
    const fonte = escala || padrao;
    _FUNC_DIAS.forEach(d => {
        const el = document.getElementById(`${prefixo}Meta${d.sufixo}`);
        if (el) el.value = fonte[d.chave] || '00:00';
    });
}

function _funcResumoEscala(escala) {
    if (!escala) return '—';
    let totalMin = 0;
    const folgas = [];
    _FUNC_DIAS.forEach(d => {
        const [h, m] = String(escala[d.chave] || '00:00').split(':').map(Number);
        const min = (h || 0) * 60 + (m || 0);
        totalMin += min;
        if (min === 0 && d.chave !== 'dom') folgas.push(d.rotulo);
    });
    const horas = `${Math.floor(totalMin / 60)}h/sem`;
    return folgas.length ? `${horas} · folga: ${folgas.join(', ')}` : horas;
}

/* ================================================================
   MÁSCARAS DE INPUT
================================================================ */
function funcMascaraCpf(input) {
    let v = input.value.replace(/\D/g, '').slice(0, 11);
    v = v.replace(/(\d{3})(\d)/, '$1.$2');
    v = v.replace(/(\d{3})(\d)/, '$1.$2');
    v = v.replace(/(\d{3})(\d{1,2})$/, '$1-$2');
    input.value = v;
}

/* Celular BR: (DD) 9XXXX-XXXX — máscara ao digitar */
function funcMascaraCelular(input) {
    const num = input.value.replace(/\D/g, '').slice(0, 11);
    let v = num;
    if (num.length > 7)      v = `(${num.slice(0, 2)}) ${num.slice(2, 7)}-${num.slice(7)}`;
    else if (num.length > 2) v = `(${num.slice(0, 2)}) ${num.slice(2)}`;
    else if (num.length > 0) v = `(${num}`;
    input.value = v;
    /* limpa o erro do próprio campo assim que a pessoa digita */
    input.classList.remove('erro');
    const err = input.parentElement?.querySelector('.func-error');
    if (err) err.textContent = '';
}

/* Formata um celular já salvo (ao carregar na edição). */
function _funcFormatarCelular(cel) {
    const num = String(cel || '').replace(/\D/g, '').slice(0, 11);
    if (num.length > 7) return `(${num.slice(0, 2)}) ${num.slice(2, 7)}-${num.slice(7)}`;
    if (num.length > 2) return `(${num.slice(0, 2)}) ${num.slice(2)}`;
    return num;
}

/* Valida celular BR: DDD (2) + 9 dígitos, começando com 9. */
function _funcValidarCelular(cel) {
    const num = String(cel || '').replace(/\D/g, '');
    if (num.length !== 11) return false;   // 2 (DDD) + 9 dígitos
    if (num[0] === '0')    return false;   // DDD não começa com 0
    if (num[2] !== '9')    return false;   // celular: 1º dígito do número é 9
    return true;
}

function funcMascaraRg(input) {
    let v = input.value.replace(/\D/g, '').slice(0, 9);
    v = v.replace(/(\d{2})(\d)/, '$1.$2');
    v = v.replace(/(\d{3})(\d)/, '$1.$2');
    v = v.replace(/(\d{3})(\d{1})$/, '$1-$2');
    input.value = v;
}

function funcMascaraSus(input) {
    let v = input.value.replace(/\D/g, '').slice(0, 15);
    v = v.replace(/(\d{3})(\d)/, '$1 $2');
    v = v.replace(/(\d{4})(\d)/, '$1 $2');
    v = v.replace(/(\d{4})(\d)/, '$1 $2');
    input.value = v;
}

function funcMascaraCep(input) {
    let v = input.value.replace(/\D/g, '').slice(0, 8);
    if (v.length > 5) v = v.slice(0, 5) + '-' + v.slice(5);
    input.value = v;
}

/* ================================================================
   BUSCA CEP VIA VIACEP
   prefixo: '' para form de cadastro, 'e' para modal de edição
================================================================ */
async function funcBuscarCep(cep, prefixo = '') {
    const cepLimpo = cep.replace(/\D/g, '');
    if (cepLimpo.length !== 8) return;

    const p = prefixo ? prefixo.toUpperCase() : 'f'; /* 'f' = form, 'e' = edição */
    const setVal = (id, val) => {
        const el = document.getElementById(id);
        if (el) el.value = val;
    };

    try {
        const res  = await fetch(`https://viacep.com.br/ws/${cepLimpo}/json/`);
        const data = await res.json();
        if (data.erro) return;

        if (p === 'e') {
            setVal('eRua',    data.logradouro || '');
            setVal('eBairro', data.bairro     || '');
            setVal('eCidade', data.localidade || '');
        } else {
            setVal('fRua',    data.logradouro || '');
            setVal('fBairro', data.bairro     || '');
            setVal('fCidade', data.localidade || '');
        }
    } catch { /* viacep offline — ignora silenciosamente */ }
}

/* ================================================================
   HELPERS GERAIS
================================================================ */
function _funcLimparForm() {
    /* Reseta todos os inputs do formulário */
    ['fNome','fCargo','fAniversario','fCelular','fMatricula',
     'fEmail','fSenha','fCpf','fRg','fCartaoSus','fCarteiraTrab',
     'fCep','fRua','fNum','fBairro','fCidade',
     'fContatoNome','fContatoTel'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.value = '';
    });
    _funcPreencherEscala('f', null);
    const fSetor = document.getElementById('fSetor');
    if (fSetor) fSetor.value = '';
    const fTipoAcesso = document.getElementById('fTipoAcesso');
    if (fTipoAcesso) fTipoAcesso.value = 'PADRAO';
    const fStatus = document.getElementById('fStatus');
    if (fStatus) fStatus.value = 'ativo';

    document.querySelectorAll('#cardFormulario .func-error')
        .forEach(el => el.textContent = '');
    document.querySelectorAll('#cardFormulario .form-input.erro')
        .forEach(el => el.classList.remove('erro'));
}

function _funcErroField(inputId, errId, msg) {
    document.getElementById(inputId)?.classList.add('erro');
    const errEl = document.getElementById(errId);
    if (errEl) errEl.textContent = msg;
}

function _funcMostrarErro(msg) {
    const div = document.getElementById('formErro');
    document.getElementById('formErroMsg').textContent = msg;
    if (div) div.style.display = 'flex';
}

function _funcEsconderErro() {
    const div = document.getElementById('formErro');
    if (div) div.style.display = 'none';
}

function _funcSetBtnLoading(btnId, labelId, loading, texto) {
    const btn   = document.getElementById(btnId);
    const label = document.getElementById(labelId);
    if (!btn) return;
    btn.disabled = loading;
    if (label) label.textContent = texto;
    const icon = btn.querySelector('i');
    if (icon) {
        icon.className = loading
            ? 'fa-solid fa-circle-notch fa-spin'
            : 'fa-solid fa-floppy-disk';
    }
}

function _funcEsc(v) {
    return String(v ?? '')
        .replace(/&/g,'&amp;').replace(/</g,'&lt;')
        .replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

function _funcIniciais(nome) {
    if (!nome) return '?';
    return nome.trim().split(' ').filter(Boolean)
               .slice(0, 2).map(p => p[0].toUpperCase()).join('');
}

function _funcCorAvatar(nome) {
    const cores = ['#3b82f6','#8b5cf6','#ec4899','#14b8a6','#f59e0b','#ef4444','#10b981'];
    let h = 0;
    for (let i = 0; i < (nome || '').length; i++)
        h = (nome.charCodeAt(i) + ((h << 5) - h));
    return cores[Math.abs(h) % cores.length];
}

/* Validação de CPF brasileiro */
function _funcValidarCPF(cpf) {
    if (!cpf || cpf.length !== 11) return false;
    if (/^(\d)\1{10}$/.test(cpf))  return false;
    let s = 0;
    for (let i = 0; i < 9; i++) s += parseInt(cpf[i]) * (10 - i);
    let r = (s * 10) % 11;
    if (r === 10 || r === 11) r = 0;
    if (r !== parseInt(cpf[9])) return false;
    s = 0;
    for (let i = 0; i < 10; i++) s += parseInt(cpf[i]) * (11 - i);
    r = (s * 10) % 11;
    if (r === 10 || r === 11) r = 0;
    return r === parseInt(cpf[10]);
}

/* Formatadores para exibição */
function _funcFormatarCpf(cpf) {
    const v = (cpf || '').replace(/\D/g, '').slice(0, 11);
    return v.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4');
}
function _funcFormatarRg(rg) {
    const v = (rg || '').replace(/\D/g, '').slice(0, 9);
    return v.replace(/(\d{2})(\d{3})(\d{3})(\d{1})/, '$1.$2.$3-$4');
}
function _funcFormatarSus(sus) {
    const v = (sus || '').replace(/\D/g, '').slice(0, 15);
    return v.replace(/(\d{3})(\d{4})(\d{4})(\d{4})/, '$1 $2 $3 $4');
}
function _funcFormatarCep(cep) {
    const v = (cep || '').replace(/\D/g, '').slice(0, 8);
    return v.replace(/(\d{5})(\d{3})/, '$1-$2');
}

function _funcNotificar(msg, tipo = 'sucesso') {
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
    el.innerHTML = `<i class="fa-solid ${c.icone}"></i> ${_funcEsc(msg)}`;
    document.body.appendChild(el);
    setTimeout(() => el.remove(), 3500);
}

/* ================================================================
   ABA FÉRIAS
   Calendário simples: clica no dia para marcar/desmarcar o período.
   O salvamento acontece junto do "Salvar Alterações" — esta aba não
   tem botão próprio. Reaproveita a mesma rota POST /api/ponto/salvar
   da Gestão de Ponto; como o DAO faz upsert por dia, só os dias que
   mudaram são enviados e o resto do mês não é afetado.

   Prefixo _funcFer_ (não _fer_) de propósito: feriados.js já usa o
   prefixo _fer_ nas funções dele e os dois scripts convivem no mesmo
   escopo global — nomes iguais fariam um sobrescrever o outro.
================================================================ */
let _funcFerAno = new Date().getFullYear();
let _funcFerMes = new Date().getMonth() + 1;
let _funcFerDiasOriginais    = new Set(); /* dias já gravados como "Férias" */
let _funcFerDiasSelecionados = new Set(); /* seleção atual na tela */
let _funcFerCarregado = false;

const FUNC_MESES_FERIAS = [
    '', 'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
    'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
];

/* Abre a aba: carrega o mês atual na primeira vez que a aba é clicada. */
async function _funcFerAbrirAba() {
    if (_funcFerCarregado) return;
    _funcFerCarregado = true;
    await _funcFerCarregarMes();
}

function _funcFerMudarMes(delta) {
    _funcFerMes += delta;
    if (_funcFerMes > 12) { _funcFerMes = 1; _funcFerAno++; }
    if (_funcFerMes < 1)  { _funcFerMes = 12; _funcFerAno--; }
    _funcFerCarregarMes();
}

/* Busca a ficha do mês e descobre quais dias já são Férias. */
async function _funcFerCarregarMes() {
    const idUsuario = document.getElementById('editId')?.value;
    const cal = document.getElementById('feriasCalendario');
    if (!idUsuario || !cal) return;

    document.getElementById('feriasMesLabel').textContent = FUNC_MESES_FERIAS[_funcFerMes] + ' / ' + _funcFerAno;
    document.getElementById('feriasErro').style.display = 'none';
    cal.innerHTML = '<div class="func-ferias-carregando"><i class="fa-solid fa-circle-notch fa-spin"></i> Carregando...</div>';

    try {
        const resp = await fetch('/api/ponto/' + idUsuario + '/' + _funcFerMes + '/' + _funcFerAno, {
            headers: _funcHeadersJson(),
        });
        const dados = await resp.json();
        if (!resp.ok) throw new Error(dados.message || ('HTTP ' + resp.status));

        _funcFerDiasOriginais = new Set(
            (Array.isArray(dados) ? dados : [])
                .filter(d => d.ocorrencia === 'Férias')
                .map(d => d.dia)
        );
        _funcFerDiasSelecionados = new Set(_funcFerDiasOriginais);

        _funcFerRenderCalendario();
    } catch (err) {
        cal.innerHTML = '';
        _funcFerMostrarErro(err.message || 'Erro ao carregar o mês.');
    }
}

/* Desenha a grade do calendário (Dom a Sáb). */
function _funcFerRenderCalendario() {
    const cal = document.getElementById('feriasCalendario');
    if (!cal) return;

    const totalDias   = new Date(_funcFerAno, _funcFerMes, 0).getDate();
    const primeiroDow = new Date(_funcFerAno, _funcFerMes - 1, 1).getDay();
    const DOW = ['D', 'S', 'T', 'Q', 'Q', 'S', 'S'];

    let html = DOW.map(d => '<div class="func-ferias-dow">' + d + '</div>').join('');

    /* Células vazias antes do dia 1, para alinhar o dia da semana */
    for (let i = 0; i < primeiroDow; i++) {
        html += '<div class="func-ferias-dia vazio"></div>';
    }

    for (let dia = 1; dia <= totalDias; dia++) {
        const sel = _funcFerDiasSelecionados.has(dia) ? ' selecionado' : '';
        html += '<div class="func-ferias-dia' + sel + '" data-dia="' + dia +
                '" onclick="_funcFerToggleDia(' + dia + ')">' + dia + '</div>';
    }

    cal.innerHTML = html;
    _funcFerAtualizarResumo();
}

/* Marca/desmarca um dia — só estado local, nada é salvo ainda. */
function _funcFerToggleDia(dia) {
    if (_funcFerDiasSelecionados.has(dia)) {
        _funcFerDiasSelecionados.delete(dia);
    } else {
        _funcFerDiasSelecionados.add(dia);
    }
    document.querySelector('.func-ferias-dia[data-dia="' + dia + '"]')
        ?.classList.toggle('selecionado', _funcFerDiasSelecionados.has(dia));
    _funcFerAtualizarResumo();
}

function _funcFerAtualizarResumo() {
    const n = _funcFerDiasSelecionados.size;
    const el = document.getElementById('feriasResumo');
    if (el) el.textContent = n + ' dia' + (n !== 1 ? 's' : '') + ' selecionado' + (n !== 1 ? 's' : '');
}

/* Houve marcação/desmarcação desde que o mês foi carregado? */
function _funcFerTemAlteracoes() {
    return _funcFerDiasSelecionados.size !== _funcFerDiasOriginais.size ||
        [..._funcFerDiasSelecionados].some(d => !_funcFerDiasOriginais.has(d));
}

/* Salva só o que mudou: dias que entraram viram "Férias", os que
   saíram voltam a "Normal". Sem UI própria — quem chama cuida disso. */
async function _funcFerSalvarAlteracoes() {
    const idUsuario = document.getElementById('editId')?.value;
    if (!idUsuario || !_funcFerTemAlteracoes()) return;

    const entraram = [..._funcFerDiasSelecionados].filter(d => !_funcFerDiasOriginais.has(d));
    const sairam   = [..._funcFerDiasOriginais].filter(d => !_funcFerDiasSelecionados.has(d));

    const lancamentos = [
        ...entraram.map(dia => ({ dia, meta: '00:00', ent1: '', sai1: '', ent2: '', sai2: '', ocorrencia: 'Férias' })),
        ...sairam.map(dia   => ({ dia, meta: '00:00', ent1: '', sai1: '', ent2: '', sai2: '', ocorrencia: 'Normal' })),
    ];

    const resp = await fetch('/api/ponto/salvar', {
        method:  'POST',
        headers: _funcHeadersJson(),
        body:    JSON.stringify({ id_usuario: idUsuario, mes: _funcFerMes, ano: _funcFerAno, lancamentos }),
    });
    const dados = await resp.json();
    if (!resp.ok) throw new Error(dados.message || ('HTTP ' + resp.status));

    _funcFerDiasOriginais = new Set(_funcFerDiasSelecionados);
}

function _funcFerMostrarErro(msg) {
    const el = document.getElementById('feriasErro');
    if (!el) return;
    el.textContent = msg;
    el.style.display = '';
}

/* SEM auto-execução — o main.js chama iniciarModuloFuncionarios() */