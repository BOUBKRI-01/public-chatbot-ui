let currentMode = "general";
const API_URL = "http://localhost:5000/chat"; 

const avatar = document.getElementById('robot-avatar');
const statusText = document.getElementById('robot-status');

// ==========================================
// MOTEUR DE RENDU 3D DE LA VOITURE (Three.js)
// ==========================================
let scene, camera, renderer, carMesh;
let targetRotationSpeed = 0.005;

function init3D() {
    const container = document.getElementById('car-33d-container') || document.getElementById('car-3d-container');
    
    scene = new THREE.Scene();
    camera = new THREE.PerspectiveCamera(45, container.clientWidth / container.clientHeight, 0.1, 100);
    camera.position.set(0, 0.8, 4.5); // Positionnement de la caméra pour voir la voiture en entier

    renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
    renderer.setSize(container.clientWidth, container.clientHeight);
    container.appendChild(renderer.domElement);

    // Éclairage global
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.9);
    scene.add(ambientLight);
    
    const directionalLight = new THREE.DirectionalLight(0xffcc00, 1.0);
    directionalLight.position.set(3, 6, 4);
    scene.add(directionalLight);

    // Chargement du fichier 3D externe de la voiture
    const loader = new THREE.GLTFLoader();
    
    // Remplace 'clio.glb' par le nom de ton fichier s'il est différent
    loader.load('clio.glb', function (gltf) {
        carMesh = gltf.scene;
        carMesh.scale.set(1.0, 1.0, 1.0); // Ajuste l'échelle selon la taille de ton modèle 3D
        carMesh.position.set(0, -0.5, 0);

        // Application du style technologique filaire (Wireframe) sur chaque élément géométrique
        carMesh.traverse((child) => {
            if (child.isMesh) {
                child.material.wireframe = true; 
                child.material.color.setHex(0x484870); // Bleu-gris technologique
            }
        });

        scene.add(carMesh);
        animate3D();
        
    }, undefined, function (error) {
        console.warn("Fichier 'clio.glb' introuvable. Chargement du châssis de secours.");
        
        // Châssis de secours (Cône géométrique) si ton fichier 3D n'est pas encore prêt
        const geometry = new THREE.ConeGeometry(1.2, 2.5, 4);
        const material = new THREE.MeshStandardMaterial({ color: 0x484870, wireframe: true });
        carMesh = new THREE.Mesh(geometry, material);
        carMesh.rotation.x = 1.3;
        scene.add(carMesh);
        animate3D();
    });
}

function animate3D() {
    requestAnimationFrame(animate3D);
    
    if (carMesh) {
        carMesh.rotation.y += targetRotationSpeed; // Rotation autour de l'axe vertical
        
        // Décélération fluide de la rotation après une accélération de calcul
        if (targetRotationSpeed > 0.005) {
            targetRotationSpeed -= 0.002;
        }
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
// PIPELINE CHATBOT & INTERACTION
// ==========================================

function setMode(mode) {
    currentMode = mode;
    document.getElementById('btn-general').classList.toggle('active', mode === 'general');
    document.getElementById('btn-voiture').classList.toggle('active', mode === 'voiture');
    
    if (!carMesh) return;
    
    carMesh.traverse((child) => {
        if (child.isMesh) {
            if(mode === 'voiture') {
                child.material.color.setHex(0xffcc00); // Jaune Clio E-Tech
            } else {
                child.material.color.setHex(0x484870); // Style neutre
            }
        }
    });
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

    // Changement d'état visuel du robot et de la voiture
    avatar.className = "robot-avatar thinking";
    statusText.innerText = "Traitement...";
    targetRotationSpeed = 0.09; // La voiture tourne vite pendant la réflexion de l'IA

    try {
        const response = await fetch(API_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ question: question, mode: currentMode })
        });
        
        const data = await response.json();
        
        if (data.reponse) {
            appendMessage(data.reponse, 'bot');
            
            // Activation de l'animation de parole du robot
            avatar.className = "robot-avatar speaking";
            statusText.innerText = "Réponse vocale...";
            
            const duration = Math.max(2500, data.reponse.length * 70); 
            setTimeout(() => {
                avatar.className = "robot-avatar";
                statusText.innerText = "Système prêt";
            }, duration);

        } else {
            appendMessage("⚠️ Réponse invalide.", 'bot');
            resetRobot();
        }
    } catch (error) {
        appendMessage("❌ Erreur : Impossible de contacter l'API Python.", 'bot');
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

function toggleMic() {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) return;

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
