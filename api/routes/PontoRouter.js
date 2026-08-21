const express = require("express");

module.exports = class PontoRouter {
    #router;
    #authPermissoesMiddleware;
    #pontoMiddleware;
    #pontoController;

    constructor(authPermissoesMiddleware, pontoMiddleware, pontoController) {
        this.#router = express.Router();
        this.#authPermissoesMiddleware = authPermissoesMiddleware;
        this.#pontoMiddleware = pontoMiddleware;
        this.#pontoController = pontoController;
    }

    createRoutes = () => {
        console.log("[PontoRouter] Rotas criadas");
        this.#router.post(
            "/ponto/salvar",
            this.#authPermissoesMiddleware.carregarUsuario,
            this.#authPermissoesMiddleware.exigirAdministrador,
            this.#pontoMiddleware.validateSalvarBody,
            this.#pontoController.salvar
        );

        this.#router.get(
            "/ponto/:id/:mes/:ano",
            this.#authPermissoesMiddleware.carregarUsuario,
            this.#pontoMiddleware.validateCarregarParams,
            this.#pontoController.carregar
        );

        // Banco de horas do próprio usuário (RH e funcionário comum)
        this.#router.get(
            "/banco-horas",
            this.#authPermissoesMiddleware.carregarUsuario,
            this.#pontoController.bancoHoras
        );

        // Detalhe dia a dia de um mês do próprio usuário (relatório do mês)
        this.#router.get(
            "/banco-horas/:ano/:mes",
            this.#authPermissoesMiddleware.carregarUsuario,
            this.#pontoController.detalheMes
        );

        // Saldo total acumulado de todos (apenas RH) — telas de equipe
        this.#router.get(
            "/saldos-acumulados",
            this.#authPermissoesMiddleware.carregarUsuario,
            this.#authPermissoesMiddleware.exigirAdministrador,
            this.#pontoController.saldosAcumulados
        );

        return this.#router;
    };
};