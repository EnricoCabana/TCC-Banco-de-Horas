/**
 * SetorController — endpoints do CRUD de setores.
 */
module.exports = class SetorController {
    #setorService;

    constructor(setorService) {
        console.log("Instanciado SetorController");
        this.#setorService = setorService;
    }

    listar = async (request, response, next) => {
        console.log("[SetorController.listar]");
        try {
            response.json(await this.#setorService.listar());
        } catch (error) {
            next(error);
        }
    };

    criar = async (request, response, next) => {
        console.log("[SetorController.criar]");
        try {
            response.status(201).json(await this.#setorService.criar(request.body, request.usuario));
        } catch (error) {
            next(error);
        }
    };

    editar = async (request, response, next) => {
        console.log("[SetorController.editar]");
        try {
            response.json(await this.#setorService.editar(request.params.id, request.body, request.usuario));
        } catch (error) {
            next(error);
        }
    };

    definirAtivo = async (request, response, next) => {
        console.log("[SetorController.definirAtivo]");
        try {
            response.json(await this.#setorService.definirAtivo(
                request.params.id,
                request.body?.ativo === true,
                request.usuario
            ));
        } catch (error) {
            next(error);
        }
    };

    funcionarios = async (request, response, next) => {
        console.log("[SetorController.funcionarios]");
        try {
            response.json(await this.#setorService.funcionariosDoSetor(request.params.id));
        } catch (error) {
            next(error);
        }
    };
};