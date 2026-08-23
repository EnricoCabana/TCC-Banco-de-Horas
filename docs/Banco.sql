-- =============================================================
-- PROJETO: CronaSys - Gestão de Banco de Horas
-- VERSÃO: 12.0 - Escala flexível (7 metas) + cálculo no Node + feriados 2026
-- =============================================================
--
-- MUDANÇAS DESTA VERSÃO:
--   1. A tabela `usuarios` tem uma meta por dia da semana
--      (meta_dom ... meta_sab), permitindo escalas flexíveis.
--      Folga = 0 minutos naquele dia; 4h = 240; 8h = 480.
--   2. Quem calcula as horas é o Node (camada Service). Os dois
--      triggers abaixo só protegem meses já fechados contra edição
--      (é a única regra de negócio que mora no banco).
--   3. Os feriados nacionais de 2026 já vêm cadastrados. Em um feriado,
--      o cálculo (no Node) zera a meta do dia automaticamente.
--   4. Script simplificado: sem stored procedure e sem views (nenhuma
--      das duas era usada pelo Node — o fechamento de mês e as
--      consultas de relatório já são feitos em JS, então elas só
--      duplicavam lógica sem servir pra nada).
-- =============================================================

SET NAMES utf8mb4;
SET FOREIGN_KEY_CHECKS = 0;
DROP DATABASE IF EXISTS cronasys;
CREATE DATABASE cronasys CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE cronasys;
SET FOREIGN_KEY_CHECKS = 1;

-- -----------------------------------------------------
-- 1. ESTRUTURA ORGANIZACIONAL
-- -----------------------------------------------------

CREATE TABLE setores (
    id_setor INT PRIMARY KEY AUTO_INCREMENT,
    nome_setor VARCHAR(50) NOT NULL UNIQUE,
    ativo BOOLEAN NOT NULL DEFAULT TRUE
);

CREATE TABLE tipos_ocorrencia (
    id_ocorrencia INT PRIMARY KEY AUTO_INCREMENT,
    descricao VARCHAR(50) NOT NULL UNIQUE,
    cor_hex VARCHAR(7),
    abona_meta BOOLEAN DEFAULT FALSE
);

CREATE TABLE feriados (
    data_feriado DATE PRIMARY KEY,
    descricao VARCHAR(50) NOT NULL,
    tipo ENUM('NACIONAL','ESTADUAL','MUNICIPAL') NOT NULL DEFAULT 'NACIONAL'
);

-- -----------------------------------------------------
-- 2. USUÁRIOS E SEGURANÇA
-- -----------------------------------------------------

CREATE TABLE usuarios (
    id_usuario INT PRIMARY KEY AUTO_INCREMENT,
    nome VARCHAR(100) NOT NULL,
    cargo VARCHAR(50),
    id_setor INT,
    matricula VARCHAR(20) UNIQUE NOT NULL,
    email VARCHAR(100) UNIQUE,
    senha VARCHAR(255),
    tipo_acesso ENUM('ADM', 'PADRAO') DEFAULT 'PADRAO',
    ativo BOOLEAN DEFAULT TRUE,
    -- Marca quem NÃO participa do controle de ponto (dono/diretoria).
    isento_ponto BOOLEAN DEFAULT FALSE,
    -- Escala flexível: meta (em minutos) para cada dia da semana.
    meta_dom INT DEFAULT 0,
    meta_seg INT DEFAULT 480,
    meta_ter INT DEFAULT 480,
    meta_qua INT DEFAULT 480,
    meta_qui INT DEFAULT 480,
    meta_sex INT DEFAULT 480,
    meta_sab INT DEFAULT 0,
    foto_perfil MEDIUMTEXT,
    data_aniversario DATE,
    celular VARCHAR(15),
    contato_emergencia_nome VARCHAR(100),
    contato_emergencia_tel VARCHAR(15),
    data_criacao TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    reset_codigo VARCHAR(10),
    reset_expira DATETIME,
    CONSTRAINT fk_usuario_setor FOREIGN KEY (id_setor) REFERENCES setores(id_setor)
);

