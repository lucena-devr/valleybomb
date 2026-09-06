// =======================================================
// CORPO DE BOMBEIROS NORTE - SALVAMENTO 35
// CLIENT-SIDE REALTIME WEBRTC & SOCKET.IO CONTROLLER
// =======================================================

// 1. INSTANT ROOM & OPERATOR INITIALIZATION
let roomId = '';
const pathSegments = window.location.pathname.split('/').filter(Boolean);
if (pathSegments.length >= 2 && pathSegments[0] === 'room') {
    roomId = pathSegments[1].toUpperCase();
}
if (!roomId) {
    const params = new URLSearchParams(window.location.search);
    roomId = (params.get('room') || 'BN35-OP').toUpperCase();
}

const urlParams = new URLSearchParams(window.location.search);
const isHost = urlParams.get('isHost') === 'true';
let userName = (urlParams.get('name') || '').trim();
const hasNameInUrl = userName !== '';
if (!userName) userName = (isHost ? 'Comando 35' : 'Combatente');

// DOM Elements
const roomCodeTag = document.getElementById('room-code-tag');
const sidebarChannelTitle = document.getElementById('sidebar-channel-title');
const sidebarUserCount = document.getElementById('sidebar-user-count');
const selfName = document.getElementById('self-name');
const selfAvatar = document.getElementById('self-avatar');
const participantsList = document.getElementById('participants-list');
const copyCodeQuickBtn = document.getElementById('copy-code-quick-btn');
const copyLinkBtn = document.getElementById('copy-link-btn');
const leaveRoomBtn = document.getElementById('leave-room-btn');

// Mobile Drawer Elements
const discordSidebar = document.getElementById('discord-sidebar');
const mobileSidebarBtn = document.getElementById('mobile-sidebar-btn');
const mobileCountText = document.getElementById('mobile-count-text');
const closeSidebarMobileBtn = document.getElementById('close-sidebar-mobile-btn');
const sidebarBackdrop = document.getElementById('sidebar-backdrop');

// Stage & Video Elements
const lobbyWaitingState = document.getElementById('lobby-waiting-state');
const videoGrid = document.getElementById('video-container');
const videoElement = document.getElementById('screen-video');
const streamerNameText = document.getElementById('streamer-name-text');
const toggleShareScreenBtn = document.getElementById('toggle-share-screen-btn');
const shareBtnIcon = document.getElementById('share-btn-icon');
const shareBtnText = document.getElementById('share-btn-text');
const lobbyShareBtn = document.getElementById('lobby-share-btn');
const videoStopShareBtn = document.getElementById('video-stop-share-btn');

// Fullscreen & Controls Elements
const navFullscreenBtn = document.getElementById('nav-fullscreen-btn');
const navFsIcon = document.getElementById('nav-fs-icon');
const navFsText = document.getElementById('nav-fs-text');
const videoFsBtn = document.getElementById('video-fs-btn');
const videoFsIcon = document.getElementById('video-fs-icon');
const videoFsText = document.getElementById('video-fs-text');
const videoControlsOverlay = document.getElementById('video-controls-overlay');
const muteToggleBtn = document.getElementById('mute-toggle-btn');
const volumeIcon = document.getElementById('volume-icon');
const volumeSlider = document.getElementById('volume-slider');

// Password Modal Elements
const passwordModal = document.getElementById('password-modal');
const modalPassInput = document.getElementById('modal-password-input');
const modalSubmitBtn = document.getElementById('modal-submit-btn');
const modalError = document.getElementById('modal-error');

// Name Modal Elements
const nameModal = document.getElementById('name-modal');
const nameForm = document.getElementById('name-form');
const modalNameInput = document.getElementById('modal-name-input');

// Chat Elements
const chatSidebar = document.getElementById('chat-sidebar');
const toggleChatBtn = document.getElementById('toggle-chat-btn');
const closeChatBtn = document.getElementById('close-chat-btn');
const chatMessagesList = document.getElementById('chat-messages-list');
const chatForm = document.getElementById('chat-form');
const chatInput = document.getElementById('chat-input');
const chatNotificationBadge = document.getElementById('chat-notification-badge');

// --- Set DOM Elements Immediately ---
if (roomCodeTag) roomCodeTag.innerText = roomId;
if (sidebarChannelTitle) sidebarChannelTitle.innerText = `guarnicao-${roomId.toLowerCase()}`;
if (selfName) selfName.innerText = userName;
if (selfAvatar) selfAvatar.innerText = (userName.charAt(0) || 'C').toUpperCase();

