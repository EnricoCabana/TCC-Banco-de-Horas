module.exports = class Solicitacao {
    constructor(dados = {}) {
        this.id_solicitacao = dados.id_solicitacao;
        this.id_usuario = dados.id_usuario;
        this.data_ref = dados.data_ref;
        this.ocorrencia = dados.ocorrencia;
        this.mensagem = dados.mensagem;
        this.status = dados.status || "Pendente";
        this.id_aprovador = dados.id_aprovador || null;
    }
};