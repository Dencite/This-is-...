const express = require('express');
const app = express();

app.get('/', (req, res) => {
  res.send('API IS WORKING'); // Plain text response
});

app.listen(process.env.PORT || 3000, () => {
  console.log('Server ready');
});
