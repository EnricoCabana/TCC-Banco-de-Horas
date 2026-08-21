const express = require("express");

module.exports = class FichaEmailRouter {
    #router;
    #authPermissoesMiddleware;
    #fichaEmailController;

    constructor(authPermissoesMiddleware, fichaEmailController) {
        this.#router = express.Router();
        this.#authPermissoesMiddleware = authPermissoesMiddleware;
        this.#fichaEmailController = fichaEmailController;
    }

    createRoutes = () => {
        console.log("[FichaEmailRouter] Rotas criadas");
        /* Envio de fichas por e-mail — somente administradores (RH). */
        this.#router.post(
            "/email/fichas",
            this.#authPermissoesMiddleware.carregarUsuario,
            this.#authPermissoesMiddleware.exigirAdministrador,
            this.#fichaEmailController.enviar
        );

        /* Download do PDF de um funcionário (o controller garante admin-ou-próprio). */
        this.#router.get(
            "/ficha-pdf/baixar",
            this.#authPermissoesMiddleware.carregarUsuario,
            this.#fichaEmailController.baixar
        );
        return this.#router;
    };
};