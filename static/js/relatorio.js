/**
 * CronaSys — static/js/relatorio.js
 * -------------------------------------------------------
 * Módulo de Relatórios Mensais (visão do RH).
 * Carregado UMA VEZ no index.html.
 * Chamado pelo main.js: iniciarModuloRelatorio()
 *
 * Funcionalidades:
 *   • Autocomplete de funcionário por nome e matrícula
 *   • Filtro por setor (dropdown)
 *   • Seleção de mês e ano
 *   • Grid de cards com resumo de cada colaborador
 *   • Modal com ficha completa do mês (somente leitura)
 *   • Exportar CSV e Imprimir
 *
 * Todas as funções privadas usam prefixo _rel_ para
 * evitar colisão com outros módulos.
 */

/* ================================================================
   CONSTANTES
================================================================ */
const REL_DIAS_SEMANA = ['Dom','Seg','Ter','Qua','Qui','Sex','Sáb'];
const REL_MESES = [
    '','Janeiro','Fevereiro','Março','Abril','Maio','Junho',
    'Julho','Agosto','Setembro','Outubro','Novembro','Dezembro',
];

/* Ocorrências que abonão o dia (saldo = 0, não penaliza) */
const REL_ABONADAS = new Set([
    'Atestado','Treinamento',
    'Licença Nojo/Luto',
]);

/* Faltas (descontam meta — negativo). Injustificada também gera aviso. */
const REL_FALTA = new Set(['Faltou','Falta Injustificada','Falta Justificada']);

/* Paleta de cores para avatares */
const REL_CORES = [
    '#3b82f6','#8b5cf6','#ec4899','#14b8a6',
    '#f59e0b','#ef4444','#10b981','#6366f1',
];

/* ================================================================
   ESTADO DO MÓDULO
================================================================ */
let _relTodosFuncionarios  = [];   /* lista completa vinda da API */
let _relFiltrados          = [];   /* após filtros de setor/busca */
let _relSelecionado        = null; /* funcionário escolhido no autocomplete */
let _relResultados         = [];   /* dados gerados após "Gerar" */
let _relModalAtual         = null; /* funcionário aberto no modal */
let _relFeriados           = new Set(); /* feriados do ano gerado */
let _relSaldosTotais       = {};   /* { idUsuario: saldoTotalMin } — banco de horas por pessoa */

/* ================================================================
   PONTO DE ENTRADA — chamado pelo main.js via INIT_MAP
================================================================ */
function iniciarModuloRelatorio() {
    console.log('[Relatório] init');
    _relResetar();
    _relDefinirMesAtual();
    _relVincularEventos();
    _relCarregarDados();
}

/* ================================================================
   INICIALIZAÇÃO
================================================================ */
function _relResetar() {
    _relTodosFuncionarios = [];
    _relFiltrados         = [];
    _relSelecionado       = null;
    _relResultados        = [];
    _relModalAtual        = null;
}

function _relDefinirMesAtual() {
    const agora = new Date();
    document.getElementById('relMes').value = agora.getMonth() + 1;
    document.getElementById('relAno').value = agora.getFullYear();
}

function _relVincularEventos() {
    /* Botão gerar */
    document.getElementById('btnGerarRelatorio')
        .addEventListener('click', relGerarRelatorio);

    /* Modal: fechar */
    document.getElementById('relModalFechar')
        .addEventListener('click', relFecharModal);
    document.getElementById('relModalOverlay')
        .addEventListener('click', e => {
            if (e.target.id === 'relModalOverlay') relFecharModal();
        });

    /* Modal: exportar */
    document.getElementById('btnRelExportar')
        .addEventListener('click', relExportarModal);

    /* Modal: imprimir */
    document.getElementById('btnRelImprimir')
        ?.addEventListener('click', relImprimirModal);

    /* Fechar lista ao clicar fora */
    document.addEventListener('click', e => {
        if (!e.target.closest('.filtro-grupo')) {
            _relFecharListas();
        }
    });

    /* ESC fecha modal */
    document.addEventListener('keydown', e => {
        if (e.key === 'Escape') relFecharModal();
    });
}

