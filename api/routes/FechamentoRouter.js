const express = require("express");

module.exports = class FechamentoRouter {
    #router;
    #authPermissoesMiddleware;
    #fechamentoController;

    constructor(authPermissoesMiddleware, fechamentoController) {
        this.#router = express.Router();
        this.#authPermissoesMiddleware = authPermissoesMiddleware;
        this.#fechamentoController = fechamentoController;
    }

    createRoutes = () => {
        console.log("[FechamentoRouter] Rotas criadas");
        /* Excel primeiro (rota mais específica). Ambas só para admin (RH). */
        this.#router.get(
            "/fechamento/:ano/:mes/excel",
            this.#authPermissoesMiddleware.carregarUsuario,
            this.#authPermissoesMiddleware.exigirAdministrador,
            this.#fechamentoController.excel
        );

        this.#router.get(
            "/fechamento/:ano/:mes/status",
            this.#authPermissoesMiddleware.carregarUsuario,
            this.#authPermissoesMiddleware.exigirAdministrador,
            this.#fechamentoController.status
        );

        this.#router.post(
            "/fechamento/:ano/:mes/fechar",
            this.#authPermissoesMiddleware.carregarUsuario,
            this.#authPermissoesMiddleware.exigirAdministrador,
            this.#fechamentoController.fechar
        );

        this.#router.post(
            "/fechamento/:ano/:mes/reabrir",
            this.#authPermissoesMiddleware.carregarUsuario,
            this.#authPermissoesMiddleware.exigirAdministrador,
            this.#fechamentoController.reabrir
        );

        this.#router.get(
            "/fechamento/:ano/:mes",
            this.#authPermissoesMiddleware.carregarUsuario,
            this.#authPermissoesMiddleware.exigirAdministrador,
            this.#fechamentoController.previa
        );

        return this.#router;
    };
};