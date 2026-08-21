/**
 * CronaSys — js/main.js
 * ---------------------------------------------------
 * Controla a navegação SPA.
 *
 * Como funciona:
 *   1. navegar(pagina) faz fetch de /paginas/{pagina}.html
 *   2. Injeta o HTML no <main id="content">
 *   3. Chama a função de inicialização do módulo (INIT_MAP)
 *
 * Por que não usar <script src> dentro dos fragmentos HTML?
 *   Porque o browser não re-executa scripts externos já
 *   carregados quando reinseridos via innerHTML.
 *   Solução: todos os JS são carregados no index.html e
 *   o main.js chama explicitamente o init de cada página.
 */

/* ── Títulos das páginas ─────────────────────────────── */
const TITULOS = {
  'dashboard':    'Dashboard',
  'banco-horas':  'Banco de Horas',
  'funcionarios': 'Funcionários',
  'avisos':       'Avisos',
  'gestao':       'Gestão de Ponto',
  'relatorio':    'Relatórios Mensais',
  'feriados':     'Feriados',
  'setores':      'Setores',
  'fechamento':   'Fechamento de Folha',
  'auditoria':    'Auditoria',
  'perfil':       'Meu Perfil',
  'config-email': 'Configuração de E-mail',
  'envio-fichas': 'Enviar Fichas por E-mail',
  'backup':       'Backup',
};

/* Ícone de cada página (mesmo do menu) — mostrado no topo ao lado do nome. */
const ICONES = {
  'dashboard':    'fa-solid fa-chart-line',
  'banco-horas':  'fa-solid fa-piggy-bank',
  'funcionarios': 'fa-solid fa-users',
  'avisos':       'fa-solid fa-bell',
  'gestao':       'fa-solid fa-table-list',
  'relatorio':    'fa-solid fa-chart-pie',
  'feriados':     'fa-solid fa-calendar-day',
  'setores':      'fa-solid fa-sitemap',
  'fechamento':   'fa-solid fa-file-excel',
  'auditoria':    'fa-solid fa-clipboard-list',
  'perfil':       'fa-solid fa-circle-user',
  'config-email': 'fa-solid fa-gear',
  'envio-fichas': 'fa-solid fa-paper-plane',
  'backup':       'fa-solid fa-database',
};

/* ── Mapa de inicialização dos módulos ───────────────────
   Cada entrada aponta para a função de init do módulo JS.
   Quando criar um novo módulo (ex: setores.js),
   adicione aqui: 'setores': iniciarModuloSetores
─────────────────────────────────────────────────────── */
const INIT_MAP = {
  'dashboard':    () => iniciarModuloDashboard(),
  'funcionarios': () => iniciarModuloFuncionarios(),
  'gestao':       () => iniciarModuloGestao(),
  'banco-horas':  () => iniciarModuloBancoHoras(),
  'avisos':       () => iniciarModuloAvisos(),
  'relatorio':    () => iniciarModuloRelatorio(),
  'feriados':     () => iniciarModuloFeriados(),
  'setores':      () => iniciarModuloSetores(),
  'fechamento':   () => iniciarModuloFechamento(),
  'auditoria':    () => iniciarModuloAuditoria(),
  'perfil':       () => iniciarModuloPerfil(),
  'config-email': () => iniciarModuloConfigEmail(),
  'envio-fichas': () => iniciarModuloEnvioFichas(),
  'backup':       () => iniciarModuloBackup(),
};

const contentEl = document.getElementById('content');
const AUTH_STORAGE_KEY = 'cronaUsuario';
const TOKEN_STORAGE_KEY = 'cronaToken';
let usuarioLogado = null;

function obterUsuarioLogado() {
  try {
    const raw = localStorage.getItem(AUTH_STORAGE_KEY);
    if (!raw) return null;
    if (!localStorage.getItem(TOKEN_STORAGE_KEY)) return null;

    const usuario = JSON.parse(raw);
    if (!usuario?.id || !usuario?.nome) return null;
    return usuario;
  } catch {
    localStorage.removeItem(AUTH_STORAGE_KEY);
    return null;
  }
}