// =======================================================
// MOBILE DRAWER CONTROLS
// =======================================================

function openMobileSidebar() {
    if (discordSidebar) {
        discordSidebar.classList.remove('-translate-x-full');
        discordSidebar.classList.add('translate-x-0');
    }
    if (sidebarBackdrop) {
        sidebarBackdrop.classList.remove('hidden');
        sidebarBackdrop.classList.add('block');
    }
}

function closeMobileSidebar() {
    if (discordSidebar) {
        discordSidebar.classList.add('-translate-x-full');
        discordSidebar.classList.remove('translate-x-0');
    }
    if (sidebarBackdrop) {
        sidebarBackdrop.classList.add('hidden');
        sidebarBackdrop.classList.remove('block');
    }
}

if (mobileSidebarBtn) mobileSidebarBtn.addEventListener('click', openMobileSidebar);
if (closeSidebarMobileBtn) closeSidebarMobileBtn.addEventListener('click', closeMobileSidebar);
if (sidebarBackdrop) sidebarBackdrop.addEventListener('click', closeMobileSidebar);

// Copy Code
if (copyCodeQuickBtn) {
    copyCodeQuickBtn.addEventListener('click', () => {
        navigator.clipboard.writeText(roomId).then(() => {
            const originalHtml = copyCodeQuickBtn.innerHTML;
            copyCodeQuickBtn.innerHTML = '<i class="fa-solid fa-check text-[#7CFF3C]"></i>';
            setTimeout(() => copyCodeQuickBtn.innerHTML = originalHtml, 1800);
        });
    });
}

// Copy Link
if (copyLinkBtn) {
    copyLinkBtn.addEventListener('click', () => {
        const cleanUrl = `${window.location.origin}/room/${roomId}`;
        navigator.clipboard.writeText(cleanUrl).then(() => {
            const originalHtml = copyLinkBtn.innerHTML;
            copyLinkBtn.innerHTML = '<i class="fa-solid fa-check text-[#7CFF3C]"></i> <span class="hidden sm:inline text-xs font-semibold text-[#7CFF3C]">Copiado!</span>';
            setTimeout(() => copyLinkBtn.innerHTML = originalHtml, 2000);
        });
    });
}

// Leave Room
if (leaveRoomBtn) {
    leaveRoomBtn.addEventListener('click', () => {
        stopMyScreenShare();
        window.location.href = '/';
    });
}

// =======================================================
// 2. SECURITY & ACCESS AUTHENTICATION
// =======================================================

let isRoomLocked = false;
let isAuthenticated = isHost;
let savedPassword = null;

try {
    const savedMetaStr = localStorage.getItem(`cbn_room_${roomId}`);
    if (savedMetaStr) {
        const savedMeta = JSON.parse(savedMetaStr);
        if (savedMeta.isLocked) {
            isRoomLocked = true;
        }
    }
} catch (e) {}

function checkNameRequirement() {
    if (!hasNameInUrl && !isHost) {
        if (nameModal) nameModal.classList.remove('hidden');
        if (modalNameInput) modalNameInput.focus();
    } else {
        joinRoom(savedPassword);
    }
}

async function checkRoomStatus() {
    try {
        const res = await fetch(`/api/room/${roomId}/status`);
        if (res.ok) {
            const data = await res.json();
            isRoomLocked = data.isLocked;
            
            if (isRoomLocked && !isHost && !isAuthenticated) {
                if (passwordModal) passwordModal.classList.remove('hidden');
            } else {
                checkNameRequirement();
            }
        } else {
            console.warn('Room not found on server, proceeding to name check');
            checkNameRequirement();
        }
    } catch (e) {
        console.error('Error fetching room status', e);
        checkNameRequirement();
    }
}

async function verifyPasswordAttempt() {
    const inputPass = modalPassInput.value;
    
    try {
        const res = await fetch(`/api/room/${roomId}/verify`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ password: inputPass })
        });
        const data = await res.json();
        
        if (data.success) {
            isAuthenticated = true;
            savedPassword = inputPass;
            passwordModal.classList.add('hidden');
            if (modalError) modalError.classList.add('hidden');
            checkNameRequirement();
        } else {
            if (modalError) modalError.classList.remove('hidden');
            modalPassInput.value = '';
            modalPassInput.focus();
        }
    } catch (e) {
        if (modalError) modalError.classList.remove('hidden');
    }
}

