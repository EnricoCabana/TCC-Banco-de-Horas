const ErrorResponse = require("../utils/ErrorResponse");

module.exports = class FuncionariosMiddleware {
    validateIdParam = (request, response, next) => {
        try {
            if (!request.params.id) {
                throw new ErrorResponse(400, "ID do funcionário é obrigatório.", {
                    message: "ID do funcionário é obrigatório.",
                });
            }

            next();
        } catch (error) {
            next(error);
        }
    };

    validateCadastroBody = (request, response, next) => {
        try {
            const body = request.body || {};

            if (!body.nome?.trim()) {
                throw new ErrorResponse(400, "Nome é obrigatório.", { message: "Nome é obrigatório." });
            }
            if (!body.matricula?.trim()) {
                throw new ErrorResponse(400, "Matrícula é obrigatória.", { message: "Matrícula é obrigatória." });
            }
            if (!body.email?.trim()) {
                throw new ErrorResponse(400, "E-mail é obrigatório.", { message: "E-mail é obrigatório." });
            }
            if (!body.senha?.trim()) {
                throw new ErrorResponse(400, "Senha é obrigatória.", { message: "Senha é obrigatória." });
            }
            if (!body.id_setor) {
                throw new ErrorResponse(400, "Setor é obrigatório.", { message: "Setor é obrigatório." });
            }
            if (!body.cpf?.trim()) {
                throw new ErrorResponse(400, "CPF é obrigatório.", { message: "CPF é obrigatório." });
            }

            next();
        } catch (error) {
            next(error);
        }
    };
};
