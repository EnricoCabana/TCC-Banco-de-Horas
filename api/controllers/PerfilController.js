module.exports = class PerfilController {
    #perfilService;

    constructor(perfilService) {
        console.log("Instanciado PerfilController");
        this.#perfilService = perfilService;
    }

    buscar = async (request, response, next) => {
        console.log("[PerfilController.buscar]");
        try {
            response.json(await this.#perfilService.buscar(request.usuario));
        } catch (error) {
            next(error);
        }
    };

    atualizar = async (request, response, next) => {
        console.log("[PerfilController.atualizar]");
        try {
            response.json(await this.#perfilService.atualizar(request.usuario, request.body));
        } catch (error) {
            next(error);
        }
    };
};