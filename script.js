/**
 * CLIO E-TECH AI ASSISTANT — script.js
 * Full-featured: Three.js 3D, TTS, STT, Animations, Chat
 */

'use strict';

/* ═══════════════════════════════════════════════════════════
   CONFIG
═══════════════════════════════════════════════════════════ */
const API_URL = "http://localhost:5000/chat";

/* ═══════════════════════════════════════════════════════════
   STATE
═══════════════════════════════════════════════════════════ */
let currentMode   = 'general';
let isSpeaking    = false;
let ttsEnabled    = true;
let isListening   = false;
let speechSynth   = window.speechSynthesis;
let currentUtterance = null;
let msgCount      = 0;
let history       = [];
let mouthAnimId   = null;

/* ═══════════════════════════════════════════════════════════
   DOM REFS
═══════════════════════════════════════════════════════════ */
const $ = id => document.getElementById(id);
const chatScroll    = $('chat-scroll');
const userInput     = $('user-input');
const typingInd     = $('typing-indicator');
const voiceBars     = $('voice-bars');
const robotState    = $('robot-state');
const robotSvg      = $('robot-svg');
const modeBadge     = $('mode-badge');
const msgCountEl    = $('msg-count');
const ttsToggle     = $('btn-tts-toggle');
const stopVoiceBtn  = $('btn-stop-voice');
const micBtn        = $('btn-mic');
const sidebar       = $('sidebar');

/* ═══════════════════════════════════════════════════════════
   AMBIENT BACKGROUND (Canvas)
═══════════════════════════════════════════════════════════ */
(function initBackground() {
    const canvas = $('bg-canvas');
    const ctx = canvas.getContext('2d');
    let W, H;
    let particles = [];

    function resize() {
        W = canvas.width  = window.innerWidth;
        H = canvas.height = window.innerHeight;
    }

    function spawnParticle() {
        return {
            x: Math.random() * W,
            y: Math.random() * H,
            r: Math.random() * 1.2 + 0.3,
            vx: (Math.random() - 0.5) * 0.2,
            vy: (Math.random() - 0.5) * 0.2,
            a: Math.random(),
            da: (Math.random() - 0.5) * 0.005,
            color: Math.random() < 0.7 ? '#00d4ff' : '#ffcc00'
        };
    }

    function init() {
        resize();
        particles = Array.from({ length: 90 }, spawnParticle);
    }

    function draw() {
        ctx.clearRect(0, 0, W, H);

        // Grid lines
        ctx.strokeStyle = 'rgba(0, 212, 255, 0.04)';
        ctx.lineWidth = 1;
        for (let x = 0; x < W; x += 60) {
            ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke();
        }
        for (let y = 0; y < H; y += 60) {
            ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke();
        }

        // Particles
        particles.forEach(p => {
            p.x += p.vx; p.y += p.vy;
            p.a += p.da;
            if (p.a <= 0 || p.a >= 1) p.da *= -1;
            if (p.x < 0) p.x = W;
            if (p.x > W) p.x = 0;
            if (p.y < 0) p.y = H;
            if (p.y > H) p.y = 0;

            ctx.beginPath();
            ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
            ctx.fillStyle = p.color;
            ctx.globalAlpha = p.a * 0.5;
            ctx.fill();
        });

        ctx.globalAlpha = 1;
        requestAnimationFrame(draw);
    }

    init();
    draw();
    window.addEventListener('resize', resize);
})();

/* ═══════════════════════════════════════════════════════════
   HUD CLOCK
═══════════════════════════════════════════════════════════ */
function updateClock() {
    const now = new Date();
    const h = String(now.getHours()).padStart(2, '0');
    const m = String(now.getMinutes()).padStart(2, '0');
    $('hud-time').textContent = `${h}:${m}`;
}
updateClock();
setInterval(updateClock, 10000);

// Welcome time
$('welcome-time').textContent = (() => {
    const d = new Date();
    return `${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`;
})();

