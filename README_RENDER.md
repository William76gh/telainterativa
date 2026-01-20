# Deploy no Render (plano Free) — Tela Resgate

Este projeto tem duas telas:

- **/** (celular): onde o responsavel digita o nome.
- **/lousa**: tela de atracao (animada) que mostra o bem-vindo quando recebe o nome do celular.

As telas sincronizam via **Flask-SocketIO**.

## Publicar no Render (sem pagar)

### 1) Suba o projeto no GitHub
1. Crie um repositorio no GitHub.
2. Envie o conteudo deste ZIP para o repo.

### 2) Crie um Web Service no Render
1. No Render, clique em **New +** -> **Web Service**.
2. Conecte seu GitHub e selecione o repositorio.
3. Configure:
   - **Environment**: Python
   - **Build Command**: `pip install -r requirements.txt`
   - **Start Command**: `python app.py`
   - Plano: **Free**
4. Clique em **Create Web Service**.

O Render define automaticamente a variavel **PORT** e o app ja usa isso.

## URLs (depois que estiver publicado)
- Celular: `https://SEU-SERVICO.onrender.com/`
- Lousa: `https://SEU-SERVICO.onrender.com/lousa`

O QR Code da lousa usa a URL do proprio servico (nao usa localhost), entao funciona no celular em qualquer rede.

## Observacoes importantes do plano Free
- No plano Free o servico pode "dormir" quando fica sem acesso por um tempo. Se isso acontecer, ao abrir o link ele pode demorar um pouco na primeira carga.
- Para uso de apenas 1-2 semanas, normalmente da certo.

## Admin (reset do dia)
Se voce quiser resetar o contador/ranking:
1. No Render, crie uma variavel de ambiente `ADMIN_TOKEN` (por exemplo: `resgate2026`).
2. Acesse:
   - `/admin/reset?token=SEU_TOKEN`

## Ajuste opcional de URL publica
Se voce quiser forcar qual URL aparece no QR, defina no Render:
- `PUBLIC_URL=https://SEU-SERVICO.onrender.com`

(Em geral nao precisa; o app detecta automaticamente.)