function usuarioEhAdmin(usuario = usuarioLogado) {
  const tipo = String(usuario?.tipo || usuario?.tipo_acesso || '').toUpperCase();
  const cargo = String(usuario?.cargo || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase();

  return usuario?.administrador === true || tipo === 'ADM' || cargo.includes('ADMINISTRADOR');
}

function usuarioEhIsento(usuario = usuarioLogado) {
  return !!(usuario && usuario.isento_ponto);
}

function authHeaders() {
  const token = localStorage.getItem(TOKEN_STORAGE_KEY);
  return token ? { 'Authorization': 'Bearer ' + token } : {};
}

function usuarioAtual() {
  return usuarioLogado;
}

/* ============================================================
   Modais de confirmação reutilizáveis
   - cronaConfirm(opts)      → Promise<boolean>  (confirmação simples)
   - cronaConfirmSenha(opts) → Promise<string|null>  (pede e valida a senha
     do usuário logado no backend; devolve a senha se confere, ou null)
   ============================================================ */
function _cconfEscape(txt) {
  return String(txt == null ? '' : txt).replace(/[&<>"]/g, (c) => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]
  ));
}

function cronaConfirm(opts = {}) {
  const {
    titulo = 'Confirmar', mensagem = '', textoOk = 'Confirmar',
    textoCancelar = 'Cancelar', perigo = false,
  } = opts;
  return new Promise((resolve) => {
    const ov = document.createElement('div');
    ov.className = 'cconf-overlay';
    ov.innerHTML = `
      <div class="cconf-box" role="dialog" aria-modal="true" aria-label="${_cconfEscape(titulo)}">
        <h3 class="cconf-title">${_cconfEscape(titulo)}</h3>
        <p class="cconf-msg">${_cconfEscape(mensagem)}</p>
        <div class="cconf-acoes">
          <button type="button" class="cconf-btn cconf-cancelar">${_cconfEscape(textoCancelar)}</button>
          <button type="button" class="cconf-btn cconf-ok${perigo ? ' cconf-perigo' : ''}">${_cconfEscape(textoOk)}</button>
        </div>
      </div>`;
    document.body.appendChild(ov);
    const fechar = (v) => { ov.remove(); document.removeEventListener('keydown', onKey); resolve(v); };
    const onKey = (e) => { if (e.key === 'Escape') fechar(false); };
    ov.querySelector('.cconf-cancelar').addEventListener('click', () => fechar(false));
    ov.querySelector('.cconf-ok').addEventListener('click', () => fechar(true));
    ov.addEventListener('mousedown', (e) => { if (e.target === ov) fechar(false); });
    document.addEventListener('keydown', onKey);
    setTimeout(() => ov.querySelector('.cconf-ok')?.focus(), 30);
  });
}

function cronaConfirmSenha(opts = {}) {
  const {
    titulo = 'Confirmação de segurança',
    mensagem = 'Digite sua senha para confirmar esta ação.',
    textoOk = 'Confirmar',
  } = opts;
  return new Promise((resolve) => {
    const ov = document.createElement('div');
    ov.className = 'cconf-overlay';
    ov.innerHTML = `
      <div class="cconf-box" role="dialog" aria-modal="true" aria-label="${_cconfEscape(titulo)}">
        <h3 class="cconf-title"><i class="fa-solid fa-lock"></i> ${_cconfEscape(titulo)}</h3>
        <p class="cconf-msg">${_cconfEscape(mensagem)}</p>
        <input type="password" class="cconf-senha" placeholder="Sua senha" autocomplete="current-password" />
        <p class="cconf-erro" hidden></p>
        <div class="cconf-acoes">
          <button type="button" class="cconf-btn cconf-cancelar">Cancelar</button>
          <button type="button" class="cconf-btn cconf-ok cconf-perigo">${_cconfEscape(textoOk)}</button>
        </div>
      </div>`;
    document.body.appendChild(ov);
    const inp = ov.querySelector('.cconf-senha');
    const erro = ov.querySelector('.cconf-erro');
    const btnOk = ov.querySelector('.cconf-ok');
    const fechar = (v) => { ov.remove(); document.removeEventListener('keydown', onKey); resolve(v); };
    const onKey = (e) => { if (e.key === 'Escape') fechar(null); };
    const mostrarErro = (msg) => { erro.textContent = msg; erro.hidden = false; };
    async function confirmar() {
      const senha = inp.value;
      if (!senha) { mostrarErro('Digite sua senha.'); inp.focus(); return; }
      btnOk.disabled = true; erro.hidden = true;
      try {
        const res = await fetch('/api/auth/confirmar-senha', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', ...authHeaders() },
          body: JSON.stringify({ senha }),
        });
        if (res.ok) { fechar(senha); return; }
        mostrarErro(res.status === 401 ? 'Senha incorreta.' : 'Não foi possível validar. Tente de novo.');
        inp.select(); inp.focus();
      } catch (e) {
        mostrarErro('Erro de conexão ao validar a senha.');
      } finally {
        btnOk.disabled = false;
      }
    }
    btnOk.addEventListener('click', confirmar);
    inp.addEventListener('keydown', (e) => { if (e.key === 'Enter') confirmar(); });
    ov.querySelector('.cconf-cancelar').addEventListener('click', () => fechar(null));
    ov.addEventListener('mousedown', (e) => { if (e.target === ov) fechar(null); });
    document.addEventListener('keydown', onKey);
    setTimeout(() => inp.focus(), 30);
  });
}

