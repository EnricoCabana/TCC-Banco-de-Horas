/* =======================================================
   tema.js — tema claro/escuro do site inteiro.
   Aplica a escolha salva antes de renderizar (evita piscar).
   O botão fica no Perfil (botões com data-tema="light|dark").
======================================================= */
(function () {
  const raiz = document.documentElement;
  const CHAVE = "crona-tema";

  function ler()     { try { return localStorage.getItem(CHAVE); } catch (e) { return null; } }
  function salvar(t) { try { localStorage.setItem(CHAVE, t); } catch (e) {} }

  function aplicar(tema) {
    if (tema === "dark") raiz.setAttribute("data-theme", "dark");
    else                 raiz.removeAttribute("data-theme");
    document.querySelectorAll("[data-tema]").forEach(function (b) {
      b.classList.toggle("active", b.dataset.tema === tema);
    });
  }

  // Aplica imediatamente o tema salvo (padrão: claro).
  aplicar(ler() || "light");

  // Usadas pela tela de Perfil.
  window.cronaAplicarTema = function (tema) { aplicar(tema); salvar(tema); };
  window.cronaSyncTemaUI  = function ()     { aplicar(ler() || "light"); };

  // Clique nos botões de tema (funciona mesmo que apareçam depois).
  document.addEventListener("click", function (e) {
    const botao = e.target.closest("[data-tema]");
    if (botao) window.cronaAplicarTema(botao.dataset.tema);
  });
})();