// Replace this URL with your actual WebSocket URL
const wsUrl = 'ws://10.108.0.8:8080/ws'; // Example: ws://localhost:8080/ws

// Initialize the WebSocket connection
const socket = new WebSocket(wsUrl);

// DOM Elements
const statusEl = document.getElementById('status');
const messagesEl = document.getElementById('messages');
const messageCountEl = document.getElementById('messageCount');
const clearBtn = document.getElementById('clearBtn');
const chartCanvas = document.getElementById('dataChart');
const barChartCanvas = document.getElementById('barChart');
const chartValueEl = document.getElementById('chartValue');
const binGridEl = document.getElementById('binGrid');
const binStatusGridEl = document.getElementById('binStatusGrid');
const binStatusCountEl = document.getElementById('binStatusCount');
const vfdGridEl = document.getElementById('vfdGrid');
const dataGraphCountEl = document.getElementById('dataGraphCount');
const vfdGraphCountEl = document.getElementById('vfdGraphCount');
const noDataCountEl = document.getElementById('noDataCount');
const errorCountEl = document.getElementById('errorCount');
const chartCtx = chartCanvas.getContext('2d');
const barChartCtx = barChartCanvas.getContext('2d');
const tabBtns = document.querySelectorAll('.tab-btn');
const tabPanels = document.querySelectorAll('.tab-panel');

let messageCount = 0;
let noDataCount = 0;
let errorCount = 0;
const chartPoints = [];
const maxChartPoints = 50;
const dataSeries = new Map();
const binStatusItems = new Map();
const latestValues = new Map();
const vfdMaxCurrent = 4;

// ── Helper: format timestamp ──
function getTimestamp() {
    const now = new Date();
    const hh = String(now.getHours()).padStart(2, '0');
    const mm = String(now.getMinutes()).padStart(2, '0');
    const ss = String(now.getSeconds()).padStart(2, '0');
    return `${hh}:${mm}:${ss}`;
}

// ── Helper: set status badge style ──
function setStatus(text, className) {
    statusEl.textContent = text;
    statusEl.className = 'status-badge ' + className;
}

// ── Helper: update message count ──
function updateMessageCount() {
    messageCountEl.textContent = messageCount + ' message' + (messageCount !== 1 ? 's' : '');
}

function updateCounters() {
    noDataCountEl.textContent = noDataCount;
    errorCountEl.textContent = errorCount;
}

function isNoDataMessage(rawMessage) {
    return /no data/i.test(String(getMessagePayload(rawMessage)));
}

function setupTabs() {
    tabBtns.forEach((button) => {
        button.addEventListener('click', () => {
            const tab = button.dataset.tab;

            tabBtns.forEach((tabButton) => {
                tabButton.classList.toggle('active', tabButton === button);
            });

            tabPanels.forEach((panel) => {
                panel.classList.toggle('active', panel.id === `${tab}Panel`);
            });

            resizeChartCanvas();
            resizeBarChartCanvas();
            drawChart();
            drawBarChart();
            dataSeries.forEach(drawSeriesChart);
        });
    });
}

function parseJson(value) {
    if (typeof value !== 'string') {
        return value;
    }

    try {
        return JSON.parse(value);
    } catch (error) {
        return value;
    }
}

function getNumbersFromText(text) {
    const matches = String(text).match(/-?\d+(\.\d+)?/g);
    return matches ? matches.map(Number).filter(Number.isFinite) : [];
}

function getMessagePayload(rawMessage) {
    const message = parseJson(rawMessage);
    return message && typeof message === 'object' && 'data' in message ? message.data : message;
}

function sumValues(values) {
    return values.reduce((total, value) => total + value, 0);
}

function getVfdCurrentTotal(text) {
    const matches = [...String(text).matchAll(/(?:^|,)C:([-+]?\d+(?:\.\d+)?)/g)];

    if (matches.length === 0) {
        return null;
    }

    return sumValues(matches.map((match) => Number(match[1])).filter(Number.isFinite));
}

function getBinWeightPoint(text) {
    const match = String(text).match(/^\s*(\d+)\s*:\s*(.*?)\s*([-+]?\d+(?:\.\d+)?)\s*kg\s*$/i);

    if (!match) {
        return null;
    }

    const binNumber = Number(match[1]);
    const weight = Number(match[3]);

    if (!Number.isInteger(binNumber) || binNumber < 1 || !Number.isFinite(weight)) {
        return null;
    }

    const statusText = match[2]
        .split(',')
        .map((item) => item.trim())
        .filter(Boolean)
        .join(', ');

    return {
        key: `bin-${binNumber}-weight`,
        label: `Bin ${binNumber} Weight`,
        value: weight,
        type: 'bin-weight',
        unit: 'kg',
        metrics: {
            Bin: binNumber,
            Status: statusText || '--'
        }
    };
}

