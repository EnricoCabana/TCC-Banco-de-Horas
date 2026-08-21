const bcrypt = require("bcrypt");
const ErrorResponse = require("../utils/ErrorResponse");
const Escala = require("../models/Escala");

/**
 * DAO de usuários.
 *
 * Atualizado no Item 1: a antiga dupla de colunas (meta_dia_minutos /
 * meta_sab_minutos) foi substituída por uma meta por dia da semana
 * (meta_dom ... meta_sab). Tudo continua em UMA única tabela `usuarios`,
 * mantendo o banco simples.
 */
const COLUNAS_META = ["meta_dom", "meta_seg", "meta_ter", "meta_qua", "meta_qui", "meta_sex", "meta_sab"];

module.exports = class UsuarioDAO {
    #database;

    constructor(database) {
        console.log("Instanciado UsuarioDAO");
        this.#database = database;
    }

    findByEmail = async (email) => {
        console.log("[UsuarioDAO.findByEmail]");
        const [usuarios] = await this.#database.execute(`
            SELECT id_usuario, nome, cargo, email, senha, tipo_acesso, ativo, isento_ponto, foto_perfil,
                   ${COLUNAS_META.join(", ")}
            FROM usuarios
            WHERE email = ?
            LIMIT 1
        `, [email]);

        return usuarios[0] || null;
    };

    findAtivoById = async (idUsuario) => {
        console.log("[UsuarioDAO.findAtivoById]");
        const [rows] = await this.#database.execute(`
            SELECT id_usuario, nome, cargo, email, tipo_acesso, ativo, isento_ponto
            FROM usuarios
            WHERE id_usuario = ?
            LIMIT 1
        `, [idUsuario]);

        return rows[0] || null;
    };

    /**
     * Busca a escala (metas por dia da semana) de um funcionário e devolve
     * um objeto de domínio Escala, pronto para o cálculo do ponto.
     * @param {number} idUsuario
     * @returns {Promise<Escala>}
     */
    buscarEscala = async (idUsuario) => {
        console.log("[UsuarioDAO.buscarEscala]");
        const [rows] = await this.#database.execute(`
            SELECT ${COLUNAS_META.join(", ")}
            FROM usuarios
            WHERE id_usuario = ?
            LIMIT 1
        `, [idUsuario]);

        if (!rows[0]) {
            throw new ErrorResponse(404, "Funcionário não encontrado.", {
                message: "Funcionário não encontrado.",
            });
        }

        return Escala.aPartirDaLinha(rows[0]);
    };

    /* Dados de perfil do próprio usuário (autoatendimento). */
    buscarPerfil = async (id) => {
        console.log("[UsuarioDAO.buscarPerfil]");
        const [rows] = await this.#database.execute(`
            SELECT u.id_usuario, u.nome, u.cargo, u.matricula, u.email, u.celular,
                   u.data_aniversario, u.foto_perfil, u.tipo_acesso, s.nome_setor
            FROM usuarios u
            LEFT JOIN setores s ON u.id_setor = s.id_setor
            WHERE u.id_usuario = ?
            LIMIT 1
        `, [id]);
        return rows[0] || null;
    };

    /* Atualiza SOMENTE campos de perfil do próprio usuário. */
    atualizarPerfil = async (id, dados) => {
        console.log("[UsuarioDAO.atualizarPerfil]");
        if (dados.email) {
            const [dup] = await this.#database.execute(
                "SELECT id_usuario FROM usuarios WHERE email = ? AND id_usuario <> ? LIMIT 1",
                [dados.email, id]
            );
            if (dup.length > 0) {
                throw new ErrorResponse(409, "Este e-mail já está em uso por outro usuário.", {
                    message: "Este e-mail já está em uso por outro usuário.",
                });
            }
        }

        const campos = [];
        const valores = [];
        if (dados.nome !== undefined) { campos.push("nome = ?"); valores.push(dados.nome); }
        if (dados.email !== undefined) { campos.push("email = ?"); valores.push(dados.email); }
        if (dados.celular !== undefined) { campos.push("celular = ?"); valores.push(dados.celular || null); }
        if (dados.data_aniversario !== undefined) { campos.push("data_aniversario = ?"); valores.push(dados.data_aniversario || null); }
        if (dados.foto_perfil !== undefined) { campos.push("foto_perfil = ?"); valores.push(dados.foto_perfil || null); }
        if (dados.senha) { campos.push("senha = ?"); valores.push(await bcrypt.hash(dados.senha, 12)); }

        if (campos.length === 0) return;
        valores.push(id);
        await this.#database.execute(
            `UPDATE usuarios SET ${campos.join(", ")} WHERE id_usuario = ?`,
            valores
        );
    };

    /** Atualiza apenas o hash da senha (usado na migração de senha legada no login). */
    atualizarSenhaHash = async (id, hash) => {
        console.log("[UsuarioDAO.atualizarSenhaHash]");
        await this.#database.execute(
            "UPDATE usuarios SET senha = ? WHERE id_usuario = ?",
            [hash, id]
        );
    };

    /* ---- Recuperação de senha ("esqueci minha senha") ---- */
    salvarCodigoReset = async (id, codigo, expira) => {
        console.log("[UsuarioDAO.salvarCodigoReset]");
        await this.#database.execute(
            "UPDATE usuarios SET reset_codigo = ?, reset_expira = ? WHERE id_usuario = ?",
            [codigo, expira, id]
        );
    };

    buscarResetPorEmail = async (email) => {
        console.log("[UsuarioDAO.buscarResetPorEmail]");
        const [linhas] = await this.#database.execute(
            "SELECT id_usuario, nome, email, ativo, reset_codigo, reset_expira FROM usuarios WHERE email = ? LIMIT 1",
            [email]
        );
        return linhas[0] || null;
    };

    limparCodigoReset = async (id) => {
        console.log("[UsuarioDAO.limparCodigoReset]");
        await this.#database.execute(
            "UPDATE usuarios SET reset_codigo = NULL, reset_expira = NULL WHERE id_usuario = ?",
            [id]
        );
    };

    /** Hash da senha de um usuário (usado para confirmar a senha em ações sensíveis). */
    buscarSenhaPorId = async (id) => {
        console.log("[UsuarioDAO.buscarSenhaPorId]");
        const [rows] = await this.#database.execute(
            "SELECT id_usuario, senha FROM usuarios WHERE id_usuario = ? LIMIT 1",
            [id]
        );
        return rows[0] || null;
    };

    /** Liga/desliga a marca "isento de ponto" de um funcionário. */
    definirIsentoPonto = async (id, isento) => {
        console.log("[UsuarioDAO.definirIsentoPonto]");
        const [result] = await this.#database.execute(
            "UPDATE usuarios SET isento_ponto = ? WHERE id_usuario = ?",
            [isento ? 1 : 0, id]
        );
        return result.affectedRows > 0;
    };

    listarSetores = async () => {
        console.log("[UsuarioDAO.listarSetores]");
        const [setores] = await this.#database.execute(
            "SELECT id_setor, nome_setor FROM setores WHERE ativo = TRUE ORDER BY nome_setor"
        );

        return setores;
    };

    listar = async () => {
        console.log("[UsuarioDAO.listar]");
        const [rows] = await this.#database.execute(`
            SELECT
                u.id_usuario,
                u.matricula,
                u.nome,
                u.cargo,
                u.email,
                u.id_setor,
                s.nome_setor,
                ${COLUNAS_META.map(c => "u." + c).join(", ")},
                u.tipo_acesso,
                u.ativo,
                u.isento_ponto,
                u.foto_perfil
            FROM usuarios u
            LEFT JOIN setores s ON u.id_setor = s.id_setor
            ORDER BY u.nome ASC
        `);

        return rows;
    };

    buscarPorId = async (id) => {
        console.log("[UsuarioDAO.buscarPorId]");
        const [rows] = await this.#database.execute(`
            SELECT
                u.id_usuario,
                u.nome,
                u.cargo,
                u.matricula,
                u.email,
                u.id_setor,
                s.nome_setor,
                u.tipo_acesso,
                u.ativo,
                u.isento_ponto,
                u.foto_perfil,
                ${COLUNAS_META.map(c => "u." + c).join(", ")},
                u.data_aniversario,
                u.celular,
                u.contato_emergencia_nome,
                u.contato_emergencia_tel,
                d.cpf,
                d.rg,
                d.cartao_sus,
                d.carteira_trabalho,
                e.rua,
                e.num,
                e.bairro,
                e.cidade,
                e.cep
            FROM usuarios u
            LEFT JOIN setores    s ON u.id_setor   = s.id_setor
            LEFT JOIN documentos d ON d.id_usuario = u.id_usuario
            LEFT JOIN enderecos  e ON e.id_usuario = u.id_usuario
            WHERE u.id_usuario = ?
            LIMIT 1
        `, [id]);

        return rows[0] || null;
    };

    cadastrar = async (dados) => {
        console.log("[UsuarioDAO.cadastrar]");
        const conn = await this.#database.getConnection();
        const metas = dados.metas || {};
        dados.senha = await bcrypt.hash(dados.senha, 12);

        try {
            await conn.beginTransaction();

            const [dup] = await conn.execute(
                "SELECT id_usuario FROM usuarios WHERE matricula = ? OR email = ? LIMIT 1",
                [dados.matricula, dados.email]
            );

            if (dup.length > 0) {
                throw new ErrorResponse(409, "Matricula ou e-mail ja cadastrado.", {
                    message: "Matrícula ou e-mail já cadastrado.",
                });
            }

            const [dupCpf] = await conn.execute(
                "SELECT id_usuario FROM documentos WHERE cpf = ? LIMIT 1",
                [dados.cpfLimpo]
            );

            if (dupCpf.length > 0) {
                throw new ErrorResponse(409, "CPF ja cadastrado.", {
                    message: "CPF já cadastrado.",
                });
            }

            const [resUsuario] = await conn.execute(`
                INSERT INTO usuarios
                    (nome, cargo, matricula, email, senha, id_setor,
                     tipo_acesso, ativo, isento_ponto,
                     meta_dom, meta_seg, meta_ter, meta_qua, meta_qui, meta_sex, meta_sab,
                     data_aniversario, celular,
                     contato_emergencia_nome, contato_emergencia_tel)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `, [
                dados.nome.trim(),
                dados.cargo?.trim() || null,
                dados.matricula.trim(),
                dados.email.trim().toLowerCase(),
                dados.senha,
                dados.id_setor,
                dados.tipo_acesso || "PADRAO",
                dados.status_conta === "inativo" ? 0 : 1,
                dados.isento_ponto ? 1 : 0,
                metas.dom ?? 0,
                metas.seg ?? 480,
                metas.ter ?? 480,
                metas.qua ?? 480,
                metas.qui ?? 480,
                metas.sex ?? 480,
                metas.sab ?? 0,
                dados.data_aniversario || null,
                this.#normalizarTelefone(dados.celular),
                dados.contato_emergencia_nome?.trim() || null,
                this.#normalizarTelefone(dados.contato_emergencia_tel),
            ]);

            const novoId = resUsuario.insertId;

            await conn.execute(`
                INSERT INTO documentos (id_usuario, cpf, rg, cartao_sus, carteira_trabalho)
                VALUES (?, ?, ?, ?, ?)
            `, [
                novoId,
                dados.cpfLimpo,
                dados.rg?.replace(/\D/g, "") || null,
                dados.cartao_sus?.replace(/\D/g, "") || null,
                dados.carteira_trabalho?.trim() || null,
            ]);

            await conn.execute(`
                INSERT INTO enderecos (id_usuario, rua, num, bairro, cidade, cep)
                VALUES (?, ?, ?, ?, ?, ?)
            `, [
                novoId,
                dados.rua?.trim() || null,
                dados.num?.trim() || null,
                dados.bairro?.trim() || null,
                dados.cidade?.trim() || null,
                dados.cep?.replace(/\D/g, "") || null,
            ]);

            await conn.commit();
            return novoId;
        } catch (error) {
            await conn.rollback();
            throw error;
        } finally {
            conn.release();
        }
    };

    atualizar = async (id, dados) => {
        console.log("[UsuarioDAO.atualizar]");
        const conn = await this.#database.getConnection();
        const metas = dados.metas || null;

        try {
            await conn.beginTransaction();

            const [existe] = await conn.execute(
                "SELECT id_usuario FROM usuarios WHERE id_usuario = ?",
                [id]
            );

            if (existe.length === 0) {
                throw new ErrorResponse(404, "Funcionario nao encontrado.", {
                    message: "Funcionário não encontrado.",
                });
            }

            if (dados.matricula?.trim() || dados.email?.trim()) {
                const [duplicado] = await conn.execute(`
                    SELECT id_usuario
                    FROM usuarios
                    WHERE id_usuario <> ?
                      AND (matricula = ? OR email = ?)
                    LIMIT 1
                `, [
                    id,
                    dados.matricula?.trim() || "",
                    dados.email?.trim().toLowerCase() || "",
                ]);

                if (duplicado.length > 0) {
                    throw new ErrorResponse(409, "Matricula ou e-mail ja cadastrado para outro funcionario.", {
                        message: "Matricula ou e-mail ja cadastrado para outro funcionario.",
                    });
                }
            }

            const campos = [];
            const valores = [];

            if (dados.nome) { campos.push("nome = ?"); valores.push(dados.nome.trim()); }
            if (dados.cargo !== undefined) { campos.push("cargo = ?"); valores.push(dados.cargo?.trim() || null); }
            if (dados.matricula) { campos.push("matricula = ?"); valores.push(dados.matricula.trim()); }
            if (dados.email) { campos.push("email = ?"); valores.push(dados.email.trim().toLowerCase()); }
            if (dados.id_setor) { campos.push("id_setor = ?"); valores.push(dados.id_setor); }
            if (dados.tipo_acesso) { campos.push("tipo_acesso = ?"); valores.push(dados.tipo_acesso); }

            // Atualiza a escala (7 dias) somente quando enviada.
            if (metas) {
                campos.push("meta_dom = ?"); valores.push(metas.dom ?? 0);
                campos.push("meta_seg = ?"); valores.push(metas.seg ?? 480);
                campos.push("meta_ter = ?"); valores.push(metas.ter ?? 480);
                campos.push("meta_qua = ?"); valores.push(metas.qua ?? 480);
                campos.push("meta_qui = ?"); valores.push(metas.qui ?? 480);
                campos.push("meta_sex = ?"); valores.push(metas.sex ?? 480);
                campos.push("meta_sab = ?"); valores.push(metas.sab ?? 0);
            }

            if (dados.status_conta !== undefined) { campos.push("ativo = ?"); valores.push(dados.status_conta === "inativo" ? 0 : 1); }
            if (dados.data_aniversario !== undefined) { campos.push("data_aniversario = ?"); valores.push(dados.data_aniversario || null); }
            if (dados.celular !== undefined) { campos.push("celular = ?"); valores.push(this.#normalizarTelefone(dados.celular)); }
            if (dados.contato_emergencia_nome !== undefined) {
                campos.push("contato_emergencia_nome = ?");
                valores.push(dados.contato_emergencia_nome?.trim() || null);
            }
            if (dados.contato_emergencia_tel !== undefined) {
                campos.push("contato_emergencia_tel = ?");
                valores.push(this.#normalizarTelefone(dados.contato_emergencia_tel));
            }
            if (dados.senha?.trim()) { campos.push("senha = ?"); valores.push(await bcrypt.hash(dados.senha.trim(), 12)); }

            if (campos.length > 0) {
                valores.push(id);
                await conn.execute(
                    `UPDATE usuarios SET ${campos.join(", ")} WHERE id_usuario = ?`,
                    valores
                );
            }

            await this.#salvarDocumentosFuncionario(conn, id, dados);
            await this.#salvarEnderecoFuncionario(conn, id, dados);

            await conn.commit();
        } catch (error) {
            await conn.rollback();
            throw error;
        } finally {
            conn.release();
        }
    };

    excluir = async (id) => {
        console.log("[UsuarioDAO.excluir]");
        const [result] = await this.#database.execute(
            "DELETE FROM usuarios WHERE id_usuario = ?",
            [id]
        );

        return result.affectedRows > 0;
    };

    #salvarDocumentosFuncionario = async (conn, id, dados) => {
        const rgLimpo = dados.rg?.replace(/\D/g, "") || null;
        const cartaoSusLimpo = dados.cartao_sus?.replace(/\D/g, "") || null;
        const carteiraTrabalho = dados.carteira_trabalho?.trim() || null;
        const temAlgumDocumento = Boolean(dados.cpfLimpo || rgLimpo || cartaoSusLimpo || carteiraTrabalho);

        const [existentes] = await conn.execute(
            "SELECT id_usuario, cpf FROM documentos WHERE id_usuario = ? LIMIT 1",
            [id]
        );

        if (existentes.length === 0) {
            if (!temAlgumDocumento) return;

            if (!dados.cpfLimpo) {
                throw new ErrorResponse(400, "Informe o CPF para salvar documentos deste funcionario.", {
                    message: "Informe o CPF para salvar documentos deste funcionario.",
                });
            }

            await this.#garantirCpfDisponivel(conn, dados.cpfLimpo, id);
            await conn.execute(`
                INSERT INTO documentos (id_usuario, cpf, rg, cartao_sus, carteira_trabalho)
                VALUES (?, ?, ?, ?, ?)
            `, [id, dados.cpfLimpo, rgLimpo, cartaoSusLimpo, carteiraTrabalho]);
            return;
        }

        const campos = [];
        const valores = [];

        if (dados.cpfLimpo) {
            await this.#garantirCpfDisponivel(conn, dados.cpfLimpo, id);
            campos.push("cpf = ?");
            valores.push(dados.cpfLimpo);
        }
        if (dados.rg !== undefined) {
            campos.push("rg = ?");
            valores.push(rgLimpo);
        }
        if (dados.cartao_sus !== undefined) {
            campos.push("cartao_sus = ?");
            valores.push(cartaoSusLimpo);
        }
        if (dados.carteira_trabalho !== undefined) {
            campos.push("carteira_trabalho = ?");
            valores.push(carteiraTrabalho);
        }

        if (campos.length === 0) return;

        valores.push(id);
        await conn.execute(
            `UPDATE documentos SET ${campos.join(", ")} WHERE id_usuario = ?`,
            valores
        );
    };

    #salvarEnderecoFuncionario = async (conn, id, dados) => {
        await conn.execute(`
            INSERT INTO enderecos (id_usuario, rua, num, bairro, cidade, cep)
            VALUES (?, ?, ?, ?, ?, ?)
            ON DUPLICATE KEY UPDATE
                rua    = VALUES(rua),
                num    = VALUES(num),
                bairro = VALUES(bairro),
                cidade = VALUES(cidade),
                cep    = VALUES(cep)
        `, [
            id,
            dados.rua?.trim() || null,
            dados.num?.trim() || null,
            dados.bairro?.trim() || null,
            dados.cidade?.trim() || null,
            dados.cep?.replace(/\D/g, "") || null,
        ]);
    };

    #garantirCpfDisponivel = async (conn, cpf, idUsuarioAtual) => {
        const [duplicado] = await conn.execute(
            "SELECT id_usuario FROM documentos WHERE cpf = ? AND id_usuario <> ? LIMIT 1",
            [cpf, idUsuarioAtual]
        );

        if (duplicado.length > 0) {
            throw new ErrorResponse(409, "CPF ja cadastrado para outro funcionario.", {
                message: "CPF ja cadastrado para outro funcionario.",
            });
        }
    };

    #normalizarTelefone(valor) {
        const digitos = valor?.replace(/\D/g, "") || "";
        return digitos ? digitos.slice(0, 15) : null;
    }
};