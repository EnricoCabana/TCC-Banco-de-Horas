module.exports = class AuthController {
    #authService;

    constructor(authService) {
        console.log("Instanciado AuthController");
        this.#authService = authService;
    }

    login = async (request, response, next) => {
        console.log("[AuthController.login]");
        try {
            const resultado = await this.#authService.login(request.body);
            response.json(resultado);
        } catch (error) {
            next(error);
        }
    };

    esqueciSenha = async (request, response, next) => {
        console.log("[AuthController.esqueciSenha]");
        try {
            response.json(await this.#authService.solicitarRedefinicao(request.body?.email));
        } catch (error) {
            next(error);
        }
    };

    redefinirSenha = async (request, response, next) => {
        console.log("[AuthController.redefinirSenha]");
        try {
            response.json(await this.#authService.redefinirSenha(
                request.body?.email, request.body?.codigo, request.body?.senha
            ));
        } catch (error) {
            next(error);
        }
    };

    /* Confirma a senha do usuário logado (libera ações sensíveis no front). */
    confirmarSenha = async (request, response, next) => {
        console.log("[AuthController.confirmarSenha]");
        try {
            const ok = await this.#authService.confirmarSenha(
                request.usuario?.id_usuario, request.body?.senha
            );
            if (!ok) {
                return response.status(401).json({ status: false, message: "Senha incorreta." });
            }
            response.json({ status: true, message: "Senha confirmada." });
        } catch (error) {
            next(error);
        }
    };
};