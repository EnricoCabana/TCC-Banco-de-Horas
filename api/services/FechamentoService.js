const ExcelJS = require("exceljs");
const ErrorResponse = require("../utils/ErrorResponse");

const MESES = [
    "", "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
    "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
];

/**
 * Regra de negócio do Fechamento de Folha.
 * Monta o relatório mestre do mês e gera o arquivo Excel para a contabilidade.
 */
module.exports = class FechamentoService {
    #fechamentoDAO;
    #auditoriaService;

    constructor(fechamentoDAO, auditoriaService) {
        console.log("Instanciado FechamentoService");
        this.#fechamentoDAO = fechamentoDAO;
        this.#auditoriaService = auditoriaService;
    }

    /**
     * Monta os dados do relatório (usado pela prévia na tela e pelo Excel).
     */
    gerarRelatorio = async (mes, ano) => {
        console.log("[FechamentoService.gerarRelatorio]");
        const { m, a } = this.#validar(mes, ano);
        const linhas = await this.#fechamentoDAO.relatorioMestre(m, a);

        const itens = linhas.map(l => {
            const totalMin = Number(l.total_min) || 0;
            const saldoMin = Number(l.saldo_min) || 0;
            const acumMin = Number(l.saldo_acumulado_min) || 0;
            return {
                id_usuario: l.id_usuario,
                matricula: l.matricula,
                nome: l.nome,
                cargo: l.cargo,
                setor: l.nome_setor,
                dias_lancados: Number(l.dias_lancados) || 0,
                total_minutos: totalMin,
                saldo_minutos: saldoMin,
                saldo_acumulado_minutos: acumMin,
                total_horas: this.#minParaHora(totalMin),
                saldo_horas: this.#saldoTexto(saldoMin),
                saldo_acumulado_horas: this.#saldoTexto(acumMin),
            };
        });

        const totalGeralMin = itens.reduce((s, i) => s + i.total_minutos, 0);
        const saldoGeralMin = itens.reduce((s, i) => s + i.saldo_minutos, 0);

        return {
            mes: m,
            ano: a,
            periodo: `${MESES[m]} / ${a}`,
            itens,
            totais: {
                funcionarios: itens.length,
                total_horas: this.#minParaHora(totalGeralMin),
                saldo_horas: this.#saldoTexto(saldoGeralMin),
            },
        };
    };

    /**
     * Gera o arquivo Excel (.xlsx) do relatório mestre.
     * @returns {Promise<{buffer: Buffer, nomeArquivo: string}>}
     */
    gerarExcel = async (mes, ano) => {
        console.log("[FechamentoService.gerarExcel]");
        const relatorio = await this.gerarRelatorio(mes, ano);

        const AZUL = "FF1E3A5F";
        const CINZA = "FFEDEFF2";
        const borda = { style: "thin", color: { argb: "FFBFC4CC" } };
        const todasBordas = { top: borda, left: borda, bottom: borda, right: borda };
        const CNPJ = "10.395.862/0001-14";
        const EMPRESA = "IF Inform\u00e1tica LTDA";

        const wb = new ExcelJS.Workbook();
        wb.creator = "CronaSys";
        wb.created = new Date();

        const ws = wb.addWorksheet(`Folha ${relatorio.mes}-${relatorio.ano}`);
        [16, 30, 22, 20, 18, 14, 14].forEach((w, i) => (ws.getColumn(i + 1).width = w));

        // Cabeçalho da empresa
        ws.mergeCells("A1:G1");
        const empresa = ws.getCell("A1");
        empresa.value = EMPRESA;
        empresa.font = { bold: true, size: 15, color: { argb: "FFFFFFFF" } };
        empresa.alignment = { vertical: "middle", horizontal: "center" };
        empresa.fill = { type: "pattern", pattern: "solid", fgColor: { argb: AZUL } };
        ws.getRow(1).height = 24;

        ws.mergeCells("A2:G2");
        ws.getCell("A2").value = `CNPJ: ${CNPJ}`;
        ws.getCell("A2").alignment = { horizontal: "center" };

        ws.mergeCells("A3:G3");
        const periodo = ws.getCell("A3");
        periodo.value = `Fechamento de Folha \u2014 ${relatorio.periodo}`;
        periodo.font = { bold: true, size: 12 };
        periodo.alignment = { horizontal: "center" };
        ws.getRow(3).height = 18;

        // Cabeçalho da tabela (linha 5)
        const cab = ["Matr\u00edcula", "Nome", "Cargo", "Setor", "Horas Trabalhadas", "Saldo do M\u00eas", "Saldo Atual"];
        const linhaCab = ws.getRow(5);
        cab.forEach((t, i) => {
            const c = linhaCab.getCell(i + 1);
            c.value = t;
            c.font = { bold: true, color: { argb: "FFFFFFFF" } };
            c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: AZUL } };
            c.alignment = { vertical: "middle", horizontal: i >= 4 ? "center" : "left" };
            c.border = todasBordas;
        });

        // Dados (a partir da linha 6)
        relatorio.itens.forEach(i => {
            const linha = ws.addRow([
                i.matricula, i.nome, i.cargo, i.setor,
                i.total_horas, i.saldo_horas, i.saldo_acumulado_horas,
            ]);
            linha.eachCell((c, col) => {
                c.border = todasBordas;
                if (col >= 5) c.alignment = { horizontal: "center" };
                if (col === 6 || col === 7) {
                    const neg = String(c.value).startsWith("-");
                    c.font = { color: { argb: neg ? "FFDC2626" : "FF16A34A" }, bold: true };
                }
            });
        });

        // Total
        const linhaTotal = ws.addRow(["", "", "", "TOTAL", relatorio.totais.total_horas, relatorio.totais.saldo_horas, ""]);
        linhaTotal.font = { bold: true };
        linhaTotal.eachCell((c) => { c.border = todasBordas; c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: CINZA } }; });
        linhaTotal.getCell(4).alignment = { horizontal: "right" };
        linhaTotal.getCell(5).alignment = { horizontal: "center" };
        linhaTotal.getCell(6).alignment = { horizontal: "center" };

        const buffer = await wb.xlsx.writeBuffer();
        return {
            buffer: Buffer.from(buffer),
            nomeArquivo: `Fechamento_${relatorio.ano}-${String(relatorio.mes).padStart(2, "0")}.xlsx`,
        };
    };

    /* O mês está fechado? */
    status = async (mes, ano) => {
        console.log("[FechamentoService.status]");
        const { m, a } = this.#validar(mes, ano);
        return this.#fechamentoDAO.statusFechamento(m, a);
    };

    /* Fecha o mês em lote (trava as edições). */
    fechar = async (mes, ano, usuarioLogado) => {
        console.log("[FechamentoService.fechar]");
        const { m, a } = this.#validar(mes, ano);
        const st = await this.#fechamentoDAO.statusFechamento(m, a);
        if (st.fechado) {
            throw new ErrorResponse(409, "Este mês já está fechado.", { message: "Este mês já está fechado." });
        }
        const qtd = await this.#fechamentoDAO.fecharMes(m, a);

        await this.#auditoriaService?.registrar({
            acao: "EDITAR",
            entidade: "Fechamento",
            entidade_id: `${a}-${String(m).padStart(2, "0")}`,
            descricao: `Fechou o mês ${m}/${a} (${qtd} funcionário(s))`,
            executor: usuarioLogado,
        });

        return { message: `Mês fechado para ${qtd} funcionário(s).`, fechado: true };
    };

    /* Reabre o mês (libera as edições). */
    reabrir = async (mes, ano, usuarioLogado) => {
        console.log("[FechamentoService.reabrir]");
        const { m, a } = this.#validar(mes, ano);
        const st = await this.#fechamentoDAO.statusFechamento(m, a);
        if (!st.fechado) {
            throw new ErrorResponse(409, "Este mês não está fechado.", { message: "Este mês não está fechado." });
        }
        await this.#fechamentoDAO.reabrirMes(m, a);

        await this.#auditoriaService?.registrar({
            acao: "EDITAR",
            entidade: "Fechamento",
            entidade_id: `${a}-${String(m).padStart(2, "0")}`,
            descricao: `Reabriu o mês ${m}/${a}`,
            executor: usuarioLogado,
        });

        return { message: "Mês reaberto. As edições estão liberadas novamente.", fechado: false };
    };

    /* ---------------- helpers ---------------- */

    #validar(mes, ano) {
        const m = Number(mes);
        const a = Number(ano);
        if (!m || m < 1 || m > 12) {
            throw new ErrorResponse(400, "Mês inválido.", { message: "Mês inválido." });
        }
        if (!a || a < 2000 || a > 2100) {
            throw new ErrorResponse(400, "Ano inválido.", { message: "Ano inválido." });
        }
        return { m, a };
    }

    #minParaHora(min) {
        const total = Math.max(0, min || 0);
        return `${String(Math.floor(total / 60)).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;
    }

    #saldoTexto(min) {
        const sinal = min >= 0 ? "+" : "-";
        const v = Math.abs(min || 0);
        return `${sinal}${String(Math.floor(v / 60)).padStart(2, "0")}:${String(v % 60).padStart(2, "0")}`;
    }
};