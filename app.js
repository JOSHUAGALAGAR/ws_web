const ws = new WebSocket("ws://10.108.0.8:8080");

// DOM Elements
const statusEl = document.getElementById('status');
const logEl = document.getElementById('log');
const messageCountEl = document.getElementById('messageCount');
const clearBtn = document.getElementById('clearBtn');
const chartCanvas = document.getElementById('dataChart');

let messageCount = 0;
let chart = null;
const maxDataPoints = 30;
const chartData = {
    labels: [],
    datasets: [
        {
            label: 'Data Stream',
            data: [],
            borderColor: '#667eea',
            backgroundColor: 'rgba(102, 126, 234, 0.1)',
            borderWidth: 2,
            tension: 0.4,
            fill: true,
            pointRadius: 4,
            pointHoverRadius: 6,
            pointBackgroundColor: '#667eea'
        }
    ]
};

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

// ── Helper: initialize chart ──
function initializeChart() {
    const ctx = chartCanvas.getContext('2d');
    chart = new Chart(ctx, {
        type: 'line',
        data: chartData,
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    display: true,
                    labels: { padding: 15, font: { size: 12 } }
                },
                title: {
                    display: true,
                    text: 'Real-time Data Visualization',
                    font: { size: 14, weight: 'bold' }
                }
            },
            scales: {
                y: {
                    beginAtZero: false
                }
            },
            animation: {
                duration: 0
            }
        }
    });
}

// ── Helper: extract numbers from message ──
function extractNumbers(str) {
    const numbers = str.match(/[-+]?\d*\.?\d+/g);
    return numbers ? numbers.map(Number) : [];
}

// ── Helper: update chart ──
function updateChart(value) {
    if (!chart) return;
    
    const now = new Date();
    const time = now.getHours().toString().padStart(2, '0') + ':' + 
                 now.getMinutes().toString().padStart(2, '0') + ':' + 
                 now.getSeconds().toString().padStart(2, '0');
    
    chartData.labels.push(time);
    chartData.datasets[0].data.push(value);
    
    if (chartData.labels.length > maxDataPoints) {
        chartData.labels.shift();
        chartData.datasets[0].data.shift();
    }
    
    chart.update('none');
}

// ── 1. Connection Opened ──
ws.onopen = () => {
    console.log("Connected to WebSocket server");
    setStatus('Connected', 'connected');
    if (!chart) {
        initializeChart();
    }
};

// ── 2. Listen for Messages ──
ws.onmessage = (event) => {
    console.log("Received:", event.data);

    // Increment counter
    messageCount++;
    updateMessageCount();

    // Append to log
    logEl.innerHTML += event.data + "<br>";
    logEl.scrollTop = logEl.scrollHeight;

    // Extract first number for chart
    const numbers = extractNumbers(event.data);
    if (numbers.length > 0) {
        updateChart(numbers[0]);
    }
    messageDiv.className = 'message';

    const timestampSpan = document.createElement('span');
    timestampSpan.className = 'timestamp';
    timestampSpan.textContent = getTimestamp();

    const contentSpan = document.createElement('span');
    contentSpan.className = 'content';
    contentSpan.textContent = event.data;

};

// ── 3. Connection Closed ──
ws.onclose = () => {
    console.log("WebSocket closed");
    setStatus('Disconnected', 'disconnected');
};

// ── 4. Listen for Errors ──
ws.onerror = (err) => {
    console.error("WebSocket error:", err);
    setStatus('Error', 'error');
};

// ── 5. Clear Messages and Chart ──
clearBtn.addEventListener('click', () => {
    logEl.innerHTML = '';
    messageCount = 0;
    updateMessageCount();
    
    // Reset chart
    chartData.labels = [];
    chartData.datasets[0].data = [];
    if (chart) {
        chart.update();
    }
});