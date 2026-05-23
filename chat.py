import serial
import time
from openai import OpenAI
from gtts import gTTS
from langdetect import detect
import pygame
import os
import re
import speech_recognition as sr
import keyboard
from flask import Flask, request, jsonify
from flask_cors import CORS
import threading

# =====================================================================
# CONFIGURATION
# =====================================================================

API_KEY = "rcai-a2066176db10ce5fc6803360d5f271f8"
MODEL = "trinity-mini"
PORT = "COM4"

vehicle_specs = """
Modèle : Renault Clio E-TECH Full Hybrid (HEV)

==============================
GROUPE MOTOPROPULSEUR
==============================
Type de motorisation : Hybride (moteur thermique + moteur électrique)
Type moteur thermique : H4M 5DH
Cylindrée : 1598 cm3
Carburant : Essence sans plomb
Norme carburant : EN 228 (jusqu’à 10 % d’éthanol)

Fonctionnement :
- Le système hybride combine moteur thermique et moteur électrique.
- Le moteur électrique améliore l’accélération et la consommation.
- Le véhicule peut fonctionner en mode 100 % électrique.
- Le système sélectionne automatiquement moteur thermique, électrique ou les deux selon la conduite.

==============================
SYSTÈME HYBRIDE
==============================
Moteur électrique : présent
Mode électrique : possible à basse vitesse
Vitesse maximale mode EV : environ 50 km/h
Système de récupération d’énergie : oui (freinage régénératif)

Flux énergétiques :
- Traction électrique
- Traction moteur thermique
- Récupération d’énergie au freinage
- Production d’énergie par moteur thermique

Mode E-Save :
- Permet de conserver le niveau de charge de la batterie pour une utilisation ultérieure.

==============================
BATTERIES
==============================
Batterie de traction :
Type : Lithium-ion
Tension : environ 230 volts
Emplacement : sous le plancher arrière
Fonction : alimenter le moteur électrique

Recharge batterie :
- récupération d’énergie lors du freinage
- moteur thermique utilisé comme générateur

Batterie secondaire :
Type : batterie auxiliaire
Tension : 12 volts
Emplacement : coffre
Fonction : alimentation des équipements du véhicule

==============================
CIRCUIT ÉLECTRIQUE
==============================
Tension système hybride : environ 230 V
Câblage haute tension : couleur orange
Circuit haute tension : réservé aux techniciens Renault

==============================
DIMENSIONS DU VÉHICULE
==============================
Longueur totale : 4.047 m
Largeur avec rétroviseurs : 1.998 m
Largeur rétroviseurs repliés : 1.798 m
Hauteur : 1.440 m
Empattement : 2.283 m
Voie avant : 1.518 m
Voie arrière : 1.506 m

==============================
MASSES ET CHARGES
==============================
Charge remorque non freinée : 550 kg
Charge maximale sur attelage : 63 kg
Charge maximale sur toit : 80 kg

==============================
IDENTIFICATION VÉHICULE
==============================
Plaque constructeur contient : Nom constructeur, Numéro VIN, MMAC, MTR, etc.

==============================
PARTICULARITÉS E-TECH
==============================
Avertisseur sonore piétons : actif entre 1 et 30 km/h
Indicateur flux d’énergie : affiche utilisation thermique / électrique
Message READY : indique véhicule prêt à rouler
Système silencieux en mode électrique

==============================
CARACTÉRISTIQUES SUPPLÉMENTAIRES
==============================
Refroidissement batterie : ventilation arrière
Grille d’aération batterie : ne pas obstruer
Démarrage moteur thermique : automatique selon besoin énergétique
Recharge batterie : automatique pendant la conduite
"""

# =====================================================================
# INITIALISATION DES COMPOSANTS
# =====================================================================

client = OpenAI(
    api_key=API_KEY,
    base_url="https://api.arcee.ai/api/v1"
)

# Initialisation de la communication série avec l'Arduino
try:
    arduino = serial.Serial(PORT, 9600)
    time.sleep(2)
    print("✅ Arduino connecté sur", PORT)
except Exception as e:
    arduino = None
    print("⚠️ Arduino non détecté. Mode simulation (sans matériel).")

pygame.mixer.init()
recognizer = sr.Recognizer()
micro = sr.Microphone()

# Configuration et sécurité de l'API web Flask
app = Flask(__name__)
CORS(app)

mode = "general"

# =====================================================================
# FONCTIONS LOGIQUES ET PIPELINE AUDIO
# =====================================================================

def nettoyer(texte):
    texte = re.sub(r"[*#_`>-]", "", texte)
    return texte.replace("\n", ". ").strip()


def langue(texte):
    try:
        return detect(texte)
    except:
        return "fr"


