// Replace this URL with your actual WebSocket URL
const wsUrl = 'ws://10.108.0.8:8080/ws'; // Example: ws://localhost:8080/ws

// Initialize the WebSocket connection
const socket = new WebSocket(wsUrl);

// DOM Elements
const statusEl = document.getElementById('status');
const messagesEl = document.getElementById('messages');
const messageCountEl = document.getElementById('messageCount');
const clearBtn = document.getElementById('clearBtn');

let messageCount = 0;

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
    updateMessageCount();

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
    setStatus('Error', 'error');
});

// ── 4. Connection Closed ──
socket.addEventListener('close', (event) => {
    setStatus('Disconnected', 'disconnected');
    console.log('WebSocket connection closed.');
});

// ── 5. Clear Messages ──
clearBtn.addEventListener('click', () => {
    messagesEl.innerHTML = '';
    messageCount = 0;
    updateMessageCount();
});