async function _relCarregarDados() {
    try {
        /* Carrega funcionários e setores em paralelo */
        const [resFuncs, resSetores] = await Promise.all([
            fetch('/api/usuarios', { headers: _relAuthHeaders() }),
            fetch('/api/setores', { headers: _relAuthHeaders() }),
        ]);

        if (resFuncs.ok) {
            _relTodosFuncionarios = (await resFuncs.json()).filter(f => !f.isento_ponto);
            _relFiltrados = [..._relTodosFuncionarios];
        }

        if (resSetores.ok) {
            const setores = await resSetores.json();
            const sel = document.getElementById('relSetor');
            setores.forEach(s => {
                const op = document.createElement('option');
                op.value = s.id_setor;
                op.textContent = s.nome_setor;
                sel.appendChild(op);
            });
        }

        /* Saldo Total acumulado (banco de horas) de cada funcionário */
        try {
            const resSaldos = await fetch('/api/saldos-acumulados', { headers: _relAuthHeaders() });
            if (resSaldos.ok) _relSaldosTotais = await resSaldos.json();
        } catch (e) {
            console.error('[Relatório] Erro ao carregar saldos acumulados:', e);
        }
    } catch (e) {
        console.error('[Relatório] Erro ao carregar dados iniciais:', e);
    }
}

/* ================================================================
   AUTOCOMPLETE — Busca por Nome
================================================================ */
function relAcDigitou() {
    const termo = document.getElementById('relBuscaInput').value.toLowerCase().trim();
    const lista = document.getElementById('relAcLista');
    const setor = document.getElementById('relSetor').value;

    /* Limpa seleção anterior ao digitar */
    if (_relSelecionado) {
        _relSelecionado = null;
        document.getElementById('relAcLimpar').style.display = 'none';
    }

    _relAtualizarChips();

    /* Filtra pela lista respeitando setor selecionado */
    const base = setor
        ? _relTodosFuncionarios.filter(f => String(f.id_setor) === setor)
        : _relTodosFuncionarios;

    const resultado = termo
        ? base.filter(f =>
            (f.nome      || '').toLowerCase().includes(termo) ||
            (f.matricula || '').toLowerCase().includes(termo)
          )
        : base;

    _relRenderizarLista(lista, resultado, 'relBuscaInput', f => {
        document.getElementById('relBuscaInput').value = f.nome;
        document.getElementById('relMatriculaInput').value = f.matricula;
        document.getElementById('relAcLimpar').style.display = 'flex';
        document.getElementById('relMatriculaLimpar').style.display = 'flex';
        _relSelecionado = f;
        lista.style.display = 'none';
        document.getElementById('relMatriculaLista').style.display = 'none';
        _relAtualizarChips();
    });
}

/* ================================================================
   AUTOCOMPLETE — Busca por Matrícula
================================================================ */
function relMatriculaDigitou() {
    const termo = document.getElementById('relMatriculaInput').value.toLowerCase().trim();
    const lista = document.getElementById('relMatriculaLista');
    const setor = document.getElementById('relSetor').value;

    if (_relSelecionado) {
        _relSelecionado = null;
        document.getElementById('relAcLimpar').style.display = 'none';
        document.getElementById('relMatriculaLimpar').style.display = 'none';
    }

    _relAtualizarChips();

    const base = setor
        ? _relTodosFuncionarios.filter(f => String(f.id_setor) === setor)
        : _relTodosFuncionarios;

    const resultado = termo
        ? base.filter(f =>
            (f.matricula || '').toLowerCase().includes(termo) ||
            (f.nome      || '').toLowerCase().includes(termo)
          )
        : base;

    _relRenderizarLista(lista, resultado, 'relMatriculaInput', f => {
        document.getElementById('relBuscaInput').value    = f.nome;
        document.getElementById('relMatriculaInput').value = f.matricula;
        document.getElementById('relAcLimpar').style.display = 'flex';
        document.getElementById('relMatriculaLimpar').style.display = 'flex';
        _relSelecionado = f;
        lista.style.display = 'none';
        document.getElementById('relAcLista').style.display = 'none';
        _relAtualizarChips();
    });
}

/* Renderiza a lista de sugestões */
function _relRenderizarLista(lista, itens, inputId, onSelect) {
    if (itens.length === 0) {
        lista.innerHTML = '<div class="rel-ac-vazio">Nenhum resultado encontrado</div>';
        lista.style.display = 'block';
        return;
    }

    lista.innerHTML = itens.slice(0, 8).map((f, i) => {
        const cor = REL_CORES[i % REL_CORES.length];
        const ini = _relIniciais(f.nome);
        return `
            <div class="rel-ac-item" onclick="_relSelecionarItem(${f.id_usuario}, '${inputId}')">
                ${_relAvatarHtml(f, cor, 'rel-ac-avatar')}
                <div>
                    <div class="rel-ac-nome">${_relEsc(f.nome)}</div>
                    <div class="rel-ac-sub">${_relEsc(f.matricula)} · ${_relEsc(f.nome_setor || '—')}</div>
                </div>
            </div>`;
    }).join('');

    lista.style.display = 'block';
}

