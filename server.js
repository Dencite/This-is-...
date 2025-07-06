require('dotenv').config();
const express = require('express');
const cors = require('cors');
const axios = require('axios');
const rateLimit = require('express-rate-limit');

const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// Rate limiting (100 requests per 15 minutes)
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  message: {
    error: "Too many requests",
    message: "Please try again later"
  }
});
app.use(limiter);

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

// Health check endpoint
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

// Get top players
app.get('/api/top-players', async (req, res) => {
  try {
    const response = await axiosInstance.get('/locations/global/rankings/players');
    const players = response.data.items.slice(0, 20);
    
    const enhancedPlayers = await Promise.all(players.map(async (player) => {
      try {
        const playerData = await axiosInstance.get(`/players/%23${player.tag.replace('#', '')}`);
        return {
          name: player.name,
          tag: player.tag,
          trophies: player.trophies,
          rank: player.rank,
          clan: playerData.data.clan?.name || null,
          region: playerData.data.clan?.location?.name || 'Global'
        };
      } catch (error) {
        return {
          name: player.name,
          tag: player.tag,
          trophies: player.trophies,
          rank: player.rank,
          clan: null,
          region: 'Global'
        };
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

// Find deck by medal count
app.post('/api/find-deck', async (req, res) => {
  const { medals, region } = req.body;
  
  if (!medals || isNaN(medals)) {
    return res.status(400).json({ 
      error: 'Valid medal count is required',
      example: { "medals": 2500, "region": "global" }
    });
  }

  try {
    // Get leaderboard for the specified region
    const locationId = region === 'global' ? 'global' : await getLocationId(region);
    const leaderboard = await getLeaderboard(locationId);
    
    // Find closest player by medals
    const player = findClosestPlayer(leaderboard, parseInt(medals));
    if (!player) {
      return res.status(404).json({ 
        error: 'No player found with similar medal count',
        suggestion: 'Try a different medal count or region' 
      });
    }
    
    // Get player's battle log
    const battleLog = await getBattleLog(player.tag);
    const ucBattle = findUltimateChampionBattle(battleLog);
    
    if (!ucBattle) {
      return res.status(404).json({ 
        error: 'No Ultimate Champion battles found',
        suggestion: 'Player may not have recent Ultimate Champion matches' 
      });
    }
    
    // Extract the deck
    const deck = extractDeck(ucBattle, player.tag);
    
    res.json({
      success: true,
      player: {
        name: player.name,
        tag: player.tag,
        trophies: player.trophies,
        rank: player.rank,
        clan: player.clan?.name || null,
        region: player.clan?.location?.name || 'Global'
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

// Helper functions
async function getLocationId(regionName) {
  const regionMap = {
    'europe': 'Europe',
    'north-america': 'North America',
    'asia': 'Asia',
    'south-america': 'South America'
  };
  
  try {
    const response = await axiosInstance.get('/locations');
    const location = response.data.items.find(loc => 
      loc.name.toLowerCase() === regionMap[regionName]?.toLowerCase()
    );
    return location ? location.id : 'global';
  } catch (error) {
    console.error('Error fetching locations:', error.message);
    return 'global';
  }
}

async function getLeaderboard(locationId) {
  try {
    const response = await axiosInstance.get(`/locations/${locationId}/rankings/players`);
    return response.data.items;
  } catch (error) {
    console.error('Error fetching leaderboard:', error.message);
    return [];
  }
}

function findClosestPlayer(players, targetMedals) {
  let closestPlayer = null;
  let smallestDiff = Infinity;
  
  players.forEach(player => {
    const diff = Math.abs(player.trophies - targetMedals);
    if (diff < smallestDiff) {
      smallestDiff = diff;
      closestPlayer = player;
    }
  });
  
  return closestPlayer;
}

async function getBattleLog(playerTag) {
  try {
    const response = await axiosInstance.get(`/players/%23${playerTag.replace('#', '')}/battlelog`);
    return response.data;
  } catch (error) {
    console.error('Error fetching battle log:', error.message);
    return [];
  }
}

function findUltimateChampionBattle(battleLog) {
  return battleLog.find(battle => 
    battle.gameMode?.id === 72000000 && // Path of Legends
    battle.arena?.id === 54000000       // Ultimate Champion Arena
  );
}

function extractDeck(battle, playerTag) {
  const playerTeam = battle.team.find(t => t.tag === `#${playerTag.replace('#', '')}`);
  return playerTeam?.cards?.map(card => ({
    name: card.name,
    level: card.level,
    maxLevel: card.maxLevel,
    iconUrls: card.iconUrls
  })) || [];
}

// Start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
