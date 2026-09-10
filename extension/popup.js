const API_BASE_URL = "https://uniquepass.onrender.com";

const dom = {
    authScreen: document.getElementById('auth-screen'),
    mainScreen: document.getElementById('main-screen'),
    tabLogin: document.getElementById('tab-login'),
    tabRegister: document.getElementById('tab-register'),
    loginForm: document.getElementById('login-form'),
    registerForm: document.getElementById('register-form'),
    authError: document.getElementById('auth-error'),
    
    navGen: document.getElementById('nav-generator'),
    navProfile: document.getElementById('nav-profile'),
    viewGen: document.getElementById('view-generator'),
    viewProfile: document.getElementById('view-profile'),
    
    statusAuth: document.getElementById('backend-status-dot-auth'),
    statusTextAuth: document.getElementById('backend-status-text-auth'),
    statusMain: document.getElementById('backend-status-dot'),
    statusTextMain: document.getElementById('backend-status-text'),
    
    passwordDisplay: document.getElementById('password-display'),
    toggleVisBtn: document.getElementById('toggle-visibility'),
    copyBtn: document.getElementById('copy-btn'),
    strengthFill: document.getElementById('strength-fill'),
    strengthText: document.getElementById('strength-text'),
    aiIndicator: document.getElementById('ai-indicator'),
    
    lengthSlider: document.getElementById('length-slider'),
    lengthInput: document.getElementById('length-input'),
    optUpper: document.getElementById('opt-uppercase'),
    optLower: document.getElementById('opt-lowercase'),
    optNumbers: document.getElementById('opt-numbers'),
    optSymbols: document.getElementById('opt-symbols'),
    symbolSet: document.getElementById('symbol-set'),
    optRequireAll: document.getElementById('opt-require-all'),
    optClearClip: document.getElementById('opt-clear-clipboard'),
    generateBtn: document.getElementById('generate-btn'),
    
    profileName: document.getElementById('profile-name'),
    profileEmail: document.getElementById('profile-email'),
    profileId: document.getElementById('profile-id'),
    profilePremium: document.getElementById('profile-premium'),
    logoutBtn: document.getElementById('logout-btn'),
    notification: document.getElementById('notification'),
};

let backendOnline = false;
let authToken = null;
let clearClipboardTimeout = null;

document.addEventListener('DOMContentLoaded', async () => {
    setupUIEvents();
    loadSettings();
    await checkBackendHealth();
    
    // Check Auth State
    chrome.storage.local.get(['token'], async (res) => {
        if (res.token) {
            authToken = res.token;
            const user = await fetchProfile();
            if (user) {
                showMainScreen();
                populateProfile(user);
                if (backendOnline) generatePassword();
            } else {
                logout();
            }
        } else {
            showAuthScreen();
        }
    });
});

function setupUIEvents() {
    // Auth Tabs
    dom.tabLogin.addEventListener('click', () => switchAuthTab('login'));
    dom.tabRegister.addEventListener('click', () => switchAuthTab('register'));
    
    // Main Nav Tabs
    dom.navGen.addEventListener('click', () => switchMainTab('generator'));
    dom.navProfile.addEventListener('click', () => switchMainTab('profile'));

    // Auth Forms
    dom.loginForm.addEventListener('submit', handleLogin);
    dom.registerForm.addEventListener('submit', handleRegister);
    dom.logoutBtn.addEventListener('click', logout);

    // Generator Controls
    dom.lengthSlider.addEventListener('input', (e) => { dom.lengthInput.value = e.target.value; saveSettings(); });
    dom.lengthInput.addEventListener('input', (e) => {
        let val = parseInt(e.target.value);
        if (val >= 8 && val <= 64) { dom.lengthSlider.value = val; saveSettings(); }
    });
    const inputs = [dom.optUpper, dom.optLower, dom.optNumbers, dom.optSymbols, dom.symbolSet, dom.optRequireAll, dom.optClearClip];
    inputs.forEach(input => input.addEventListener('change', saveSettings));

    dom.generateBtn.addEventListener('click', generatePassword);
    dom.toggleVisBtn.addEventListener('click', toggleVisibility);
    dom.copyBtn.addEventListener('click', copyToClipboard);
}

