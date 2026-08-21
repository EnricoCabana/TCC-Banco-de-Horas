/**
 * DAO responsável pelos feriados (tabela `feriados`).
 *
 * O cálculo de ponto usa este DAO para descobrir quais dias do mês são
 * feriado. Em um feriado, a meta do dia vira 0 automaticamente para todos.
 */
module.exports = class FeriadoDAO {
    #database;

    constructor(database) {
        console.log("Instanciado FeriadoDAO");
        this.#database = database;
    }

    /**
     * Retorna um conjunto (Set) com as datas de feriado de um mês,
     * no formato "YYYY-MM-DD". Usar Set deixa a verificação instantânea.
     * @param {number} mes - 1 a 12
     * @param {number} ano - ex.: 2026
     * @returns {Promise<Set<string>>}
     */
    conjuntoDeDatas = async (mes, ano) => {
        console.log("[FeriadoDAO.conjuntoDeDatas]");
        const [linhas] = await this.#database.execute(`
            SELECT DATE_FORMAT(data_feriado, '%Y-%m-%d') AS data
            FROM feriados
            WHERE MONTH(data_feriado) = ? AND YEAR(data_feriado) = ?
        `, [mes, ano]);

        return new Set(linhas.map(linha => linha.data));
    };

    /**
     * Lista todos os feriados de um ano (para a tela de gestão de feriados).
     * @param {number} ano
     * @returns {Promise<Array<{data: string, descricao: string}>>}
     */
    listarPorAno = async (ano) => {
        console.log("[FeriadoDAO.listarPorAno]");
        const [linhas] = await this.#database.execute(`
            SELECT DATE_FORMAT(data_feriado, '%Y-%m-%d') AS data, descricao, tipo
            FROM feriados
            WHERE YEAR(data_feriado) = ?
            ORDER BY data_feriado ASC
        `, [ano]);

        return linhas;
    };

    /**
     * Cadastra (ou atualiza a descrição de) um feriado.
     * @param {string} data - "YYYY-MM-DD"
     * @param {string} descricao
     */
    salvar = async (data, descricao, tipo = "NACIONAL") => {
        console.log("[FeriadoDAO.salvar]");
        await this.#database.execute(`
            INSERT INTO feriados (data_feriado, descricao, tipo)
            VALUES (?, ?, ?)
            ON DUPLICATE KEY UPDATE
                descricao = VALUES(descricao),
                tipo      = VALUES(tipo)
        `, [data, descricao, tipo]);
    };

    /**
     * Remove um feriado.
     * @param {string} data - "YYYY-MM-DD"
     * @returns {Promise<boolean>} true se removeu.
     */
    excluir = async (data) => {
        console.log("[FeriadoDAO.excluir]");
        const [resultado] = await this.#database.execute(
            "DELETE FROM feriados WHERE data_feriado = ?",
            [data]
        );
        return resultado.affectedRows > 0;
    };
};