/* Alerta simples (substituto do alert() nativo). */
function cronaAlert(opts = {}) {
  const { titulo = 'Aviso', mensagem = '', textoOk = 'Entendi' } = opts;
  return new Promise((resolve) => {
    const ov = document.createElement('div');
    ov.className = 'cconf-overlay';
    ov.innerHTML = `
      <div class="cconf-box" role="alertdialog" aria-modal="true" aria-label="${_cconfEscape(titulo)}">
        <h3 class="cconf-title">${_cconfEscape(titulo)}</h3>
        <p class="cconf-msg">${_cconfEscape(mensagem)}</p>
        <div class="cconf-acoes">
          <button type="button" class="cconf-btn cconf-ok">${_cconfEscape(textoOk)}</button>
        </div>
      </div>`;
    document.body.appendChild(ov);
    const fechar = () => { ov.remove(); document.removeEventListener('keydown', onKey); resolve(); };
    const onKey = (e) => { if (e.key === 'Escape' || e.key === 'Enter') fechar(); };
    ov.querySelector('.cconf-ok').addEventListener('click', fechar);
    ov.addEventListener('mousedown', (e) => { if (e.target === ov) fechar(); });
    document.addEventListener('keydown', onKey);
    setTimeout(() => ov.querySelector('.cconf-ok')?.focus(), 30);
  });
}

window.cronaConfirm = cronaConfirm;
window.cronaConfirmSenha = cronaConfirmSenha;
window.cronaAlert = cronaAlert;

function iniciais(nome) {
  return String(nome || '')
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map(p => p[0].toUpperCase())
    .join('') || '--';
}

function _cronaPintarAvatar(el, sigla) {
  if (!el) return;
  const foto = usuarioLogado?.foto_perfil;
  if (foto) {
    el.innerHTML = `<img src="${foto}" alt="" style="width:100%;height:100%;object-fit:cover;border-radius:50%;display:block;">`;
  } else {
    el.textContent = sigla;
  }
}

function aplicarUsuarioLogado() {
  if (!usuarioLogado) return;

  document.body.classList.remove('auth-locked');
  document.getElementById('cronaLogin')?.remove();

  const sigla = iniciais(usuarioLogado.nome);
  const perfil = usuarioEhAdmin() ? 'Administrador' : 'Padrão';

  const profileAvatar = document.getElementById('profileAvatar');
  const topbarAvatar  = document.getElementById('topbarAvatar');
  const profileName   = document.getElementById('profileName');
  const profileRole   = document.getElementById('profileRole');

  _cronaPintarAvatar(profileAvatar, sigla);
  _cronaPintarAvatar(topbarAvatar, sigla);
  if (profileName)   profileName.textContent   = usuarioLogado.nome;
  if (profileRole)   profileRole.textContent   = perfil;

  aplicarPermissoesNavegacao();

  _cronaVerificarAvisos();
  if (!window._cronaAvisosPoll) {
    window._cronaAvisosPoll = setInterval(_cronaVerificarAvisos, 60000);
  }

  const logout = document.getElementById('profileLogout');
  if (logout && !logout.dataset.authBound) {
    logout.addEventListener('click', sair);
    logout.dataset.authBound = 'true';
  }
}

