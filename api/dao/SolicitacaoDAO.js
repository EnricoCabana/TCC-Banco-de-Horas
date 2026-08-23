const Ocorrencia = require("../models/Ocorrencia");

module.exports = class SolicitacaoDAO {
    #database;

    constructor(database) {
        console.log("Instanciado SolicitacaoDAO");
        this.#database = database;
    }

    /**
     * Lista solicitações, com filtro opcional por status e por usuário
     * (usado para o funcionário ver só as próprias solicitações).
     */
    listar = async ({ status, id_usuario } = {}) => {
        console.log("[SolicitacaoDAO.listar]");
        let sql = `
            SELECT
                s.id_solicitacao,
                s.id_usuario,
                u.nome AS nome_funcionario,
                DATE_FORMAT(s.data_ref, '%Y-%m-%d') AS data_ref,
                oc.descricao AS ocorrencia,
                s.mensagem,
                s.status,
                DATE_FORMAT(s.data_solicitacao, '%Y-%m-%d %H:%i') AS data_solicitacao,
                DATE_FORMAT(s.data_resposta, '%Y-%m-%d %H:%i') AS data_resposta,
                a.nome AS nome_aprovador
            FROM solicitacoes s
            INNER JOIN usuarios u ON s.id_usuario = u.id_usuario
            INNER JOIN tipos_ocorrencia oc ON s.id_ocorrencia = oc.id_ocorrencia
            LEFT JOIN usuarios a ON s.id_aprovador = a.id_usuario
            WHERE 1 = 1
        `;
        const params = [];

        if (status) {
            sql += " AND s.status = ?";
            params.push(status);
        }

        if (id_usuario) {
            sql += " AND s.id_usuario = ?";
            params.push(id_usuario);
        }

        sql += " ORDER BY s.data_solicitacao DESC";

        const [linhas] = await this.#database.execute(sql, params);
        return linhas;
    };

    /** Busca uma solicitação pelo id (usado antes de aprovar/negar). */
    buscarPorId = async (id) => {
        console.log("[SolicitacaoDAO.buscarPorId]");
        const [linhas] = await this.#database.execute(
            "SELECT * FROM solicitacoes WHERE id_solicitacao = ? LIMIT 1",
            [id]
        );
        return linhas[0] || null;
    };

    /** Cria uma solicitação a partir da descrição da ocorrência (resolve o id). */
    criar = async (solicitacao) => {
        console.log("[SolicitacaoDAO.criar]");
        const ocorrenciaBanco = Ocorrencia.normalizarEntrada(solicitacao.ocorrencia);

        const [ocorrenciaRows] = await this.#database.execute(
            "SELECT id_ocorrencia FROM tipos_ocorrencia WHERE descricao = ? LIMIT 1",
            [ocorrenciaBanco]
        );

        if (ocorrenciaRows.length === 0) {
            throw new Error(`Tipo de ocorrência inválido: ${solicitacao.ocorrencia}`);
        }

        const [result] = await this.#database.execute(`
            INSERT INTO solicitacoes (id_usuario, data_ref, id_ocorrencia, mensagem)
            VALUES (?, ?, ?, ?)
        `, [solicitacao.id_usuario, solicitacao.data_ref, ocorrenciaRows[0].id_ocorrencia, solicitacao.mensagem]);

        return result.insertId;
    };

    /** Grava a decisão (Aprovado/Negado) do administrador. */
    responder = async (id, status, idAprovador) => {
        console.log("[SolicitacaoDAO.responder]");
        const [result] = await this.#database.execute(`
            UPDATE solicitacoes
            SET status = ?, id_aprovador = ?, data_resposta = NOW()
            WHERE id_solicitacao = ? AND status = 'Pendente'
        `, [status, idAprovador, id]);

        return result.affectedRows > 0;
    };
};