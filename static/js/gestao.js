/**
 * CronaSys — static/js/gestao.js
 * -------------------------------------------------------
 * Módulo de Gestão de Lançamentos de Ponto.
 * Carregado UMA VEZ no index.html.
 * Chamado pelo main.js: iniciarModuloGestao()
 *
 * IMPORTANTE: todas as funções privadas usam prefixo _gestao_
 * para evitar colisão de nomes com funcionarios.js.
 *
 * Lógica de ocorrências:
 *   - "Normal"      → conta normalmente (horas - meta = saldo)
 *   - "Faltou"      → conta como falta (saldo = -meta)
 *   - Abonadas      → Atestado, Feriado, Folga,
 *                     Treinamento e justificadas: saldo = 0
 *
 * Rotas:
 *   GET  /api/ponto/:id/:mes/:ano  → carrega ficha salva
 *   POST /api/ponto/salvar         → salva lançamentos
 */

/* ================================================================
   CONSTANTES
================================================================ */

/* Ocorrências que abonam o dia (sem desconto de saldo) */
const OCORRENCIAS_ABONADAS = new Set([
    'Atestado',
    'Treinamento',
    'Licença Nojo/Luto',
    'Férias',
]);

/* Faltas (descontam a meta — saldo negativo). A injustificada também dispara
   o aviso automático; a justificada não, mas continua negativa (não abona). */
const OCORRENCIAS_FALTA = new Set([
    'Faltou',                /* legado */
    'Falta Injustificada',
    'Falta Justificada',
]);

const OCORRENCIAS = [
    'Normal',
    'Falta Injustificada',
    'Falta Justificada',
    'Atestado',
    'Feriado',
    'Folga',
    'Férias',
    'Treinamento',
    'Licença Nojo/Luto',
];

const DIAS_SEMANA  = ['Dom','Seg','Ter','Qua','Qui','Sex','Sáb'];
const MESES_NOMES  = [
    '','Janeiro','Fevereiro','Março','Abril','Maio','Junho',
    'Julho','Agosto','Setembro','Outubro','Novembro','Dezembro',
];

let _gestaoSomenteLeitura = false;
let _gestaoModoFicha = false; /* true = ficha mensal (funcionário) */
let _gestaoEscalaAtual = null;       /* contexto da ficha carregada (p/ positivar) */
let _gestaoFeriadosAtual = new Set();
let _gestaoMesAtual = null;
let _gestaoAnoAtual = null;
let _gestaoTotalDiasAtual = 0;
let _gestaoFichaPossuiLancamentoSalvo = false;

/* ================================================================
   PONTO DE ENTRADA — chamado pelo main.js via INIT_MAP
================================================================ */
function iniciarModuloGestao() {
    console.log('[Gestão] init');
    _gestaoSomenteLeitura = false;
    _gestaoModoFicha = false;
    _gestaoFichaPossuiLancamentoSalvo = false;
    _gestaoDefinirMesAtual();
    _gestaoVincularEventos();
    _gestaoCarregarFuncionariosSelect();
}


/* ================================================================
   INICIALIZAÇÃO
================================================================ */
function _gestaoDefinirMesAtual() {
    const agora = new Date();
    document.getElementById('gMes').value = agora.getMonth() + 1;
    document.getElementById('gAno').value = agora.getFullYear();
}

function _gestaoVincularEventos() {
    document.getElementById('btnCarregarFicha')
        ?.addEventListener('click', gestaoCarregarFicha);

    document.getElementById('btnSalvarFicha')
        ?.addEventListener('click', gestaoSalvarFicha);

    document.getElementById('btnExportar')
        ?.addEventListener('click', gestaoExportar);

    document.getElementById('btnPositivar')?.addEventListener('click', gestaoPositivarMes);
    document.getElementById('btnSalvarFichaRodape')?.addEventListener('click', gestaoSalvarFicha);
    document.getElementById('btnExportarRodape')?.addEventListener('click', gestaoExportar);
    document.getElementById('btnPositivarRodape')?.addEventListener('click', gestaoPositivarMes);
}

async function _gestaoCarregarFuncionariosSelect() {
    const sel = document.getElementById('gFuncionario');
    try {
        const res = await fetch('/api/usuarios', { headers: _gestaoAuthHeaders() });
        if (!res.ok) throw new Error();
        const lista = await res.json();
        sel.innerHTML = '<option value="">— Selecione —</option>';
        lista.filter(f => !f.isento_ponto).forEach(f => {
            const op = document.createElement('option');
            op.value         = f.id_usuario;
            op.textContent   = `${f.matricula} — ${f.nome}`;
            op.dataset.meta    = f.carga_horaria     || '08:00';
            op.dataset.metaSab = f.carga_sab_horaria || '00:00';
            op.dataset.escala  = JSON.stringify(f.escala || {});
            op.dataset.nome    = f.nome;
            sel.appendChild(op);
        });
    } catch {
        sel.innerHTML = '<option value="">Erro ao carregar funcionários</option>';
    }
}


