// WebSocket Connection
const ws = new WebSocket("ws://10.108.0.8:8080");

// DOM Elements
const statusEl = document.getElementById('status');
const logEl = document.getElementById('log');
const messageCountEl = document.getElementById('messageCount');
const clearBtn = document.getElementById('clearBtn');

// Sensor Configuration
const LEVEL_BINS = [
    { name: 'Bin 1', ip: '10.108.7.112' },
    { name: 'Bin 2', ip: '10.108.7.114' },
    { name: 'Bin 3', ip: '10.108.7.115' },
    { name: 'Bin 4', ip: '10.108.7.116' },
    { name: 'Bin 5', ip: '10.108.7.133' },
    { name: 'Bin 6', ip: '10.108.7.118' },
    { name: 'Bin 7', ip: '10.108.7.102' },
    { name: 'Bin 8', ip: '10.108.7.120' },
    { name: 'Bin 9', ip: '10.108.7.121' },
    { name: 'Bin 10', ip: '10.108.7.56' },
    { name: 'Bin 11', ip: '10.108.7.79' },
    { name: 'Bin 12', ip: '10.108.7.122' }
];

const WEIGHT_BINS = [
    { name: 'Bin 1', ip: '10.108.7.75' },
    { name: 'Bin 2', ip: '10.108.7.76' },
    { name: 'Bin 3', ip: '10.108.7.80' },
    { name: 'Bin 4', ip: '10.108.7.165' },
    { name: 'Bin 5', ip: '10.108.7.82' },
    { name: 'Bin 6', ip: '10.108.7.83' },
    { name: 'Bin 7', ip: '10.108.7.91' },
    { name: 'Bin 8', ip: '10.108.7.94' },
    { name: 'Bin 9', ip: '10.108.7.90' },
    { name: 'Bin 10', ip: '10.108.7.169' },
    { name: 'Bin 11', ip: '10.108.7.170' },
    { name: 'Bin 12', ip: '10.108.7.171' }
];

const MIXERS = [
    { name: 'Mixer 1', ip: '10.108.7.160' },
    { name: 'Mixer 2', ip: '10.108.7.108' },
    { name: 'Mixer 3', ip: '10.108.7.33' },
    { name: 'Mixer 4', ip: '10.108.7.142' }
];

const REFILL_BINS = [
    { name: 'Bin 1', ip: '10.108.7.31' },
    { name: 'Bin 2', ip: '10.108.7.161' },
    { name: 'Bin 3', ip: '10.108.7.32' },
    { name: 'Bin 4', ip: '10.108.7.130' },
    { name: 'Bin 5', ip: '10.108.7.105' },
    { name: 'Bin 6', ip: '10.108.7.158' },
    { name: 'Bin 7', ip: '10.108.7.87' },
    { name: 'Bin 8', ip: '10.108.7.154' },
    { name: 'Bin 9', ip: '10.108.7.98' },
    { name: 'Bin 10', ip: '10.108.7.60' },
    { name: 'Bin 11', ip: '10.108.7.127' },
    { name: 'Bin 12', ip: '10.108.7.134' }
];

const DISPENSE_BINS = [
    { name: 'Bin 1', ip: '10.108.7.31' },
    { name: 'Bin 2', ip: '10.108.7.161' },
    { name: 'Bin 3', ip: '10.108.7.32' },
    { name: 'Bin 4', ip: '10.108.7.130' },
    { name: 'Bin 5', ip: '10.108.7.105' },
    { name: 'Bin 6', ip: '10.108.7.158' },
    { name: 'Bin 7', ip: '10.108.7.87' },
    { name: 'Bin 8', ip: '10.108.7.154' },
    { name: 'Bin 9', ip: '10.108.7.98' },
    { name: 'Bin 10', ip: '10.108.7.60' },
    { name: 'Bin 11', ip: '10.108.7.127' },
    { name: 'Bin 12', ip: '10.108.7.134' }
];

// Data Storage
let sensorData = {
    level: {},
    weight: {},
    mixer: {},
    refill: {},
    dispense: {}
};

let messageCount = 0;
let levelChart = null;
const maxDataPoints = 50;

