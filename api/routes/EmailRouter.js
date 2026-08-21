const express = require("express");

module.exports = class EmailRouter {
    #router;
    #authPermissoesMiddleware;
    #emailController;

    constructor(authPermissoesMiddleware, emailController) {
        this.#router = express.Router();
        this.#authPermissoesMiddleware = authPermissoesMiddleware;
        this.#emailController = emailController;
    }

    createRoutes = () => {
        console.log("[EmailRouter] Rotas criadas");
        /* Tudo somente para administradores (RH). */
        this.#router.get(
            "/email/config",
            this.#authPermissoesMiddleware.carregarUsuario,
            this.#authPermissoesMiddleware.exigirAdministrador,
            this.#emailController.obterConfig
        );
        this.#router.put(
            "/email/config",
            this.#authPermissoesMiddleware.carregarUsuario,
            this.#authPermissoesMiddleware.exigirAdministrador,
            this.#emailController.salvarConfig
        );
        this.#router.post(
            "/email/testar",
            this.#authPermissoesMiddleware.carregarUsuario,
            this.#authPermissoesMiddleware.exigirAdministrador,
            this.#emailController.enviarTeste
        );
        return this.#router;
    };
};