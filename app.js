const WS_URL = 'ws://10.108.0.8:8080';
const MAX_DATA_POINTS = 80;
const STALE_AFTER_MS = 15000;

const statusEl = document.getElementById('status');
const endpointEl = document.getElementById('endpoint');
const logEl = document.getElementById('log');
const messageCountEl = document.getElementById('messageCount');
const metricMessagesEl = document.getElementById('metricMessages');
const metricLevelsEl = document.getElementById('metricLevels');
const metricWeightsEl = document.getElementById('metricWeights');
const metricLastUpdateEl = document.getElementById('metricLastUpdate');
const clearBtn = document.getElementById('clearBtn');
const chartActionsEl = document.getElementById('chartActions');
const latestWeightSourceEl = document.getElementById('latestWeightSource');

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

const DISPENSE_BINS = [...REFILL_BINS];

const sensorData = {
    level: {},
    weight: {},
    mixer: {},
    refill: {},
    dispense: {}
};

const chartSeries = {};
let ws = null;
let reconnectTimer = null;
let reconnectAttempts = 0;
let messageCount = 0;
let levelChart = null;
let lastUpdateAt = null;
let selectedChartIps = new Set(LEVEL_BINS.slice(0, 6).map((bin) => bin.ip));

function createInitialReading() {
    return { value: null, updatedAt: null };
}

function initializeUI() {
    endpointEl.textContent = WS_URL;
    renderValueBins('levelBins', LEVEL_BINS, 'level', 'm');
    renderValueBins('weightBins', WEIGHT_BINS, 'weight', 'kg');
    renderStatusBins('refillBins', REFILL_BINS, 'refill');
    renderStatusBins('dispenseBins', DISPENSE_BINS, 'dispense');
    renderMixers();
    renderChartActions();
    initializeLevelChart();
    updateSummary();
    connectWebSocket();
    setInterval(refreshFreshness, 1000);
}

function renderValueBins(containerId, bins, type, unit) {
    const container = document.getElementById(containerId);
    bins.forEach((bin) => {
        sensorData[type][bin.ip] = createInitialReading();
        const binEl = document.createElement('article');
        binEl.className = 'bin-item waiting';
        binEl.id = `${type}-card-${bin.ip}`;
        binEl.innerHTML = `
            <div class="bin-row">
                <span class="bin-label">${bin.name}</span>
                <span class="freshness-dot"></span>
            </div>
            <div class="bin-value" id="${type}-${bin.ip}">-- ${unit}</div>
            <div class="bin-meta">
                <span class="bin-ip">${bin.ip}</span>
                <span id="${type}-age-${bin.ip}">waiting</span>
            </div>
        `;
        container.appendChild(binEl);
    });
}

function renderStatusBins(containerId, bins, type) {
    const container = document.getElementById(containerId);
    bins.forEach((bin) => {
        sensorData[type][bin.ip] = createInitialReading();
        const binEl = document.createElement('article');
        binEl.className = 'bin-item waiting';
        binEl.id = `${type}-card-${bin.ip}`;
        binEl.innerHTML = `
            <div class="bin-row">
                <span class="bin-label">${bin.name}</span>
                <span class="freshness-dot"></span>
            </div>
            <div class="status-chip muted" id="${type}-${bin.ip}">Waiting</div>
            <div class="bin-meta">
                <span class="bin-ip">${bin.ip}</span>
                <span id="${type}-age-${bin.ip}">waiting</span>
            </div>
        `;
        container.appendChild(binEl);
    });
}

function renderMixers() {
    const container = document.getElementById('mixerGrid');
    MIXERS.forEach((mixer) => {
        sensorData.mixer[mixer.ip] = createInitialReading();
        const deviceEl = document.createElement('article');
        deviceEl.className = 'device-item waiting';
        deviceEl.id = `mixer-card-${mixer.ip}`;
        deviceEl.innerHTML = `
            <div>
                <div class="device-name">${mixer.name}</div>
                <div class="device-ip">${mixer.ip}</div>
            </div>
            <div class="device-status muted" id="mixer-${mixer.ip}">Waiting</div>
            <div class="device-age" id="mixer-age-${mixer.ip}">waiting</div>
        `;
        container.appendChild(deviceEl);
    });
}