function _relSelecionarItem(id, inputOrigemId) {
    const f = _relTodosFuncionarios.find(x => x.id_usuario === id);
    if (!f) return;

    document.getElementById('relBuscaInput').value     = f.nome;
    document.getElementById('relMatriculaInput').value = f.matricula;
    document.getElementById('relAcLimpar').style.display       = 'flex';
    document.getElementById('relMatriculaLimpar').style.display = 'flex';
    _relSelecionado = f;
    _relFecharListas();
    _relAtualizarChips();
}

function relAcLimpar() {
    document.getElementById('relBuscaInput').value     = '';
    document.getElementById('relMatriculaInput').value = '';
    document.getElementById('relAcLimpar').style.display       = 'none';
    document.getElementById('relMatriculaLimpar').style.display = 'none';
    _relSelecionado = null;
    _relFecharListas();
    _relAtualizarChips();
}

function relMatriculaLimpar() {
    relAcLimpar();
}

/* Filtro por setor — atualiza os itens disponíveis no autocomplete */
function relFiltrarPorSetor() {
    const setor = document.getElementById('relSetor').value;
    _relFiltrados = setor
        ? _relTodosFuncionarios.filter(f => String(f.id_setor) === setor)
        : [..._relTodosFuncionarios];

    /* Se havia seleção e não pertence ao setor, limpa */
    if (_relSelecionado && setor && String(_relSelecionado.id_setor) !== setor) {
        relAcLimpar();
    }
    _relAtualizarChips();
}

function _relFecharListas() {
    document.getElementById('relAcLista').style.display        = 'none';
    document.getElementById('relMatriculaLista').style.display = 'none';
}

/* ================================================================
   CHIPS — mostra filtros ativos
================================================================ */
function _relAtualizarChips() {
    const area  = document.getElementById('relChipsArea');
    const chips = document.getElementById('relChips');
    const setor = document.getElementById('relSetor');
    const items = [];

    if (_relSelecionado) {
        items.push(`
            <span class="rel-chip">
                <i class="fa-solid fa-user"></i>
                ${_relEsc(_relSelecionado.nome)}
                <button onclick="relAcLimpar()"><i class="fa-solid fa-xmark"></i></button>
            </span>`);
    }

    if (setor.value) {
        const nomeSetor = setor.options[setor.selectedIndex]?.text || '';
        items.push(`
            <span class="rel-chip">
                <i class="fa-solid fa-building"></i>
                ${_relEsc(nomeSetor)}
                <button onclick="document.getElementById('relSetor').value=''; relFiltrarPorSetor()">
                    <i class="fa-solid fa-xmark"></i>
                </button>
            </span>`);
    }

    chips.innerHTML    = items.join('');
    area.style.display = items.length > 0 ? 'block' : 'none';
}

/* ================================================================
   GERAR RELATÓRIO
   Se houver funcionário selecionado → mostra só ele
   Se não → mostra todos (filtrados por setor se houver)
================================================================ */
async function relGerarRelatorio() {
    const mes = parseInt(document.getElementById('relMes').value);
    const ano = parseInt(document.getElementById('relAno').value);

    _relFeriados = await _relCarregarFeriados(ano);

    /* Define lista a processar */
    const lista = _relSelecionado
        ? [_relSelecionado]
        : _relFiltrados.length > 0 ? _relFiltrados : _relTodosFuncionarios;

    if (lista.length === 0) {
        window.cronaAlert({ titulo: 'Busca', mensagem: 'Nenhum funcionário encontrado.' });
        return;
    }

    /* Feedback de carregamento */
    const btn = document.getElementById('btnGerarRelatorio');
    btn.disabled = true;
    btn.innerHTML = '<i class="fa-solid fa-circle-notch fa-spin"></i> Carregando...';

    document.getElementById('relEstadoInicial').style.display  = 'none';
    document.getElementById('relCardsArea').style.display      = 'none';
    document.getElementById('relResumoGeral').style.display    = 'none';

    try {
        /* Busca dados de ponto de todos em paralelo */
        const promises = lista.map(f =>
            fetch(`/api/ponto/${f.id_usuario}/${mes}/${ano}`, {
                headers: _relAuthHeaders(),
            })
                .then(r => r.ok ? r.json() : [])
                .catch(() => [])
        );

        const resultados = await Promise.all(promises);

        /* Monta array com resumo calculado */
        _relResultados = lista.map((f, i) => ({
            ...f,
            lancamentos: resultados[i],
            resumo: _relCalcularResumo(resultados[i], f.escala, mes, ano),
        }));

        _relRenderizarStats(_relResultados);
        _relRenderizarCards(_relResultados, mes, ano);

    } catch (e) {
        console.error('[Relatório] Gerar:', e);
    } finally {
        btn.disabled = false;
        btn.innerHTML = '<i class="fa-solid fa-chart-bar"></i> Gerar Relatório';
    }
}

