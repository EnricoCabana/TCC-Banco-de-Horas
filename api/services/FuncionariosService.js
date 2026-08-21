const ErrorResponse = require("../utils/ErrorResponse");
const Escala = require("../models/Escala");

/**
 * Camada de regra de negócio dos funcionários.
 *
 * Atualizado no Item 1: lida com a escala flexível (7 metas por dia).
 * Continua aceitando o formato antigo (carga_horaria / carga_sab_horaria)
 * para não quebrar a tela de cadastro atual: nesse caso, segunda a sexta
 * recebem a carga_horaria e o sábado recebe a carga_sab_horaria.
 */
module.exports = class FuncionariosService {
    #usuarioDAO;
    #auditoriaService;
    #authService;

    constructor(usuarioDAO, auditoriaService, authService) {
        console.log("Instanciado FuncionariosService");
        this.#usuarioDAO = usuarioDAO;
        this.#auditoriaService = auditoriaService;
        this.#authService = authService;
    }

    /**
     * Liga/desliga a marca "isento de ponto" de um funcionário.
     * Exige a senha do administrador que está fazendo a alteração (ação sensível).
     */
    definirIsentoPonto = async (adminId, alvoId, isento, senha) => {
        console.log("[FuncionariosService.definirIsentoPonto]");
        const senhaOk = this.#authService
            ? await this.#authService.confirmarSenha(adminId, senha)
            : false;

        if (!senhaOk) {
            throw new ErrorResponse(401, "Senha incorreta.", {
                message: "Senha incorreta. A alteração não foi feita.",
            });
        }

        const alterado = await this.#usuarioDAO.definirIsentoPonto(alvoId, isento);
        if (!alterado) {
            throw new ErrorResponse(404, "Funcionário não encontrado.", {
                message: "Funcionário não encontrado.",
            });
        }

        return { isento_ponto: !!isento };
    };

    listarSetores = async () => {
        console.log("[FuncionariosService.listarSetores]");
        return this.#usuarioDAO.listarSetores();
    };

    listar = async () => {
        console.log("[FuncionariosService.listar]");
        const usuarios = await this.#usuarioDAO.listar();

        return usuarios.map(usuario => ({
            ...usuario,
            escala: Escala.aPartirDaLinha(usuario).paraHoras(),
            carga_horaria: this.#minParaHora(usuario.meta_seg ?? 480),
            carga_sab_horaria: this.#minParaHora(usuario.meta_sab ?? 0),
            status_conta: usuario.ativo ? "ativo" : "inativo",
        }));
    };

    buscarPorId = async (id) => {
        console.log("[FuncionariosService.buscarPorId]");
        const usuario = await this.#usuarioDAO.buscarPorId(id);

        if (!usuario) {
            throw new ErrorResponse(404, "Funcionário não encontrado.", {
                message: "Funcionário não encontrado.",
            });
        }

        return {
            ...usuario,
            escala: Escala.aPartirDaLinha(usuario).paraHoras(),
            carga_horaria: this.#minParaHora(usuario.meta_seg ?? 480),
            carga_sab_horaria: this.#minParaHora(usuario.meta_sab ?? 0),
            status_conta: usuario.ativo ? "ativo" : "inativo",
            data_aniversario: usuario.data_aniversario
                ? usuario.data_aniversario.toISOString().split("T")[0]
                : "",
        };
    };

    cadastrar = async (body, usuarioLogado) => {
        console.log("[FuncionariosService.cadastrar]");
        this.#validarCadastro(body);

        const dados = {
            ...body,
            cpfLimpo: body.cpf.replace(/\D/g, ""),
            email: body.email.trim().toLowerCase(),
            metas: this.#montarMetas(body),
        };

        const novoId = await this.#usuarioDAO.cadastrar(dados);

        await this.#auditoriaService?.registrar({
            acao: "CRIAR",
            entidade: "Funcionário",
            entidade_id: body.matricula,
            descricao: `Cadastrou o funcionário ${body.nome}`,
            executor: usuarioLogado,
        });

        return novoId;
    };

    atualizar = async (id, body, usuarioLogado) => {
        console.log("[FuncionariosService.atualizar]");
        // Segurança: ninguém pode inativar a própria conta (evita admin se trancar pra fora).
        if (String(usuarioLogado?.id_usuario) === String(id) && body.status_conta === "inativo") {
            throw new ErrorResponse(403, "Você não pode inativar a própria conta.", {
                message: "Você não pode inativar a própria conta.",
            });
        }

        const cpfLimpo = body.cpf ? body.cpf.replace(/\D/g, "") : "";

        if (cpfLimpo && !this.#validarCPF(cpfLimpo)) {
            throw new ErrorResponse(400, "CPF inválido.", {
                message: "CPF inválido.",
            });
        }

        if (body.celular && !this.#validarCelular(body.celular)) {
            throw new ErrorResponse(400, "Celular inválido.", {
                message: "Celular inválido.",
            });
        }

        if (body.senha?.trim()) {
            if (!usuarioLogado?.administrador) {
                throw new ErrorResponse(403, "Apenas administradores podem alterar senhas.", {
                    message: "Apenas administradores podem alterar senhas.",
                });
            }

            if (body.senha.trim().length < 8) {
                throw new ErrorResponse(400, "A nova senha deve ter pelo menos 8 caracteres.", {
                    message: "A nova senha deve ter pelo menos 8 caracteres.",
                });
            }
        }

        await this.#usuarioDAO.atualizar(id, {
            ...body,
            cpfLimpo,
            metas: this.#montarMetas(body),
        });

        await this.#auditoriaService?.registrar({
            acao: "EDITAR",
            entidade: "Funcionário",
            entidade_id: body.matricula || String(id),
            descricao: `Atualizou o funcionário ${body.nome || ("#" + id)}`,
            executor: usuarioLogado,
        });
    };

    excluir = async (id, usuarioLogado) => {
        console.log("[FuncionariosService.excluir]");
        if (String(usuarioLogado?.id_usuario) === String(id)) {
            throw new ErrorResponse(403, "Você não pode excluir a própria conta de administrador.", {
                message: "Você não pode excluir a própria conta de administrador.",
            });
        }

        const alvo = await this.#usuarioDAO.buscarPorId(id).catch(() => null);
        const excluiu = await this.#usuarioDAO.excluir(id);

        if (!excluiu) {
            throw new ErrorResponse(404, "Funcionário não encontrado.", {
                message: "Funcionário não encontrado.",
            });
        }

        await this.#auditoriaService?.registrar({
            acao: "EXCLUIR",
            entidade: "Funcionário",
            entidade_id: alvo?.matricula || String(id),
            descricao: `Excluiu o funcionário ${alvo?.nome || ("#" + id)}`,
            executor: usuarioLogado,
        });
    };

    /**
     * Monta o objeto de metas (minutos) para os 7 dias.
     * Prioriza body.escala (formato novo, "HH:MM" por dia);
     * se não vier, usa carga_horaria (seg–sex) e carga_sab_horaria (sáb).
     */
    #montarMetas(body) {
        const escala = body.escala || {};
        const padraoSemana = this.#horaParaMin(body.carga_horaria || "08:00");
        const padraoSabado = this.#horaParaMin(body.carga_sab_horaria || "00:00");

        const dia = (chave, padrao) =>
            escala[chave] !== undefined ? this.#horaParaMin(escala[chave]) : padrao;

        return {
            dom: dia("dom", 0),
            seg: dia("seg", padraoSemana),
            ter: dia("ter", padraoSemana),
            qua: dia("qua", padraoSemana),
            qui: dia("qui", padraoSemana),
            sex: dia("sex", padraoSemana),
            sab: dia("sab", padraoSabado),
        };
    }

    #validarCadastro(body) {
        if (!body.nome?.trim()) {
            throw new ErrorResponse(400, "Nome é obrigatório.", { message: "Nome é obrigatório." });
        }
        if (!body.matricula?.trim()) {
            throw new ErrorResponse(400, "Matrícula é obrigatória.", { message: "Matrícula é obrigatória." });
        }
        if (!body.email?.trim()) {
            throw new ErrorResponse(400, "E-mail é obrigatório.", { message: "E-mail é obrigatório." });
        }
        if (!body.senha?.trim()) {
            throw new ErrorResponse(400, "Senha é obrigatória.", { message: "Senha é obrigatória." });
        }
        if (!body.id_setor) {
            throw new ErrorResponse(400, "Setor é obrigatório.", { message: "Setor é obrigatório." });
        }
        if (!body.cpf?.trim()) {
            throw new ErrorResponse(400, "CPF é obrigatório.", { message: "CPF é obrigatório." });
        }

        const cpfLimpo = body.cpf.replace(/\D/g, "");
        if (!this.#validarCPF(cpfLimpo)) {
            throw new ErrorResponse(400, "CPF inválido.", { message: "CPF inválido." });
        }

        if (body.celular && !this.#validarCelular(body.celular)) {
            throw new ErrorResponse(400, "Celular inválido.", { message: "Celular inválido. Use (DD) 9XXXX-XXXX." });
        }
    }

    #horaParaMin(hhmm) {
        if (!hhmm || !String(hhmm).includes(":")) return 0;
        const [h, m] = String(hhmm).split(":").map(Number);
        return Number.isNaN(h) || Number.isNaN(m) ? 0 : h * 60 + m;
    }

    #minParaHora(min) {
        const minutos = Math.max(0, min || 0);
        return `${String(Math.floor(minutos / 60)).padStart(2, "0")}:${String(minutos % 60).padStart(2, "0")}`;
    }

    #validarCelular(cel) {
        const num = String(cel || "").replace(/\D/g, "");
        if (num.length !== 11) return false;   // DDD (2) + 9 dígitos
        if (num[0] === "0")    return false;   // DDD não começa com 0
        if (num[2] !== "9")    return false;   // celular: 1º dígito do número é 9
        return true;
    }

    #validarCPF(cpf) {
        if (!cpf || cpf.length !== 11) return false;
        if (/^(\d)\1{10}$/.test(cpf)) return false;

        let soma = 0;
        for (let i = 0; i < 9; i++) soma += parseInt(cpf[i], 10) * (10 - i);
        let r = (soma * 10) % 11;
        if (r === 10 || r === 11) r = 0;
        if (r !== parseInt(cpf[9], 10)) return false;

        soma = 0;
        for (let i = 0; i < 10; i++) soma += parseInt(cpf[i], 10) * (11 - i);
        r = (soma * 10) % 11;
        if (r === 10 || r === 11) r = 0;
        return r === parseInt(cpf[10], 10);
    }
};