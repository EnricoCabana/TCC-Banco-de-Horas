const jwt = require("jsonwebtoken");
const crypto = require("crypto");

/**
 * Classe responsável por gerar e validar tokens JWT (JSON Web Token).
 *
 * Segue o modelo do professor (MeuTokenJWT): geração com claims personalizados,
 * validação com verificação de expiração, header/payload configuráveis.
 *
 * Diferença no CronaSys: a chave secreta vem do .env (JWT_SECRET).
 */
module.exports = class MeuTokenJWT {
    #key;            // Chave secreta usada para assinar o token
    #alg;            // Algoritmo de criptografia
    #type;           // Tipo do token
    #iss;            // Emissor
    #aud;            // Destinatário
    #sub;            // Assunto
    #duracaoToken;   // Validade (segundos)
    #payload;        // Payload decodificado

    constructor() {
        this.#key = process.env.JWT_SECRET || "TCC_SECRET_KEY";
        this.#alg = "HS256";
        this.#type = "JWT";
        this.#iss = "http://localhost";
        this.#aud = "http://localhost";
        this.#sub = "acesso_sistema";
        this.#duracaoToken = 3600 * 24 * 60; // 60 dias
        this.#payload = null;
    }

    /**
     * Gera um token JWT assinado.
     * @param {Object} claims - { email, role, name, idUsuario }
     * @returns {string} token assinado
     */
    gerarToken = (claims) => {
        const headers = { alg: this.#alg, typ: this.#type };
        const agora = Math.floor(Date.now() / 1000);

        const payload = {
            iss: this.#iss,
            aud: this.#aud,
            sub: this.#sub,
            iat: agora,
            exp: agora + this.#duracaoToken,
            nbf: agora,
            jti: crypto.randomBytes(16).toString("hex"),

            email: claims.email,
            role: claims.role,
            name: claims.name,
            idUsuario: claims.idUsuario,
        };

        return jwt.sign(payload, this.#key, { algorithm: this.#alg, header: headers });
    };

    /**
     * Valida um token JWT (aceita prefixo "Bearer ").
     * Em caso de sucesso, guarda o payload em #payload.
     * @returns {boolean}
     */
    validarToken = (stringToken) => {
        if (!stringToken || stringToken.trim() === "") {
            return false;
        }
        const token = stringToken.replace("Bearer ", "").trim();
        try {
            this.#payload = jwt.verify(token, this.#key, { algorithms: [this.#alg] });
            return true;
        } catch (err) {
            if (err instanceof jwt.TokenExpiredError) console.error("Token expirado");
            else if (err instanceof jwt.JsonWebTokenError) console.error("Token inválido");
            else console.error("Erro ao validar token", err);
            return false;
        }
    };

    get key() { return this.#key; }
    set key(value) { this.#key = value; }
    get alg() { return this.#alg; }
    get duracaoToken() { return this.#duracaoToken; }
    set duracaoToken(value) { this.#duracaoToken = value; }
    get payload() { return this.#payload; }
    set payload(value) { this.#payload = value; }
};