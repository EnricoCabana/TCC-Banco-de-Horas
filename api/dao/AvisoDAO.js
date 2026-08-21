module.exports = class AvisoDAO {
    #database;

    constructor(database) {
        console.log("Instanciado AvisoDAO");
        this.#database = database;
    }

    listar = async ({ tipo, periodo, data }) => {
        console.log("[AvisoDAO.listar]");
        let sql = `
            SELECT
                a.id_aviso,
                a.titulo,
                a.mensagem,
                a.tipo,
                DATE_FORMAT(a.data_criacao, '%Y-%m-%d') AS data_criacao_fmt,
                DATE_FORMAT(a.data_criacao, '%H:%i') AS hora_criacao,
                DATE(a.data_criacao) AS data_exibicao,
                u.nome AS autor
            FROM avisos a
            LEFT JOIN usuarios u ON a.id_autor = u.id_usuario
            WHERE 1 = 1
        `;
        const params = [];

        if (tipo && tipo !== "todos") {
            sql += " AND a.tipo = ?";
            params.push(tipo);
        }

        if (data && /^\d{4}-\d{2}-\d{2}$/.test(data)) {
            sql += " AND DATE(a.data_criacao) = ?";
            params.push(data);
        } else {
            switch (periodo) {
                case "hoje":
                    sql += " AND DATE(a.data_criacao) = CURDATE()";
                    break;
                case "ontem":
                    sql += " AND DATE(a.data_criacao) = DATE_SUB(CURDATE(), INTERVAL 1 DAY)";
                    break;
                case "semana":
                    sql += ` AND DATE(a.data_criacao)
                              BETWEEN DATE_SUB(CURDATE(), INTERVAL 6 DAY) AND CURDATE()`;
                    break;
                case "todos":
                    break;
                default:
                    sql += " AND DATE(a.data_criacao) = CURDATE()";
            }
        }

        sql += " ORDER BY a.data_criacao DESC";

        const [avisos] = await this.#database.execute(sql, params);
        return avisos;
    };

    criar = async (aviso) => {
        console.log("[AvisoDAO.criar]");
        const [result] = await this.#database.execute(`
            INSERT INTO avisos (titulo, mensagem, tipo, id_autor)
            VALUES (?, ?, ?, ?)
        `, [aviso.titulo, aviso.mensagem, aviso.tipo, aviso.id_autor]);

        return result.insertId;
    };

    excluir = async (id) => {
        console.log("[AvisoDAO.excluir]");
        const [result] = await this.#database.execute(
            "DELETE FROM avisos WHERE id_aviso = ?", [id]
        );
        return result.affectedRows > 0;
    };
};