/* ================================================================
   CARREGAR FICHA  →  GET /api/ponto/:id/:mes/:ano
================================================================ */
async function gestaoCarregarFicha() {
    const idUsuario = document.getElementById('gFuncionario').value;
    const mes       = parseInt(document.getElementById('gMes').value);
    const ano       = parseInt(document.getElementById('gAno').value);

    if (_gestaoSomenteLeitura && _gestaoPeriodoFuturo(mes, ano)) {
        _gestaoDefinirMesAtual();
        _gestaoNotificar('A ficha mensal permite consultar apenas o mês atual e meses anteriores.', 'erro');
        return;
    }

    if (!idUsuario) {
        _gestaoNotificar('Selecione um funcionário.', 'erro');
        return;
    }

    const sel   = document.getElementById('gFuncionario');
    const opcao = sel.options[sel.selectedIndex];
    document.getElementById('fichaFuncionario').textContent = opcao.dataset.nome || opcao.text;
    document.getElementById('fichaRef').textContent         = `${MESES_NOMES[mes]} / ${ano}`;
    document.getElementById('cardFicha').style.display      = 'block';

    const escala    = _gestaoLerEscala(opcao);
    const totalDias = _gestaosDiasNoMes(mes, ano);

    let dadosSalvos = [];
    try {
        const res = await fetch(`/api/ponto/${idUsuario}/${mes}/${ano}`, {
            headers: _gestaoAuthHeaders(),
        });
        if (res.ok) dadosSalvos = await res.json();
    } catch { /* ficha em branco */ }

    const feriados = await _gestaoCarregarFeriados(ano);

    // Só-leitura quando é a ficha mensal (funcionário) OU o mês está fechado.
    const mesFechado = _gestaoModoFicha ? false : await _gestaoMesEstaFechado(ano, mes);
    _gestaoSomenteLeitura = _gestaoModoFicha || mesFechado;
    _gestaoAplicarTravaFechamento(mesFechado);

    _gestaoEscalaAtual = escala;
    _gestaoFeriadosAtual = feriados;
    _gestaoMesAtual = mes;
    _gestaoAnoAtual = ano;
    _gestaoTotalDiasAtual = totalDias;

    _gestaoFichaPossuiLancamentoSalvo = dadosSalvos.some(_gestaoLancamentoTemDados);
    _gestaoGerarTabela(totalDias, mes, ano, escala, feriados, dadosSalvos);
    _gestaoRecalcularResumo();
}