/* Atualiza o usuário logado em memória + localStorage e repinta o avatar.
   Usado pela tela Meu Perfil após salvar. */
function atualizarUsuarioLogado(parcial) {
  if (!usuarioLogado || !parcial) return;
  usuarioLogado = { ...usuarioLogado, ...parcial };
  try { localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(usuarioLogado)); } catch (e) { /* ignore */ }
  aplicarUsuarioLogado();
}

function aplicarPermissoesNavegacao() {
  const admin = usuarioEhAdmin();

  document.querySelectorAll('.nav-item[data-role]').forEach(item => {
    const role = item.dataset.role;
    const visivel = (role === 'admin' && admin) || (role === 'funcionario' && !admin);
    const li = item.closest('li');
    if (li) li.style.display = visivel ? '' : 'none';
  });

  // Isento de ponto: some com as telas pessoais de ponto
  const isento = usuarioEhIsento();
  ['banco-horas'].forEach(pg => {
    const li = document.querySelector(`.nav-item[data-page="${pg}"]`)?.closest('li');
    if (li) li.style.display = isento ? 'none' : '';
  });

  // Esconde a seção inteira quando nenhum item dela está visível
  document.querySelectorAll('.nav-section').forEach(secao => {
    const temVisivel = [...secao.querySelectorAll('li')]
      .some(li => li.style.display !== 'none');
    secao.classList.toggle('oculta', !temVisivel);
  });
}

function paginaPermitida(pagina) {
  if (usuarioEhIsento() && pagina === 'banco-horas') {
    return false;
  }
  if (usuarioEhAdmin()) {
    return ['dashboard', 'banco-horas', 'funcionarios', 'setores', 'gestao', 'feriados', 'fechamento', 'auditoria', 'config-email', 'backup', 'envio-fichas', 'avisos', 'relatorio', 'perfil'].includes(pagina);
  }

  return ['dashboard', 'banco-horas', 'funcionarios', 'feriados', 'avisos', 'perfil'].includes(pagina);
}

function linkPadrao() {
  return document.querySelector('.nav-item[data-page="dashboard"]');
}

