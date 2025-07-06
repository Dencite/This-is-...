require('dotenv').config();
const express = require('express');
const cors = require('cors');
const axios = require('axios');
const rateLimit = require('express-rate-limit');

const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// Rate limiting (only apply once!)
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100
});
app.use(limiter); // <-- This should only appear once

// Clash Royale API configuration
const CLASH_API_URL = 'https://api.clashroyale.com/v1';
const API_TOKEN = process.env.CLASH_API_TOKEN;

if (!API_TOKEN) {
  console.error('Error: CLASH_API_TOKEN environment variable not set');
  process.exit(1);
}

const axiosInstance = axios.create({
  baseURL: CLASH_API_URL,
  headers: {
    'Authorization': `Bearer ${API_TOKEN}`,
    'Accept': 'application/json'
  }
});

// Root route - Improved response
app.get('/', (req, res) => {
  res.json({
    status: "API is working",
    message: "Clash Royale Ultimate Champion Deck Finder API",
    endpoints: {
      topPlayers: {
        path: "/api/top-players",
        method: "GET",
        description: "Get top 20 players"
      },
      findDeck: {
        path: "/api/find-deck",
        method: "POST",
        description: "Find deck by medal count",
        parameters: {
          medals: "Number (required)",
          region: "String (optional)"
        }
      }
    },
    note: "For POST requests, include Content-Type: application/json header"
  });
});

// Endpoint to get top players
app.get('/api/top-players', async (req, res) => {
  try {
    const response = await axiosInstance.get('/locations/global/rankings/players');
    const players = response.data.items.slice(0, 20);
    
    const enhancedPlayers = await Promise.all(players.map(async (player) => {
      try {
        const playerData = await axiosInstance.get(`/players/%23${player.tag.replace('#', '')}`);
        return {
          ...player,
          region: playerData.data.clan?.location?.name || 'Global'
        };
      } catch {
        return player;
      }
    }));
    
    res.json(enhancedPlayers);
  } catch (error) {
    console.error('Error fetching top players:', error.message);
    res.status(500).json({ 
      error: 'Failed to fetch top players',
      details: error.response?.data?.message || error.message 
    });
  }
});

// Endpoint to find deck by medal count
app.post('/api/find-deck', async (req, res) => {
  const { medals, region } = req.body;
  
  if (!medals) {
    return res.status(400).json({ 
      error: 'Medal count is required',
      example: { "medals": 2500, "region": "global" }
    });
  }

  try {
    const locationId = region === 'global' ? 'global' : await getLocationId(region);
    const leaderboard = await getLeaderboard(locationId);
    const player = findClosestPlayer(leaderboard, medals);
    
    if (!player) {
      return res.status(404).json({ 
        error: 'No player found with similar medal count',
        suggestion: 'Try a different medal count or region' 
      });
    }
    
    const battleLog = await getBattleLog(player.tag);
    const ucBattle = findUltimateChampionBattle(battleLog);
    
    if (!ucBattle) {
      return res.status(404).json({ 
        error: 'No Ultimate Champion battles found',
        suggestion: 'Player may not have recent Ultimate Champion matches' 
      });
    }
    
    const deck = extractDeck(ucBattle, player.tag);
    
    res.json({
      success: true,
      player: {
        name: player.name,
        tag: player.tag,
        trophies: player.trophies,
        rank: player.rank,
        region: player.location?.name || 'Global'
      },
      deck: deck
    });
  } catch (error) {
    console.error('Error:', error.message);
    res.status(500).json({ 
      error: 'Failed to find deck',
      details: error.response?.data?.message || error.message 
    });
  }
});

// Helper functions (keep the same as before)
async function getLocationId(regionName) {
  // ... (existing implementation)
}

async function getLeaderboard(locationId) {
  // ... (existing implementation)
}

function findClosestPlayer(players, targetMedals) {
  // ... (existing implementation)
}

async function getBattleLog(playerTag) {
  // ... (existing implementation)
}

function findUltimateChampionBattle(battleLog) {
  // ... (existing implementation)
}

function extractDeck(battle, playerTag) {
  // ... (existing implementation)
}

// Start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