// ── Initialize Bins in UI ──
function initializeUI() {
    // Initialize Level Bins
    const levelBinsContainer = document.getElementById('levelBins');
    LEVEL_BINS.forEach(bin => {
        const binEl = document.createElement('div');
        binEl.className = 'bin-item';
        binEl.innerHTML = `
            <div class="bin-label">${bin.name}</div>
            <div class="bin-value" id="level-${bin.ip}">-- m</div>
            <div class="bin-ip">${bin.ip}</div>
        `;
        levelBinsContainer.appendChild(binEl);
        sensorData.level[bin.ip] = null;
    });

    // Initialize Weight Bins
    const weightBinsContainer = document.getElementById('weightBins');
    WEIGHT_BINS.forEach(bin => {
        const binEl = document.createElement('div');
        binEl.className = 'bin-item';
        binEl.innerHTML = `
            <div class="bin-label">${bin.name}</div>
            <div class="bin-value" id="weight-${bin.ip}">-- kg</div>
            <div class="bin-ip">${bin.ip}</div>
        `;
        weightBinsContainer.appendChild(binEl);
        sensorData.weight[bin.ip] = null;
    });

    // Initialize Mixers
    const mixerContainer = document.getElementById('mixerGrid');
    MIXERS.forEach(mixer => {
        const deviceEl = document.createElement('div');
        deviceEl.className = 'device-item';
        deviceEl.innerHTML = `
            <div class="device-name">${mixer.name}</div>
            <div class="device-ip">${mixer.ip}</div>
            <div class="device-status" id="mixer-${mixer.ip}" style="background: #555;"></div>
        `;
        mixerContainer.appendChild(deviceEl);
        sensorData.mixer[mixer.ip] = null;
    });

    // Initialize Refill Bins
    const refillContainer = document.getElementById('refillBins');
    REFILL_BINS.forEach(bin => {
        const binEl = document.createElement('div');
        binEl.className = 'bin-item';
        binEl.innerHTML = `
            <div class="bin-label">${bin.name}</div>
            <div class="bin-indicator" id="refill-${bin.ip}" style="background: #555;"></div>
            <div class="bin-ip">${bin.ip}</div>
        `;
        refillContainer.appendChild(binEl);
        sensorData.refill[bin.ip] = null;
    });

    // Initialize Dispense Bins
    const dispenseContainer = document.getElementById('dispenseBins');
    DISPENSE_BINS.forEach(bin => {
        const binEl = document.createElement('div');
        binEl.className = 'bin-item';
        binEl.innerHTML = `
            <div class="bin-label">${bin.name}</div>
            <div class="bin-indicator" id="dispense-${bin.ip}" style="background: #555;"></div>
            <div class="bin-ip">${bin.ip}</div>
        `;
        dispenseContainer.appendChild(binEl);
        sensorData.dispense[bin.ip] = null;
    });
}

// ── Initialize Level Chart ──
function initializeLevelChart() {
    const canvas = document.getElementById('levelChart');
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    
    // Create dataset for each level sensor
    const datasets = LEVEL_BINS.slice(0, 3).map((bin, index) => {
        const colors = ['#667eea', '#764ba2', '#f093fb'];
        return {
            label: bin.name,
            data: [],
            borderColor: colors[index],
            backgroundColor: colors[index] + '22',
            borderWidth: 2,
            tension: 0.4,
            fill: true,
            pointRadius: 3,
            pointHoverRadius: 5,
            pointBackgroundColor: colors[index]
        };
    });

    levelChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: [],
            datasets: datasets
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    display: true,
                    labels: { 
                        padding: 15, 
                        font: { size: 11 },
                        color: '#999'
                    }
                }
            },
            scales: {
                y: {
                    min: 0,
                    max: 2,
                    ticks: {
                        color: '#999'
                    },
                    grid: {
                        color: '#3a3a52'
                    }
                },
                x: {
                    ticks: {
                        color: '#999'
                    },
                    grid: {
                        color: '#3a3a52'
                    }
                }
            },
            animation: {
                duration: 0
            }
        }
    });
}

