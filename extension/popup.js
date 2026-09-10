const API_BASE_URL = "https://uniquepass.onrender.com";

// ── DOM REFERENCES ──
const dom = {
    authScreen:             document.getElementById('auth-screen'),
    mainScreen:             document.getElementById('main-screen'),
    tabLogin:               document.getElementById('tab-login'),
    tabRegister:            document.getElementById('tab-register'),
    loginForm:              document.getElementById('login-form'),
    registerForm:           document.getElementById('register-form'),
    authError:              document.getElementById('auth-error'),

    navGen:                 document.getElementById('nav-generator'),
    navProfile:             document.getElementById('nav-profile'),
    viewGen:                document.getElementById('view-generator'),
    viewProfile:            document.getElementById('view-profile'),

    statusAuth:             document.getElementById('backend-status-dot-auth'),
    statusTextAuth:         document.getElementById('backend-status-text-auth'),
    statusMain:             document.getElementById('backend-status-dot'),
    statusTextMain:         document.getElementById('backend-status-text'),

    userFirstname:          document.getElementById('user-firstname'),
    passwordDisplay:        document.getElementById('password-display'),
    toggleVisBtn:           document.getElementById('toggle-visibility'),
    copyBtn:                document.getElementById('copy-btn'),
    strengthFill:           document.getElementById('strength-fill'),
    strengthText:           document.getElementById('strength-text'),
    aiIndicator:            document.getElementById('ai-indicator'),

    lengthSlider:           document.getElementById('length-slider'),
    lengthInput:            document.getElementById('length-input'),
    optUpper:               document.getElementById('opt-uppercase'),
    optLower:               document.getElementById('opt-lowercase'),
    optNumbers:             document.getElementById('opt-numbers'),
    optSymbols:             document.getElementById('opt-symbols'),
    symbolSet:              document.getElementById('symbol-set'),
    optRequireAll:          document.getElementById('opt-require-all'),
    optClearClip:           document.getElementById('opt-clear-clipboard'),
    generateBtn:            document.getElementById('generate-btn'),

    // Profile states
    profileLoading:         document.getElementById('profile-loading'),
    profileError:           document.getElementById('profile-error'),
    profileErrorMsg:        document.getElementById('profile-error-msg'),
    profileRetryBtn:        document.getElementById('profile-retry-btn'),
    profileContent:         document.getElementById('profile-content'),

    // Profile fields
    profileAvatarInitials:  document.getElementById('profile-avatar-initials'),
    profileName:            document.getElementById('profile-name'),
    profileEmail:           document.getElementById('profile-email'),
    profileId:              document.getElementById('profile-id'),
    profilePremiumBadge:    document.getElementById('profile-premium-badge'),
    profileTier:            document.getElementById('profile-tier'),
    profileAiStatus:        document.getElementById('profile-ai-status'),
    premiumBanner:          document.getElementById('premium-banner'),
    logoutBtn:              document.getElementById('logout-btn'),
    notification:           document.getElementById('notification'),
};

let backendOnline = false;
let authToken     = null;
let currentUser   = null;
let clearClipTimeout = null;

// ── INIT ──
document.addEventListener('DOMContentLoaded', async () => {
    setupUIEvents();
    loadSettings();
    await checkBackendHealth();

    chrome.storage.local.get(['token'], async ({ token }) => {
        if (token) {
            authToken = token;
            const user = await fetchProfile();
            if (user) {
                currentUser = user;
                showMainScreen(user);
                if (backendOnline) generatePassword();
            } else {
                logout(); // token expired/invalid
            }
        } else {
            showAuthScreen();
        }
    });
});

// ── EVENT LISTENERS ──
function setupUIEvents() {
    dom.tabLogin.addEventListener('click',    () => switchAuthTab('login'));
    dom.tabRegister.addEventListener('click', () => switchAuthTab('register'));

    dom.navGen.addEventListener('click', () => switchMainTab('generator'));
    dom.navProfile.addEventListener('click', () => {
        switchMainTab('profile');
        loadProfileTab();
    });

    dom.loginForm.addEventListener('submit',    handleLogin);
    dom.registerForm.addEventListener('submit', handleRegister);
    dom.logoutBtn.addEventListener('click',     logout);
    dom.profileRetryBtn.addEventListener('click', loadProfileTab);

    dom.lengthSlider.addEventListener('input', (e) => {
        dom.lengthInput.value = e.target.value;
        saveSettings();
    });
    dom.lengthInput.addEventListener('input', (e) => {
        const v = parseInt(e.target.value);
        if (v >= 8 && v <= 64) { dom.lengthSlider.value = v; saveSettings(); }
    });
    [dom.optUpper, dom.optLower, dom.optNumbers, dom.optSymbols,
     dom.symbolSet, dom.optRequireAll, dom.optClearClip]
        .forEach(el => el.addEventListener('change', saveSettings));

    dom.generateBtn.addEventListener('click',    generatePassword);
    dom.toggleVisBtn.addEventListener('click',   toggleVisibility);
    dom.copyBtn.addEventListener('click',        copyToClipboard);
}

