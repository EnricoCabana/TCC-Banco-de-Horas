/**
 * DAO da configuração de SMTP. Guarda uma única linha (id_config = 1).
 */
module.exports = class ConfiguracaoSmtpDAO {
    #database;

    constructor(database) {
        console.log("Instanciado ConfiguracaoSmtpDAO");
        this.#database = database;
    }

    buscar = async () => {
        console.log("[ConfiguracaoSmtpDAO.buscar]");
        const [rows] = await this.#database.execute(
            "SELECT * FROM configuracao_smtp ORDER BY id_config LIMIT 1"
        );
        return rows[0] || null;
    };

    salvar = async (dados) => {
        console.log("[ConfiguracaoSmtpDAO.salvar]");
        await this.#database.execute(`
            INSERT INTO configuracao_smtp
                (id_config, host, porta, seguranca, usuario, senha, remetente_nome, remetente_email, ativo)
            VALUES (1, ?, ?, ?, ?, ?, ?, ?, ?)
            ON DUPLICATE KEY UPDATE
                host            = VALUES(host),
                porta           = VALUES(porta),
                seguranca       = VALUES(seguranca),
                usuario         = VALUES(usuario),
                senha           = VALUES(senha),
                remetente_nome  = VALUES(remetente_nome),
                remetente_email = VALUES(remetente_email),
                ativo           = VALUES(ativo)
        `, [
            dados.host, dados.porta, dados.seguranca, dados.usuario, dados.senha,
            dados.remetente_nome, dados.remetente_email, dados.ativo,
        ]);
    };
};