const express = require("express");

/**
 * SetorRouter — rotas do CRUD de setores (todas só para administradores).
 * A listagem de setores ATIVOS para os dropdowns continua em GET /api/setores
 * (FuncionariosRouter); aqui é a gestão completa.
 */
module.exports = class SetorRouter {
    #router;
    #authPermissoesMiddleware;
    #setorController;

    constructor(authPermissoesMiddleware, setorController) {
        this.#router = express.Router();
        this.#authPermissoesMiddleware = authPermissoesMiddleware;
        this.#setorController = setorController;
    }

    createRoutes = () => {
        console.log("[SetorRouter] Rotas criadas");
        const admin = [
            this.#authPermissoesMiddleware.carregarUsuario,
            this.#authPermissoesMiddleware.exigirAdministrador,
        ];

        // Lista completa (ativos + inativos) para a tela de gestão
        this.#router.get("/setores/gerenciar", ...admin, this.#setorController.listar);

        // Funcionários de um setor (com cargo) — painel que expande
        this.#router.get("/setores/:id/funcionarios", ...admin, this.#setorController.funcionarios);

        // Criar
        this.#router.post("/setores", ...admin, this.#setorController.criar);

        // Editar nome
        this.#router.put("/setores/:id", ...admin, this.#setorController.editar);

        // Inativar / reativar
        this.#router.patch("/setores/:id/ativo", ...admin, this.#setorController.definirAtivo);

        return this.#router;
    };
};