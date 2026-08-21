const ErrorResponse = require("../utils/ErrorResponse");

module.exports = class AuthMiddleware {
    validateLoginBody = (request, response, next) => {
        try {
            const dados = request.body?.funcionario || request.body || {};

            if (!dados.email || !dados.senha) {
                throw new ErrorResponse(400, "E-mail e senha são obrigatórios.", {
                    erro: "E-mail e senha são obrigatórios.",
                });
            }

            next();
        } catch (error) {
            next(error);
        }
    };
};
