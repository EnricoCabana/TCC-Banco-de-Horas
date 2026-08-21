/**
 * SetorDAO — acesso à tabela `setores`.
 * Setor é referenciado por usuarios.id_setor (relação 1:N).
 */
module.exports = class SetorDAO {
    #database;

    constructor(database) {
        console.log("Instanciado SetorDAO");
        this.#database = database;
    }

    /** Todos os setores (ativos e inativos) — usado na tela de gestão. */
    listarTodos = async () => {
        console.log("[SetorDAO.listarTodos]");
        const [linhas] = await this.#database.execute(`
            SELECT id_setor, nome_setor, ativo
            FROM setores
            ORDER BY ativo DESC, nome_setor ASC
        `);
        return linhas;
    };

    /** Só os setores ativos — usado nos dropdowns (cadastro de funcionário). */
    listarAtivos = async () => {
        console.log("[SetorDAO.listarAtivos]");
        const [linhas] = await this.#database.execute(`
            SELECT id_setor, nome_setor
            FROM setores
            WHERE ativo = TRUE
            ORDER BY nome_setor ASC
        `);
        return linhas;
    };

    buscarPorId = async (id) => {
        console.log("[SetorDAO.buscarPorId]");
        const [linhas] = await this.#database.execute(
            "SELECT id_setor, nome_setor, ativo FROM setores WHERE id_setor = ?",
            [id]
        );
        return linhas[0] || null;
    };

    /** Já existe um setor com este nome? (ignora maiúsculas/minúsculas) */
    existeNome = async (nome, exceptId = null) => {
        console.log("[SetorDAO.existeNome]");
        let sql = "SELECT id_setor FROM setores WHERE LOWER(nome_setor) = LOWER(?)";
        const params = [nome];
        if (exceptId) {
            sql += " AND id_setor <> ?";
            params.push(exceptId);
        }
        const [linhas] = await this.#database.execute(sql, params);
        return linhas.length > 0;
    };

    criar = async (nome) => {
        console.log("[SetorDAO.criar]");
        const [result] = await this.#database.execute(
            "INSERT INTO setores (nome_setor, ativo) VALUES (?, TRUE)",
            [nome]
        );
        return result.insertId;
    };

    editar = async (id, nome) => {
        console.log("[SetorDAO.editar]");
        const [result] = await this.#database.execute(
            "UPDATE setores SET nome_setor = ? WHERE id_setor = ?",
            [nome, id]
        );
        return result.affectedRows > 0;
    };

    definirAtivo = async (id, ativo) => {
        console.log("[SetorDAO.definirAtivo]");
        const [result] = await this.#database.execute(
            "UPDATE setores SET ativo = ? WHERE id_setor = ?",
            [ativo ? 1 : 0, id]
        );
        return result.affectedRows > 0;
    };

    /** Quantos funcionários estão neste setor (para exibir e avisar antes de inativar). */
    contarFuncionarios = async (id) => {
        console.log("[SetorDAO.contarFuncionarios]");
        const [linhas] = await this.#database.execute(
            "SELECT COUNT(*) AS total FROM usuarios WHERE id_setor = ?",
            [id]
        );
        return linhas[0]?.total || 0;
    };

    /** Funcionários do setor, com cargo — usado ao expandir o setor na tela. */
    funcionariosDoSetor = async (id) => {
        console.log("[SetorDAO.funcionariosDoSetor]");
        const [linhas] = await this.#database.execute(`
            SELECT id_usuario, nome, matricula, cargo, ativo
            FROM usuarios
            WHERE id_setor = ?
            ORDER BY nome ASC
        `, [id]);
        return linhas;
    };
};