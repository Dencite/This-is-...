require('dotenv').config();
const express = require('express');
const cors = require('cors');
const axios = require('axios');

const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// Health check endpoint
app.get('/', (req, res) => {
  res.json({
    status: "API is working",
    message: "Clash Royale Ultimate Champion Deck Finder API",
    endpoints: {
      topPlayers: "/api/top-players [GET]",
      findDeck: "/api/find-deck [POST]"
    },
    note: "For POST requests, include Content-Type: application/json header"
  });
});

// Clash API configuration
const CLASH_API_URL = 'https://api.clashroyale.com/v1';
const API_TOKEN = process.env.CLASH_API_TOKEN;

const axiosInstance = axios.create({
  baseURL: CLASH_API_URL,
  headers: {
    'Authorization': `Bearer ${API_TOKEN}`,
    'Accept': 'application/json'
  }
});

// Top players endpoint
app.get('/api/top-players', async (req, res) => {
  try {
    const response = await axiosInstance.get('/locations/global/rankings/players');
    res.json(response.data.items.slice(0, 20));
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Find deck endpoint
app.post('/api/find-deck', async (req, res) => {
  try {
    const { medals } = req.body;
    if (!medals) return res.status(400).json({ error: "Medals parameter required" });
    
    const response = await axiosInstance.get('/locations/global/rankings/players');
    const players = response.data.items;
    const player = players.find(p => p.trophies === parseInt(medals)) || players[0];
    
    const battleLog = await axiosInstance.get(`/players/%23${player.tag.replace('#', '')}/battlelog`);
    const ucBattle = battleLog.data.find(b => b.gameMode?.id === 72000000);
    
    if (!ucBattle) return res.status(404).json({ error: "No Ultimate Champion battles found" });
    
    const playerDeck = ucBattle.team.find(t => t.tag === `#${player.tag.replace('#', '')}`)?.cards || [];
    res.json({ player, deck: playerDeck });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
