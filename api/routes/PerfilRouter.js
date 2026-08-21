const express = require("express");

module.exports = class PerfilRouter {
    #router;
    #authPermissoesMiddleware;
    #perfilController;

    constructor(authPermissoesMiddleware, perfilController) {
        this.#router = express.Router();
        this.#authPermissoesMiddleware = authPermissoesMiddleware;
        this.#perfilController = perfilController;
    }

    createRoutes = () => {
        console.log("[PerfilRouter] Rotas criadas");
        /* Qualquer usuário logado acessa o PRÓPRIO perfil (id vem do token/sessão). */
        this.#router.get(
            "/perfil",
            this.#authPermissoesMiddleware.carregarUsuario,
            this.#perfilController.buscar
        );

        this.#router.put(
            "/perfil",
            this.#authPermissoesMiddleware.carregarUsuario,
            this.#perfilController.atualizar
        );

        return this.#router;
    };
};