if (modalSubmitBtn) modalSubmitBtn.addEventListener('click', verifyPasswordAttempt);
if (modalPassInput) {
    modalPassInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') verifyPasswordAttempt();
    });
}

if (nameForm) {
    nameForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const inputName = modalNameInput.value.trim();
        if (inputName) {
            userName = inputName;
            if (selfName) selfName.innerText = userName;
            if (selfAvatar) selfAvatar.innerText = (userName.charAt(0) || 'C').toUpperCase();
            nameModal.classList.add('hidden');
            joinRoom(savedPassword);
        }
    });
}

checkRoomStatus();

// =======================================================
// 3. SOCKET.IO SIGNALING & WEBRTC P2P MESH
// =======================================================

let localStream = null;
let isSharingScreen = false;
let currentlyWatchingId = null;
let lastVolume = 1;
let controlsTimeout = null;

const socket = io();
const participantsMap = new Map();
const peerConnections = {};
const iceServers = {
    iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' },
        { urls: 'stun:stun2.l.google.com:19302' }
    ]
};

function joinRoom(password = null) {
    socket.emit('join-room', roomId, isHost, userName, password);
}

socket.on('error-join', (data) => {
    if (modalError) {
        modalError.innerText = data.error || 'Erro de autenticação';
        modalError.classList.remove('hidden');
    }
    if (passwordModal) passwordModal.classList.remove('hidden');
});

socket.on('update-participants', (participants) => {
    participantsMap.clear();
    participants.forEach(p => {
        participantsMap.set(p.id, p);
    });
    
    // Clean up peer connections for members who disconnected
    Object.keys(peerConnections).forEach(id => {
        if (!participantsMap.has(id)) {
            peerConnections[id].close();
            delete peerConnections[id];
            if (currentlyWatchingId === id) resetToLobby();
        }
    });
    
    renderParticipants();
});

socket.on('stream-started', (data) => {
    const p = participantsMap.get(data.streamerId);
    if (p) {
        p.isStreaming = true;
        renderParticipants();
    }
    if (!currentlyWatchingId && !isSharingScreen && data.streamerId !== socket.id) {
        requestToWatchStream(data.streamerId, data.streamerName || 'Streamer');
    }
});

socket.on('stream-stopped', (data) => {
    const p = participantsMap.get(data.streamerId);
    if (p) {
        p.isStreaming = false;
        renderParticipants();
    }
    if (currentlyWatchingId === data.streamerId) {
        resetToLobby();
    }
});

socket.on('user-requested-stream', async (viewerId, viewerName) => {
    if (!isSharingScreen || !localStream) return;
    console.log(`[P2P] Enviando WebRTC offer para: ${viewerId} (${viewerName})`);

    const pc = new RTCPeerConnection(iceServers);
    peerConnections[viewerId] = pc;

    localStream.getTracks().forEach(track => pc.addTrack(track, localStream));

    pc.onicecandidate = (event) => {
        if (event.candidate) {
            socket.emit('ice-candidate', event.candidate, viewerId);
        }
    };

    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);
    socket.emit('offer', offer, viewerId);
});

socket.on('offer', async (offer, senderId) => {
    console.log(`[P2P] Recebendo WebRTC offer de: ${senderId}`);
    const pc = new RTCPeerConnection(iceServers);
    peerConnections[senderId] = pc;

    pc.onicecandidate = (event) => {
        if (event.candidate) {
            socket.emit('ice-candidate', event.candidate, senderId);
        }
    };

    pc.ontrack = (event) => {
        console.log('[P2P] Sinal de vídeo/áudio recebido!');
        if (videoElement.srcObject !== event.streams[0]) {
            videoElement.srcObject = event.streams[0];
            
            if (volumeSlider) {
                const val = parseFloat(volumeSlider.value);
                videoElement.muted = (val === 0);
                videoElement.volume = val;
            } else {
                videoElement.muted = false;
                videoElement.volume = 1;
            }

            videoElement.play().catch(e => {
                console.warn('Autoplay bloqueado pelo navegador, usando fallback mutado:', e);
                videoElement.muted = true;
                videoElement.play().catch(err => console.error('Falha no playback:', err));
                
                if (volumeSlider) volumeSlider.value = 0;
                if (typeof updateVolumeIcon === 'function') updateVolumeIcon(0);
            });
        }
        lobbyWaitingState.classList.add('hidden');
        videoGrid.classList.remove('hidden');
        
        const streamer = participantsMap.get(senderId);
        if (streamerNameText && streamer) {
            streamerNameText.innerText = `OCORRÊNCIA TRANSMITIDA POR ${(streamer.name || 'COMBATENTE').toUpperCase()}`;
        }
        currentlyWatchingId = senderId;
        renderParticipants();
    };

    await pc.setRemoteDescription(new RTCSessionDescription(offer));
    const answer = await pc.createAnswer();
    await pc.setLocalDescription(answer);

    socket.emit('answer', answer, senderId);
});

