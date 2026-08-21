const ErrorResponse = require("../utils/ErrorResponse");
const Usuario = require("../models/Usuario");

module.exports = class PermissoesService {
    #usuarioDAO;

    constructor(usuarioDAO) {
        console.log("Instanciado PermissoesService");
        this.#usuarioDAO = usuarioDAO;
    }

    carregarUsuario = async (idUsuario) => {
        console.log("[PermissoesService.carregarUsuario]");
        if (!idUsuario) {
            throw new ErrorResponse(401, "Faça login para continuar.", {
                message: "Faça login para continuar.",
            });
        }

        const usuario = await this.#usuarioDAO.findAtivoById(idUsuario);

        if (!usuario || !usuario.ativo) {
            throw new ErrorResponse(401, "Usuário logado inválido ou inativo.", {
                message: "Usuário logado inválido ou inativo.",
            });
        }

        return {
            ...usuario,
            administrador: Usuario.ehAdministrador(usuario),
        };
    };

    exigirAdministrador = (usuario) => {
        if (!usuario?.administrador) {
            throw new ErrorResponse(403, "Apenas administradores podem realizar esta ação.", {
                message: "Apenas administradores podem realizar esta ação.",
            });
        }
    };
};