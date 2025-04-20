// Telegram Mini App SDK
const tg = window.Telegram.WebApp;
tg.expand();

// TON Connect SDK
const tonConnect = new TONConnect.SDK({
    manifestUrl: 'https://your-app-url/tonconnect-manifest.json', // Replace with your manifest URL
});

// Game State (Stored in localStorage)
let user = JSON.parse(localStorage.getItem('user')) || {
    wallet: null,
    shards: 50, // Welcome bonus
    energy: 100,
    maxEnergy: 100,
    energyRefillRate: 1, // Units per minute
    shardsPerTap: 0.1,
    friendsInvited: 0,
    adsWatched: 0,
    adBoosterCount: 0,
    score: 0,
    gameActive: false,
    speedBoost: false,
    doubleShards: false,
};

// Save user state to localStorage
function saveUserState() {
    localStorage.setItem('user', JSON.stringify(user));
}

// Game Canvas Setup
const canvas = document.getElementById('game-canvas');
const ctx = canvas.getContext('2d');
const player = { x: 50, y: 400, width: 30, height: 30, jumping: false, velocityY: 0 };
const obstacles = [];
const shards = [];
const boosters = [];
let lastObstacle = 0;
let lastShard = 0;
let lastBooster = 0;
let gameTime = 0;

// Load Sprites (Fallback to rectangles if sprites are unavailable)
const minerSprite = new Image();
minerSprite.src = 'assets/miner.png';
const bugSprite = new Image();
bugSprite.src = 'assets/bug.png';
const shardSprite = new Image();
shardSprite.src = 'assets/shard.png';
const boosterSprite = new Image();
boosterSprite.src = 'assets/booster.png';

// Show Screen Function
function showScreen(screenId) {
    document.querySelectorAll('.screen').forEach(screen => screen.style.display = 'none');
    document.getElementById(screenId).style.display = 'flex';
    document.querySelectorAll('.nav-bar button').forEach(btn => btn.classList.remove('active'));
    document.querySelector(`.nav-bar button[onclick="showScreen('${screenId}')"]`).classList.add('active');
    if (screenId === 'game-screen' && !user.gameActive) startGame();
}

// Onboarding and Wallet Connect
document.getElementById('connect-wallet').addEventListener('click', async () => {
    try {
        user.wallet = await tonConnect.connect();
        alert('Wallet connected!');
        saveUserState();
    } catch (error) {
        console.error('Wallet connection failed:', error);
    }
});

document.getElementById('double-bonus').addEventListener('click', () => {
    // Monetag Rewarded Interstitial Ad
    monetag.showRewardedInterstitial(() => {
        user.shards *= 2;
        document.getElementById('welcome-bonus').textContent = `${user.shards} CS`;
        user.adsWatched++;
        saveUserState();
    });
});

document.getElementById('start-game').addEventListener('click', () => showScreen('game-screen'));

// Game Logic
function startGame() {
    user.gameActive = true;
    setInterval(gameLoop, 1000 / 60); // 60 FPS
    setInterval(() => {
        if (!user.gameActive) return;
        gameTime++;
        if (gameTime % 120 === 0) { // Every 2 minutes
            user.gameActive = false;
            monetag.showInAppInterstitial(() => {
                user.gameActive = true;
            });
        }
    }, 1000);
    canvas.addEventListener('click', () => {
        if (!player.jumping && user.gameActive) {
            player.velocityY = -10;
            player.jumping = true;
        }
    });
}