/* ================================================================
   RENDERIZAR STATS GERAIS
================================================================ */
function _relRenderizarStats(lista) {
    const comLanc  = lista.filter(f => f.lancamentos.length > 0).length;
    const saldoPos = lista.filter(f => f.resumo.saldoMin > 0).length;
    const saldoNeg = lista.filter(f => f.resumo.saldoMin < 0).length;

    document.getElementById('rsTotal').textContent     = lista.length;
    document.getElementById('rsPresentes').textContent = comLanc;
    document.getElementById('rsSaldoPos').textContent  = saldoPos;
    document.getElementById('rsSaldoNeg').textContent  = saldoNeg;
    document.getElementById('relResumoGeral').style.display = 'block';
}

/* ================================================================
   RENDERIZAR CARDS
================================================================ */
function _relRenderizarCards(lista, mes, ano) {
    const grid  = document.getElementById('relCardsGrid');
    const count = document.getElementById('relCardsCount');
    const area  = document.getElementById('relCardsArea');

    area.style.display = 'block';
    count.textContent  = `${lista.length} colaborador${lista.length !== 1 ? 'es' : ''}`;

    if (lista.length === 0) {
        grid.innerHTML = `
            <div style="grid-column:1/-1;text-align:center;padding:56px;color:#9ca3af;">
                <i class="fa-solid fa-users-slash" style="font-size:36px;display:block;margin-bottom:12px;color:#d1d5db;"></i>
                <p>Nenhum colaborador encontrado.</p>
            </div>`;
        return;
    }

    grid.innerHTML = lista.map((f, idx) => {
        const cor      = REL_CORES[idx % REL_CORES.length];
        const iniciais = _relIniciais(f.nome);
        const resumo   = f.resumo;
        const temDados = f.lancamentos.length > 0;

        let classeCard = 'sem-dados';
        if (temDados) {
            classeCard = resumo.saldoMin > 0 ? 'saldo-positivo'
                       : resumo.saldoMin < 0 ? 'saldo-negativo'
                       : 'saldo-neutro';
        }

        const sinalSaldo = resumo.saldoMin >= 0 ? '+' : '-';
        const saldoStr   = sinalSaldo + _relMinParaHora(Math.abs(resumo.saldoMin));
        const saldoCls   = resumo.saldoMin > 0 ? 'positivo'
                         : resumo.saldoMin < 0 ? 'negativo' : 'neutro';

        const saldoTotMin = Number(_relSaldosTotais[f.id_usuario] || 0);
        const saldoTotStr = (saldoTotMin >= 0 ? '+' : '-') + _relMinParaHora(Math.abs(saldoTotMin));
        const saldoTotCls = saldoTotMin > 0 ? 'positivo' : saldoTotMin < 0 ? 'negativo' : 'neutro';

        return `
        <div class="rel-card ${classeCard}"
             onclick="relAbrirModal(${f.id_usuario}, ${mes}, ${ano})">

            <div class="rel-card-topo">
                ${_relAvatarHtml(f, cor, 'rel-card-avatar')}
                <div style="min-width:0;">
                    <div class="rel-card-nome" title="${_relEsc(f.nome)}">${_relEsc(f.nome)}</div>
                    <div class="rel-card-cargo">${_relEsc(f.matricula)} · ${_relEsc(f.nome_setor || '—')}</div>
                </div>
            </div>

            ${temDados ? `
            <div class="rel-card-metricas">
                <div class="rel-card-metrica">
                    <div class="rel-card-metrica-label">Saldo do Mês</div>
                    <div class="rel-card-metrica-valor ${saldoCls}">${saldoStr}</div>
                </div>
                <div class="rel-card-metrica">
                    <div class="rel-card-metrica-label">Saldo Total</div>
                    <div class="rel-card-metrica-valor ${saldoTotCls}">${saldoTotStr}</div>
                </div>
                <div class="rel-card-metrica">
                    <div class="rel-card-metrica-label">Total Trabalhado</div>
                    <div class="rel-card-metrica-valor">${_relMinParaHora(resumo.totalMin)}</div>
                </div>
                <div class="rel-card-metrica">
                    <div class="rel-card-metrica-label">Dias Presentes</div>
                    <div class="rel-card-metrica-valor">${resumo.diasPresentes}</div>
                </div>
                <div class="rel-card-metrica">
                    <div class="rel-card-metrica-label">Faltas</div>
                    <div class="rel-card-metrica-valor ${resumo.faltas > 0 ? 'negativo' : ''}">
                        ${resumo.faltas}
                    </div>
                </div>
            </div>` : `
            <div class="rel-card-sem-dados">
                <i class="fa-regular fa-calendar-xmark"
                   style="font-size:28px;display:block;margin-bottom:8px;color:#d1d5db;"></i>
                Sem lançamentos neste mês
            </div>`}

            <div class="rel-card-footer">
                <span>${REL_MESES[mes]} / ${ano}</span>
                <span style="color:#3b82f6;font-weight:500;">
                    Ver ficha <i class="fa-solid fa-arrow-right" style="font-size:11px;"></i>
                </span>
            </div>

        </div>`;
    }).join('');
}