function mostrarLogin() {
  usuarioLogado = null;
  document.body.classList.add('auth-locked');
  document.getElementById('cronaLogin')?.remove();

  const login = document.createElement('section');
  login.id = 'cronaLogin';
  login.className = 'login-shell';
  login.innerHTML = `
    <aside class="login-aside">
      <div class="login-aside-top">
        <img src="img/logo-cronasys.png" alt="CronaSys" class="login-logo" />
        <p class="login-aside-lead">CronaSys &eacute; um sistema de controle de ponto e banco de horas, feito para pequenas e m&eacute;dias empresas e com&eacute;rcios. Substitui planilhas e papel por marca&ccedil;&otilde;es, saldos e fechamento organizados em um s&oacute; lugar.</p>

        <div class="login-features">
          <div class="login-feature">
            <i class="fa-solid fa-clock"></i>
            <div>
              <strong>Controle de ponto</strong>
              <span>Marca&ccedil;&otilde;es, ocorr&ecirc;ncias e ajustes num s&oacute; painel</span>
            </div>
          </div>
          <div class="login-feature">
            <i class="fa-solid fa-scale-balanced"></i>
            <div>
              <strong>Banco de horas</strong>
              <span>Saldos e cr&eacute;ditos calculados automaticamente</span>
            </div>
          </div>
          <div class="login-feature">
            <i class="fa-solid fa-file-arrow-down"></i>
            <div>
              <strong>Fechamento e fichas</strong>
              <span>Exporta&ccedil;&atilde;o em Excel e envio por e-mail</span>
            </div>
          </div>
        </div>
      </div>
      <div class="login-aside-foot">
        <p class="login-restrito"><i class="fa-solid fa-lock"></i> Acesso restrito &agrave; IF Inform&aacute;tica</p>
        <p class="login-rodape">Acesso restrito ao sistema</p>
      </div>
    </aside>

    <div class="login-panel">
      <div class="login-box">
        <p class="login-eyebrow">Acesso ao sistema</p>
        <h2 class="login-heading">Bem-vindo de volta</h2>

        <form class="login-form" id="loginForm">
          <div class="login-field">
            <label for="loginEmail">E-mail</label>
            <input type="email" id="loginEmail" autocomplete="username" placeholder="voce@ifinformatica.com" required />
          </div>

          <div class="login-field">
            <label for="loginSenha">Senha</label>
            <input type="password" id="loginSenha" autocomplete="current-password" placeholder="&bull;&bull;&bull;&bull;&bull;&bull;&bull;&bull;" required />
          </div>

          <div class="login-error" id="loginErro">
            <i class="fa-solid fa-circle-exclamation"></i>
            <span></span>
          </div>

          <button class="btn-primary login-submit" id="loginSubmit" type="submit">
            <i class="fa-solid fa-right-to-bracket"></i>
            <span>Entrar</span>
          </button>
        </form>

        <button type="button" id="loginEsqueci" class="login-link">Esqueci minha senha</button>

        <p class="login-security-badge"><i class="fa-solid fa-shield-halved"></i> Senhas protegidas com bcrypt</p>
      </div>
    </div>`;

  document.body.appendChild(login);
  document.getElementById('loginForm')?.addEventListener('submit', realizarLogin);
  document.getElementById('loginEsqueci')?.addEventListener('click', mostrarRecuperacao);
  document.getElementById('loginEmail')?.focus();
}

/* -- Recuperacao de senha ("esqueci minha senha") -- */
let _recEmail = '';

function mostrarRecuperacao() {
  document.body.classList.add('auth-locked');
  document.getElementById('cronaLogin')?.remove();

  const rec = document.createElement('section');
  rec.id = 'cronaLogin';
  rec.className = 'login-shell';
  rec.innerHTML = `
    <aside class="login-aside">
      <div class="login-aside-top">
        <img src="img/logo-cronasys.png" alt="CronaSys" class="login-logo" />
        <p class="login-aside-lead">CronaSys &eacute; um sistema de controle de ponto e banco de horas, feito para pequenas e m&eacute;dias empresas e com&eacute;rcios. Substitui planilhas e papel por marca&ccedil;&otilde;es, saldos e fechamento organizados em um s&oacute; lugar.</p>

        <div class="login-features">
          <div class="login-feature">
            <i class="fa-solid fa-clock"></i>
            <div>
              <strong>Controle de ponto</strong>
              <span>Marca&ccedil;&otilde;es, ocorr&ecirc;ncias e ajustes num s&oacute; painel</span>
            </div>
          </div>
          <div class="login-feature">
            <i class="fa-solid fa-scale-balanced"></i>
            <div>
              <strong>Banco de horas</strong>
              <span>Saldos e cr&eacute;ditos calculados automaticamente</span>
            </div>
          </div>
          <div class="login-feature">
            <i class="fa-solid fa-file-arrow-down"></i>
            <div>
              <strong>Fechamento e fichas</strong>
              <span>Exporta&ccedil;&atilde;o em Excel e envio por e-mail</span>
            </div>
          </div>
        </div>
      </div>
      <div class="login-aside-foot">
        <p class="login-restrito"><i class="fa-solid fa-lock"></i> Acesso restrito &agrave; IF Inform&aacute;tica</p>
        <p class="login-rodape">Acesso restrito ao sistema</p>
      </div>
    </aside>

    <div class="login-panel">
      <div class="login-box">
        <p class="login-eyebrow">Recupera&ccedil;&atilde;o</p>
        <h2 class="login-heading">Redefinir senha</h2>

        <div id="recStep1">
          <p class="login-hint">Digite seu e-mail. Se estiver cadastrado, enviaremos um c&oacute;digo para redefinir a senha.</p>
          <div class="login-field">
            <label for="recEmail">E-mail</label>
            <input type="email" id="recEmail" autocomplete="username" placeholder="voce@ifinformatica.com" required />
          </div>
          <div class="login-error" id="recErro1" style="margin-top:14px;"><i class="fa-solid fa-circle-exclamation"></i><span></span></div>
          <button class="btn-primary login-submit" id="recEnviar" type="button" style="margin-top:16px;"><i class="fa-solid fa-paper-plane"></i><span>Enviar c&oacute;digo</span></button>
        </div>

        <div id="recStep2" style="display:none;">
          <p class="login-hint">Enviamos um c&oacute;digo para o seu e-mail. Digite o c&oacute;digo e a nova senha.</p>
          <div class="login-form">
            <div class="login-field">
              <label for="recCodigo">C&oacute;digo</label>
              <input type="text" id="recCodigo" inputmode="numeric" maxlength="6" placeholder="000000" />
            </div>
            <div class="login-field">
              <label for="recSenha">Nova senha</label>
              <input type="password" id="recSenha" autocomplete="new-password" placeholder="m&iacute;nimo 8 caracteres" />
            </div>
            <div class="login-field">
              <label for="recSenha2">Confirmar nova senha</label>
              <input type="password" id="recSenha2" autocomplete="new-password" placeholder="repita a senha" />
            </div>
            <div class="login-error" id="recErro2"><i class="fa-solid fa-circle-exclamation"></i><span></span></div>
            <button class="btn-primary login-submit" id="recRedefinir" type="button"><i class="fa-solid fa-check"></i><span>Redefinir senha</span></button>
          </div>
        </div>

        <button type="button" id="recVoltar" class="login-link">&larr; Voltar ao login</button>
      </div>
    </div>`;

  document.body.appendChild(rec);
  document.getElementById('recEnviar')?.addEventListener('click', _recEnviarCodigo);
  document.getElementById('recRedefinir')?.addEventListener('click', _recRedefinir);
  document.getElementById('recVoltar')?.addEventListener('click', mostrarLogin);
  document.getElementById('recEmail')?.focus();
}

