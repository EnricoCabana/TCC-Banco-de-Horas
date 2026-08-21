module.exports = class ErrorResponse extends Error {
    #httpCode;
    #body;

    constructor(httpCode, message, body = null) {
        super(message);
        this.name = "ErrorResponse";
        this.#httpCode = httpCode;
        this.#body = body;
    }

    get httpCode() {
        return this.#httpCode;
    }

    get body() {
        return this.#body;
    }
};