function renderChartActions() {
    LEVEL_BINS.forEach((bin) => {
        const button = document.createElement('button');
        button.type = 'button';
        button.className = selectedChartIps.has(bin.ip) ? 'chart-toggle active' : 'chart-toggle';
        button.textContent = bin.name.replace('Bin ', 'B');
        button.title = `${bin.name} - ${bin.ip}`;
        button.addEventListener('click', () => {
            if (selectedChartIps.has(bin.ip)) {
                selectedChartIps.delete(bin.ip);
            } else {
                selectedChartIps.add(bin.ip);
            }
            button.classList.toggle('active', selectedChartIps.has(bin.ip));
            applyChartVisibility();
        });
        chartActionsEl.appendChild(button);
    });
}

function initializeLevelChart() {
    const canvas = document.getElementById('levelChart');
    const ctx = canvas.getContext('2d');
    const colors = ['#36c2ff', '#66d38f', '#ffcc66', '#f7797d', '#a78bfa', '#45d6c0', '#f2a65a', '#8fd3f4', '#e879f9', '#f87171', '#94a3b8', '#22c55e'];

    const datasets = LEVEL_BINS.map((bin, index) => {
        chartSeries[bin.ip] = [];
        return {
            label: bin.name,
            ip: bin.ip,
            data: chartSeries[bin.ip],
            borderColor: colors[index],
            backgroundColor: colors[index] + '24',
            borderWidth: 2,
            tension: 0.35,
            fill: false,
            pointRadius: 0,
            pointHoverRadius: 5,
            hidden: !selectedChartIps.has(bin.ip)
        };
    });

    levelChart = new Chart(ctx, {
        type: 'line',
        data: { labels: [], datasets },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            interaction: { mode: 'nearest', intersect: false },
            plugins: {
                legend: {
                    position: 'bottom',
                    labels: { color: '#cbd5e1', boxWidth: 10, usePointStyle: true }
                },
                tooltip: {
                    callbacks: {
                        label: (context) => `${context.dataset.label}: ${Number(context.parsed.y).toFixed(2)} m`
                    }
                }
            },
            scales: {
                y: {
                    min: 0,
                    max: 2,
                    title: { display: true, text: 'Meters', color: '#94a3b8' },
                    ticks: { color: '#94a3b8' },
                    grid: { color: 'rgba(148, 163, 184, 0.14)' }
                },
                x: {
                    ticks: { color: '#94a3b8', maxTicksLimit: 8 },
                    grid: { color: 'rgba(148, 163, 184, 0.08)' }
                }
            },
            animation: false
        }
    });
}

function applyChartVisibility() {
    if (!levelChart) return;
    levelChart.data.datasets.forEach((dataset) => {
        dataset.hidden = !selectedChartIps.has(dataset.ip);
    });
    levelChart.update();
}

function connectWebSocket() {
    clearTimeout(reconnectTimer);
    setStatus('Connecting', 'connecting');
    ws = new WebSocket(WS_URL);

    ws.addEventListener('open', () => {
        reconnectAttempts = 0;
        setStatus('Connected', 'connected');
        appendLog('system', `Connected to ${WS_URL}`);
    });

    ws.addEventListener('message', handleMessage);

    ws.addEventListener('close', () => {
        setStatus('Disconnected', 'disconnected');
        scheduleReconnect();
    });

    ws.addEventListener('error', () => {
        setStatus('Connection error', 'error');
    });
}

function scheduleReconnect() {
    reconnectAttempts += 1;
    const delay = Math.min(30000, 1000 * 2 ** Math.min(reconnectAttempts, 5));
    appendLog('system', `Reconnecting in ${Math.round(delay / 1000)}s`);
    reconnectTimer = setTimeout(connectWebSocket, delay);
}

function handleMessage(event) {
    const raw = String(event.data);
    messageCount += 1;
    lastUpdateAt = new Date();
    appendLog('data', raw);
    parseIncomingMessage(raw);
    updateSummary();
}

