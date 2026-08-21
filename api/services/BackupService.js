const { spawn } = require("child_process");
const crypto = require("crypto");
const AdmZip = require("adm-zip");
const ErrorResponse = require("../utils/ErrorResponse");

/* Nome do arquivo de verificação dentro do .zip. */
const NOME_ARQUIVO_HASH = "integridade.sha256";

/**
 * Geração de backup do banco de dados via mysqldump.
 *
 * - O caminho do mysqldump fica no .env (configurável):
 *     MYSQLDUMP_PATH  → "mysqldump" (Linux/servidor) ou o caminho completo no Windows
 * - As credenciais do banco também vêm do .env (as mesmas já usadas pelo sistema).
 *
 * A senha do banco é passada por variável de ambiente (MYSQL_PWD), e NÃO na linha
 * de comando — assim ela não fica visível na lista de processos.
 *
 * VERIFICAÇÃO DE INTEGRIDADE
 * O download vem como .zip com dois arquivos:
 *   - <nome>.sql          → o dump do banco
 *   - integridade.sha256  → a "impressão digital" (hash SHA-256) desse dump
 * Na restauração, o sistema recalcula o hash do .sql e compara com o que está
 * no .sha256. Se não bater, o arquivo foi corrompido ou alterado e a restauração
 * é recusada — o banco não chega a ser tocado.
 *
 * Obs.: hash é irreversível (não dá para "voltar" ao conteúdo a partir dele);
 * ele serve para DETECTAR alteração, não para esconder o conteúdo.
 */
