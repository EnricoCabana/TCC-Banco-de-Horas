const express = require("express");

module.exports = class AuthRouter {
    #router;
    #authMiddleware;
    #authPermissoesMiddleware;
    #authController;

    constructor(authMiddleware, authPermissoesMiddleware, authController) {
        this.#router = express.Router();
        this.#authMiddleware = authMiddleware;
        this.#authPermissoesMiddleware = authPermissoesMiddleware;
        this.#authController = authController;
    }

    createRoutes = () => {
        console.log("[AuthRouter] Rotas criadas");
        this.#router.post(
            "/login",
            this.#authMiddleware.validateLoginBody,
            this.#authController.login
        );

        /* Recuperação de senha (públicas). */
        this.#router.post("/esqueci-senha", this.#authController.esqueciSenha);
        this.#router.post("/redefinir-senha", this.#authController.redefinirSenha);

        /* Confirmação de senha do usuário logado (ações sensíveis). */
        this.#router.post(
            "/confirmar-senha",
            this.#authPermissoesMiddleware.carregarUsuario,
            this.#authController.confirmarSenha
        );

        return this.#router;
    };
};