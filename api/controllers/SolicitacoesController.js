module.exports = class SolicitacoesController {
    #solicitacoesService;

    constructor(solicitacoesService) {
        console.log("Instanciado SolicitacoesController");
        this.#solicitacoesService = solicitacoesService;
    }

    listar = async (request, response, next) => {
        console.log("[SolicitacoesController.listar]");
        try {
            const solicitacoes = await this.#solicitacoesService.listar(request.query, request.usuario);
            response.json(solicitacoes);
        } catch (error) {
            next(error);
        }
    };

    criar = async (request, response, next) => {
        console.log("[SolicitacoesController.criar]");
        try {
            const resultado = await this.#solicitacoesService.criar(request.body, request.usuario);
            response.status(201).json(resultado);
        } catch (error) {
            next(error);
        }
    };

    aprovar = async (request, response, next) => {
        console.log("[SolicitacoesController.aprovar]");
        try {
            const resultado = await this.#solicitacoesService.responder(
                request.params.id, "Aprovado", request.usuario
            );
            response.json(resultado);
        } catch (error) {
            next(error);
        }
    };

    negar = async (request, response, next) => {
        console.log("[SolicitacoesController.negar]");
        try {
            const resultado = await this.#solicitacoesService.responder(
                request.params.id, "Negado", request.usuario
            );
            response.json(resultado);
        } catch (error) {
            next(error);
        }
    };
};