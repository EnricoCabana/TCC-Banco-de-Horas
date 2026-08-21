module.exports = class Documento {
    constructor(dados = {}) {
        this.id_usuario = dados.id_usuario;
        this.cpf = dados.cpf;
        this.rg = dados.rg;
        this.cartao_sus = dados.cartao_sus;
        this.carteira_trabalho = dados.carteira_trabalho;
    }
};
