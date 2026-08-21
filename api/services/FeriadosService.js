const ErrorResponse = require("../utils/ErrorResponse");

/**
 * Camada de regra de negócio dos feriados.
 * Usada pela tela de gestão de feriados e pelo cálculo de ponto (via DAO).
 */
module.exports = class FeriadosService {
    #feriadoDAO;
    #auditoriaService;

    constructor(feriadoDAO, auditoriaService) {
        console.log("Instanciado FeriadosService");
        this.#feriadoDAO = feriadoDAO;
        this.#auditoriaService = auditoriaService;
    }

    listarPorAno = async (ano) => {
        console.log("[FeriadosService.listarPorAno]");
        const anoNum = Number(ano);
        if (!anoNum || anoNum < 2000 || anoNum > 2100) {
            throw new ErrorResponse(400, "Ano inválido.", { message: "Ano inválido." });
        }
        return this.#feriadoDAO.listarPorAno(anoNum);
    };

    salvar = async (body, usuarioLogado) => {
        console.log("[FeriadosService.salvar]");
        const data = String(body?.data || "").trim();
        const descricao = String(body?.descricao || "").trim();
        let tipo = String(body?.tipo || "NACIONAL").trim().toUpperCase();

        if (!/^\d{4}-\d{2}-\d{2}$/.test(data)) {
            throw new ErrorResponse(400, "Data inválida. Use o formato AAAA-MM-DD.", {
                message: "Data inválida. Use o formato AAAA-MM-DD.",
            });
        }
        if (!descricao) {
            throw new ErrorResponse(400, "Informe a descrição do feriado.", {
                message: "Informe a descrição do feriado.",
            });
        }

        const TIPOS = ["NACIONAL", "ESTADUAL", "MUNICIPAL"];
        if (!TIPOS.includes(tipo)) tipo = "NACIONAL";

        await this.#feriadoDAO.salvar(data, descricao, tipo);

        await this.#auditoriaService?.registrar({
            acao: "CRIAR",
            entidade: "Feriado",
            entidade_id: data,
            descricao: `Cadastrou o feriado "${descricao}" (${data}) [${tipo}]`,
            executor: usuarioLogado,
        });

        return { message: "Feriado salvo com sucesso!", data, descricao, tipo };
    };

    excluir = async (data, usuarioLogado) => {
        console.log("[FeriadosService.excluir]");
        const removeu = await this.#feriadoDAO.excluir(data);
        if (!removeu) {
            throw new ErrorResponse(404, "Feriado não encontrado.", {
                message: "Feriado não encontrado.",
            });
        }

        await this.#auditoriaService?.registrar({
            acao: "EXCLUIR",
            entidade: "Feriado",
            entidade_id: data,
            descricao: `Excluiu o feriado de ${data}`,
            executor: usuarioLogado,
        });

        return { message: "Feriado removido." };
    };
};