socket.on('answer', async (answer, senderId) => {
    const pc = peerConnections[senderId];
    if (pc) {
        await pc.setRemoteDescription(new RTCSessionDescription(answer));
    }
});

socket.on('ice-candidate', async (candidate, senderId) => {
    const pc = peerConnections[senderId];
    if (pc) {
        try {
            await pc.addIceCandidate(new RTCIceCandidate(candidate));
        } catch (err) {
            console.error('Erro ao adicionar ICE candidate:', err);
        }
    }
});

// =======================================================
// 4. PARTICIPANTS LIST RENDERING (TACTICAL DISPATCH)
// =======================================================

function renderParticipants() {
    const list = Array.from(participantsMap.values());
    if (sidebarUserCount) {
        sidebarUserCount.innerText = `${list.length} combatentes`;
    }
    if (mobileCountText) {
        mobileCountText.innerText = list.length;
    }

    if (!participantsList) return;
    participantsList.innerHTML = '';

    list.forEach(p => {
        const isSelf = (p.id === socket.id);
        const isStreaming = p.isStreaming;
        const isCurrentlyWatchingThis = currentlyWatchingId === p.id;

        const li = document.createElement('li');
        li.className = `tactical-user-item p-2 rounded-xl flex items-center justify-between gap-2 cursor-pointer ${isStreaming ? 'streaming' : ''} ${isCurrentlyWatchingThis ? 'border-[#7CFF3C] bg-[#7CFF3C]/10' : ''}`;

        li.innerHTML = `
            <div class="flex items-center gap-2.5 min-w-0 flex-1">
                <!-- Avatar -->
                <div class="relative flex-shrink-0">
                    <div class="w-8 h-8 rounded-full bg-gradient-to-tr ${p.avatarColor || 'from-lime-400 to-emerald-700'} flex items-center justify-center font-bold text-xs text-black shadow-[0_0_8px_rgba(124,255,60,0.3)]">
                        ${(p.name.charAt(0) || 'C').toUpperCase()}
                    </div>
                    <span class="absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full bg-[#7CFF3C] border-2 border-black"></span>
                </div>

                <!-- Name & Badges -->
                <div class="min-w-0 flex-1">
                    <div class="flex items-center gap-1.5 flex-wrap">
                        <span class="text-xs font-bold ${isSelf ? 'text-[#7CFF3C]' : 'text-gray-200'} truncate">${p.name} ${isSelf ? '<span class="text-[10px] text-gray-400 font-normal">(você)</span>' : ''}</span>
                        ${p.isHost ? '<span class="bg-[#7CFF3C]/20 text-[#7CFF3C] border border-green-dim text-[9px] px-1.5 py-0.2 rounded font-bold">COMANDO</span>' : ''}
                        <span class="text-[10px] text-gray-400 font-bold">CBN-35</span>
                    </div>
                    ${isStreaming ? '<p class="text-[10px] text-[#7CFF3C] font-bold flex items-center gap-1"><span class="w-1.5 h-1.5 rounded-full bg-[#7CFF3C] animate-ping"></span> TRANSMITINDO TELA</p>' : ''}
                </div>
            </div>

            <!-- Action Button -->
            ${isStreaming && !isSelf ? `
                <button class="watch-btn px-2.5 py-1 rounded-lg text-[11px] font-bold ${isCurrentlyWatchingThis ? 'bg-[#7CFF3C] text-black' : 'bg-[#7CFF3C]/20 text-[#7CFF3C] hover:bg-[#7CFF3C] hover:text-black border border-green-dim'} transition-all flex items-center gap-1">
                    <i class="fa-solid fa-eye text-[10px]"></i>
                    <span>${isCurrentlyWatchingThis ? 'Assistindo' : 'Acompanhar'}</span>
                </button>
            ` : ''}
        `;

        if (isStreaming && !isSelf) {
            li.addEventListener('click', () => {
                requestToWatchStream(p.id, p.name);
            });
        }

        participantsList.appendChild(li);
    });
}