/* ═══════════════════════════════════════════════════════════
   THREE.JS 3D CAR
═══════════════════════════════════════════════════════════ */
(function initThreeJS() {
    const canvas = $('car-canvas');
    const viewport = $('car-viewport');
    const loadingEl = $('loading-3d');

    const renderer = new THREE.WebGLRenderer({
        canvas,
        antialias: true,
        alpha: true
    });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.2;

    const scene = new THREE.Scene();
    scene.fog = new THREE.FogExp2(0x010810, 0.05);

    const camera = new THREE.PerspectiveCamera(40, 1, 0.1, 100);
    camera.position.set(3.5, 1.2, 4);
    camera.lookAt(0, 0, 0);

    function resize() {
        const w = viewport.clientWidth;
        const h = viewport.clientHeight;
        renderer.setSize(w, h);
        camera.aspect = w / h;
        camera.updateProjectionMatrix();
    }
    resize();
    window.addEventListener('resize', resize);

    // Lighting setup
    const ambientLight = new THREE.AmbientLight(0x112233, 1.5);
    scene.add(ambientLight);

    // Main key light (cyan tinted)
    const keyLight = new THREE.DirectionalLight(0x00aaff, 3);
    keyLight.position.set(5, 5, 5);
    keyLight.castShadow = true;
    keyLight.shadow.mapSize.set(1024, 1024);
    keyLight.shadow.camera.near = 0.5;
    keyLight.shadow.camera.far = 30;
    scene.add(keyLight);

    // Fill light (gold tinted, opposite side)
    const fillLight = new THREE.DirectionalLight(0xffcc44, 1.2);
    fillLight.position.set(-5, 3, -3);
    scene.add(fillLight);

    // Rim light (back edge highlight)
    const rimLight = new THREE.DirectionalLight(0x00ffff, 2);
    rimLight.position.set(0, 2, -5);
    scene.add(rimLight);

    // Ground reflection plane
    const groundGeo  = new THREE.PlaneGeometry(20, 20);
    const groundMat  = new THREE.MeshStandardMaterial({
        color: 0x001020,
        metalness: 0.8,
        roughness: 0.4
    });
    const ground = new THREE.Mesh(groundGeo, groundMat);
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = -0.85;
    ground.receiveShadow = true;
    scene.add(ground);

    // Grid helper on ground
    const grid = new THREE.GridHelper(20, 40, 0x00d4ff, 0x001825);
    grid.position.y = -0.84;
    grid.material.opacity = 0.2;
    grid.material.transparent = true;
    scene.add(grid);

    // Car pivot for rotation
    const carGroup = new THREE.Group();
    scene.add(carGroup);

    // Auto-rotate state
    let autoRotate = true;
    let isDragging = false;
    let prevX = 0;
    let rotationY = 0;
    let targetRotY = 0;

    // Mouse/touch controls on viewport
    viewport.addEventListener('mousedown', e => {
        isDragging = true;
        autoRotate = false;
        prevX = e.clientX;
    });
    window.addEventListener('mousemove', e => {
        if (!isDragging) return;
        const delta = e.clientX - prevX;
        targetRotY += delta * 0.012;
        prevX = e.clientX;
    });
    window.addEventListener('mouseup', () => {
        isDragging = false;
        setTimeout(() => { autoRotate = true; }, 2000);
    });

    viewport.addEventListener('touchstart', e => {
        isDragging = true;
        autoRotate = false;
        prevX = e.touches[0].clientX;
    });
    window.addEventListener('touchmove', e => {
        if (!isDragging) return;
        const delta = e.touches[0].clientX - prevX;
        targetRotY += delta * 0.012;
        prevX = e.touches[0].clientX;
    });
    window.addEventListener('touchend', () => {
        isDragging = false;
        setTimeout(() => { autoRotate = true; }, 2000);
    });

    // Load GLB model using fetch + ArrayBuffer -> GLTFLoader
    loadGLTFModel();

    function loadGLTFModel() {
        // Dynamically import GLTFLoader from CDN
        const script = document.createElement('script');
        script.src = 'https://cdn.jsdelivr.net/npm/three@0.128.0/examples/js/loaders/GLTFLoader.js';
        script.onload = () => {
            const loader = new THREE.GLTFLoader();
            loader.load(
                'clio.glb',
                gltf => {
                    const model = gltf.scene;
                    // Center the model
                    const box = new THREE.Box3().setFromObject(model);
                    const center = box.getCenter(new THREE.Vector3());
                    const size = box.getSize(new THREE.Vector3());
                    const maxDim = Math.max(size.x, size.y, size.z);
                    const scale = 2.0 / maxDim;
                    model.scale.setScalar(scale);
                    model.position.sub(center.multiplyScalar(scale));
                    model.position.y += 0.1;

                    // Enhance materials for futuristic look
                    model.traverse(child => {
                        if (child.isMesh) {
                            child.castShadow    = true;
                            child.receiveShadow = true;
                            if (child.material) {
                                child.material.envMapIntensity = 1.5;
                            }
                        }
                    });

                    carGroup.add(model);
                    loadingEl.classList.add('hidden');
                },
                progress => {
                    const pct = Math.round(progress.loaded / progress.total * 100);
                    loadingEl.querySelector('span').textContent = `CHARGEMENT... ${pct}%`;
                },
                error => {
                    console.warn('GLB load error (showing fallback):', error);
                    createFallbackCar();
                    loadingEl.classList.add('hidden');
                }
            );
        };
        script.onerror = () => {
            createFallbackCar();
            loadingEl.classList.add('hidden');
        };
        document.head.appendChild(script);
    }

    function createFallbackCar() {
        // Procedural low-poly car as fallback
        const group = new THREE.Group();

        const bodyMat = new THREE.MeshStandardMaterial({
            color: 0x001133,
            metalness: 0.9,
            roughness: 0.2,
            envMapIntensity: 2
        });
        const glassMat = new THREE.MeshStandardMaterial({
            color: 0x00aaff,
            metalness: 0.1,
            roughness: 0.05,
            transparent: true,
            opacity: 0.6
        });
        const wheelMat = new THREE.MeshStandardMaterial({
            color: 0x111111,
            metalness: 0.5,
            roughness: 0.5
        });
        const rimMat = new THREE.MeshStandardMaterial({
            color: 0x888899,
            metalness: 0.9,
            roughness: 0.1
        });

        // Car body (lower)
        const lower = new THREE.Mesh(new THREE.BoxGeometry(2, 0.5, 1), bodyMat);
        lower.position.y = 0.25;
        lower.castShadow = true;
        group.add(lower);

        // Car body (upper - cabin)
        const cabin = new THREE.Mesh(new THREE.BoxGeometry(1.3, 0.45, 0.9), bodyMat);
        cabin.position.set(-0.1, 0.72, 0);
        cabin.castShadow = true;
        group.add(cabin);

        // Windshield
        const windshield = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.35, 0.8), glassMat);
        windshield.position.set(0.55, 0.72, 0);
        windshield.rotation.z = 0.3;
        group.add(windshield);

        // Rear glass
        const rearGlass = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.35, 0.8), glassMat);
        rearGlass.position.set(-0.75, 0.72, 0);
        rearGlass.rotation.z = -0.3;
        group.add(rearGlass);

        // Headlights (cyan glow)
        const headlightMat = new THREE.MeshStandardMaterial({ color: 0x00d4ff, emissive: 0x00d4ff, emissiveIntensity: 2 });
        [-0.3, 0.3].forEach(z => {
            const hl = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.12, 0.08), headlightMat);
            hl.position.set(1.0, 0.3, z);
            group.add(hl);
        });

        // Taillights (red)
        const taillightMat = new THREE.MeshStandardMaterial({ color: 0xff2200, emissive: 0xff2200, emissiveIntensity: 1.5 });
        [-0.3, 0.3].forEach(z => {
            const tl = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.12, 0.08), taillightMat);
            tl.position.set(-1.0, 0.3, z);
            group.add(tl);
        });

        // Wheels
        const wheelPositions = [[0.7,-0.1,0.52],[0.7,-0.1,-0.52],[-0.65,-0.1,0.52],[-0.65,-0.1,-0.52]];
        wheelPositions.forEach(([x, y, z]) => {
            const wheel = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.22, 0.18, 16), wheelMat);
            wheel.rotation.x = Math.PI / 2;
            wheel.position.set(x, y, z);
            wheel.castShadow = true;
            group.add(wheel);

            const rim = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.13, 0.2, 8), rimMat);
            rim.rotation.x = Math.PI / 2;
            rim.position.set(x, y, z);
            group.add(rim);
        });

        group.position.y = -0.15;
        carGroup.add(group);
    }

    // Animation loop
    const clock = new THREE.Clock();
    function animate() {
        requestAnimationFrame(animate);
        const t = clock.getElapsedTime();

        if (autoRotate) {
            targetRotY += 0.003;
        }

        // Smooth lerp rotation
        rotationY += (targetRotY - rotationY) * 0.08;
        carGroup.rotation.y = rotationY;

        // Subtle float
        carGroup.position.y = Math.sin(t * 0.6) * 0.04;

        // Animated grid
        grid.position.z = (t * 0.5) % 0.5;

        renderer.render(scene, camera);
    }
    animate();
})();

