/**
 * CronaSys — static/js/dashboard.js
 * Dashboard inicial com visao por perfil.
 */

const DASH_DIAS_SEMANA = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
const DASH_MESES = [
  '', 'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
];

const DASH_ABONADAS = new Set([
  'Atestado', 'Treinamento',
  'Licença Nojo/Luto',
]);

/* Faltas (descontam meta — negativo). Injustificada também gera aviso. */
const DASH_FALTA = new Set(['Faltou', 'Falta Injustificada', 'Falta Justificada']);

let _dashFeriados = new Set();

const DASH_CORES = [
  '#3b82f6', '#8b5cf6', '#ec4899', '#14b8a6',
  '#f59e0b', '#ef4444', '#10b981', '#6366f1',
];

async function iniciarModuloDashboard() {
  const usuario = _dashUsuarioAtual();
  const admin = _dashEhAdmin();

  if (!usuario?.id) {
    _dashRenderErro('Não foi possível identificar o usuário logado.');
    return;
  }

  _dashPrepararTela(admin, usuario);
  _dashVincularAcoes(admin);

  try {
    _dashFeriados = await _dashCarregarFeriados(_dashPeriodoAtual().ano);
    if (admin) {
      await _dashCarregarAdmin(usuario);
    } else if (usuario.isento_ponto) {
      _dashRenderFuncionarioIsento();
    } else {
      await _dashCarregarFuncionario(usuario);
    }
  } catch (erro) {
    console.error('[Dashboard]', erro);
    _dashRenderErro(erro.message || 'Erro ao carregar o Dashboard.');
  }
}

function _dashPrepararTela(admin, usuario) {
  const periodo = _dashPeriodoAtual();
  const periodoTexto = `${DASH_MESES[periodo.mes]} / ${periodo.ano}`;
  const subtitulo = admin
    ? 'Visão geral dos funcionários no mês atual'
    : 'Seu resumo de ponto no mês atual';

  document.getElementById('dashTitulo').textContent = admin
    ? 'Dashboard Administrativo'
    : `Olá, ${usuario.nome || 'Funcionário'}`;
  document.getElementById('dashSubtitulo').textContent = subtitulo;
  const _elPeriodo = document.getElementById('dashPeriodo');
  if (_elPeriodo) _elPeriodo.textContent = periodoTexto;
  const _elStatus = document.getElementById('dashStatus');
  if (_elStatus) _elStatus.textContent = 'Carregando dados...';

  document.getElementById('dashKpiTotalLabel').textContent = admin ? 'Total da equipe' : 'Total trabalhado';
  document.getElementById('dashKpiRegistroLabel').textContent = admin ? 'Com lançamento' : 'Dias com registro';
  document.getElementById('dashKpiAlertaLabel').textContent = admin ? 'Saldos negativos' : 'Faltas';

  const abasAdmin = document.getElementById('dashAdminTabs');
  if (abasAdmin) abasAdmin.style.display = admin ? 'flex' : 'none';

  // Isento de ponto não tem ficha pessoal: esconde a aba "Minha ficha"
  const abaMinhaBtn = document.querySelector('.dash-admin-tab[data-dash-tab="minha"]');
  if (abaMinhaBtn) abaMinhaBtn.style.display = usuario.isento_ponto ? 'none' : '';

  _dashSelecionarAbaAdmin(admin ? 'geral' : null);

  const acao = document.getElementById('dashAcaoPrincipal');
  if (acao) {
    acao.innerHTML = admin
      ? '<i class="fa-solid fa-chart-pie"></i><span>Relatórios</span>'
      : '<i class="fa-solid fa-calendar-days"></i><span>Ver ficha</span>';
  }
}

function _dashVincularAcoes(admin) {
  document.getElementById('dashAcaoPrincipal')?.addEventListener('click', () => {
    const pagina = admin ? 'relatorio' : 'banco-horas';
    const link = document.querySelector(`.nav-item[data-page="${pagina}"]`);
    if (typeof navegar === 'function') navegar(pagina, link);
  });

  document.getElementById('dashMinhaFichaBtn')?.addEventListener('click', () => {
    const link = document.querySelector('.nav-item[data-page="banco-horas"]');
    if (typeof navegar === 'function') navegar('banco-horas', link);
  });

  document.querySelectorAll('.dash-admin-tab').forEach(botao => {
    botao.addEventListener('click', () => _dashSelecionarAbaAdmin(botao.dataset.dashTab || 'geral'));
  });
}