CREATE TABLE documentos (
    id_usuario INT PRIMARY KEY,
    cpf CHAR(11) UNIQUE NOT NULL,
    rg VARCHAR(20),
    cartao_sus VARCHAR(20),
    carteira_trabalho VARCHAR(30),
    CONSTRAINT fk_doc_usuario FOREIGN KEY (id_usuario) REFERENCES usuarios(id_usuario) ON DELETE CASCADE
);

CREATE TABLE enderecos (
    id_usuario INT PRIMARY KEY,
    rua VARCHAR(100),
    num VARCHAR(10),
    bairro VARCHAR(50),
    cidade VARCHAR(50),
    cep CHAR(8),
    CONSTRAINT fk_end_usuario FOREIGN KEY (id_usuario) REFERENCES usuarios(id_usuario) ON DELETE CASCADE
);

-- -----------------------------------------------------
-- 3. MOVIMENTAÇÃO E COMUNICAÇÃO
-- -----------------------------------------------------

CREATE TABLE ponto (
    id_ponto INT PRIMARY KEY AUTO_INCREMENT,
    id_usuario INT NOT NULL,
    data_ref DATE NOT NULL,
    ent1 TIME, sai1 TIME, ent2 TIME, sai2 TIME,
    id_ocorrencia INT DEFAULT 1,
    meta_do_dia INT,
    total_dia_minutos INT DEFAULT 0,
    saldo_dia_minutos INT DEFAULT 0,
    justificativa VARCHAR(255),
    comprovante_url VARCHAR(255),
    editado_pelo_rh BOOLEAN DEFAULT FALSE,
    fechado BOOLEAN DEFAULT FALSE,
    CONSTRAINT fk_ponto_usuario FOREIGN KEY (id_usuario) REFERENCES usuarios(id_usuario),
    CONSTRAINT fk_ponto_ocorrencia FOREIGN KEY (id_ocorrencia) REFERENCES tipos_ocorrencia(id_ocorrencia),
    UNIQUE KEY (id_usuario, data_ref)
);

CREATE TABLE solicitacoes (
    id_solicitacao    INT PRIMARY KEY AUTO_INCREMENT,
    id_usuario        INT NOT NULL,
    data_ref          DATE NOT NULL,
    id_ocorrencia     INT NOT NULL,
    mensagem          VARCHAR(255) NOT NULL,
    status            ENUM('Pendente', 'Aprovado', 'Negado') NOT NULL DEFAULT 'Pendente',
    id_aprovador      INT,
    data_solicitacao  TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    data_resposta     TIMESTAMP NULL,
    CONSTRAINT fk_solicitacao_usuario FOREIGN KEY (id_usuario) REFERENCES usuarios(id_usuario),
    CONSTRAINT fk_solicitacao_ocorrencia FOREIGN KEY (id_ocorrencia) REFERENCES tipos_ocorrencia(id_ocorrencia),
    CONSTRAINT fk_solicitacao_aprovador FOREIGN KEY (id_aprovador) REFERENCES usuarios(id_usuario)
);

CREATE TABLE avisos (
    id_aviso      INT PRIMARY KEY AUTO_INCREMENT,
    titulo        VARCHAR(200) NOT NULL,
    mensagem      TEXT NOT NULL,
    tipo          ENUM('geral', 'importante', 'comemorativo') NOT NULL DEFAULT 'geral',
    data_criacao  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    id_autor      INT NULL,
    CONSTRAINT fk_avisos_autor FOREIGN KEY (id_autor) REFERENCES usuarios(id_usuario) ON DELETE SET NULL
);

-- -----------------------------------------------------
-- 4. GESTÃO E AUDITORIA
-- -----------------------------------------------------

CREATE TABLE fechamentos_mensais (
    id_fechamento INT PRIMARY KEY AUTO_INCREMENT,
    id_usuario INT NOT NULL,
    mes_ref TINYINT NOT NULL,
    ano_ref SMALLINT NOT NULL,
    total_horas_formatado VARCHAR(10),
    saldo_mes_minutos INT DEFAULT 0,
    saldo_acumulado_minutos INT DEFAULT 0,
    observacao TEXT,
    data_fechamento TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_fechamento_usuario FOREIGN KEY (id_usuario) REFERENCES usuarios(id_usuario),
    UNIQUE KEY (id_usuario, mes_ref, ano_ref)
);

