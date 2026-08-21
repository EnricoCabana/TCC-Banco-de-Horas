/**
 * DAO da Trilha de Auditoria.
 *   • inserir → grava um evento.
 *   • listar  → busca eventos com filtros.
 *   • opcoes  → entidades e executores existentes (para os filtros da tela).
 */
module.exports = class AuditoriaDAO {
    #database;

    constructor(database) {
        console.log("Instanciado AuditoriaDAO");
        this.#database = database;
    }

    inserir = async (evento) => {
        console.log("[AuditoriaDAO.inserir]");
        await this.#database.execute(`
            INSERT INTO auditoria
                (acao, entidade, entidade_id, descricao, valor_antigo, valor_novo, executor_id, executor_nome)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `, [
            evento.acao,
            evento.entidade,
            evento.entidade_id ?? null,
            evento.descricao ?? null,
            evento.valor_antigo ?? null,
            evento.valor_novo ?? null,
            evento.executor_id ?? null,
            evento.executor_nome ?? "Sistema",
        ]);
    };

    listar = async (filtros = {}) => {
        console.log("[AuditoriaDAO.listar]");
        const where = [];
        const params = [];

        if (filtros.acao) { where.push("acao = ?"); params.push(filtros.acao); }
        if (filtros.entidade) { where.push("entidade = ?"); params.push(filtros.entidade); }
        if (filtros.executor) { where.push("executor_id = ?"); params.push(filtros.executor); }
        if (filtros.data_de) { where.push("data_registro >= ?"); params.push(`${filtros.data_de} 00:00:00`); }
        if (filtros.data_ate) { where.push("data_registro <= ?"); params.push(`${filtros.data_ate} 23:59:59`); }
        if (filtros.busca) {
            where.push("(descricao LIKE ? OR entidade_id LIKE ? OR executor_nome LIKE ?)");
            const b = `%${filtros.busca}%`;
            params.push(b, b, b);
        }

        const clausula = where.length ? `WHERE ${where.join(" AND ")}` : "";
        const limite = Math.min(Math.max(Number(filtros.limite) || 200, 1), 500);

        const [linhas] = await this.#database.execute(`
            SELECT
                id_auditoria,
                DATE_FORMAT(data_registro, '%Y-%m-%d %H:%i:%s') AS data_registro,
                acao, entidade, entidade_id, descricao,
                valor_antigo, valor_novo, executor_id, executor_nome
            FROM auditoria
            ${clausula}
            ORDER BY data_registro DESC, id_auditoria DESC
            LIMIT ${limite}
        `, params);

        return linhas;
    };

    opcoes = async () => {
        console.log("[AuditoriaDAO.opcoes]");
        const [entidades] = await this.#database.execute(
            "SELECT DISTINCT entidade FROM auditoria ORDER BY entidade"
        );
        const [executores] = await this.#database.execute(
            "SELECT DISTINCT executor_id, executor_nome FROM auditoria WHERE executor_id IS NOT NULL ORDER BY executor_nome"
        );
        return {
            entidades: entidades.map(e => e.entidade),
            executores,
        };
    };
};