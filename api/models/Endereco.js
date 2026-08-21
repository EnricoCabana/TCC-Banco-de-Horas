module.exports = class Endereco {
    constructor(dados = {}) {
        this.id_usuario = dados.id_usuario;
        this.rua = dados.rua;
        this.num = dados.num;
        this.bairro = dados.bairro;
        this.cidade = dados.cidade;
        this.cep = dados.cep;
    }
};