/* ═══════════════════════════════════════════════════════════
   ROBOT ANIMATIONS
═══════════════════════════════════════════════════════════ */
function startSpeakingAnimation() {
    robotState.textContent  = 'EN PAROLE';
    robotState.classList.add('speaking');
    voiceBars.classList.add('active');
    robotSvg.classList.add('speaking');
    $('robot-ring').style.animationPlayState = 'running';

    // Animate mouth segments randomly
    const segs = robotSvg.querySelectorAll('.mouth-seg');
    mouthAnimId = setInterval(() => {
        segs.forEach(s => {
            const h = Math.random();
            s.style.opacity = 0.3 + h * 0.7;
            s.setAttribute('y', 83 - h * 3);
            s.setAttribute('height', 3 + h * 5);
        });
    }, 80);
}

function stopSpeakingAnimation() {
    robotState.textContent  = 'EN VEILLE';
    robotState.classList.remove('speaking');
    voiceBars.classList.remove('active');
    robotSvg.classList.remove('speaking');

    if (mouthAnimId) {
        clearInterval(mouthAnimId);
        mouthAnimId = null;
    }
    // Reset mouth
    robotSvg.querySelectorAll('.mouth-seg').forEach(s => {
        s.style.opacity = 0.3;
        s.setAttribute('y', 83);
        s.setAttribute('height', 6);
    });
}