function parseIncomingMessage(raw) {
    let parsed = null;
    try {
        parsed = JSON.parse(raw);
    } catch {
        parsed = null;
    }

    if (parsed && typeof parsed === 'object') {
        const srcIP = parsed.ip || parsed.srcIP || parsed.source || parsed.address;
        const payload = parsed.data ?? parsed.payload ?? parsed.message ?? parsed.value;
        const type = parsed.type || parsed.sensor || parsed.topic;
        if (srcIP && payload !== undefined) {
            routePayload(String(payload), srcIP, type);
            return;
        }
    }

    routePayload(raw, null, null);
}

function routePayload(payload, srcIP, type) {
    const normalizedType = String(type || '').toLowerCase();
    if (srcIP) {
        if (LEVEL_BINS.some((bin) => bin.ip === srcIP) || normalizedType.includes('level')) return parseLevelData(payload, srcIP);
        if (WEIGHT_BINS.some((bin) => bin.ip === srcIP) || normalizedType.includes('weight')) return parseWeightData(payload, srcIP);
        if (MIXERS.some((mixer) => mixer.ip === srcIP) || normalizedType.includes('mixer')) return parseStatusData(payload, srcIP, 'mixer');
        if (REFILL_BINS.some((bin) => bin.ip === srcIP) && normalizedType.includes('refill')) return parseStatusData(payload, srcIP, 'refill');
        if (DISPENSE_BINS.some((bin) => bin.ip === srcIP) && normalizedType.includes('dispense')) return parseStatusData(payload, srcIP, 'dispense');
        if (REFILL_BINS.some((bin) => bin.ip === srcIP)) return parseStatusData(payload, srcIP, 'refill');
    }

    if (payload.includes('D:')) return parseLevelData(payload, LEVEL_BINS[0].ip);
    if (/kg/i.test(payload)) return parseWeightData(payload, WEIGHT_BINS[0].ip);
    if (payload.includes('[')) return parseStatusData(payload, MIXERS[0].ip, 'mixer');
}