// ── SCREEN HELPERS ──
function showAuthScreen() {
    dom.authScreen.classList.remove('hidden');
    dom.mainScreen.classList.add('hidden');
}

function showMainScreen(user) {
    dom.authScreen.classList.add('hidden');
    dom.mainScreen.classList.remove('hidden');
    if (user) dom.userFirstname.textContent = user.name.split(' ')[0];
}

function switchAuthTab(tab) {
    dom.authError.classList.add('hidden');
    const isLogin = (tab === 'login');
    dom.tabLogin.classList.toggle('active', isLogin);
    dom.tabRegister.classList.toggle('active', !isLogin);
    dom.loginForm.classList.toggle('active', isLogin);
    dom.registerForm.classList.toggle('active', !isLogin);
}

function switchMainTab(tab) {
    const isGen = (tab === 'generator');
    dom.navGen.classList.toggle('active', isGen);
    dom.navProfile.classList.toggle('active', !isGen);
    dom.viewGen.classList.toggle('active', isGen);
    dom.viewProfile.classList.toggle('active', !isGen);
}

// ── PROFILE TAB LOADER ──
async function loadProfileTab() {
    // Show spinner, hide others
    dom.profileLoading.classList.remove('hidden');
    dom.profileError.classList.add('hidden');
    dom.profileContent.classList.add('hidden');

    try {
        const user = await fetchProfile();
        if (user) {
            currentUser = user;
            populateProfile(user);
            dom.profileLoading.classList.add('hidden');
            dom.profileContent.classList.remove('hidden');
        } else {
            throw new Error("Could not fetch user data. Please log in again.");
        }
    } catch (err) {
        dom.profileLoading.classList.add('hidden');
        dom.profileErrorMsg.textContent = err.message || "Failed to load profile.";
        dom.profileError.classList.remove('hidden');
    }
}

function populateProfile(user) {
    // Avatar initials
    const initials = user.name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
    dom.profileAvatarInitials.textContent = initials;

    dom.profileName.textContent  = user.name;
    dom.profileEmail.textContent = user.email;
    dom.profileId.textContent    = user.id;

    if (user.is_premium) {
        dom.profilePremiumBadge.textContent  = '👑 Premium';
        dom.profilePremiumBadge.className    = 'tier-badge premium-active-badge';
        dom.profileTier.textContent          = 'Premium';
        dom.profileAiStatus.textContent      = '✅ Active — Powered by n8n AI';
        dom.profileAiStatus.style.color      = 'var(--success)';
        dom.premiumBanner.classList.remove('hidden');
    } else {
        dom.profilePremiumBadge.textContent  = 'Standard';
        dom.profilePremiumBadge.className    = 'tier-badge standard-badge';
        dom.profileTier.textContent          = 'Standard (Free)';
        dom.profileAiStatus.textContent      = '❌ Not Available — Contact admin to upgrade';
        dom.profileAiStatus.style.color      = 'var(--muted)';
        dom.premiumBanner.classList.add('hidden');
    }
}

// ── AUTH ──
async function handleLogin(e) {
    e.preventDefault();
    dom.authError.classList.add('hidden');
    const email    = document.getElementById('login-email').value;
    const password = document.getElementById('login-password').value;
    try {
        const res  = await fetch(`${API_BASE_URL}/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password })
        });
        const data = await res.json();
        if (res.ok) {
            authToken = data.access_token;
            chrome.storage.local.set({ token: authToken });
            const user = await fetchProfile();
            if (user) { currentUser = user; showMainScreen(user); generatePassword(); }
        } else {
            showAuthError(data.detail || "Login failed");
        }
    } catch {
        showAuthError("Cannot reach server.");
    }
}

async function handleRegister(e) {
    e.preventDefault();
    dom.authError.classList.add('hidden');
    const name     = document.getElementById('register-name').value;
    const email    = document.getElementById('register-email').value;
    const password = document.getElementById('register-password').value;
    try {
        const res  = await fetch(`${API_BASE_URL}/register`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name, email, password })
        });
        const data = await res.json();
        if (res.ok) {
            document.getElementById('login-email').value    = email;
            document.getElementById('login-password').value = password;
            switchAuthTab('login');
            await handleLogin(new Event('submit'));
        } else {
            showAuthError(data.detail || "Registration failed");
        }
    } catch {
        showAuthError("Cannot reach server.");
    }
}

function showAuthError(msg) {
    dom.authError.textContent = msg;
    dom.authError.classList.remove('hidden');
}

function logout() {
    authToken = null; currentUser = null;
    chrome.storage.local.remove(['token']);
    showAuthScreen();
}

async function fetchProfile() {
    if (!authToken) return null;
    try {
        const res = await fetch(`${API_BASE_URL}/users/me`, {
            headers: { 'Authorization': `Bearer ${authToken}` }
        });
        if (res.ok) return await res.json();
        return null;
    } catch { return null; }
}

// ── GENERATOR ──
async function generatePassword() {
    if (!backendOnline) {
        await checkBackendHealth();
        if (!backendOnline) { showGenError("Backend offline"); return; }
    }
    dom.generateBtn.disabled        = true;
    dom.generateBtn.textContent     = "Generating...";
    dom.passwordDisplay.value       = "";
    dom.passwordDisplay.placeholder = "Generating...";
    dom.aiIndicator.classList.add('hidden');

    const payload = {
        length:               parseInt(dom.lengthInput.value),
        uppercase:            dom.optUpper.checked,
        lowercase:            dom.optLower.checked,
        numbers:              dom.optNumbers.checked,
        symbols:              dom.optSymbols.checked,
        symbol_set:           dom.symbolSet.value,
        require_each_category: dom.optRequireAll.checked
    };

    try {
        const res  = await fetch(`${API_BASE_URL}/generate`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${authToken}` },
            body: JSON.stringify(payload)
        });
        if (res.status === 401) { logout(); return; }
        const data = await res.json();
        if (res.ok) {
            dom.passwordDisplay.value       = data.password;
            dom.passwordDisplay.placeholder = "Click Generate...";
            if (dom.passwordDisplay.type === "password") dom.passwordDisplay.type = "text";
            updateStrengthUI(data.strength);
            if (data.source === "ai") dom.aiIndicator.classList.remove('hidden');
        } else {
            showGenError(data.detail || "Error from server");
        }
    } catch {
        showGenError("Network error");
        setBackendStatus(false);
    } finally {
        dom.generateBtn.disabled    = false;
        dom.generateBtn.textContent = "Generate Secure Password";
    }
}

