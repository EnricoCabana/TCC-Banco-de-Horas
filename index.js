const Server = require("./Server");
require("dotenv").config();

(async () => {
    try {
        const server = new Server(process.env.PORT || 3000);
        await server.init();
        server.run();
    } catch (error) {
        console.error("Erro ao iniciar o servidor:", error);
    }
})();