// ── Update Level Chart ──
function updateLevelChart() {
    if (!levelChart) return;

    const now = new Date();
    const time = now.getHours().toString().padStart(2, '0') + ':' +
                 now.getMinutes().toString().padStart(2, '0') + ':' +
                 now.getSeconds().toString().padStart(2, '0');

    levelChart.data.labels.push(time);

    // Update first 3 bins in chart
    LEVEL_BINS.slice(0, 3).forEach((bin, index) => {
        const value = sensorData.level[bin.ip];
        levelChart.data.datasets[index].data.push(value !== null ? parseFloat(value) : null);
    });

    // Keep only last maxDataPoints
    if (levelChart.data.labels.length > maxDataPoints) {
        levelChart.data.labels.shift();
        levelChart.data.datasets.forEach(dataset => {
            dataset.data.shift();
        });
    }

    levelChart.update('none');
}

// ── Get Color for Status ──
function getStatusColor(statusArray) {
    if (!Array.isArray(statusArray) || statusArray.length < 4) {
        return 'blue';
    }

    const idx2 = statusArray[2];
    const idx3 = statusArray[3];

    if (idx2 === 1) return 'green';
    if (idx3 === 1) return 'red';
    return 'blue';
}

// ── Parse Level Data ──
function parseLevelData(data, srcIP) {
    const match = data.match(/D:([\d.]+)/);
    if (match) {
        const value = parseFloat(match[1]);
        sensorData.level[srcIP] = value;
        
        const el = document.getElementById(`level-${srcIP}`);
        if (el) el.textContent = value.toFixed(2) + ' m';
        
        updateLevelChart();
    }
}

// ── Parse Weight Data ──
function parseWeightData(data, srcIP) {
    const match = data.match(/([\d.]+)\s*kg/);
    if (match) {
        const value = parseFloat(match[1]);
        sensorData.weight[srcIP] = value;
        
        const el = document.getElementById(`weight-${srcIP}`);
        if (el) el.textContent = value.toFixed(2) + ' kg';

        // Update main weight display
        const latestWeight = sensorData.weight[srcIP];
        const weightDisplay = document.querySelector('.weight-value');
        if (weightDisplay) {
            weightDisplay.textContent = (latestWeight !== null ? latestWeight.toFixed(2) : '--') + ' kg';
        }
    }
}

// ── Parse Mixer Data ──
function parseMixerData(data, srcIP) {
    try {
        let statusArray;
        
        // Try to parse as JSON array
        if (data.trim().startsWith('[')) {
            statusArray = JSON.parse(data);
        } else {
            // Try to extract array-like pattern
            const match = data.match(/\[([^\]]+)\]/);
            if (match) {
                statusArray = match[1].split(',').map(v => parseInt(v.trim()));
            }
        }

        if (statusArray) {
            sensorData.mixer[srcIP] = statusArray;
            const color = getStatusColor(statusArray);
            const el = document.getElementById(`mixer-${srcIP}`);
            if (el) {
                el.className = 'device-status ' + color;
                el.style.background = color === 'green' ? '#4CAF50' : 
                                     color === 'red' ? '#f44336' : '#2196F3';
            }
        }
    } catch (e) {
        console.log('Could not parse mixer data:', e);
    }
}

// ── Parse Refill Data ──
function parseRefillData(data, srcIP) {
    try {
        let statusArray;
        
        if (data.trim().startsWith('[')) {
            statusArray = JSON.parse(data);
        } else {
            const match = data.match(/\[([^\]]+)\]/);
            if (match) {
                statusArray = match[1].split(',').map(v => parseInt(v.trim()));
            }
        }

        if (statusArray) {
            sensorData.refill[srcIP] = statusArray;
            const color = getStatusColor(statusArray);
            const el = document.getElementById(`refill-${srcIP}`);
            if (el) {
                el.className = 'bin-indicator ' + color;
                el.style.background = color === 'green' ? '#4CAF50' : 
                                     color === 'red' ? '#f44336' : '#2196F3';
                el.style.boxShadow = `0 0 10px rgba(${color === 'green' ? '76,175,80' : color === 'red' ? '244,67,54' : '33,150,243'}, 0.5)`;
            }
        }
    } catch (e) {
        console.log('Could not parse refill data:', e);
    }
}