function _dashSelecionarAbaAdmin(aba) {
  const ehAdmin = Boolean(aba);
  const grid = document.getElementById('dashGrid');
  const mostrar = (id, visivel) => {
    const el = document.getElementById(id);
    if (el) el.style.display = visivel ? '' : 'none';
  };

  if (!ehAdmin) {
    grid?.classList.remove('dash-grid-single');
    mostrar('dashKpis', true);
    mostrar('dashMinhaArea', false);
    mostrar('dashHojePanel', true);
    mostrar('dashEquipePanel', false);
    mostrar('dashHistoricoPanel', true);
    return;
  }

  document.querySelectorAll('.dash-admin-tab').forEach(botao => {
    botao.classList.toggle('active', botao.dataset.dashTab === aba);
  });

  const abaGeral = aba === 'geral';
  const abaMinha = aba === 'minha';
  const abaEquipe = aba === 'equipe';

  grid?.classList.toggle('dash-grid-single', abaEquipe);
  mostrar('dashKpis', abaGeral || abaEquipe);
  mostrar('dashMinhaArea', abaMinha);
  mostrar('dashHojePanel', abaGeral);
  mostrar('dashEquipePanel', abaEquipe);
  mostrar('dashHistoricoPanel', abaGeral);
}

async function _dashCarregarFuncionario(usuario) {
  const periodo = _dashPeriodoAtual();
  const lancamentos = await _dashBuscarPonto(usuario.id, periodo.mes, periodo.ano);
  const linhas = _dashMontarLinhas(lancamentos, usuario, periodo);
  const resumo = _dashResumo(linhas);
  const hoje = linhas.find(linha => linha.dia === periodo.hoje);

  _dashRenderKpisFuncionario(resumo);
  _dashRenderHojeFuncionario(hoje);
  _dashRenderHistoricoFuncionario(linhas);

  const banco = await _dashBuscarBanco();
  if (banco) _dashSetSaldo('dashKpiBanco', Number(banco.saldoTotal || 0));

  _dashSetStatus('Dados atualizados');
}

async function _dashCarregarAdmin(usuarioLogado) {
  const periodo = _dashPeriodoAtual();
  const funcionarios = await _dashBuscarFuncionarios();
  const ativos = funcionarios.filter(f =>
    Number(f.ativo) !== 0 &&
    f.status_conta !== 'inativo' &&
    !f.isento_ponto
  );

  const resultados = await Promise.all(ativos.map(async (func, index) => {
    const lancamentos = await _dashBuscarPonto(func.id_usuario, periodo.mes, periodo.ano).catch(() => []);
    const linhas = _dashMontarLinhas(lancamentos, {
      id: func.id_usuario,
      nome: func.nome,
      cargo: func.cargo,
      escala: func.escala,
    }, periodo);

    return {
      ...func,
      cor: DASH_CORES[index % DASH_CORES.length],
      linhas,
      resumo: _dashResumo(linhas),
      hoje: linhas.find(linha => linha.dia === periodo.hoje),
    };
  }));

  let resultadoPessoal = resultados.find(item => String(item.id_usuario) === String(usuarioLogado.id));

  if (!resultadoPessoal) {
    const lancamentos = await _dashBuscarPonto(usuarioLogado.id, periodo.mes, periodo.ano).catch(() => []);
    const linhas = _dashMontarLinhas(lancamentos, usuarioLogado, periodo);
    resultadoPessoal = {
      id_usuario: usuarioLogado.id,
      nome: usuarioLogado.nome,
      matricula: usuarioLogado.matricula || '',
      cargo: usuarioLogado.cargo || '',
      nome_setor: usuarioLogado.nome_setor || '',
      cor: DASH_CORES[0],
      linhas,
      resumo: _dashResumo(linhas),
      hoje: linhas.find(linha => linha.dia === periodo.hoje),
    };
  }

  const saldosTotais = await _dashBuscarSaldosAcumulados();

  _dashRenderKpisAdmin(resultados);
  _dashRenderHojeAdmin(resultados);
  _dashRenderAreaPessoal(resultadoPessoal);
  _dashRenderEquipe(resultados, saldosTotais);
  _dashRenderHistoricoAdmin(resultados);

  // Banco de horas: o KPI vira "Banco da equipe" (soma dos ativos) e a
  // área pessoal mostra o Saldo Total do próprio administrador.
  const bancoEquipe = resultados.reduce(
    (acc, item) => acc + Number(saldosTotais[item.id_usuario] || 0), 0
  );
  const labelBanco = document.getElementById('dashKpiBancoLabel');
  if (labelBanco) labelBanco.textContent = 'Banco da equipe';
  _dashSetSaldo('dashKpiBanco', bancoEquipe);
  _dashSetSaldo('dashMeuBanco', Number(saldosTotais[usuarioLogado.id] || 0));

  _dashSetStatus('Dados atualizados');
}