function switchAuthTab(tab) {
    dom.authError.classList.add('hidden');
    if (tab === 'login') {
        dom.tabLogin.classList.add('active'); dom.tabRegister.classList.remove('active');
        dom.loginForm.classList.add('active'); dom.registerForm.classList.remove('active');
    } else {
        dom.tabRegister.classList.add('active'); dom.tabLogin.classList.remove('active');
        dom.registerForm.classList.add('active'); dom.loginForm.classList.remove('active');
    }
}

function switchMainTab(tab) {
    if (tab === 'generator') {
        dom.navGen.classList.add('active'); dom.navProfile.classList.remove('active');
        dom.viewGen.classList.add('active'); dom.viewProfile.classList.remove('active');
    } else {
        dom.navProfile.classList.add('active'); dom.navGen.classList.remove('active');
        dom.viewProfile.classList.add('active'); dom.viewGen.classList.remove('active');
    }
}

function showAuthScreen() {
    dom.authScreen.classList.remove('hidden');
    dom.mainScreen.classList.add('hidden');
}

function showMainScreen() {
    dom.mainScreen.classList.remove('hidden');
    dom.authScreen.classList.add('hidden');
}

// --- API Auth Logic ---
async function handleLogin(e) {
    e.preventDefault();
    dom.authError.classList.add('hidden');
    const email = document.getElementById('login-email').value;
    const password = document.getElementById('login-password').value;

    try {
        const res = await fetch(`${API_BASE_URL}/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password })
        });
        const data = await res.json();
        if (res.ok) {
            authToken = data.access_token;
            chrome.storage.local.set({ token: authToken });
            const user = await fetchProfile();
            populateProfile(user);
            showMainScreen();
            generatePassword();
        } else {
            showAuthError(data.detail || "Login failed");
        }
    } catch (e) {
        showAuthError("Network error. Backend offline.");
    }
}

async function handleRegister(e) {
    e.preventDefault();
    dom.authError.classList.add('hidden');
    const name = document.getElementById('register-name').value;
    const email = document.getElementById('register-email').value;
    const password = document.getElementById('register-password').value;

    try {
        const res = await fetch(`${API_BASE_URL}/register`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name, email, password })
        });
        const data = await res.json();
        if (res.ok) {
            // Auto login after register
            document.getElementById('login-email').value = email;
            document.getElementById('login-password').value = password;
            handleLogin(new Event('submit'));
        } else {
            showAuthError(data.detail || "Registration failed");
        }
    } catch (e) {
        showAuthError("Network error. Backend offline.");
    }
}

function showAuthError(msg) {
    dom.authError.textContent = msg;
    dom.authError.classList.remove('hidden');
}

function logout() {
    authToken = null;
    chrome.storage.local.remove(['token']);
    showAuthScreen();
}

async function fetchProfile() {
    try {
        const res = await fetch(`${API_BASE_URL}/users/me`, {
            headers: { 'Authorization': `Bearer ${authToken}` }
        });
        if (res.ok) return await res.json();
        return null;
    } catch (e) { return null; }
}

function populateProfile(user) {
    dom.profileName.textContent = user.name;
    dom.profileEmail.textContent = user.email;
    dom.profileId.textContent = user.id;
    if (user.is_premium) {
        dom.profilePremium.textContent = "Premium";
        dom.profilePremium.className = "value badge premium";
    } else {
        dom.profilePremium.textContent = "Standard";
        dom.profilePremium.className = "value badge";
    }
}

// --- Generator Logic ---
async function generatePassword() {
    if (!backendOnline) {
        await checkBackendHealth();
        if (!backendOnline) {
            showGenError("Backend is offline");
            return;
        }
    }

    dom.generateBtn.disabled = true;
    dom.generateBtn.textContent = "Generating...";
    dom.passwordDisplay.value = "Generating...";
    dom.aiIndicator.classList.add('hidden');
    
    const payload = {
        length: parseInt(dom.lengthInput.value),
        uppercase: dom.optUpper.checked,
        lowercase: dom.optLower.checked,
        numbers: dom.optNumbers.checked,
        symbols: dom.optSymbols.checked,
        symbol_set: dom.symbolSet.value,
        require_each_category: dom.optRequireAll.checked
    };

    try {
        const response = await fetch(`${API_BASE_URL}/generate`, {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${authToken}`
            },
            body: JSON.stringify(payload)
        });

        if (response.status === 401) {
            logout();
            return;
        }

        const data = await response.json();

        if (response.ok) {
            dom.passwordDisplay.value = data.password;
            if(dom.passwordDisplay.type === "password") dom.passwordDisplay.type = "text";
            updateStrengthUI(data.strength);
            if (data.source === "ai") {
                dom.aiIndicator.classList.remove('hidden');
            }
        } else {
            showGenError(data.detail || "Error generating password");
        }
    } catch (error) {
        showGenError("Network error");
        setBackendStatus(false);
    } finally {
        dom.generateBtn.disabled = false;
        dom.generateBtn.textContent = "Generate Secure Password";
    }
}

