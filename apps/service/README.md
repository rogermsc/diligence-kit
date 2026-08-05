# Diligence Kit Service — NestJS backend API

> This document is in Portuguese. See the root [README](../../README.md) and [CLAUDE.md](../../CLAUDE.md) for English.

## 📋 Sobre o Projeto

**Diligence Kit Service** é uma API REST desenvolvida em Node.js/TypeScript usando o framework NestJS. O projeto implementa um sistema de automação inteligente para análise de empresas através de documentos de dataroom, utilizando integração com agentes de IA para processamento e análise automatizada.

### Principais Funcionalidades

- **Gestão de Empresas**: Cadastro, listagem e detalhamento de empresas
- **Sistema de Automação**: Upload e processamento inteligente de documentos organizados por categorias
- **Integração com IA**: Análise automatizada através de agentes especializados
- **Autenticação JWT**: Sistema seguro de login e refresh tokens
- **Storage Cloud**: Integração com Google Cloud Storage
- **Processamento Assíncrono**: Uso de filas Redis e RabbitMQ

## 🏗️ Arquitetura

O projeto segue os princípios de **Clean Architecture**, **Domain-Driven Design (DDD)** e **Arquitetura Hexagonal**, garantindo:

- Separação clara de responsabilidades
- Baixo acoplamento entre módulos
- Facilidade para testes e manutenção
- Flexibilidade para mudanças

## 🛠️ Stack Tecnológica

### Backend
- **Node.js 22+** - Runtime JavaScript
- **TypeScript 5.7** - Linguagem de programação
- **NestJS 11** - Framework web
- **Prisma 6.10** - ORM e gerenciamento de banco de dados
- **PostgreSQL** - Banco de dados relacional
- **Zod 3.25** - Validação de esquemas

### Infraestrutura
- **Docker & Docker Compose** - Containerização
- **Google Cloud Storage** - Armazenamento de arquivos
- **Redis** - Cache e filas
- **RabbitMQ** - Message broker para comunicação entre microserviços
- **JWT** - Autenticação e autorização

## 📊 Pré-requisitos

- Node.js 22+
- Docker e Docker Compose
- PostgreSQL 15+
- Redis 7+
- RabbitMQ 3.11+
- Conta Google Cloud com Storage habilitado

# ⚙️ Configuração

### 1. Clonagem do Repositório

```bash
git clone <repository-url>
cd diligence-kit
```

### 2. Instalação das Dependências

```bash
npm install
```

### 3. Configuração das Variáveis de Ambiente

Copie o arquivo `.env.example` para `.env` e configure as variáveis:

```bash
cp .env.example .env
```

#### Variáveis Obrigatórias

```env
# Database
DATABASE_NAME=diligence_kit_db
DATABASE_USER=postgres
DATABASE_PASSWORD=your_password
DB_PORT=5432
DATABASE_URL="postgresql://${DATABASE_USER}:${DATABASE_PASSWORD}@localhost:5432/${DATABASE_NAME}?schema=public"

# Server
PORT=3001

# Google Cloud Storage
GOOGLE_APPLICATION_CREDENTIALS=./.gcp/credentials.json
GCLOUD_STORAGE_BUCKET=your-bucket-name

# Agent API
AGENT_API_URL="http://localhost:3000"

# Email Configuration
EMAIL_SENDER="sender@example.com"
EMAIL_DESTINATION="destination@example.com"
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-app-password
SMTP_SECURE=false

# JWT
JWT_SECRET="your-super-secret-jwt-key"
JWT_EXPIRES_IN="24h"

# Redis
REDIS_HOST=localhost
REDIS_PORT=6381

# RabbitMQ
RABBITMQ_URL=amqp://localhost:5672
RABBITMQ_DEFAULT_USER=guest
RABBITMQ_DEFAULT_PASS=guest
```

### 4. Configuração do Google Cloud Storage

1. Crie uma conta de serviço no Google Cloud Console
2. Baixe o arquivo de credenciais JSON
3. Coloque o arquivo em `.gcp/credentials.json`
4. Crie um bucket no Google Cloud Storage
5. Configure o nome do bucket na variável `GCLOUD_STORAGE_BUCKET`

## 🚀 Execução

### Ambiente de Desenvolvimento (Recomendado)

#### 1. Subir os Serviços de Infraestrutura

```bash
# Inicia PostgreSQL, Redis e RabbitMQ
docker-compose -f docker-compose.dev.yml up -d
```

Isso iniciará:
- **PostgreSQL** na porta 5432
- **Redis** na porta 6381  
- **RabbitMQ** na porta 5672 (interface web na 15672)

#### 2. Executar as Migrações do Banco

```bash
npx prisma migrate deploy
```

#### 3. Criar um Usuário (já que não há signup)

```bash
npm run create:user admin@example.com mypassword123
```

#### 4. Iniciar a Aplicação

```bash
# Modo desenvolvimento com watch
npm run start:dev

# Ou modo debug
npm run start:debug
```

A API estará disponível em: `http://localhost:3001`

### Ambiente de Produção (Docker Completo)

