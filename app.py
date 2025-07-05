from flask import Flask, request, jsonify, render_template
import requests
import os

app = Flask(__name__)

API_TOKEN = os.getenv("CR_API_TOKEN", "YOUR_API_TOKEN_HERE")
CLASH_API_URL = "https://api.clashroyale.com/v1"
HEADERS = {"Authorization": f"Bearer {API_TOKEN}"}

@app.route("/")
def index():
    return render_template("index.html")

@app.route("/get_deck", methods=["POST"])
def get_deck():
    medals = int(request.json.get("medals"))
    leaderboard_url = f"{CLASH_API_URL}/locations/global/pathOfLegends/season/ultimateChampionRankings"
    res = requests.get(leaderboard_url, headers=HEADERS)
    if res.status_code != 200:
        return jsonify({"error": "Failed to fetch leaderboard."}), 500

    players = res.json().get("items", [])
    tag = None
    for player in players:
        if player.get("rank") and player.get("trophies") == medals:
            tag = player.get("tag")
            break

    if not tag:
        return jsonify({"error": "Player with given UC medals not found."}), 404

    tag_encoded = tag.replace("#", "%23")
    battlelog_url = f"{CLASH_API_URL}/players/{tag_encoded}/battlelog"
    res = requests.get(battlelog_url, headers=HEADERS)
    if res.status_code != 200:
        return jsonify({"error": "Failed to fetch battlelog."}), 500

    battles = res.json()
    for battle in battles:
        if "cards" in battle.get("team", [{}])[0]:
            deck = battle["team"][0]["cards"]
            deck_data = [{
                "name": card.get("name"),
                "level": card.get("level"),
                "icon": card.get("iconUrls", {}).get("medium")
            } for card in deck]
            return jsonify({"deck": deck_data})

    return jsonify({"error": "No deck found."}), 404

if __name__ == "__main__":
    app.run()
