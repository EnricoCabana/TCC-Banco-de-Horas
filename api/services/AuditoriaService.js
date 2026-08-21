const ACOES = ["CRIAR", "EDITAR", "EXCLUIR"];

/**
 * Regra de negócio da Trilha de Auditoria.
 *
 * `registrar` é "à prova de falha": se a gravação do log falhar, ela apenas
 * loga no console e NÃO interrompe a operação principal (salvar um ponto,
 * por exemplo). Auditoria nunca deve quebrar o fluxo do usuário.
 */
module.exports = class AuditoriaService {
    #auditoriaDAO;

    constructor(auditoriaDAO) {
        console.log("Instanciado AuditoriaService");
        this.#auditoriaDAO = auditoriaDAO;
    }

    /**
     * Registra um evento de auditoria.
     * @param {Object} evento
     * @param {'CRIAR'|'EDITAR'|'EXCLUIR'} evento.acao
     * @param {string} evento.entidade
     * @param {string} [evento.entidade_id]
     * @param {string} [evento.descricao]
     * @param {string} [evento.valor_antigo]
     * @param {string} [evento.valor_novo]
     * @param {Object} [evento.executor] - usuário logado ({ id_usuario, nome }).
     */
    registrar = async (evento) => {
        console.log("[AuditoriaService.registrar]");
        try {
            if (!evento?.acao || !evento?.entidade) return;
            await this.#auditoriaDAO.inserir({
                acao: evento.acao,
                entidade: evento.entidade,
                entidade_id: evento.entidade_id ?? null,
                descricao: evento.descricao ?? null,
                valor_antigo: evento.valor_antigo ?? null,
                valor_novo: evento.valor_novo ?? null,
                executor_id: evento.executor?.id_usuario ?? evento.executor?.id ?? null,
                executor_nome: evento.executor?.nome ?? "Sistema",
            });
        } catch (error) {
            console.error("[Auditoria] Falha ao registrar evento:", error.message);
        }
    };

    listar = async (filtros = {}) => {
        console.log("[AuditoriaService.listar]");
        const f = { ...filtros };
        if (f.acao && !ACOES.includes(f.acao)) delete f.acao;
        return this.#auditoriaDAO.listar(f);
    };

    opcoes = async () => this.#auditoriaDAO.opcoes();
};