async function _dashBuscarFuncionarios() {
  const resposta = await fetch('/api/usuarios', { headers: _dashAuthHeaders() });
  if (!resposta.ok) {
    const json = await resposta.json().catch(() => ({}));
    throw new Error(json.message || json.erro || 'Erro ao carregar funcionários.');
  }
  return resposta.json();
}

async function _dashBuscarPonto(idUsuario, mes, ano) {
  const resposta = await fetch(`/api/ponto/${idUsuario}/${mes}/${ano}`, {
    headers: _dashAuthHeaders(),
  });

  if (!resposta.ok) {
    const json = await resposta.json().catch(() => ({}));
    throw new Error(json.message || json.erro || 'Erro ao carregar ponto.');
  }

  return resposta.json();
}

function _dashMontarLinhas(lancamentos, usuario, periodo) {
  const linhas = [];
  const escala = usuario?.escala || null;

  for (let dia = 1; dia <= periodo.totalDias; dia++) {
    const data = new Date(periodo.ano, periodo.mes - 1, dia);
    const diaSemana = data.getDay();
    const ehDomingo = diaSemana === 0;
    const ehSabado = diaSemana === 6;
    const ehFimSemana = ehDomingo || ehSabado;
    const lanc = (lancamentos || []).find(item => Number(item.dia) === dia) || {};

    const meta = lanc.meta || CronaCalc.metaParaData(data, escala, _dashFeriados);

    let ent1 = lanc.ent1 || '';
    let sai1 = lanc.sai1 || '';
    let ent2 = lanc.ent2 || '';
    let sai2 = lanc.sai2 || '';
    const ocorrenciaSalva = _dashNormalizarOcorrencia(lanc.ocorrencia);
    const ocorrencia = ocorrenciaSalva || (ehFimSemana ? 'Fim de semana' : 'Normal');
    const ocorrenciaCalculo = ocorrencia === 'Fim de semana' ? 'Normal' : ocorrencia;
    const ehAbonada = DASH_ABONADAS.has(ocorrenciaCalculo);
    const zeraHorarios = ehAbonada || DASH_FALTA.has(ocorrenciaCalculo);
    if (zeraHorarios) {
      ent1 = '';
      sai1 = '';
      ent2 = '';
      sai2 = '';
    }
    const total1 = _dashIntervaloMin(ent1, sai1);
    const total2 = _dashIntervaloMin(ent2, sai2);
    const totalMin = total1 + total2;
    const metaMin = _dashHoraParaMin(meta);
    const temRegistro = Boolean(ent1 || sai1 || ent2 || sai2 || (ocorrenciaSalva && ocorrenciaCalculo !== 'Normal'));

    let saldoMin;
    if (ehAbonada) {
      saldoMin = 0;
    } else if (DASH_FALTA.has(ocorrenciaCalculo)) {
      saldoMin = -metaMin;
    } else if (ocorrenciaCalculo === 'Feriado' || ocorrenciaCalculo === 'Folga') {
      saldoMin = totalMin;   // feriado/folga: meta 0, só o trabalhado (extra)
    } else if (ehFimSemana && metaMin === 0) {
      saldoMin = totalMin;
    } else if (ehFimSemana && metaMin > 0) {
      saldoMin = totalMin - metaMin;
    } else {
      saldoMin = totalMin - metaMin;
    }

    linhas.push({
      dia,
      nomeDia: DASH_DIAS_SEMANA[diaSemana],
      ehDomingo,
      ehSabado,
      ehFimSemana,
      meta,
      ent1,
      sai1,
      total1,
      ent2,
      sai2,
      total2,
      totalMin,
      saldoMin,
      ocorrencia,
      ocorrenciaCalculo,
      ehAbonada,
      temRegistro,
    });
  }

  return linhas;
}