/* ================================================================
   GERAR TABELA DINAMICAMENTE
================================================================ */
function _gestaoGerarTabela(totalDias, mes, ano, escala, feriados, dadosSalvos) {
    const corpo = document.getElementById('corpoPonto');
    corpo.innerHTML = '';

    for (let dia = 1; dia <= totalDias; dia++) {
        const data      = new Date(ano, mes - 1, dia);
        const diaSemana = data.getDay();
        const nomeDia   = DIAS_SEMANA[diaSemana];
        const ehDomingo = diaSemana === 0;
        const ehSabado  = diaSemana === 6;

        const salvo     = dadosSalvos.find(d => d.dia === dia) || {};
        const metaDia   = CronaCalc.metaParaData(data, escala, feriados);
        const chaveFeriado = `${ano}-${String(mes).padStart(2, '0')}-${String(dia).padStart(2, '0')}`;
        const ehFeriadoDia = feriados.has(chaveFeriado);
        let ocorrSalva  = _gestaoNormalizarOcorrencia(salvo.ocorrencia || 'Normal');
        /* Feriado sem marcações e sem ocorrência definida → mostra "Feriado" como motivo.
           (se alguém trabalhou no feriado, mantém o que está para não apagar as horas) */
        const semMarcacoes = !salvo.ent1 && !salvo.sai1 && !salvo.ent2 && !salvo.sai2;
        if (ehFeriadoDia && ocorrSalva === 'Normal' && semMarcacoes) {
            ocorrSalva = 'Feriado';
        }
        const ocorrenciasLinha = OCORRENCIAS.includes(ocorrSalva)
            ? OCORRENCIAS
            : [...OCORRENCIAS, ocorrSalva];

        /* Classe base da linha */
        let classeBase = 'linha-normal';
        if (ehDomingo) classeBase = 'linha-domingo';
        else if (ehSabado) classeBase = 'linha-sabado';

        /* Inputs bloqueados em domingo, falta total OU ocorrência abonada */
        const ehAbonada  = OCORRENCIAS_ABONADAS.has(ocorrSalva);
        const ehFaltaTotal = OCORRENCIAS_FALTA.has(ocorrSalva);
        const ehFerias = ocorrSalva === 'Férias';
        const inputsDisabled = (ehDomingo || ehAbonada || ehFaltaTotal || _gestaoSomenteLeitura) ? 'disabled' : '';
        const metaDisabled = 'disabled'; /* meta vem da escala/feriado, não é editável */
        /* Férias só se define/remove pela aba Férias do cadastro do funcionário —
           aqui na Gestão de Ponto o dia fica travado, igual a domingo/feriado. */
        const ocorrDisabled = (ehDomingo || ehFerias || _gestaoSomenteLeitura) ? 'disabled' : '';
        const zeraHorarios = ehAbonada || ehFaltaTotal;
        const valorEnt1 = zeraHorarios ? '' : (salvo.ent1 || '');
        const valorSai1 = zeraHorarios ? '' : (salvo.sai1 || '');
        const valorEnt2 = zeraHorarios ? '' : (salvo.ent2 || '');
        const valorSai2 = zeraHorarios ? '' : (salvo.sai2 || '');

        const tr = document.createElement('tr');
        tr.id          = `linha-${dia}`;
        tr.className   = classeBase;
        tr.dataset.dia = dia;

        tr.innerHTML = `
          <!-- DIA -->
          <td>
            <span class="cell-dia">${String(dia).padStart(2,'0')}</span>
            <span class="cell-dia-nome">${nomeDia}</span>
          </td>

          <!-- META -->
          <td>
            <input type="text"
                   class="input-meta"
                   id="meta-${dia}"
                   value="${metaDia}"
                   data-hora-valida="${metaDia}"
                   maxlength="5"
                   inputmode="numeric"
                   autocomplete="off"
                   placeholder="08:00"
                   title="Use HH:MM. Ex.: 08:00"
                   ${metaDisabled}
                   onkeydown="return mascaraHoraTecla(event)"
                   oninput="mascaraHora(this)"
                   onblur="mascaraHoraFinalizar(this)"
                   onchange="gestaoRecalcularLinha(${dia})" />
          </td>

          <!-- ENT. 1 -->
          <td>
            <input type="text"
                   class="input-time"
                   id="ent1-${dia}"
                   value="${valorEnt1}"
                   data-hora-valida="${valorEnt1}"
                   maxlength="5"
                   inputmode="numeric"
                   autocomplete="off"
                   placeholder="--:--"
                   title="Use HH:MM. Ex.: 09:00 ou 17:30"
                   ${inputsDisabled}
                   onkeydown="return mascaraHoraTecla(event)"
                   oninput="mascaraHora(this)"
                   onblur="mascaraHoraFinalizar(this)"
                   onchange="gestaoRecalcularLinha(${dia})" />
          </td>

          <!-- SAÍ. 1 -->
          <td>
            <input type="text"
                   class="input-time"
                   id="sai1-${dia}"
                   value="${valorSai1}"
                   data-hora-valida="${valorSai1}"
                   maxlength="5"
                   inputmode="numeric"
                   autocomplete="off"
                   placeholder="--:--"
                   title="Use HH:MM. Ex.: 09:00 ou 17:30"
                   ${inputsDisabled}
                   onkeydown="return mascaraHoraTecla(event)"
                   oninput="mascaraHora(this)"
                   onblur="mascaraHoraFinalizar(this)"
                   onchange="gestaoRecalcularLinha(${dia})" />
          </td>

          <!-- TOTAL 1 -->
          <td class="col-calc">
            <span class="cell-calc" id="total1-${dia}">
              ${_gestaoIntervaloStr(valorEnt1, valorSai1)}
            </span>
          </td>

          <!-- ENT. 2 -->
          <td>
            <input type="text"
                   class="input-time"
                   id="ent2-${dia}"
                   value="${valorEnt2}"
                   data-hora-valida="${valorEnt2}"
                   maxlength="5"
                   inputmode="numeric"
                   autocomplete="off"
                   placeholder="--:--"
                   title="Use HH:MM. Ex.: 09:00 ou 17:30"
                   ${inputsDisabled}
                   onkeydown="return mascaraHoraTecla(event)"
                   oninput="mascaraHora(this)"
                   onblur="mascaraHoraFinalizar(this)"
                   onchange="gestaoRecalcularLinha(${dia})" />
          </td>

          <!-- SAÍ. 2 -->
          <td>
            <input type="text"
                   class="input-time"
                   id="sai2-${dia}"
                   value="${valorSai2}"
                   data-hora-valida="${valorSai2}"
                   maxlength="5"
                   inputmode="numeric"
                   autocomplete="off"
                   placeholder="--:--"
                   title="Use HH:MM. Ex.: 09:00 ou 17:30"
                   ${inputsDisabled}
                   onkeydown="return mascaraHoraTecla(event)"
                   oninput="mascaraHora(this)"
                   onblur="mascaraHoraFinalizar(this)"
                   onchange="gestaoRecalcularLinha(${dia})" />
          </td>

          <!-- TOTAL 2 -->
          <td class="col-calc">
            <span class="cell-calc" id="total2-${dia}">
              ${_gestaoIntervaloStr(valorEnt2, valorSai2)}
            </span>
          </td>

          <!-- TOTAL DIA -->
          <td class="col-calc col-destaque">
            <span class="cell-calc" id="totaldia-${dia}">00:00</span>
          </td>

          <!-- SALDO -->
          <td class="col-calc col-saldo">
            <span class="cell-calc neutro" id="saldo-${dia}">00:00</span>
          </td>

          <!-- OCORRÊNCIA -->
          <td>
            <select class="select-ocorr"
                    id="ocorr-${dia}"
                    ${ocorrDisabled}
                    onchange="gestaoMudarOcorrencia(${dia})">
              ${ocorrenciasLinha.map(o =>
                  `<option value="${o}" ${ocorrSalva === o ? 'selected' : ''}>${o}</option>`
              ).join('')}
            </select>
          </td>
        `;

        corpo.appendChild(tr);

        /* Calcula o saldo inicial da linha */
        gestaoRecalcularLinha(dia);
    }
}