// Extract a bin-weight value for the Bins tab total graph.
function getNumericValue(rawMessage) {
    const payload = getMessagePayload(rawMessage);
    const parsedPayload = parseJson(payload);

    const payloadText = String(parsedPayload);

    if (/no data/i.test(payloadText)) {
        return null;
    }

    const binWeightPoint = getBinWeightPoint(payloadText);

    if (binWeightPoint) {
        return binWeightPoint.value;
    }

    return null;
}

function getVfdDataPoints(text) {
    const regex = /VFD:(\d+),F:([-+]?\d+(?:\.\d+)?),V:([-+]?\d+(?:\.\d+)?),C:([-+]?\d+(?:\.\d+)?),RS:([-+]?\d+(?:\.\d+)?),P:([-+]?\d+(?:\.\d+)?)/g;
    const points = [];
    let match;

    while ((match = regex.exec(String(text))) !== null) {
        const id = match[1];
        const frequency = Number(match[2]);
        const voltage = Number(match[3]);
        const current = Number(match[4]);
        const speed = Number(match[5]);
        const power = Number(match[6]);

        points.push({
            key: `vfd-${id}`,
            label: `VFD ${id}`,
            value: current,
            type: 'vfd',
            unit: 'A',
            metrics: {
                F: frequency,
                V: voltage,
                C: current,
                RS: speed,
                P: power
            }
        });
    }

    return points;
}

function getDataPoints(rawMessage) {
    const payload = getMessagePayload(rawMessage);
    const parsedPayload = parseJson(payload);
    const payloadText = String(parsedPayload);

    if (/no data/i.test(payloadText)) {
        return [];
    }

    const vfdPoints = getVfdDataPoints(payloadText);

    if (vfdPoints.length > 0) {
        return vfdPoints;
    }

    const binWeightPoint = getBinWeightPoint(payloadText);

    if (binWeightPoint) {
        return [binWeightPoint];
    }

    return [];
}

function getBinStatusPoints(rawMessage) {
    const payload = getMessagePayload(rawMessage);
    const parsedPayload = parseJson(payload);

    if (!Array.isArray(parsedPayload)) {
        return [];
    }

    return parsedPayload
        .map((value, index) => ({
            binNumber: index + 1,
            value: Number(value)
        }))
        .filter((point) => Number.isFinite(point.value));
}

function updateBinStatusCount() {
    const activeCount = [...binStatusItems.values()].filter((item) => item.value !== 0).length;
    binStatusCountEl.textContent = `${activeCount} active`;
}

function resizeChartCanvas() {
    const rect = chartCanvas.getBoundingClientRect();
    const scale = window.devicePixelRatio || 1;

    chartCanvas.width = Math.max(1, Math.floor(rect.width * scale));
    chartCanvas.height = Math.max(1, Math.floor(rect.height * scale));
    chartCtx.setTransform(scale, 0, 0, scale, 0, 0);
}

function resizeBarChartCanvas() {
    const rect = barChartCanvas.getBoundingClientRect();
    const scale = window.devicePixelRatio || 1;

    barChartCanvas.width = Math.max(1, Math.floor(rect.width * scale));
    barChartCanvas.height = Math.max(1, Math.floor(rect.height * scale));
    barChartCtx.setTransform(scale, 0, 0, scale, 0, 0);
}