function _recErro(id, msg) {
  const el = document.getElementById(id);
  const span = el?.querySelector('span');
  if (!msg) { el?.classList.remove('visivel'); return; }
  if (span) span.textContent = msg;
  el?.classList.add('visivel');
}

async function _recEnviarCodigo() {
  const email = document.getElementById('recEmail')?.value.trim();
  const btn = document.getElementById('recEnviar');
  _recErro('recErro1', '');
  if (!email) { _recErro('recErro1', 'Informe o seu e-mail.'); return; }

  if (btn) btn.disabled = true;
  try {
    const resp = await fetch('/api/auth/esqueci-senha', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email }),
    });
    const json = await resp.json();
    if (!resp.ok) throw new Error(json.erro || json.message || 'Erro ao enviar.');
    _recEmail = email;
    document.getElementById('recStep1').style.display = 'none';
    document.getElementById('recStep2').style.display = 'block';
    document.getElementById('recCodigo')?.focus();
  } catch (err) {
    _recErro('recErro1', err.message);
  } finally {
    if (btn) btn.disabled = false;
  }
}

async function _recRedefinir() {
  const codigo = document.getElementById('recCodigo')?.value.trim();
  const senha = document.getElementById('recSenha')?.value;
  const senha2 = document.getElementById('recSenha2')?.value;
  const btn = document.getElementById('recRedefinir');
  _recErro('recErro2', '');

  if (!codigo) { _recErro('recErro2', 'Digite o código recebido por e-mail.'); return; }
  if (!senha || senha.length < 8) { _recErro('recErro2', 'A nova senha deve ter pelo menos 8 caracteres.'); return; }
  if (senha !== senha2) { _recErro('recErro2', 'As senhas não conferem.'); return; }

  if (btn) btn.disabled = true;
  try {
    const resp = await fetch('/api/auth/redefinir-senha', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: _recEmail, codigo, senha }),
    });
    const json = await resp.json();
    if (!resp.ok) throw new Error(json.erro || json.message || 'Erro ao redefinir.');
    mostrarLogin();
    setTimeout(() => {
      const le = document.getElementById('loginErro');
      const span = le?.querySelector('span');
      if (span) { span.textContent = 'Senha redefinida! Entre com a nova senha.'; }
      le?.classList.add('visivel');
      if (le) le.style.color = 'var(--fg-green, #16a34a)';
    }, 60);
  } catch (err) {
    _recErro('recErro2', err.message);
  } finally {
    if (btn) btn.disabled = false;
  }
}

