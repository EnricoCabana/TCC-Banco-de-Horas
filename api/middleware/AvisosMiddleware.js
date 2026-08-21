const ErrorResponse = require("../utils/ErrorResponse");

module.exports = class AvisosMiddleware {
    validateCriarBody = (request, response, next) => {
        try {
            const body = request.body || {};

            if (!body.titulo?.trim()) {
                throw new ErrorResponse(400, "O título é obrigatório.", {
                    message: "O título é obrigatório.",
                });
            }

            if (!body.mensagem?.trim()) {
                throw new ErrorResponse(400, "A mensagem é obrigatória.", {
                    message: "A mensagem é obrigatória.",
                });
            }

            next();
        } catch (error) {
            next(error);
        }
    };

    validateIdParam = (request, response, next) => {
        try {
            if (!request.params.id) {
                throw new ErrorResponse(400, "ID do aviso é obrigatório.", {
                    message: "ID do aviso é obrigatório.",
                });
            }

            next();
        } catch (error) {
            next(error);
        }
    };
};
