module.exports = class AuditoriaController {
    #auditoriaService;

    constructor(auditoriaService) {
        console.log("Instanciado AuditoriaController");
        this.#auditoriaService = auditoriaService;
    }

    listar = async (request, response, next) => {
        console.log("[AuditoriaController.listar]");
        try {
            const eventos = await this.#auditoriaService.listar(request.query);
            response.json(eventos);
        } catch (error) {
            next(error);
        }
    };

    opcoes = async (request, response, next) => {
        console.log("[AuditoriaController.opcoes]");
        try {
            const opcoes = await this.#auditoriaService.opcoes();
            response.json(opcoes);
        } catch (error) {
            next(error);
        }
    };
};