async function realizarLogin(e) {
  e.preventDefault();

  const email = document.getElementById('loginEmail')?.value.trim();
  const senha = document.getElementById('loginSenha')?.value;
  const erro = document.getElementById('loginErro');
  const erroTexto = erro?.querySelector('span');
  const btn = document.getElementById('loginSubmit');
  const btnLabel = btn?.querySelector('span');
  const btnIcon = btn?.querySelector('i');

  erro?.classList.remove('visivel');

  if (!email || !senha) {
    if (erroTexto) erroTexto.textContent = 'Informe e-mail e senha.';
    erro?.classList.add('visivel');
    return;
  }

  if (btn) btn.disabled = true;
  if (btnLabel) btnLabel.textContent = 'Entrando...';
  if (btnIcon) btnIcon.className = 'fa-solid fa-circle-notch fa-spin';

  try {
    const resposta = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, senha }),
    });
    const json = await resposta.json();

    if (!resposta.ok) {
      throw new Error(json.erro || json.message || 'Não foi possível entrar.');
    }

    usuarioLogado = json.usuario;
    localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(usuarioLogado));
    if (json.token) localStorage.setItem(TOKEN_STORAGE_KEY, json.token);
    aplicarUsuarioLogado();
    atualizarData();
    navegar('dashboard', document.querySelector('.nav-item.active'));
  } catch (err) {
    if (erroTexto) erroTexto.textContent = err.message;
    erro?.classList.add('visivel');
  } finally {
    if (btn) btn.disabled = false;
    if (btnLabel) btnLabel.textContent = 'Entrar';
    if (btnIcon) btnIcon.className = 'fa-solid fa-right-to-bracket';
  }
}

function sair(e) {
  e?.preventDefault();
  localStorage.removeItem(AUTH_STORAGE_KEY);
  localStorage.removeItem(TOKEN_STORAGE_KEY);
  mostrarLogin();
}

window.cronaUsuarioEhAdmin = usuarioEhAdmin;
window.cronaAuthHeaders = authHeaders;

/* ── Sino de avisos (notificação) ─────────────────────── */
let _cronaAvisoMaxId = 0;
const CRONA_AVISOS_KEY = 'crona_avisos_visto';

function _cronaMaxIdAvisos(lista) {
  return Array.isArray(lista)
    ? lista.reduce((m, a) => Math.max(m, a.id_aviso || 0), 0)
    : 0;
}

/* Acende a bolinha se houver aviso mais novo do que o último visto. */
async function _cronaVerificarAvisos() {
  const dot = document.getElementById('topbarBellDot');
  if (!dot || !usuarioLogado) return;
  try {
    const resp = await fetch('/api/avisos?periodo=todos', { headers: authHeaders() });
    if (!resp.ok) return;
    _cronaAvisoMaxId = _cronaMaxIdAvisos(await resp.json());
    let visto = 0;
    try { visto = parseInt(localStorage.getItem(CRONA_AVISOS_KEY), 10) || 0; } catch (e) {}
    dot.style.display = (_cronaAvisoMaxId > visto) ? 'block' : 'none';
  } catch (e) { /* silencioso */ }
}

/* Marca tudo como visto (ao entrar nos Avisos) e apaga a bolinha. */
async function _cronaMarcarAvisosVistos() {
  try {
    const resp = await fetch('/api/avisos?periodo=todos', { headers: authHeaders() });
    if (resp.ok) _cronaAvisoMaxId = _cronaMaxIdAvisos(await resp.json());
  } catch (e) { /* silencioso */ }
  try { localStorage.setItem(CRONA_AVISOS_KEY, String(_cronaAvisoMaxId)); } catch (e) {}
  const dot = document.getElementById('topbarBellDot');
  if (dot) dot.style.display = 'none';
}
window.cronaUsuarioAtual = usuarioAtual;
window.cronaAtualizarUsuarioLogado = atualizarUsuarioLogado;