// =======================================================
// 5. SCREEN SHARING (START / STOP / LOBBY SWITCH)
// =======================================================

async function startMyScreenShare() {
    try {
        localStream = await navigator.mediaDevices.getDisplayMedia({
            video: { cursor: "always" },
            audio: true
        });

        isSharingScreen = true;
        currentlyWatchingId = socket.id;

        localStream.getVideoTracks()[0].onended = () => {
            stopMyScreenShare();
        };

        videoElement.srcObject = localStream;
        videoElement.muted = true;

        lobbyWaitingState.classList.add('hidden');
        videoGrid.classList.remove('hidden');
        videoStopShareBtn.classList.remove('hidden');
        if (streamerNameText) streamerNameText.innerText = 'SUA TRANSMISSÃO OPERACIONAL (AO VIVO)';

        if (shareBtnText) shareBtnText.innerText = 'Encerrar Tela';
        if (shareBtnIcon) shareBtnIcon.className = 'fa-solid fa-stop text-red-400';
        toggleShareScreenBtn.className = 'btn-danger w-full py-2.5 rounded-xl text-xs font-bold flex items-center justify-center gap-2';

        const myData = participantsMap.get(socket.id) || {};
        myData.isStreaming = true;
        participantsMap.set(socket.id, myData);
        renderParticipants();

        socket.emit('start-stream', roomId);

        closeMobileSidebar();

    } catch (err) {
        console.warn("Screen share cancelado ou com erro:", err);
    }
}

function stopMyScreenShare() {
    if (localStream) {
        localStream.getTracks().forEach(track => track.stop());
        localStream = null;
    }

    if (isSharingScreen) {
        isSharingScreen = false;
        socket.emit('stop-stream', roomId);
    }

    if (shareBtnText) shareBtnText.innerText = 'Transmitir Tela';
    if (shareBtnIcon) shareBtnIcon.className = 'fa-solid fa-desktop';
    toggleShareScreenBtn.className = 'btn-primary w-full py-2.5 rounded-xl text-xs font-bold flex items-center justify-center gap-2';
    videoStopShareBtn.classList.add('hidden');

    const myData = participantsMap.get(socket.id) || {};
    myData.isStreaming = false;
    participantsMap.set(socket.id, myData);
    renderParticipants();

    resetToLobby();
}

function resetToLobby() {
    currentlyWatchingId = null;
    if (videoElement) videoElement.srcObject = null;
    if (videoGrid) videoGrid.classList.add('hidden');
    if (lobbyWaitingState) lobbyWaitingState.classList.remove('hidden');
}

function requestToWatchStream(streamerId, streamerName) {
    if (isSharingScreen) stopMyScreenShare();

    currentlyWatchingId = streamerId;
    if (streamerNameText) streamerNameText.innerText = `OCORRÊNCIA TRANSMITIDA POR ${streamerName.toUpperCase()}`;

    lobbyWaitingState.classList.add('hidden');
    videoGrid.classList.remove('hidden');
    videoStopShareBtn.classList.add('hidden');

    socket.emit('request-stream', streamerId, userName);

    renderParticipants();
    closeMobileSidebar();
}

if (toggleShareScreenBtn) {
    toggleShareScreenBtn.addEventListener('click', () => {
        if (isSharingScreen) stopMyScreenShare();
        else startMyScreenShare();
    });
}

if (lobbyShareBtn) lobbyShareBtn.addEventListener('click', startMyScreenShare);
if (videoStopShareBtn) videoStopShareBtn.addEventListener('click', stopMyScreenShare);

// =======================================================
// 6. FULLSCREEN & TACTICAL OVERLAY CONTROLS
// =======================================================

function isFullscreenActive() {
    return !!(
        document.fullscreenElement ||
        document.webkitFullscreenElement ||
        document.mozFullScreenElement ||
        document.msFullscreenElement ||
        (videoGrid && videoGrid.classList.contains('pseudo-fullscreen'))
    );
}

function enablePseudoFullscreen() {
    if (videoGrid) {
        videoGrid.classList.add('pseudo-fullscreen');
        updateFullscreenUI();
    }
}

