module.exports = class PontoController {
    #pontoService;

    constructor(pontoService) {
        console.log("Instanciado PontoController");
        this.#pontoService = pontoService;
    }

    carregar = async (request, response, next) => {
        console.log("[PontoController.carregar]");
        try {
            const resultado = await this.#pontoService.carregar(request.params, request.usuario);
            response.json(resultado);
        } catch (error) {
            next(error);
        }
    };

    bancoHoras = async (request, response, next) => {
        console.log("[PontoController.bancoHoras]");
        try {
            const resultado = await this.#pontoService.bancoHoras(request.usuario);
            response.json(resultado);
        } catch (error) {
            next(error);
        }
    };

    saldosAcumulados = async (request, response, next) => {
        console.log("[PontoController.saldosAcumulados]");
        try {
            const resultado = await this.#pontoService.saldosAcumulados();
            response.json(resultado);
        } catch (error) {
            next(error);
        }
    };

    detalheMes = async (request, response, next) => {
        console.log("[PontoController.detalheMes]");
        try {
            const { ano, mes } = request.params;
            const resultado = await this.#pontoService.detalheMes(request.usuario, ano, mes);
            response.json(resultado);
        } catch (error) {
            next(error);
        }
    };

    salvar = async (request, response, next) => {
        console.log("[PontoController.salvar]");
        try {
            const resultado = await this.#pontoService.salvar(request.body, request.usuario);
            response.json(resultado);
        } catch (error) {
            next(error);
        }
    };
};