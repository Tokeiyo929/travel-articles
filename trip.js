(() => {
    const loading = document.getElementById('loading');
    const errorContainer = document.getElementById('error-container');
    const errorMessage = document.getElementById('error-message');
    const contentContainer = document.getElementById('markdown-content');
    const retryButton = document.getElementById('retry-load');

    function showError(error) {
        loading.hidden = true;
        errorContainer.hidden = false;
        errorMessage.textContent = error.message;
    }

    // 图片包一层 figure，把 alt 变成图注
    function wrapFigures(html) {
        return html.replace(/<p><img([^>]*?)alt="([^"]*)"([^>]*)><\/p>/g,
            (_, pre, alt, post) =>
                `<figure><img${pre}alt="${alt}"${post}>${alt ? `<figcaption>${alt}</figcaption>` : ''}</figure>`)
            .replace(/<img([^>]*?)alt="([^"]*)"([^>]*)>/g, (m, pre, alt, post) => {
                if (m.startsWith('<figure') || alt === '') return m;
                return `<figure><img${pre}alt="${alt}"${post}><figcaption>${alt}</figcaption></figure>`;
            });
    }

    // 灯箱
    function setupLightbox() {
        const box = document.createElement('div');
        box.className = 'lightbox';
        box.innerHTML = '<img alt="">';
        document.body.append(box);
        box.addEventListener('click', () => box.classList.remove('open'));
        contentContainer.addEventListener('click', event => {
            const img = event.target.closest('img');
            if (!img || !contentContainer.contains(img)) return;
            box.querySelector('img').src = img.src;
            box.querySelector('img').alt = img.alt || '';
            box.classList.add('open');
        });
        document.addEventListener('keydown', e => {
            if (e.key === 'Escape') box.classList.remove('open');
        });
    }

    async function loadMarkdown() {
        try {
            if (typeof marked === 'undefined' || typeof DOMPurify === 'undefined') {
                throw new Error('Markdown 库加载失败');
            }
            const mdFile = document.body.dataset.markdown;
            if (!mdFile) throw new Error('未配置 Markdown 文件');

            loading.hidden = false;
            errorContainer.hidden = true;
            contentContainer.hidden = true;

            const response = await fetch(mdFile, { cache: 'no-store' });
            if (!response.ok) throw new Error(`Markdown 加载失败（HTTP ${response.status}）`);
            const markdownText = await response.text();
            if (!markdownText.trim()) throw new Error('Markdown 文件为空');

            // 去掉 front-matter（元数据由 create_trip.py 生成到页面头部）
            const content = markdownText.replace(/^\uFEFF?---\s*\n([\s\S]*?)\n---\s*\n/, '');
            marked.setOptions({ breaks: true, gfm: true, smartypants: true });

            let html = marked.parse(content);
            html = html.replace(/<(\/?)h([1-5])(\s[^>]*)?>/g,
                (_, closing, level, attrs = '') => `<${closing}h${Number(level) + 1}${attrs}>`);

            contentContainer.innerHTML = DOMPurify.sanitize(wrapFigures(html));
            contentContainer.hidden = false;
            loading.hidden = true;

            contentContainer.querySelectorAll('img').forEach(img => {
                img.loading = 'lazy';
                img.addEventListener('error', () => { img.alt = '图片加载失败'; }, { once: true });
            });
        } catch (error) {
            console.error(error);
            showError(error);
        }
    }

    retryButton.addEventListener('click', loadMarkdown);
    setupLightbox();
    loadMarkdown();
})();
