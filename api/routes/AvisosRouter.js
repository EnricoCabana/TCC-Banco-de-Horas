const express = require("express");

module.exports = class AvisosRouter {
    #router;
    #authPermissoesMiddleware;
    #avisosMiddleware;
    #avisosController;

    constructor(authPermissoesMiddleware, avisosMiddleware, avisosController) {
        this.#router = express.Router();
        this.#authPermissoesMiddleware = authPermissoesMiddleware;
        this.#avisosMiddleware = avisosMiddleware;
        this.#avisosController = avisosController;
    }

    createRoutes = () => {
        console.log("[AvisosRouter] Rotas criadas");
        this.#router.get(
            "/avisos/",
            this.#authPermissoesMiddleware.carregarUsuario,
            this.#avisosController.listar
        );

        this.#router.post(
            "/avisos/",
            this.#authPermissoesMiddleware.carregarUsuario,
            this.#authPermissoesMiddleware.exigirAdministrador,
            this.#avisosMiddleware.validateCriarBody,
            this.#avisosController.criar
        );

        this.#router.delete(
            "/avisos/:id",
            this.#authPermissoesMiddleware.carregarUsuario,
            this.#authPermissoesMiddleware.exigirAdministrador,
            this.#avisosMiddleware.validateIdParam,
            this.#avisosController.excluir
        );

        return this.#router;
    };
};