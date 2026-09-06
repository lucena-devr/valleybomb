# Corpo de Bombeiros Norte · Salvamento 35 🚒🚨

Aplicativo web tático de compartilhamento de tela com áudio e comunicação em tempo real, construído com **Node.js**, **Socket.io**, **WebRTC** e estilizado com a identidade visual militar do **Corpo de Bombeiros Norte - Salvamento 35**.

---

## ✨ Funcionalidades Operacionais

- 🎙️ **Despacho & Rádio Tático**:
  - Barra lateral com lista de combatentes em prontidão em tempo real, avatares dinâmicos e insígnias (`COMANDO`, `CBN-35`).
  - Indicador `EM OPERAÇÃO / TRANSMITINDO TELA` com atalho de um clique para acompanhar a transmissão.
- 💻 **Transmissão de Ocorrência Sob Demanda**:
  - Transmissão de tela com áudio do sistema/aba em alta definição.
  - Lobby tático de prontidão quando não houver transmissão ativa.
- 🔒 **Guarnições com Chave Restrita (Senha)**:
  - Opção de trancar guarnições para acesso restrito com validação segura no WebSocket.
- 📱 **Controles Flutuantes & Tela Cheia**:
  - Tela cheia via botão superior, barra flutuante, duplo clique no vídeo ou tecla <kbd>F</kbd>.
  - Controle de volume e mudo local individual para cada combatente.
- 💬 **Rádio & Chat Integrado**:
  - Gaveta retrátil de comunicação com timestamps e indicador de novas mensagens.
- ⚡ **100% no Navegador**:
  - Funciona direto no Chrome, Edge, Brave, etc. Via conexões P2P WebRTC sem necessidade de instalar programas ou criar contas.

---

## 🛠️ Tecnologias Utilizadas

- **Back-end**: Node.js, Express, Socket.io
- **Front-end**: HTML5, CSS3 tático (estilo militar/bombeiros), Vanilla JavaScript, FontAwesome 6
- **Tipografia**: Anton & Rajdhani (Google Fonts)
- **Comunicação em Tempo Real**: WebSockets (Signaling) e WebRTC Mesh P2P com suporte a STUN

---

## 🚀 Como Rodar Localmente

1. Acesse a pasta do projeto:
```bash
cd C:\Users\lucen\Documents\bombeiros-norte
```

2. Instale as dependências:
```bash
npm install
```

3. Inicie o servidor:
```bash
npm start
# ou
node server.js
```

4. Acesse no navegador:
```
http://localhost:3000
```

---

## 🌐 Deploy no Render

O projeto já vem 100% configurado para rodar no **Render**:
- Script de inicialização `"start": "node server.js"` definido no `package.json`.
- Reconhecimento automático da porta via `process.env.PORT || 3000`.
- Suporte nativo a WebSockets contínuos.
