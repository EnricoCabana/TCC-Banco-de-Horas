const bcrypt = require("bcrypt");
const ErrorResponse = require("../utils/ErrorResponse");
const Usuario = require("../models/Usuario");
const Escala = require("../models/Escala");
const MeuTokenJWT = require("../http/MeuTokenJWT");

const MAX_TENTATIVAS = 5;      // falhas até bloquear
const BLOQUEIO_MIN = 10;       // minutos de bloqueio
const RESET_EXPIRA_MIN = 15;   // validade do código de redefinição

/**
 * Camada de regra de negócio da autenticação.
 *
 * Observação: a comparação de senha ainda é em texto puro. A criptografia
 * (bcrypt) e o token JWT entram na fase de Segurança, conforme combinado.
 */
module.exports = class AuthService {
    #usuarioDAO;
    #emailService;
    #tentativas = new Map();   // e-mail -> { count, lockUntil }

    constructor(usuarioDAO, emailService) {
        console.log("Instanciado AuthService");
        this.#usuarioDAO = usuarioDAO;
        this.#emailService = emailService;
    }

    login = async (body) => {
        console.log("[AuthService.login]");
        const dados = body?.funcionario || body || {};
        const email = dados.email?.trim().toLowerCase();
        const senha = dados.senha;

        if (!email || !senha) {
            throw new ErrorResponse(400, "E-mail e senha são obrigatórios.", {
                erro: "E-mail e senha são obrigatórios.",
            });
        }

        this.#checarBloqueio(email);

        const usuario = await this.#usuarioDAO.findByEmail(email);

        if (!usuario) {
            this.#registrarFalha(email);
            throw new ErrorResponse(401, "Usuário ou senha inválidos.", {
                erro: "Usuário ou senha inválidos.",
            });
        }

        if (!usuario.ativo) {
            throw new ErrorResponse(403, "Conta inativa. Procure um administrador.", {
                erro: "Conta inativa. Procure um administrador.",
            });
        }

        const senhaValida = await this.#verificarSenha(senha, usuario);
        if (!senhaValida) {
            this.#registrarFalha(email);
            throw new ErrorResponse(401, "Usuário ou senha inválidos.", {
                erro: "Usuário ou senha inválidos.",
            });
        }

        this.#tentativas.delete(email);

        const escala = Escala.aPartirDaLinha(usuario);

        // Geração do token JWT (modelo MeuTokenJWT)
        const tokenJWT = new MeuTokenJWT();
        const token = tokenJWT.gerarToken({
            email: usuario.email,
            role: usuario.tipo_acesso,
            name: usuario.nome,
            idUsuario: usuario.id_usuario,
        });

        return {
            mensagem: "Login realizado com sucesso!",
            token,
            usuario: {
                id: usuario.id_usuario,
                nome: usuario.nome,
                email: usuario.email,
                cargo: usuario.cargo,
                tipo: usuario.tipo_acesso,
                tipo_acesso: usuario.tipo_acesso,
                // carga_horaria/carga_sab_horaria mantidas por compatibilidade
                // (usam a segunda-feira e o sábado como referência).
                carga_horaria: this.#minParaHora(usuario.meta_seg ?? 480),
                carga_sab_horaria: this.#minParaHora(usuario.meta_sab ?? 0),
                escala: escala.paraHoras(),
                foto_perfil: usuario.foto_perfil || null,
                administrador: Usuario.ehAdministrador(usuario),
                isento_ponto: !!usuario.isento_ponto,
            },
        };
    };

    /**
     * Confirma a senha de um usuário pelo id (para liberar ações sensíveis,
     * como marcar/desmarcar "isento de ponto"). Retorna true/false.
     */
    confirmarSenha = async (idUsuario, senha) => {
        console.log("[AuthService.confirmarSenha]");
        if (!senha) return false;
        const usuario = await this.#usuarioDAO.buscarSenhaPorId(idUsuario);
        if (!usuario || !usuario.senha) return false;
        return this.#verificarSenha(senha, usuario);
    };

    /**
     * Confere a senha. Se a senha salva ainda estiver em texto puro (dado
     * legado), compara direto e, se bater, migra para hash bcrypt.
     */
    #verificarSenha = async (senhaInformada, usuario) => {
        const armazenada = usuario.senha || "";
        const ehHash = /^\$2[aby]\$/.test(armazenada);

        if (ehHash) {
            return bcrypt.compare(senhaInformada, armazenada);
        }
        if (senhaInformada === armazenada) {
            try {
                const novoHash = await bcrypt.hash(senhaInformada, 12);
                await this.#usuarioDAO.atualizarSenhaHash(usuario.id_usuario, novoHash);
            } catch (e) { /* não bloqueia o login se a migração falhar */ }
            return true;
        }
        return false;
    };

    /* ---- Proteção contra força bruta ---- */
    #checarBloqueio = (email) => {
        const reg = this.#tentativas.get(email);
        if (reg && reg.lockUntil > Date.now()) {
            const min = Math.ceil((reg.lockUntil - Date.now()) / 60000);
            throw new ErrorResponse(429, `Muitas tentativas. Tente novamente em ${min} min.`, {
                erro: `Muitas tentativas. Tente novamente em ${min} min.`,
            });
        }
    };

    #registrarFalha = (email) => {
        const reg = this.#tentativas.get(email) || { count: 0, lockUntil: 0 };
        reg.count += 1;
        if (reg.count >= MAX_TENTATIVAS) {
            reg.lockUntil = Date.now() + BLOQUEIO_MIN * 60000;
            reg.count = 0;
        }
        this.#tentativas.set(email, reg);
    };

    #gerarCodigo = () => String(Math.floor(100000 + Math.random() * 900000));

    /* ---- Recuperação de senha ("esqueci minha senha") ---- */
    solicitarRedefinicao = async (email) => {
        console.log("[AuthService.solicitarRedefinicao]");
        const alvo = String(email || "").trim().toLowerCase();
        const generico = { message: "Se o e-mail estiver cadastrado, enviaremos um código de redefinição." };
        if (!alvo) return generico;

        const usuario = await this.#usuarioDAO.buscarResetPorEmail(alvo);
        if (!usuario || !usuario.ativo) return generico;   // não revela se o e-mail existe

        const codigo = this.#gerarCodigo();
        const expira = new Date(Date.now() + RESET_EXPIRA_MIN * 60000);
        await this.#usuarioDAO.salvarCodigoReset(usuario.id_usuario, codigo, expira);

        await this.#emailService.enviar({
            para: usuario.email,
            assunto: "Redefinição de senha — CronaSys",
            texto: `Ola, ${usuario.nome}! Seu codigo para redefinir a senha e: ${codigo}. Vale por ${RESET_EXPIRA_MIN} minutos.`,
            html: `<p>Olá, <strong>${usuario.nome}</strong>!</p>
                   <p>Seu código para redefinir a senha é:</p>
                   <p style="font-size:22px;font-weight:700;letter-spacing:4px;">${codigo}</p>
                   <p>Ele vale por ${RESET_EXPIRA_MIN} minutos. Se você não solicitou, ignore este e-mail.</p>`,
        });

        return generico;
    };

    redefinirSenha = async (email, codigo, novaSenha) => {
        console.log("[AuthService.redefinirSenha]");
        const alvo = String(email || "").trim().toLowerCase();
        const cod = String(codigo || "").trim();
        const senha = String(novaSenha || "");

        if (!alvo || !cod) {
            throw new ErrorResponse(400, "Informe o e-mail e o código.", { erro: "Informe o e-mail e o código." });
        }
        if (senha.length < 8) {
            throw new ErrorResponse(400, "A nova senha deve ter pelo menos 8 caracteres.", { erro: "A nova senha deve ter pelo menos 8 caracteres." });
        }

        const usuario = await this.#usuarioDAO.buscarResetPorEmail(alvo);
        const valido = usuario && usuario.reset_codigo && usuario.reset_codigo === cod
            && usuario.reset_expira && new Date(usuario.reset_expira).getTime() > Date.now();

        if (!valido) {
            throw new ErrorResponse(400, "Código inválido ou expirado.", { erro: "Código inválido ou expirado." });
        }

        const hash = await bcrypt.hash(senha, 12);
        await this.#usuarioDAO.atualizarSenhaHash(usuario.id_usuario, hash);
        await this.#usuarioDAO.limparCodigoReset(usuario.id_usuario);
        this.#tentativas.delete(alvo);

        return { message: "Senha redefinida! Você já pode entrar com a nova senha." };
    };

    #minParaHora(min) {
        const minutos = Math.max(0, min || 0);
        return `${String(Math.floor(minutos / 60)).padStart(2, "0")}:${String(minutos % 60).padStart(2, "0")}`;
    }
};