function disablePseudoFullscreen() {
    if (videoGrid) {
        videoGrid.classList.remove('pseudo-fullscreen');
        updateFullscreenUI();
    }
}

function toggleFullscreen() {
    const isFS = isFullscreenActive();

    if (!isFS) {
        if (videoElement && typeof videoElement.webkitEnterFullscreen === 'function' && !videoGrid.classList.contains('hidden')) {
            try {
                videoElement.webkitEnterFullscreen();
                updateFullscreenUI();
                return;
            } catch (e) {
                console.log('iOS webkitEnterFullscreen fallback:', e);
            }
        }

        const target = (!videoGrid.classList.contains('hidden') && videoGrid) ? videoGrid : document.documentElement;

        if (target.requestFullscreen) {
            target.requestFullscreen().catch(() => enablePseudoFullscreen());
        } else if (target.webkitRequestFullscreen) {
            target.webkitRequestFullscreen();
        } else if (target.mozRequestFullScreen) {
            target.mozRequestFullScreen();
        } else if (target.msRequestFullscreen) {
            target.msRequestFullscreen();
        } else {
            enablePseudoFullscreen();
        }
    } else {
        if (videoGrid && videoGrid.classList.contains('pseudo-fullscreen')) {
            disablePseudoFullscreen();
        }
        if (document.exitFullscreen) {
            document.exitFullscreen().catch(() => {});
        } else if (document.webkitExitFullscreen) {
            document.webkitExitFullscreen();
        } else if (document.mozCancelFullScreen) {
            document.mozCancelFullScreen();
        } else if (document.msExitFullscreen) {
            document.msExitFullscreen();
        }
    }
    setTimeout(updateFullscreenUI, 150);
}

function updateFullscreenUI() {
    const isFS = isFullscreenActive();
    if (navFsIcon) navFsIcon.className = isFS ? 'fa-solid fa-compress text-neon-green text-sm' : 'fa-solid fa-expand text-neon-green text-sm';
    if (navFsText) navFsText.innerText = isFS ? 'Sair Tela Cheia' : 'Tela Cheia';
    if (videoFsIcon) videoFsIcon.className = isFS ? 'fa-solid fa-compress text-base text-neon-green' : 'fa-solid fa-expand text-base text-neon-green';
    if (videoFsText) videoFsText.innerText = isFS ? 'Sair' : 'Tela Cheia';
}

document.addEventListener('fullscreenchange', updateFullscreenUI);
document.addEventListener('webkitfullscreenchange', updateFullscreenUI);
document.addEventListener('mozfullscreenchange', updateFullscreenUI);
document.addEventListener('MSFullscreenChange', updateFullscreenUI);

if (navFullscreenBtn) navFullscreenBtn.addEventListener('click', toggleFullscreen);
if (videoFsBtn) videoFsBtn.addEventListener('click', toggleFullscreen);

if (videoElement) {
    videoElement.addEventListener('dblclick', (e) => {
        e.preventDefault();
        toggleFullscreen();
    });
}

document.addEventListener('keydown', (e) => {
    if (['input', 'textarea'].includes(document.activeElement?.tagName?.toLowerCase())) return;
    if (e.key === 'f' || e.key === 'F') {
        e.preventDefault();
        toggleFullscreen();
    }
    if (e.key === 'Escape') {
        if (videoGrid && videoGrid.classList.contains('pseudo-fullscreen')) {
            disablePseudoFullscreen();
        }
    }
});

// Controls Auto-Hide
function showControls() {
    if (videoControlsOverlay) videoControlsOverlay.classList.remove('controls-hidden');
    clearTimeout(controlsTimeout);
    controlsTimeout = setTimeout(() => {
        if (videoControlsOverlay && !videoControlsOverlay.matches(':hover')) {
            videoControlsOverlay.classList.add('controls-hidden');
        }
    }, 2500);
}

if (videoGrid) {
    videoGrid.addEventListener('mousemove', showControls);
    videoGrid.addEventListener('mouseenter', showControls);
    videoGrid.addEventListener('mouseleave', () => {
        if (videoControlsOverlay) videoControlsOverlay.classList.add('controls-hidden');
    });
}

