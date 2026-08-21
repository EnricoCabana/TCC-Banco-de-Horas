const Ocorrencia = require("../models/Ocorrencia");

/**
 * DAO do Ponto.
 *
 * A partir do Item 1 ele NÃO calcula mais nada: recebe do PontoService as
 * linhas já com meta/total/saldo prontos e apenas grava. A leitura continua
 * trazendo os valores guardados.
 */
module.exports = class PontoDAO {
    #database;

    constructor(database) {
        console.log("Instanciado PontoDAO");
        this.#database = database;
    }

    carregar = async (id, mes, ano) => {
        console.log("[PontoDAO.carregar]");
        const [linhas] = await this.#database.execute(`
            SELECT
                DAY(p.data_ref) AS dia,
                p.meta_do_dia AS meta_minutos,
                TIME_FORMAT(p.ent1, '%H:%i') AS ent1,
                TIME_FORMAT(p.sai1, '%H:%i') AS sai1,
                TIME_FORMAT(p.ent2, '%H:%i') AS ent2,
                TIME_FORMAT(p.sai2, '%H:%i') AS sai2,
                p.total_dia_minutos,
                p.saldo_dia_minutos,
                p.id_ocorrencia,
                oc.descricao AS ocorrencia_descricao
            FROM ponto p
            LEFT JOIN tipos_ocorrencia oc ON oc.id_ocorrencia = p.id_ocorrencia
            WHERE
                p.id_usuario = ?
                AND MONTH(p.data_ref) = ?
                AND YEAR(p.data_ref) = ?
            ORDER BY p.data_ref ASC
        `, [id, mes, ano]);

        return linhas;
    };

    /** Soma meta/total/saldo de um mês (em minutos) e conta os dias lançados. */
    resumoMes = async (idUsuario, mes, ano) => {
        console.log("[PontoDAO.resumoMes]");
        const [rows] = await this.#database.execute(`
            SELECT
                COALESCE(SUM(meta_do_dia), 0)       AS metaMin,
                COALESCE(SUM(total_dia_minutos), 0) AS totalMin,
                COALESCE(SUM(saldo_dia_minutos), 0) AS saldoMin,
                COUNT(*)                            AS dias
            FROM ponto
            WHERE id_usuario = ? AND MONTH(data_ref) = ? AND YEAR(data_ref) = ?
        `, [idUsuario, mes, ano]);
        return rows[0] || { metaMin: 0, totalMin: 0, saldoMin: 0, dias: 0 };
    };

    /** Saldo acumulado (banco de horas total) de todos os lançamentos do funcionário. */
    saldoAcumulado = async (idUsuario) => {
        console.log("[PontoDAO.saldoAcumulado]");
        const [rows] = await this.#database.execute(
            "SELECT COALESCE(SUM(saldo_dia_minutos), 0) AS saldoMin FROM ponto WHERE id_usuario = ?",
            [idUsuario]
        );
        return Number(rows[0]?.saldoMin || 0);
    };

    /**
     * Lista o resumo de TODOS os meses que o funcionário tem lançamentos.
     * Um registro por mês, do mais recente para o mais antigo.
     * @returns {Promise<Array<{ano:number, mes:number, metaMin:number, totalMin:number, saldoMin:number, dias:number}>>}
     */
    saldosPorMes = async (idUsuario) => {
        console.log("[PontoDAO.saldosPorMes]");
        const [rows] = await this.#database.execute(`
            SELECT
                YEAR(data_ref)                      AS ano,
                MONTH(data_ref)                     AS mes,
                COALESCE(SUM(meta_do_dia), 0)       AS metaMin,
                COALESCE(SUM(total_dia_minutos), 0) AS totalMin,
                COALESCE(SUM(saldo_dia_minutos), 0) AS saldoMin,
                COUNT(*)                            AS dias
            FROM ponto
            WHERE id_usuario = ?
            GROUP BY YEAR(data_ref), MONTH(data_ref)
            ORDER BY ano DESC, mes DESC
        `, [idUsuario]);

        return rows.map(r => ({
            ano:      Number(r.ano),
            mes:      Number(r.mes),
            metaMin:  Number(r.metaMin),
            totalMin: Number(r.totalMin),
            saldoMin: Number(r.saldoMin),
            dias:     Number(r.dias),
        }));
    };

    /**
     * Saldo acumulado (banco de horas total) de TODOS os funcionários de uma vez.
     * Usado pelo RH para mostrar o Saldo Total ao lado do mensal em telas de equipe.
     * @returns {Promise<Object<string, number>>} mapa { idUsuario: saldoMinTotal }
     */
    saldosAcumuladosPorUsuario = async () => {
        console.log("[PontoDAO.saldosAcumuladosPorUsuario]");
        const [rows] = await this.#database.execute(`
            SELECT p.id_usuario, COALESCE(SUM(p.saldo_dia_minutos), 0) AS saldoMin
            FROM ponto p
            JOIN usuarios u ON u.id_usuario = p.id_usuario
            WHERE u.isento_ponto = 0
            GROUP BY p.id_usuario
        `);

        const mapa = {};
        for (const r of rows) mapa[r.id_usuario] = Number(r.saldoMin || 0);
        return mapa;
    };

    /**
     * Grava as linhas já calculadas pelo PontoService dentro de uma transação.
     * @param {number} idUsuario
     * @param {Array<Object>} linhas - cada uma com:
     *   { dataRef, ocorrencia, ent1, sai1, ent2, sai2, metaDoDia, total, saldo }
     * @returns {Promise<number>} quantidade de dias gravados.
     */
    salvarFicha = async (idUsuario, linhas) => {
        console.log("[PontoDAO.salvarFicha]");
        const conn = await this.#database.getConnection();

        try {
            await conn.beginTransaction();

            for (const linha of linhas) {
                const ocorrencia = await this.#resolverOcorrencia(conn, linha.ocorrencia);

                await conn.execute(`
                    INSERT INTO ponto
                        (id_usuario, data_ref, ent1, sai1, ent2, sai2,
                         id_ocorrencia, meta_do_dia,
                         total_dia_minutos, saldo_dia_minutos)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                    ON DUPLICATE KEY UPDATE
                        ent1              = VALUES(ent1),
                        sai1              = VALUES(sai1),
                        ent2              = VALUES(ent2),
                        sai2              = VALUES(sai2),
                        id_ocorrencia     = VALUES(id_ocorrencia),
                        meta_do_dia       = VALUES(meta_do_dia),
                        total_dia_minutos = VALUES(total_dia_minutos),
                        saldo_dia_minutos = VALUES(saldo_dia_minutos),
                        editado_pelo_rh   = TRUE
                `, [
                    idUsuario,
                    linha.dataRef,
                    this.#toTime(linha.ent1),
                    this.#toTime(linha.sai1),
                    this.#toTime(linha.ent2),
                    this.#toTime(linha.sai2),
                    ocorrencia.id,
                    linha.metaDoDia,
                    linha.total,
                    linha.saldo,
                ]);
            }

            await conn.commit();
            return linhas.length;
        } catch (error) {
            await conn.rollback();
            throw error;
        } finally {
            conn.release();
        }
    };

    /**
     * Garante que a ocorrência existe na tabela tipos_ocorrencia e devolve seu id.
     */
    #resolverOcorrencia = async (conn, descricao) => {
        const ocorrenciaBanco = Ocorrencia.normalizarEntrada(descricao);
        const config = Ocorrencia.obterConfig(ocorrenciaBanco);

        if (!config) {
            const erro = new Error(`Tipo de ocorrência inválido: ${descricao}`);
            erro.statusCode = 400;
            throw erro;
        }

        await conn.execute(`
            INSERT INTO tipos_ocorrencia (descricao, cor_hex, abona_meta)
            VALUES (?, ?, ?)
            ON DUPLICATE KEY UPDATE
                cor_hex = VALUES(cor_hex),
                abona_meta = VALUES(abona_meta)
        `, [ocorrenciaBanco, config.cor, config.abona ? 1 : 0]);

        const [rows] = await conn.execute(
            "SELECT id_ocorrencia FROM tipos_ocorrencia WHERE descricao = ? LIMIT 1",
            [ocorrenciaBanco]
        );

        if (rows.length === 0) {
            throw new Error(`Ocorrência não encontrada: ${ocorrenciaBanco}`);
        }

        return { id: rows[0].id_ocorrencia, descricao: ocorrenciaBanco };
    };

    #toTime(valor) {
        return typeof valor === "string" && valor.includes(":") && valor !== "--:--"
            ? `${valor}:00`
            : null;
    }
};