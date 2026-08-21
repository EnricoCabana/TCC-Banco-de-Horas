module.exports = class FeriadosController {
    #feriadosService;

    constructor(feriadosService) {
        console.log("Instanciado FeriadosController");
        this.#feriadosService = feriadosService;
    }

    listar = async (request, response, next) => {
        console.log("[FeriadosController.listar]");
        try {
            const lista = await this.#feriadosService.listarPorAno(request.params.ano);
            response.json(lista);
        } catch (error) {
            next(error);
        }
    };

    salvar = async (request, response, next) => {
        console.log("[FeriadosController.salvar]");
        try {
            const resultado = await this.#feriadosService.salvar(request.body, request.usuario);
            response.status(201).json(resultado);
        } catch (error) {
            next(error);
        }
    };

    excluir = async (request, response, next) => {
        console.log("[FeriadosController.excluir]");
        try {
            const resultado = await this.#feriadosService.excluir(request.params.data, request.usuario);
            response.json(resultado);
        } catch (error) {
            next(error);
        }
    };
};