function gameLoop() {
    if (!user.gameActive) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Player Movement
    player.velocityY += 0.5; // Gravity
    player.y += player.velocityY;
    if (player.y > 400) {
        player.y = 400;
        player.jumping = false;
    }
    if (minerSprite.complete) {
        ctx.drawImage(minerSprite, player.x, player.y, player.width, player.height);
    } else {
        ctx.fillStyle = '#00FF66';
        ctx.fillRect(player.x, player.y, player.width, player.height);
    }

    // Obstacles
    if (Math.random() < 0.02 && canvas.width - lastObstacle > 100) {
        obstacles.push({ x: canvas.width, y: 430, width: 10, height: 20 });
        lastObstacle = canvas.width;
    }
    obstacles.forEach((obstacle, i) => {
        obstacle.x -= user.speedBoost ? 4 : 2;
        if (bugSprite.complete) {
            ctx.drawImage(bugSprite, obstacle.x, obstacle.y, obstacle.width, obstacle.height);
        } else {
            ctx.fillStyle = 'red';
            ctx.fillRect(obstacle.x, obstacle.y, obstacle.width, obstacle.height);
        }
        if (obstacle.x < -obstacle.width) obstacles.splice(i, 1);
        if (collision(player, obstacle)) {
            user.gameActive = false;
            showScreen('game-over-screen');
            document.getElementById('final-score').textContent = user.score;
            document.getElementById('final-shards').textContent = user.shards;
        }
    });

    // Crypto Shards
    if (Math.random() < 0.01 && canvas.width - lastShard > 50) {
        shards.push({ x: canvas.width, y: 400 - Math.random() * 100, width: 10, height: 10 });
        lastShard = canvas.width;
    }
    shards.forEach((shard, i) => {
        shard.x -= user.speedBoost ? 4 : 2;
        if (shardSprite.complete) {
            ctx.drawImage(shardSprite, shard.x, shard.y, shard.width, shard.height);
        } else {
            ctx.fillStyle = '#C0C0C0';
            ctx.fillRect(shard.x, shard.y, shard.width, shard.height);
        }
        if (collision(player, shard)) {
            user.shards += user.doubleShards ? 2 : 1;
            user.score += user.doubleShards ? 2 : 1;
            shards.splice(i, 1);
            if (Math.random() < 0.3) { // 30% chance for Ad Booster
                boosters.push({ x: shard.x, y: shard.y, width: 10, height: 10 });
            }
        }
        if (shard.x < -shard.width) shards.splice(i, 1);
    });

    // Ad Boosters
    boosters.forEach((booster, i) => {
        booster.x -= user.speedBoost ? 4 : 2;
        if (boosterSprite.complete) {
            ctx.drawImage(boosterSprite, booster.x, booster.y, booster.width, booster.height);
        } else {
            ctx.fillStyle = '#00FF66';
            ctx.fillRect(booster.x, booster.y, booster.width, booster.height);
        }
        if (collision(player, booster)) {
            user.adBoosterCount++;
            updateAdBoosters();
            boosters.splice(i, 1);
        }
        if (booster.x < -booster.width) boosters.splice(i, 1);
    });

    // Update UI
    document.getElementById('score').textContent = `Score: ${user.score}`;
    document.getElementById('shards').textContent = `Crypto Shards: ${user.shards}`;
    saveUserState();
}

function collision(a, b) {
    return a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y;
}

function updateAdBoosters() {
    document.getElementById('boost-speed').style.display = user.adBoosterCount > 0 ? 'block' : 'none';
    document.getElementById('double-shards').style.display = user.adBoosterCount >= 3 ? 'block' : 'none';
}

document.getElementById('boost-speed').addEventListener('click', () => {
    monetag.showRewardedPopup(() => {
        user.speedBoost = true;
        user.shards += 10;
        user.adsWatched++;
        user.adBoosterCount--;
        updateAdBoosters();
        setTimeout(() => user.speedBoost = false, 30000); // 30 seconds
        saveUserState();
    });
});

document.getElementById('double-shards').addEventListener('click', () => {
    monetag.showRewardedInterstitial(() => {
        user.doubleShards = true;
        user.shards += 20;
        user.adsWatched++;
        user.adBoosterCount -= 3;
        updateAdBoosters();
        setTimeout(() => user.doubleShards = false, 60000); // 1 minute
        saveUserState();
    });
});

document.getElementById('restart-game').addEventListener('click', () => {
    user.score = 0;
    user.gameActive = false;
    obstacles.length = 0;
    shards.length = 0;
    boosters.length = 0;
    gameTime = 0;
    player.y = 400;
    player.jumping = false;
    player.velocityY = 0;
    showScreen('game-screen');
    saveUserState();
});

// Missions
const missions = [
    { id: 1, name: 'Run 500m in One Go', reward: 30, completed: false },
    { id: 2, name: 'Collect 100 Shards', reward: 20, completed: false },
    { id: 3, name: 'Invite a Friend', reward: 50, completed: false },
];

function renderMissions() {
    const list = document.getElementById('missions-list');
    list.innerHTML = '';
    missions.forEach(mission => {
        const div = document.createElement('div');
        div.innerHTML = `${mission.name} (+${mission.reward} CS) <button onclick="claimMission(${mission.id})">${mission.completed ? 'Claim (Ad)' : 'In Progress'}</button>`;
        list.appendChild(div);
    });
}

function claimMission(id) {
    const mission = missions.find(m => m.id === id);
    if (!mission.completed) return;
    monetag.showRewardedInterstitial(() => {
        user.shards += mission.reward;
        user.adsWatched++;
        mission.completed = false;
        renderMissions();
        saveUserState();
    });
}