function setListeningAnimation(active) {
    if (active) {
        robotState.textContent = 'ÉCOUTE...';
        robotState.classList.add('speaking');
        voiceBars.classList.add('active');
    } else {
        stopSpeakingAnimation();
    }
}

/* ═══════════════════════════════════════════════════════════
   TEXT-TO-SPEECH
═══════════════════════════════════════════════════════════ */
function speakText(text) {
    if (!ttsEnabled || !speechSynth) return;

    // Cancel any ongoing speech
    speechSynth.cancel();

    const cleaned = text.replace(/[*#_`>]/g, '').replace(/<[^>]+>/g, '');
    const utt = new SpeechSynthesisUtterance(cleaned);
    utt.lang  = 'fr-FR';
    utt.rate  = 1.0;
    utt.pitch = 1.1;
    utt.volume = 0.9;

    // Pick a French voice if available
    const voices = speechSynth.getVoices();
    const frVoice = voices.find(v => v.lang.startsWith('fr'));
    if (frVoice) utt.voice = frVoice;

    utt.onstart = () => {
        isSpeaking = true;
        stopVoiceBtn.disabled = false;
        startSpeakingAnimation();
    };

    utt.onend = utt.onerror = () => {
        isSpeaking = false;
        stopVoiceBtn.disabled = true;
        stopSpeakingAnimation();
    };

    currentUtterance = utt;
    speechSynth.speak(utt);
}

function stopSpeech() {
    if (speechSynth) {
        speechSynth.cancel();
        isSpeaking = false;
        stopVoiceBtn.disabled = true;
        stopSpeakingAnimation();
    }
}

/* ═══════════════════════════════════════════════════════════
   VOICE RECOGNITION
═══════════════════════════════════════════════════════════ */
function toggleMic() {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) {
        showToast('Reconnaissance vocale non supportée', 'warning');
        return;
    }

    if (isListening) return;

    const recognition = new SR();
    recognition.lang = 'fr-FR';
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;

    isListening = true;
    micBtn.classList.add('listening');
    micBtn.innerHTML = '<i class="fas fa-stop"></i>';
    setListeningAnimation(true);

    recognition.start();

    recognition.onresult = e => {
        const transcript = e.results[0][0].transcript;
        userInput.value = transcript;
        isListening = false;
        micBtn.classList.remove('listening');
        micBtn.innerHTML = '<i class="fas fa-microphone"></i>';
        setListeningAnimation(false);
        sendQuestion();
    };

    recognition.onerror = () => {
        isListening = false;
        micBtn.classList.remove('listening');
        micBtn.innerHTML = '<i class="fas fa-microphone"></i>';
        setListeningAnimation(false);
        showToast('Erreur microphone', 'error');
    };

    recognition.onend = () => {
        if (isListening) {
            isListening = false;
            micBtn.classList.remove('listening');
            micBtn.innerHTML = '<i class="fas fa-microphone"></i>';
            setListeningAnimation(false);
        }
    };
}

/* ═══════════════════════════════════════════════════════════
   CHAT MESSAGES
═══════════════════════════════════════════════════════════ */
function getTime() {
    const d = new Date();
    return `${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`;
}

function appendMessage(text, sender) {
    const isBot = sender === 'bot';
    msgCount++;
    msgCountEl.textContent = `${msgCount} message(s)`;

    const div = document.createElement('div');
    div.className = `msg ${sender}`;

    const avatar = document.createElement('div');
    avatar.className = 'msg-avatar';
    avatar.innerHTML = isBot
        ? '<i class="fas fa-microchip"></i>'
        : '<i class="fas fa-user"></i>';

    const content = document.createElement('div');
    content.className = 'msg-content';

    const header = document.createElement('div');
    header.className = 'msg-header';
    header.innerHTML = `${isBot ? 'ASSISTANT E-TECH' : 'VOUS'} <span class="msg-time">${getTime()}</span>`;

    const bubble = document.createElement('div');
    bubble.className = 'msg-bubble';

    if (isBot) {
        // Typewriter effect
        bubble.classList.add('typing-cursor');
        content.appendChild(header);
        content.appendChild(bubble);
        div.appendChild(avatar);
        div.appendChild(content);
        chatScroll.appendChild(div);
        scrollToBottom();

        typewriterEffect(bubble, text, () => {
            bubble.classList.remove('typing-cursor');
        });
    } else {
        bubble.textContent = text;
        content.appendChild(header);
        content.appendChild(bubble);
        div.appendChild(avatar);
        div.appendChild(content);
        chatScroll.appendChild(div);
        scrollToBottom();
    }

    // Add to history (user messages only, brief)
    if (!isBot && text.length > 0) {
        addToHistory(text);
    }
}

function typewriterEffect(el, text, onDone) {
    let i = 0;
    el.textContent = '';
    const interval = setInterval(() => {
        el.textContent += text[i];
        i++;
        if (i >= text.length) {
            clearInterval(interval);
            if (onDone) onDone();
        }
        scrollToBottom();
    }, 18);
}

function scrollToBottom() {
    chatScroll.scrollTop = chatScroll.scrollHeight;
}

/* ═══════════════════════════════════════════════════════════
   SEND QUESTION
═══════════════════════════════════════════════════════════ */
async function sendQuestion() {
    const question = userInput.value.trim();
    if (!question) return;

    userInput.value = '';
    appendMessage(question, 'user');

    // Show typing indicator
    typingInd.classList.add('visible');
    scrollToBottom();

    try {
        const res = await fetch(API_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ question, mode: currentMode })
        });

        const data = await res.json();

        typingInd.classList.remove('visible');

        if (data.reponse) {
            appendMessage(data.reponse, 'bot');
            speakText(data.reponse);
        } else {
            const err = `⚠️ Erreur : ${data.erreur || 'Inconnue'}`;
            appendMessage(err, 'bot');
        }
    } catch (e) {
        typingInd.classList.remove('visible');
        const errMsg = '❌ Impossible de joindre le serveur. Vérifiez que chat.py est lancé sur localhost:5000.';
        appendMessage(errMsg, 'bot');
    }
}

