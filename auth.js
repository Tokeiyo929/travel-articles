/* 山河手帖 · 登录与隐私照片
 *
 * 两种模式：
 *   游客模式（默认，未登录）——private-photos.json 里登记的人像照片被替换成替代图或占位卡；
 *   隐私模式（站点主人 GitHub 令牌验证通过后）——所有照片显示原图。
 *
 * 登录方式：粘贴一个只读 GitHub 令牌（classic，勾 read:user 即可），
 * 站点调用 api.github.com/user 验证身份，仅 OWNER_LOGIN 的账号解锁隐私模式。
 * 令牌只保存在本浏览器 localStorage，无任何仓库权限。
 *
 * 安全边界（如实说明）：这是静态站，替换属于前端遮罩；
 * 知道原图 URL 的人仍能直接访问。若要绝对隐私，请不要把人像原图推送到仓库。
 */
(() => {
    'use strict';

    const OWNER_LOGIN = 'Tokeiyo929';
    const STORAGE_KEY = 'shanhe-auth-v1';
    const API_USER = 'https://api.github.com/user';
    const NEW_TOKEN_URL = 'https://github.com/settings/tokens/new?description=shanhe-shoutie&scopes=read:user';

    // 游客模式下的统一占位卡（清单未指定替代图时使用）
    const PLACEHOLDER_URI = 'data:image/svg+xml;utf8,' + encodeURIComponent(
        '<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="800">' +
        '<rect width="100%" height="100%" fill="#f0e9da"/>' +
        '<rect x="14" y="14" width="1172" height="772" fill="none" stroke="#d9cdb4" stroke-width="3" stroke-dasharray="10 8"/>' +
        '<rect x="530" y="300" width="140" height="110" rx="12" fill="none" stroke="#a4452c" stroke-width="9"/>' +
        '<path d="M556 300 v-30 a44 44 0 0 1 88 0 v30" fill="none" stroke="#a4452c" stroke-width="9"/>' +
        '<text x="600" y="500" font-family="sans-serif" font-size="46" fill="#6b6257" text-anchor="middle">此处有一张照片</text>' +
        '<text x="600" y="570" font-family="sans-serif" font-size="36" fill="#9a8f80" text-anchor="middle">登录后可见原图</text>' +
        '</svg>');

    /* ---------- 状态 ---------- */
    const getState = () => {
        try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null'); }
        catch (e) { return null; }
    };
    const setState = (s) => {
        if (s) localStorage.setItem(STORAGE_KEY, JSON.stringify(s));
        else localStorage.removeItem(STORAGE_KEY);
    };
    const isUnlocked = () => {
        const s = getState();
        return !!(s && s.login === OWNER_LOGIN);
    };

    async function verifyToken(token) {
        const res = await fetch(API_USER, {
            headers: { 'Authorization': 'Bearer ' + token, 'Accept': 'application/vnd.github+json' }
        });
        if (res.status === 401) throw new Error('令牌无效或已过期');
        if (res.status === 403) throw new Error('GitHub 拒绝了请求（限流或权限不足）');
        if (!res.ok) throw new Error('GitHub 返回 ' + res.status);
        const u = await res.json();
        return u.login || '';
    }

    /* ---------- 隐私照片清单 ---------- */
    let manifest = {};
    async function loadManifest() {
        try {
            const res = await fetch('private-photos.json', { cache: 'no-cache' });
            if (!res.ok) return {};
            const data = await res.json();
            return (data && data.photos) ? data.photos : {};
        } catch (e) { return {}; }
    }
    const normKey = (src) => (src || '').split(/[?#]/)[0].replace(/^\.\//, '');
    const findEntry = (img) => {
        const raw = normKey(img.getAttribute('src'));
        if (!raw || raw.startsWith('data:')) return null;
        if (Object.prototype.hasOwnProperty.call(manifest, raw)) return manifest[raw];
        const path = new URL(img.src, location.href).pathname;
        for (const key of Object.keys(manifest)) {
            if (path === '/' + key || path.endsWith('/' + key)) return manifest[key];
        }
        return null;
    };

    function blockImg(img) {
        const entry = findEntry(img);
        if (!entry || img.dataset.privateHandled) return;
        img.dataset.privateHandled = '1';
        img.dataset.privateOriginal = img.getAttribute('src');
        const sub = entry.substitute;
        if (sub && !manifest[sub]) img.setAttribute('src', sub);
        else img.setAttribute('src', PLACEHOLDER_URI);
        img.classList.add('private-blocked');
        const fig = img.closest('figure');
        const cap = fig && fig.querySelector('figcaption');
        if (cap) {
            cap.dataset.privateCaption = cap.textContent;
            cap.textContent = '此处照片已替换 · 登录后可见原图';
        }
    }
    function restoreImg(img) {
        if (!img.dataset.privateHandled) return;
        img.setAttribute('src', img.dataset.privateOriginal);
        delete img.dataset.privateHandled;
        delete img.dataset.privateOriginal;
        img.classList.remove('private-blocked');
        const fig = img.closest('figure');
        const cap = fig && fig.querySelector('figcaption');
        if (cap && cap.dataset.privateCaption !== undefined) {
            cap.textContent = cap.dataset.privateCaption;
            delete cap.dataset.privateCaption;
        }
    }
    function scanImages() {
        const unlocked = isUnlocked();
        document.querySelectorAll('img').forEach(img => unlocked ? restoreImg(img) : blockImg(img));
    }
    let scanTimer = 0;
    const scanSoon = () => { clearTimeout(scanTimer); scanTimer = setTimeout(scanImages, 120); };

    /* ---------- 顶栏部件 ---------- */
    let box, badge, action;
    function renderBox() {
        const s = getState();
        if (s && s.login === OWNER_LOGIN) {
            badge.textContent = '隐私模式'; badge.classList.add('on');
            action.textContent = '退出';
        } else if (s && s.login) {
            badge.textContent = '游客模式'; badge.classList.remove('on');
            action.textContent = '退出（' + s.login + '）';
        } else {
            badge.textContent = '游客模式'; badge.classList.remove('on');
            action.textContent = 'GitHub 登录';
        }
    }
    function injectHeader() {
        const head = document.querySelector('.site-head');
        if (!head) return;
        box = document.createElement('div');
        box.className = 'auth-box';
        badge = document.createElement('span');
        badge.className = 'auth-badge';
        action = document.createElement('button');
        action.type = 'button';
        action.className = 'auth-action';
        box.append(badge, action);
        head.appendChild(box);
        action.addEventListener('click', () => {
            if (getState()) logout(); else openModal();
        });
        renderBox();
    }
    function logout() {
        setState(null);
        renderBox();
        scanImages();
    }

    /* ---------- 登录弹层 ---------- */
    let overlay, input, msg;
    function openModal() {
        if (!overlay) buildModal();
        msg.textContent = '';
        msg.className = 'auth-msg';
        input.value = '';
        overlay.hidden = false;
        input.focus();
    }
    function closeModal() { if (overlay) overlay.hidden = true; }
    function buildModal() {
        overlay = document.createElement('div');
        overlay.className = 'auth-overlay';
        overlay.hidden = true;
        const panel = document.createElement('div');
        panel.className = 'auth-panel';
        panel.innerHTML =
            '<h3>GitHub 登录</h3>' +
            '<p>隐私模式仅对站点主人开放。在 GitHub 生成一个只读令牌（classic，勾选 read:user 即可，无需任何仓库权限），粘贴到这里完成验证。<br>' +
            '<a href="' + NEW_TOKEN_URL + '" target="_blank" rel="noopener noreferrer">去 GitHub 生成令牌 ↗</a></p>';
        input = document.createElement('input');
        input.type = 'password';
        input.className = 'auth-input';
        input.placeholder = '粘贴令牌：ghp_… 或 github_pat_…';
        input.autocomplete = 'off';
        msg = document.createElement('div');
        msg.className = 'auth-msg';
        const row = document.createElement('div');
        row.className = 'auth-btn-row';
        const ok = document.createElement('button');
        ok.type = 'button'; ok.className = 'auth-btn primary'; ok.textContent = '验证并登录';
        const cancel = document.createElement('button');
        cancel.type = 'button'; cancel.className = 'auth-btn'; cancel.textContent = '取消';
        row.append(ok, cancel);
        panel.append(input, msg, row);
        overlay.appendChild(panel);
        document.body.appendChild(overlay);
        overlay.addEventListener('click', (e) => { if (e.target === overlay) closeModal(); });
        cancel.addEventListener('click', closeModal);
        const submit = async () => {
            const token = input.value.trim();
            if (!token) { msg.textContent = '请先粘贴令牌。'; msg.className = 'auth-msg'; return; }
            msg.className = 'auth-msg ok'; msg.textContent = '正在向 GitHub 验证……';
            try {
                const login = await verifyToken(token);
                if (login !== OWNER_LOGIN) {
                    msg.className = 'auth-msg';
                    msg.textContent = '已验证为 ' + login + '，但隐私模式仅对站点主人开放，你将以游客模式浏览。';
                    setState({ token: token, login: login });
                    setTimeout(() => { closeModal(); renderBox(); scanImages(); }, 1200);
                    return;
                }
                setState({ token: token, login: login });
                msg.className = 'auth-msg ok'; msg.textContent = '欢迎回来，隐私模式已开启。';
                setTimeout(() => { closeModal(); renderBox(); scanImages(); }, 600);
            } catch (e) {
                msg.className = 'auth-msg';
                msg.textContent = e.message + '（网络无法访问 GitHub 时也会报错）';
            }
        };
        ok.addEventListener('click', submit);
        input.addEventListener('keydown', (e) => { if (e.key === 'Enter') submit(); });
    }

    /* ---------- 启动 ---------- */
    async function init() {
        manifest = await loadManifest();
        injectHeader();
        const s = getState();
        if (s && s.token) {
            try {
                const login = await verifyToken(s.token);
                setState({ token: s.token, login: login });
            } catch (e) {
                if (e.message.indexOf('限流') === -1 && e.message.indexOf('网络') === -1) setState(null);
            }
        }
        renderBox();
        scanImages();
        new MutationObserver(scanSoon)
            .observe(document.documentElement, { childList: true, subtree: true });
    }
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
    else init();
})();