/* ================================================================
   MUDAR OCORRÊNCIA
   Chamado quando o usuário troca o select de ocorrência.
   → Se for abonada ou falta total: zera os inputs e bloqueia edição
   → Se for Normal/Faltou: desbloqueia os inputs
================================================================ */
function gestaoMudarOcorrencia(dia) {
    const ocorr     = document.getElementById(`ocorr-${dia}`)?.value || 'Normal';
    const ehAbonada = OCORRENCIAS_ABONADAS.has(ocorr);
    const ehFaltaTotal = OCORRENCIAS_FALTA.has(ocorr);
    const linha     = document.getElementById(`linha-${dia}`);
    const ehDomingo = linha?.classList.contains('linha-domingo');

    /* Não mexe em domingo — sempre fica desabilitado */
    if (ehDomingo) return;

    const inputIds = [`ent1-${dia}`, `sai1-${dia}`, `ent2-${dia}`, `sai2-${dia}`];

    if (ehAbonada || ehFaltaTotal) {
        /* Zera e bloqueia os inputs de horário */
        inputIds.forEach(id => {
            const el = document.getElementById(id);
            if (!el) return;
            el.value    = '';
            el.disabled = true;
        });
    } else {
        /* Desbloqueia para lançamento normal */
        inputIds.forEach(id => {
            const el = document.getElementById(id);
            if (el) el.disabled = false;
        });
    }

    /* Recalcula saldo da linha com nova lógica */
    gestaoRecalcularLinha(dia);
}

/* ================================================================
   CÁLCULO EM TEMPO REAL  (chamado por onchange dos inputs)
================================================================ */
function gestaoRecalcularLinha(dia) {
    const ent1  = document.getElementById(`ent1-${dia}`)?.value  || '';
    const sai1  = document.getElementById(`sai1-${dia}`)?.value  || '';
    const ent2  = document.getElementById(`ent2-${dia}`)?.value  || '';
    const sai2  = document.getElementById(`sai2-${dia}`)?.value  || '';
    const meta  = document.getElementById(`meta-${dia}`)?.value  || '00:00';
    const ocorr = document.getElementById(`ocorr-${dia}`)?.value || 'Normal';

    const min1      = _gestaoIntervaloMin(ent1, sai1);
    const min2      = _gestaoIntervaloMin(ent2, sai2);
    const totalMin  = min1 + min2;
    const metaMin   = _gestaoHoraParaMin(meta);

    /* Atualiza TOTAL 1, TOTAL 2, TOTAL DIA */
    document.getElementById(`total1-${dia}`).textContent   = _gestaoMinParaHora(min1);
    document.getElementById(`total2-${dia}`).textContent   = _gestaoMinParaHora(min2);
    document.getElementById(`totaldia-${dia}`).textContent = _gestaoMinParaHora(totalMin);

    /* ── Lógica de saldo por tipo de ocorrência ─────────
       Normal      → saldo = total trabalhado - meta
       Faltou      → saldo = 0 - meta  (falta total)
       Abonadas    → saldo = 0  (dia não conta para o banco)
       Fim semana  → saldo = total (tudo vira extra)
    ─────────────────────────────────────────────────── */
    const linha     = document.getElementById(`linha-${dia}`);
    const ehFimSem  = linha?.classList.contains('linha-domingo') ||
                      linha?.classList.contains('linha-sabado');

    let saldoMin;

    if (OCORRENCIAS_ABONADAS.has(ocorr)) {
        /* Abonada: saldo zero — não penaliza nem bonifica */
        saldoMin = 0;
    } else if (OCORRENCIAS_FALTA.has(ocorr)) {
        /* Falta (justificada ou não): desconta a meta inteira */
        saldoMin = -metaMin;
    } else if (ocorr === 'Feriado' || ocorr === 'Folga') {
        /* Feriado/Folga: meta 0 — conta só o que a pessoa trabalhou (vira extra) */
        saldoMin = totalMin;
    } else if (ehFimSem && metaMin === 0) {
        /* Fim de semana SEM meta: tudo que trabalhou é hora extra */
        saldoMin = totalMin;
    } else if (ehFimSem && metaMin > 0) {
        /* Sábado COM meta: trata igual a dia útil */
        saldoMin = totalMin - metaMin;
    } else {
        /* Normal: diferença entre o que trabalhou e a meta */
        saldoMin = totalMin - metaMin;
    }

    if (linha) linha.dataset.saldoMin = String(saldoMin);
    _gestaoAtualizarSaldoLinha(dia, saldoMin, metaMin, ehFimSem, ocorr);
    _gestaoRecalcularResumo();
}

function _gestaoAtualizarSaldoLinha(dia, saldoMin, metaMin, ehFimSem, ocorr) {
    const saldoEl = document.getElementById(`saldo-${dia}`);
    const linhaEl = document.getElementById(`linha-${dia}`);
    if (!saldoEl || !linhaEl) return;

    const sinal = saldoMin >= 0 ? '+' : '-';
    saldoEl.textContent = `${sinal}${_gestaoMinParaHora(Math.abs(saldoMin))}`;

    /* Remove classes de cor anteriores */
    saldoEl.classList.remove('positivo', 'negativo', 'neutro');
    linhaEl.classList.remove('linha-positivo', 'linha-negativo', 'linha-abonada');
    if (!ehFimSem) linhaEl.classList.add('linha-normal');

    if (OCORRENCIAS_ABONADAS.has(ocorr)) {
        /* Abonada: cor neutra — dia tratado como OK */
        saldoEl.classList.add('neutro');
        linhaEl.classList.remove('linha-normal');
        linhaEl.classList.add('linha-abonada');
        return;
    }
    if (ehFimSem && metaMin === 0) {
        /* Fim de semana sem meta: verde se trabalhou, neutro se não */
        saldoEl.classList.add(saldoMin > 0 ? 'positivo' : 'neutro');
        return;
    }
    if (ehFimSem) {
        saldoEl.classList.add(saldoMin > 0 ? 'positivo' : saldoMin < 0 ? 'negativo' : 'neutro');
        return;
    }

    if (saldoMin > 0) {
        saldoEl.classList.add('positivo');
        linhaEl.classList.add('linha-positivo');
    } else if (saldoMin < 0) {
        saldoEl.classList.add('negativo');
        linhaEl.classList.add('linha-negativo');
    } else {
        saldoEl.classList.add('neutro');
    }
}

