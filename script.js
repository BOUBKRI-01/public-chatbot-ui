let currentMode = "general";
const API_URL = "http://localhost:5000/chat"; 

const avatar = document.getElementById('robot-avatar');
const statusText = document.getElementById('robot-status');

// ==========================================
// MOTEUR DE RENDU 3D INTERACTIF (Three.js)
// ==========================================
let scene, camera, renderer, carMesh;
let targetRotationSpeed = 0.005;

function init3D() {
    const container = document.getElementById('car-3d-container');
    
    scene = new THREE.Scene();
    camera = new THREE.PerspectiveCamera(45, container.clientWidth / container.clientHeight, 0.1, 100);
    camera.position.z = 6;

    renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
    renderer.setSize(container.clientWidth, container.clientHeight);
    container.appendChild(renderer.domElement);

    // Système d'éclairage
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
    scene.add(ambientLight);
    
    const directionalLight = new THREE.DirectionalLight(0xffcc00, 0.8);
    directionalLight.position.set(3, 5, 3);
    scene.add(directionalLight);

    // Structure géométrique épurée représentative du châssis aérodynamique
    const geometry = new THREE.ConeGeometry(1.4, 2.8, 4); 
    const material = new THREE.MeshStandardMaterial({ 
        color: 0x484870, 
        wireframe: true, 
        roughness: 0.2
    });
    
    carMesh = new THREE.Mesh(geometry, material);
    carMesh.rotation.x = 1.3; 
    scene.add(carMesh);

    animate3D();
}

function animate3D() {
    requestAnimationFrame(animate3D);
    
    // Convergence progressive vers la vitesse de rotation cible
    carMesh.rotation.z += targetRotationSpeed;
    if (targetRotationSpeed > 0.005) {
        targetRotationSpeed -= 0.002; // Décélération progressive après calcul
    }
    
    renderer.render(scene, camera);
}

window.onload = () => { init3D(); };

window.onresize = () => {
    const container = document.getElementById('car-3d-container');
    camera.aspect = container.clientWidth / container.clientHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(container.clientWidth, container.clientHeight);
};

// ==========================================
// PIPELINE DE GESTION DES REQUÊTES CHAT
// ==========================================

function setMode(mode) {
    currentMode = mode;
    document.getElementById('btn-general').classList.toggle('active', mode === 'general');
    document.getElementById('btn-voiture').classList.toggle('active', mode === 'voiture');
    
    if(mode === 'voiture') {
        carMesh.material.color.setHex(0xffcc00); // Jaune d'ingénierie Clio E-Tech
    } else {
        carMesh.material.color.setHex(0x484870); // Bleu technologique neutre
    }
}

function checkEnter(event) {
    if (event.key === "Enter") sendQuestion();
}

async function sendQuestion() {
    const input = document.getElementById('user-input');
    const question = input.value.trim();
    if (!question) return;

    appendMessage(question, 'user');
    input.value = '';

    // ÉTAT : L'IA est en cours d'analyse
    avatar.className = "robot-avatar thinking";
    statusText.innerText = "Traitement...";
    targetRotationSpeed = 0.08; // Accélération du maillage 3D

    try {
        const response = await fetch(API_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ question: question, mode: currentMode })
        });
        
        const data = await response.json();
        
        if (data.reponse) {
            appendMessage(data.reponse, 'bot');
            
            // ÉTAT : Émission de la réponse vocale
            avatar.className = "robot-avatar speaking";
            statusText.innerText = "Réponse vocale...";
            
            // Calcul automatique de la durée de parole selon le volume textuel
            const duration = Math.max(2500, data.reponse.length * 70); 
            setTimeout(() => {
                avatar.className = "robot-avatar";
                statusText.innerText = "Système prêt";
            }, duration);

        } else {
            appendMessage("⚠️ Réponse invalide du serveur.", 'bot');
            resetRobot();
        }
    } catch (error) {
        appendMessage("❌ Connexion perdue avec l'hôte local Python.", 'bot');
        resetRobot();
    }
}

function resetRobot() {
    avatar.className = "robot-avatar";
    statusText.innerText = "Système prêt";
    targetRotationSpeed = 0.005;
}

function appendMessage(text, sender) {
    const chatBox = document.getElementById('chat-box');
    const msgDiv = document.createElement('div');
    msgDiv.classList.add('message', sender);
    msgDiv.innerText = text;
    chatBox.appendChild(msgDiv);
    chatBox.scrollTop = chatBox.scrollHeight;
}

// ==========================================
// RECONNAISSANCE VOCALE DU NAVIGATEUR (WEB)
// ==========================================
function toggleMic() {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
        alert("Votre navigateur ne supporte pas la capture vocale native.");
        return;
    }

    const recognition = new SpeechRecognition();
    recognition.lang = 'fr-FR';
    
    avatar.className = "robot-avatar thinking";
    statusText.innerText = "Écoute en cours...";
    
    recognition.start();
    
    recognition.onresult = function(event) {
        document.getElementById('user-input').value = event.results[0][0].transcript;
        sendQuestion();
    };
    
    recognition.onerror = function() { resetRobot(); };
    recognition.onend = function() { resetRobot(); };
}
