# Setup do CRONASYS

## Instalar dependencias

```bash
npm ci
```

## Configurar variaveis de ambiente

Copie `.env.example` para `.env` e preencha os dados reais do ambiente.

O arquivo `.env` nao deve ser enviado ao GitHub, porque pode conter senha de banco, segredo de token e configuracoes locais.

## Criar banco MySQL

O arquivo `docs/Banco.sql` cria a base `cronasys` e as tabelas iniciais.

Atencao: o script atual contem `DROP DATABASE IF EXISTS cronasys`, entao ele apaga e recria a base. Use com cuidado em ambientes que ja tenham dados reais.

Exemplo em uma maquina ou VPS com MySQL:

```bash
mysql -u root -p < docs/Banco.sql
```

Depois crie um usuario de aplicacao e libere acesso apenas ao banco do projeto:

```sql
CREATE USER 'cronasys_app'@'localhost' IDENTIFIED BY 'senha-forte-aqui';
GRANT SELECT, INSERT, UPDATE, DELETE ON cronasys.* TO 'cronasys_app'@'localhost';
FLUSH PRIVILEGES;
```

No `.env`, use os dados desse usuario:

```env
DB_HOST=localhost
DB_PORT=3306
DB_USER=cronasys_app
DB_PASS=senha-forte-aqui
DB_NAME=cronasys
```

## Rodar o projeto

```bash
npm start
```

Por padrao, a aplicacao sobe em `http://localhost:3000`.