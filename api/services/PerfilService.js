const ErrorResponse = require("../utils/ErrorResponse");

const FOTO_MAX = 2000000; // ~2MB em caracteres (data URL)

/**
 * Autoatendimento de perfil: o próprio usuário (RH ou padrão) vê e edita
 * SOMENTE os seus dados pessoais. Matrícula, cargo, setor e escala continuam
 * sob responsabilidade do RH (tela de Funcionários).
 *
 * O id alvo vem SEMPRE do usuário logado (request.usuario), nunca do corpo —
 * assim ninguém edita o perfil de outra pessoa.
 */
module.exports = class PerfilService {
    #usuarioDAO;
    #auditoriaService;

    constructor(usuarioDAO, auditoriaService) {
        console.log("Instanciado PerfilService");
        this.#usuarioDAO = usuarioDAO;
        this.#auditoriaService = auditoriaService;
    }

    buscar = async (usuarioLogado) => {
        console.log("[PerfilService.buscar]");
        const id = usuarioLogado?.id_usuario;
        const u = await this.#usuarioDAO.buscarPerfil(id);
        if (!u) {
            throw new ErrorResponse(404, "Perfil não encontrado.", { message: "Perfil não encontrado." });
        }
        return {
            id_usuario: u.id_usuario,
            nome: u.nome,
            cargo: u.cargo,
            nome_setor: u.nome_setor || "",
            matricula: u.matricula,
            email: u.email,
            celular: u.celular || "",
            data_aniversario: u.data_aniversario
                ? u.data_aniversario.toISOString().split("T")[0]
                : "",
            foto_perfil: u.foto_perfil || "",
            tipo_acesso: u.tipo_acesso,
        };
    };

    atualizar = async (usuarioLogado, body) => {
        console.log("[PerfilService.atualizar]");
        const id = usuarioLogado?.id_usuario;
        if (!id) {
            throw new ErrorResponse(401, "Faça login para continuar.", { message: "Faça login para continuar." });
        }

        const nome = String(body?.nome || "").trim();
        if (!nome) {
            throw new ErrorResponse(400, "O nome é obrigatório.", { message: "O nome é obrigatório." });
        }

        const email = String(body?.email || "").trim().toLowerCase();
        if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
            throw new ErrorResponse(400, "E-mail inválido.", { message: "E-mail inválido." });
        }

        const dados = {
            nome,
            email,
            celular: String(body?.celular || "").replace(/\D/g, "").slice(0, 15),
            data_aniversario: body?.data_aniversario || null,
        };

        // Celular: valida o formato se preenchido (DDD + 9 dígitos, começando com 9).
        if (dados.celular && !(dados.celular.length === 11 && dados.celular[0] !== "0" && dados.celular[2] === "9")) {
            throw new ErrorResponse(400, "Celular inválido.", { message: "Celular inválido. Use (DD) 9XXXX-XXXX." });
        }

        // Foto: data URL de imagem, '' (remover) ou ausente (não mexe).
        if (body?.foto_perfil !== undefined) {
            const foto = String(body.foto_perfil || "");
            if (foto && !foto.startsWith("data:image/")) {
                throw new ErrorResponse(400, "Formato de imagem inválido.", { message: "Formato de imagem inválido." });
            }
            if (foto.length > FOTO_MAX) {
                throw new ErrorResponse(400, "A imagem é muito grande. Tente uma menor.", { message: "A imagem é muito grande." });
            }
            dados.foto_perfil = foto;
        }

        // Senha é opcional (vazio = mantém a atual).
        if (body?.senha && String(body.senha).trim()) {
            const senha = String(body.senha).trim();
            if (senha.length < 8) {
                throw new ErrorResponse(400, "A nova senha deve ter pelo menos 8 caracteres.", { message: "A nova senha deve ter pelo menos 8 caracteres." });
            }
            dados.senha = senha;
        }

        await this.#usuarioDAO.atualizarPerfil(id, dados);

        await this.#auditoriaService?.registrar({
            acao: "EDITAR",
            entidade: "Perfil",
            entidade_id: String(id),
            descricao: "Atualizou o próprio perfil",
            executor: usuarioLogado,
        });

        return {
            message: "Perfil atualizado com sucesso!",
            nome,
            foto_perfil: dados.foto_perfil,
        };
    };
};