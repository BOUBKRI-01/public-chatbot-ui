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
    const container = document.getElementById('car-3d-container');
    if (!container) return;
    
    scene = new THREE.Scene();
    
    // Perspective adaptée pour un meilleur cadrage
    camera = new THREE.PerspectiveCamera(40, container.clientWidth / container.clientHeight, 0.1, 100);
    camera.position.set(0, 1.2, 5); // Recule et lève légèrement la caméra pour une vue 3/4 parfaite

    renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
    renderer.setSize(container.clientWidth, container.clientHeight);
    // Optimisation de la netteté et des couleurs
    renderer.outputEncoding = THREE.sRGBEncoding;
    renderer.setPixelRatio(window.devicePixelRatio);
    container.appendChild(renderer.domElement);

    # Lumières de Studio (Essentielles pour des reflets clairs sur la carrosserie)
    const ambientLight = new THREE.AmbientLight(0xffffff, 1.2); // Lumière globale douce
    scene.add(ambientLight);
    
    const dirLight1 = new THREE.DirectionalLight(0xffffff, 1.5); // Lumière principale (reflets brillants)
    dirLight1.position.set(5, 10, 7);
    scene.add(dirLight1);

    const dirLight2 = new THREE.DirectionalLight(0xffcc00, 0.5); // Reflet ambré pour le style Clio E-Tech
    dirLight2.position.set(-5, 5, -5);
    scene.add(dirLight2);

    // Chargement du fichier 3D de la voiture
    const loader = new THREE.GLTFLoader();
    
    loader.load('clio.glb', function (gltf) {
        carMesh = gltf.scene;

        // --- ALGORITHME DE CENTRAGE ABSOLU ---
        const box = new THREE.Box3().setFromObject(carMesh);
        const center = box.getCenter(new THREE.Vector3());
        const size = box.getSize(new THREE.Vector3());

        // Repositionne le centre de géométrie du fichier exactement au point 0,0,0 du cadre
        carMesh.position.x += (carMesh.position.x - center.x);
        carMesh.position.y += (carMesh.position.y - center.y) - 0.2; // Légèrement rabaissée pour l'esthétique
        carMesh.position.z += (carMesh.position.z - center.z);

        // Ajustement automatique de l'échelle pour que la voiture s'adapte à la taille du cadre
        const maxDim = Math.max(size.x, size.y, size.z);
        const desiredScale = 2.8 / maxDim; // Calcule l'échelle idéale
        carMesh.scale.set(desiredScale, desiredScale, desiredScale);
        // -------------------------------------

        // Application d'un rendu solide, net et qualitatif (Plus de wireframe flou)
        carMesh.traverse((child) => {
            if (child.isMesh) {
                child.material.wireframe = false; // Désactivé pour voir les vraies formes de la carrosserie
                child.material.roughness = 0.2;  // Réflectivité (aspect peinture métallisée neuve)
                child.material.metalness = 0.5;  // Aspect brillant
                
                // Donne une teinte technologique bleu-gris par défaut
                if(child.material.color) {
                    child.material.color.setHex(0x505870);
                }
            }
        });

        scene.add(carMesh);
        animate3D();
        
    }, undefined, function (error) {
        console.warn("Fichier 3D introuvable ou erreur. Chargement du modèle de secours.");
        
        // Forme géométrique de secours si ton fichier clio.glb a un souci
        const geometry = new THREE.ConeGeometry(1.2, 2.4, 4);
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
        // Rotation douce et élégante autour de l'axe vertical (Y)
        carMesh.rotation.y += targetRotationSpeed; 
        
        // Décélération progressive de la vitesse si elle a été accélérée par une question
        if (targetRotationSpeed > 0.005) {
            targetRotationSpeed -= 0.002;
        }
    }
    
    renderer.render(scene, camera);
}

window.onload = () => { init3D(); };

window.onresize = () => {
    const container = document.getElementById('car-3d-container');
    if (!container) return;
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
    
    // Changement dynamique de la couleur de carrosserie selon le mode sélectionné
    carMesh.traverse((child) => {
        if (child.isMesh) {
            if(mode === 'voiture') {
                child.material.color.setHex(0xffcc00); // Jaune Sport E-tech quand on parle technique
            } else {
                child.material.color.setHex(0x505870); // Bleu-gris élégant en mode général
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

    avatar.className = "robot-avatar thinking";
    statusText.innerText = "Traitement...";
    targetRotationSpeed = 0.07; // Accélération de la rotation pendant la réflexion de l'IA

    try {
        const response = await fetch(API_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ question: question, mode: currentMode })
        });
        
        const data = await response.json();
        
        if (data.reponse) {
            appendMessage(data.reponse, 'bot');
            
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
