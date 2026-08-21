/**
 * CronaSys — static/js/calculoPonto.js
 * -------------------------------------------------------
 * CÉREBRO DO CÁLCULO NO FRONT (fonte única).
 *
 * Espelha o motor do back-end (api/utils/CalculoDeHoras.js). Antes, cada tela
 * (gestão, ficha mensal, dashboard, relatório) recalculava meta e saldo por
 * conta própria, usando a regra antiga (domingo=0, sábado=metaSáb, resto=metaDia).
 *
 * Agora todas usam ESTE arquivo, que entende a escala flexível (7 dias) e os
 * feriados. Carregado no index.html ANTES das telas, expõe window.CronaCalc.
 */
window.CronaCalc = (function () {
    /* Ordem padrão do JavaScript: 0=domingo ... 6=sábado */
    const DIAS = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sab'];

    function pad(n) {
        return String(n).padStart(2, '0');
    }

    /** "08:30" -> 510 */
    function horaParaMin(hhmm) {
        if (!hhmm || !String(hhmm).includes(':')) return 0;
        const [h, m] = String(hhmm).split(':').map(Number);
        return (Number.isNaN(h) || Number.isNaN(m)) ? 0 : h * 60 + m;
    }

    /** 510 -> "08:30" */
    function minParaHora(min) {
        const total = Math.max(0, Math.round(min || 0));
        return `${pad(Math.floor(total / 60))}:${pad(total % 60)}`;
    }

    /** Duração entrada->saída em minutos (aceita virada de meia-noite). */
    function intervaloMin(entrada, saida) {
        if (!entrada || !saida || !String(entrada).includes(':') || !String(saida).includes(':')) return 0;
        const e = horaParaMin(entrada);
        const s = horaParaMin(saida);
        const diff = s >= e ? s - e : (1440 - e) + s;
        return diff > 0 ? diff : 0;
    }

    /** Monta a chave de data "YYYY-MM-DD" a partir de um objeto Date local. */
    function chaveData(dataObj) {
        return `${dataObj.getFullYear()}-${pad(dataObj.getMonth() + 1)}-${pad(dataObj.getDate())}`;
    }

    /** A data é um feriado cadastrado? */
    function ehFeriado(dataObj, feriadosSet) {
        return Boolean(feriadosSet && feriadosSet.has(chaveData(dataObj)));
    }

    /**
     * Meta do dia (em "HH:MM"), considerando escala flexível e feriados.
     * @param {Date} dataObj
     * @param {Object} escalaHoras - { dom:"00:00", seg:"08:00", ... } (vindo da API)
     * @param {Set<string>} feriadosSet - datas "YYYY-MM-DD"
     * @returns {string} "HH:MM" (feriado ou folga = "00:00")
     */
    function metaParaData(dataObj, escalaHoras, feriadosSet) {
        if (ehFeriado(dataObj, feriadosSet)) return '00:00';
        if (!escalaHoras) return '00:00';
        return escalaHoras[DIAS[dataObj.getDay()]] || '00:00';
    }

    /**
     * Saldo do dia (em minutos), mesma regra do back-end.
     * @param {Object} p
     * @param {number} p.totalMin - minutos trabalhados no dia.
     * @param {number} p.metaMin - meta do dia em minutos.
     * @param {string} p.ocorrencia - já normalizada ("Normal", "Faltou", "Atestado"...).
     * @param {boolean} p.abonada - se a ocorrência abona a meta.
     * @returns {number}
     */
    function saldoMin({ totalMin, metaMin, ocorrencia, abonada }) {
        if (abonada) return 0;
        if (ocorrencia === 'Faltou' ||
            ocorrencia === 'Falta Injustificada' ||
            ocorrencia === 'Falta Justificada') return -metaMin;
        if (ocorrencia === 'Feriado' || ocorrencia === 'Folga') return totalMin;   // feriado/folga: meta 0
        return totalMin - metaMin;
    }

    return {
        DIAS,
        horaParaMin,
        minParaHora,
        intervaloMin,
        chaveData,
        ehFeriado,
        metaParaData,
        saldoMin,
    };
})();