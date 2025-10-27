document.addEventListener('DOMContentLoaded', () => {

    // --- CONSTANTS ---
    const ADMIN_EMAIL = 'mridulbaishya216@gmail.com';
    const ADMIN_PASS = 'Jjm@mug25';
    let currentCaptcha = '';

    // --- SELECTORS ---
    const loginForm = document.getElementById('login-form');
    const emailInput = document.getElementById('email');
    const passwordInput = document.getElementById('password');
    const captchaInput = document.getElementById('captcha');
    const captchaCode = document.getElementById('captcha-code');
    const refreshCaptchaBtn = document.getElementById('refresh-captcha');
    const loginError = document.getElementById('login-error');
    const loader = document.getElementById('loader');

    // --- FUNCTIONS ---

    function showLoader(show) {
        loader.classList.toggle('active', show);
    }

    function generateCaptcha() {
        const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
        let result = '';
        for (let i = 0; i < 5; i++) {
            result += chars.charAt(Math.floor(Math.random() * chars.length));
        }
        currentCaptcha = result;
        captchaCode.textContent = result;
    }

    function handleLogin(e) {
        e.preventDefault();
        loginError.style.display = 'none';
        showLoader(true); // Show loader on login attempt

        const email = emailInput.value;
        const password = passwordInput.value;
        const captcha = captchaInput.value;

        // Simulate a small delay for checking
        setTimeout(() => {
            if (email === ADMIN_EMAIL && password === ADMIN_PASS) {
                if (captcha.toUpperCase() === currentCaptcha) {
                    // SUCCESS: Redirect to the dashboard page
                    window.location.href = 'dashboard.html';
                } else {
                    loginError.textContent = 'Invalid CAPTCHA. Please try again.';
                    loginError.style.display = 'block';
                    generateCaptcha();
                    captchaInput.value = '';
                }
            } else {
                loginError.textContent = 'Invalid Administrator ID or Password.';
                loginError.style.display = 'block';
                generateCaptcha();
            }
            showLoader(false); // Hide loader after check
        }, 500);
    }

    // --- EVENT LISTENERS ---
    loginForm.addEventListener('submit', handleLogin);
    refreshCaptchaBtn.addEventListener('click', generateCaptcha);

    // --- INITIALIZATION ---
    generateCaptcha();
});