function _dashResumo(linhas) {
  return linhas.reduce((acc, linha) => {
    acc.totalMin += linha.totalMin;
    acc.saldoMin += linha.saldoMin;
    if (linha.temRegistro) acc.diasRegistro++;
    if (linha.ehAbonada) acc.abonos++;
    if (DASH_FALTA.has(linha.ocorrenciaCalculo)) acc.faltas++;
    if (linha.saldoMin < 0 && !linha.ehFimSemana && !linha.ehAbonada) acc.diasNegativos++;
    return acc;
  }, {
    totalMin: 0,
    saldoMin: 0,
    diasRegistro: 0,
    abonos: 0,
    faltas: 0,
    diasNegativos: 0,
  });
}

function _dashRenderKpisFuncionario(resumo) {
  _dashSetText('dashKpiTotal', _dashMinParaHora(resumo.totalMin));
  _dashSetSaldo('dashKpiSaldo', resumo.saldoMin);
  _dashSetText('dashKpiRegistros', resumo.diasRegistro);
  _dashSetText('dashKpiAlertas', resumo.faltas);
}

function _dashRenderKpisAdmin(resultados) {
  const totalMin = resultados.reduce((acc, item) => acc + item.resumo.totalMin, 0);
  const saldoMin = resultados.reduce((acc, item) => acc + item.resumo.saldoMin, 0);
  const comLancamento = resultados.filter(item => item.resumo.diasRegistro > 0).length;
  const saldoNegativo = resultados.filter(item => item.resumo.saldoMin < 0).length;

  _dashSetText('dashKpiTotal', _dashMinParaHora(totalMin));
  _dashSetSaldo('dashKpiSaldo', saldoMin);
  _dashSetText('dashKpiRegistros', `${comLancamento}/${resultados.length}`);
  _dashSetText('dashKpiAlertas', saldoNegativo);
}

function _dashRenderHojeFuncionario(hoje) {
  const badge = document.getElementById('dashHojeBadge');
  const sub = document.getElementById('dashHojeSub');

  _dashSetText('dashHojeTitulo', 'Hoje');
  if (sub && hoje) sub.textContent = `${String(hoje.dia).padStart(2, '0')} ${hoje.nomeDia}`;

  if (badge && hoje) {
    badge.textContent = _dashStatusHoje(hoje);
    badge.className = `dash-badge ${_dashClasseSaldo(hoje.saldoMin)}`;
  }

  const horas = document.getElementById('dashHojeHoras');
  if (!horas || !hoje) return;

  horas.innerHTML = [
    _dashHoraBox('Meta', hoje.meta),
    _dashHoraBox('Ocorrência', hoje.ocorrencia),
    _dashHoraBox('Entrada 1', hoje.ent1 || '--:--'),
    _dashHoraBox('Saída 1', hoje.sai1 || '--:--'),
    _dashHoraBox('Entrada 2', hoje.ent2 || '--:--'),
    _dashHoraBox('Saída 2', hoje.sai2 || '--:--'),
    _dashHoraBox('Total', _dashMinParaHora(hoje.totalMin), 'total'),
    _dashHoraBox('Saldo', _dashSaldoTexto(hoje.saldoMin), `saldo ${_dashClasseSaldo(hoje.saldoMin)}`),
  ].join('');
}