function parseLevelData(data, srcIP) {
    const match = data.match(/D:\s*([0-9.]+)/i) || data.match(/level["':\s]+([0-9.]+)/i);
    if (!match) return;
    const value = clamp(parseFloat(match[1]), 0, 2);
    sensorData.level[srcIP] = { value, updatedAt: new Date() };

    updateValueCard('level', srcIP, `${value.toFixed(2)} m`);
    pushLevelPoint(srcIP, value);
    updateSummary();
}

function parseWeightData(data, srcIP) {
    const match = data.match(/([0-9.]+)\s*kg/i) || data.match(/weight["':\s]+([0-9.]+)/i);
    if (!match) return;
    const value = parseFloat(match[1]);
    sensorData.weight[srcIP] = { value, updatedAt: new Date() };

    updateValueCard('weight', srcIP, `${value.toFixed(2)} kg`);
    document.querySelector('.weight-value').textContent = `${value.toFixed(2)} kg`;
    latestWeightSourceEl.textContent = `${srcIP} just updated`;
    updateSummary();
}

function parseStatusData(data, srcIP, type) {
    const statusArray = parseStatusArray(data);
    if (!statusArray) return;
    const state = getStatusState(statusArray);
    sensorData[type][srcIP] = { value: statusArray, updatedAt: new Date() };

    if (type === 'mixer') {
        const el = document.getElementById(`mixer-${srcIP}`);
        const card = document.getElementById(`mixer-card-${srcIP}`);
        if (el) {
            el.className = `device-status ${state}`;
            el.textContent = stateLabel(state);
        }
        if (card) card.className = `device-item ${state}`;
    } else {
        const el = document.getElementById(`${type}-${srcIP}`);
        const card = document.getElementById(`${type}-card-${srcIP}`);
        if (el) {
            el.className = `status-chip ${state}`;
            el.textContent = stateLabel(state);
        }
        if (card) card.className = `bin-item ${state}`;
    }
}

function parseStatusArray(data) {
    try {
        if (data.trim().startsWith('[')) return JSON.parse(data);
    } catch {
        return null;
    }
    const match = data.match(/\[([^\]]+)\]/);
    return match ? match[1].split(',').map((value) => Number(value.trim())) : null;
}

function pushLevelPoint(srcIP, value) {
    if (!levelChart) return;
    const time = new Date().toLocaleTimeString([], { hour12: false });
    levelChart.data.labels.push(time);

    levelChart.data.datasets.forEach((dataset) => {
        const reading = dataset.ip === srcIP ? value : sensorData.level[dataset.ip]?.value;
        dataset.data.push(reading === null || reading === undefined ? null : Number(reading));
    });

    while (levelChart.data.labels.length > MAX_DATA_POINTS) {
        levelChart.data.labels.shift();
        levelChart.data.datasets.forEach((dataset) => dataset.data.shift());
    }
    levelChart.update('none');
}

function updateValueCard(type, srcIP, text) {
    const valueEl = document.getElementById(`${type}-${srcIP}`);
    const card = document.getElementById(`${type}-card-${srcIP}`);
    if (valueEl) valueEl.textContent = text;
    if (card) {
        card.classList.remove('waiting', 'stale');
        card.classList.add('live');
    }
}

function getStatusState(statusArray) {
    if (!Array.isArray(statusArray) || statusArray.length < 4) return 'muted';
    if (Number(statusArray[2]) === 1) return 'ok';
    if (Number(statusArray[3]) === 1) return 'alert';
    return 'info';
}

function stateLabel(state) {
    return ({ ok: 'Running', alert: 'Alert', info: 'Idle', muted: 'Waiting' })[state] || 'Waiting';
}

function refreshFreshness() {
    refreshGroupFreshness('level');
    refreshGroupFreshness('weight');
    refreshGroupFreshness('refill');
    refreshGroupFreshness('dispense');
    refreshGroupFreshness('mixer');
    if (lastUpdateAt) {
        metricLastUpdateEl.textContent = formatAge(lastUpdateAt);
    }
}

function refreshGroupFreshness(type) {
    Object.entries(sensorData[type]).forEach(([ip, reading]) => {
        const ageEl = document.getElementById(`${type}-age-${ip}`);
        const card = document.getElementById(`${type}-card-${ip}`);
        if (!reading.updatedAt) return;
        const age = Date.now() - reading.updatedAt.getTime();
        if (ageEl) ageEl.textContent = formatAge(reading.updatedAt);
        if (card) card.classList.toggle('stale', age > STALE_AFTER_MS);
    });
}

function updateSummary() {
    const levelLive = countLive(sensorData.level);
    const weightLive = countLive(sensorData.weight);
    messageCountEl.textContent = `${messageCount} message${messageCount === 1 ? '' : 's'}`;
    metricMessagesEl.textContent = String(messageCount);
    metricLevelsEl.textContent = `${levelLive}/${LEVEL_BINS.length}`;
    metricWeightsEl.textContent = `${weightLive}/${WEIGHT_BINS.length}`;
    metricLastUpdateEl.textContent = lastUpdateAt ? formatAge(lastUpdateAt) : '--';
}

function countLive(group) {
    return Object.values(group).filter((reading) => reading.updatedAt).length;
}

function appendLog(kind, message) {
    const row = document.createElement('div');
    row.className = `log-row ${kind}`;
    row.innerHTML = `<span>${new Date().toLocaleTimeString()}</span><code></code>`;
    row.querySelector('code').textContent = message;
    logEl.appendChild(row);
    while (logEl.children.length > 250) logEl.firstChild.remove();
    logEl.scrollTop = logEl.scrollHeight;
}

function setStatus(text, className) {
    statusEl.textContent = text;
    statusEl.className = `status-badge ${className}`;
}

function formatAge(date) {
    const seconds = Math.max(0, Math.round((Date.now() - date.getTime()) / 1000));
    if (seconds < 2) return 'now';
    if (seconds < 60) return `${seconds}s ago`;
    return `${Math.floor(seconds / 60)}m ago`;
}

function clamp(value, min, max) {
    return Math.min(max, Math.max(min, value));
}

clearBtn.addEventListener('click', () => {
    logEl.textContent = '';
    messageCount = 0;
    updateSummary();
    if (levelChart) {
        levelChart.data.labels = [];
        levelChart.data.datasets.forEach((dataset) => {
            dataset.data = [];
        });
        levelChart.update();
    }
});

document.addEventListener('DOMContentLoaded', initializeUI);
