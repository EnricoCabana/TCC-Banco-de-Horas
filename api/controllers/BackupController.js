/**
 * Controller de Backup — somente administradores (rota protegida no Router).
 */
module.exports = class BackupController {
    #backupService;

    constructor(backupService) {
        console.log("Instanciado BackupController");
        this.#backupService = backupService;
    }

    /* Gera o backup e devolve o arquivo .sql para download. */
    baixar = async (request, response, next) => {
        console.log("[BackupController.baixar]");
        try {
            const { filename, conteudo } = await this.#backupService.baixar(request.usuario);
            response.setHeader("Content-Type", "application/zip");
            response.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
            response.send(conteudo);
        } catch (error) {
            next(error);
        }
    };

    /* Gera o backup e envia por e-mail para o destino do .env. */
    /* Restaura o banco a partir de um arquivo .sql enviado (texto no corpo). */
    importar = async (request, response, next) => {
        console.log("[BackupController.importar]");
        try {
            const resultado = await this.#backupService.restaurar(request.body, request.usuario);
            response.json(resultado);
        } catch (error) {
            next(error);
        }
    };
};