const ErrorResponse = require("../utils/ErrorResponse");
const Ocorrencia = require("../models/Ocorrencia");
const CalculoDeHoras = require("../utils/CalculoDeHoras");

/**
 * Camada de regra de negócio do Ponto.
 *
 * A partir do Item 1, é AQUI que o saldo é calculado (e não mais nos triggers
 * do MySQL). O Service busca a escala do funcionário (metas por dia da semana)
 * e os feriados do mês, calcula cada dia com o CalculoDeHoras e manda os
 * números prontos para o DAO apenas gravar.
 */
module.exports = class PontoService {
    #pontoDAO;
    #usuarioDAO;
    #feriadoDAO;
    #auditoriaService;

    /**
     * @param {Object} pontoDAO
     * @param {Object} usuarioDAO - usado para buscar a escala do funcionário.
     * @param {Object} feriadoDAO - usado para descobrir os feriados do mês.
     * @param {Object} auditoriaService
     */
    constructor(pontoDAO, usuarioDAO, feriadoDAO, auditoriaService) {
        console.log("Instanciado PontoService");
        this.#pontoDAO = pontoDAO;
        this.#usuarioDAO = usuarioDAO;
        this.#feriadoDAO = feriadoDAO;
        this.#auditoriaService = auditoriaService;
    }

    /**
     * Carrega a ficha de um mês (somente leitura dos valores já gravados).
     */
    carregar = async ({ id, mes, ano }, usuario) => {
        console.log("[PontoService.carregar]");
        if (!id || !mes || !ano) {
            throw new ErrorResponse(400, "Parâmetros inválidos.", {
                message: "Parâmetros inválidos.",
            });
        }

        if (!usuario?.administrador && String(usuario?.id_usuario) !== String(id)) {
            throw new ErrorResponse(403, "Funcionários podem consultar apenas a própria ficha.", {
                message: "Funcionários podem consultar apenas a própria ficha.",
            });
        }

        const linhas = await this.#pontoDAO.carregar(id, mes, ano);

        return linhas.map(linha => ({
            dia: linha.dia,
            meta: CalculoDeHoras.minutosParaHora(linha.meta_minutos ?? 480),
            ent1: linha.ent1 || "",
            sai1: linha.sai1 || "",
            ent2: linha.ent2 || "",
            sai2: linha.sai2 || "",
            ocorrencia: linha.ocorrencia_descricao
                ? Ocorrencia.normalizarSaida(linha.ocorrencia_descricao)
                : "Normal",
        }));
    };

    /**
     * Banco de Horas do funcionário logado:
     *   - saldoMesAtual: saldo só do mês corrente
     *   - saldoTotal: acumulado de TODOS os meses até agora (o "banco")
     *   - meses: resumo de cada mês com lançamentos (mais recente primeiro)
     */
    bancoHoras = async (usuario) => {
        console.log("[PontoService.bancoHoras]");
        const idUsuario = usuario?.id_usuario;
        if (!idUsuario) {
            throw new ErrorResponse(401, "Sessão inválida.", { message: "Sessão inválida." });
        }

        const agora    = new Date();
        const mesAtual = agora.getMonth() + 1;
        const anoAtual = agora.getFullYear();

        const resumoAtual = await this.#pontoDAO.resumoMes(idUsuario, mesAtual, anoAtual);
        const saldoTotal  = await this.#pontoDAO.saldoAcumulado(idUsuario);
        const meses       = await this.#pontoDAO.saldosPorMes(idUsuario);

        return {
            saldoMesAtual: Number(resumoAtual?.saldoMin || 0),
            saldoTotal,
            mesAtual,
            anoAtual,
            meses,
        };
    };

    /** (RH) Mapa { idUsuario: saldoTotalMin } — Saldo Total de cada funcionário. */
    saldosAcumulados = async () => {
        console.log("[PontoService.saldosAcumulados]");
        return await this.#pontoDAO.saldosAcumuladosPorUsuario();
    };

    /**
     * Detalhe dia a dia de um mês do PRÓPRIO usuário (para abrir o relatório
     * do mês na tela Banco de Horas). Usa o total/saldo já salvos no banco.
     */
    detalheMes = async (usuario, ano, mes) => {
        console.log("[PontoService.detalheMes]");
        const idUsuario = usuario?.id_usuario;
        if (!idUsuario) {
            throw new ErrorResponse(401, "Sessão inválida.", { message: "Sessão inválida." });
        }

        const a = Number(ano);
        const m = Number(mes);
        if (!a || !m || m < 1 || m > 12) {
            throw new ErrorResponse(400, "Período inválido.", { message: "Período inválido." });
        }

        const linhas = await this.#pontoDAO.carregar(idUsuario, m, a);
        const resumo = await this.#pontoDAO.resumoMes(idUsuario, m, a);

        const dias = linhas.map(l => ({
            dia:        Number(l.dia),
            metaMin:    Number(l.meta_minutos) || 0,
            ent1:       l.ent1 || "",
            sai1:       l.sai1 || "",
            ent2:       l.ent2 || "",
            sai2:       l.sai2 || "",
            totalMin:   Number(l.total_dia_minutos) || 0,
            saldoMin:   Number(l.saldo_dia_minutos) || 0,
            ocorrencia: l.ocorrencia_descricao || "Normal",
        }));

        return {
            ano: a,
            mes: m,
            resumo: {
                totalMin: Number(resumo?.totalMin) || 0,
                saldoMin: Number(resumo?.saldoMin) || 0,
                dias:     Number(resumo?.dias) || 0,
            },
            dias,
        };
    };

    /**
     * Salva a ficha de um mês. Calcula meta/total/saldo de cada dia com base na
     * escala do funcionário e nos feriados cadastrados.
     */
    salvar = async (body, usuarioLogado) => {
        console.log("[PontoService.salvar]");
        const { id_usuario, mes, ano, lancamentos } = body;

        if (!id_usuario || !mes || !ano || !Array.isArray(lancamentos)) {
            throw new ErrorResponse(400, "Dados inválidos.", {
                message: "Dados inválidos.",
            });
        }

        const mesNum = Number(mes);
        const anoNum = Number(ano);

        // 1. Busca a escala (metas por dia da semana) do funcionário.
        const escala = await this.#usuarioDAO.buscarEscala(id_usuario);

        // 2. Descobre quais dias do mês são feriado.
        const feriados = await this.#feriadoDAO.conjuntoDeDatas(mesNum, anoNum);

        // 3. Calcula cada dia e monta as linhas prontas para gravar.
        const linhasCalculadas = lancamentos.map(lanc => {
            const dia = Number(lanc.dia);
            const dataUTC = new Date(Date.UTC(anoNum, mesNum - 1, dia));
            const dataRef = `${anoNum}-${this.#pad(mesNum)}-${this.#pad(dia)}`;
            const ehFeriado = feriados.has(dataRef);

            const calculo = CalculoDeHoras.calcularDia({
                ent1: lanc.ent1,
                sai1: lanc.sai1,
                ent2: lanc.ent2,
                sai2: lanc.sai2,
                metaDaEscala: escala.metaParaData(dataUTC),
                ocorrencia: lanc.ocorrencia || "Normal",
                ehFeriado,
            });

            return {
                dataRef,
                ocorrencia: Ocorrencia.normalizarEntrada(lanc.ocorrencia || "Normal"),
                ...calculo.marcacoes,
                metaDoDia: calculo.metaDoDia,
                total: calculo.total,
                saldo: calculo.saldo,
            };
        });

        // 4. O DAO apenas grava os números já calculados.
        //    O banco possui um TRIGGER que impede gravar em mês fechado;
        //    aqui traduzimos esse erro em uma resposta amigável.
        let total;
        try {
            total = await this.#pontoDAO.salvarFicha(id_usuario, linhasCalculadas);
        } catch (error) {
            if (error?.sqlState === "45000") {
                throw new ErrorResponse(409, "Este mês já foi fechado. Reabra o fechamento para editar.", {
                    message: "Este mês já foi fechado. Reabra o fechamento para editar.",
                });
            }
            throw error;
        }

        await this.#auditoriaService?.registrar({
            acao: "EDITAR",
            entidade: "Ponto",
            entidade_id: `func ${id_usuario} · ${mesNum}/${anoNum}`,
            descricao: `Salvou a ficha de ponto de ${mesNum}/${anoNum} (${total} dias) do funcionário #${id_usuario}`,
            executor: usuarioLogado,
        });


        return {
            message: `Ficha de ${mesNum}/${anoNum} salva! (${total} dias)`,
        };
    };

    #pad(n) {
        return String(n).padStart(2, "0");
    }
};