/* ═══════════════════════════════════════════════════════════
   HISTORY
═══════════════════════════════════════════════════════════ */
function addToHistory(text) {
    history.unshift(text);
    if (history.length > 10) history.pop();
    renderHistory();
}

function renderHistory() {
    const list = $('history-list');
    if (history.length === 0) {
        list.innerHTML = '<div class="history-empty">Aucune conversation</div>';
        return;
    }
    list.innerHTML = history.map(h =>
        `<div class="history-item" title="${h}"><i class="fas fa-chevron-right" style="font-size:0.55rem;margin-right:6px;opacity:0.5"></i>${h.substring(0, 32)}${h.length > 32 ? '…' : ''}</div>`
    ).join('');

    // Click to re-use
    list.querySelectorAll('.history-item').forEach((el, i) => {
        el.addEventListener('click', () => {
            userInput.value = history[i];
            userInput.focus();
        });
    });
}

/* ═══════════════════════════════════════════════════════════
   MODE SELECTOR
═══════════════════════════════════════════════════════════ */
function setMode(mode) {
    currentMode = mode;

    document.querySelectorAll('.mode-btn').forEach(b => {
        b.classList.toggle('active', b.dataset.mode === mode);
    });

    const labels = { general: 'MODE GÉNÉRAL', voiture: 'MODE VÉHICULE' };
    modeBadge.textContent = labels[mode] || 'MODE GÉNÉRAL';

    showToast(`Mode : ${mode === 'general' ? 'Général' : 'Véhicule'}`, 'success');
}