/* ================================================================
   navegar(pagina, linkEl)
   Carrega o HTML do módulo e chama a inicialização correta.
================================================================ */
async function navegar(pagina, linkEl) {
  if (typeof event !== 'undefined' && event?.preventDefault) {
    event.preventDefault();
  }

  if (!usuarioLogado) {
    mostrarLogin();
    return;
  }

  if (!paginaPermitida(pagina)) {
    pagina = 'dashboard';
    linkEl = linkPadrao();
  }

  /* Marca item ativo na sidebar */
  if (linkEl) {
    document.querySelectorAll('.nav-item').forEach(i => i.classList.remove('active'));
    linkEl.classList.add('active');
  }

  /* No mobile, fecha o menu retrátil ao escolher uma página */
  if (typeof window._cronaFecharMenu === 'function') window._cronaFecharMenu();

  /* Atualiza título na topbar */
  const tituloEl = document.getElementById('topbarTitle');
  if (tituloEl) tituloEl.textContent = TITULOS[pagina] || pagina;
  const iconeEl = document.getElementById('topbarTitleIcon');
  if (iconeEl) iconeEl.className = ICONES[pagina] || 'fa-solid fa-table-cells-large';

  /* Spinner de carregamento */
  contentEl.innerHTML = `
    <div class="loading-initial">
      <i class="fa-solid fa-circle-notch fa-spin"></i>
      <p>Carregando ${TITULOS[pagina] || pagina}...</p>
    </div>`;

  try {
    const resposta = await fetch(`paginas/${pagina}.html`);

    if (!resposta.ok) {
      throw new Error(`paginas/${pagina}.html não encontrado (HTTP ${resposta.status})`);
    }

    /* Injeta o HTML — sem re-executar scripts externos */
    contentEl.innerHTML = await resposta.text();

    /* Scroll para o topo */
    contentEl.scrollTop = 0;

    /* ── Chama o init do módulo, se existir ───────────── */
    if (INIT_MAP[pagina]) {
      INIT_MAP[pagina]();
    }

    if (pagina === 'avisos') _cronaMarcarAvisosVistos();

  } catch (erro) {
    contentEl.innerHTML = `
      <div class="error-state">
        <i class="fa-solid fa-triangle-exclamation"></i>
        <h3>Página não encontrada</h3>
        <p>
          Crie o arquivo <code>paginas/${pagina}.html</code>
          para exibir o conteúdo desta seção.
        </p>
        <small>${erro.message}</small>
      </div>`;

    console.error('[CronaSys] Navegação:', erro);
  }
}

/* ── Data na topbar ──────────────────────────────────── */
function atualizarData() {
  const el = document.getElementById('topbarDate');
  if (!el) return;
  el.textContent = new Date().toLocaleDateString('pt-BR', {
    weekday: 'long', day: '2-digit', month: 'long', year: 'numeric'
  });
}

/* ── Inicialização ───────────────────────────────────── */
/* Liga o menu retrátil do mobile (hambúrguer + overlay). */
function _cronaWireDrawer() {
  const toggle  = document.getElementById('menuToggle');
  const sidebar = document.querySelector('.sidebar');
  const overlay = document.getElementById('sidebarOverlay');
  const abrir  = () => { sidebar?.classList.add('aberta');    overlay?.classList.add('ativa'); };
  const fechar = () => { sidebar?.classList.remove('aberta'); overlay?.classList.remove('ativa'); };
  toggle?.addEventListener('click', () => {
    sidebar?.classList.contains('aberta') ? fechar() : abrir();
  });
  overlay?.addEventListener('click', fechar);
  window._cronaFecharMenu = fechar;
}

document.addEventListener('DOMContentLoaded', () => {
  _cronaWireDrawer();
  usuarioLogado = obterUsuarioLogado();

  if (!usuarioLogado) {
    mostrarLogin();
    return;
  }

  aplicarUsuarioLogado();
  atualizarData();
  navegar('dashboard', document.querySelector('.nav-item.active'));
});