/* ================================================================
   RESUMO DO MÊS (rodapé da tabela)
================================================================ */
/* ================================================================
   POSITIVAR MÊS
   Preenche todos os dias com meta batendo exatamente a meta (saldo 00:00)
   e zera os demais. NÃO salva — o RH revisa e clica em Salvar.
================================================================ */
async function gestaoPositivarMes() {
    if (_gestaoSomenteLeitura) {
        _gestaoNotificar('Mês fechado ou somente leitura — não é possível positivar.', 'erro');
        return;
    }
    if (!_gestaoMesAtual || !_gestaoTotalDiasAtual) {
        _gestaoNotificar('Carregue uma ficha primeiro.', 'erro');
        return;
    }
    if (!(await window.cronaConfirm({
        titulo: 'Positivar o mês',
        mensagem: 'Todos os dias com meta serão preenchidos batendo exatamente a meta (saldo 00:00) e os demais ficam zerados. Revise e clique em "Salvar Lançamentos" depois. Positivar agora?',
        textoOk: 'Positivar',
    }))) {
        return;
    }

    const dados = [];
    for (let dia = 1; dia <= _gestaoTotalDiasAtual; dia++) {
        const data = new Date(_gestaoAnoAtual, _gestaoMesAtual - 1, dia);
        const metaMin = CronaCalc.horaParaMin(
            CronaCalc.metaParaData(data, _gestaoEscalaAtual, _gestaoFeriadosAtual)
        );
        dados.push({ dia, ocorrencia: 'Normal', ..._gestaoHorariosParaMeta(metaMin) });
    }

    _gestaoGerarTabela(_gestaoTotalDiasAtual, _gestaoMesAtual, _gestaoAnoAtual, _gestaoEscalaAtual, _gestaoFeriadosAtual, dados);
    _gestaoRecalcularResumo();
    _gestaoNotificar('Mês positivado! Revise e clique em Salvar Lançamentos.', 'sucesso');
}

/* Gera horários (ent/sai) que somam exatamente a meta (em minutos). */
function _gestaoHorariosParaMeta(metaMin) {
    if (!metaMin || metaMin <= 0) return { ent1: '', sai1: '', ent2: '', sai2: '' };

    const manha = Math.min(metaMin, 240);
    const ent1 = '08:00';
    const sai1 = CronaCalc.minParaHora(CronaCalc.horaParaMin('08:00') + manha);

    if (metaMin <= 240) return { ent1, sai1, ent2: '', sai2: '' };

    const tarde = metaMin - 240;
    const ent2 = '13:00';
    const sai2 = CronaCalc.minParaHora(CronaCalc.horaParaMin('13:00') + tarde);
    return { ent1, sai1, ent2, sai2 };
}

function _gestaoRecalcularResumo() {
    const linhas = document.querySelectorAll('#corpoPonto tr');
    let totalMesMin = 0;
    let saldoMesMin = 0;

    linhas.forEach(tr => {
        const dia = tr.dataset.dia;
        if (!dia) return;

        const ent1 = document.getElementById(`ent1-${dia}`)?.value || '';
        const sai1 = document.getElementById(`sai1-${dia}`)?.value || '';
        const ent2 = document.getElementById(`ent2-${dia}`)?.value || '';
        const sai2 = document.getElementById(`sai2-${dia}`)?.value || '';

        totalMesMin += _gestaoIntervaloMin(ent1, sai1) + _gestaoIntervaloMin(ent2, sai2);

        /* Saldo: usa o valor JÁ calculado por dia (mesma fonte da coluna SALDO),
           garantindo que o resumo do mês nunca divirja do cálculo por dia. */
        saldoMesMin += Number(tr.dataset.saldoMin) || 0;
    });

    const resumoTotal = document.getElementById('resumoTotal');
    const resumoSaldo = document.getElementById('resumoSaldo');

    resumoTotal.textContent = _gestaoMinParaHora(totalMesMin);

    const sinalRes = saldoMesMin >= 0 ? '+' : '-';
    resumoSaldo.textContent = `${sinalRes}${_gestaoMinParaHora(Math.abs(saldoMesMin))}`;
    resumoSaldo.style.color = saldoMesMin >= 0 ? '#86efac' : '#fca5a5';

    /* Saldo total do rótulo do rodapé (mesmo valor da coluna SALDO). */
    const resumoSaldoTotal = document.getElementById('resumoSaldoTotal');
    if (resumoSaldoTotal) {
        resumoSaldoTotal.textContent = `${sinalRes}${_gestaoMinParaHora(Math.abs(saldoMesMin))}`;
        resumoSaldoTotal.style.color = saldoMesMin >= 0 ? '#16a34a' : '#dc2626';
    }
}

function _gestaoLancamentoTemDados(lancamento) {
    if (!lancamento) return false;
    const ocorrencia = _gestaoNormalizarOcorrencia(lancamento.ocorrencia || 'Normal');
    return Boolean(
        lancamento.ent1 ||
        lancamento.sai1 ||
        lancamento.ent2 ||
        lancamento.sai2 ||
        (ocorrencia && ocorrencia !== 'Normal')
    );
}

