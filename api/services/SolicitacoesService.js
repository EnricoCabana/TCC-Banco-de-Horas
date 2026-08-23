const Solicitacao = require("../models/Solicitacao");
const Ocorrencia = require("../models/Ocorrencia");
const ErrorResponse = require("../utils/ErrorResponse");

/**
 * Regras de negócio das Solicitações de Ajuste.
 *
 * Fluxo: o funcionário abre uma solicitação (data + tipo de ocorrência +
 * mensagem explicando o motivo). Fica "Pendente" até o RH aprovar ou negar.
 *
 * Importante: aprovar aqui só REGISTRA a decisão — quem efetivamente aplica
 * o ajuste no ponto do funcionário continua sendo o RH, pela tela de Gestão
 * de Ponto que já existe. Isso evita duplicar a lógica de cálculo (que já
 * mora no PontoService) e mantém essa parte simples.
 */
module.exports = class SolicitacoesService {
    #solicitacaoDAO;
    #auditoriaService;

    constructor(solicitacaoDAO, auditoriaService) {
        console.log("Instanciado SolicitacoesService");
        this.#solicitacaoDAO = solicitacaoDAO;
        this.#auditoriaService = auditoriaService;
    }

    listar = async (filtros, usuarioLogado) => {
        console.log("[SolicitacoesService.listar]");

        const statusValidos = ["Pendente", "Aprovado", "Negado"];
        const status = statusValidos.includes(filtros?.status) ? filtros.status : undefined;

        // Funcionário comum só enxerga as próprias solicitações;
        // administrador enxerga as de todo mundo.
        const idUsuario = usuarioLogado?.administrador ? undefined : usuarioLogado?.id_usuario;

        const solicitacoes = await this.#solicitacaoDAO.listar({ status, id_usuario: idUsuario });

        return solicitacoes.map(s => ({
            ...s,
            ocorrencia: Ocorrencia.normalizarSaida(s.ocorrencia),
        }));
    };

    criar = async (body, usuarioLogado) => {
        console.log("[SolicitacoesService.criar]");

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

        const solicitacao = new Solicitacao({
            id_usuario: usuarioLogado.id_usuario,
            data_ref: body.data_ref,
            ocorrencia: body.ocorrencia.trim(),
            mensagem: body.mensagem.trim(),
        });

        const id = await this.#solicitacaoDAO.criar(solicitacao);

        await this.#auditoriaService?.registrar({
            acao: "CRIAR",
            entidade: "Solicitacao",
            entidade_id: id,
            descricao: `Solicitou ajuste de ${body.data_ref} (${body.ocorrencia})`,
            executor: usuarioLogado,
        });

        return { message: "Solicitação enviada! Aguarde a análise do RH.", id_solicitacao: id };
    };

    responder = async (id, status, usuarioLogado) => {
        console.log("[SolicitacoesService.responder]");

        const solicitacao = await this.#solicitacaoDAO.buscarPorId(id);
        if (!solicitacao) {
            throw new ErrorResponse(404, "Solicitação não encontrada.", {
                message: "Solicitação não encontrada.",
            });
        }

        if (solicitacao.status !== "Pendente") {
            throw new ErrorResponse(409, "Esta solicitação já foi respondida.", {
                message: "Esta solicitação já foi respondida.",
            });
        }

        const atualizou = await this.#solicitacaoDAO.responder(id, status, usuarioLogado.id_usuario);
        if (!atualizou) {
            throw new ErrorResponse(409, "Não foi possível responder esta solicitação.", {
                message: "Não foi possível responder esta solicitação.",
            });
        }

        await this.#auditoriaService?.registrar({
            acao: "EDITAR",
            entidade: "Solicitacao",
            entidade_id: id,
            descricao: `${status === "Aprovado" ? "Aprovou" : "Negou"} a solicitação #${id}`,
            executor: usuarioLogado,
        });

        return { message: `Solicitação ${status.toLowerCase()}.` };
    };
};