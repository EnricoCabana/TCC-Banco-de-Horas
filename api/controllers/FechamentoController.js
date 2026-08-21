module.exports = class FechamentoController {
    #fechamentoService;

    constructor(fechamentoService) {
        console.log("Instanciado FechamentoController");
        this.#fechamentoService = fechamentoService;
    }

    /* Prévia em JSON (alimenta a tabela na tela). */
    previa = async (request, response, next) => {
        console.log("[FechamentoController.previa]");
        try {
            const relatorio = await this.#fechamentoService.gerarRelatorio(
                request.params.mes,
                request.params.ano
            );
            response.json(relatorio);
        } catch (error) {
            next(error);
        }
    };

    /* Status do fechamento (aberto/fechado). */
    status = async (request, response, next) => {
        console.log("[FechamentoController.status]");
        try {
            const st = await this.#fechamentoService.status(request.params.mes, request.params.ano);
            response.json(st);
        } catch (error) {
            next(error);
        }
    };

    /* Fecha o mês em lote. */
    fechar = async (request, response, next) => {
        console.log("[FechamentoController.fechar]");
        try {
            const r = await this.#fechamentoService.fechar(request.params.mes, request.params.ano, request.usuario);
            response.json(r);
        } catch (error) {
            next(error);
        }
    };

    /* Reabre o mês. */
    reabrir = async (request, response, next) => {
        console.log("[FechamentoController.reabrir]");
        try {
            const r = await this.#fechamentoService.reabrir(request.params.mes, request.params.ano, request.usuario);
            response.json(r);
        } catch (error) {
            next(error);
        }
    };

    /* Download do arquivo Excel (.xlsx). */
    excel = async (request, response, next) => {
        console.log("[FechamentoController.excel]");
        try {
            const { buffer, nomeArquivo } = await this.#fechamentoService.gerarExcel(
                request.params.mes,
                request.params.ano
            );
            response.setHeader(
                "Content-Type",
                "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
            );
            response.setHeader("Content-Disposition", `attachment; filename="${nomeArquivo}"`);
            response.send(buffer);
        } catch (error) {
            next(error);
        }
    };
};