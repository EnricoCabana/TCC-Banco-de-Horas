const express = require("express");

module.exports = class AuditoriaRouter {
    #router;
    #authPermissoesMiddleware;
    #auditoriaController;

    constructor(authPermissoesMiddleware, auditoriaController) {
        this.#router = express.Router();
        this.#authPermissoesMiddleware = authPermissoesMiddleware;
        this.#auditoriaController = auditoriaController;
    }

    createRoutes = () => {
        console.log("[AuditoriaRouter] Rotas criadas");
        /* Tudo somente para administradores (RH). */
        this.#router.get(
            "/auditoria/opcoes",
            this.#authPermissoesMiddleware.carregarUsuario,
            this.#authPermissoesMiddleware.exigirAdministrador,
            this.#auditoriaController.opcoes
        );

        this.#router.get(
            "/auditoria",
            this.#authPermissoesMiddleware.carregarUsuario,
            this.#authPermissoesMiddleware.exigirAdministrador,
            this.#auditoriaController.listar
        );

        return this.#router;
    };
};