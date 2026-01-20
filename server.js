const express = require('express');
const app = express();
const PORT = process.env.PORT || 3000;

// Servir les fichiers statiques
app.use(express.static('public'));

// Routes API pour le pairing
app.use(express.json());

app.post('/api/pair', (req, res) => {
    const { code } = req.body;
    console.log(`Code reçu: ${code}`);
    // Ici, tu intègreras avec ton bot
    res.json({ success: true, message: 'Code reçu' });
});

// Toutes les autres routes vont à index.html
app.get('*', (req, res) => {
    res.sendFile(__dirname + '/public/index.html');
});

app.listen(PORT, () => {
    console.log(`✅ Site de pairing en ligne: http://localhost:${PORT}`);
    console.log(`📡 Mode: ${process.env.NODE_ENV || 'development'}`);
});
