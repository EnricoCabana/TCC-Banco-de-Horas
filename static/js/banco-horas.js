/* ============================================================
   BANCO DE HORAS  (tela pessoal — RH e funcionário comum)
   - Saldo Mensal Atual  = saldo só do mês corrente
   - Saldo Total Acumulado = soma de TODOS os meses até agora
   - Histórico = lista rolável com o relatório de cada mês
   Chamado pelo main.js: iniciarModuloBancoHoras()
============================================================ */

const BH_MESES = ['', 'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
                  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];

async function iniciarModuloBancoHoras() {
  const lista = document.getElementById('bhLista');
  if (lista) {
    lista.innerHTML =
      '<div class="bh-vazio"><i class="fa-solid fa-hourglass-half"></i><p>Carregando seu banco de horas...</p></div>';
  }

  const _u = (typeof window.cronaUsuarioAtual === 'function') ? window.cronaUsuarioAtual() : null;
  if (_u && _u.isento_ponto) { _bhRenderIsento(); return; }

  try {
    const resposta = await fetch('/api/banco-horas', { headers: window.cronaAuthHeaders() });
    if (!resposta.ok) {
      const j = await resposta.json().catch(() => ({}));
      throw new Error(j.message || 'Erro ao carregar o banco de horas.');
    }

    const dados = await resposta.json();
    _bhRenderTopo(dados);
    _bhRenderHistorico(Array.isArray(dados.meses) ? dados.meses : []);
  } catch (erro) {
    if (lista) {
      lista.innerHTML = `
        <div class="bh-vazio">
          <i class="fa-solid fa-triangle-exclamation"></i>
          <p>${erro.message || 'Erro ao carregar o banco de horas.'}</p>
        </div>`;
    }
  }
}

/* ---- topo: os dois saldos ---- */
function _bhRenderTopo(dados) {
  const saldoMes   = Number(dados.saldoMesAtual || 0);
  const saldoTotal = Number(dados.saldoTotal || 0);

  const elMes = document.getElementById('bhSaldoMes');
  if (elMes) {
    elMes.textContent = _bhSaldoTexto(saldoMes);
    elMes.className   = 'bh-saldo-valor ' + _bhClasse(saldoMes);
  }

  const elTotal = document.getElementById('bhSaldoTotal');
  if (elTotal) {
    elTotal.textContent = _bhSaldoTexto(saldoTotal);
    elTotal.className   = 'bh-saldo-valor ' + _bhClasse(saldoTotal);
  }

  const cap = document.getElementById('bhSaldoMesCap');
  if (cap && dados.mesAtual) {
    cap.textContent = `${BH_MESES[dados.mesAtual]} de ${dados.anoAtual}`;
  }
}

/* ---- histórico: um card por mês ---- */
function _bhRenderHistorico(meses) {
  const lista = document.getElementById('bhLista');
  const count = document.getElementById('bhHistCount');
  if (!lista) return;

  if (count) {
    count.textContent = `${meses.length} ${meses.length === 1 ? 'mês' : 'meses'}`;
  }

  if (meses.length === 0) {
    lista.innerHTML = `
      <div class="bh-vazio">
        <i class="fa-solid fa-folder-open"></i>
        <p>Você ainda não tem meses com lançamentos.</p>
      </div>`;
    return;
  }

  lista.innerHTML = meses.map(m => {
    const classe  = _bhClasse(m.saldoMin);
    const nomeMes = BH_MESES[m.mes] || `Mês ${m.mes}`;
    return `
      <div class="bh-mes-card bh-mes-clicavel ${classe}" onclick="_bhAbrirMes(${m.ano}, ${m.mes})" title="Ver relatório do mês">
        <div class="bh-mes-icon"><i class="fa-solid fa-calendar-days"></i></div>
        <div style="min-width:0;">
          <div class="bh-mes-nome">${nomeMes}</div>
          <div class="bh-mes-sub">${m.ano} · ${m.dias} ${m.dias === 1 ? 'dia' : 'dias'}</div>
        </div>
        <div class="bh-mes-metricas">
          <div>
            <div class="bh-mes-metrica-label">Total Trabalhado</div>
            <div class="bh-mes-metrica-valor">${_bhMinParaHora(m.totalMin)}</div>
          </div>
          <div>
            <div class="bh-mes-metrica-label">Saldo do Mês</div>
            <div class="bh-mes-metrica-valor ${classe}">${_bhSaldoTexto(m.saldoMin)}</div>
          </div>
        </div>
        <i class="fa-solid fa-chevron-right bh-mes-seta"></i>
      </div>`;
  }).join('');
}

/* ---- helpers ---- */
function _bhMinParaHora(min) {
  min = Math.abs(Number(min) || 0);
  return `${String(Math.floor(min / 60)).padStart(2, '0')}:${String(min % 60).padStart(2, '0')}`;
}
function _bhSaldoTexto(min) {
  min = Number(min) || 0;
  return `${min >= 0 ? '+' : '-'}${_bhMinParaHora(min)}`;
}
function _bhClasse(min) {
  min = Number(min) || 0;
  return min > 0 ? 'positivo' : min < 0 ? 'negativo' : 'neutro';
}

