module.exports = class EmailController {
    #emailService;

    constructor(emailService) {
        console.log("Instanciado EmailController");
        this.#emailService = emailService;
    }

    obterConfig = async (request, response, next) => {
        console.log("[EmailController.obterConfig]");
        try {
            response.json(await this.#emailService.obterConfig());
        } catch (error) {
            next(error);
        }
    };

    salvarConfig = async (request, response, next) => {
        console.log("[EmailController.salvarConfig]");
        try {
            response.json(await this.#emailService.salvarConfig(request.body, request.usuario));
        } catch (error) {
            next(error);
        }
    };

    enviarTeste = async (request, response, next) => {
        console.log("[EmailController.enviarTeste]");
        try {
            response.json(await this.#emailService.enviarTeste(request.body?.destino));
        } catch (error) {
            next(error);
        }
    };
};