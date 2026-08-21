const mysql = require("mysql2/promise");

module.exports = class MysqlDatabase {
    static #pool;

    #config;

    constructor(config = {}) {
        this.#config = {
            host: config.host || process.env.DB_HOST || "localhost",
            user: config.user || process.env.DB_USER || "root",
            password: config.password ?? process.env.DB_PASS ?? process.env.DB_PASSWORD ?? "",
            database: config.database || process.env.DB_NAME || "cronasys",
            port: Number(config.port || process.env.DB_PORT || 3306),
            waitForConnections: config.waitForConnections ?? true,
            connectionLimit: Number(config.connectionLimit || 10),
            queueLimit: Number(config.queueLimit || 0),
        };
    }

    connect = async () => {
        if (!MysqlDatabase.#pool) {
            MysqlDatabase.#pool = mysql.createPool(this.#config);
        }

        return MysqlDatabase.#pool;
    };

    testarConexao = async () => {
        const pool = await this.connect();
        await pool.query("SELECT 1 + 1 AS resultado");
    };

    getPool = async () => {
        return this.connect();
    };

    execute = async (sql, params = []) => {
        const pool = await this.getPool();
        return pool.execute(sql, params);
    };

    query = async (sql, params = []) => {
        const pool = await this.getPool();
        return pool.query(sql, params);
    };

    getConnection = async () => {
        const pool = await this.getPool();
        return pool.getConnection();
    };
};