def parler(texte):
    texte = nettoyer(texte)
    if texte == "":
        return

    # SOLUTION ABSOLUE : Génération d'un nom de fichier basé sur le temps en millisecondes.
    # Aucun doublon possible, élimine définitivement les erreurs de Permission sous Windows.
    unique_id = int(time.time() * 1000)
    nom_audio = f"rep_{unique_id}.mp3"

    # Enregistrement du fichier de synthèse vocale par gTTS
    try:
        tts = gTTS(text=texte, lang=langue(texte))
        tts.save(nom_audio)
    except Exception as e:
        print(f"❌ Erreur lors de la sauvegarde gTTS : {e}")
        return

    # Signal impulsionnel à destination de la carte Arduino
    if arduino:
        arduino.write(b"1\n")
        time.sleep(0.5)
        arduino.write(b"0\n")

    # Chargement dynamique et exécution de la lecture audio
    try:
        pygame.mixer.music.stop()
        pygame.mixer.music.unload()  # Libère tout pointeur de fichier précédent
        
        time.sleep(0.1)  # Micro-pause technique pour laisser Windows respirer
        
        pygame.mixer.music.load(nom_audio)
        pygame.mixer.music.play()
        
        # Maintien du flux d'exécution pendant que le morceau est joué
        while pygame.mixer.music.get_busy():
            time.sleep(0.1)
            
        pygame.mixer.music.unload()  # Relâche immédiatement le fichier après lecture
        
    except Exception as e:
        print(f"Erreur lors de la lecture audio : {e}")

    # Nettoyage asynchrone sécurisé du disque dur
    try:
        if os.path.exists(nom_audio):
            os.remove(nom_audio)
    except:
        # Si Windows retient le fichier une fraction de seconde de trop, on ignore.
        # Le nom suivant étant différent, cela ne bloquera plus jamais l'application.
        pass


def chatbot_general(question):
    prompt = """
    Tu es un assistant intelligent généraliste.
    Réponds de manière extrêmement concise et directe (maximum 20 mots).
    Pas de formules de politesse inutiles.
    """
    r = client.chat.completions.create(
        model=MODEL,
        messages=[
            {"role": "system", "content": prompt},
            {"role": "user", "content": question}
        ]
    )
    return r.choices[0].message.content


def chatbot_voiture(question):
    prompt = f"""
    Tu es l'assistant technique de cette Renault Clio E-TECH.
    Utilise UNIQUEMENT ces données : {vehicle_specs}
    
    RÈGLES STRICTES :
    1. Réponse ultra-courte (1 phrase maximum).
    2. Si l'info n'est pas dans les données, dis juste : "Information non disponible".
    3. Ne fais pas de phrases d'introduction.
    """
    r = client.chat.completions.create(
        model=MODEL,
        messages=[
            {"role": "system", "content": prompt},
            {"role": "user", "content": question}
        ]
    )
    return r.choices[0].message.content

# =====================================================================
# ENDPOINTS API (INTERFACE FRONTEND VERCEL)
# =====================================================================

@app.route('/chat', methods=['POST'])
def api_chat():
    global mode
    data = request.json
    question = data.get("question")
    mode_selectionne = data.get("mode", "general")

    if not question:
        return jsonify({"erreur": "Question vide"}), 400

    try:
        if mode_selectionne == "general":
            reponse = chatbot_general(question)
        else:
            reponse = chatbot_voiture(question)

        # Déclenchement de la parole dans un fil d'arrière-plan (Thread)
        threading.Thread(target=parler, args=(reponse,)).start()
        return jsonify({"reponse": reponse})
    except Exception as e:
        return jsonify({"erreur": str(e)}), 500

# =====================================================================
# MODULE CONSOLE CLAVIER (MONITORING LOCAL)
# =====================================================================

def boucle_console():
    global mode
    print("\n🤖 Assistant prêt en arrière-plan.")
    print("Commandes Clavier : [ESPACE] Vocal | [T] Texte | [G] Général | [C] Voiture")
    
    while True:
        try:
            key = keyboard.read_key()
            if key == "esc":
                break
            if key == "g":
                mode = "general"
                print("🧠 Mode chatbot général")
                time.sleep(0.2)
            elif key == "c":
                mode = "voiture"
                print("🚗 Mode chatbot voiture")
                time.sleep(0.2)

            if key == "space":
                with micro as source:
                    print("🎤 Parlez...")
                    recognizer.adjust_for_ambient_noise(source, duration=0.5)
                    audio_data = recognizer.listen(source)
                try:
                    question = recognizer.recognize_google(audio_data, language="fr-FR")
                    print("Vous :", question)
                    process_respond(question)
                except:
                    print("Erreur audio")

            elif key == "t":
                question = input("Vous : ")
                process_respond(question)
        except:
            pass


def process_respond(question):
    if not question: 
        return
    reponse = chatbot_general(question) if mode == "general" else chatbot_voiture(question)
    print("🤖 :", reponse)
    parler(reponse)

# =====================================================================
# POINT D'ENTRÉE DU SERVEUR FLASK
# =====================================================================

if __name__ == "__main__":
    # Surveillance des entrées clavier physiques sur un thread démonisé
    threading.Thread(target=boucle_console, daemon=True).start()
    
    print("🚀 Serveur API en ligne sur http://localhost:5000")
    # Exposition du port 5000 pour autoriser l'accès externe (Vercel ou réseau Local)
    app.run(host="0.0.0.0", port=5000, debug=False, use_reloader=False)