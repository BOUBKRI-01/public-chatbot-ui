let currentMode = "general";
// Mettre l'adresse IP locale de ton PC (ex: http://192.168.x.x:5000) si tu ouvres Vercel depuis un smartphone connecté au même réseau Wi-Fi.
const API_URL = "http://localhost:5000/chat"; 

function setMode(mode) {
    currentMode = mode;
    document.getElementById('btn-general').classList.toggle('active', mode === 'general');
    document.getElementById('btn-voiture').classList.toggle('active', mode === 'voiture');
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

    try {
        const response = await fetch(API_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ question: question, mode: currentMode })
        });
        
        const data = await response.json();
        
        if (data.reponse) {
            appendMessage(data.reponse, 'bot');
        } else {
            appendMessage("⚠️ Erreur : " + data.erreur, 'bot');
        }
    } catch (error) {
        appendMessage("❌ Impossible de joindre le PC hôte (Vérifie que app.py est lancé).", 'bot');
    }
}

function appendMessage(text, sender) {
    const chatBox = document.getElementById('chat-box');
    const msgDiv = document.createElement('div');
    msgDiv.classList.add('message', sender);
    msgDiv.innerText = text;
    chatBox.appendChild(msgDiv);
    chatBox.scrollTop = chatBox.scrollHeight;
}

// Mode Reconnaissance Vocale directement intégrée au navigateur Web
function toggleMic() {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
        alert("Votre navigateur ne supporte pas la reconnaissance vocale.");
        return;
    }

    const recognition = new SpeechRecognition();
    recognition.lang = 'fr-FR';
    const micBtn = document.getElementById('btn-mic');
    micBtn.innerText = "⏳";
    
    recognition.start();
    
    recognition.onresult = function(event) {
        const transcript = event.results[0][0].transcript;
        document.getElementById('user-input').value = transcript;
        micBtn.innerText = "🎤";
        sendQuestion();
    };
    
    recognition.onerror = function() {
        micBtn.innerText = "🎤";
        alert("Erreur de capture audio.");
    };
    
    recognition.onend = function() {
        micBtn.innerText = "🎤";
    };
}