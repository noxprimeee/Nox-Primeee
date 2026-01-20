const socket = io();
let currentPairingCode = null;
let countdownInterval = null;

// Gestion des onglets
function showTab(tabName) {
    // Masquer tous les onglets
    document.querySelectorAll('.tab-content').forEach(tab => {
        tab.classList.remove('active');
    });
    document.querySelectorAll('.tab').forEach(tab => {
        tab.classList.remove('active');
    });
    
    // Afficher l'onglet sélectionné
    document.getElementById(`${tabName}-tab`).classList.add('active');
    document.querySelector(`.tab[onclick*="${tabName}"]`).classList.add('active');
}

// Générer un code de pairing
async function generatePairingCode(isPremium) {
    const userId = generateUserId();
    
    try {
        const response = await fetch('/api/generate-pairing-code', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                userId: userId,
                isPremium: isPremium
            })
        });
        
        const data = await response.json();
        
        if (data.success) {
            currentPairingCode = data.pairingCode;
            
            // Afficher la section de pairing
            document.getElementById('pairing-section').classList.remove('hidden');
            document.getElementById('connected-section').classList.add('hidden');
            
            // Afficher le code
            document.getElementById('pairing-code').textContent = currentPairingCode;
            
            // Démarrer le compte à rebours
            startCountdown(data.expiresIn);
            
            // S'abonner aux mises à jour WebSocket
            socket.emit('subscribe-to-code', currentPairingCode);
            
            // Vérifier périodiquement le statut
            startStatusPolling();
            
            // Afficher un QR code alternatif si besoin
            generateQRCode(currentPairingCode);
        } else {
            alert('Erreur: ' + data.message);
        }
    } catch (error) {
        console.error('Erreur:', error);
        alert('Erreur de connexion au serveur');
    }
}

// Générer un ID utilisateur unique
function generateUserId() {
    return 'USER-' + Math.random().toString(36).substring(2, 9).toUpperCase();
}

// Compte à rebours
function startCountdown(seconds) {
    let timeLeft = seconds;
    
    if (countdownInterval) clearInterval(countdownInterval);
    
    countdownInterval = setInterval(() => {
        const minutes = Math.floor(timeLeft / 60);
        const secs = timeLeft % 60;
        
        document.getElementById('countdown').textContent = 
            `${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
        
        if (timeLeft <= 0) {
            clearInterval(countdownInterval);
            document.getElementById('pairing-code').innerHTML = 
                '<span style="color:#ff3333">EXPIRÉ</span>';
        }
        
        timeLeft--;
    }, 1000);
}

// Polling pour vérifier le statut
function startStatusPolling() {
    const checkInterval = setInterval(async () => {
        if (!currentPairingCode) {
            clearInterval(checkInterval);
            return;
        }
        
        try {
            const response = await fetch(`/api/pairing-status/${currentPairingCode}`);
            const data = await response.json();
            
            if (data.status === 'paired') {
                // Appairage réussi !
                clearInterval(checkInterval);
                if (countdownInterval) clearInterval(countdownInterval);
                
                showSuccessScreen(data);
            } else if (data.status === 'expired') {
                clearInterval(checkInterval);
                document.getElementById('pairing-code').innerHTML = 
                    '<span style="color:#ff3333">CODE EXPIRÉ</span>';
            }
        } catch (error) {
            console.error('Erreur de polling:', error);
        }
    }, 2000); // Vérifier toutes les 2 secondes
}

// Afficher l'écran de succès
function showSuccessScreen(data) {
    document.getElementById('pairing-section').classList.add('hidden');
    document.getElementById('connected-section').classList.remove('hidden');
    
    if (data.userId) {
        document.getElementById('session-id').textContent = data.userId;
    }
    
    // Notifier le bot (si nécessaire)
    notifyBotPairingSuccess(currentPairingCode, data.userId);
}

// Générer un QR code alternatif
function generateQRCode(code) {
    // Utiliser une API ou bibliothèque pour générer un QR code
    // Exemple avec QRCode.js si tu l'ajoutes
    if (typeof QRCode !== 'undefined') {
        new QRCode(document.getElementById("qrcode"), {
            text: `PAIRING:${code}`,
            width: 128,
            height: 128,
            colorDark : "#000000",
            colorLight : "#ffffff",
            correctLevel : QRCode.CorrectLevel.H
        });
    }
}

// Écouter les événements WebSocket
socket.on('pairing-success', (data) => {
    if (data.code === currentPairingCode) {
        showSuccessScreen(data);
    }
});

// Fonctions utilitaires
function showQRAlternative() {
    alert('QR Code optionnel - À implémenter');
}

function goToDashboard() {
    window.location.href = '/dashboard'; // À créer si nécessaire
}

// Initialisation
document.addEventListener('DOMContentLoaded', () => {
    // Vérifier si l'utilisateur a déjà une session
    checkExistingSession();
});

function checkExistingSession() {
    const sessionId = localStorage.getItem('bot-session-id');
    if (sessionId) {
        // Vérifier si la session est toujours valide
        // À implémenter selon ton backend
    }
        }
