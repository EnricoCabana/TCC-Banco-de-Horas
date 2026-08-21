const fs = require("fs");
const path = require("path");

module.exports = class Logger {
    static LOG_FILE = path.join("api", "system", "log.log");

    static log(error) {
        const payload = error instanceof Error
            ? { message: error.message, stack: error.stack, code: error.code }
            : error;

        this.writeLog("error", JSON.stringify(payload));
    }

    static writeLog(type, message) {
        const directoryPath = path.dirname(this.LOG_FILE);

        if (!fs.existsSync(directoryPath)) {
            fs.mkdirSync(directoryPath, { recursive: true });
        }

        const entry = `[${new Date().toISOString()}] [${type}] [${message}]\n`;
        fs.appendFileSync(this.LOG_FILE, entry, { encoding: "utf8" });
    }
};
