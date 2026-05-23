/**
 * CLIO E-TECH AI ASSISTANT — script.js
 * Full-featured: Three.js 3D, TTS, STT, Animations, Chat, Mobile Optimized
 */

'use strict';

/* ═══════════════════════════════════════════════════════════
   CONFIG (Utilise localhost pour pointer vers ton fichier chat.py local)
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
let carMesh       = null;

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
    if (!canvas) return;
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
    const clockEl = $('hud-time');
    if (!clockEl) return;
    const now = new Date();
    const h = String(now.getHours()).padStart(2, '0');
    const m = String(now.getMinutes()).padStart(2, '0');
    clockEl.textContent = `${h}:${m}`;
}
updateClock();
setInterval(updateClock, 10000);

const welcomeTimeEl = $('welcome-time');
if (welcomeTimeEl) {
    welcomeTimeEl.textContent = (() => {
        const d = new Date();
        return `${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`;
    })();
}

/* ═══════════════════════════════════════════════════════════
   THREE.JS 3D CAR (Correction du Centrage et des Couleurs)
═══════════════════════════════════════════════════════════ */
(function initThreeJS() {
    const canvas = $('car-canvas');
    const viewport = $('car-viewport');
    const loadingEl = $('loading-3d');
    if (!canvas || !viewport) return;

    const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.2;

    const scene = new THREE.Scene();
    scene.fog = new THREE.FogExp2(0x010810, 0.05);

    const camera = new THREE.PerspectiveCamera(40, viewport.clientWidth / viewport.clientHeight, 0.1, 100);
    camera.position.set(2.4, 0.9, 2.8);
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

    // Eclairage
    const ambientLight = new THREE.AmbientLight(0xffffff, 1.2);
    scene.add(ambientLight);

    const keyLight = new THREE.DirectionalLight(0xffffff, 1.5);
    keyLight.position.set(5, 10, 7);
    scene.add(keyLight);

    const fillLight = new THREE.DirectionalLight(0xffcc00, 0.6);
    fillLight.position.set(-5, 5, -5);
    scene.add(fillLight);

    // Sol et Grilles
    const groundGeo  = new THREE.PlaneGeometry(20, 20);
    const groundMat  = new THREE.MeshStandardMaterial({ color: 0x001020, metalness: 0.8, roughness: 0.4 });
    const ground = new THREE.Mesh(groundGeo, groundMat);
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = -0.85;
    scene.add(ground);

    const grid = new THREE.GridHelper(20, 40, 0x00d4ff, 0x001825);
    grid.position.y = -0.84;
    grid.material.opacity = 0.2;
    grid.material.transparent = true;
    scene.add(grid);

    const carGroup = new THREE.Group();
    scene.add(carGroup);

    let autoRotate = true;
    let isDragging = false;
    let prevX = 0;
    let rotationY = 0;
    let targetRotY = 0;

    viewport.addEventListener('mousedown', e => { isDragging = true; autoRotate = false; prevX = e.clientX; });
    window.addEventListener('mousemove', e => {
        if (!isDragging) return;
        targetRotY += (e.clientX - prevX) * 0.012;
        prevX = e.clientX;
    });
    window.addEventListener('mouseup', () => { isDragging = false; setTimeout(() => { autoRotate = true; }, 2000); });

    viewport.addEventListener('touchstart', e => { isDragging = true; autoRotate = false; prevX = e.touches[0].clientX; });
    window.addEventListener('touchmove', e => {
        if (!isDragging) return;
        targetRotY += (e.touches[0].clientX - prevX) * 0.012;
        prevX = e.touches[0].clientX;
    });
    window.addEventListener('touchend', () => { isDragging = false; setTimeout(() => { autoRotate = true; }, 2000); });

    // Injection dynamique du GLTFLoader
    const script = document.createElement('script');
    script.src = 'https://cdn.jsdelivr.net/npm/three@0.128.0/examples/js/loaders/GLTFLoader.js';
    script.onload = () => {
        const loader = new THREE.GLTFLoader();
        loader.load('clio.glb', gltf => {
            carMesh = gltf.scene;

            // Calcul Algorithmique du Centrage Automatique Objets Mal Centrés
            const box = new THREE.Box3().setFromObject(carMesh);
            const center = box.getCenter(new THREE.Vector3());
            const size = box.getSize(new THREE.Vector3());

            carMesh.position.x += (carMesh.position.x - center.x);
            carMesh.position.y += (carMesh.position.y - center.y) - 0.15;
            carMesh.position.z += (carMesh.position.z - center.z);

            const maxDim = Math.max(size.x, size.y, size.z);
            const scale = 2.8 / maxDim;
            carMesh.scale.setScalar(scale);

            carMesh.traverse(child => {
                if (child.isMesh) {
                    child.castShadow = true;
                    child.receiveShadow = true;
                    child.material.wireframe = false; // Rendu Plein Solide Qualitatif
                    child.material.roughness = 0.2;
                    child.material.metalness = 0.5;
                    if(child.material.color) child.material.color.setHex(0x00d4ff); // Teinte Cyan par défaut
                }
            });

            carGroup.add(carMesh);
            if(loadingEl) loadingEl.classList.add('hidden');
        }, progress => {
            const pct = Math.round(progress.loaded / progress.total * 100);
            if(loadingEl) loadingEl.querySelector('span').textContent = `CHARGEMENT... ${pct}%`;
        }, error => {
            console.warn('Fichier clio.glb introuvable. Rendu du modèle de secours.');
            createFallbackCar();
            if(loadingEl) loadingEl.classList.add('hidden');
        });
    };
    document.head.appendChild(script);

    function createFallbackCar() {
        const group = new THREE.Group();
        const bodyMat = new THREE.MeshStandardMaterial({ color: 0x00d4ff, metalness: 0.8, roughness: 0.2 });
        const lower = new THREE.Mesh(new THREE.BoxGeometry(2, 0.5, 1), bodyMat);
        lower.position.y = 0.25;
        group.add(lower);
        carMesh = group;
        carGroup.add(group);
    }

    const clock = new THREE.Clock();
    function animate() {
        requestAnimationFrame(animate);
        const t = clock.getElapsedTime();
        if (autoRotate) targetRotY += targetRotationSpeed;
        rotationY += (targetRotY - rotationY) * 0.08;
        carGroup.rotation.y = rotationY;
        carGroup.position.y = Math.sin(t * 0.6) * 0.03;
        grid.position.z = (t * 0.5) % 0.5;
        renderer.render(scene, camera);
    }
    animate();
})();

