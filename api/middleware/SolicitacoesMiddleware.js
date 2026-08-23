const ErrorResponse = require("../utils/ErrorResponse");

module.exports = class SolicitacoesMiddleware {
    validateCriarBody = (request, response, next) => {
        try {
            const body = request.body || {};

            if (!body.data_ref) {
                throw new ErrorResponse(400, "A data é obrigatória.", {
                    message: "A data é obrigatória.",
                });
            }

            if (!body.ocorrencia?.trim()) {
                throw new ErrorResponse(400, "O tipo de ocorrência é obrigatório.", {
                    message: "O tipo de ocorrência é obrigatório.",
                });
            }

            if (!body.mensagem?.trim()) {
                throw new ErrorResponse(400, "Explique o motivo da solicitação.", {
                    message: "Explique o motivo da solicitação.",
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
                throw new ErrorResponse(400, "ID da solicitação é obrigatório.", {
                    message: "ID da solicitação é obrigatório.",
                });
            }

            next();
        } catch (error) {
            next(error);
        }
    };
};