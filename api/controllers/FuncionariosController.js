module.exports = class FuncionariosController {
    #funcionariosService;

    constructor(funcionariosService) {
        console.log("Instanciado FuncionariosController");
        this.#funcionariosService = funcionariosService;
    }

    listarSetores = async (request, response, next) => {
        console.log("[FuncionariosController.listarSetores]");
        try {
            const setores = await this.#funcionariosService.listarSetores();
            response.json(setores);
        } catch (error) {
            next(error);
        }
    };

    listar = async (request, response, next) => {
        console.log("[FuncionariosController.listar]");
        try {
            const funcionarios = await this.#funcionariosService.listar();
            response.json(funcionarios);
        } catch (error) {
            next(error);
        }
    };

    buscarPorId = async (request, response, next) => {
        console.log("[FuncionariosController.buscarPorId]");
        try {
            const funcionario = await this.#funcionariosService.buscarPorId(request.params.id);
            response.json(funcionario);
        } catch (error) {
            next(error);
        }
    };

    definirIsentoPonto = async (request, response, next) => {
        console.log("[FuncionariosController.definirIsentoPonto]");
        try {
            const adminId = request.usuario?.id_usuario;
            const alvoId  = request.params.id;
            const { isento, senha } = request.body || {};
            const resultado = await this.#funcionariosService.definirIsentoPonto(adminId, alvoId, !!isento, senha);
            response.json(resultado);
        } catch (error) {
            next(error);
        }
    };

    cadastrar = async (request, response, next) => {
        console.log("[FuncionariosController.cadastrar]");
        try {
            const novoId = await this.#funcionariosService.cadastrar(request.body, request.usuario);
            response.status(201).json({
                message: "Funcionário cadastrado com sucesso!",
                id_usuario: novoId,
            });
        } catch (error) {
            next(error);
        }
    };

    atualizar = async (request, response, next) => {
        console.log("[FuncionariosController.atualizar]");
        try {
            await this.#funcionariosService.atualizar(
                request.params.id,
                request.body,
                request.usuario
            );

            response.json({ message: "Funcionário atualizado com sucesso!" });
        } catch (error) {
            next(error);
        }
    };

    excluir = async (request, response, next) => {
        console.log("[FuncionariosController.excluir]");
        try {
            await this.#funcionariosService.excluir(request.params.id, request.usuario);
            response.json({ message: "Funcionário excluído com sucesso." });
        } catch (error) {
            next(error);
        }
    };
};