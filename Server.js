const express = require("express");
const cors = require("cors");
const path = require("path");

const ErrorResponse = require("./api/utils/ErrorResponse");
const Logger = require("./api/utils/Logger");

const MysqlDatabase = require("./api/database/MysqlDatabase");

const UsuarioDAO = require("./api/dao/UsuarioDAO");
const AvisoDAO = require("./api/dao/AvisoDAO");
const PontoDAO = require("./api/dao/PontoDAO");
const FeriadoDAO = require("./api/dao/FeriadoDAO");
const SetorDAO = require("./api/dao/SetorDAO");
const FechamentoDAO = require("./api/dao/FechamentoDAO");
const AuditoriaDAO = require("./api/dao/AuditoriaDAO");
const ConfiguracaoSmtpDAO = require("./api/dao/ConfiguracaoSmtpDAO");

const AuthService = require("./api/services/AuthService");
const PermissoesService = require("./api/services/PermissoesService");
const FuncionariosService = require("./api/services/FuncionariosService");
const AvisosService = require("./api/services/AvisosService");
const PontoService = require("./api/services/PontoService");
const FeriadosService = require("./api/services/FeriadosService");
const SetorService = require("./api/services/SetorService");
const FechamentoService = require("./api/services/FechamentoService");
const AuditoriaService = require("./api/services/AuditoriaService");
const PerfilService = require("./api/services/PerfilService");
const EmailService = require("./api/services/EmailService");
const FichaEmailService = require("./api/services/FichaEmailService");
const BackupService = require("./api/services/BackupService");

const AuthMiddleware = require("./api/middleware/AuthMiddleware");
const AuthPermissoesMiddleware = require("./api/middleware/AuthPermissoesMiddleware");
const FuncionariosMiddleware = require("./api/middleware/FuncionariosMiddleware");
const AvisosMiddleware = require("./api/middleware/AvisosMiddleware");
const PontoMiddleware = require("./api/middleware/PontoMiddleware");

const AuthController = require("./api/controllers/AuthController");
const FuncionariosController = require("./api/controllers/FuncionariosController");
const AvisosController = require("./api/controllers/AvisosController");
const PontoController = require("./api/controllers/PontoController");
const FeriadosController = require("./api/controllers/FeriadosController");
const SetorController = require("./api/controllers/SetorController");
const FechamentoController = require("./api/controllers/FechamentoController");
const AuditoriaController = require("./api/controllers/AuditoriaController");
const PerfilController = require("./api/controllers/PerfilController");
const EmailController = require("./api/controllers/EmailController");
const FichaEmailController = require("./api/controllers/FichaEmailController");
const BackupController = require("./api/controllers/BackupController");

const AuthRouter = require("./api/routes/AuthRouter");
const FuncionariosRouter = require("./api/routes/FuncionariosRouter");
const AvisosRouter = require("./api/routes/AvisosRouter");
const PontoRouter = require("./api/routes/PontoRouter");
const FeriadosRouter = require("./api/routes/FeriadosRouter");
const SetorRouter = require("./api/routes/SetorRouter");
const FechamentoRouter = require("./api/routes/FechamentoRouter");
const AuditoriaRouter = require("./api/routes/AuditoriaRouter");
const PerfilRouter = require("./api/routes/PerfilRouter");
const EmailRouter = require("./api/routes/EmailRouter");
const FichaEmailRouter = require("./api/routes/FichaEmailRouter");
const BackupRouter = require("./api/routes/BackupRouter");