async function _gestaoConfirmarSobrescrita() {
    const sel = document.getElementById('gFuncionario');
    const opcao = sel?.options[sel.selectedIndex];
    const nome = opcao?.dataset.nome || opcao?.text || 'funcionário selecionado';
    const mes = parseInt(document.getElementById('gMes')?.value, 10);
    const ano = parseInt(document.getElementById('gAno')?.value, 10);
    const periodo = `${MESES_NOMES[mes] || mes} / ${ano || ''}`;

    return await window.cronaConfirm({
        titulo: 'Substituir lançamentos',
        mensagem: `Já existem lançamentos salvos para ${nome} em ${periodo}. Salvar agora vai substituir os lançamentos antigos pelos dados da tela. Deseja continuar?`,
        textoOk: 'Substituir',
        perigo: true,
    });
}

/* ================================================================
   SALVAR FICHA  →  POST /api/ponto/salvar
================================================================ */
async function gestaoSalvarFicha() {
    if (_gestaoSomenteLeitura) {
        _gestaoNotificar('Esta ficha é somente para consulta.', 'erro');
        return;
    }

    const idUsuario = document.getElementById('gFuncionario').value;
    const mes       = parseInt(document.getElementById('gMes').value);
    const ano       = parseInt(document.getElementById('gAno').value);

    if (!idUsuario) {
        _gestaoNotificar('Selecione um funcionário antes de salvar.', 'erro');
        return;
    }

    const horariosCorrigidos = _gestaoFinalizarHorariosTabela();
    if (horariosCorrigidos > 0) {
        _gestaoNotificar('Revise os horários destacados e salve novamente. Use sempre HH:MM, como 09:00 ou 17:30.', 'erro');
        return;
    }

    if (_gestaoFichaPossuiLancamentoSalvo && !(await _gestaoConfirmarSobrescrita())) {
        return;
    }

    const lancamentos = [];
    document.querySelectorAll('#corpoPonto tr').forEach(tr => {
        const dia = parseInt(tr.dataset.dia);
        if (!dia) return;
        lancamentos.push({
            dia,
            meta:       document.getElementById(`meta-${dia}`)?.value     || '00:00',
            ent1:       document.getElementById(`ent1-${dia}`)?.value     || '',
            sai1:       document.getElementById(`sai1-${dia}`)?.value     || '',
            ent2:       document.getElementById(`ent2-${dia}`)?.value     || '',
            sai2:       document.getElementById(`sai2-${dia}`)?.value     || '',
            ocorrencia: _gestaoNormalizarOcorrencia(document.getElementById(`ocorr-${dia}`)?.value || 'Normal'),
        });
    });

    const btn = document.getElementById('btnSalvarFicha');
    btn.disabled = true;
    btn.innerHTML = '<i class="fa-solid fa-circle-notch fa-spin"></i> Salvando...';

    try {
        const res = await fetch('/api/ponto/salvar', {
            method:  'POST',
            headers: _gestaoHeadersJson(),
            body:    JSON.stringify({ id_usuario: idUsuario, mes, ano, lancamentos }),
        });
        const json = await res.json();
        if (!res.ok) throw new Error(json.message || `Erro ${res.status}`);
        _gestaoFichaPossuiLancamentoSalvo = lancamentos.some(_gestaoLancamentoTemDados);
        _gestaoNotificar('Lançamentos salvos com sucesso!', 'sucesso');
    } catch (e) {
        console.error('[Gestão] Salvar:', e);
        _gestaoNotificar(e.message || 'Erro ao salvar.', 'erro');
    } finally {
        btn.disabled = false;
        btn.innerHTML = '<i class="fa-solid fa-floppy-disk"></i> Salvar Lançamentos';
    }
}