function _dashRenderAreaPessoal(resultado) {
  if (!resultado) {
    const horas = document.getElementById('dashMeuHojeHoras');
    const historico = document.getElementById('dashMeuHistoricoLista');
    if (horas) horas.innerHTML = _dashEmpty('Não foi possível carregar seus dados.');
    if (historico) historico.innerHTML = _dashEmpty('Não foi possível carregar seus registros.');
    return;
  }

  const resumo = resultado.resumo;
  const lista = resultado.linhas
    .filter(linha => linha.temRegistro)
    .slice(-7)
    .reverse();

  _dashSetText('dashMeuTotal', _dashMinParaHora(resumo.totalMin));
  _dashSetSaldo('dashMeuSaldo', resumo.saldoMin);
  _dashSetText('dashMeuRegistros', resumo.diasRegistro);
  _dashSetText('dashMeuAlertas', resumo.faltas);
  _dashRenderMeuHoje(resultado.hoje);
  _dashRenderListaDias(lista, 'dashMeuHistoricoLista');
}

function _dashRenderMeuHoje(hoje) {
  const badge = document.getElementById('dashMeuHojeBadge');
  const sub = document.getElementById('dashMeuHojeSub');
  const horas = document.getElementById('dashMeuHojeHoras');

  if (!hoje) {
    if (badge) {
      badge.textContent = 'Sem dados';
      badge.className = 'dash-badge';
    }
    if (sub) sub.textContent = '--';
    if (horas) horas.innerHTML = _dashEmpty('Nenhum dado encontrado para hoje.');
    return;
  }

  if (sub) sub.textContent = `${String(hoje.dia).padStart(2, '0')} ${hoje.nomeDia}`;
  if (badge) {
    badge.textContent = _dashStatusHoje(hoje);
    badge.className = `dash-badge ${_dashClasseSaldo(hoje.saldoMin)}`;
  }
  if (!horas) return;

  horas.innerHTML = [
    _dashHoraBox('Meta', hoje.meta),
    _dashHoraBox('Ocorrência', hoje.ocorrencia),
    _dashHoraBox('Entrada 1', hoje.ent1 || '--:--'),
    _dashHoraBox('Saída 1', hoje.sai1 || '--:--'),
    _dashHoraBox('Entrada 2', hoje.ent2 || '--:--'),
    _dashHoraBox('Saída 2', hoje.sai2 || '--:--'),
    _dashHoraBox('Total', _dashMinParaHora(hoje.totalMin), 'total'),
    _dashHoraBox('Saldo', _dashSaldoTexto(hoje.saldoMin), `saldo ${_dashClasseSaldo(hoje.saldoMin)}`),
  ].join('');
}

function _dashRenderHojeAdmin(resultados) {
  const periodo = _dashPeriodoAtual();
  const hojeLinhas = resultados.map(item => item.hoje).filter(Boolean);
  const comRegistro = hojeLinhas.filter(linha => linha.temRegistro).length;
  const faltas = hojeLinhas.filter(linha => DASH_FALTA.has(linha.ocorrenciaCalculo)).length;
  const totalMin = hojeLinhas.reduce((acc, linha) => acc + linha.totalMin, 0);
  const saldoMin = hojeLinhas.reduce((acc, linha) => acc + linha.saldoMin, 0);

  _dashSetText('dashHojeTitulo', 'Hoje na equipe');
  _dashSetText('dashHojeSub', `${String(periodo.hoje).padStart(2, '0')} ${DASH_MESES[periodo.mes]} ${periodo.ano}`);

  const badge = document.getElementById('dashHojeBadge');
  if (badge) {
    badge.textContent = `${comRegistro}/${resultados.length} com registro`;
    badge.className = 'dash-badge ' + (faltas > 0 ? 'alerta' : '');
  }

  const horas = document.getElementById('dashHojeHoras');
  if (!horas) return;

  horas.innerHTML = [
    _dashHoraBox('Funcionários ativos', resultados.length),
    _dashHoraBox('Com lançamento', comRegistro),
    _dashHoraBox('Total hoje', _dashMinParaHora(totalMin), 'total'),
    _dashHoraBox('Saldo hoje', _dashSaldoTexto(saldoMin), `saldo ${_dashClasseSaldo(saldoMin)}`),
    _dashHoraBox('Faltas hoje', faltas),
    _dashHoraBox('Sem lançamento', Math.max(0, resultados.length - comRegistro)),
  ].join('');
}

