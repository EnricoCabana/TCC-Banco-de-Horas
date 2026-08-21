module.exports = class Aviso {
    constructor(dados = {}) {
        this.id_aviso = dados.id_aviso;
        this.titulo = dados.titulo;
        this.mensagem = dados.mensagem;
        this.tipo = dados.tipo || "geral";
        this.id_autor = dados.id_autor || null;
    }
};