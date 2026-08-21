const Aviso = require("../models/Aviso");
const ErrorResponse = require("../utils/ErrorResponse");

module.exports = class AvisosService {
    #avisoDAO;

    constructor(avisoDAO) {
        console.log("Instanciado AvisosService");
        this.#avisoDAO = avisoDAO;
    }

    listar = async (filtros) => {
        console.log("[AvisosService.listar]");
        const avisos = await this.#avisoDAO.listar({
            tipo: filtros?.tipo,
            periodo: filtros?.periodo,
            data: filtros?.data,
        });

        return avisos.map(aviso => ({
            id_aviso: aviso.id_aviso,
            titulo: aviso.titulo,
            mensagem: aviso.mensagem,
            tipo: aviso.tipo,
            autor: aviso.autor,
            data_aviso: aviso.data_exibicao,
            data_criacao: aviso.data_criacao_fmt,
            hora_criacao: aviso.hora_criacao,
        }));
    };

    criar = async (body, usuario) => {
        console.log("[AvisosService.criar]");
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

        const tiposValidos = ["geral", "importante", "comemorativo"];

        const aviso = new Aviso({
            titulo: body.titulo.trim(),
            mensagem: body.mensagem.trim(),
            tipo: tiposValidos.includes(body.tipo) ? body.tipo : "geral",
            id_autor: usuario?.id_usuario || null,
        });

        const idAviso = await this.#avisoDAO.criar(aviso);

        return { message: "Aviso publicado com sucesso!", id_aviso: idAviso };
    };

    excluir = async (id) => {
        console.log("[AvisosService.excluir]");
        const excluiu = await this.#avisoDAO.excluir(id);

        if (!excluiu) {
            throw new ErrorResponse(404, "Aviso não encontrado.", {
                message: "Aviso não encontrado.",
            });
        }

        return { message: "Aviso excluído." };
    };
};