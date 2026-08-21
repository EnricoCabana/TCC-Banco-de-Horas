const PDFDocument = require("pdfkit");
const ErrorResponse = require("../utils/ErrorResponse");

const MESES = ["", "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
    "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];

const DIAS_SEMANA = ["DOM", "SEG", "TER", "QUA", "QUI", "SEX", "SÁB"];
const EMPRESA_NOME = "IF Informática LTDA";
const EMPRESA_CNPJ = "10.395.862/0001-14";

/**
 * Monta e envia, para cada funcionário selecionado, um e-mail com:
 *   • um resumo no corpo (HTML) com saldo do mês + saldo acumulado;
 *   • a ficha do mês em PDF anexo;
 *   • um feedback automático com base no saldo do mês.
 *
 * Reaproveita o EmailService (envio real) e o PontoDAO (saldos já salvos).
 */
module.exports = class FichaEmailService {
    #usuarioDAO;
    #pontoDAO;
    #emailService;
    #auditoriaService;

    constructor(usuarioDAO, pontoDAO, emailService, auditoriaService) {
        console.log("Instanciado FichaEmailService");
        this.#usuarioDAO = usuarioDAO;
        this.#pontoDAO = pontoDAO;
        this.#emailService = emailService;
        this.#auditoriaService = auditoriaService;
    }

    enviarFichas = async (body, usuarioLogado) => {
        console.log("[FichaEmailService.enviarFichas]");
        const mes = Number(body?.mes);
        const ano = Number(body?.ano);
        const ids = Array.isArray(body?.ids) ? body.ids.map(Number).filter(Boolean) : [];

        if (!mes || mes < 1 || mes > 12 || !ano) {
            throw new ErrorResponse(400, "Mês/ano inválidos.", { message: "Mês/ano inválidos." });
        }
        if (!ids.length) {
            throw new ErrorResponse(400, "Selecione ao menos um funcionário.", { message: "Selecione ao menos um funcionário." });
        }

        const todos = await this.#usuarioDAO.listar();
        const porId = new Map(todos.map(u => [Number(u.id_usuario), u]));

        const resultados = [];
        for (const id of ids) {
            const usuario = porId.get(id);
            if (!usuario) {
                resultados.push({ id, nome: `#${id}`, ok: false, erro: "Funcionário não encontrado." });
                continue;
            }
            if (!usuario.email) {
                resultados.push({ id, nome: usuario.nome, ok: false, erro: "Funcionário sem e-mail cadastrado." });
                continue;
            }
            try {
                const dados = await this.#montarDados(usuario, mes, ano);
                const pdf = await this.#gerarPdf(dados);
                await this.#emailService.enviar({
                    para: usuario.email,
                    assunto: `Sua ficha de ponto — ${MESES[mes]}/${ano}`,
                    html: this.#gerarHtml(dados),
                    texto: this.#gerarTexto(dados),
                    anexos: [{
                        filename: `ficha-${MESES[mes].toLowerCase()}-${ano}.pdf`,
                        content: pdf,
                        contentType: "application/pdf",
                    }],
                });
                resultados.push({ id, nome: usuario.nome, email: usuario.email, ok: true });
            } catch (error) {
                resultados.push({ id, nome: usuario.nome, email: usuario.email, ok: false, erro: error.message });
            }
        }

        const enviados = resultados.filter(r => r.ok).length;
        const falhas = resultados.length - enviados;
        await this.#auditoriaService?.registrar({
            acao: "EDITAR",
            entidade: "Envio de fichas",
            descricao: `Enviou fichas por e-mail de ${MESES[mes]}/${ano} (${enviados} enviadas, ${falhas} falhas)`,
            executor: usuarioLogado,
        });

        return { mes, ano, enviados, falhas, resultados };
    };

    /* ---------------- dados ---------------- */
    /* Gera o PDF da ficha de UM funcionário (usado no download do Relatório). */
    gerarPdfUsuario = async (idUsuario, mes, ano) => {
        console.log("[FichaEmailService.gerarPdfUsuario]");
        const todos = await this.#usuarioDAO.listar();
        const usuario = todos.find((u) => Number(u.id_usuario) === Number(idUsuario));
        if (!usuario) {
            throw new ErrorResponse(404, "Funcionário não encontrado.", { message: "Funcionário não encontrado." });
        }
        const dados = await this.#montarDados(usuario, Number(mes), Number(ano));
        const buffer = await this.#gerarPdf(dados);
        const slug = String(usuario.nome || "func").toLowerCase().normalize("NFD")
            .replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
        return { filename: `ficha-ponto-${slug}-${mes}-${ano}.pdf`, buffer };
    };

    #montarDados = async (usuario, mes, ano) => {
        const dias = await this.#pontoDAO.carregar(usuario.id_usuario, mes, ano);
        const resumo = await this.#pontoDAO.resumoMes(usuario.id_usuario, mes, ano);
        const saldoAcumuladoMin = await this.#pontoDAO.saldoAcumulado(usuario.id_usuario);

        const saldoMesMin = Number(resumo.saldoMin) || 0;
        return {
            nome: usuario.nome,
            email: usuario.email,
            setor: usuario.nome_setor || "",
            cargo: usuario.cargo || "",
            jornada: [
                Number(usuario.meta_dom) || 0, Number(usuario.meta_seg) || 0,
                Number(usuario.meta_ter) || 0, Number(usuario.meta_qua) || 0,
                Number(usuario.meta_qui) || 0, Number(usuario.meta_sex) || 0,
                Number(usuario.meta_sab) || 0,
            ],
            mes, ano, mesNome: MESES[mes],
            dias,
            qtdDias: Number(resumo.dias) || 0,
            metaMin: Number(resumo.metaMin) || 0,
            totalMin: Number(resumo.totalMin) || 0,
            saldoMesMin,
            saldoAcumuladoMin,
            feedback: this.#feedback(saldoMesMin, Number(resumo.dias) || 0),
        };
    };

    #feedback = (saldoMesMin, qtdDias) => {
        if (qtdDias === 0) {
            return "Não há lançamentos de ponto registrados para este mês.";
        }
        if (saldoMesMin >= 0) {
            return "Parabéns! Suas horas do mês estão em dia. Continue assim.";
        }
        if (saldoMesMin >= -120) {
            return "Atenção: você fechou o mês com um pequeno saldo negativo. Procure recuperar nos próximos dias.";
        }
        return "Seu saldo do mês ficou bastante negativo. É importante conversar com o RH e regularizar suas horas.";
    };

    /* ---------------- HTML (corpo) ---------------- */
    #gerarHtml = (d) => {
        const cor = d.saldoMesMin > 0 ? "#16a34a" : d.saldoMesMin < 0 ? "#dc2626" : "#4b5563";
        return `
        <div style="font-family:Arial,Helvetica,sans-serif;max-width:560px;margin:0 auto;color:#111;">
          <h2 style="color:#2563eb;margin-bottom:4px;">CronaSys</h2>
          <p style="margin:0 0 18px;color:#6b7280;">Ficha de ponto — ${d.mesNome}/${d.ano}</p>
          <p>Olá, <strong>${d.nome}</strong>,</p>
          <p>Segue o resumo do seu mês. A ficha completa, dia a dia, está no <strong>PDF em anexo</strong>.</p>
          <table style="width:100%;border-collapse:collapse;margin:16px 0;">
            <tr><td style="padding:8px 0;color:#6b7280;">Horas trabalhadas</td><td style="padding:8px 0;text-align:right;font-weight:600;">${this.#hhmm(d.totalMin)}</td></tr>
            <tr><td style="padding:8px 0;color:#6b7280;">Meta do mês</td><td style="padding:8px 0;text-align:right;font-weight:600;">${this.#hhmm(d.metaMin)}</td></tr>
            <tr><td style="padding:8px 0;color:#6b7280;border-top:1px solid #e5e7eb;">Saldo do mês</td><td style="padding:8px 0;text-align:right;font-weight:700;color:${cor};border-top:1px solid #e5e7eb;">${this.#minParaHora(d.saldoMesMin)}</td></tr>
            <tr><td style="padding:8px 0;color:#6b7280;">Saldo acumulado (banco de horas)</td><td style="padding:8px 0;text-align:right;font-weight:700;">${this.#minParaHora(d.saldoAcumuladoMin)}</td></tr>
          </table>
          <p style="background:#f9fafb;border:1px solid #e5e7eb;border-radius:8px;padding:12px 16px;">${d.feedback}</p>
          <p style="color:#9ca3af;font-size:12px;margin-top:24px;">E-mail automático do CronaSys. Em caso de dúvidas, procure o RH.</p>
        </div>`;
    };

    #gerarTexto = (d) => {
        return [
            `CronaSys — Ficha de ponto ${d.mesNome}/${d.ano}`,
            `Olá, ${d.nome},`,
            `Horas trabalhadas: ${this.#hhmm(d.totalMin)}`,
            `Meta do mês: ${this.#hhmm(d.metaMin)}`,
            `Saldo do mês: ${this.#minParaHora(d.saldoMesMin)}`,
            `Saldo acumulado: ${this.#minParaHora(d.saldoAcumuladoMin)}`,
            d.feedback,
            "A ficha completa está no PDF em anexo.",
        ].join("\n");
    };

    /* ---------------- PDF (anexo) ---------------- */
    #gerarPdf = (d) => {
        return new Promise((resolve, reject) => {
            const doc = new PDFDocument({ size: "A4", margin: 40 });
            const chunks = [];
            doc.on("data", c => chunks.push(c));
            doc.on("end", () => resolve(Buffer.concat(chunks)));
            doc.on("error", reject);

            const AZUL = "#1e3a5f", CINZA = "#edeff2", FDS = "#f3f4f6";
            const TEXTO = "#1f2937", BORDA = "#bfc4cc";
            const TINT_OCORR = {
                "Falta Não Justificada": "#f4bfd4", "Falta Injustificada": "#f4bfd4",
                "Falta Justificada": "#F0A868", "Faltou": "#f4c5c5",
                "Atestado": "#c3d9f7", "Feriado": "#f8dca3", "Folga": "#bce6cb",
                "Treinamento": "#b3e3ea", "Licença Nojo/Luto": "#d5c8f3",
            };
            const VERDE = "#16a34a", VERMELHO = "#dc2626";

            const X0 = 40;
            const larg = [30, 34, 48, 52, 52, 44, 52, 52, 44, 50, 48];
            const xs = []; let acc = X0;
            for (const w of larg) { xs.push(acc); acc += w; }
            const X1 = acc, LARG = X1 - X0;

            const cel = (x, y, w, h, txt, o = {}) => {
                if (o.fill) doc.rect(x, y, w, h).fill(o.fill);
                doc.rect(x, y, w, h).lineWidth(0.5).strokeColor(BORDA).stroke();
                const size = o.size || 8.5;
                doc.fillColor(o.cor || TEXTO)
                   .font(o.bold ? "Helvetica-Bold" : "Helvetica")
                   .fontSize(size)
                   .text(String(txt == null ? "" : txt), x + 3, y + (h - size) / 2,
                       { width: w - 6, align: o.align || "center", lineBreak: false });
            };
            const corSaldo = (m) => m > 0 ? VERDE : m < 0 ? VERMELHO : TEXTO;

            let y = 40;
            const H = 14;

            /* Título */
            cel(X0, y, LARG, 20, "BANCO DE HORAS", { fill: AZUL, cor: "#ffffff", bold: true, size: 13 }); y += 20;

            /* Empresa / CNPJ */
            const meio = X0 + Math.round(LARG / 2);
            cel(X0, y, 58, H, "Empresa:", { bold: true, align: "left" });
            cel(X0 + 58, y, meio - (X0 + 58), H, EMPRESA_NOME, { align: "left" });
            cel(meio, y, 45, H, "CNPJ:", { bold: true, align: "left" });
            cel(meio + 45, y, X1 - (meio + 45), H, EMPRESA_CNPJ, { align: "left" }); y += H;

            /* Mês / Ano / Setor */
            cel(X0, y, 34, H, "Mês:", { bold: true, align: "left" });
            cel(X0 + 34, y, 76, H, d.mesNome, { align: "left" });
            cel(X0 + 110, y, 34, H, "Ano:", { bold: true, align: "left" });
            cel(X0 + 144, y, 56, H, String(d.ano), { align: "left" });
            cel(X0 + 200, y, 44, H, "Setor:", { bold: true, align: "left" });
            cel(X0 + 244, y, 100, H, d.setor || "—", { align: "left" });
            cel(X0 + 344, y, 44, H, "Cargo:", { bold: true, align: "left" });
            cel(X0 + 388, y, X1 - (X0 + 388), H, d.cargo || "—", { align: "left" }); y += H;

            /* Funcionário */
            cel(X0, y, 75, H, "Funcionário:", { bold: true, align: "left" });
            cel(X0 + 75, y, X1 - (X0 + 75), H, d.nome, { bold: true, align: "left" }); y += H;

            /* Jornada */
            cel(X0, y, LARG, H, "JORNADA DE TRABALHO (horas por dia)", { fill: CINZA, bold: true }); y += H;
            const jornada = (d.jornada && d.jornada.length === 7) ? d.jornada : this.#jornadaSemana(d.dias, d.mes, d.ano);
            const wDia = LARG / 7;
            const tile = (i) => { const cx = X0 + Math.round(i * wDia); return [cx, X0 + Math.round((i + 1) * wDia) - cx]; };
            for (let i = 0; i < 7; i++) { const [cx, cw] = tile(i); cel(cx, y, cw, H, DIAS_SEMANA[i], { fill: CINZA, bold: true }); } y += H;
            for (let i = 0; i < 7; i++) { const [cx, cw] = tile(i); cel(cx, y, cw, H, this.#hhmm(jornada[i]), {}); } y += H;

            y += 6;

            /* Cabeçalho da tabela (reusado em quebra de página) */
            const desenharCabecalho = () => {
                cel(xs[0], y, larg[0] + larg[1] + larg[2], H, "", { fill: CINZA });
                cel(xs[3], y, larg[3] + larg[4] + larg[5], H, "1º Turno", { fill: CINZA, bold: true });
                cel(xs[6], y, larg[6] + larg[7] + larg[8], H, "2º Turno", { fill: CINZA, bold: true });
                cel(xs[9], y, larg[9] + larg[10], H, "", { fill: CINZA }); y += H;
                const cab = ["Dia", "Data", "H. Trab.", "Entrada", "Saída", "Total", "Entrada", "Saída", "Total", "Total Hora", "Saldo"];
                cab.forEach((t, i) => cel(xs[i], y, larg[i], H, t, { fill: AZUL, cor: "#ffffff", bold: true, size: 8 })); y += H;
            };
            desenharCabecalho();

            /* Linhas do mês completo */
            const ultimoDia = new Date(d.ano, d.mes, 0).getDate();
            const mapa = new Map(d.dias.map(x => [Number(x.dia), x]));
            for (let dia = 1; dia <= ultimoDia; dia++) {
                if (y > 790) { doc.addPage(); y = 40; desenharCabecalho(); }
                const ds = new Date(d.ano, d.mes - 1, dia).getDay();
                const reg = mapa.get(dia);
                const metaMin = reg ? Number(reg.meta_minutos) || 0 : jornada[ds];
                const totalMin = reg ? Number(reg.total_dia_minutos) || 0 : 0;
                const saldoMin = reg ? (Number(reg.saldo_dia_minutos) || 0) : (metaMin === 0 ? 0 : -metaMin);
                const e1 = reg && reg.ent1 || "", s1 = reg && reg.sai1 || "", e2 = reg && reg.ent2 || "", s2 = reg && reg.sai2 || "";
                const ocorrDesc = (reg && reg.ocorrencia_descricao) ? reg.ocorrencia_descricao : "";
                let fill = (ds === 0 || ds === 6) ? FDS : null;
                if (TINT_OCORR[ocorrDesc]) fill = TINT_OCORR[ocorrDesc];
                const vals = [dia, DIAS_SEMANA[ds], this.#hhmm(metaMin),
                    e1, s1, this.#hhmm(this.#diffMin(e1, s1)),
                    e2, s2, this.#hhmm(this.#diffMin(e2, s2)),
                    this.#hhmm(totalMin), this.#minParaHora(saldoMin)];
                vals.forEach((v, i) => cel(xs[i], y, larg[i], H, v, {
                    fill, bold: i === 10, cor: i === 10 ? corSaldo(saldoMin) : TEXTO,
                }));
                y += H;
            }

            /* Saldos */
            y += 6;
            cel(xs[0], y, xs[9] - xs[0], H, "SALDO DO MÊS", { fill: CINZA, bold: true, align: "left" });
            cel(xs[9], y, larg[9] + larg[10], H, this.#minParaHora(d.saldoMesMin), { fill: CINZA, bold: true, cor: corSaldo(d.saldoMesMin) }); y += H;
            cel(xs[0], y, xs[9] - xs[0], H, "SALDO ATUAL (banco de horas)", { fill: CINZA, bold: true, align: "left" });
            cel(xs[9], y, larg[9] + larg[10], H, this.#minParaHora(d.saldoAcumuladoMin), { fill: CINZA, bold: true, cor: corSaldo(d.saldoAcumuladoMin) }); y += H;

            /* Legenda de ocorrências (cores do sistema) */
            y += 5;
            cel(X0, y, LARG, H, "OCORRÊNCIAS", { fill: CINZA, bold: true }); y += H;
            const legenda = [
                ["Normal", "#ffffff"], ["Falta Injustificada", "#f4bfd4"],
                ["Falta Justificada", "#F0A868"], ["Atestado", "#c3d9f7"],
                ["Feriado", "#f8dca3"], ["Folga", "#bce6cb"],
                ["Treinamento", "#b3e3ea"], ["Licença Nojo/Luto", "#d5c8f3"],
            ];
            const colW = LARG / 4;
            const rectW = 42, rectH = H - 5;
            for (let i = 0; i < legenda.length; i++) {
                const col = i % 4, row = Math.floor(i / 4);
                const lx = X0 + col * colW, ly = y + row * H;
                cel(lx, ly, colW, H, "", {});
                doc.rect(lx + colW - rectW - 5, ly + 2.5, rectW, rectH).fillAndStroke(legenda[i][1], "#c2c6cd");
                doc.fillColor(TEXTO).font("Helvetica").fontSize(7.5)
                   .text(legenda[i][0], lx + 5, ly + (H - 7.5) / 2, { width: colW - rectW - 14, lineBreak: false });
            }
            y += 2 * H;

            /* Reconhecimento + assinatura do empregado */
            y += 4;
            cel(X0, y, LARG, H, "Recebi o saldo acima mencionado e reconheço a exatidão destas anotações.", { fill: CINZA, align: "center", size: 8 }); y += H;

            y += 32;
            const wAss = 240;
            const cxAss = X0 + (LARG - wAss) / 2;
            doc.strokeColor("#9ca3af").lineWidth(0.7);
            doc.moveTo(cxAss, y).lineTo(cxAss + wAss, y).stroke();
            y += 4;
            doc.fillColor("#6b7280").font("Helvetica").fontSize(9);
            doc.text("Assinatura do Empregado", cxAss, y, { width: wAss, align: "center" });

            doc.end();
        });
    };

    /* ---------------- helpers de tempo ---------------- */
    #hhmm = (min) => {
        const m = Math.abs(Math.round(Number(min) || 0));
        return `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
    };
    #minParaHora = (min) => {
        const m = Math.round(Number(min) || 0);
        const sinal = m < 0 ? "-" : "+";
        return `${sinal}${this.#hhmm(m)}`;
    };

    #jornadaSemana = (dias, mes, ano) => {
        const j = [0, 0, 0, 0, 0, 0, 0]; const vistos = [0, 0, 0, 0, 0, 0, 0];
        for (const d of dias) {
            const ds = new Date(ano, mes - 1, Number(d.dia)).getDay();
            if (!vistos[ds]) { j[ds] = Number(d.meta_minutos) || 0; vistos[ds] = 1; }
        }
        return j;
    };

    #diffMin = (ini, fim) => {
        if (!ini || !fim) return 0;
        const [h1, m1] = String(ini).split(":").map(Number);
        const [h2, m2] = String(fim).split(":").map(Number);
        if ([h1, m1, h2, m2].some((x) => Number.isNaN(x))) return 0;
        return Math.max(0, (h2 * 60 + m2) - (h1 * 60 + m1));
    };
};