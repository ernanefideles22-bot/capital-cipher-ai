# Capital Cipher AI Backend

Backend MVP da plataforma Capital Cipher AI.

## Escopo da Sprint 1

Esta sprint cria apenas a base do backend:

- FastAPI;
- configuração centralizada;
- logs estruturados;
- endpoint `/health`;
- endpoint `/api/v1/status`;
- testes mínimos.

## Regra crítica

Este backend inicia em modo **PAPER** e não possui execução real de ordens.

Não há API key de corretora, não há live trading e não há adapter real de exchange nesta fase.

## Instalação local

```bash
cd backend
python -m venv .venv
source .venv/bin/activate  # Linux/Mac
# .venv\Scripts\activate   # Windows
pip install -e ".[dev]"
```

## Rodar API

```bash
uvicorn app.main:app --reload
```

## Rodar testes

```bash
pytest
```

## Endpoints iniciais

```text
GET /health
GET /api/v1/status
```