function drawBarChart() {
    const width = barChartCanvas.clientWidth;
    const height = barChartCanvas.clientHeight;
    const padding = 34;
    const entries = [...latestValues.values()].filter((point) => point.type === 'bin-weight');

    barChartCtx.clearRect(0, 0, width, height);

    barChartCtx.strokeStyle = '#e1e7ef';
    barChartCtx.lineWidth = 1;
    barChartCtx.beginPath();
    barChartCtx.moveTo(padding, padding);
    barChartCtx.lineTo(padding, height - padding);
    barChartCtx.lineTo(width - padding, height - padding);
    barChartCtx.stroke();

    if (entries.length === 0) {
        barChartCtx.fillStyle = '#9aa4b2';
        barChartCtx.font = '14px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
        barChartCtx.textAlign = 'center';
        barChartCtx.fillText('Waiting for bin weight data...', width / 2, height / 2);
        return;
    }

    const max = Math.max(1, ...entries.map((point) => point.value));
    const barAreaWidth = width - padding * 2;
    const barWidth = Math.max(12, Math.min(52, barAreaWidth / entries.length - 12));
    const gap = entries.length > 1 ? (barAreaWidth - barWidth * entries.length) / (entries.length - 1) : 0;

    entries.forEach((point, index) => {
        const x = padding + index * (barWidth + gap);
        const barHeight = (point.value / max) * (height - padding * 2);
        const y = height - padding - barHeight;

        barChartCtx.fillStyle = '#2f80ed';
        barChartCtx.fillRect(x, y, barWidth, barHeight || 2);

        barChartCtx.fillStyle = '#1a1a2e';
        barChartCtx.font = '12px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
        barChartCtx.textAlign = 'center';
        barChartCtx.fillText(formatValue(point.value), x + barWidth / 2, y - 6);

        barChartCtx.fillStyle = '#6c757d';
        barChartCtx.fillText(point.label, x + barWidth / 2, height - 10);
    });
}

function drawChart() {
    const width = chartCanvas.clientWidth;
    const height = chartCanvas.clientHeight;
    const padding = 28;

    chartCtx.clearRect(0, 0, width, height);

    chartCtx.strokeStyle = '#e1e7ef';
    chartCtx.lineWidth = 1;
    chartCtx.beginPath();
    chartCtx.moveTo(padding, padding);
    chartCtx.lineTo(padding, height - padding);
    chartCtx.lineTo(width - padding, height - padding);
    chartCtx.stroke();

    if (chartPoints.length === 0) {
        chartCtx.fillStyle = '#9aa4b2';
        chartCtx.font = '14px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
        chartCtx.textAlign = 'center';
        chartCtx.fillText('Waiting for bin weight data...', width / 2, height / 2);
        return;
    }

    const values = chartPoints.map((point) => point.value);
    let min = Math.min(...values);
    let max = Math.max(...values);

    if (min === max) {
        min -= 1;
        max += 1;
    }

    const xStep = chartPoints.length > 1 ? (width - padding * 2) / (chartPoints.length - 1) : 0;

    chartCtx.fillStyle = '#6c757d';
    chartCtx.font = '12px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
    chartCtx.textAlign = 'right';
    chartCtx.fillText(max.toFixed(2), padding - 6, padding + 4);
    chartCtx.fillText(min.toFixed(2), padding - 6, height - padding + 4);

    chartCtx.strokeStyle = '#2f80ed';
    chartCtx.lineWidth = 2;
    chartCtx.beginPath();

    chartPoints.forEach((point, index) => {
        const x = padding + xStep * index;
        const y = height - padding - ((point.value - min) / (max - min)) * (height - padding * 2);

        if (index === 0) {
            chartCtx.moveTo(x, y);
        } else {
            chartCtx.lineTo(x, y);
        }
    });

    chartCtx.stroke();

    const lastPoint = chartPoints[chartPoints.length - 1];
    const lastX = padding + xStep * (chartPoints.length - 1);
    const lastY = height - padding - ((lastPoint.value - min) / (max - min)) * (height - padding * 2);

    chartCtx.fillStyle = '#2f80ed';
    chartCtx.beginPath();
    chartCtx.arc(lastX, lastY, 4, 0, Math.PI * 2);
    chartCtx.fill();
}

function addChartPoint(data) {
    const value = getNumericValue(data);

    if (value === null || !Number.isFinite(value)) {
        return;
    }

    chartPoints.push({
        time: getTimestamp(),
        value
    });

    if (chartPoints.length > maxChartPoints) {
        chartPoints.shift();
    }

    chartValueEl.textContent = value.toFixed(2);
    drawChart();
}

function formatValue(value, unit = '') {
    if (!Number.isFinite(value)) {
        return '--';
    }

    const formatted = Math.abs(value) >= 10 ? value.toFixed(1) : value.toFixed(2);
    return unit ? `${formatted} ${unit}` : formatted;
}

function createMetric(label, value) {
    const metricEl = document.createElement('div');
    metricEl.className = 'series-metric';

    const labelEl = document.createElement('span');
    labelEl.textContent = label;

    const valueEl = document.createElement('strong');
    valueEl.textContent = typeof value === 'number' ? formatValue(value) : String(value);

    metricEl.appendChild(labelEl);
    metricEl.appendChild(valueEl);
    return metricEl;
}