```bash
# Build e start de todos os serviços
docker-compose up -d

# Executar migrações
docker exec diligence-kit-service npx prisma migrate deploy

# Criar usuário
docker exec diligence-kit-service npm run create:user admin@example.com mypassword123
```

## 📚 Documentação da API

Com a aplicação rodando, acesse a documentação Swagger em:
```
http://localhost:3001/api
```

### Principais Endpoints

#### Autenticação
- `POST /auth/login` - Login do usuário
- `POST /auth/refresh` - Renovar token de acesso

#### Empresas
- `GET /companies` - Listar empresas
- `POST /companies` - Criar empresa
- `GET /companies/:id` - Detalhes da empresa

#### Automações
- `POST /automation/upload` - Upload de documentos
- `POST /automation/upload-zip` - Upload via arquivo ZIP
- `GET /automation/:id/status` - Status da automação
- `GET /automation/:id/documents` - Documentos da automação

## 🗄️ Banco de Dados

### Estrutura Principal

```sql
-- Usuários do sistema
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email VARCHAR UNIQUE NOT NULL,
    password VARCHAR NOT NULL,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Empresas
CREATE TABLE companies (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR NOT NULL,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Automações
CREATE TABLE automations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID REFERENCES companies(id),
    status VARCHAR DEFAULT 'PENDING', -- PENDING, PROCESSING, COMPLETED, FAILED
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);
```

### Query para Criar Usuário Manualmente

```sql
-- Substitua 'your-email@example.com' e 'hashed-password'
INSERT INTO users (id, email, password, created_at) 
VALUES (
    gen_random_uuid(), 
    'your-email@example.com', 
    '$2a$10$your-bcrypt-hashed-password', 
    NOW()
);
```

> **Dica**: Use o script `npm run create:user` para hash automático da senha.

## 🧪 Testes

```bash
# Testes unitários
npm run test

# Testes e2e
npm run test:e2e

# Coverage
npm run test:cov

# Testes em watch mode
npm run test:watch
```

## 🐳 Serviços Docker

### Desenvolvimento (`docker-compose.dev.yml`)
- **PostgreSQL**: porta 5432
- **Redis**: porta 6381
- **RabbitMQ**: porta 5672 (Management UI: 15672)

### Produção (`docker-compose.yml`)
- **API**: porta 3001
- **PostgreSQL**: porta 5432
- **Redis**: porta 6381

### Comandos Úteis

```bash
# Ver logs dos serviços
docker-compose -f docker-compose.dev.yml logs -f

# Parar serviços
docker-compose -f docker-compose.dev.yml down

# Remover volumes (CUIDADO: apaga dados)
docker-compose -f docker-compose.dev.yml down -v

# Acessar container do PostgreSQL
docker exec -it diligence-kit-db psql -U postgres -d diligence_kit_db

# Acessar RabbitMQ Management
# http://localhost:15672 (guest/guest)
```

## 🔧 Scripts Disponíveis

```bash
# Desenvolvimento
npm run start:dev          # Inicia em modo desenvolvimento
npm run start:debug        # Inicia em modo debug
npm run build              # Build da aplicação
npm run start:prod         # Inicia em modo produção

# Qualidade de Código
npm run lint               # Executar ESLint
npm run format             # Formatar código com Prettier

# Banco de Dados
npx prisma migrate dev     # Criar nova migração
npx prisma migrate deploy  # Aplicar migrações
npx prisma studio          # Interface visual do banco
npx prisma generate        # Gerar cliente Prisma

# Usuários
npm run create:user <email> <password>  # Criar novo usuário
```

## 🔒 Segurança

- **JWT** para autenticação
- **Bcrypt** para hash de senhas
- **CORS** configurado
- **Validação** rigorosa com Zod
- **Variáveis de ambiente** para dados sensíveis

## 🚨 Troubleshooting

### Problemas Comuns

1. **Erro de conexão com PostgreSQL**
   ```bash
   # Verificar se o serviço está rodando
   docker-compose -f docker-compose.dev.yml ps
   
   # Verificar logs
   docker-compose -f docker-compose.dev.yml logs db
   ```

2. **Erro de conexão com Redis**
   ```bash
   # Testar conexão
   docker exec -it diligence-kit-redis redis-cli ping
   ```

3. **Erro de credenciais Google Cloud**
   ```bash
   # Verificar se o arquivo existe
   ls -la .gcp/credentials.json
   
   # Verificar variáveis de ambiente
   echo $GOOGLE_APPLICATION_CREDENTIALS
   ```

4. **Problema com migrações**
   ```bash
   # Reset do banco (CUIDADO: apaga dados)
   npx prisma migrate reset
   
   # Aplicar migrações
   npx prisma migrate deploy
   ```

## 📈 Monitoramento

### Logs da Aplicação
```bash
# Em desenvolvimento
npm run start:dev

# Em produção com Docker
docker logs diligence-kit-service -f
```

### Métricas dos Serviços
- **RabbitMQ Management**: http://localhost:15672
- **Logs PostgreSQL**: `docker logs diligence-kit-db`
- **Logs Redis**: `docker logs diligence-kit-redis`

## 📄 Licença

Este projeto está sob a licença AjuLabs.