// ── Parse Dispense Data ──
function parseDispenseData(data, srcIP) {
    try {
        let statusArray;
        
        if (data.trim().startsWith('[')) {
            statusArray = JSON.parse(data);
        } else {
            const match = data.match(/\[([^\]]+)\]/);
            if (match) {
                statusArray = match[1].split(',').map(v => parseInt(v.trim()));
            }
        }

        if (statusArray) {
            sensorData.dispense[srcIP] = statusArray;
            const color = getStatusColor(statusArray);
            const el = document.getElementById(`dispense-${srcIP}`);
            if (el) {
                el.className = 'bin-indicator ' + color;
                el.style.background = color === 'green' ? '#4CAF50' : 
                                     color === 'red' ? '#f44336' : '#2196F3';
                el.style.boxShadow = `0 0 10px rgba(${color === 'green' ? '76,175,80' : color === 'red' ? '244,67,54' : '33,150,243'}, 0.5)`;
            }
        }
    } catch (e) {
        console.log('Could not parse dispense data:', e);
    }
}

// ── Set Status ──
function setStatus(text, className) {
    statusEl.textContent = text;
    statusEl.className = 'status-badge ' + className;
}

// ── Update Message Count ──
function updateMessageCount() {
    messageCountEl.textContent = messageCount + ' message' + (messageCount !== 1 ? 's' : '');
}

// ── WebSocket Handlers ──
ws.onopen = () => {
    console.log("Connected to WebSocket server");
    setStatus('✓ Connected', 'connected');
    initializeLevelChart();
};

ws.onmessage = (event) => {
    const data = event.data;
    console.log("Received:", data);

    messageCount++;
    updateMessageCount();

    // Add to log
    logEl.textContent += new Date().toLocaleTimeString() + ' → ' + data + '\n';
    logEl.scrollTop = logEl.scrollHeight;

    // Try to identify source and parse data
    // Parse JSON data if available
    try {
        const parsed = JSON.parse(data);
        
        if (parsed.ip && parsed.data) {
            const srcIP = parsed.ip;
            const dataStr = parsed.data;

            // Determine sensor type and parse accordingly
            if (LEVEL_BINS.some(b => b.ip === srcIP)) {
                parseLevelData(dataStr, srcIP);
            } else if (WEIGHT_BINS.some(b => b.ip === srcIP)) {
                parseWeightData(dataStr, srcIP);
            } else if (MIXERS.some(m => m.ip === srcIP)) {
                parseMixerData(dataStr, srcIP);
            } else if (REFILL_BINS.some(b => b.ip === srcIP)) {
                parseRefillData(dataStr, srcIP);
            } else if (DISPENSE_BINS.some(b => b.ip === srcIP)) {
                parseDispenseData(dataStr, srcIP);
            }
        } else {
            // Try to parse data directly
            if (data.includes('D:')) {
                // Level sensor data - use first level bin
                const srcIP = LEVEL_BINS[0].ip;
                parseLevelData(data, srcIP);
            } else if (data.includes('kg')) {
                // Weight sensor data
                const srcIP = WEIGHT_BINS[0].ip;
                parseWeightData(data, srcIP);
            } else if (data.includes('[')) {
                // Status array - could be mixer, refill, or dispense
                const srcIP = MIXERS[0].ip;
                parseMixerData(data, srcIP);
            }
        }
    } catch (e) {
        // Try to parse raw data
        if (data.includes('D:')) {
            const srcIP = LEVEL_BINS[0].ip;
            parseLevelData(data, srcIP);
        } else if (data.includes('kg')) {
            const srcIP = WEIGHT_BINS[0].ip;
            parseWeightData(data, srcIP);
        }
    }
};

ws.onclose = () => {
    console.log("WebSocket closed");
    setStatus('✗ Disconnected', 'disconnected');
};

ws.onerror = (err) => {
    console.error("WebSocket error:", err);
    setStatus('✗ Error', 'error');
};

// ── Clear Button ──
clearBtn.addEventListener('click', () => {
    logEl.textContent = '';
    messageCount = 0;
    updateMessageCount();
    
    if (levelChart) {
        levelChart.data.labels = [];
        levelChart.data.datasets.forEach(dataset => {
            dataset.data = [];
        });
        levelChart.update();
    }
});

// ── Initialize on Load ──
document.addEventListener('DOMContentLoaded', () => {
    initializeUI();
});