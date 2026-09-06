const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

// Middleware para servir arquivos estáticos
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.json());

// Armazenar estado das salas: { roomId: { isLocked: boolean, password: '...', participants: Map(socketId -> { name, isHost, isStreaming, avatarColor }) } }
const rooms = {};

// Paleta de cores para avatares táticos do Corpo de Bombeiros Norte
const avatarColors = [
    'from-lime-400 to-emerald-600',
    'from-emerald-500 to-teal-700',
    'from-green-400 to-lime-600',
    'from-amber-500 to-yellow-600',
    'from-teal-400 to-emerald-700',
    'from-orange-500 to-red-700'
];

function generateRoomCode() {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let code = 'BN35-';
    for (let i = 0; i < 4; i++) {
        code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return code;
}

// API para criar uma nova guarnição/sala
app.post('/api/create-room', (req, res) => {
    const { isLocked, password } = req.body;
    const roomId = generateRoomCode();
    
    rooms[roomId] = {
        isLocked: isLocked || false,
        password: password || null,
        participants: new Map()
    };
    
    res.json({ roomId });
});

// API para verificar se uma guarnição precisa de senha ou existe
app.get('/api/room/:roomId/status', (req, res) => {
    const roomId = req.params.roomId.toUpperCase();
    const room = rooms[roomId];
    
    if (!room) {
        return res.status(404).json({ error: 'Guarnição não encontrada' });
    }
    
    res.json({ isLocked: room.isLocked });
});

// API para verificar a senha da guarnição
app.post('/api/room/:roomId/verify', (req, res) => {
    const roomId = req.params.roomId.toUpperCase();
    const { password } = req.body;
    const room = rooms[roomId];
    
    if (!room) {
        return res.status(404).json({ error: 'Guarnição não encontrada' });
    }
    
    if (room.isLocked && room.password !== password) {
        return res.status(401).json({ error: 'Senha incorreta', success: false });
    }
    
    res.json({ success: true });
});

// Rota da sala da guarnição
app.get('/room/:roomId', (req, res) => {
    res.sendFile('room.html', { root: path.join(__dirname, 'public') }, (err) => {
        if (err) {
            console.error('Erro ao enviar arquivo:', err);
            if (!res.headersSent) {
                res.status(err.status || 500).end();
            }
        }
    });
});

function getParticipantsList(room) {
    if (!room || !room.participants) return [];
    return Array.from(room.participants.entries()).map(([id, p]) => ({
        id,
        name: p.name,
        isHost: p.isHost,
        isStreaming: p.isStreaming || false,
        avatarColor: p.avatarColor
    }));
}

// Socket.io Signaling
io.on('connection', (socket) => {
    console.log('[CBN-35] Conexão estabelecida:', socket.id);

    socket.on('join-room', (roomId, isHost, userName, password) => {
        const roomUpper = (roomId || '').toUpperCase();
        
        let room = rooms[roomUpper];
        if (!room) {
            room = { isLocked: false, password: null, participants: new Map() };
            rooms[roomUpper] = room;
        }

        if (room.isLocked && !isHost) {
            if (room.password !== password) {
                socket.emit('error-join', { error: 'Senha de acesso incorreta' });
                return;
            }
        }

        socket.join(roomUpper);

        const colorIndex = Math.floor(Math.random() * avatarColors.length);
        const avatarColor = avatarColors[colorIndex];

        room.participants.set(socket.id, {
            name: userName || 'Combatente',
            isHost: !!isHost,
            isStreaming: false,
            avatarColor
        });

        console.log(`[${roomUpper}] ${userName} (${socket.id}) assumiu o posto.`);

        // Atualizar lista de participantes para todos na guarnição
        io.to(roomUpper).emit('update-participants', getParticipantsList(room));
    });

    // Usuário começou a transmitir ocorrência/tela
    socket.on('start-stream', (roomId) => {
        const roomUpper = (roomId || '').toUpperCase();
        const room = rooms[roomUpper];
        if (room && room.participants.has(socket.id)) {
            room.participants.get(socket.id).isStreaming = true;
            console.log(`[${roomUpper}] ${socket.id} iniciou transmissão da ocorrência.`);
            
            io.to(roomUpper).emit('update-participants', getParticipantsList(room));
            socket.to(roomUpper).emit('stream-started', {
                streamerId: socket.id,
                streamerName: room.participants.get(socket.id).name
            });
        }
    });

    // Usuário parou de transmitir
    socket.on('stop-stream', (roomId) => {
        const roomUpper = (roomId || '').toUpperCase();
        const room = rooms[roomUpper];
        if (room && room.participants.has(socket.id)) {
            room.participants.get(socket.id).isStreaming = false;
            console.log(`[${roomUpper}] ${socket.id} finalizou transmissão.`);
            
            io.to(roomUpper).emit('update-participants', getParticipantsList(room));
            socket.to(roomUpper).emit('stream-stopped', {
                streamerId: socket.id
            });
        }
    });

    // Espectador solicita assistir ao streamer
    socket.on('request-stream', (streamerId, viewerName) => {
        socket.to(streamerId).emit('user-requested-stream', socket.id, viewerName);
    });

    // WebRTC Signaling (P2P Mesh)
    socket.on('offer', (offer, targetId) => {
        socket.to(targetId).emit('offer', offer, socket.id);
    });

    socket.on('answer', (answer, targetId) => {
        socket.to(targetId).emit('answer', answer, socket.id);
    });

    socket.on('ice-candidate', (candidate, targetId) => {
        socket.to(targetId).emit('ice-candidate', candidate, socket.id);
    });

    // Chat Tático em Tempo Real
    socket.on('chat-message', (roomId, messageData) => {
        const roomUpper = (roomId || '').toUpperCase();
        io.to(roomUpper).emit('chat-message', {
            ...messageData,
            senderId: socket.id
        });
    });

    socket.on('disconnect', () => {
        console.log('[CBN-35] Usuário desconectou:', socket.id);
        for (const roomId in rooms) {
            const room = rooms[roomId];
            if (room.participants && room.participants.has(socket.id)) {
                const wasStreaming = room.participants.get(socket.id).isStreaming;
                room.participants.delete(socket.id);
                
                if (wasStreaming) {
                    socket.to(roomId).emit('stream-stopped', { streamerId: socket.id });
                }

                io.to(roomId).emit('update-participants', getParticipantsList(room));
                
                // Remove guarnição vazia para evitar consumo excessivo de memória
                if (room.participants.size === 0) {
                    delete rooms[roomId];
                    console.log(`[${roomId}] Guarnição desmobilizada por estar vazia.`);
                }
            }
        }
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`=========================================`);
    console.log(` CORPO DE BOMBEIROS NORTE - SALVAMENTO 35`);
    console.log(` Servidor operacional na porta ${PORT}`);
    console.log(`=========================================`);
});

module.exports = app;
