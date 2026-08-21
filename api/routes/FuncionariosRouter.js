const express = require("express");

module.exports = class FuncionariosRouter {
    #router;
    #authPermissoesMiddleware;
    #funcionariosMiddleware;
    #funcionariosController;

    constructor(authPermissoesMiddleware, funcionariosMiddleware, funcionariosController) {
        this.#router = express.Router();
        this.#authPermissoesMiddleware = authPermissoesMiddleware;
        this.#funcionariosMiddleware = funcionariosMiddleware;
        this.#funcionariosController = funcionariosController;
    }

    createRoutes = () => {
        console.log("[FuncionariosRouter] Rotas criadas");
        this.#router.get(
            "/setores",
            this.#authPermissoesMiddleware.carregarUsuario,
            this.#funcionariosController.listarSetores
        );
        this.#router.get(
            "/usuarios",
            this.#authPermissoesMiddleware.carregarUsuario,
            this.#funcionariosController.listar
        );
        this.#router.get(
            "/usuarios/:id",
            this.#authPermissoesMiddleware.carregarUsuario,
            this.#funcionariosMiddleware.validateIdParam,
            this.#funcionariosController.buscarPorId
        );

        this.#router.post(
            "/usuarios",
            this.#authPermissoesMiddleware.carregarUsuario,
            this.#authPermissoesMiddleware.exigirAdministrador,
            this.#funcionariosMiddleware.validateCadastroBody,
            this.#funcionariosController.cadastrar
        );

        this.#router.put(
            "/usuarios/:id",
            this.#authPermissoesMiddleware.carregarUsuario,
            this.#authPermissoesMiddleware.exigirAdministrador,
            this.#funcionariosMiddleware.validateIdParam,
            this.#funcionariosController.atualizar
        );

        // Liga/desliga "isento de ponto" (exige senha do admin) — ação isolada
        this.#router.patch(
            "/usuarios/:id/isento-ponto",
            this.#authPermissoesMiddleware.carregarUsuario,
            this.#authPermissoesMiddleware.exigirAdministrador,
            this.#funcionariosMiddleware.validateIdParam,
            this.#funcionariosController.definirIsentoPonto
        );

        this.#router.delete(
            "/usuarios/:id",
            this.#authPermissoesMiddleware.carregarUsuario,
            this.#authPermissoesMiddleware.exigirAdministrador,
            this.#funcionariosMiddleware.validateIdParam,
            this.#funcionariosController.excluir
        );

        return this.#router;
    };
};