function updateGraphCounts() {
    const series = [...dataSeries.values()];
    const binCount = series.filter((item) => item.type === 'bin-weight').length;
    const vfdCount = series.filter((item) => item.type === 'vfd').length;

    dataGraphCountEl.textContent = `${binCount} active`;
    vfdGraphCountEl.textContent = `${vfdCount} active`;
}

function createSeries(point) {
    const cardEl = document.createElement('article');
    cardEl.className = `series-card ${point.type}`;

    const headerEl = document.createElement('div');
    headerEl.className = 'series-header';

    const titleEl = document.createElement('h3');
    titleEl.textContent = point.label;

    const statusEl = document.createElement('span');
    statusEl.className = 'series-status';
    statusEl.textContent = 'Live';

    headerEl.appendChild(titleEl);
    headerEl.appendChild(statusEl);

    const valueEl = document.createElement('div');
    valueEl.className = 'series-value';

    const gaugeEl = document.createElement('div');
    gaugeEl.className = 'series-gauge';

    const gaugeValueEl = document.createElement('span');
    gaugeValueEl.textContent = '0%';
    gaugeEl.appendChild(gaugeValueEl);

    const canvasEl = document.createElement('canvas');
    canvasEl.className = 'series-canvas';

    const metricsEl = document.createElement('div');
    metricsEl.className = 'series-metrics';

    cardEl.appendChild(headerEl);
    cardEl.appendChild(valueEl);
    if (point.type === 'vfd') {
        cardEl.appendChild(gaugeEl);
    }
    cardEl.appendChild(canvasEl);
    cardEl.appendChild(metricsEl);
    if (point.type === 'vfd') {
        vfdGridEl.appendChild(cardEl);
    } else {
        binGridEl.appendChild(cardEl);
    }

    const series = {
        key: point.key,
        label: point.label,
        type: point.type,
        unit: point.unit,
        points: [],
        cardEl,
        valueEl,
        gaugeEl,
        gaugeValueEl,
        canvasEl,
        metricsEl,
        ctx: canvasEl.getContext('2d')
    };

    dataSeries.set(point.key, series);
    updateGraphCounts();
    return series;
}

function resizeSeriesCanvas(series) {
    const rect = series.canvasEl.getBoundingClientRect();
    const scale = window.devicePixelRatio || 1;

    series.canvasEl.width = Math.max(1, Math.floor(rect.width * scale));
    series.canvasEl.height = Math.max(1, Math.floor(rect.height * scale));
    series.ctx.setTransform(scale, 0, 0, scale, 0, 0);
}

function drawSeriesChart(series) {
    const width = series.canvasEl.clientWidth;
    const height = series.canvasEl.clientHeight;
    const padding = 10;
    const ctx = series.ctx;

    resizeSeriesCanvas(series);
    ctx.clearRect(0, 0, width, height);

    ctx.strokeStyle = '#e1e7ef';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(padding, height - padding);
    ctx.lineTo(width - padding, height - padding);
    ctx.stroke();

    if (series.points.length === 0) {
        return;
    }

    const values = series.points.map((point) => point.value);
    let min = Math.min(...values);
    let max = Math.max(...values);

    if (min === max) {
        min -= 1;
        max += 1;
    }

    const xStep = series.points.length > 1 ? (width - padding * 2) / (series.points.length - 1) : 0;
    const accent = series.type === 'vfd' ? '#20c997' : '#2f80ed';

    ctx.strokeStyle = accent;
    ctx.lineWidth = 2;
    ctx.beginPath();

    series.points.forEach((point, index) => {
        const x = padding + xStep * index;
        const y = height - padding - ((point.value - min) / (max - min)) * (height - padding * 2);

        if (index === 0) {
            ctx.moveTo(x, y);
        } else {
            ctx.lineTo(x, y);
        }
    });

    ctx.stroke();

    const latest = series.points[series.points.length - 1];
    const latestX = padding + xStep * (series.points.length - 1);
    const latestY = height - padding - ((latest.value - min) / (max - min)) * (height - padding * 2);

    ctx.fillStyle = accent;
    ctx.beginPath();
    ctx.arc(latestX, latestY, 3, 0, Math.PI * 2);
    ctx.fill();
}

