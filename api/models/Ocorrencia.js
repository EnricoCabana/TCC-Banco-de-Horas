const OCORRENCIAS_BANCO = {
    "Trabalho Normal": { front: "Normal", cor: "#FFFFFF", abona: false },
    "Falta Não Justificada": { front: "Falta Injustificada", cor: "#F08080", abona: false },
    "Falta Justificada": { front: "Falta Justificada", cor: "#F0A868", abona: false },
    "Atestado": { front: "Atestado", cor: "#93C5FD", abona: true },
    "Feriado": { front: "Feriado", cor: "#6495ED", abona: false },
    "Folga": { front: "Folga", cor: "#C0C0C0", abona: false },
    "Férias": { front: "Férias", cor: "#5EEAD4", abona: true },
    "Treinamento": { front: "Treinamento", cor: "#86EFAC", abona: true },
    "Licença Nojo/Luto": { front: "Licença Nojo/Luto", cor: "#FFA500", abona: true },
};

const OCORRENCIA_ALIASES = new Map([
    ["Normal", "Trabalho Normal"],
    ["Trabalho Normal", "Trabalho Normal"],
    ["Faltou", "Falta Não Justificada"],
    ["Falta", "Falta Não Justificada"],
    ["Falta Injustificada", "Falta Não Justificada"],
    ["Falta Nao Justificada", "Falta Não Justificada"],
    ["Falta Não Justificada", "Falta Não Justificada"],
    ["Falta Justificada", "Falta Justificada"],
    ["Atestado", "Atestado"],
    ["Feriado", "Feriado"],
    ["Folga", "Folga"],
    ["Meio Periodo", "Folga"],
    ["Meio Período", "Folga"],
    ["Férias", "Férias"],
    ["Treinamento", "Treinamento"],
    ["Licenca Nojo/Luto", "Licença Nojo/Luto"],
    ["Licença Nojo/Luto", "Licença Nojo/Luto"],
]);

module.exports = class Ocorrencia {
    static normalizarEntrada(descricao) {
        const valor = String(descricao || "").trim().replace(/\s+/g, " ");
        if (!valor || valor === "--" || valor === "—") return "Trabalho Normal";

        return OCORRENCIA_ALIASES.get(valor) || valor;
    }

    static normalizarSaida(descricao) {
        const ocorrenciaBanco = this.normalizarEntrada(descricao);
        return OCORRENCIAS_BANCO[ocorrenciaBanco]?.front || ocorrenciaBanco || "Normal";
    }

    static obterConfig(descricao) {
        return OCORRENCIAS_BANCO[this.normalizarEntrada(descricao)];
    }

    static deveZerarHorarios(descricao) {
        const ocorrenciaBanco = this.normalizarEntrada(descricao);
        return Boolean(OCORRENCIAS_BANCO[ocorrenciaBanco]?.abona) ||
            ocorrenciaBanco === "Falta Não Justificada" ||
            ocorrenciaBanco === "Falta Justificada";
    }

    static calcularSaldo(totalDiaMin, metaMin, descricao) {
        const ocorrenciaBanco = this.normalizarEntrada(descricao);

        if (OCORRENCIAS_BANCO[ocorrenciaBanco]?.abona) return 0;
        if (ocorrenciaBanco === "Falta Não Justificada" ||
            ocorrenciaBanco === "Falta Justificada") return -metaMin;

        return totalDiaMin - metaMin;
    }
};