require('dotenv').config();
const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const { v4: uuidv4 } = require('uuid');
const NodeCache = require('node-cache');
const fs = require('fs').promises;
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = socketIo(server);
const pairingCache = new NodeCache({ stdTTL: 300 }); // 5 minutes expiration

// Middleware
app.use(express.static('public'));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Routes
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.get('/premium', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'premium.html'));
});

// API pour générer un code de pairing
app.post('/api/generate-pairing-code', async (req, res) => {
    const { userId, isPremium = false } = req.body;
    
    if (!userId) {
        return res.status(400).json({ error: 'User ID requis' });
    }
    
    // Générer un code unique
    const pairingCode = Math.random().toString(36).substring(2, 8).toUpperCase();
    
    // Stocker dans le cache
    pairingCache.set(pairingCode, {
        userId,
        isPremium,
        status: 'pending',
        createdAt: Date.now()
    });
    
    console.log(`🔑 Code généré: ${pairingCode} pour ${userId} (Premium: ${isPremium})`);
    
    res.json({
        success: true,
        pairingCode,
        expiresIn: 300 // secondes
    });
});

// API pour vérifier un code
app.post('/api/verify-pairing-code', (req, res) => {
    const { pairingCode, deviceId } = req.body;
    
    if (!pairingCode || !deviceId) {
        return res.status(400).json({ error: 'Code et Device ID requis' });
    }
    
    const pairingData = pairingCache.get(pairingCode);
    
    if (!pairingData) {
        return res.json({
            success: false,
            message: 'Code invalide ou expiré'
        });
    }
    
    // Mettre à jour le statut
    pairingData.status = 'paired';
    pairingData.deviceId = deviceId;
    pairingData.pairedAt = Date.now();
    
    pairingCache.set(pairingCode, pairingData);
    
    // Notifier via WebSocket
    io.emit('pairing-success', {
        code: pairingCode,
        userId: pairingData.userId
    });
    
    res.json({
        success: true,
        message: 'Appairage réussi!',
        user: pairingData.userId,
        premium: pairingData.isPremium
    });
});

// API pour vérifier le statut
app.get('/api/pairing-status/:code', (req, res) => {
    const { code } = req.params;
    const data = pairingCache.get(code);
    
    if (!data) {
        return res.json({ status: 'expired' });
    }
    
    res.json({
        status: data.status,
        userId: data.userId,
        premium: data.isPremium,
        createdAt: data.createdAt
    });
});

// API pour les codes premium (exemple)
app.post('/api/validate-premium-code', async (req, res) => {
    const { premiumCode } = req.body;
    
    try {
        const premiumCodes = JSON.parse(await fs.readFile('premium-codes.json', 'utf8'));
        const codeData = premiumCodes.find(code => code.code === premiumCode && !code.used);
        
        if (codeData) {
            // Marquer comme utilisé
            codeData.used = true;
            codeData.usedAt = Date.now();
            await fs.writeFile('premium-codes.json', JSON.stringify(premiumCodes, null, 2));
            
            return res.json({
                success: true,
                message: 'Code premium validé!',
                duration: codeData.duration // jours
            });
        } else {
            return res.json({
                success: false,
                message: 'Code premium invalide ou déjà utilisé'
            });
        }
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Erreur serveur' });
    }
});

// WebSocket pour les mises à jour en temps réel
io.on('connection', (socket) => {
    console.log('👤 Nouvelle connexion WebSocket');
    
    socket.on('subscribe-to-code', (code) => {
        socket.join(`code-${code}`);
    });
    
    socket.on('disconnect', () => {
        console.log('👤 Déconnexion WebSocket');
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`🚀 Serveur de pairing démarré sur le port ${PORT}`);
    console.log(`🔗 Mode: ${process.env.NODE_ENV || 'development'}`);
});