/* ================================================================
   EXPORTAR PARA EXCEL (CSV com separador ;)
================================================================ */
function gestaoExportar() {
    const sel   = document.getElementById('gFuncionario');
    const opcao = sel.options[sel.selectedIndex];
    const mes   = parseInt(document.getElementById('gMes').value);
    const ano   = parseInt(document.getElementById('gAno').value);
    const nome  = opcao?.dataset.nome || 'funcionario';

    const linhas = [
        ['CRONASYS - FORMULÁRIO DE BANCO DE HORAS'],
        ['FUNCIONÁRIO:', nome, '', 'MÊS REF:', `${String(mes).padStart(2,'0')}/${ano}`],
        [],
        ['DIA','META','ENT. 1','SAÍ. 1','TOTAL 1','ENT. 2','SAÍ. 2','TOTAL 2','TOTAL DIA','SALDO','OCORRÊNCIA'],
    ];

    document.querySelectorAll('#corpoPonto tr').forEach(tr => {
        const dia = parseInt(tr.dataset.dia);
        if (!dia) return;
        const gV = id => document.getElementById(`${id}-${dia}`)?.value || '';
        const gT = id => document.getElementById(`${id}-${dia}`)?.textContent?.trim() || '';
        linhas.push([
            dia, gV('meta'),
            gV('ent1'), gV('sai1'), gT('total1'),
            gV('ent2'), gV('sai2'), gT('total2'),
            gT('totaldia'), gT('saldo'),
            document.getElementById(`ocorr-${dia}`)?.value || '',
        ]);
    });

    linhas.push([]);
    linhas.push([
        '','','','','','','','RESUMO:',
        document.getElementById('resumoTotal')?.textContent || '',
        document.getElementById('resumoSaldo')?.textContent || '',
    ]);

    const csv = linhas.map(l =>
        l.map(c => `"${String(c).replace(/"/g,'""')}"`).join(';')
    ).join('\n');

    const a    = document.createElement('a');
    a.href     = URL.createObjectURL(new Blob(['\uFEFF'+csv], { type:'text/csv;charset=utf-8;' }));
    a.download = `CartaoPonto_${nome.replace(/\s+/g,'_')}_${ano}-${String(mes).padStart(2,'0')}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
    _gestaoNotificar('Arquivo exportado com sucesso!', 'info');
}

/* ================================================================
   ESCALA E FERIADOS
================================================================ */
function _gestaoLerEscala(opcao) {
    try { return JSON.parse(opcao?.dataset.escala || '{}'); }
    catch { return {}; }
}

const _gestaoFeriadosCache = {};
async function _gestaoCarregarFeriados(ano) {
    if (_gestaoFeriadosCache[ano]) return _gestaoFeriadosCache[ano];
    try {
        const res = await fetch(`/api/feriados/${ano}`, { headers: _gestaoAuthHeaders() });
        if (res.ok) {
            const set = new Set((await res.json()).map(f => f.data));
            _gestaoFeriadosCache[ano] = set;
            return set;
        }
    } catch { /* sem feriados */ }
    return new Set();
}

/* O mês está fechado? (consulta o status do fechamento — só admin) */
async function _gestaoMesEstaFechado(ano, mes) {
    try {
        const res = await fetch(`/api/fechamento/${ano}/${mes}/status`, { headers: _gestaoAuthHeaders() });
        if (!res.ok) return false;
        const st = await res.json();
        return Boolean(st.fechado);
    } catch { return false; }
}

/* Aplica a trava visual de mês fechado: desabilita salvar + mostra aviso */
function _gestaoAplicarTravaFechamento(fechado) {
    if (!_gestaoModoFicha) {
        ['btnSalvarFicha', 'btnSalvarFichaRodape', 'btnPositivar', 'btnPositivarRodape'].forEach(id => {
            const el = document.getElementById(id);
            if (el) {
                el.disabled = fechado;
                el.title = fechado ? 'Mês fechado — reabra em Fechamento de Folha para editar.' : '';
            }
        });
    }

    let banner = document.getElementById('gestaoBannerFechado');
    if (fechado) {
        if (!banner) {
            banner = document.createElement('div');
            banner.id = 'gestaoBannerFechado';
            banner.style.cssText = 'display:flex;align-items:center;gap:8px;background:#fffbeb;'
                + 'border:1px solid #fcd34d;color:#b45309;border-radius: 0;padding:10px 14px;'
                + 'font-size:13px;font-weight:500;margin-bottom:14px;';
            banner.innerHTML = '<i class="fa-solid fa-lock"></i> Mês fechado — edições bloqueadas. '
                + 'Reabra em “Fechamento de Folha” para editar.';
            const card = document.getElementById('cardFicha');
            if (card) card.insertBefore(banner, card.firstChild);
        }
        banner.style.display = 'flex';
    } else if (banner) {
        banner.style.display = 'none';
    }
}

/* ================================================================
   MÁSCARA DE HORÁRIO (chamada pelo oninput dos inputs)
   "0800" → "08:00"
================================================================ */
function mascaraHoraTecla(event) {
    const teclasLiberadas = new Set([
        'Backspace', 'Delete', 'Tab', 'ArrowLeft', 'ArrowRight',
        'Home', 'End', 'Escape',
    ]);

    if (event.ctrlKey || event.metaKey) return true;
    if (event.key === 'Enter') {
        event.preventDefault();
        mascaraHoraFinalizar(event.target);
        event.target.blur();
        return false;
    }
    if (teclasLiberadas.has(event.key)) return true;
    return /^\d$/.test(event.key);
}

function mascaraHora(input) {
    const digitos = String(input.value || '').replace(/\D/g, '');
    input.value = _gestaoFormatarHoraParcial(digitos);

    const completo = _gestaoHorarioCompletoValido(input.value);
    input.setAttribute('aria-invalid', input.value && !completo ? 'true' : 'false');
    if (completo) input.dataset.horaValida = input.value;

    return input.value;
}

function mascaraHoraFinalizar(input) {
    const valor = mascaraHora(input);
    const horaCompleta = _gestaoCompletarHora(valor);
    let valido = !valor || Boolean(horaCompleta);

    if (horaCompleta) {
        input.value = horaCompleta;
        input.dataset.horaValida = horaCompleta;
        input.setAttribute('aria-invalid', 'false');
    }

    if (!valido) {
        if (input.classList.contains('input-meta')) {
            const fallback = _gestaoHorarioCompletoValido(input.dataset.horaValida)
                ? input.dataset.horaValida
                : '00:00';
            input.value = fallback;
            input.dataset.horaValida = fallback;
        } else {
            input.value = '';
            input.dataset.horaValida = '';
        }
        input.setAttribute('aria-invalid', 'false');
        _gestaoSinalizarHoraCorrigida(input);
    }

    const dia = _gestaoDiaDoInput(input);
    if (dia) gestaoRecalcularLinha(dia);
    return valido;
}

function _gestaoFinalizarHorariosTabela() {
    let corrigidos = 0;
    document.querySelectorAll('#corpoPonto .input-time:not(:disabled), #corpoPonto .input-meta:not(:disabled)')
        .forEach(input => {
            if (!mascaraHoraFinalizar(input)) corrigidos++;
        });
    return corrigidos;
}

function _gestaoFormatarHoraParcial(digitos) {
    const limpo = String(digitos || '').replace(/\D/g, '').slice(0, 4);
    if (!limpo) return '';

    const primeiro = Number(limpo[0]);
    if (primeiro > 2) {
        const minutos = limpo.slice(1, 3);
        if (!minutos) return limpo[0];
        if (Number(minutos[0]) > 5) return limpo[0];
        return `0${limpo[0]}:${minutos}`;
    }

    if (limpo.length === 1) return limpo;

    const hora = limpo.slice(0, 2);
    if (Number(hora) > 23) return limpo[0];
    if (limpo.length <= 2) return hora;

    const minutos = limpo.slice(2, 4);
    if (Number(minutos[0]) > 5) return hora;
    return `${hora}:${minutos}`;
}

function _gestaoCompletarHora(valor) {
    const digitos = String(valor || '').replace(/\D/g, '');
    if (!digitos) return '';

    const primeiro = Number(digitos[0]);
    let hora = '';
    let minutos = '';

    if (primeiro > 2) {
        hora = `0${digitos[0]}`;
        minutos = digitos.slice(1, 3).padEnd(2, '0');
    } else if (digitos.length === 1) {
        hora = `0${digitos[0]}`;
        minutos = '00';
    } else {
        hora = digitos.slice(0, 2);
        minutos = digitos.slice(2, 4).padEnd(2, '0') || '00';
    }

    const horaMin = Number(hora);
    const minutoMin = Number(minutos);
    if (horaMin > 23 || minutoMin > 59) return '';
    return `${hora.padStart(2, '0')}:${minutos.padStart(2, '0')}`;
}

function _gestaoHorarioCompletoValido(valor) {
    const match = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(String(valor || '').trim());
    return Boolean(match);
}

function _gestaoSinalizarHoraCorrigida(input) {
    input.classList.add('hora-corrigida');
    clearTimeout(input._horaCorrigidaTimer);
    input._horaCorrigidaTimer = setTimeout(() => {
        input.classList.remove('hora-corrigida');
    }, 1200);
}

function _gestaoDiaDoInput(input) {
    const match = String(input?.id || '').match(/-(\d+)$/);
    return match ? Number(match[1]) : null;
}

/* ================================================================
   HELPERS DE TEMPO
================================================================ */
function _gestaoHoraParaMin(hhmm) {
    if (!_gestaoHorarioCompletoValido(hhmm)) return 0;
    const [h, m] = hhmm.split(':').map(Number);
    return (isNaN(h) || isNaN(m)) ? 0 : h * 60 + m;
}

function _gestaoMinParaHora(min) {
    if (isNaN(min) || min < 0) min = 0;
    const h = Math.floor(min / 60);
    const m = min % 60;
    return `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}`;
}

function _gestaoIntervaloMin(entrada, saida) {
    if (!_gestaoHorarioCompletoValido(entrada) || !_gestaoHorarioCompletoValido(saida)) return 0;
    const e = _gestaoHoraParaMin(entrada);
    const s = _gestaoHoraParaMin(saida);
    const diff = s >= e ? s - e : (1440 - e) + s; /* aceita virada de meia-noite */
    return diff > 0 ? diff : 0;
}

function _gestaoIntervaloStr(ent, sai) {
    return _gestaoMinParaHora(_gestaoIntervaloMin(ent, sai));
}

function _gestaosDiasNoMes(mes, ano) {
    return new Date(ano, mes, 0).getDate();
}

function _gestaoPeriodoFuturo(mes, ano) {
    const agora = new Date();
    const anoAtual = agora.getFullYear();
    const mesAtual = agora.getMonth() + 1;
    return ano > anoAtual || (ano === anoAtual && mes > mesAtual);
}

function _gestaoNormalizarOcorrencia(ocorrencia) {
    const valor = String(ocorrencia || '').trim();
    if (!valor || valor === '—') return 'Normal';
    if (valor === 'Trabalho Normal') return 'Normal';
    if (valor === 'Faltou' || valor === 'Falta Não Justificada' || valor === 'Falta Nao Justificada' || valor === 'Falta Injustificada') return 'Falta Injustificada';
    if (valor === 'Licenca Nojo/Luto') return 'Licença Nojo/Luto';
    return valor;
}

function _gestaoAuthHeaders() {
    return typeof window.cronaAuthHeaders === 'function' ? window.cronaAuthHeaders() : {};
}

function _gestaoHeadersJson() {
    return {
        'Content-Type': 'application/json',
        ..._gestaoAuthHeaders(),
    };
}

/* ================================================================
   NOTIFICAÇÃO
================================================================ */
function _gestaoNotificar(msg, tipo = 'sucesso') {
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
        box-shadow:0 4px 12px rgba(0,0,0,.1);max-width:420px;`;
    el.innerHTML = `<i class="fa-solid ${c.icone}"></i> ${msg}`;
    document.body.appendChild(el);
    setTimeout(() => el.remove(), 4000);
}

/* SEM auto-execução — o main.js chama iniciarModuloGestao() */