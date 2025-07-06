require('dotenv').config();
const express = require('express');
const cors = require('cors');
const axios = require('axios');
const rateLimit = require('express-rate-limit');

const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// Add this near your other routes (before app.listen)
app.get('/', (req, res) => {
  res.json({
    message: "Clash Royale Ultimate Champion Deck Finder API",
    endpoints: {
      topPlayers: "/api/top-players",
      findDeck: "/api/find-deck (POST)"
};

// Rate limiting (100 requests per 15 minutes)
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100
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

// Endpoint to get top players
app.get('/api/top-players', async (req, res) => {
  try {
    // Get global leaderboard
    const response = await axiosInstance.get('/locations/global/rankings/players');
    const players = response.data.items.slice(0, 20); // Get top 20 players
    
    // Enhance with region data
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
    res.status(500).json({ error: 'Failed to fetch top players' });
  }
});

// Endpoint to find deck by medal count
app.post('/api/find-deck', async (req, res) => {
  const { medals, region } = req.body;
  
  if (!medals) {
    return res.status(400).json({ error: 'Medal count is required' });
  }

  try {
    // 1. Get leaderboard for the specified region (or global)
    const locationId = region === 'global' ? 'global' : await getLocationId(region);
    const leaderboard = await getLeaderboard(locationId);
    
    // 2. Find player with closest medal count
    const player = findClosestPlayer(leaderboard, medals);
    if (!player) {
      return res.status(404).json({ error: 'No player found with similar medal count' });
    }
    
    // 3. Get player's battle log to find most recent Ultimate Champion battle
    const battleLog = await getBattleLog(player.tag);
    const ucBattle = findUltimateChampionBattle(battleLog);
    if (!ucBattle) {
      return res.status(404).json({ error: 'No Ultimate Champion battles found for this player' });
    }
    
    // 4. Extract the deck
    const deck = extractDeck(ucBattle, player.tag);
    
    res.json({
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
    res.status(500).json({ error: 'Failed to find deck' });
  }
});

// Helper functions
async function getLocationId(regionName) {
  const regions = {
    'europe': 'Europe',
    'north-america': 'North America',
    'asia': 'Asia',
    'south-america': 'South America'
  };
  
  const response = await axiosInstance.get('/locations');
  const location = response.data.items.find(loc => 
    loc.name.toLowerCase() === regions[regionName]?.toLowerCase()
  );
  
  return location ? location.id : 'global';
}

async function getLeaderboard(locationId) {
  const response = await axiosInstance.get(`/locations/${locationId}/rankings/players`);
  return response.data.items;
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
  const response = await axiosInstance.get(`/players/%23${playerTag.replace('#', '')}/battlelog`);
  return response.data;
}

function findUltimateChampionBattle(battleLog) {
  return battleLog.find(battle => 
    battle.gameMode?.id === 72000000 && // Path of Legends
    battle.arena?.id === 54000000       // Ultimate Champion Arena
  );
}

function extractDeck(battle, playerTag) {
  // Determine if player is in team or opponent team
  const playerTeam = battle.team.find(t => t.tag === `#${playerTag.replace('#', '')}`);
  return playerTeam?.cards || [];
}

// Start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
