window.PortfolioApp = (() => {
    let data = { projectGroups: [] };
    let savedOnly = false;
    let installPrompt = null;
    let allProjects = false;
    const key = (group, project) => `${group.id}:${project.id}`;
    function saved() {
        try { const values = JSON.parse(localStorage.getItem('savedProjects') || '[]'); return Array.isArray(values) ? values : []; }
        catch { return []; }
    }
    let announceTimeout;
    function announce(message) {
        const status = document.getElementById('app-status');
        status.textContent = message; clearTimeout(announceTimeout);
        announceTimeout = setTimeout(() => { status.textContent = ''; }, 12000);
    }
    function search() {
        const query = document.getElementById('project-search').value.trim().toLowerCase();
        const results = document.getElementById('project-results');
        const groups = document.getElementById('projects-grid');
        const category = document.getElementById('project-category').value;
        const sort = document.getElementById('project-sort').value;
        const active = Boolean(query || savedOnly || category || allProjects || sort !== 'recent');
        document.getElementById('clear-project-filters').hidden = !active;
        if (!active) document.getElementById('project-result-count').textContent = '';
        groups.hidden = active;
        results.hidden = !active;
        results.replaceChildren();
        if (!active) return;
        const matches = (data.projectGroups || []).flatMap(group => (group.projects || []).map(project => ({ group, project })))
            .filter(({ group, project }) => (!category || String(group.id) === category) && (!savedOnly || saved().includes(key(group, project))) &&
                [project.title, project.description, group.name, ...(project.technologies || [])].join(' ').toLowerCase().includes(query))
            .sort((a, b) => sort === 'title' ? String(a.project.title).localeCompare(String(b.project.title)) : Number(b.project.id) - Number(a.project.id));
        document.getElementById('project-result-count').textContent = `${matches.length} project${matches.length === 1 ? '' : 's'} found`;
        if (!matches.length) {
            const empty = document.createElement('p');
            empty.className = 'explorer-empty';
            empty.textContent = savedOnly ? 'No saved projects match. Open a project and save it to return to it later.' : 'No matching projects. Try a skill, technology, or another keyword.';
            results.append(empty);
        }
        matches.forEach(({ group, project }) => {
            const button = document.createElement('button');
            button.className = 'explorer-result';
            const title = document.createElement('h3'); title.textContent = project.title;
            const category = document.createElement('span'); category.textContent = group.name;
            const description = document.createElement('p'); description.textContent = project.description || 'Explore this project';
            button.append(category, title, description);
            button.addEventListener('click', () => {
                document.getElementById('project-search').value = '';
                savedOnly = false;
                document.getElementById('saved-projects').setAttribute('aria-pressed', 'false');
                search();
                showProjectDetail(group.id, project.id);
            });
            results.append(button);
        });
    }
    function renderProjectActions(container, group, project) {
        const actions = document.createElement('div'); actions.className = 'project-app-actions';
        const save = document.createElement('button'); save.className = 'btn secondary';
        function update() {
            const selected = saved().includes(key(group, project));
            save.textContent = selected ? 'Saved to this device' : 'Save project';
            save.setAttribute('aria-pressed', String(selected));
        }
        update();
        save.addEventListener('click', () => {
            const values = saved(); const id = key(group, project);
            try {
                localStorage.setItem('savedProjects', JSON.stringify(values.includes(id) ? values.filter(value => value !== id) : [...values, id]));
                update(); announce(save.textContent);
            } catch { announce('Your browser could not save this project.'); }
        });
        const share = document.createElement('button'); share.className = 'btn secondary'; share.textContent = 'Share project';
        share.addEventListener('click', async () => {
            const url = `${location.origin}/#projects/group/${encodeURIComponent(group.id)}/project/${encodeURIComponent(project.id)}`;
            try {
                if (navigator.share) await navigator.share({ title: project.title, url });
                else { await navigator.clipboard.writeText(url); announce('Project link copied.'); }
            } catch (error) {
                if (error.name !== 'AbortError') announce(`Project link: ${url}`);
            }
        });
        const contact = document.createElement('a'); contact.href = '#contact'; contact.className = 'btn primary'; contact.textContent = 'Discuss a similar project';
        contact.addEventListener('click', () => {
            document.getElementById('inquiry-context').textContent = `Regarding: ${project.title}`;
            document.getElementById('inquiry-context').hidden = false;
            document.getElementById('out-message').focus({ preventScroll: true });
        });
        actions.append(save, share, contact);
        container.append(actions);
    }
    function resetView() {
        savedOnly = false; allProjects = false;
        document.getElementById('project-search').value = '';
        document.getElementById('project-category').value = '';
        document.getElementById('project-sort').value = 'recent';
        document.getElementById('saved-projects').setAttribute('aria-pressed', 'false');
        document.getElementById('all-projects').setAttribute('aria-pressed', 'false');
        search();
    }
    function setData(value) {
        data = value;
        const selector = document.getElementById('project-category');
        const previous = selector.value;
        selector.replaceChildren(new Option('Every category', ''));
        (data.projectGroups || []).forEach(group => selector.append(new Option(group.name, group.id)));
        selector.value = previous;
        const personal = data.personal || {};
        const name = personal.name || 'George Ochieng';
        document.getElementById('profile-card-role').textContent = personal.title || 'Data Scientist & Web Developer';
        document.getElementById('profile-monogram').textContent = name.split(/\s+/).filter(Boolean).slice(0, 2).map(word => word[0]).join('').toUpperCase();
        document.getElementById('profile-monogram').hidden = Boolean(personal.profileImage || personal.aboutImage);
        document.getElementById('credentials-count').textContent = data.certifications?.length || 0;
        document.getElementById('footer-text').textContent = data.footer || `${new Date().getFullYear()} ${name}. Let's build something useful.`;
        document.title = `${name} | Work, Credentials & Collaboration`;
        search();
    }
    document.getElementById('project-category').addEventListener('change', search);
    document.getElementById('project-sort').addEventListener('change', search);
    document.getElementById('all-projects').addEventListener('click', event => { allProjects = !allProjects; event.currentTarget.setAttribute('aria-pressed', String(allProjects)); search(); });
    document.getElementById('clear-project-filters').addEventListener('click', resetView);
    const quickNav = document.getElementById('quick-nav');
    document.getElementById('open-quick-nav').addEventListener('click', () => quickNav.showModal());
    document.getElementById('close-quick-nav').addEventListener('click', () => quickNav.close());
    quickNav.querySelectorAll('a').forEach(link => link.addEventListener('click', () => quickNav.close()));
    document.addEventListener('keydown', event => { if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') { event.preventDefault(); if (quickNav.open) quickNav.close(); else quickNav.showModal(); } });
    document.querySelectorAll('[data-inquiry-service]').forEach(link => link.addEventListener('click', () => { document.getElementById('inquiry-service').value = link.dataset.inquiryService; }));
    document.getElementById('project-search').addEventListener('input', search);
    document.getElementById('saved-projects').addEventListener('click', event => {
        savedOnly = !savedOnly;
        event.currentTarget.setAttribute('aria-pressed', String(savedOnly));
        search();
    });
    window.addEventListener('beforeinstallprompt', event => {
        event.preventDefault(); installPrompt = event;
        document.getElementById('install-app').hidden = false;
    });
    document.getElementById('install-app').addEventListener('click', async () => {
        if (!installPrompt) return;
        await installPrompt.prompt(); installPrompt = null;
        document.getElementById('install-app').hidden = true;
    });
    function connectionStatus() {
        const banner = document.getElementById('connection-status');
        banner.hidden = navigator.onLine;
        banner.textContent = 'You are offline. Reconnect to load projects, credentials, and messages.';
    }
    window.addEventListener('online', connectionStatus);
    window.addEventListener('offline', connectionStatus);
    connectionStatus();
    if ('serviceWorker' in navigator) navigator.serviceWorker.register('/sw.js').catch(() => {});
    return { setData, renderProjectActions, announce, resetView };
})();