module.exports = class Server {
    #porta;
    #app;
    #database;

    #usuarioDAO;
    #avisoDAO;
    #pontoDAO;
    #feriadoDAO;
    #setorDAO;
    #fechamentoDAO;
    #auditoriaDAO;
    #configSmtpDAO;

    #authService;
    #permissoesService;
    #funcionariosService;
    #avisosService;
    #pontoService;
    #feriadosService;
    #setorService;
    #fechamentoService;
    #auditoriaService;
    #perfilService;
    #emailService;
    #fichaEmailService;
    #backupService;

    #authMiddleware;
    #authPermissoesMiddleware;
    #funcionariosMiddleware;
    #avisosMiddleware;
    #pontoMiddleware;

    #authController;
    #funcionariosController;
    #avisosController;
    #pontoController;
    #feriadosController;
    #setorController;
    #fechamentoController;
    #auditoriaController;
    #perfilController;
    #emailController;
    #fichaEmailController;
    #backupController;

    constructor(porta) {
        this.#porta = porta || process.env.PORT || 3000;
    }

    init = async () => {
        this.#app = express();
        this.#database = new MysqlDatabase();

        this.#setupBaseMiddlewares();
        this.#setupDatabase();
        this.#setupDependencies();
        this.#setupRoutes();
        this.#setupErrorMiddleware();
    };

    run = () => {
        this.#app.listen(this.#porta, () => {
            console.log(`CronaSys rodando em http://localhost:${this.#porta}`);
            console.log(`Frontend: http://localhost:${this.#porta}`);
            console.log(`API: http://localhost:${this.#porta}/api/usuarios`);
        });
    };

    #setupBaseMiddlewares = () => {
        this.#app.use(cors());
        this.#app.use(express.json());
        this.#app.use(express.static(path.join(__dirname, "static")));
    };

    #setupDatabase = () => {
        this.#database.testarConexao()
            .then(() => console.log("Banco de Dados: Conectado!"))
            .catch(error => console.error("Banco de Dados:", error.message));
    };

    #setupDependencies = () => {
        this.#usuarioDAO = new UsuarioDAO(this.#database);
        this.#avisoDAO = new AvisoDAO(this.#database);
        this.#pontoDAO = new PontoDAO(this.#database);
        this.#feriadoDAO = new FeriadoDAO(this.#database);
        this.#setorDAO = new SetorDAO(this.#database);
        this.#fechamentoDAO = new FechamentoDAO(this.#database);
        this.#auditoriaDAO = new AuditoriaDAO(this.#database);
        this.#configSmtpDAO = new ConfiguracaoSmtpDAO(this.#database);
        this.#auditoriaService = new AuditoriaService(this.#auditoriaDAO);
        this.#perfilService = new PerfilService(this.#usuarioDAO, this.#auditoriaService);
        this.#emailService = new EmailService(this.#configSmtpDAO, this.#auditoriaService);
        this.#fichaEmailService = new FichaEmailService(this.#usuarioDAO, this.#pontoDAO, this.#emailService, this.#auditoriaService);
        this.#authService = new AuthService(this.#usuarioDAO, this.#emailService);
        this.#backupService = new BackupService(this.#auditoriaService);
        this.#permissoesService = new PermissoesService(this.#usuarioDAO);
        this.#funcionariosService = new FuncionariosService(this.#usuarioDAO, this.#auditoriaService, this.#authService);
        this.#avisosService = new AvisosService(this.#avisoDAO);
        this.#pontoService = new PontoService(this.#pontoDAO, this.#usuarioDAO, this.#feriadoDAO, this.#auditoriaService);
        this.#feriadosService = new FeriadosService(this.#feriadoDAO, this.#auditoriaService);
        this.#setorService = new SetorService(this.#setorDAO, this.#auditoriaService);
        this.#fechamentoService = new FechamentoService(this.#fechamentoDAO, this.#auditoriaService);

        this.#authMiddleware = new AuthMiddleware();
        this.#authPermissoesMiddleware = new AuthPermissoesMiddleware(this.#permissoesService);
        this.#funcionariosMiddleware = new FuncionariosMiddleware();
        this.#avisosMiddleware = new AvisosMiddleware();
        this.#pontoMiddleware = new PontoMiddleware();

        this.#authController = new AuthController(this.#authService);
        this.#funcionariosController = new FuncionariosController(this.#funcionariosService);
        this.#avisosController = new AvisosController(this.#avisosService);
        this.#pontoController = new PontoController(this.#pontoService);
        this.#feriadosController = new FeriadosController(this.#feriadosService);
        this.#setorController = new SetorController(this.#setorService);
        this.#fechamentoController = new FechamentoController(this.#fechamentoService);
        this.#auditoriaController = new AuditoriaController(this.#auditoriaService);
        this.#perfilController = new PerfilController(this.#perfilService);
        this.#emailController = new EmailController(this.#emailService);
        this.#fichaEmailController = new FichaEmailController(this.#fichaEmailService);
        this.#backupController = new BackupController(this.#backupService);
    };

    #setupRoutes = () => {
        const authRouter = new AuthRouter(this.#authMiddleware, this.#authPermissoesMiddleware, this.#authController);
        const funcionariosRouter = new FuncionariosRouter(
            this.#authPermissoesMiddleware,
            this.#funcionariosMiddleware,
            this.#funcionariosController
        );
        const avisosRouter = new AvisosRouter(
            this.#authPermissoesMiddleware,
            this.#avisosMiddleware,
            this.#avisosController
        );
        const pontoRouter = new PontoRouter(
            this.#authPermissoesMiddleware,
            this.#pontoMiddleware,
            this.#pontoController
        );
        const feriadosRouter = new FeriadosRouter(
            this.#authPermissoesMiddleware,
            this.#feriadosController
        );
        const setorRouter = new SetorRouter(
            this.#authPermissoesMiddleware,
            this.#setorController
        );
        const fechamentoRouter = new FechamentoRouter(
            this.#authPermissoesMiddleware,
            this.#fechamentoController
        );
        const auditoriaRouter = new AuditoriaRouter(
            this.#authPermissoesMiddleware,
            this.#auditoriaController
        );
        const perfilRouter = new PerfilRouter(
            this.#authPermissoesMiddleware,
            this.#perfilController
        );
        const emailRouter = new EmailRouter(
            this.#authPermissoesMiddleware,
            this.#emailController
        );
        const fichaEmailRouter = new FichaEmailRouter(
            this.#authPermissoesMiddleware,
            this.#fichaEmailController
        );
        const backupRouter = new BackupRouter(
            this.#authPermissoesMiddleware,
            this.#backupController
        );

        this.#app.use("/api/auth", authRouter.createRoutes());
        this.#app.use("/api", funcionariosRouter.createRoutes());
        this.#app.use("/api", avisosRouter.createRoutes());
        this.#app.use("/api", pontoRouter.createRoutes());
        this.#app.use("/api", feriadosRouter.createRoutes());
        this.#app.use("/api", setorRouter.createRoutes());
        this.#app.use("/api", fechamentoRouter.createRoutes());
        this.#app.use("/api", auditoriaRouter.createRoutes());
        this.#app.use("/api", perfilRouter.createRoutes());
        this.#app.use("/api", emailRouter.createRoutes());
        this.#app.use("/api", fichaEmailRouter.createRoutes());
        this.#app.use("/api", backupRouter.createRoutes());
    };

    #setupErrorMiddleware = () => {
        this.#app.use((error, request, response, next) => {
            /* Se a resposta já começou (ex.: download), delega ao Express. */
            if (response.headersSent) {
                return next(error);
            }

            if (error instanceof ErrorResponse) {
                return response.status(error.httpCode).json(error.body || {
                    message: error.message,
                });
            }

            if (error.statusCode) {
                return response.status(error.statusCode).json({
                    message: error.message,
                });
            }

            console.error("Erro capturado:", error);
            Logger.log(error);
            response.status(500).json({ message: "Erro interno no servidor." });
        });
    };
};