module.exports = class PontoLancamento {
    constructor(dados = {}) {
        this.dia = dados.dia;
        this.meta = dados.meta;
        this.ent1 = dados.ent1;
        this.sai1 = dados.sai1;
        this.ent2 = dados.ent2;
        this.sai2 = dados.sai2;
        this.ocorrencia = dados.ocorrencia || "Normal";
    }
};