function _dashRenderHistoricoFuncionario(linhas) {
  _dashSetText('dashHistoricoTitulo', 'Últimos registros');
  _dashSetText('dashHistoricoSub', 'Dias com lançamento no mês');

  const lista = linhas
    .filter(linha => linha.temRegistro)
    .slice(-7)
    .reverse();

  _dashRenderListaDias(lista, 'dashHistoricoLista');
}

function _dashRenderHistoricoAdmin(resultados) {
  _dashSetText('dashHistoricoTitulo', 'Atenção no mês');
  _dashSetText('dashHistoricoSub', 'Maiores saldos negativos no mês');

  const lista = resultados
    .filter(item => item.resumo.saldoMin < 0)
    .sort((a, b) => a.resumo.saldoMin - b.resumo.saldoMin)
    .slice(0, 6);

  const el = document.getElementById('dashHistoricoLista');
  if (!el) return;

  if (!lista.length) {
    el.innerHTML = _dashEmpty('Nenhum saldo negativo no período.');
    return;
  }

  el.innerHTML = lista.map(item => `
    <div class="dash-team-row">
      <div class="dash-person">
        ${_dashAvatarHtml(item)}
        <div>
          <strong title="${_dashEsc(item.nome)}">${_dashEsc(item.nome)}</strong>
          <span>${_dashEsc(item.matricula || '—')} · ${_dashEsc(item.nome_setor || '—')}</span>
        </div>
      </div>
      ${_dashMetric('Total', _dashMinParaHora(item.resumo.totalMin))}
      ${_dashMetric('Saldo', _dashSaldoTexto(item.resumo.saldoMin), _dashClasseSaldo(item.resumo.saldoMin))}
      ${_dashMetric('Faltas', item.resumo.faltas)}
    </div>`).join('');
}

function _dashRenderEquipe(resultados, saldosTotais = {}) {
  const ordenados = [...resultados].sort((a, b) => a.resumo.saldoMin - b.resumo.saldoMin);
  const lista = document.getElementById('dashEquipeLista');

  _dashSetText('dashEquipeBadge', `${resultados.length} ativos`);
  _dashSetText('dashEquipeSub', 'Resumo por colaborador no mês');

  if (!lista) return;
  if (!ordenados.length) {
    lista.innerHTML = _dashEmpty('Nenhum funcionário ativo encontrado.');
    return;
  }

  lista.innerHTML = ordenados.map(item => {
    const totMin = Number(saldosTotais[item.id_usuario] || 0);
    return `
    <div class="dash-team-row dash-team-equipe">
      <div class="dash-person">
        ${_dashAvatarHtml(item)}
        <div>
          <strong title="${_dashEsc(item.nome)}">${_dashEsc(item.nome)}</strong>
          <span>${_dashEsc(item.matricula || '—')} · ${_dashEsc(item.nome_setor || '—')}</span>
        </div>
      </div>
      ${_dashMetric('Total', _dashMinParaHora(item.resumo.totalMin))}
      ${_dashMetric('Saldo Mês', _dashSaldoTexto(item.resumo.saldoMin), _dashClasseSaldo(item.resumo.saldoMin))}
      ${_dashMetric('Saldo Total', _dashSaldoTexto(totMin), _dashClasseSaldo(totMin))}
      ${_dashMetric('Registros', item.resumo.diasRegistro)}
    </div>`;
  }).join('');
}

