require('dotenv').config();
const express = require('express');
const app = express();

app.get('/', (req, res) => {
  res.json({ 
    status: "WORKING", 
    message: "Clash Royale Deck Finder API",
    endpoints: {
      findDeck: "POST /api/find-deck"
    }
  });
});

// Add your real endpoints here
app.post('/api/find-deck', (req, res) => {
  res.json({
    player: { name: "Test Player", trophies: 2500 },
    deck: [] // Add real deck data here
  });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log('Server ready'));
