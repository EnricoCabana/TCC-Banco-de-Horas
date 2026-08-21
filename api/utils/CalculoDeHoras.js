const Ocorrencia = require("../models/Ocorrencia");

/**
 * Motor de cálculo de horas do CronaSys (camada de regra de negócio).
 *
 * IMPORTANTE: a partir do Item 1, TODO o cálculo de horas vive aqui, no Node,
 * e não mais nos triggers do MySQL. O banco apenas armazena os valores prontos.
 * Isso centraliza a regra de negócio em um único lugar, fácil de explicar e testar.
 *
 * As regras de "abona meta" / "falta" continuam descritas no modelo Ocorrencia,
 * que é a fonte única dessas regras. Esta classe apenas faz a matemática do tempo.
 */
module.exports = class CalculoDeHoras {
    /**
     * Converte "HH:MM" em minutos. Ex.: "08:30" -> 510.
     * @param {string} hhmm
     * @returns {number}
     */
    static horaParaMinutos(hhmm) {
        if (!hhmm || !String(hhmm).includes(":")) return 0;
        const [h, m] = String(hhmm).split(":").map(Number);
        return Number.isNaN(h) || Number.isNaN(m) ? 0 : h * 60 + m;
    }

    /**
     * Converte minutos em "HH:MM". Ex.: 510 -> "08:30".
     * @param {number} min
     * @returns {string}
     */
    static minutosParaHora(min) {
        const total = Math.max(0, min || 0);
        return `${String(Math.floor(total / 60)).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;
    }

    /**
     * Calcula a duração de um intervalo entrada->saída em minutos.
     * Suporta virada de meia-noite (ex.: entra 22:00, sai 02:00).
     * @param {string} entrada - "HH:MM"
     * @param {string} saida - "HH:MM"
     * @returns {number} minutos trabalhados no intervalo.
     */
    static intervaloMinutos(entrada, saida) {
        if (!entrada || !saida) return 0;

        const e = this.horaParaMinutos(entrada);
        const s = this.horaParaMinutos(saida);

        if (e <= 0 || s <= 0) return 0;
        return s >= e ? s - e : (1440 - e) + s;
    }

    /**
     * Soma os dois turnos do dia (manhã + tarde).
     * @param {Object} marcacoes - { ent1, sai1, ent2, sai2 }
     * @returns {number} total de minutos trabalhados no dia.
     */
    static totalTrabalhado({ ent1, sai1, ent2, sai2 }) {
        return this.intervaloMinutos(ent1, sai1) + this.intervaloMinutos(ent2, sai2);
    }

    /**
     * Calcula o resultado de um dia de ponto.
     *
     * Passos:
     * 1. Se for feriado, a meta do dia vira 0 (ninguém precisa trabalhar).
     * 2. Se a ocorrência "zera horários" (folga, atestado, falta...), as
     *    marcações são ignoradas.
     * 3. O saldo segue as regras do modelo Ocorrencia:
     *    - ocorrência que abona meta  -> saldo 0;
     *    - falta não justificada      -> saldo = -meta;
     *    - dia normal                 -> saldo = total - meta.
     *
     * @param {Object} entrada
     * @param {string} entrada.ent1
     * @param {string} entrada.sai1
     * @param {string} entrada.ent2
     * @param {string} entrada.sai2
     * @param {number} entrada.metaDaEscala - meta do dia vinda da escala (minutos).
     * @param {string} entrada.ocorrencia - descrição da ocorrência.
     * @param {boolean} entrada.ehFeriado - se a data é feriado cadastrado.
     * @returns {{ metaDoDia: number, total: number, saldo: number, marcacoes: Object }}
     */
    static calcularDia({ ent1, sai1, ent2, sai2, metaDaEscala, ocorrencia, ehFeriado }) {
        const ocorrenciaBanco = Ocorrencia.normalizarEntrada(ocorrencia || "Normal");
        const metaDoDia = (ehFeriado || ocorrenciaBanco === "Feriado" || ocorrenciaBanco === "Folga" || ocorrenciaBanco === "Férias") ? 0 : (metaDaEscala || 0);

        const zera = Ocorrencia.deveZerarHorarios(ocorrenciaBanco);
        const marcacoes = {
            ent1: zera ? "" : (ent1 || ""),
            sai1: zera ? "" : (sai1 || ""),
            ent2: zera ? "" : (ent2 || ""),
            sai2: zera ? "" : (sai2 || ""),
        };

        const total = this.totalTrabalhado(marcacoes);
        const saldo = Ocorrencia.calcularSaldo(total, metaDoDia, ocorrenciaBanco);

        return { metaDoDia, total, saldo, marcacoes };
    }
};