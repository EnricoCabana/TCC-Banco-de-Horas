module.exports = class Usuario {
    constructor(dados = {}) {
        this.id_usuario = dados.id_usuario;
        this.nome = dados.nome;
        this.cargo = dados.cargo;
        this.email = dados.email;
        this.tipo_acesso = dados.tipo_acesso;
        this.ativo = dados.ativo;
        this.meta_dia_minutos = dados.meta_dia_minutos;
        this.meta_sab_minutos = dados.meta_sab_minutos;
    }

    get administrador() {
        return Usuario.ehAdministrador(this);
    }

    static ehAdministrador(usuario) {
        const tipo = String(usuario?.tipo_acesso || "").toUpperCase();
        const cargo = String(usuario?.cargo || "")
            .normalize("NFD")
            .replace(/[\u0300-\u036f]/g, "")
            .toUpperCase();

        return tipo === "ADM" || cargo.includes("ADMINISTRADOR");
    }
};