function updateSeriesMetrics(series, point) {
    series.metricsEl.innerHTML = '';

    if (point.type === 'vfd' && point.metrics) {
        series.metricsEl.appendChild(createMetric('F', point.metrics.F));
        series.metricsEl.appendChild(createMetric('V', point.metrics.V));
        series.metricsEl.appendChild(createMetric('RS', point.metrics.RS));
        series.metricsEl.appendChild(createMetric('P', point.metrics.P));
        return;
    }

    if (point.type === 'bin-weight' && point.metrics) {
        series.metricsEl.appendChild(createMetric('Bin', point.metrics.Bin));
        series.metricsEl.appendChild(createMetric('Status', point.metrics.Status));
        return;
    }

    series.metricsEl.appendChild(createMetric('Latest', point.value));
}

function addDataGraphs(rawMessage) {
    const points = getDataPoints(rawMessage);

    points.forEach((point) => {
        const series = dataSeries.get(point.key) || createSeries(point);

        series.unit = point.unit;
        latestValues.set(point.key, point);
        series.points.push({
            time: getTimestamp(),
            value: point.value
        });

        if (series.points.length > maxChartPoints) {
            series.points.shift();
        }

        series.valueEl.textContent = formatValue(point.value, point.unit);
        if (point.type === 'vfd') {
            const percentage = Math.max(0, Math.min(100, (point.value / vfdMaxCurrent) * 100));

            series.gaugeEl.style.setProperty('--gauge-value', `${percentage}%`);
            series.gaugeValueEl.textContent = `${percentage.toFixed(0)}%`;
        }
        updateSeriesMetrics(series, point);
        drawSeriesChart(series);
    });

    drawBarChart();
}

function createBinStatusItem(point) {
    const itemEl = document.createElement('article');
    itemEl.className = 'status-card';

    const titleEl = document.createElement('h3');
    titleEl.textContent = `Bin ${point.binNumber}`;

    const valueEl = document.createElement('strong');

    const labelEl = document.createElement('span');
    labelEl.textContent = 'Status';

    itemEl.appendChild(titleEl);
    itemEl.appendChild(valueEl);
    itemEl.appendChild(labelEl);
    binStatusGridEl.appendChild(itemEl);

    const item = {
        value: point.value,
        itemEl,
        valueEl
    };

    binStatusItems.set(point.binNumber, item);
    return item;
}

function updateBinStatus(rawMessage) {
    const points = getBinStatusPoints(rawMessage);

    if (points.length === 0) {
        return;
    }

    points.forEach((point) => {
        const item = binStatusItems.get(point.binNumber) || createBinStatusItem(point);

        item.value = point.value;
        item.valueEl.textContent = formatValue(point.value);
        item.itemEl.classList.toggle('active', point.value !== 0);
    });

    updateBinStatusCount();
}

// ── 1. Connection Opened ──
socket.addEventListener('open', (event) => {
    setStatus('Connected', 'connected');
    console.log('Connected to WebSocket server:', wsUrl);
});

// ── 2. Listen for Messages ──
socket.addEventListener('message', (event) => {
    console.log('Message from server:', event.data);

    // Increment counter
    messageCount++;
    if (isNoDataMessage(event.data)) {
        noDataCount++;
        updateCounters();
    }
    updateMessageCount();
    addChartPoint(event.data);
    addDataGraphs(event.data);
    updateBinStatus(event.data);

    // Create message element
    const messageDiv = document.createElement('div');
    messageDiv.className = 'message';

    const timestampSpan = document.createElement('span');
    timestampSpan.className = 'timestamp';
    timestampSpan.textContent = getTimestamp();

    const contentSpan = document.createElement('span');
    contentSpan.className = 'content';
    contentSpan.textContent = event.data;

    messageDiv.appendChild(timestampSpan);
    messageDiv.appendChild(contentSpan);

    messagesEl.appendChild(messageDiv);

    // Auto-scroll to bottom
    messagesEl.scrollTop = messagesEl.scrollHeight;
});

// ── 3. Listen for Errors ──
socket.addEventListener('error', (error) => {
    console.error('WebSocket Error observed:', error);
    errorCount++;
    updateCounters();
    setStatus('Error', 'error');
});

// ── 4. Connection Closed ──
socket.addEventListener('close', (event) => {
    setStatus('Disconnected', 'disconnected');
    console.log('WebSocket connection closed.');
});

// ── 5. Refresh Dashboard ──
clearBtn.addEventListener('click', () => {
    window.location.reload();
});

window.addEventListener('resize', () => {
    resizeChartCanvas();
    resizeBarChartCanvas();
    drawChart();
    drawBarChart();
    dataSeries.forEach(drawSeriesChart);
});

setupTabs();
resizeChartCanvas();
resizeBarChartCanvas();
drawChart();
drawBarChart();
updateCounters();
updateBinStatusCount();
