/**
 * Modelo de domínio: Escala de trabalho de um funcionário.
 *
 * Representa a "meta de minutos" que o funcionário deve cumprir em cada
 * dia da semana. Substitui a antiga ideia de apenas `meta_dia` + `meta_sab`,
 * permitindo escalas totalmente flexíveis (ex.: folga na quarta, 4h no sábado).
 *
 * Regra de domínio: cada meta é um número inteiro de minutos entre 0 e 1440
 * (0 = folga naquele dia; 480 = 8 horas; 240 = 4 horas).
 *
 * A ordem dos dias segue o padrão do JavaScript Date.getUTCDay():
 * 0 = domingo, 1 = segunda, ... 6 = sábado.
 */
const DIAS = ["dom", "seg", "ter", "qua", "qui", "sex", "sab"];

module.exports = class Escala {
    #metas;

    /**
     * @param {Object} metasEmMinutos - { dom, seg, ter, qua, qui, sex, sab } em minutos.
     */
    constructor(metasEmMinutos = {}) {
        this.#metas = {};
        for (const dia of DIAS) {
            this.#definirMeta(dia, metasEmMinutos[dia] ?? 0);
        }
    }

    /**
     * Regra de domínio: valida e guarda a meta de um dia.
     * @param {string} dia - "dom" | "seg" | ... | "sab"
     * @param {number} valor - minutos (0 a 1440)
     * @throws {Error} se o valor for inválido.
     */
    #definirMeta(dia, valor) {
        const minutos = Number(valor);

        if (!Number.isInteger(minutos)) {
            throw new Error(`A meta de ${dia} deve ser um número inteiro de minutos.`);
        }
        if (minutos < 0 || minutos > 1440) {
            throw new Error(`A meta de ${dia} deve estar entre 0 e 1440 minutos.`);
        }

        this.#metas[dia] = minutos;
    }

    /**
     * Retorna a meta (em minutos) para uma data específica,
     * descobrindo automaticamente o dia da semana.
     * @param {Date} dataUTC - data criada com Date.UTC(...)
     * @returns {number} minutos esperados naquele dia.
     */
    metaParaData(dataUTC) {
        return this.#metas[DIAS[dataUTC.getUTCDay()]];
    }

    /**
     * Retorna as metas em minutos como objeto simples.
     * @returns {Object} { dom, seg, ter, qua, qui, sex, sab }
     */
    paraMinutos() {
        return { ...this.#metas };
    }

    /**
     * Retorna as metas formatadas como "HH:MM" (útil para a API/tela).
     * @returns {Object} { dom: "00:00", seg: "08:00", ... }
     */
    paraHoras() {
        const formatado = {};
        for (const dia of DIAS) {
            const min = this.#metas[dia];
            formatado[dia] =
                `${String(Math.floor(min / 60)).padStart(2, "0")}:${String(min % 60).padStart(2, "0")}`;
        }
        return formatado;
    }

    /**
     * Constrói uma Escala a partir de uma linha do banco (tabela usuarios),
     * que possui as colunas meta_dom, meta_seg, ... meta_sab.
     * @param {Object} row - linha retornada pelo MySQL.
     * @returns {Escala}
     */
    static aPartirDaLinha(row = {}) {
        return new Escala({
            dom: row.meta_dom ?? 0,
            seg: row.meta_seg ?? 480,
            ter: row.meta_ter ?? 480,
            qua: row.meta_qua ?? 480,
            qui: row.meta_qui ?? 480,
            sex: row.meta_sex ?? 480,
            sab: row.meta_sab ?? 0,
        });
    }
};