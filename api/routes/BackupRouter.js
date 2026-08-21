const express = require("express");

module.exports = class BackupRouter {
    #router;
    #authPermissoesMiddleware;
    #backupController;

    constructor(authPermissoesMiddleware, backupController) {
        this.#router = express.Router();
        this.#authPermissoesMiddleware = authPermissoesMiddleware;
        this.#backupController = backupController;
    }

    createRoutes = () => {
        console.log("[BackupRouter] Rotas criadas");
        /* Tudo somente para administradores (RH). */
        this.#router.post(
            "/backup/baixar",
            this.#authPermissoesMiddleware.carregarUsuario,
            this.#authPermissoesMiddleware.exigirAdministrador,
            this.#backupController.baixar
        );
        this.#router.post(
            "/backup/importar",
            this.#authPermissoesMiddleware.carregarUsuario,
            this.#authPermissoesMiddleware.exigirAdministrador,
            express.raw({ type: "*/*", limit: "30mb" }), // .zip é binário — raw, não text
            this.#backupController.importar
        );
        return this.#router;
    };
};