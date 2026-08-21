/**
 * DAO dos e-mails de destino do backup.
 */
module.exports = class BackupEmailDAO {
    #database;

    constructor(database) {
        console.log("Instanciado BackupEmailDAO");
        this.#database = database;
    }

    listar = async () => {
        console.log("[BackupEmailDAO.listar]");
        const [linhas] = await this.#database.execute(
            "SELECT id_backup_email, email FROM backup_emails ORDER BY email"
        );
        return linhas;
    };

    /* Só os endereços, para o envio do backup. */
    listarEmails = async () => {
        console.log("[BackupEmailDAO.listarEmails]");
        const [linhas] = await this.#database.execute(
            "SELECT email FROM backup_emails ORDER BY email"
        );
        return linhas.map((l) => l.email);
    };

    existe = async (email, exceptId = null) => {
        console.log("[BackupEmailDAO.existe]");
        let sql = "SELECT id_backup_email FROM backup_emails WHERE LOWER(email) = LOWER(?)";
        const params = [email];
        if (exceptId) {
            sql += " AND id_backup_email <> ?";
            params.push(exceptId);
        }
        sql += " LIMIT 1";
        const [linhas] = await this.#database.execute(sql, params);
        return linhas.length > 0;
    };

    criar = async (email) => {
        console.log("[BackupEmailDAO.criar]");
        const [result] = await this.#database.execute(
            "INSERT INTO backup_emails (email) VALUES (?)",
            [email]
        );
        return result.insertId;
    };

    editar = async (id, email) => {
        console.log("[BackupEmailDAO.editar]");
        const [result] = await this.#database.execute(
            "UPDATE backup_emails SET email = ? WHERE id_backup_email = ?",
            [email, id]
        );
        return result.affectedRows > 0;
    };

    excluir = async (id) => {
        console.log("[BackupEmailDAO.excluir]");
        const [result] = await this.#database.execute(
            "DELETE FROM backup_emails WHERE id_backup_email = ?",
            [id]
        );
        return result.affectedRows > 0;
    };
};