/* ================================================================
   MODAL — abrir ficha completa
================================================================ */
async function relAbrirModal(idUsuario, mes, ano) {
    const f = _relResultados.find(x => String(x.id_usuario) === String(idUsuario));
    if (!f) return;

    _relModalAtual = { ...f, mes, ano };

    /* Preenche cabeçalho */
    const idx = _relResultados.indexOf(f);
    const cor  = REL_CORES[idx % REL_CORES.length];
    const av   = document.getElementById('relModalAvatar');
    av.style.overflow = 'hidden';
    if (f.foto_perfil) {
        av.innerHTML = `<img src="${f.foto_perfil}" alt="" style="width:100%;height:100%;object-fit:cover;border-radius:50%;display:block;">`;
        av.style.background = 'transparent';
    } else {
        av.innerHTML = '';
        av.textContent = _relIniciais(f.nome);
        av.style.background = cor;
    }

    document.getElementById('relModalNome').textContent =
        f.nome;
    document.getElementById('relModalSub').textContent  =
        `${f.matricula} · ${f.nome_setor || '—'} · ${REL_MESES[mes]} ${ano}`;

    /* Gera tabela e resumo */
    _relGerarFichaModal(f.lancamentos, f.escala, mes, ano, f.resumo);

    /* Abre */
    document.getElementById('relModalOverlay').classList.add('aberto');
    document.body.style.overflow = 'hidden';
}

function relFecharModal() {
    document.getElementById('relModalOverlay').classList.remove('aberto');
    document.body.style.overflow = '';
    _relModalAtual = null;
}

