# CronaSys

Sistema web de **controle de ponto e banco de horas** desenvolvido como Trabalho de Conclusão de Curso (TCC), para uso interno da IF Informática. Centraliza marcações, saldos, fechamento mensal e fichas de ponto em um só lugar.

---

## Funcionalidades

- **Login com JWT** e recuperação de senha por e-mail (código de verificação)
- **Dashboard** com visão geral da equipe e saldos do mês
- **Ficha mensal** de ponto por funcionário
- **Banco de horas** com saldos calculados automaticamente
- **Gestão de ponto**: lançamento e ajuste de marcações e ocorrências (atestado, falta, férias etc.)
- **Fechamento mensal** com bloqueio de edições e exportação em **Excel**
- **Relatórios em PDF** e impressão de fichas
- **Envio de fichas por e-mail** para os funcionários
- **Avisos** internos (gerais, importantes e comemorativos, públicos ou privados) com selo de "Novo"
- **Solicitações de ajuste**: funcionário pede correção de ponto (data + tipo de ocorrência + mensagem) e o RH aprova ou nega, com abas de Pendentes/Aprovados/Negados
- **Funcionários**: cadastro com escala flexível por dia da semana e opção "isento de ponto"
- **Setores**: organização e ativação/inativação
- **Feriados** por ano
- **Backup do banco**: download e restauração (com verificação de integridade por hash)
- **Auditoria**: trilha de quem criou, editou ou excluiu cada registro
- **Perfil** com foto e troca de senha
- Tema **claro/escuro** e confirmações de segurança com senha para ações críticas

## Tecnologias

| Camada   | Tecnologias                                                        |
| -------- | ------------------------------------------------------------------ |
| Backend  | Node.js, Express, JWT (jsonwebtoken), bcrypt, dotenv               |
| Banco    | MySQL 8 (driver mysql2, com prepared statements)                   |
| Arquivos | ExcelJS (planilhas), PDFKit (relatórios), Nodemailer (e-mails)     |
| Frontend | HTML, CSS e JavaScript puros (SPA simples, sem frameworks)         |

## Arquitetura

O backend segue uma arquitetura em camadas, com injeção de dependência manual feita no `Server.js`:

```
Requisição → Router → Middleware → Controller → Service → DAO → MySQL
                                        ↑
                                     Models
```

- **Router**: define as rotas e aplica os middlewares de autenticação/validação
- **Middleware**: valida token (JWT), permissões (ADM/PADRAO) e dados de entrada
- **Controller**: recebe a requisição e delega para o service (`next(error)` em caso de falha)
- **Service**: regras de negócio
- **DAO**: acesso ao banco com SQL parametrizado
- **Model**: entidades de domínio
- Erros são tratados por um **middleware global** e registrados em `api/system/log.log`

## Estrutura de pastas

```
TCC-Banco-de-Horas-main/
├── index.js              # Ponto de entrada
├── Server.js             # Configuração do Express e injeção de dependências
├── .env.example          # Modelo das variáveis de ambiente
├── api/
│   ├── controllers/      # Controllers (um por área do sistema)
│   ├── services/         # Regras de negócio
│   ├── dao/              # Acesso ao banco de dados
│   ├── models/           # Entidades de domínio
│   ├── middleware/       # Autenticação, permissões e validações
│   ├── routes/           # Definição das rotas da API
│   ├── database/         # Conexão MySQL (pool)
│   ├── http/             # Classe do token JWT
│   ├── utils/            # Logger, ErrorResponse, cálculo de horas
│   └── system/           # Logs da aplicação
├── docs/
│   ├── Banco.sql         # Criação do banco + dados iniciais (seed)
│   └── SETUP.md          # Guia de instalação detalhado
└── static/               # Frontend (páginas, scripts, estilos e imagens)
    ├── index.html
    ├── css/  js/  img/  paginas/
```

## Requisitos

- **Node.js** 18 ou superior
- **MySQL** 8

## Como rodar

1. **Instale as dependências**

   ```bash
   npm install
   ```

2. **Crie o banco de dados**

   ```bash
   mysql -u root -p < docs/Banco.sql
   ```

   > Atenção: o script contém `DROP DATABASE IF EXISTS cronasys` — ele apaga e recria a base. Use com cuidado se já houver dados.

3. **Configure as variáveis de ambiente**

   Copie `.env.example` para `.env` e preencha com os dados do seu ambiente (porta, acesso ao MySQL e segredo do JWT). O `.env` não deve ser versionado.

4. **Inicie o sistema**

   ```bash
   npm start
   ```

   A aplicação sobe em `http://localhost:3000`.

## Acessos de teste (seed)

O `Banco.sql` cria dois usuários de exemplo (senha: **123**):

| Perfil        | E-mail                       | Acesso                     |
| ------------- | ---------------------------- | -------------------------- |
| Administrador | `admin@cronasys.local`       | Todas as telas e ações     |
| Funcionário   | `funcionario@cronasys.local` | Telas do próprio usuário   |

> Recomenda-se trocar essas senhas (ou remover os usuários de exemplo) em qualquer ambiente real.

## Segurança

- Senhas armazenadas com **bcrypt**
- Autenticação por **token JWT** em todas as rotas da API
- Rotas administrativas restritas ao perfil **ADM**
- Ações críticas (backup, exclusões, configuração de e-mail) exigem **confirmação com senha**
- Consultas ao banco com **prepared statements** (proteção contra SQL Injection)
- **Auditoria** de criações, edições e exclusões

## Documentação adicional

- Guia de instalação detalhado: [`docs/SETUP.md`](docs/SETUP.md)
- Script do banco e dados iniciais: [`docs/Banco.sql`](docs/Banco.sql)

---

Desenvolvido como Trabalho de Conclusão de Curso — IF Informática.