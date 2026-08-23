const express = require("express");

module.exports = class SolicitacoesRouter {
    #router;
    #authPermissoesMiddleware;
    #solicitacoesMiddleware;
    #solicitacoesController;

    constructor(authPermissoesMiddleware, solicitacoesMiddleware, solicitacoesController) {
        this.#router = express.Router();
        this.#authPermissoesMiddleware = authPermissoesMiddleware;
        this.#solicitacoesMiddleware = solicitacoesMiddleware;
        this.#solicitacoesController = solicitacoesController;
    }

    createRoutes = () => {
        console.log("[SolicitacoesRouter] Rotas criadas");

        /* Qualquer usuário logado lista (o Service filtra pra ver só as
           próprias, a não ser que seja administrador). */
        this.#router.get(
            "/solicitacoes/",
            this.#authPermissoesMiddleware.carregarUsuario,
            this.#solicitacoesController.listar
        );

        /* Qualquer usuário logado pode abrir uma solicitação. */
        this.#router.post(
            "/solicitacoes/",
            this.#authPermissoesMiddleware.carregarUsuario,
            this.#solicitacoesMiddleware.validateCriarBody,
            this.#solicitacoesController.criar
        );

        /* Só o RH aprova ou nega. */
        this.#router.patch(
            "/solicitacoes/:id/aprovar",
            this.#authPermissoesMiddleware.carregarUsuario,
            this.#authPermissoesMiddleware.exigirAdministrador,
            this.#solicitacoesMiddleware.validateIdParam,
            this.#solicitacoesController.aprovar
        );

        this.#router.patch(
            "/solicitacoes/:id/negar",
            this.#authPermissoesMiddleware.carregarUsuario,
            this.#authPermissoesMiddleware.exigirAdministrador,
            this.#solicitacoesMiddleware.validateIdParam,
            this.#solicitacoesController.negar
        );

        return this.#router;
    };
};