/* ═══════════════════════════════════════════════════════════
   ROBOT ANIMATIONS
═══════════════════════════════════════════════════════════ */
function startSpeakingAnimation() {
    if(!robotState) return;
    robotState.textContent  = 'EN PAROLE';
    robotState.classList.add('speaking');
    if(voiceBars) voiceBars.classList.add('active');
    if(robotSvg) robotSvg.classList.add('speaking');

    const segs = document.querySelectorAll('.mouth-seg');
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
    if(!robotState) return;
    robotState.textContent  = 'EN VEILLE';
    robotState.classList.remove('speaking');
    if(voiceBars) voiceBars.classList.remove('active');
    if(robotSvg) robotSvg.classList.remove('speaking');

    if (mouthAnimId) { clearInterval(mouthAnimId); mouthAnimId = null; }
    document.querySelectorAll('.mouth-seg').forEach(s => {
        s.style.opacity = 0.3;
        s.setAttribute('y', 83);
        s.setAttribute('height', 6);
    });
}

function setListeningAnimation(active) {
    if(!robotState) return;
    if (active) {
        robotState.textContent = 'ÉCOUTE...';
        robotState.classList.add('speaking');
        if(voiceBars) voiceBars.classList.add('active');
    } else {
        stopSpeakingAnimation();
    }
}

/* ═══════════════════════════════════════════════════════════
   TEXT-TO-SPEECH (Fallback local si besoin)
═══════════════════════════════════════════════════════════ */
function speakText(text) {
    // La voix principale est gérée en tâche de fond par Python sur ton PC.
    // Cette fonction sert de structure d'écoute visuelle pour l'IHM.
    startSpeakingAnimation();
    const duration = Math.max(2500, text.length * 65);
    setTimeout(() => {
        stopSpeakingAnimation();
    }, duration);
}

function stopSpeech() {
    stopSpeakingAnimation();
}

/* ═══════════════════════════════════════════════════════════
   VOICE RECOGNITION (STT HTML5)
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
    isListening = true;
    micBtn.classList.add('listening');
    setListeningAnimation(true);
    recognition.start();

    recognition.onresult = e => {
        userInput.value = e.results[0][0].transcript;
        isListening = false;
        micBtn.classList.remove('listening');
        setListeningAnimation(false);
        sendQuestion();
    };

    recognition.onerror = () => {
        isListening = false;
        micBtn.classList.remove('listening');
        setListeningAnimation(false);
        showToast('Erreur microphone', 'error');
    };
}

/* ═══════════════════════════════════════════════════════════
   CHAT CORE LOGIC
═══════════════════════════════════════════════════════════ */
function appendMessage(text, sender) {
    const isBot = sender === 'bot';
    msgCount++;
    if(msgCountEl) msgCountEl.textContent = `${msgCount} message(s)`;

    const div = document.createElement('div');
    div.className = `msg ${sender}`;

    const avatar = document.createElement('div');
    avatar.className = 'msg-avatar';
    avatar.innerHTML = isBot ? '<i class="fas fa-microchip"></i>' : '<i class="fas fa-user"></i>';

    const content = document.createElement('div');
    content.className = 'msg-content';

    const header = document.createElement('div');
    header.className = 'msg-header';
    header.innerHTML = `${isBot ? 'ASSISTANT E-TECH' : 'VOUS'} <span class="msg-time">${new Date().toLocaleTimeString('fr-FR',{hour:'2-digit',minute:'2-digit'})}</span>`;

    const bubble = document.createElement('div');
    bubble.className = 'msg-bubble';

    if (isBot) {
        bubble.classList.add('typing-cursor');
        content.appendChild(header);
        content.appendChild(bubble);
        div.appendChild(avatar);
        div.appendChild(content);
        chatScroll.appendChild(div);
        
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
    }
    chatScroll.scrollTop = chatScroll.scrollHeight;
    if (!isBot && text.length > 0) addToHistory(text);
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
        chatScroll.scrollTop = chatScroll.scrollHeight;
    }, 18);
}