function _dashRenderListaDias(linhas, targetId) {
  const el = document.getElementById(targetId);
  if (!el) return;

  if (!linhas.length) {
    el.innerHTML = _dashEmpty('Nenhum lançamento encontrado no mês atual.');
    return;
  }

  el.innerHTML = linhas.map(linha => {
    const classes = ['dash-day-row'];
    if (linha.ehSabado) classes.push('sabado');
    if (linha.ehDomingo) classes.push('domingo');

    return `
      <div class="${classes.join(' ')}">
        <div class="dash-day-date">
          <strong>${String(linha.dia).padStart(2, '0')}</strong>
          <span>${linha.nomeDia}</span>
        </div>
        <div class="dash-day-main">
          <strong>${_dashEsc(linha.ocorrencia)}</strong>
          <span>${_dashEsc(_dashStatusHoje(linha))}</span>
        </div>
        ${_dashMetric('Total', _dashMinParaHora(linha.totalMin))}
        ${_dashMetric('Saldo', _dashSaldoTexto(linha.saldoMin), _dashClasseSaldo(linha.saldoMin))}
      </div>`;
  }).join('');
}

function _dashHoraBox(label, valor, classe = '') {
  const saldoClass = classe.includes('saldo') ? classe.replace('saldo', '').trim() : '';
  return `
    <div class="dash-hour-box ${classe}">
      <small>${_dashEsc(label)}</small>
      <strong class="${saldoClass}">${_dashEsc(valor)}</strong>
    </div>`;
}

function _dashMetric(label, valor, classe = '') {
  return `
    <div class="dash-metric">
      <strong class="${classe}">${_dashEsc(valor)}</strong>
      <small>${_dashEsc(label)}</small>
    </div>`;
}

function _dashEmpty(texto) {
  return `
    <div class="dash-empty">
      <i class="fa-regular fa-calendar"></i>
      <span>${_dashEsc(texto)}</span>
    </div>`;
}

function _dashStatusHoje(linha) {
  if (!linha) return 'Sem dados';
  if (linha.ehAbonada) return 'Abonado';
  if (DASH_FALTA.has(linha.ocorrenciaCalculo)) return 'Falta';
  if (linha.temRegistro) {
    if (linha.saldoMin > 0) return 'Saldo positivo';
    if (linha.saldoMin < 0) return 'Saldo negativo';
    return 'Saldo zerado';
  }
  if (linha.ehFimSemana) return 'Fim de semana';
  return 'Sem lançamento';
}

function _dashRenderErro(mensagem) {
  _dashSetStatus('Erro ao carregar');
  const historico = document.getElementById('dashHistoricoLista');
  const horas = document.getElementById('dashHojeHoras');
  const equipe = document.getElementById('dashEquipeLista');
  if (historico) historico.innerHTML = _dashEmpty(mensagem);
  if (horas) horas.innerHTML = _dashEmpty(mensagem);
  if (equipe) equipe.innerHTML = _dashEmpty(mensagem);
}

/* Funcionário comum isento de ponto: não tem dados de ponto a mostrar. */
function _dashRenderFuncionarioIsento() {
  _dashSetStatus('Isento de ponto');
  const acao = document.getElementById('dashAcaoPrincipal');
  if (acao) acao.style.display = 'none';
  const msg = 'Você não participa do controle de ponto.';
  const historico = document.getElementById('dashHistoricoLista');
  const horas = document.getElementById('dashHojeHoras');
  if (historico) historico.innerHTML = _dashEmpty(msg);
  if (horas) horas.innerHTML = _dashEmpty(msg);
  ['dashKpiTotal', 'dashKpiSaldo', 'dashKpiBanco', 'dashKpiRegistro', 'dashKpiAlerta'].forEach(id => {
    const el = document.getElementById(id);
    if (el) { el.textContent = '—'; el.className = (el.className || '').replace(/\b(positivo|negativo|neutro)\b/g, '').trim(); }
  });
}

function _dashPeriodoAtual() {
  const agora = new Date();
  const mes = agora.getMonth() + 1;
  const ano = agora.getFullYear();
  const totalDias = new Date(ano, mes, 0).getDate();
  const hoje = agora.getDate();

  return {
    mes,
    ano,
    hoje,
    totalDias,
  };
}