document.addEventListener('DOMContentLoaded', () => {
    renderMissions();
    setInterval(() => {
        if (user.score >= 500) missions[0].completed = true;
        if (user.shards >= 100) missions[1].completed = true;
        renderMissions();
    }, 1000);
});

// Tap to Mine
document.getElementById('mining-rig').addEventListener('click', () => {
    if (user.energy > 0) {
        user.energy--;
        user.shards += user.shardsPerTap;
        document.getElementById('energy').textContent = `Energy: ${user.energy}/${user.maxEnergy}`;
        document.getElementById('mine-shards').textContent = `Crypto Shards: ${user.shards}`;
        saveUserState();
    }
});

document.getElementById('refill-energy').addEventListener('click', () => {
    monetag.showRewardedPopup(() => {
        user.energy = user.maxEnergy;
        user.adsWatched++;
        document.getElementById('energy').textContent = `Energy: ${user.energy}/${user.maxEnergy}`;
        saveUserState();
    });
});

document.getElementById('upgrade-energy').addEventListener('click', () => {
    if (user.shards >= 100) {
        user.shards -= 100;
        user.energyRefillRate += 1;
        document.getElementById('mine-shards').textContent = `Crypto Shards: ${user.shards}`;
        saveUserState();
    }
});

document.getElementById('upgrade-shards').addEventListener('click', () => {
    if (user.shards >= 150) {
        user.shards -= 150;
        user.shardsPerTap += 0.1;
        document.getElementById('mine-shards').textContent = `Crypto Shards: ${user.shards}`;
        saveUserState();
    }
});

setInterval(() => {
    if (user.energy < user.maxEnergy) {
        user.energy = Math.min(user.maxEnergy, user.energy + user.energyRefillRate / 60);
        document.getElementById('energy').textContent = `Energy: ${Math.floor(user.energy)}/${user.maxEnergy}`;
    }
}, 1000);

// Invite System
document.getElementById('generate-invite').addEventListener('click', () => {
    const link = `https://t.me/yourBot?start=${user.wallet}`; // Replace with your bot link
    tg.openTelegramLink(link);
    user.friendsInvited++; // Simulate friend invite (replace with backend logic if needed)
    document.getElementById('claim-invite-bonus').style.display = 'block';
    saveUserState();
});

document.getElementById('claim-invite-bonus').addEventListener('click', () => {
    monetag.showRewardedInterstitial(() => {
        user.shards += 50 * user.friendsInvited;
        user.adsWatched++;
        document.getElementById('invite-stats').textContent = `Friends Invited: ${user.friendsInvited} | CS Earned: ${user.shards}`;
        saveUserState();
    });
});

// Profile and Withdraw
document.getElementById('check-airdrop').addEventListener('click', () => {
    monetag.showRewardedPopup(() => {
        user.adsWatched++;
        document.getElementById('airdrop-status').textContent = `Airdrop: Watch ${10 - user.adsWatched} more ads to qualify!`;
        saveUserState();
    });
});

document.getElementById('withdraw-cs').addEventListener('click', async () => {
    monetag.showRewardedPopup(async () => {
        try {
            await tonConnect.sendTransaction({
                to: user.wallet,
                value: user.shards * 1e9, // Convert to TON nano units
                data: 'Withdraw CS',
            });
            user.shards = 0;
            user.adsWatched++;
            document.getElementById('cs-balance').textContent = `Crypto Shards: ${user.shards}`;
            saveUserState();
        } catch (error) {
            console.error('Withdrawal failed:', error);
        }
    });
});

setInterval(() => {
    document.getElementById('cs-balance').textContent = `Crypto Shards: ${user.shards}`;
    document.getElementById('airdrop-status').textContent = `Airdrop: Watch ${10 - user.adsWatched} more ads to qualify!`;
    document.getElementById('invite-stats').textContent = `Friends Invited: ${user.friendsInvited} | CS Earned: ${user.shards}`;
}, 1000);

// Mock Monetag SDK (Replace with actual Monetag SDK functions)
const monetag = {
    showInAppInterstitial: (callback) => {
        console.log('Showing In-App Interstitial Ad');
        setTimeout(callback, 2000); // Simulate ad display
    },
    showRewardedPopup: (callback) => {
        console.log('Showing Rewarded Popup Ad');
        setTimeout(callback, 2000); // Simulate ad display
    },
    showRewardedInterstitial: (callback) => {
        console.log('Showing Rewarded Interstitial Ad');
        setTimeout(callback, 2000); // Simulate ad display
    },
};

// Initialize the app
document.addEventListener('DOMContentLoaded', () => {
    showScreen('onboarding');
});
