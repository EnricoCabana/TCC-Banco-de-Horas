/**
 * DAO do Fechamento de Folha.
 *   • relatorioMestre  → consolidado do mês (todos os funcionários).
 *   • statusFechamento → o mês está fechado?
 *   • fecharMes        → fecha o mês em lote (cria os registros + trava).
 *   • reabrirMes       → reabre o mês (apaga os registros + destrava).
 *
 * O "lock" é a existência de registros em fechamentos_mensais. O trigger
 * tr_ponto_bu bloqueia edições enquanto esse registro existir.
 */
module.exports = class FechamentoDAO {
    #database;

    constructor(database) {
        console.log("Instanciado FechamentoDAO");
        this.#database = database;
    }

    /* Consolidado mensal de todos os funcionários ativos. */
    relatorioMestre = async (mes, ano) => {
        console.log("[FechamentoDAO.relatorioMestre]");
        const [linhas] = await this.#database.execute(`
            SELECT
                u.id_usuario,
                u.matricula,
                u.nome,
                COALESCE(u.cargo, '—') AS cargo,
                COALESCE(s.nome_setor, '—') AS nome_setor,
                COALESCE(SUM(p.total_dia_minutos), 0) AS total_min,
                COALESCE(SUM(p.saldo_dia_minutos), 0) AS saldo_min,
                COUNT(p.id_ponto) AS dias_lancados,
                COALESCE((
                    SELECT SUM(pa.saldo_dia_minutos) FROM ponto pa WHERE pa.id_usuario = u.id_usuario
                ), 0) AS saldo_acumulado_min
            FROM usuarios u
            LEFT JOIN setores s ON s.id_setor = u.id_setor
            LEFT JOIN ponto p
                ON p.id_usuario = u.id_usuario
               AND MONTH(p.data_ref) = ?
               AND YEAR(p.data_ref) = ?
            WHERE u.ativo = TRUE
              AND u.isento_ponto = 0
            GROUP BY u.id_usuario
            ORDER BY u.nome ASC
        `, [mes, ano]);
        return linhas;
    };

    /* O mês está fechado? (existe ao menos um registro de fechamento) */
    statusFechamento = async (mes, ano) => {
        console.log("[FechamentoDAO.statusFechamento]");
        const [[fech]] = await this.#database.execute(`
            SELECT COUNT(*) AS qtd, MAX(data_fechamento) AS data_fechamento
            FROM fechamentos_mensais
            WHERE mes_ref = ? AND ano_ref = ?
        `, [mes, ano]);

        const [[ativos]] = await this.#database.execute(
            "SELECT COUNT(*) AS total FROM usuarios WHERE ativo = TRUE"
        );

        return {
            fechado: Number(fech.qtd) > 0,
            qtd: Number(fech.qtd) || 0,
            total_ativos: Number(ativos.total) || 0,
            data_fechamento: fech.data_fechamento || null,
        };
    };

    /* Fecha o mês em lote. Retorna quantos funcionários foram fechados. */
    fecharMes = async (mes, ano) => {
        console.log("[FechamentoDAO.fecharMes]");
        const conn = await this.#database.getConnection();
        try {
            await conn.beginTransaction();

            // 1) Marca os pontos do mês como fechados (ANTES de criar o lock,
            //    senão o próprio trigger bloquearia este UPDATE).
            await conn.execute(
                "UPDATE ponto SET fechado = TRUE WHERE MONTH(data_ref) = ? AND YEAR(data_ref) = ?",
                [mes, ano]
            );

            // 2) Cria o registro de fechamento de cada funcionário ativo.
            const [usuarios] = await conn.execute(
                "SELECT id_usuario FROM usuarios WHERE ativo = TRUE AND isento_ponto = 0"
            );

            for (const u of usuarios) {
                const [[soma]] = await conn.execute(`
                    SELECT COALESCE(SUM(saldo_dia_minutos), 0) AS saldo
                    FROM ponto
                    WHERE id_usuario = ? AND MONTH(data_ref) = ? AND YEAR(data_ref) = ?
                `, [u.id_usuario, mes, ano]);
                const saldoMes = Number(soma.saldo) || 0;

                const [[prev]] = await conn.execute(`
                    SELECT saldo_acumulado_minutos AS acc
                    FROM fechamentos_mensais
                    WHERE id_usuario = ? AND NOT (mes_ref = ? AND ano_ref = ?)
                    ORDER BY ano_ref DESC, mes_ref DESC
                    LIMIT 1
                `, [u.id_usuario, mes, ano]);
                const acumulado = (Number(prev?.acc) || 0) + saldoMes;

                await conn.execute(`
                    INSERT INTO fechamentos_mensais
                        (id_usuario, mes_ref, ano_ref, saldo_mes_minutos, saldo_acumulado_minutos)
                    VALUES (?, ?, ?, ?, ?)
                    ON DUPLICATE KEY UPDATE
                        saldo_mes_minutos       = VALUES(saldo_mes_minutos),
                        saldo_acumulado_minutos = VALUES(saldo_acumulado_minutos)
                `, [u.id_usuario, mes, ano, saldoMes, acumulado]);
            }

            await conn.commit();
            return usuarios.length;
        } catch (error) {
            await conn.rollback();
            throw error;
        } finally {
            conn.release();
        }
    };

    /* Reabre o mês. Retorna quantos registros de fechamento foram removidos. */
    reabrirMes = async (mes, ano) => {
        console.log("[FechamentoDAO.reabrirMes]");
        const conn = await this.#database.getConnection();
        try {
            await conn.beginTransaction();

            // 1) Remove os locks (libera o trigger).
            const [del] = await conn.execute(
                "DELETE FROM fechamentos_mensais WHERE mes_ref = ? AND ano_ref = ?",
                [mes, ano]
            );

            // 2) Desmarca os pontos (agora permitido).
            await conn.execute(
                "UPDATE ponto SET fechado = FALSE WHERE MONTH(data_ref) = ? AND YEAR(data_ref) = ?",
                [mes, ano]
            );

            await conn.commit();
            return del.affectedRows || 0;
        } catch (error) {
            await conn.rollback();
            throw error;
        } finally {
            conn.release();
        }
    };
};