function _dashHoraParaMin(hhmm) {
  if (!hhmm || !String(hhmm).includes(':')) return 0;
  const [h, m] = String(hhmm).split(':').map(Number);
  return (Number.isNaN(h) || Number.isNaN(m)) ? 0 : h * 60 + m;
}

function _dashMinParaHora(min) {
  const total = Math.max(0, Math.round(min || 0));
  return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`;
}

function _dashIntervaloMin(entrada, saida) {
  if (!entrada || !saida || !String(entrada).includes(':') || !String(saida).includes(':')) return 0;
  const ent = _dashHoraParaMin(entrada);
  const sai = _dashHoraParaMin(saida);
  const diff = sai >= ent ? sai - ent : (1440 - ent) + sai;
  return diff > 0 ? diff : 0;
}

function _dashSaldoTexto(min) {
  return `${min >= 0 ? '+' : '-'}${_dashMinParaHora(Math.abs(min))}`;
}

function _dashClasseSaldo(min) {
  if (min > 0) return 'positivo';
  if (min < 0) return 'negativo';
  return 'neutro';
}

function _dashSetSaldo(id, min) {
  const el = document.getElementById(id);
  if (!el) return;
  el.textContent = _dashSaldoTexto(min);
  el.className = `dash-saldo ${_dashClasseSaldo(min)}`;
}

function _dashSetText(id, texto) {
  const el = document.getElementById(id);
  if (el) el.textContent = texto;
}

function _dashSetStatus(texto) {
  _dashSetText('dashStatus', texto);
}

function _dashAvatarHtml(item) {
  if (item.foto_perfil) {
    return `<div class="dash-avatar" style="overflow:hidden;"><img src="${item.foto_perfil}" alt="" style="width:100%;height:100%;object-fit:cover;border-radius:50%;display:block;"></div>`;
  }
  return `<div class="dash-avatar" style="background:${item.cor}">${_dashIniciais(item.nome)}</div>`;
}

function _dashIniciais(nome) {
  return String(nome || '')
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map(parte => parte[0].toUpperCase())
    .join('') || '--';
}

async function _dashCarregarFeriados(ano) {
  try {
    const res = await fetch(`/api/feriados/${ano}`, { headers: _dashAuthHeaders() });
    if (res.ok) return new Set((await res.json()).map(f => f.data));
  } catch { /* sem feriados */ }
  return new Set();
}

function _dashUsuarioAtual() {
  return typeof window.cronaUsuarioAtual === 'function' ? window.cronaUsuarioAtual() : null;
}

function _dashEhAdmin() {
  return typeof window.cronaUsuarioEhAdmin === 'function' ? window.cronaUsuarioEhAdmin() : false;
}

function _dashAuthHeaders() {
  return typeof window.cronaAuthHeaders === 'function' ? window.cronaAuthHeaders() : {};
}

/* Banco de horas do próprio usuário: { saldoMesAtual, saldoTotal, meses } */
async function _dashBuscarBanco() {
  try {
    const res = await fetch('/api/banco-horas', { headers: _dashAuthHeaders() });
    if (res.ok) return await res.json();
  } catch { /* sem banco */ }
  return null;
}

/* (RH) Saldo Total acumulado de cada funcionário: { idUsuario: saldoMin } */
async function _dashBuscarSaldosAcumulados() {
  try {
    const res = await fetch('/api/saldos-acumulados', { headers: _dashAuthHeaders() });
    if (res.ok) return await res.json();
  } catch { /* sem saldos */ }
  return {};
}

function _dashEsc(valor) {
  return String(valor ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function _dashNormalizarOcorrencia(ocorrencia) {
  const valor = String(ocorrencia || '').trim();
  if (!valor) return '';
  if (valor === 'Trabalho Normal') return 'Normal';
  if (valor === 'Faltou' || valor === 'Falta Não Justificada' || valor === 'Falta Nao Justificada' || valor === 'Falta Injustificada') return 'Falta Injustificada';
  if (valor === 'Licenca Nojo/Luto') return 'Licença Nojo/Luto';
  return valor;
}