module.exports = class BackupService {
    #auditoriaService;

    constructor(auditoriaService) {
        console.log("Instanciado BackupService");
        this.#auditoriaService = auditoriaService;
    }

    /* Gera o .zip (dump + hash de integridade) para download no navegador. */
    baixar = async (usuarioLogado) => {
        console.log("[BackupService.baixar]");
        const dump = await this.#executarDump();          // { filename, conteudo }
        const hash = this.#gerarHash(dump.conteudo);

        /* O .sha256 segue o formato usado pelo utilitário sha256sum:
           "<hash>  <nome do arquivo>" — assim dá para conferir por fora também. */
        const zip = new AdmZip();
        zip.addFile(dump.filename, dump.conteudo);
        zip.addFile(NOME_ARQUIVO_HASH, Buffer.from(`${hash}  ${dump.filename}\n`, "utf-8"));

        await this.#auditoriaService?.registrar({
            acao: "CRIAR",
            entidade: "Backup",
            descricao: "Gerou um backup do banco (download .zip com verificação de integridade)",
            executor: usuarioLogado,
        });

        return {
            filename: dump.filename.replace(/\.sql$/, ".zip"),
            conteudo: zip.toBuffer(),
        };
    };

    /* Restaura o banco. Aceita o .zip gerado pelo sistema (com verificação de
       integridade) ou um .sql solto (backups antigos, sem verificação). */
    restaurar = async (arquivo, usuarioLogado) => {
        console.log("[BackupService.restaurar]");
        const buffer = Buffer.isBuffer(arquivo) ? arquivo : Buffer.from(String(arquivo || ""), "utf-8");

        if (!buffer.length) {
            throw new ErrorResponse(400, "Envie um arquivo de backup (.zip ou .sql).",
                { message: "Envie um arquivo de backup (.zip ou .sql)." });
        }

        const ehZip = this.#pareceZip(buffer);
        const { sql, verificado } = ehZip
            ? this.#lerZipVerificando(buffer)
            : { sql: buffer.toString("utf-8"), verificado: false };

        const conteudo = String(sql || "").trim();
        if (!conteudo) {
            throw new ErrorResponse(400, "O backup está vazio.",
                { message: "O backup está vazio." });
        }
        if (!/(CREATE TABLE|INSERT INTO|DROP TABLE|USE\s|SET\s)/i.test(conteudo)) {
            throw new ErrorResponse(400, "O arquivo não parece ser um backup SQL válido.",
                { message: "O arquivo não parece ser um backup SQL válido." });
        }

        await this.#executarRestore(conteudo);

        await this.#auditoriaService?.registrar({
            acao: "EDITAR",
            entidade: "Backup",
            descricao: verificado
                ? "Restaurou o banco a partir de um .zip com integridade verificada (SHA-256)"
                : "Restaurou o banco a partir de um .sql solto (sem verificação de integridade)",
            executor: usuarioLogado,
        });

        return {
            message: verificado
                ? "Integridade verificada (SHA-256) e backup restaurado com sucesso! Recarregue o sistema para ver os dados."
                : "Backup restaurado com sucesso! (arquivo .sql solto, sem verificação de integridade) Recarregue o sistema para ver os dados.",
            integridadeVerificada: verificado,
        };
    };

    /* ------------------------------------------------------------------ */
    /* Integridade: gera e confere o SHA-256 do dump.                     */
    /* ------------------------------------------------------------------ */

    #gerarHash = (conteudo) => crypto.createHash("sha256").update(conteudo).digest("hex");

    /* Todo arquivo .zip começa com a assinatura "PK" (0x50 0x4B). */
    #pareceZip = (buffer) => buffer.length > 1 && buffer[0] === 0x50 && buffer[1] === 0x4b;

    /* Abre o .zip, confere o hash do .sql contra o .sha256 e devolve o SQL. */
    #lerZipVerificando = (buffer) => {
        let entradas;
        try {
            entradas = new AdmZip(buffer).getEntries();
        } catch (e) {
            throw new ErrorResponse(400, "Não foi possível abrir o arquivo .zip.",
                { message: "Não foi possível abrir o arquivo .zip." });
        }

        const entradaSql  = entradas.find(e => !e.isDirectory && e.entryName.toLowerCase().endsWith(".sql"));
        const entradaHash = entradas.find(e => !e.isDirectory && e.entryName.toLowerCase().endsWith(".sha256"));

        if (!entradaSql) {
            throw new ErrorResponse(400, "O .zip não contém nenhum arquivo .sql.",
                { message: "O .zip não contém nenhum arquivo .sql." });
        }
        if (!entradaHash) {
            throw new ErrorResponse(400,
                `O .zip não contém o arquivo de integridade (${NOME_ARQUIVO_HASH}).`,
                { message: `O .zip não contém o arquivo de integridade (${NOME_ARQUIVO_HASH}).` });
        }

        const conteudoSql = entradaSql.getData();
        /* O .sha256 guarda "<hash>  <nome>"; interessa só a 1ª palavra. */
        const hashEsperado = entradaHash.getData().toString("utf-8").trim().split(/\s+/)[0].toLowerCase();
        const hashReal     = this.#gerarHash(conteudoSql);

        if (hashEsperado !== hashReal) {
            throw new ErrorResponse(400,
                "Falha na verificação de integridade: o backup foi alterado ou está corrompido. A restauração foi cancelada.",
                { message: "Falha na verificação de integridade: o backup foi alterado ou está corrompido. A restauração foi cancelada." });
        }

        return { sql: conteudoSql.toString("utf-8"), verificado: true };
    };

    /* ------------------------------------------------------------------ */
    /* Motor: roda o mysqldump e devolve o .sql como Buffer.              */
    /* ------------------------------------------------------------------ */
    #executarRestore = (sql) => {
        return new Promise((resolve, reject) => {
            const dumpPath = String(process.env.MYSQLDUMP_PATH || "mysqldump").trim();
            let mysqlPath = String(process.env.MYSQL_PATH || "").trim();
            if (!mysqlPath) {
                mysqlPath = dumpPath.replace(/mysqldump(\.exe)?$/i, (m, ext) => "mysql" + (ext || ""));
                if (mysqlPath === dumpPath) mysqlPath = "mysql";
            }
            const host = process.env.DB_HOST || "localhost";
            const port = String(process.env.DB_PORT || "3306");
            const user = process.env.DB_USER || "root";
            const pass = process.env.DB_PASS || "";
            const dbName = process.env.DB_NAME || "";

            if (!dbName) {
                return reject(new ErrorResponse(500, "DB_NAME não está configurado no .env.",
                    { message: "DB_NAME não está configurado no .env." }));
            }

            const args = ["-h", host, "-P", port, "-u", user, dbName];
            const env = { ...process.env, MYSQL_PWD: pass };

            let child;
            try {
                child = spawn(mysqlPath, args, { env });
            } catch (e) {
                return reject(this.#erroRestore(e));
            }

            const erros = [];
            child.stderr.on("data", (parte) => erros.push(parte.toString()));
            child.on("error", (e) => reject(this.#erroRestore(e)));
            child.on("close", (code) => {
                if (code !== 0) {
                    const msg = erros.join("").trim() || `mysql terminou com o código ${code}.`;
                    return reject(new ErrorResponse(500, `Falha ao restaurar o backup: ${msg}`,
                        { message: `Falha ao restaurar o backup: ${msg}` }));
                }
                resolve();
            });

            child.stdin.on("error", () => { /* ignora EPIPE se o processo fechar antes */ });
            child.stdin.write(sql);
            child.stdin.end();
        });
    };

    #erroRestore = (e) => {
        if (e && e.code === "ENOENT") {
            return new ErrorResponse(500,
                "Cliente 'mysql' não encontrado. Configure MYSQL_PATH no .env (mesma pasta do mysqldump).",
                { message: "Cliente 'mysql' não encontrado. Configure MYSQL_PATH no .env." });
        }
        return new ErrorResponse(500, `Erro ao restaurar: ${e.message}`,
            { message: `Erro ao restaurar: ${e.message}` });
    };

    #executarDump = () => {
        return new Promise((resolve, reject) => {
            const dumpPath = String(process.env.MYSQLDUMP_PATH || "mysqldump").trim();
            const host = process.env.DB_HOST || "localhost";
            const port = String(process.env.DB_PORT || "3306");
            const user = process.env.DB_USER || "root";
            const pass = process.env.DB_PASS || "";
            const dbName = process.env.DB_NAME || "";

            if (!dbName) {
                return reject(new ErrorResponse(500,
                    "DB_NAME não está configurado no .env.",
                    { message: "DB_NAME não está configurado no .env." }));
            }

            const args = [
                "-h", host,
                "-P", port,
                "-u", user,
                "--single-transaction",  // dump consistente sem travar o banco
                "--no-tablespaces",      // evita erro de permissão no MySQL novo
                "--routines",            // inclui procedures/functions, se houver
                dbName,
            ];

            // Senha via variável de ambiente (não vai na linha de comando).
            const env = { ...process.env, MYSQL_PWD: pass };

            let child;
            try {
                child = spawn(dumpPath, args, { env });
            } catch (e) {
                return reject(this.#erroDump(e));
            }

            const partes = [];
            const erros = [];

            child.stdout.on("data", (parte) => partes.push(parte));
            child.stderr.on("data", (parte) => erros.push(parte.toString()));

            child.on("error", (e) => reject(this.#erroDump(e)));

            child.on("close", (code) => {
                if (code !== 0) {
                    const msg = erros.join("").trim() || `mysqldump terminou com o código ${code}.`;
                    return reject(new ErrorResponse(500,
                        `Falha ao gerar o backup: ${msg}`,
                        { message: `Falha ao gerar o backup: ${msg}` }));
                }
                const conteudo = Buffer.concat(partes);
                if (!conteudo.length) {
                    return reject(new ErrorResponse(500,
                        "O backup saiu vazio. Verifique as credenciais do banco no .env.",
                        { message: "O backup saiu vazio. Verifique as credenciais do banco no .env." }));
                }
                resolve({ filename: `cronasys-backup-${this.#timestamp()}.sql`, conteudo });
            });
        });
    };

    #erroDump = (e) => {
        if (e && e.code === "ENOENT") {
            return new ErrorResponse(500,
                "mysqldump não foi encontrado. Ajuste o MYSQLDUMP_PATH no .env.",
                { message: "mysqldump não foi encontrado. Ajuste o MYSQLDUMP_PATH no .env." });
        }
        return new ErrorResponse(500,
            `Falha ao gerar o backup: ${e?.message || e}`,
            { message: `Falha ao gerar o backup: ${e?.message || e}` });
    };

    #timestamp = () => {
        const d = new Date();
        const p = (n) => String(n).padStart(2, "0");
        return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}`;
    };
};