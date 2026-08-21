const ErrorResponse = require("../utils/ErrorResponse");

module.exports = class PontoMiddleware {
    validateCarregarParams = (request, response, next) => {
        try {
            const { id, mes, ano } = request.params;

            if (!id || !mes || !ano) {
                throw new ErrorResponse(400, "Parâmetros inválidos.", {
                    message: "Parâmetros inválidos.",
                });
            }

            next();
        } catch (error) {
            next(error);
        }
    };

    validateSalvarBody = (request, response, next) => {
        try {
            const { id_usuario, mes, ano, lancamentos } = request.body || {};

            if (!id_usuario || !mes || !ano || !Array.isArray(lancamentos)) {
                throw new ErrorResponse(400, "Dados inválidos.", {
                    message: "Dados inválidos.",
                });
            }

            next();
        } catch (error) {
            next(error);
        }
    };
};