// --- Utilities (Health, Settings, UI) ---
async function checkBackendHealth() {
    try {
        const res = await fetch(`${API_BASE_URL}/health`, { method: 'GET', signal: AbortSignal.timeout(2000) });
        setBackendStatus(res.ok);
    } catch (e) {
        setBackendStatus(false);
    }
}

function setBackendStatus(isOnline) {
    backendOnline = isOnline;
    const cls = isOnline ? 'dot online' : 'dot offline';
    const txt = isOnline ? 'Online' : 'Offline';
    dom.statusAuth.className = cls; dom.statusTextAuth.textContent = txt;
    dom.statusMain.className = cls; dom.statusTextMain.textContent = txt;
    if (dom.generateBtn) dom.generateBtn.disabled = !isOnline;
}

function saveSettings() {
    const settings = {
        length: dom.lengthInput.value,
        upper: dom.optUpper.checked,
        lower: dom.optLower.checked,
        numbers: dom.optNumbers.checked,
        symbols: dom.optSymbols.checked,
        symbolSet: dom.symbolSet.value,
        requireAll: dom.optRequireAll.checked,
        clearClip: dom.optClearClip.checked
    };
    chrome.storage.local.set({ settings });
}

function loadSettings() {
    chrome.storage.local.get(['settings'], (result) => {
        if (result.settings) {
            const s = result.settings;
            dom.lengthSlider.value = s.length; dom.lengthInput.value = s.length;
            dom.optUpper.checked = s.upper; dom.optLower.checked = s.lower;
            dom.optNumbers.checked = s.numbers; dom.optSymbols.checked = s.symbols;
            dom.symbolSet.value = s.symbolSet; dom.optRequireAll.checked = s.requireAll;
            dom.optClearClip.checked = s.clearClip;
        }
    });
}

function updateStrengthUI(strength) {
    dom.strengthText.textContent = strength;
    let color = "var(--danger)"; let width = "25%";
    switch(strength) {
        case "Weak": color = "var(--danger)"; width = "25%"; break;
        case "Moderate": color = "var(--warning)"; width = "50%"; break;
        case "Strong": color = "var(--success)"; width = "75%"; break;
        case "Very Strong": color = "var(--success)"; width = "100%"; break;
    }
    dom.strengthFill.style.width = width; dom.strengthFill.style.backgroundColor = color;
}

function toggleVisibility() {
    dom.passwordDisplay.type = dom.passwordDisplay.type === "password" ? "text" : "password";
}

function copyToClipboard() {
    const pwd = dom.passwordDisplay.value;
    if (!pwd || pwd === "Generating..." || pwd.includes("Error") || pwd.includes("Offline")) return;

    navigator.clipboard.writeText(pwd).then(() => {
        dom.notification.classList.remove('hidden');
        setTimeout(() => dom.notification.classList.add('hidden'), 2000);
        if (dom.optClearClip.checked) {
            if (clearClipboardTimeout) clearTimeout(clearClipboardTimeout);
            clearClipboardTimeout = setTimeout(() => navigator.clipboard.writeText(""), 10000);
        }
    });
}

function showGenError(msg) {
    dom.passwordDisplay.value = `Error: ${msg}`;
    dom.passwordDisplay.type = "text";
    dom.strengthText.textContent = "";
    dom.strengthFill.style.width = "0%";
}