// Audio Volume & Mute
function updateVolumeIcon(vol) {
    if (!volumeIcon) return;
    if (vol === 0) volumeIcon.className = 'fa-solid fa-volume-xmark text-sm text-red-400';
    else if (vol < 0.5) volumeIcon.className = 'fa-solid fa-volume-low text-sm text-[#7CFF3C]';
    else volumeIcon.className = 'fa-solid fa-volume-high text-sm text-[#7CFF3C]';
}

if (volumeSlider) {
    volumeSlider.addEventListener('input', (e) => {
        const val = parseFloat(e.target.value);
        if (videoElement) {
            videoElement.volume = val;
            videoElement.muted = (val === 0);
        }
        if (val > 0) lastVolume = val;
        updateVolumeIcon(val);
    });
}

if (muteToggleBtn) {
    muteToggleBtn.addEventListener('click', () => {
        if (!videoElement) return;
        if (videoElement.muted || videoElement.volume === 0) {
            videoElement.muted = false;
            videoElement.volume = lastVolume || 1;
            if (volumeSlider) volumeSlider.value = lastVolume || 1;
            updateVolumeIcon(lastVolume || 1);
        } else {
            lastVolume = videoElement.volume;
            videoElement.muted = true;
            videoElement.volume = 0;
            if (volumeSlider) volumeSlider.value = 0;
            updateVolumeIcon(0);
        }
    });
}

// =======================================================
// 7. TACTICAL RADIO & CHAT LOGIC
// =======================================================

let isChatOpen = false;

function toggleChat() {
    isChatOpen = !isChatOpen;
    if (isChatOpen) {
        chatSidebar.classList.remove('hidden');
        setTimeout(() => {
            chatSidebar.classList.remove('translate-x-full');
            chatSidebar.classList.add('translate-x-0');
        }, 10);
        if (chatNotificationBadge) chatNotificationBadge.classList.add('hidden');
        if (chatInput) chatInput.focus();
        if (chatMessagesList) chatMessagesList.scrollTop = chatMessagesList.scrollHeight;
    } else {
        chatSidebar.classList.add('translate-x-full');
        chatSidebar.classList.remove('translate-x-0');
        setTimeout(() => {
            chatSidebar.classList.add('hidden');
        }, 300);
    }
}

if (toggleChatBtn) toggleChatBtn.addEventListener('click', toggleChat);
if (closeChatBtn) closeChatBtn.addEventListener('click', toggleChat);

if (chatForm) {
    chatForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const text = chatInput.value.trim();
        if (!text) return;
        
        const messageData = {
            text: text,
            senderName: userName,
            timestamp: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
        };
        
        socket.emit('chat-message', roomId, messageData);
        chatInput.value = '';
    });
}

socket.on('chat-message', (data) => {
    const isSelf = data.senderId === socket.id;
    const p = participantsMap.get(data.senderId);
    const avatarColor = p ? p.avatarColor : 'from-lime-400 to-emerald-700';
    const senderInitial = (data.senderName.charAt(0) || 'C').toUpperCase();
    
    const msgDiv = document.createElement('div');
    msgDiv.className = `flex flex-col gap-1 ${isSelf ? 'items-end' : 'items-start'}`;
    
    msgDiv.innerHTML = `
        <div class="flex items-end gap-2 ${isSelf ? 'flex-row-reverse' : 'flex-row'}">
            <div class="w-6 h-6 rounded-full bg-gradient-to-tr ${avatarColor} flex items-center justify-center font-bold text-[10px] text-black flex-shrink-0 shadow-[0_0_8px_rgba(124,255,60,0.3)]">
                ${senderInitial}
            </div>
            <div class="bg-black/75 border ${isSelf ? 'border-[#7CFF3C]/40 text-[#eef5ea]' : 'border-[#1c2b23] text-gray-300'} px-3 py-2 rounded-2xl max-w-[200px] sm:max-w-[240px] break-words text-xs shadow-md">
                <div class="flex items-center justify-between gap-2 mb-0.5">
                    <span class="font-bold text-gray-400 text-[10px]">${data.senderName}</span>
                    <span class="text-[9px] text-gray-500 font-mono">${data.timestamp || ''}</span>
                </div>
                <div>${data.text}</div>
            </div>
        </div>
    `;
    
    if (chatMessagesList) {
        chatMessagesList.appendChild(msgDiv);
        chatMessagesList.scrollTop = chatMessagesList.scrollHeight;
    }
    
    if (!isChatOpen && chatNotificationBadge) {
        chatNotificationBadge.classList.remove('hidden');
    }
});
