const express = require("express");

module.exports = class FeriadosRouter {
    #router;
    #authPermissoesMiddleware;
    #feriadosController;

    constructor(authPermissoesMiddleware, feriadosController) {
        this.#router = express.Router();
        this.#authPermissoesMiddleware = authPermissoesMiddleware;
        this.#feriadosController = feriadosController;
    }

    createRoutes = () => {
        console.log("[FeriadosRouter] Rotas criadas");
        /* Leitura liberada (telas de cálculo precisam consultar). */
        this.#router.get(
            "/feriados/:ano",
            this.#authPermissoesMiddleware.carregarUsuario,
            this.#feriadosController.listar
        );

        /* Cadastro/remoção só para administradores (RH). */
        this.#router.post(
            "/feriados",
            this.#authPermissoesMiddleware.carregarUsuario,
            this.#authPermissoesMiddleware.exigirAdministrador,
            this.#feriadosController.salvar
        );

        this.#router.delete(
            "/feriados/:data",
            this.#authPermissoesMiddleware.carregarUsuario,
            this.#authPermissoesMiddleware.exigirAdministrador,
            this.#feriadosController.excluir
        );

        return this.#router;
    };
};