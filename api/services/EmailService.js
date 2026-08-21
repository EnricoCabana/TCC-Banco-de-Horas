const nodemailer = require("nodemailer");
const ErrorResponse = require("../utils/ErrorResponse");

const SEGURANCAS = ["SSL", "STARTTLS", "NENHUMA"];

/**
 * Envio de e-mail via SMTP (nodemailer).
 * As credenciais NÃO ficam no código: o RH cadastra na tela de
 * "Configuração de E-mail" e elas ficam salvas no banco.
 */
module.exports = class EmailService {
    #configDAO;
    #auditoriaService;

    constructor(configDAO, auditoriaService) {
        console.log("Instanciado EmailService");
        this.#configDAO = configDAO;
        this.#auditoriaService = auditoriaService;
    }

    /* Config para a tela (NUNCA devolve a senha — só se já existe uma). */
    obterConfig = async () => {
        console.log("[EmailService.obterConfig]");
        const c = await this.#configDAO.buscar();
        if (!c) {
            return {
                host: "", porta: 587, seguranca: "STARTTLS", usuario: "",
                remetente_nome: "", remetente_email: "", ativo: false, temSenha: false,
            };
        }
        return {
            host: c.host || "",
            porta: c.porta || 587,
            seguranca: c.seguranca || "STARTTLS",
            usuario: c.usuario || "",
            remetente_nome: c.remetente_nome || "",
            remetente_email: c.remetente_email || "",
            ativo: !!c.ativo,
            temSenha: !!c.senha,
        };
    };

    salvarConfig = async (body, usuarioLogado) => {
        console.log("[EmailService.salvarConfig]");
        const host = String(body?.host || "").trim();
        const usuario = String(body?.usuario || "").trim();
        const porta = Number(body?.porta) || 587;
        const seguranca = SEGURANCAS.includes(body?.seguranca) ? body.seguranca : "STARTTLS";

        if (!host) throw new ErrorResponse(400, "Informe o servidor (host).", { message: "Informe o servidor (host)." });
        if (!usuario) throw new ErrorResponse(400, "Informe o usuário (e-mail).", { message: "Informe o usuário (e-mail)." });

        const atual = await this.#configDAO.buscar();
        // Senha: usa a nova se enviada; senão mantém a que já está salva.
        const senha = (body?.senha && String(body.senha).length)
            ? String(body.senha)
            : (atual?.senha || "");

        await this.#configDAO.salvar({
            host, porta, seguranca, usuario, senha,
            remetente_nome: String(body?.remetente_nome || "").trim() || "CronaSys",
            remetente_email: String(body?.remetente_email || "").trim() || usuario,
            ativo: body?.ativo ? 1 : 0,
        });

        await this.#auditoriaService?.registrar({
            acao: "EDITAR",
            entidade: "Configuração de e-mail",
            descricao: "Atualizou a configuração de SMTP",
            executor: usuarioLogado,
        });

        return { message: "Configuração salva!" };
    };

    enviarTeste = async (destino) => {
        console.log("[EmailService.enviarTeste]");
        const para = String(destino || "").trim();
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(para)) {
            throw new ErrorResponse(400, "Informe um e-mail de destino válido.", { message: "Informe um e-mail de destino válido." });
        }
        const c = await this.#configDAO.buscar();
        const transporter = this.#criarTransportador(c);
        try {
            await transporter.sendMail({
                from: this.#remetente(c),
                to: para,
                subject: "Teste de e-mail — CronaSys",
                text: "Se você recebeu este e-mail, a configuração de SMTP do CronaSys está funcionando.",
                html: "<p>Se você recebeu este e-mail, a configuração de SMTP do CronaSys está <strong>funcionando</strong>.</p>",
            });
        } catch (error) {
            throw new ErrorResponse(400, `Falha ao enviar: ${error.message}`, { message: `Falha ao enviar: ${error.message}` });
        }
        return { message: `E-mail de teste enviado para ${para}.` };
    };

    /* Envio genérico — reutilizável para mandar fichas/saldos depois. */
    enviar = async ({ para, assunto, texto, html, anexos }) => {
        console.log("[EmailService.enviar]");
        const c = await this.#configDAO.buscar();
        if (!c || !c.ativo) {
            throw new ErrorResponse(400, "O envio de e-mail está desativado nas configurações.", { message: "O envio de e-mail está desativado." });
        }
        const transporter = this.#criarTransportador(c);
        const mensagem = { from: this.#remetente(c), to: para, subject: assunto, text: texto, html };
        if (Array.isArray(anexos) && anexos.length) mensagem.attachments = anexos;
        await transporter.sendMail(mensagem);
    };

    /* ---------------- helpers ---------------- */
    #criarTransportador(c) {
        if (!c || !c.host || !c.usuario) {
            throw new ErrorResponse(400, "Configure o SMTP antes de enviar.", { message: "Configure o SMTP antes de enviar." });
        }
        const porta = Number(c.porta) || 587;
        return nodemailer.createTransport({
            host: c.host,
            port: porta,
            secure: c.seguranca === "SSL" || porta === 465, // 465 = SSL implícito
            auth: { user: c.usuario, pass: c.senha },
        });
    }

    #remetente(c) {
        return `"${c.remetente_nome || "CronaSys"}" <${c.remetente_email || c.usuario}>`;
    }
};