/* ================================================================
   GERAR TABELA NO MODAL (somente leitura)
================================================================ */
function _relGerarFichaModal(lancamentos, escala, mes, ano, resumo) {
    const corpo     = document.getElementById('relModalCorpo');
    const totalDias = new Date(ano, mes, 0).getDate();
    corpo.innerHTML = '';

    for (let dia = 1; dia <= totalDias; dia++) {
        const data      = new Date(ano, mes - 1, dia);
        const diaSemana = data.getDay();
        const nomeDia   = REL_DIAS_SEMANA[diaSemana];
        const ehDomingo = diaSemana === 0;
        const ehSabado  = diaSemana === 6;
        const ehFimSem  = ehDomingo || ehSabado;

        const lanc  = lancamentos.find(l => l.dia === dia) || {};
        const meta  = lanc.meta || CronaCalc.metaParaData(data, escala, _relFeriados);
        const ocorrSalva = _relNormalizarOcorrencia(lanc.ocorrencia);
        const ocorr = ocorrSalva || (ehFimSem ? '—' : 'Normal');
        const ocorrCalculo = ocorr === '—' ? 'Normal' : ocorr;
        let ent1  = lanc.ent1 || '';
        let sai1  = lanc.sai1 || '';
        let ent2  = lanc.ent2 || '';
        let sai2  = lanc.sai2 || '';
        if (REL_ABONADAS.has(ocorrCalculo) || REL_FALTA.has(ocorrCalculo)) {
            ent1 = '';
            sai1 = '';
            ent2 = '';
            sai2 = '';
        }

        const min1     = _relIntervaloMin(ent1, sai1);
        const min2     = _relIntervaloMin(ent2, sai2);
        const totalMin = min1 + min2;
        const metaMin  = _relHoraParaMin(meta);

        /* Saldo com mesma lógica do gestao.js */
        let saldoMin;
        if (REL_ABONADAS.has(ocorrCalculo)) saldoMin = 0;
        else if (REL_FALTA.has(ocorrCalculo)) saldoMin = -metaMin;
        else if (ocorrCalculo === 'Feriado' || ocorrCalculo === 'Folga') saldoMin = totalMin;   // feriado/folga: meta 0
        else if (ehFimSem && metaMin === 0) saldoMin = totalMin;
        else if (ehFimSem && metaMin > 0)  saldoMin = totalMin - metaMin;
        else                              saldoMin = totalMin - metaMin;

        /* Classe da linha
           Sábado SEMPRE azul claro — saldo negativo aparece só no texto */
        let classe = '';
        if (ehDomingo)                    classe = 'rel-linha-domingo';
        else if (ehSabado)                classe = 'rel-linha-sabado';   /* azul independente do saldo */
        else if (REL_ABONADAS.has(ocorrCalculo)) classe = 'rel-linha-abonada';
        else if (ocorrCalculo === 'Falta Injustificada') classe = 'rel-linha-injustificada';
        else if (saldoMin > 0)            classe = 'rel-linha-positivo';
        else if (saldoMin < 0)            classe = 'rel-linha-negativo';

        /* Cor do saldo */
        const saldoCls = saldoMin > 0 ? 'rel-saldo-positivo'
                       : saldoMin < 0 ? 'rel-saldo-negativo'
                       : 'rel-saldo-neutro';

        const saldoStr = (saldoMin >= 0 ? '+' : '-') + _relMinParaHora(Math.abs(saldoMin));

        /* Badge de ocorrência */
        const ocorrMap = {
            'Normal':'ocorr-normal',
            'Faltou':'ocorr-faltou',
            'Falta Injustificada':'ocorr-falta-injust',
            'Falta Justificada':'ocorr-falta-just',
            'Atestado':'ocorr-atestado',
            'Feriado':'ocorr-feriado',
            'Folga':'ocorr-folga',
            'Treinamento':'ocorr-treinamento',
            'Licença Nojo/Luto':'ocorr-licenca',
        };
        const ocorrCls = ocorrMap[ocorr] || 'ocorr-outro';

        const tr = document.createElement('tr');
        tr.className = classe;
        tr.innerHTML = `
            <td class="col-nome-dia">
                ${String(dia).padStart(2,'0')}
                <small style="color:#9ca3af;font-weight:400;font-family:inherit;"> ${nomeDia}</small>
            </td>
            <td>${meta}</td>
            <td>${ent1 || '—'}</td>
            <td>${sai1 || '—'}</td>
            <td>${_relMinParaHora(min1)}</td>
            <td>${ent2 || '—'}</td>
            <td>${sai2 || '—'}</td>
            <td>${_relMinParaHora(min2)}</td>
            <td style="font-weight:700;color:#1d4ed8;">${_relMinParaHora(totalMin)}</td>
            <td class="${saldoCls}">${saldoStr}</td>
            <td>
                <span class="rel-ocorr-badge ${ocorrCls}">${_relEsc(ocorr)}</span>
            </td>`;
        corpo.appendChild(tr);
    }

    /* Rodapé */
    const sinal = resumo.saldoMin >= 0 ? '+' : '-';
    document.getElementById('relModalTotalMes').textContent =
        _relMinParaHora(resumo.totalMin);
    const saldoEl = document.getElementById('relModalSaldoMes');
    saldoEl.textContent = sinal + _relMinParaHora(Math.abs(resumo.saldoMin));
    saldoEl.style.color = resumo.saldoMin >= 0 ? '#86efac' : '#fca5a5';

    /* Cards de resumo no topo do modal */
    document.getElementById('relModalResumo').innerHTML = `
        <div class="rel-resumo-item">
            <div class="rel-resumo-label">Total Trabalhado</div>
            <div class="rel-resumo-valor">${_relMinParaHora(resumo.totalMin)}</div>
        </div>
        <div class="rel-resumo-item">
            <div class="rel-resumo-label">Saldo do Mês</div>
            <div class="rel-resumo-valor ${resumo.saldoMin >= 0 ? 'positivo':'negativo'}">
                ${sinal}${_relMinParaHora(Math.abs(resumo.saldoMin))}
            </div>
        </div>
        <div class="rel-resumo-item">
            <div class="rel-resumo-label">Dias Presentes</div>
            <div class="rel-resumo-valor">${resumo.diasPresentes}</div>
        </div>
        <div class="rel-resumo-item">
            <div class="rel-resumo-label">Faltas</div>
            <div class="rel-resumo-valor ${resumo.faltas > 0 ? 'negativo':''}">
                ${resumo.faltas}
            </div>
        </div>
        <div class="rel-resumo-item">
            <div class="rel-resumo-label">Abonos</div>
            <div class="rel-resumo-valor">${resumo.abonados}</div>
        </div>`;
}

