const MeuTokenJWT = require("../http/MeuTokenJWT");

module.exports = class AuthPermissoesMiddleware {
    #permissoesService;

    constructor(permissoesService) {
        this.#permissoesService = permissoesService;
    }

    carregarUsuario = async (request, response, next) => {
        // Autenticação via JWT no header Authorization: Bearer <token>
        const autorizacao = request.headers.authorization || request.get("authorization");
        const tokenJWT = new MeuTokenJWT();

        if (!tokenJWT.validarToken(autorizacao)) {
            return response.status(401).json({ status: false, message: "Token inválido ou expirado." });
        }

        const idUsuario = tokenJWT.payload?.idUsuario;
        try {
            request.usuario = await this.#permissoesService.carregarUsuario(idUsuario);
            next();
        } catch (error) {
            next(error);
        }
    };

    exigirAdministrador = (request, response, next) => {
        try {
            this.#permissoesService.exigirAdministrador(request.usuario);
            next();
        } catch (error) {
            next(error);
        }
    };
};