// ── UTILITIES ──
async function checkBackendHealth() {
    try {
        const res = await fetch(`${API_BASE_URL}/health`, { signal: AbortSignal.timeout(5000) });
        setBackendStatus(res.ok);
    } catch { setBackendStatus(false); }
}

function setBackendStatus(isOnline) {
    backendOnline = isOnline;
    const cls = isOnline ? 'dot online' : 'dot offline';
    const txt = isOnline ? 'Online' : 'Offline';
    dom.statusAuth.className = cls;    dom.statusTextAuth.textContent = txt;
    dom.statusMain.className = cls;    dom.statusTextMain.textContent = txt;
    if (dom.generateBtn) dom.generateBtn.disabled = !isOnline;
}

function updateStrengthUI(strength) {
    dom.strengthText.textContent = `Strength: ${strength}`;
    const map = {
        "Weak":        { c: "var(--danger)",  w: "25%"  },
        "Moderate":    { c: "var(--warning)", w: "50%"  },
        "Strong":      { c: "var(--success)", w: "75%"  },
        "Very Strong": { c: "var(--success)", w: "100%" }
    };
    const s = map[strength] || { c: "var(--muted)", w: "10%" };
    dom.strengthFill.style.width           = s.w;
    dom.strengthFill.style.backgroundColor = s.c;
}

function toggleVisibility() {
    dom.passwordDisplay.type = dom.passwordDisplay.type === "password" ? "text" : "password";
}

function copyToClipboard() {
    const pwd = dom.passwordDisplay.value;
    if (!pwd || pwd.startsWith("Error")) return;
    navigator.clipboard.writeText(pwd).then(() => {
        dom.notification.classList.remove('hidden');
        setTimeout(() => dom.notification.classList.add('hidden'), 2500);
        if (dom.optClearClip.checked) {
            if (clearClipTimeout) clearTimeout(clearClipTimeout);
            clearClipTimeout = setTimeout(() => navigator.clipboard.writeText(""), 10000);
        }
    });
}

function showGenError(msg) {
    dom.passwordDisplay.value       = "";
    dom.passwordDisplay.placeholder = `⚠ ${msg}`;
    dom.strengthText.textContent    = "";
    dom.strengthFill.style.width    = "0%";
}

function saveSettings() {
    chrome.storage.local.set({ settings: {
        length:     dom.lengthInput.value,
        upper:      dom.optUpper.checked,
        lower:      dom.optLower.checked,
        numbers:    dom.optNumbers.checked,
        symbols:    dom.optSymbols.checked,
        symbolSet:  dom.symbolSet.value,
        requireAll: dom.optRequireAll.checked,
        clearClip:  dom.optClearClip.checked
    }});
}

function loadSettings() {
    chrome.storage.local.get(['settings'], ({ settings: s }) => {
        if (!s) return;
        dom.lengthSlider.value    = s.length;
        dom.lengthInput.value     = s.length;
        dom.optUpper.checked      = s.upper;
        dom.optLower.checked      = s.lower;
        dom.optNumbers.checked    = s.numbers;
        dom.optSymbols.checked    = s.symbols;
        dom.symbolSet.value       = s.symbolSet;
        dom.optRequireAll.checked = s.requireAll;
        dom.optClearClip.checked  = s.clearClip;
    });
}