CREATE TABLE auditoria (
    id_auditoria  INT PRIMARY KEY AUTO_INCREMENT,
    data_registro TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    acao          ENUM('CRIAR', 'EDITAR', 'EXCLUIR') NOT NULL,
    entidade      VARCHAR(40) NOT NULL,
    entidade_id   VARCHAR(60),
    descricao     VARCHAR(255),
    valor_antigo  VARCHAR(255),
    valor_novo    VARCHAR(255),
    executor_id   INT,
    executor_nome VARCHAR(100)
);

-- Configuração de SMTP (envio de e-mail) — uma única linha (id_config = 1)
CREATE TABLE configuracao_smtp (
    id_config       INT PRIMARY KEY AUTO_INCREMENT,
    host            VARCHAR(255),
    porta           INT DEFAULT 587,
    seguranca       ENUM('SSL', 'STARTTLS', 'NENHUMA') DEFAULT 'STARTTLS',
    usuario         VARCHAR(255),
    senha           VARCHAR(255),
    remetente_nome  VARCHAR(120),
    remetente_email VARCHAR(255),
    ativo           BOOLEAN DEFAULT FALSE,
    atualizado_em   TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- -----------------------------------------------------
-- 5. CARGA INICIAL
-- -----------------------------------------------------

INSERT INTO tipos_ocorrencia (descricao, cor_hex, abona_meta) VALUES
('Trabalho Normal', '#FFFFFF', FALSE),
('Atestado', '#93C5FD', TRUE),
('Folga', '#C0C0C0', TRUE),
('Feriado', '#6495ED', TRUE),
('Férias', '#5EEAD4', TRUE),
('Falta Justificada', '#F0A868', FALSE),
('Falta Não Justificada', '#F08080', FALSE),
('Licença Nojo/Luto', '#FFA500', TRUE),
('Meio Período', '#FDE68A', TRUE),
('Treinamento', '#86EFAC', TRUE)
ON DUPLICATE KEY UPDATE
    cor_hex=VALUES(cor_hex),
    abona_meta=VALUES(abona_meta);

INSERT INTO setores (nome_setor) VALUES
('Técnico'), ('Vendas'), ('Administrativo'), ('Logística')
ON DUPLICATE KEY UPDATE nome_setor=VALUES(nome_setor);

-- Feriados nacionais de 2026 (incluindo os pontos facultativos mais
-- observados por escolas: Carnaval e Corpus Christi).
-- Feriados estaduais/municipais e recessos do colégio devem ser
-- adicionados pelo RH na tela de gestão de feriados.
INSERT INTO feriados (data_feriado, descricao) VALUES
('2026-01-01', 'Confraternização Universal'),
('2026-02-16', 'Carnaval'),
('2026-02-17', 'Carnaval'),
('2026-04-03', 'Sexta-feira Santa'),
('2026-04-21', 'Tiradentes'),
('2026-05-01', 'Dia do Trabalho'),
('2026-06-04', 'Corpus Christi'),
('2026-09-07', 'Independência do Brasil'),
('2026-10-12', 'Nossa Senhora Aparecida'),
('2026-11-02', 'Finados'),
('2026-11-15', 'Proclamação da República'),
('2026-11-20', 'Consciência Negra'),
('2026-12-25', 'Natal')
ON DUPLICATE KEY UPDATE descricao=VALUES(descricao);

INSERT INTO avisos (titulo, mensagem, tipo) VALUES
('Bem-vindo ao CronaSys!',
 'O sistema de gestão de banco de horas foi atualizado.',
 'geral'),
('Reunião Obrigatória',
 'Fica convocada reunião geral nesta sexta-feira às 14h.',
 'importante'),
(CONCAT('Parabéns, equipe! ', YEAR(CURDATE()), ' anos de história!'),
 'Obrigado por fazer parte dessa jornada!',
 'comemorativo')
ON DUPLICATE KEY UPDATE mensagem=VALUES(mensagem);

-- -----------------------------------------------------
-- 6. INTELIGÊNCIA (TRIGGERS) - apenas proteção, sem cálculo
-- -----------------------------------------------------
-- O cálculo de horas agora é feito no Node (camada Service).
-- Os triggers só impedem alterações em meses já fechados.

DELIMITER $$

CREATE TRIGGER tr_ponto_bi BEFORE INSERT ON ponto
FOR EACH ROW
BEGIN
    DECLARE v_fechado INT;

    SELECT COUNT(*) INTO v_fechado FROM fechamentos_mensais
    WHERE id_usuario = NEW.id_usuario
      AND mes_ref = MONTH(NEW.data_ref)
      AND ano_ref = YEAR(NEW.data_ref);

    IF v_fechado > 0 THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Erro: Mês já encerrado para este usuário.';
    END IF;
END$$

CREATE TRIGGER tr_ponto_bu BEFORE UPDATE ON ponto
FOR EACH ROW
BEGIN
    DECLARE v_fechado INT;

    -- Bloqueio depende da EXISTÊNCIA do fechamento (permite reabrir).
    SELECT COUNT(*) INTO v_fechado FROM fechamentos_mensais
    WHERE id_usuario = NEW.id_usuario
      AND mes_ref = MONTH(NEW.data_ref)
      AND ano_ref = YEAR(NEW.data_ref);

    IF v_fechado > 0 THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Erro: Registro bloqueado por fechamento mensal.';
    END IF;
END$$

DELIMITER ;

-- -----------------------------------------------------
-- 7. ACESSOS E DADOS DE EXEMPLO
-- -----------------------------------------------------
-- Senhas criptografadas com bcrypt. O hash abaixo corresponde à senha '123'
-- (entre com '123'; o login compara via bcrypt.compare).

INSERT INTO usuarios
    (nome, cargo, id_setor, matricula, email, senha, tipo_acesso,
     meta_dom, meta_seg, meta_ter, meta_qua, meta_qui, meta_sex, meta_sab)
VALUES
    -- Administrador: seg a sex 8h, sem sábado/domingo.
    ('Administrador', 'Administrador', 3, 'ADM-001', 'admin@cronasys.local', '$2b$12$Shr1lAdIZ7xm026MqmWfKeci2IQdP.EcNAKpFfHYvoC1N7C6QUr8a', 'ADM',
     0, 480, 480, 480, 480, 480, 0),
    -- Funcionário (exemplo de escala flexível): folga na quarta e 4h no sábado.
    ('Funcionário', 'Funcionário', 1, 'FUN-001', 'funcionario@cronasys.local', '$2b$12$Shr1lAdIZ7xm026MqmWfKeci2IQdP.EcNAKpFfHYvoC1N7C6QUr8a', 'PADRAO',
     0, 480, 480, 0, 480, 480, 240);

-- Ponto de exemplo já com meta/total/saldo calculados (como o Node faria).
INSERT INTO ponto
    (id_usuario, data_ref, ent1, sai1, ent2, sai2, id_ocorrencia, meta_do_dia, total_dia_minutos, saldo_dia_minutos)
VALUES
    (2, '2026-05-04', '08:00:00', '12:00:00', '13:00:00', '17:00:00', 1, 480, 480, 0),
    (2, '2026-05-05', '08:05:00', '12:00:00', '13:00:00', '17:10:00', 1, 480, 485, 5),
    (2, '2026-05-09', NULL, NULL, NULL, NULL,
     (SELECT id_ocorrencia FROM tipos_ocorrencia WHERE descricao = 'Folga' LIMIT 1), 240, 0, 0);

-- -----------------------------------------------------
-- 8. PONTO DE JULHO/2026 (FUN-001) - dados para os prints
--     das Figuras 1 e 2 do artigo: mês fechado, com saldos
--     diários positivos e negativos e vários tipos de
--     ocorrência (Normal, Atestado, Folga, Treinamento,
--     Falta Justificada, Falta Não Justificada e
--     Licença Nojo/Luto).
-- -----------------------------------------------------

INSERT INTO ponto
    (id_usuario, data_ref, ent1, sai1, ent2, sai2, id_ocorrencia, meta_do_dia, total_dia_minutos, saldo_dia_minutos)
VALUES
    -- Sábado 04/07: Folga (ocorrência explícita)
    (2, '2026-07-04', NULL, NULL, NULL, NULL,
     (SELECT id_ocorrencia FROM tipos_ocorrencia WHERE descricao = 'Folga' LIMIT 1), 240, 0, 0),
    -- Segunda 06/07: Normal, jornada exata
    (2, '2026-07-06', '08:00:00', '12:00:00', '13:00:00', '17:00:00',
     (SELECT id_ocorrencia FROM tipos_ocorrencia WHERE descricao = 'Trabalho Normal' LIMIT 1), 480, 480, 0),
    -- Terça 07/07: Normal, com 1h de hora extra (saldo positivo)
    (2, '2026-07-07', '08:00:00', '12:00:00', '13:00:00', '18:00:00',
     (SELECT id_ocorrencia FROM tipos_ocorrencia WHERE descricao = 'Trabalho Normal' LIMIT 1), 480, 540, 60),
    -- Quinta 09/07: Normal, jornada exata
    (2, '2026-07-09', '08:00:00', '12:00:00', '13:00:00', '17:00:00',
     (SELECT id_ocorrencia FROM tipos_ocorrencia WHERE descricao = 'Trabalho Normal' LIMIT 1), 480, 480, 0),
    -- Sexta 10/07: Falta Não Justificada (saldo bem negativo)
    (2, '2026-07-10', NULL, NULL, NULL, NULL,
     (SELECT id_ocorrencia FROM tipos_ocorrencia WHERE descricao = 'Falta Não Justificada' LIMIT 1), 480, 0, -480),
    -- Sábado 11/07: Normal, jornada exata (meta reduzida de sábado)
    (2, '2026-07-11', '08:00:00', '12:00:00', NULL, NULL,
     (SELECT id_ocorrencia FROM tipos_ocorrencia WHERE descricao = 'Trabalho Normal' LIMIT 1), 240, 240, 0),
    -- Segunda 13/07: Atestado (abonado)
    (2, '2026-07-13', NULL, NULL, NULL, NULL,
     (SELECT id_ocorrencia FROM tipos_ocorrencia WHERE descricao = 'Atestado' LIMIT 1), 480, 0, 0),
    -- Terça 14/07: Normal, jornada exata
    (2, '2026-07-14', '08:00:00', '12:00:00', '13:00:00', '17:00:00',
     (SELECT id_ocorrencia FROM tipos_ocorrencia WHERE descricao = 'Trabalho Normal' LIMIT 1), 480, 480, 0),
    -- Quinta 16/07: Normal, chegou atrasado (saldo negativo)
    (2, '2026-07-16', '08:30:00', '12:00:00', '13:00:00', '17:00:00',
     (SELECT id_ocorrencia FROM tipos_ocorrencia WHERE descricao = 'Trabalho Normal' LIMIT 1), 480, 450, -30),
    -- Sexta 17/07: Treinamento (abonado)
    (2, '2026-07-17', NULL, NULL, NULL, NULL,
     (SELECT id_ocorrencia FROM tipos_ocorrencia WHERE descricao = 'Treinamento' LIMIT 1), 480, 0, 0),
    -- Sábado 18/07: Normal, jornada exata
    (2, '2026-07-18', '08:00:00', '12:00:00', NULL, NULL,
     (SELECT id_ocorrencia FROM tipos_ocorrencia WHERE descricao = 'Trabalho Normal' LIMIT 1), 240, 240, 0),
    -- Segunda 20/07: Falta Justificada (não abona, saldo negativo)
    (2, '2026-07-20', NULL, NULL, NULL, NULL,
     (SELECT id_ocorrencia FROM tipos_ocorrencia WHERE descricao = 'Falta Justificada' LIMIT 1), 480, 0, -480),
    -- Terça 21/07: Normal, com 1h30 de hora extra (saldo bem positivo)
    (2, '2026-07-21', '08:00:00', '12:00:00', '13:00:00', '18:30:00',
     (SELECT id_ocorrencia FROM tipos_ocorrencia WHERE descricao = 'Trabalho Normal' LIMIT 1), 480, 570, 90),
    -- Quinta 23/07: Licença Nojo/Luto (abonado)
    (2, '2026-07-23', NULL, NULL, NULL, NULL,
     (SELECT id_ocorrencia FROM tipos_ocorrencia WHERE descricao = 'Licença Nojo/Luto' LIMIT 1), 480, 0, 0),
    -- Sexta 24/07: Normal, jornada exata
    (2, '2026-07-24', '08:00:00', '12:00:00', '13:00:00', '17:00:00',
     (SELECT id_ocorrencia FROM tipos_ocorrencia WHERE descricao = 'Trabalho Normal' LIMIT 1), 480, 480, 0),
    -- Sábado 25/07: Falta Não Justificada
    (2, '2026-07-25', NULL, NULL, NULL, NULL,
     (SELECT id_ocorrencia FROM tipos_ocorrencia WHERE descricao = 'Falta Não Justificada' LIMIT 1), 240, 0, -240),
    -- Segunda 27/07: Normal, jornada exata
    (2, '2026-07-27', '08:00:00', '12:00:00', '13:00:00', '17:00:00',
     (SELECT id_ocorrencia FROM tipos_ocorrencia WHERE descricao = 'Trabalho Normal' LIMIT 1), 480, 480, 0),
    -- Terça 28/07: Normal, com 45min de hora extra (saldo positivo)
    (2, '2026-07-28', '08:00:00', '12:00:00', '13:00:00', '17:45:00',
     (SELECT id_ocorrencia FROM tipos_ocorrencia WHERE descricao = 'Trabalho Normal' LIMIT 1), 480, 525, 45),
    -- Quinta 30/07: Meio Período (trabalhou só a manhã, resto abonado)
    (2, '2026-07-30', '08:00:00', '12:00:00', NULL, NULL,
     (SELECT id_ocorrencia FROM tipos_ocorrencia WHERE descricao = 'Meio Período' LIMIT 1), 480, 240, 0),
    -- Sexta 31/07: Normal, chegou atrasado e saiu mais cedo (saldo negativo)
    (2, '2026-07-31', '08:15:00', '12:00:00', '13:00:00', '16:45:00',
     (SELECT id_ocorrencia FROM tipos_ocorrencia WHERE descricao = 'Trabalho Normal' LIMIT 1), 480, 420, -60);

-- -----------------------------------------------------
-- 9. SOLICITAÇÕES DE EXEMPLO
-- -----------------------------------------------------
-- Uma de cada status, só pra a tela de Solicitações não nascer vazia.

INSERT INTO solicitacoes (id_usuario, data_ref, id_ocorrencia, mensagem, status, id_aprovador, data_resposta)
VALUES
    -- Pendente: ainda esperando o RH analisar.
    (2, '2026-08-05',
     (SELECT id_ocorrencia FROM tipos_ocorrencia WHERE descricao = 'Atestado' LIMIT 1),
     'Esqueci de anexar o atestado médico no dia, segue para lançamento.',
     'Pendente', NULL, NULL),
    -- Aprovada pelo administrador (id_usuario 1).
    (2, '2026-07-16',
     (SELECT id_ocorrencia FROM tipos_ocorrencia WHERE descricao = 'Trabalho Normal' LIMIT 1),
     'Bati o ponto de saída errado, cheguei às 08:30 e não 08:00.',
     'Aprovado', 1, '2026-07-17 09:10:00'),
    -- Negada pelo administrador.
    (2, '2026-07-10',
     (SELECT id_ocorrencia FROM tipos_ocorrencia WHERE descricao = 'Falta Justificada' LIMIT 1),
     'Falta no dia 10/07, favor justificar como consulta médica.',
     'Negado', 1, '2026-07-11 14:20:00');