/* ================================================================
   EXPORTAR CSV
================================================================ */
async function relExportarModal() {
    if (!_relModalAtual) return;
    const f = _relModalAtual;
    const btn = document.getElementById('btnRelExportar');
    const orig = btn ? btn.innerHTML : '';
    if (btn) { btn.disabled = true; btn.innerHTML = '<i class="fa-solid fa-circle-notch fa-spin"></i> Gerando...'; }
    try {
        const res = await fetch(`/api/ficha-pdf/baixar?usuario=${f.id_usuario}&mes=${f.mes}&ano=${f.ano}`,
            { headers: _relAuthHeaders() });
        if (!res.ok) {
            let msg = `Erro ${res.status}`;
            try { const j = await res.json(); msg = j.message || msg; } catch (e) { /* ignora */ }
            throw new Error(msg);
        }
        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `ficha-ponto-${(f.nome || '').replace(/\s+/g, '_')}-${f.ano}-${String(f.mes).padStart(2, '0')}.pdf`;
        document.body.appendChild(a); a.click(); a.remove();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (e) {
        window.cronaAlert({ titulo: 'Relatório', mensagem: e.message || 'Erro ao gerar o PDF.' });
    } finally {
        if (btn) { btn.disabled = false; btn.innerHTML = orig; }
    }
}

/* ================================================================
   CALCULAR RESUMO DO MÊS
================================================================ */
function _relCalcularResumo(lancamentos, escala, mes, ano) {
    const totalDias   = new Date(ano, mes, 0).getDate();
    let totalMin      = 0;
    let saldoMin      = 0;
    let diasPresentes = 0;
    let faltas        = 0;
    let abonados      = 0;

    for (let dia = 1; dia <= totalDias; dia++) {
        const data      = new Date(ano, mes - 1, dia);
        const diaSemana = data.getDay();
        const ehFimSem  = diaSemana === 0 || diaSemana === 6;

        const lanc    = lancamentos.find(l => l.dia === dia) || {};
        const ocorr   = _relNormalizarOcorrencia(lanc.ocorrencia) || 'Normal';
        const meta    = lanc.meta || CronaCalc.metaParaData(data, escala, _relFeriados);
        const metaMin = _relHoraParaMin(meta);

        let ent1 = lanc.ent1;
        let sai1 = lanc.sai1;
        let ent2 = lanc.ent2;
        let sai2 = lanc.sai2;
        if (REL_ABONADAS.has(ocorr) || REL_FALTA.has(ocorr)) {
            ent1 = '';
            sai1 = '';
            ent2 = '';
            sai2 = '';
        }

        const min1     = _relIntervaloMin(ent1, sai1);
        const min2     = _relIntervaloMin(ent2, sai2);
        const diaTotal = min1 + min2;

        totalMin += diaTotal;

        if (REL_ABONADAS.has(ocorr)) {
            abonados++;
        } else if (REL_FALTA.has(ocorr)) {
            faltas++;
            saldoMin -= metaMin;
        } else if (ehFimSem && metaMin === 0) {
            saldoMin += diaTotal;
        } else if (ehFimSem && metaMin > 0) {
            saldoMin += (diaTotal - metaMin);
        } else {
            if (diaTotal > 0) diasPresentes++;
            saldoMin += (diaTotal - metaMin);
        }
    }

    return { totalMin, saldoMin, diasPresentes, faltas, abonados };
}

/* ================================================================
   HELPERS
================================================================ */
function _relHoraParaMin(hhmm) {
    if (!hhmm || !hhmm.includes(':')) return 0;
    const [h, m] = hhmm.split(':').map(Number);
    return (isNaN(h) || isNaN(m)) ? 0 : h * 60 + m;
}

function _relMinParaHora(min) {
    if (isNaN(min) || min < 0) min = 0;
    return `${String(Math.floor(min/60)).padStart(2,'0')}:${String(min%60).padStart(2,'0')}`;
}

function _relIntervaloMin(ent, sai) {
    if (!ent || !sai || !ent.includes(':') || !sai.includes(':')) return 0;
    const e = _relHoraParaMin(ent);
    const s = _relHoraParaMin(sai);
    const d = s >= e ? s - e : (1440 - e) + s;
    return d > 0 ? d : 0;
}

function _relNormalizarOcorrencia(ocorrencia) {
    const valor = String(ocorrencia || '').trim();
    if (!valor || valor === '—') return '';
    if (valor === 'Trabalho Normal') return 'Normal';
    if (valor === 'Faltou' || valor === 'Falta Não Justificada' || valor === 'Falta Nao Justificada' || valor === 'Falta Injustificada') return 'Falta Injustificada';
    if (valor === 'Licenca Nojo/Luto') return 'Licença Nojo/Luto';
    return valor;
}

function _relAvatarHtml(f, cor, classe) {
  if (f.foto_perfil) {
    return `<div class="${classe}" style="overflow:hidden;"><img src="${f.foto_perfil}" alt="" style="width:100%;height:100%;object-fit:cover;border-radius:50%;display:block;"></div>`;
  }
  return `<div class="${classe}" style="background:${cor}">${_relIniciais(f.nome)}</div>`;
}

function _relIniciais(nome) {
    if (!nome) return '??';
    return nome.trim().split(' ').filter(Boolean)
        .slice(0, 2).map(p => p[0].toUpperCase()).join('');
}

function _relEsc(v) {
    return String(v ?? '')
        .replace(/&/g,'&amp;').replace(/</g,'&lt;')
        .replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

async function relImprimirModal() {
    if (!_relModalAtual) return;
    const f = _relModalAtual;
    const btn = document.getElementById('btnRelImprimir');
    const orig = btn ? btn.innerHTML : '';
    if (btn) { btn.disabled = true; btn.innerHTML = '<i class="fa-solid fa-circle-notch fa-spin"></i> Gerando...'; }
    try {
        const res = await fetch(`/api/ficha-pdf/baixar?usuario=${f.id_usuario}&mes=${f.mes}&ano=${f.ano}`,
            { headers: _relAuthHeaders() });
        if (!res.ok) {
            let msg = `Erro ${res.status}`;
            try { const j = await res.json(); msg = j.message || msg; } catch (e) { /* ignora */ }
            throw new Error(msg);
        }
        const blob = await res.blob();
        const url = URL.createObjectURL(blob);

        /* Imprime o PDF via iframe oculto (mesma ficha do e-mail). */
        const iframe = document.createElement('iframe');
        iframe.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0;';
        iframe.src = url;
        document.body.appendChild(iframe);
        iframe.onload = () => {
            setTimeout(() => {
                try { iframe.contentWindow.focus(); iframe.contentWindow.print(); }
                catch (e) { window.open(url, '_blank'); }
            }, 300);
        };
        setTimeout(() => { iframe.remove(); URL.revokeObjectURL(url); }, 60000);
    } catch (e) {
        window.cronaAlert({ titulo: 'Impressão', mensagem: e.message || 'Erro ao gerar o PDF para impressão.' });
    } finally {
        if (btn) { btn.disabled = false; btn.innerHTML = orig; }
    }
}

async function _relCarregarFeriados(ano) {
    try {
        const res = await fetch(`/api/feriados/${ano}`, { headers: _relAuthHeaders() });
        if (res.ok) return new Set((await res.json()).map(f => f.data));
    } catch { /* sem feriados */ }
    return new Set();
}

function _relAuthHeaders() {
    return typeof window.cronaAuthHeaders === 'function' ? window.cronaAuthHeaders() : {};
}

function _relObterAreaImpressao() {
    let area = document.getElementById('relPrintArea');
    if (!area) {
        area = document.createElement('div');
        area.id = 'relPrintArea';
        area.setAttribute('aria-hidden', 'true');
        area.style.display = 'none';
        document.body.appendChild(area);
    }
    return area;
}

/* SEM auto-execução — main.js chama iniciarModuloRelatorio() */