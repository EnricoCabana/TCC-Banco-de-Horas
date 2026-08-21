module.exports = class FichaEmailController {
    #fichaEmailService;

    constructor(fichaEmailService) {
        console.log("Instanciado FichaEmailController");
        this.#fichaEmailService = fichaEmailService;
    }

    enviar = async (request, response, next) => {
        console.log("[FichaEmailController.enviar]");
        try {
            response.json(await this.#fichaEmailService.enviarFichas(request.body, request.usuario));
        } catch (error) {
            next(error);
        }
    };

    /* Download do PDF da ficha de um funcionário (admin ou o próprio). */
    baixar = async (request, response, next) => {
        console.log("[FichaEmailController.baixar]");
        try {
            const id = request.query.usuario || request.usuario.id_usuario;
            const admin = Boolean(request.usuario?.administrador);
            if (!admin && Number(id) !== Number(request.usuario?.id_usuario)) {
                return response.status(403).json({ message: "Sem permissão para esta ficha." });
            }
            const { filename, buffer } = await this.#fichaEmailService.gerarPdfUsuario(id, request.query.mes, request.query.ano);
            response.setHeader("Content-Type", "application/pdf");
            response.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
            response.send(buffer);
        } catch (error) {
            next(error);
        }
    };
};