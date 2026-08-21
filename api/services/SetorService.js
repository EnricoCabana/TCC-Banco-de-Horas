const ErrorResponse = require("../utils/ErrorResponse");

/**
 * SetorService — regras de negócio do CRUD de setores.
 */
module.exports = class SetorService {
    #setorDAO;
    #auditoriaService;

    constructor(setorDAO, auditoriaService) {
        console.log("Instanciado SetorService");
        this.#setorDAO = setorDAO;
        this.#auditoriaService = auditoriaService;
    }

    /** Lista todos os setores com a quantidade de funcionários de cada um. */
    listar = async () => {
        console.log("[SetorService.listar]");
        const setores = await this.#setorDAO.listarTodos();
        return Promise.all(setores.map(async (s) => ({
            id_setor: s.id_setor,
            nome_setor: s.nome_setor,
            ativo: !!s.ativo,
            qtd_funcionarios: await this.#setorDAO.contarFuncionarios(s.id_setor),
        })));
    };

    listarAtivos = async () => {
        console.log("[SetorService.listarAtivos]");
        return this.#setorDAO.listarAtivos();
    };

    criar = async (body, usuario) => {
        console.log("[SetorService.criar]");
        const nome = this.#validarNome(body?.nome_setor);

        if (await this.#setorDAO.existeNome(nome)) {
            throw new ErrorResponse(409, "Já existe um setor com esse nome.", {
                message: "Já existe um setor com esse nome.",
            });
        }

        const id = await this.#setorDAO.criar(nome);

        await this.#auditoriaService?.registrar({
            acao: "CRIAR",
            entidade: "Setor",
            entidade_id: id,
            descricao: `Criou o setor "${nome}"`,
            executor: usuario,
        });

        return { message: "Setor criado!", id_setor: id };
    };

    editar = async (id, body, usuario) => {
        console.log("[SetorService.editar]");
        const nome = this.#validarNome(body?.nome_setor);

        const setor = await this.#setorDAO.buscarPorId(id);
        if (!setor) {
            throw new ErrorResponse(404, "Setor não encontrado.", { message: "Setor não encontrado." });
        }
        if (await this.#setorDAO.existeNome(nome, id)) {
            throw new ErrorResponse(409, "Já existe um setor com esse nome.", {
                message: "Já existe um setor com esse nome.",
            });
        }

        await this.#setorDAO.editar(id, nome);

        await this.#auditoriaService?.registrar({
            acao: "EDITAR",
            entidade: "Setor",
            entidade_id: id,
            descricao: `Renomeou o setor "${setor.nome_setor}" para "${nome}"`,
            executor: usuario,
        });

        return { message: "Setor atualizado!" };
    };

    definirAtivo = async (id, ativo, usuario) => {
        console.log("[SetorService.definirAtivo]");
        const setor = await this.#setorDAO.buscarPorId(id);
        if (!setor) {
            throw new ErrorResponse(404, "Setor não encontrado.", { message: "Setor não encontrado." });
        }

        await this.#setorDAO.definirAtivo(id, ativo);

        await this.#auditoriaService?.registrar({
            acao: "EDITAR",
            entidade: "Setor",
            entidade_id: id,
            descricao: `${ativo ? "Reativou" : "Inativou"} o setor "${setor.nome_setor}"`,
            executor: usuario,
        });

        return { message: ativo ? "Setor reativado!" : "Setor inativado!" };
    };

    /** Lista os funcionários de um setor (com cargo) — para o painel que expande na tela. */
    funcionariosDoSetor = async (id) => {
        console.log("[SetorService.funcionariosDoSetor]");
        const setor = await this.#setorDAO.buscarPorId(id);
        if (!setor) {
            throw new ErrorResponse(404, "Setor não encontrado.", { message: "Setor não encontrado." });
        }
        const funcs = await this.#setorDAO.funcionariosDoSetor(id);
        return funcs.map(f => ({
            id_usuario: f.id_usuario,
            nome: f.nome,
            matricula: f.matricula,
            cargo: f.cargo || null,
            ativo: !!f.ativo,
        }));
    };

    #validarNome(valor) {
        const nome = String(valor || "").trim();
        if (!nome) {
            throw new ErrorResponse(400, "Informe o nome do setor.", { message: "Informe o nome do setor." });
        }
        if (nome.length > 50) {
            throw new ErrorResponse(400, "O nome do setor deve ter até 50 caracteres.", {
                message: "O nome do setor deve ter até 50 caracteres.",
            });
        }
        return nome;
    }
};