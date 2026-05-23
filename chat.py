"""
chat_server.py — Version Cloud (Render / Railway)
Backend Flask uniquement pour l'API AI
Supprime tout ce qui nécessite un matériel local (Arduino, micro, haut-parleurs)
"""

from flask import Flask, request, jsonify
from flask_cors import CORS
from openai import OpenAI

# =====================================================================
# CONFIGURATION
# =====================================================================

API_KEY = "rcai-a2066176db10ce5fc6803360d5f271f8"   # ← ta clé API Arcee
MODEL   = "trinity-mini"

vehicle_specs = """
Modèle : Renault Clio E-TECH Full Hybrid (HEV)

==============================
GROUPE MOTOPROPULSEUR
==============================
Type de motorisation : Hybride (moteur thermique + moteur électrique)
Type moteur thermique : H4M 5DH
Cylindrée : 1598 cm3
Carburant : Essence sans plomb
Norme carburant : EN 228 (jusqu'à 10 % d'éthanol)

Fonctionnement :
- Le système hybride combine moteur thermique et moteur électrique.
- Le moteur électrique améliore l'accélération et la consommation.
- Le véhicule peut fonctionner en mode 100 % électrique.
- Le système sélectionne automatiquement moteur thermique, électrique ou les deux selon la conduite.

==============================
SYSTÈME HYBRIDE
==============================
Moteur électrique : présent
Mode électrique : possible à basse vitesse
Vitesse maximale mode EV : environ 50 km/h
Système de récupération d'énergie : oui (freinage régénératif)

Flux énergétiques :
- Traction électrique
- Traction moteur thermique
- Récupération d'énergie au freinage
- Production d'énergie par moteur thermique

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
- récupération d'énergie lors du freinage
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
Indicateur flux d'énergie : affiche utilisation thermique / électrique
Message READY : indique véhicule prêt à rouler
Système silencieux en mode électrique

==============================
CARACTÉRISTIQUES SUPPLÉMENTAIRES
==============================
Refroidissement batterie : ventilation arrière
Grille d'aération batterie : ne pas obstruer
Démarrage moteur thermique : automatique selon besoin énergétique
Recharge batterie : automatique pendant la conduite
"""

# =====================================================================
# INITIALISATION
# =====================================================================

client = OpenAI(
    api_key=API_KEY,
    base_url="https://api.arcee.ai/api/v1"
)

app = Flask(__name__)
CORS(app)   # Autorise les requêtes depuis Vercel (domaine différent)

# =====================================================================
# FONCTIONS CHATBOT
# =====================================================================

def chatbot_general(question):
    prompt = """
    Tu es un assistant intelligent généraliste.
    Réponds de manière concise et directe (maximum 40 mots).
    Pas de formules de politesse inutiles.
    """
    r = client.chat.completions.create(
        model=MODEL,
        messages=[
            {"role": "system", "content": prompt},
            {"role": "user",   "content": question}
        ]
    )
    return r.choices[0].message.content


def chatbot_voiture(question):
    prompt = f"""
    Tu es l'assistant technique de cette Renault Clio E-TECH.
    Utilise UNIQUEMENT ces données : {vehicle_specs}

    RÈGLES STRICTES :
    1. Réponse ultra-courte (1 à 2 phrases maximum).
    2. Si l'info n'est pas dans les données, dis juste : "Information non disponible".
    3. Ne fais pas de phrases d'introduction.
    """
    r = client.chat.completions.create(
        model=MODEL,
        messages=[
            {"role": "system", "content": prompt},
            {"role": "user",   "content": question}
        ]
    )
    return r.choices[0].message.content

# =====================================================================
# ENDPOINTS API
# =====================================================================

@app.route('/', methods=['GET'])
def index():
    """Endpoint de vérification — Render ping ce "/" pour garder le serveur actif"""
    return jsonify({"status": "online", "service": "Clio E-TECH AI Backend"})


@app.route('/chat', methods=['POST'])
def api_chat():
    data             = request.json
    question         = data.get("question")
    mode_selectionne = data.get("mode", "general")

    if not question:
        return jsonify({"erreur": "Question vide"}), 400

    try:
        if mode_selectionne == "voiture":
            reponse = chatbot_voiture(question)
        else:
            reponse = chatbot_general(question)

        return jsonify({"reponse": reponse})

    except Exception as e:
        return jsonify({"erreur": str(e)}), 500

# =====================================================================
# LANCEMENT
# =====================================================================

if __name__ == "__main__":
    # Render injecte automatiquement la variable PORT
    import os
    port = int(os.environ.get("PORT", 8080))
    app.run(host="0.0.0.0", port=port)