async function sendQuestion() {
    const question = userInput.value.trim();
    if (!question) return;

    userInput.value = '';
    appendMessage(question, 'user');

    if(typingInd) typingInd.classList.add('visible');
    chatScroll.scrollTop = chatScroll.scrollHeight;
    targetRotationSpeed = 0.08; // Accélération visuelle de la voiture lors du traitement

    try {
        const res = await fetch(API_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ question, mode: currentMode })
        });
        const data = await res.json();
        if(typingInd) typingInd.classList.remove('visible');

        if (data.reponse) {
            appendMessage(data.reponse, 'bot');
            speakText(data.reponse);
        } else {
            appendMessage(`⚠️ Erreur : ${data.erreur}`, 'bot');
        }
    } catch (e) {
        if(typingInd) typingInd.classList.remove('visible');
        appendMessage('❌ Impossible de joindre le serveur Python local. Lancez chat.py.', 'bot');
    }
    targetRotationSpeed = 0.003;
}

/* ═══════════════════════════════════════════════════════════
   MODE SELECTOR (Synchronisé Ordinateur / Téléphone)
═══════════════════════════════════════════════════════════ */
function setMode(mode) {
    currentMode = mode;

    // Synchronisation des boutons Sidebar (PC)
    document.querySelectorAll('.mode-btn').forEach(b => {
        b.classList.toggle('active', b.dataset.mode === mode);
    });

    // Synchronisation des boutons HUD (Téléphone)
    const hudGen = document.getElementById('hud-mode-general');
    const hudVeh = document.getElementById('hud-mode-vehicule');
    if (hudGen && hudVeh) {
        hudGen.classList.toggle('active', mode === 'general');
        hudVeh.classList.toggle('active', mode === 'voiture');
    }

    if(modeBadge) {
        modeBadge.textContent = mode === 'general' ? 'MODE GÉNÉRAL' : 'MODE VÉHICULE';
    }

    // Changement de la couleur du maillage 3D selon le mode
    if (carMesh) {
        carMesh.traverse(child => {
            if (child.isMesh && child.material) {
                child.material.color.setHex(mode === 'voiture' ? 0xffcc00 : 0x00d4ff);
            }
        });
    }
    showToast(`Mode : ${mode === 'general' ? 'Général' : 'Véhicule'}`, 'success');
}

/* ═══════════════════════════════════════════════════════════
   HISTORY & TOASTS & LIFECYCLE
═══════════════════════════════════════════════════════════ */
function addToHistory(text) {
    history.unshift(text);
    if (history.length > 8) history.pop();
    renderHistory();
}

function renderHistory() {
    const list = $('history-list');
    if (!list) return;
    if (history.length === 0) {
        list.innerHTML = '<div class="history-empty">Aucune conversation</div>';
        return;
    }
    list.innerHTML = history.map(h => `<div class="history-item"><i class="fas fa-chevron-right" style="font-size:0.55rem;margin-right:6px;opacity:0.5"></i>${h.substring(0, 24)}...</div>`).join('');
}

function showToast(msg, type = 'success') {
    const container = $('toast-container');
    if(!container) return;
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.innerHTML = `<span>${msg}</span>`;
    container.appendChild(toast);
    setTimeout(() => { toast.remove(); }, 3000);
}

// Global Listeners
$('btn-send').addEventListener('click', sendQuestion);
userInput.addEventListener('keypress', e => { if (e.key === 'Enter') sendQuestion(); });
micBtn.addEventListener('click', toggleMic);
$('sidebar-toggle').addEventListener('click', () => sidebar.classList.toggle('open'));
document.querySelectorAll('.mode-btn').forEach(btn => {
    btn.addEventListener('click', () => setMode(btn.dataset.mode));
});
