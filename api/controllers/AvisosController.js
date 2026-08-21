module.exports = class AvisosController {
    #avisosService;

    constructor(avisosService) {
        console.log("Instanciado AvisosController");
        this.#avisosService = avisosService;
    }

    listar = async (request, response, next) => {
        console.log("[AvisosController.listar]");
        try {
            const avisos = await this.#avisosService.listar(request.query, request.usuario);
            response.json(avisos);
        } catch (error) {
            next(error);
        }
    };

    criar = async (request, response, next) => {
        console.log("[AvisosController.criar]");
        try {
            const resultado = await this.#avisosService.criar(request.body, request.usuario);
            response.status(201).json(resultado);
        } catch (error) {
            next(error);
        }
    };

    excluir = async (request, response, next) => {
        console.log("[AvisosController.excluir]");
        try {
            const resultado = await this.#avisosService.excluir(request.params.id);
            response.json(resultado);
        } catch (error) {
            next(error);
        }
    };
};