document.querySelectorAll('.mode-btn').forEach(btn => {
    btn.addEventListener('click', () => setMode(btn.dataset.mode));
});

/* ═══════════════════════════════════════════════════════════
   TOAST NOTIFICATIONS
═══════════════════════════════════════════════════════════ */
function showToast(msg, type = 'success') {
    const icons = { success: 'fa-circle-check', warning: 'fa-triangle-exclamation', error: 'fa-circle-xmark' };
    const container = $('toast-container');
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.innerHTML = `<i class="fas ${icons[type] || icons.success}"></i><span>${msg}</span>`;
    container.appendChild(toast);
    setTimeout(() => {
        toast.style.animation = 'toast-out 0.3s ease forwards';
        setTimeout(() => toast.remove(), 300);
    }, 3000);
}

/* ═══════════════════════════════════════════════════════════
   EVENT LISTENERS
═══════════════════════════════════════════════════════════ */

// Send button
$('btn-send').addEventListener('click', sendQuestion);

// Enter key
userInput.addEventListener('keypress', e => {
    if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        sendQuestion();
    }
});

// Mic button
micBtn.addEventListener('click', toggleMic);

// Stop voice
stopVoiceBtn.addEventListener('click', stopSpeech);

// TTS toggle
ttsToggle.addEventListener('click', () => {
    ttsEnabled = !ttsEnabled;
    ttsToggle.classList.toggle('active', ttsEnabled);
    ttsToggle.innerHTML = ttsEnabled
        ? '<i class="fas fa-volume-high"></i>'
        : '<i class="fas fa-volume-xmark"></i>';
    if (!ttsEnabled) stopSpeech();
    showToast(`Voix ${ttsEnabled ? 'activée' : 'désactivée'}`, ttsEnabled ? 'success' : 'warning');
});