/* ============================================================
   MODAL — relatório de um mês (dia a dia), aberto ao clicar no card
============================================================ */
async function _bhAbrirMes(ano, mes) {
  const modal = document.getElementById('bhModal');
  const corpo = document.getElementById('bhModalCorpo');
  if (!modal) return;

  modal.hidden = false;
  document.body.style.overflow = 'hidden';
  if (corpo) corpo.innerHTML = '<tr><td colspan="11" class="bh-tab-msg">Carregando...</td></tr>';

  const u = (typeof window.cronaUsuarioAtual === 'function') ? window.cronaUsuarioAtual() : null;
  const tituloEl = document.getElementById('bhModalTitulo');
  const subEl = document.getElementById('bhModalSub');
  if (tituloEl) tituloEl.textContent = (u && u.nome) ? u.nome : 'Relatório do mês';
  if (subEl) {
    const partes = [];
    if (u && u.matricula) partes.push(u.matricula);
    if (u && u.cargo) partes.push(u.cargo);
    partes.push(`${BH_MESES[mes]} de ${ano}`);
    subEl.textContent = partes.join(' · ');
  }

  try {
    const resp = await fetch(`/api/banco-horas/${ano}/${mes}`, { headers: window.cronaAuthHeaders() });
    if (!resp.ok) {
      const j = await resp.json().catch(() => ({}));
      throw new Error(j.message || 'Erro ao carregar o mês.');
    }
    _bhRenderModal(await resp.json());
  } catch (erro) {
    if (corpo) corpo.innerHTML = `<tr><td colspan="11" class="bh-tab-msg erro">${erro.message || 'Erro ao carregar.'}</td></tr>`;
  }
}

function _bhFecharMes() {
  const modal = document.getElementById('bhModal');
  if (modal) modal.hidden = true;
  document.body.style.overflow = '';
}

function _bhModalCliqueFora(ev) {
  if (ev && ev.target && ev.target.id === 'bhModal') _bhFecharMes();
}

function _bhRenderModal(dados) {
  const r = dados.resumo || {};
  const elTot = document.getElementById('bhModalTotal');
  const elSal = document.getElementById('bhModalSaldo');
  const elDias = document.getElementById('bhModalDias');
  if (elTot) elTot.textContent = _bhMinParaHora(r.totalMin);
  if (elSal) {
    elSal.textContent = _bhSaldoTexto(r.saldoMin);
    elSal.className = 'bh-modal-kpi-valor ' + _bhClasse(r.saldoMin);
  }
  if (elDias) elDias.textContent = r.dias || 0;

  const corpo = document.getElementById('bhModalCorpo');
  if (!corpo) return;

  const porDia = {};
  (dados.dias || []).forEach(d => { porDia[d.dia] = d; });

  const totalDias = new Date(dados.ano, dados.mes, 0).getDate();
  const semana = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
  let html = '';

  for (let dia = 1; dia <= totalDias; dia++) {
    const d = porDia[dia];
    const data = new Date(dados.ano, dados.mes - 1, dia);
    const diaSem = data.getDay();
    const fds = (diaSem === 0 || diaSem === 6);
    const saldoMin = d ? Number(d.saldoMin) : 0;
    const saldoCls = saldoMin > 0 ? 'positivo' : saldoMin < 0 ? 'negativo' : 'neutro';

    html += `
      <tr class="${fds ? 'bh-tr-fds' : ''}">
        <td class="bh-td-dia"><strong>${String(dia).padStart(2, '0')}</strong> <span>${semana[diaSem]}</span></td>
        <td>${d ? _bhMinParaHora(d.metaMin) : '00:00'}</td>
        <td>${d && d.ent1 ? d.ent1 : '—'}</td>
        <td>${d && d.sai1 ? d.sai1 : '—'}</td>
        <td class="bh-td-azul">${_bhMinParaHora(_bhDiff(d && d.ent1, d && d.sai1))}</td>
        <td>${d && d.ent2 ? d.ent2 : '—'}</td>
        <td>${d && d.sai2 ? d.sai2 : '—'}</td>
        <td class="bh-td-azul">${_bhMinParaHora(_bhDiff(d && d.ent2, d && d.sai2))}</td>
        <td class="bh-td-azul">${_bhMinParaHora(d ? d.totalMin : 0)}</td>
        <td class="bh-td-saldo ${saldoCls}">${_bhSaldoTexto(saldoMin)}</td>
        <td>${d ? (d.ocorrencia || 'Normal') : 'Normal'}</td>
      </tr>`;
  }
  corpo.innerHTML = html;
}

function _bhDiff(ini, fim) {
  if (!ini || !fim) return 0;
  const [h1, m1] = String(ini).split(':').map(Number);
  const [h2, m2] = String(fim).split(':').map(Number);
  let d = (h2 * 60 + m2) - (h1 * 60 + m1);
  if (!Number.isFinite(d) || d < 0) d = 0;
  return d;
}

/* Quem é isento de ponto não tem banco de horas — mostra um aviso amigável. */
function _bhRenderIsento() {
  const mes = document.getElementById('bhSaldoMes');
  const total = document.getElementById('bhSaldoTotal');
  const cap = document.getElementById('bhSaldoMesCap');
  if (mes) { mes.textContent = '\u2014'; mes.className = 'bh-saldo-valor neutro'; }
  if (total) { total.textContent = '\u2014'; total.className = 'bh-saldo-valor neutro'; }
  if (cap) cap.textContent = 'Isento de ponto';
  const count = document.getElementById('bhHistCount');
  if (count) count.textContent = '';
  const lista = document.getElementById('bhLista');
  if (lista) {
    lista.innerHTML =
      '<div class="bh-vazio"><i class="fa-solid fa-mug-hot"></i><p>Você não participa do controle de ponto, então não há banco de horas a exibir.</p></div>';
  }
}