// Clear history
$('clear-history').addEventListener('click', () => {
    history = [];
    renderHistory();
    showToast('Historique effacé', 'warning');
});

// Sidebar toggle
$('sidebar-toggle').addEventListener('click', () => {
    sidebar.classList.toggle('open');
});

// Close sidebar on main content click (mobile)
document.querySelector('.main-content').addEventListener('click', () => {
    if (window.innerWidth < 900) sidebar.classList.remove('open');
});

/* ═══════════════════════════════════════════════════════════
   STATUS INDICATORS (simulate)
═══════════════════════════════════════════════════════════ */
setTimeout(() => {
    $('status-voice').classList.add('active');
}, 800);
setTimeout(() => {
    $('status-vehicle').classList.add('active');
}, 1600);

/* ═══════════════════════════════════════════════════════════
   VOICES LOAD (TTS needs voices to be loaded)
═══════════════════════════════════════════════════════════ */
if (speechSynth) {
    speechSynth.onvoiceschanged = () => {};
    // Trigger voice load
    speechSynth.getVoices();
}

/* ═══════════════════════════════════════════════════════════
   GSAP ENTRANCE ANIMATIONS
═══════════════════════════════════════════════════════════ */
if (typeof gsap !== 'undefined') {
    // Staggered intro
    gsap.from('.sidebar-brand', { duration: 0.8, x: -30, opacity: 0, ease: 'power3.out', delay: 0.1 });
    gsap.from('.sys-status',    { duration: 0.8, x: -30, opacity: 0, ease: 'power3.out', delay: 0.25 });
    gsap.from('.sidebar-modes', { duration: 0.8, x: -30, opacity: 0, ease: 'power3.out', delay: 0.4 });
    gsap.from('.hud-bar',       { duration: 0.8, y: -20, opacity: 0, ease: 'power3.out', delay: 0.1 });
    gsap.from('.car-viewport',  { duration: 1.0, opacity: 0, scale: 0.97, ease: 'power3.out', delay: 0.3 });
    gsap.from('.robot-panel',   { duration: 0.8, x: 30, opacity: 0, ease: 'power3.out', delay: 0.5 });
    gsap.from('.chat-section',  { duration: 0.8, y: 20, opacity: 0, ease: 'power3.out', delay: 0.6 });
}

/* ═══════════════════════════════════════════════════════════
   FUTURISTIC UI SOUNDS (optional Web Audio API)
═══════════════════════════════════════════════════════════ */
function playUIBeep(freq = 880, dur = 0.08, vol = 0.05) {
    try {
        const ctx = new (window.AudioContext || window.webkitAudioContext)();
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.frequency.value = freq;
        osc.type = 'sine';
        gain.gain.setValueAtTime(vol, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + dur);
        osc.start(ctx.currentTime);
        osc.stop(ctx.currentTime + dur);
    } catch (e) {}
}

$('btn-send').addEventListener('click', () => playUIBeep(1200, 0.06));
micBtn.addEventListener('click', () => playUIBeep(800, 0.1));
document.querySelectorAll('.mode-btn').forEach(b => {
    b.addEventListener('click', () => playUIBeep(1000, 0.07));
});

console.log('%c🚗 CLIO E-TECH AI ASSISTANT v2.0 NEURAL', 'color:#00d4ff;font-size:14px;font-weight:bold;');
console.log('%cInterface chargée. Backend requis sur localhost:5000', 'color:#7aa0c0;font-size:11px;');
