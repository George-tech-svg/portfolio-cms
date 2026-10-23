// ============================================
// MAIN.JS - Public View (Full Project Rendering)
// ============================================

console.log('✅ main.js loaded (API version)');

const API_BASE = window.PortfolioAPI.baseURL;
let portfolioData = {};
let currentGroup = null;
let currentProject = null;

// Chat state
let visitorToken = localStorage.getItem('visitorToken');
let currentConversationId = null;
let chatPollInterval = null;
let authMode = 'login';
let publicUIReady = false;
let chatLoading = false;

// ============================================
// LOAD PUBLIC DATA
// ============================================

async function loadPublicData() {
    console.log('🔍 Starting to load data...');
    console.log('API_BASE:', API_BASE);
    
    const status = document.getElementById('load-status');
    status.hidden = false;
    status.textContent = 'Loading portfolio...';
    document.getElementById('projects-grid')?.setAttribute('aria-busy', 'true');
    try {
        const response = await PortfolioAPI.fetch(`${API_BASE}/api/data`);
        console.log('Response status:', response.status);
        
        if (!response.ok) {
            console.error('Error status:', response.status);
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        portfolioData = await response.json();
        console.log('✅ Data loaded successfully');
        
        renderPublicPortfolio();
        restoreProjectRoute();
        if (!publicUIReady) {
            initContactModes();
            initChat();
            initAuthModal();
            publicUIReady = true;
        }
        status.hidden = true;
        document.getElementById('projects-grid')?.setAttribute('aria-busy', 'false');
        console.log('Portfolio rendered successfully');
    } catch (error) {
        console.error('❌ Error loading data:', error);
        
        document.getElementById('projects-grid')?.setAttribute('aria-busy', 'false');
        status.textContent = 'Unable to load the portfolio. Please try again. ';
        const retry = document.createElement('button');
        retry.textContent = 'Retry';
        retry.className = 'btn secondary';
        retry.addEventListener('click', loadPublicData, { once: true });
        status.append(retry);
    }
}

// ============================================
// RENDER PUBLIC PORTFOLIO
// ============================================

function renderPublicPortfolio() {
    expandableObserver.disconnect();
    document.querySelectorAll('.expand-toggle').forEach(button => button.remove());
    console.log('Rendering portfolio...');
    const data = portfolioData;

    // --- Hero Section ---
    if (data.personal) {
        const heroTitle = document.getElementById('hero-title');
        if (heroTitle) {
            heroTitle.innerHTML = `Hi, I'm <span>${Credentials.escape(data.personal.name || 'George Ochieng')}</span>`;
        }
        
        const heroSubtitle = document.getElementById('hero-subtitle');
        if (heroSubtitle) {
            heroSubtitle.textContent = data.personal.heroSubtitle || 'Web Developer';
        }
        
        const heroBadge = document.getElementById('hero-badge');
        if (heroBadge) {
            heroBadge.textContent = data.personal.badge || '👋 Welcome';
        }
        
        const logo = document.getElementById('logo');
        if (logo) {
            logo.innerHTML = Credentials.escape((data.personal.name || 'Dev').split(' ')[0]) + '<span>.</span>';
        }
        
        // Profile image
        const profileImg = document.getElementById('profile-img');
        if (profileImg && data.personal.profileImage) {
            profileImg.src = data.personal.profileImage;
            profileImg.style.display = 'block';
        } else if (profileImg) {
            profileImg.style.display = 'none';
        }
        
        // About image
        const aboutImg = document.getElementById('about-img');
        if (aboutImg && (data.personal.aboutImage || data.personal.profileImage)) {
            aboutImg.src = Credentials.url(data.personal.aboutImage || data.personal.profileImage, true);
            aboutImg.style.display = 'block';
        } else if (aboutImg) {
            aboutImg.style.display = 'none';
        }
        
        // Resume link
        if (data.personal.resume) {
            document.querySelectorAll('#resume-link, #resume-btn').forEach(link => {
                if (link) {
                    const resume = Credentials.url(data.personal.resume, true);
                    if (!resume) return;
                    link.href = resume;
                    link.download = 'George-Ochieng-Resume.pdf';
                    link.style.display = 'flex';
                }
            });
        }
        
        // Contact email
        const contactEmail = document.getElementById('contact-email');
        if (contactEmail && data.personal.email) {
            contactEmail.textContent = data.personal.email;
            contactEmail.href = `mailto:${data.personal.email}`;
        }
    }

    // --- Stats ---
    const totalProjects = portfolioData.projectGroups?.reduce((sum, g) => sum + (g.projects?.length || 0), 0) || 0;
    
    const projectsCount = document.getElementById('projects-count');
    if (projectsCount) projectsCount.textContent = totalProjects;
    
    const clientsCount = document.getElementById('clients-count');
    if (clientsCount) clientsCount.textContent = portfolioData.projectGroups?.length || 0;
    


    // --- About Section ---
    if (data.about && data.about.paragraphs) {
        const container = document.getElementById('about-text');
        if (container) {
            container.innerHTML = '';
            data.about.paragraphs.forEach(p => {
                if (p && p.trim()) {
                    const para = document.createElement('p');
                    para.textContent = p;
                    container.appendChild(para);
                }
            });
            makeExpandable(container, 5, 'About me');
        }
    }

    // --- Skills Section ---
    renderSkills(data);

    // --- Projects Section ---
    renderProjectGroups(data);

    // --- Experience Section ---
    renderExperience(data);

    // --- Education Section ---
    renderEducation(data);

    // --- Certifications Section ---
    renderCertifications(data);

    // --- Social Links ---
    renderSocialLinks(data);
    PortfolioApp.setData(data);
    document.getElementById('welcome-message').textContent = data.personal?.welcomeMessage || '';
    const welcome = document.getElementById('welcome-video');
    const welcomeURL = Credentials.mediaURL(data.videos?.welcome);
    welcome.hidden = !welcomeURL;
    if (welcomeURL) welcome.src = welcomeURL;

    // --- Footer ---
    if (data.footer) {
        const footerText = document.getElementById('footer-text');
        if (footerText) footerText.textContent = data.footer;
    }
}

// ============================================
// RENDER SKILLS
// ============================================

function renderSkills(data) {
    const grid = document.getElementById('skills-grid');
    if (!grid) return;

    if (data.skills && data.skills.length > 0) {
        grid.innerHTML = '';
        data.skills.forEach(skill => {
            const div = document.createElement('div');
            div.className = 'skill-card';
            div.innerHTML = `
                <div class="skill-icon"><i class="${Credentials.escape(skill.icon || 'fas fa-code')}"></i></div>
                <h3>${Credentials.escape(skill.category)}</h3>
                <div class="skill-tags">
                    ${skill.items ? skill.items.map(item => `<span class="skill-tag">${Credentials.escape(item)}</span>`).join('') : ''}
                </div>
            `;
            grid.appendChild(div);
        });
    } else {
        grid.innerHTML = `
            <div class="skill-card">
                <div class="skill-icon"><i class="fas fa-code"></i></div>
                <h3>Frontend</h3>
                <div class="skill-tags">
                    <span class="skill-tag">HTML</span>
                    <span class="skill-tag">CSS</span>
                    <span class="skill-tag">JS</span>
                </div>
            </div>
            <div class="skill-card">
                <div class="skill-icon"><i class="fas fa-server"></i></div>
                <h3>Backend</h3>
                <div class="skill-tags">
                    <span class="skill-tag">Node.js</span>
                    <span class="skill-tag">Python</span>
                    <span class="skill-tag">SQL</span>
                </div>
            </div>
        `;
    }
}

// ============================================
// RENDER PROJECT GROUPS
// ============================================

function renderProjectGroups(data) {
    const container = document.getElementById('projects-grid');
    if (!container) return;

    const groups = data.projectGroups || [];

    if (groups.length === 0) {
        container.innerHTML = `
            <div style="text-align:center;padding:3rem;width:100%;">
                <i class="fas fa-folder-open" style="font-size:4rem;color:var(--text-light);margin-bottom:1rem;"></i>
                <p style="color:var(--text-secondary);">No projects added yet.</p>
            </div>
        `;
        return;
    }

    container.innerHTML = groups.map((group, index) => {
        const groupId = group.id || index;
        return `
        <div class="project-card group-card" role="button" tabindex="0" onclick="showGroup('${groupId}')" style="cursor:pointer;">
            <div class="project-content">
                <span class="project-tag">${group.projects?.length || 0} Projects</span>
                <h3>${Credentials.escape(group.name)}</h3>
                <div class="category-link">
                    View the projects <i class="fas fa-arrow-right" aria-hidden="true"></i>
                </div>
            </div>
        </div>
    `}).join('');
}

// ============================================
// RENDER EXPERIENCE
// ============================================

let expandableId = 0;
const expandableObserver = new ResizeObserver(entries => {
    for (const { target } of entries) {
        const button = target.nextElementSibling;
        if (button?.classList.contains('expand-toggle') && button.getAttribute('aria-expanded') === 'false') {
            button.hidden = target.scrollHeight <= target.clientHeight + 1;
        }
    }
});

function makeExpandable(content, lines, label = 'description') {
    if (!content || !content.textContent.trim()) return;
    content.classList.add('expandable-copy');
    content.style.setProperty('--preview-lines', lines);
    content.id ||= `expandable-${++expandableId}`;
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'expand-toggle';
    button.textContent = 'more';
    button.setAttribute('aria-controls', content.id);
    button.setAttribute('aria-expanded', 'false');
    button.setAttribute('aria-label', `Show more: ${label}`);
    content.after(button);
    button.addEventListener('click', () => {
        const expanded = button.getAttribute('aria-expanded') !== 'true';
        content.classList.toggle('is-expanded', expanded);
        button.setAttribute('aria-expanded', String(expanded));
        button.setAttribute('aria-label', `${expanded ? 'Hide' : 'Show more'}: ${label}`);
        button.textContent = expanded ? 'hide' : 'more';
    });
    // Release removed nodes when content is refreshed from the API.
    expandableObserver.observe(content);
    requestAnimationFrame(() => { button.hidden = content.scrollHeight <= content.clientHeight + 1; });
}

function addPortrait(card, data) {
    const source = Credentials.url(data.personal?.aboutImage || data.personal?.profileImage, true);
    if (!source) return;
    const image = document.createElement('img');
    image.className = 'entry-portrait';
    image.src = source;
    image.alt = data.personal?.name || 'My photo';
    image.loading = 'lazy';
    image.addEventListener('error', () => image.remove());
    card.prepend(image);
}

function renderExperience(data) {
    const timeline = document.getElementById('timeline');
    if (!timeline) return;

    if (data.experience && data.experience.length > 0) {
        timeline.innerHTML = '';
        data.experience.forEach(exp => {
            const div = document.createElement('div');
            div.className = 'timeline-item';
            div.innerHTML = `
                <h3>${Credentials.escape(exp.role)}</h3>
                <div class="company">${Credentials.escape(exp.company)}</div>
                <div class="period">${Credentials.escape(exp.period)}</div>
                <p>${Credentials.escape(exp.description)}</p>
            `;
            timeline.appendChild(div);
            addPortrait(div, data);
            makeExpandable(div.querySelector('p'), 4, exp.role);
        });
    } else {
        timeline.innerHTML = `
            <div style="text-align:center;padding:2rem;color:var(--text-secondary);">
                No experience added yet.
            </div>
        `;
    }
}

// ============================================
// RENDER EDUCATION
// ============================================

function renderEducation(data) {
    const grid = document.getElementById('education-list');
    if (!grid) return;

    if (data.education && data.education.length > 0) {
        grid.innerHTML = '';
        data.education.forEach(edu => {
            const div = document.createElement('div');
            div.className = 'education-card';
            div.innerHTML = `
                <div class="edu-icon"><i class="fas fa-graduation-cap"></i></div>
                <h3>${Credentials.escape(edu.institution)}</h3>
                <div class="edu-degree">${Credentials.escape(edu.degree)}</div>
                ${edu.field ? `<div class="edu-field">${Credentials.escape(edu.field)}</div>` : ''}
                <div class="edu-period">${Credentials.escape(edu.period || '')}</div>
                ${edu.description ? `<div class="edu-description">${Credentials.escape(edu.description)}</div>` : ''}
            `;
            grid.appendChild(div);
            makeExpandable(div.querySelector('.edu-description'), 4, edu.institution);
        });
    } else {
        grid.innerHTML = `
            <div style="text-align:center;padding:2rem;color:var(--text-secondary);">
                No education added yet.
            </div>
        `;
    }
}

// ============================================
// RENDER CERTIFICATIONS
// ============================================

let certificateIndex = 0;
const phoneLayout = window.matchMedia('(max-width: 768px)');

function updateCertificateBrowser() {
    const cards = [...document.querySelectorAll('#certifications-list .certification-card')];
    certificateIndex = Math.max(0, Math.min(certificateIndex, cards.length - 1));
    cards.forEach((card, index) => {
        card.classList.toggle('is-current', index === certificateIndex);
        card.inert = phoneLayout.matches && index !== certificateIndex;
        if (phoneLayout.matches) {
            card.setAttribute('role', 'group');
            card.setAttribute('aria-roledescription', 'slide');
            card.setAttribute('aria-label', `${index + 1} of ${cards.length}`);
        } else {
            card.removeAttribute('role');
            card.removeAttribute('aria-roledescription');
            card.removeAttribute('aria-label');
        }
    });
    document.querySelector('.certificate-controls').hidden = cards.length < 2;
    document.getElementById('certificate-position').textContent = cards.length ? `${certificateIndex + 1} / ${cards.length}` : '';
    // Keep both arrows available: the collection loops at either end.
}

function moveCertificate(direction) {
    const count = document.querySelectorAll('#certifications-list .certification-card').length;
    if (!count) return;
    certificateIndex = (certificateIndex + direction + count) % count;
    updateCertificateBrowser();
}

phoneLayout.addEventListener('change', updateCertificateBrowser);
document.getElementById('certificate-prev').addEventListener('click', () => moveCertificate(-1));
document.getElementById('certificate-next').addEventListener('click', () => moveCertificate(1));
document.querySelector('.certificate-browser').addEventListener('keydown', event => {
    if (!phoneLayout.matches || event.target.closest('input, textarea, select') || document.querySelectorAll('#certifications-list .certification-card').length < 2) return;
    if (event.key === 'ArrowRight' || event.key === 'ArrowLeft') {
        event.preventDefault();
        moveCertificate(event.key === 'ArrowRight' ? 1 : -1);
        if (event.target.closest('.certification-card')) document.getElementById(event.key === 'ArrowRight' ? 'certificate-next' : 'certificate-prev').focus();
    }
});

function renderCertifications(data) {
    const grid = document.getElementById('certifications-list');
    if (!grid) return;

    grid.replaceChildren();
    certificateIndex = 0;
    const certificates = data.certifications || [];
    if (!certificates.length) {
        grid.textContent = 'Credentials will be shared here soon.';
        updateCertificateBrowser();
        return;
    }
    certificates.forEach(cert => {
        const card = document.createElement('article');
        card.className = 'certification-card';
        const heading = document.createElement('header');
        heading.className = 'cert-heading';
        heading.innerHTML = `<h3>${Credentials.escape(cert.name)}</h3><span class="cert-issuer">${Credentials.escape(cert.issuer)}</span>${cert.date ? `<span class="cert-date">${Credentials.escape(cert.date)}</span>` : ''}`;
        card.append(heading);
        const file = Credentials.url(cert.file, true);
        const verify = Credentials.url(cert.link);
        const preview = Credentials.preview(file, cert.name);
        if (preview) {
            const button = document.createElement('button');
            button.className = 'credential-thumbnail';
            button.setAttribute('aria-label', `View ${cert.name || 'certificate'}`);
            button.append(preview);
            button.addEventListener('click', () => openCredential(cert));
            card.append(button);
        }
        const content = document.createElement('div');
        content.className = 'credential-content';
        if (cert.description?.trim()) {
            const description = document.createElement('p');
            description.className = 'cert-description';
            description.textContent = cert.description;
            content.append(description);
            makeExpandable(description, 1, cert.name);
        }
        const actionRow = document.createElement('div');
        actionRow.className = 'cert-actions';
        content.append(actionRow);
        const actions = content.querySelector('.cert-actions');
        if (file) {
            const view = document.createElement('button');
            view.className = 'btn primary';
            view.textContent = 'View certificate';
            view.addEventListener('click', () => openCredential(cert));
            actions.append(view);
        }
        if (verify) {
            const link = document.createElement('a');
            link.href = verify;
            link.target = '_blank';
            link.rel = 'noopener noreferrer';
            link.className = 'btn-verify';
            link.textContent = 'Verify credential';
            actions.append(link);
        }
        card.append(content);
        grid.append(card);
    });
    updateCertificateBrowser();
}

function openCredential(cert) {
    const source = Credentials.url(cert.file, true);
    if (!source) return;
    let documentURL;
    try { documentURL = Credentials.documentURL(source); }
    catch { PortfolioApp.announce('This document could not be opened. Please try another credential or contact me.'); return; }
    const dialog = document.createElement('dialog');
    dialog.className = 'credential-dialog';
    dialog.setAttribute('aria-labelledby', 'credential-title');
    dialog.innerHTML = `<div class="credential-toolbar"><h2 id="credential-title">${Credentials.escape(cert.name)}</h2><button type="button" class="btn secondary">Close</button></div>`;
    const original = document.createElement('a');
    original.href = documentURL;
    original.target = '_blank';
    original.rel = 'noopener noreferrer';
    original.className = 'credential-original';
    original.textContent = 'Open original document';
    dialog.append(original);
    if (Credentials.kind(source) === 'image') {
        const image = document.createElement('img');
        image.src = documentURL;
        image.alt = cert.name || 'Certificate';
        dialog.append(image);
    } else if (Credentials.kind(source) === 'pdf') {
        const pdf = document.createElement('iframe');
        pdf.src = documentURL;
        pdf.title = cert.name || 'Certificate PDF';
        dialog.append(pdf);
        const help = document.createElement('p');
        help.textContent = 'If the PDF does not display on your device, use Open original document above.';
        dialog.append(help);
    }
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    dialog.querySelector('button').addEventListener('click', () => dialog.close());
    dialog.addEventListener('click', event => { if (event.target === dialog) {
        const bounds = dialog.getBoundingClientRect();
        if (event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom) dialog.close();
    }});
    dialog.addEventListener('close', () => {
        document.body.style.overflow = previousOverflow;
        dialog.remove();
        if (documentURL.startsWith('blob:')) URL.revokeObjectURL(documentURL);
    }, { once: true });
    document.body.append(dialog);
    const viewerTrigger = document.activeElement;
    dialog.addEventListener('close', () => viewerTrigger?.focus(), { once: true });
    dialog.showModal();
}

// ============================================
// RENDER SOCIAL LINKS
// ============================================

function renderSocialLinks(data) {
    const container = document.getElementById('social-links');
    if (!container) return;
    container.innerHTML = '';
    const social = data.social || {};
    const personal = data.personal || {};

    const links = [
        { key: 'whatsapp', icon: 'fab fa-whatsapp', label: 'WhatsApp', url: social.whatsapp ? `https://wa.me/${social.whatsapp.replace(/\D/g, '')}` : null },
        { key: 'linkedin', icon: 'fab fa-linkedin-in', label: 'LinkedIn', url: social.linkedin },
        { key: 'github', icon: 'fab fa-github', label: 'GitHub', url: social.github },
        { key: 'twitter', icon: 'fab fa-twitter', label: 'Twitter', url: social.twitter },
        { key: 'phone', icon: 'fas fa-phone', label: 'Phone', url: social.phone ? `tel:${social.phone.replace(/\s/g, '')}` : personal.phone ? `tel:${personal.phone.replace(/\s/g, '')}` : null },
        { key: 'email', icon: 'fas fa-envelope', label: 'Email', url: personal.email ? `mailto:${personal.email}` : null }
    ];

    const phoneLink = document.getElementById('contact-phone');
    const phone = social.phone || personal.phone || '';
    phoneLink.closest('.contact-item').hidden = !phone;
    if (phone) { phoneLink.textContent = phone; phoneLink.href = `tel:${phone.replace(/[^+\d]/g, '')}`; }
    const whatsappLink = document.getElementById('contact-whatsapp');
    whatsappLink.closest('.contact-item').hidden = !social.whatsapp;
    if (social.whatsapp) { whatsappLink.href = `https://wa.me/${social.whatsapp.replace(/\D/g, '')}`; whatsappLink.rel = 'noopener noreferrer'; }

    links.forEach(link => {
        if (link.url) {
            const a = document.createElement('a');
            a.href = ['email', 'phone', 'whatsapp'].includes(link.key) ? link.url : Credentials.url(link.url);
            a.target = '_blank';
            a.rel = 'noopener noreferrer';
            a.className = `social-icon ${link.key}`;
            a.title = link.label;
            a.innerHTML = `<i class="${link.icon}"></i><span>${link.label}</span>`;
            container.appendChild(a);
        }
    });
}

// ============================================
// SHOW GROUP / PROJECT DETAIL
// ============================================

function showGroup(groupId, navigate = true) {
    PortfolioApp.resetView();
    const group = portfolioData.projectGroups.find(g => g.id == groupId);
    if (!group) return;

    currentGroup = groupId;
    currentProject = null;
    if (navigate) history.pushState(null, '', `#projects/group/${encodeURIComponent(groupId)}`);
    const container = document.getElementById('projects-grid');
    if (!container) return;
    const projects = group.projects || [];

    if (projects.length === 0) {
        container.innerHTML = `
            <div style="text-align:center;padding:3rem;width:100%;grid-column:1/-1;">
                <p style="color:var(--text-secondary);">No projects in this group yet.</p>
                <button onclick="showGroups()" class="btn secondary" style="margin-top:1rem;">
                    <i class="fas fa-arrow-left"></i> Back to Groups
                </button>
            </div>
        `;
        return;
    }

    container.innerHTML = `
        <div style="grid-column:1/-1;text-align:center;margin-bottom:2rem;">
            <button onclick="showGroups()" class="btn secondary" style="margin-bottom:1rem;">
                <i class="fas fa-arrow-left"></i> Back to Groups
            </button>
            <h2 style="font-size:2.5rem;font-weight:800;">
                <i class="${Credentials.escape(group.icon || 'fas fa-folder')}" style="color:var(--accent-primary);"></i>
                ${Credentials.escape(group.name)}
            </h2>
            <p style="color:var(--text-secondary);">${Credentials.escape(group.description || '')}</p>
        </div>
        ${projects.map((project, pIndex) => {
            const projectId = project.id || pIndex;
            return `
            <div class="project-card" role="button" tabindex="0" onclick="showProjectDetail('${groupId}', '${projectId}')" style="cursor:pointer;">
                <div class="project-image">
                    ${project.images && project.images.length > 0 ? 
                        `<img src="${Credentials.escape(Credentials.url(project.images[0], true))}" alt="${Credentials.escape(project.title)}">` :
                        `<div style="display:flex;align-items:center;justify-content:center;height:100%;background:var(--bg-gradient);">
                            <i class="fas fa-code" style="font-size:3rem;color:var(--accent-primary);"></i>
                        </div>`
                    }
                </div>
                <div class="project-content">
                    <span class="project-tag">${project.technologies?.length || 0} Technologies</span>
                    <h3>${Credentials.escape(project.title)}</h3>
                    <p>${Credentials.escape(project.description)}</p>
                    <div style="display:flex;flex-wrap:wrap;gap:0.5rem;margin-top:0.5rem;">
                        ${project.technologies ? project.technologies.map(tech => 
                            `<span style="background:var(--bg-primary);padding:0.2rem 0.6rem;border-radius:50px;font-size:0.75rem;color:var(--text-secondary);">${Credentials.escape(tech)}</span>`
                        ).join('') : ''}
                    </div>
                    <div style="margin-top:1rem;color:var(--accent-primary);font-weight:600;font-size:0.9rem;">
                        Click to view details <i class="fas fa-arrow-right"></i>
                    </div>
                </div>
            </div>
        `}).join('')}
    `;

    document.getElementById('projects').scrollIntoView({ behavior: 'smooth' });
}

function showGroups(navigate = true) {
    PortfolioApp.resetView();
    if (navigate) history.pushState(null, '', '#projects');
    currentGroup = null;
    currentProject = null;
    renderProjectGroups(portfolioData);
    document.getElementById('projects').scrollIntoView({ behavior: 'smooth' });
}

function showProjectDetail(groupId, projectId, navigate = true) {
    PortfolioApp.resetView();
    const group = portfolioData.projectGroups.find(g => g.id == groupId);
    if (!group) return;

    const project = group.projects.find(p => p.id == projectId);
    if (!project) return;

    currentProject = projectId;
    currentGroup = groupId;
    if (navigate) history.pushState(null, '', `#projects/group/${encodeURIComponent(groupId)}/project/${encodeURIComponent(projectId)}`);
    const container = document.getElementById('projects-grid');
    if (!container) return;

    container.innerHTML = `
        <div style="grid-column:1/-1;">
            <button onclick="showGroup('${groupId}')" class="btn secondary" style="margin-bottom:2rem;">
                <i class="fas fa-arrow-left"></i> Back to ${Credentials.escape(group.name)}
            </button>
        </div>
        <div style="grid-column:1/-1;background:var(--bg-card);padding:2.5rem;border-radius:16px;border:1px solid var(--border-color);">
            <h1 style="font-size:2.5rem;font-weight:800;margin-bottom:0.5rem;">${Credentials.escape(project.title)}</h1>
            <p style="color:var(--text-secondary);font-size:1.1rem;line-height:1.8;">${Credentials.escape(project.description)}</p>
            ${project.technologies ? `
                <div style="margin-top:1.5rem;">
                    <h4 style="margin-bottom:0.5rem;">Technologies</h4>
                    <div style="display:flex;flex-wrap:wrap;gap:0.5rem;">
                        ${project.technologies.map(tech => `<span style="background:var(--bg-primary);padding:0.3rem 1rem;border-radius:50px;font-size:0.9rem;border:1px solid var(--border-color);">${Credentials.escape(tech)}</span>`).join('')}
                    </div>
                </div>
            ` : ''}
            ${project.github || project.demo ? `
                <div style="display:flex;gap:1rem;flex-wrap:wrap;margin-top:1.5rem;">
                    ${project.github ? `<a href="${Credentials.escape(Credentials.url(project.github))}" target="_blank" class="btn-github"><i class="fab fa-github"></i> View on GitHub</a>` : ''}
                    ${project.demo ? `<a href="${Credentials.escape(Credentials.url(project.demo))}" target="_blank" class="btn primary"><i class="fas fa-external-link-alt"></i> Live Demo</a>` : ''}
                </div>
            ` : ''}
        </div>
    `;

    const gallery = document.createElement('div');
    gallery.className = 'project-gallery';
    (project.images || []).forEach((source, index) => {
        const safe = Credentials.url(source, true);
        if (!safe) return;
        const button = document.createElement('button');
        button.className = 'credential-thumbnail';
        button.setAttribute('aria-label', `Enlarge ${project.title} image ${index + 1}`);
        const image = document.createElement('img');
        image.src = safe;
        image.alt = `${project.title} - image ${index + 1}`;
        image.loading = 'lazy';
        button.append(image);
        button.addEventListener('click', () => openCredential({ name: project.title, file: safe }));
        gallery.append(button);
    });
    (project.videos || []).forEach(source => {
        const safe = Credentials.mediaURL(source);
        if (!safe) return;
        const video = document.createElement('video');
        video.src = safe;
        video.controls = true;
        video.preload = 'metadata';
        gallery.append(video);
    });
    if (gallery.childElementCount) container.append(gallery);
    if (project.readme) {
        const detail = document.createElement('article');
        detail.className = 'project-writeup';
        const heading = document.createElement('h2');
        heading.textContent = 'About this project';
        const text = document.createElement('div');
        text.className = 'project-readme';
        text.textContent = project.readme;
        detail.append(heading, text);
        container.append(detail);
    }

    (project.files || []).forEach(file => {
        const source = Credentials.attachmentURL(file.data);
        if (!source) return;
        const link = document.createElement('a');
        link.className = 'btn secondary project-attachment';
        link.textContent = `Download ${file.name || 'project document'}`;
        link.download = file.name || 'project-document';
        link.href = source;
        container.append(link);
    });
    PortfolioApp.renderProjectActions(container, group, project);

    document.getElementById('projects').scrollIntoView({ behavior: 'smooth' });
}

// ============================================
// CONTACT MODES
// ============================================

function initContactModes() {
    const modeButtons = document.querySelectorAll('.contact-mode button');
    if (modeButtons.length === 0) return;

    modeButtons.forEach(btn => {
        btn.addEventListener('click', function() {
            modeButtons.forEach(b => b.classList.remove('active'));
            this.classList.add('active');
            const mode = this.dataset.mode;
            document.getElementById('out-conversation').style.display = mode === 'out' ? 'block' : 'none';
            document.getElementById('in-conversation').style.display = mode === 'in' ? 'block' : 'none';
        });
    });

    // Channel selection
    const channelButtons = document.querySelectorAll('.channel-select button');
    if (channelButtons.length > 0) {
        channelButtons.forEach(btn => {
            btn.addEventListener('click', function() {
                channelButtons.forEach(b => b.classList.remove('active-channel'));
                this.classList.add('active-channel');
            });
        });
    }

    // Out form submit
    const outForm = document.getElementById('out-form');
    if (outForm) {
        outForm.addEventListener('submit', async function(e) {
            e.preventDefault();
            const name = document.getElementById('out-name').value.trim();
            const email = document.getElementById('out-email').value.trim();
            const replyContact = document.getElementById('out-reply-contact').value.trim();
            const rawMessage = document.getElementById('out-message').value.trim();
            const service = document.getElementById('inquiry-service');
            const timeline = document.getElementById('inquiry-timeline').value;
            const budget = document.getElementById('inquiry-budget').value.trim();
            const context = document.getElementById('inquiry-context');
            const details = [`Inquiry: ${service.selectedOptions[0].textContent}`, !context.hidden ? context.textContent : '', timeline ? `Timeline: ${timeline}` : '', budget ? `Budget: ${budget}` : '', replyContact ? `Reply contact: ${replyContact}` : ''].filter(Boolean).join('\n');
            const message = `${details}\n\n${rawMessage}`;
            const feedback = document.getElementById('inquiry-feedback');
            feedback.textContent = 'Sending your inquiry...';
            feedback.dataset.error = 'false';
            const activeChannel = document.querySelector('.channel-select button.active-channel');
            const channel = activeChannel ? activeChannel.dataset.channel : 'email';

            const submit = outForm.querySelector('[type=submit]');
            submit.disabled = true;
            try {
                const response = await PortfolioAPI.fetch(`${API_BASE}/api/contact-out`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ name, email, message, channel })
                });
                const data = await response.json();
                if (data.success) {
                    feedback.textContent = 'Your message is saved. Thank you for reaching out. I will reply using your preferred contact details.';
                    context.hidden = true;
                    outForm.reset();
                } else {
                    throw new Error(data.error || 'Unable to send your inquiry.');
                }
            } catch (error) {
                console.error('Error sending message:', error);
                feedback.textContent = error.message || 'Unable to send your message. Please try again.';
                feedback.dataset.error = 'true';
            } finally { submit.disabled = false; }
        });
    }
}

// ============================================
// CHAT FUNCTIONALITY
// ============================================

function initChat() {
    const chatLoginLink = document.getElementById('chat-login-link');
    const chatRegisterLink = document.getElementById('chat-register-link');
    const chatInput = document.getElementById('chat-input');
    const chatSend = document.getElementById('chat-send');

    if (chatLoginLink) {
        chatLoginLink.addEventListener('click', (e) => {
            e.preventDefault();
            openAuthModal('login');
        });
    }

    if (chatRegisterLink) {
        chatRegisterLink.addEventListener('click', (e) => {
            e.preventDefault();
            openAuthModal('register');
        });
    }

    if (chatSend) {
        chatSend.addEventListener('click', sendChatMessage);
    }

    if (chatInput) {
        chatInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') sendChatMessage();
        });
    }

    // Check if already logged in
    if (visitorToken) {
        loadConversation();
    }
}

// ============================================
// AUTH MODAL
// ============================================

function initAuthModal() {
    const modal = document.getElementById('authModal');
    document.getElementById('closeAuthModal').addEventListener('click', closeAuthModal);
    modal.addEventListener('click', event => { if (event.target === modal) closeAuthModal(); });
    document.getElementById('authForm').addEventListener('submit', async event => {
        event.preventDefault();
        const error = document.getElementById('authError');
        const username = document.getElementById('authUsername').value.trim();
        const password = document.getElementById('authPassword').value;
        const confirmation = document.getElementById('authConfirmPassword').value;
        const submit = document.getElementById('authSubmitBtn');
        error.textContent = '';
        error.classList.remove('show');
        if (authMode === 'register' && (password.length < 6 || password !== confirmation)) {
            error.textContent = password.length < 6 ? 'Use at least 6 characters.' : 'Passwords do not match.';
            error.classList.add('show'); return;
        }
        submit.disabled = true;
        try {
            const response = await PortfolioAPI.fetch(`${API_BASE}/api/visitor-${authMode}`, {
                method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username, password })
            });
            const data = await response.json();
            if (!data.success || !data.token) throw new Error(data.error || 'Unable to sign in.');
            visitorToken = data.token;
            localStorage.setItem('visitorToken', visitorToken);
            closeAuthModal();
            document.getElementById('authForm').reset();
            await loadConversation();
            startChatPolling();
        } catch (failure) { error.textContent = failure.message; error.classList.add('show'); }
        finally { submit.disabled = false; }
    });
    startChatPolling();
}
let authTrigger = null;
function closeAuthModal() {
    document.getElementById('authModal').classList.remove('active');
    authTrigger?.focus();
}
function openAuthModal(mode) {
    authTrigger = document.activeElement;
    authMode = mode;
    document.getElementById('authModal').classList.add('active');
    document.getElementById('authError').classList.remove('show');
    document.getElementById('authModalTitle').textContent = mode === 'login' ? 'Welcome back' : 'Start a conversation';
    document.getElementById('authModalSub').textContent = mode === 'login' ? 'Sign in to your conversation' : 'Create an account to chat with me';
    document.getElementById('authSubmitBtn').textContent = mode === 'login' ? 'Login' : 'Register';
    document.getElementById('confirmPasswordGroup').style.display = mode === 'register' ? 'block' : 'none';
    document.getElementById('authConfirmPassword').required = mode === 'register';
    document.getElementById('authSwitchText').innerHTML = mode === 'login'
        ? 'New here? <button type="button" id="authSwitchLink">Create an account</button>'
        : 'Already registered? <button type="button" id="authSwitchLink">Login</button>';
    document.getElementById('authSwitchLink').addEventListener('click', () => openAuthModal(authMode === 'login' ? 'register' : 'login'));
    document.getElementById('authUsername').focus();
}
function startChatPolling() {
    clearInterval(chatPollInterval);
    if (visitorToken) chatPollInterval = setInterval(() => {
        if (!document.hidden && document.getElementById('in-conversation').style.display !== 'none') loadConversation();
    }, 10000);
}

function togglePasswordVisibility(inputId, btn) {
    const input = document.getElementById(inputId);
    if (input) {
        input.type = input.type === 'password' ? 'text' : 'password';
        btn.querySelector('i').className = input.type === 'password' ? 'fas fa-eye' : 'fas fa-eye-slash';
    }
}

// ============================================
// CHAT MESSAGES
// ============================================

async function loadConversation() {
    if (chatLoading || !visitorToken) return;
    const chatMessages = document.getElementById('chat-messages');
    chatLoading = true;
    try {
        const response = await PortfolioAPI.fetch(`${API_BASE}/api/chat`, { headers: { Authorization: `Bearer ${visitorToken}` } });
        const data = await response.json();
        if (!data.success) throw new Error(data.error || 'Unable to load conversation.');
        currentConversationId = data.conversationId;
        renderChatMessages(data.messages);
        document.getElementById('chat-input').disabled = false;
        document.getElementById('chat-send').disabled = false;
        const status = document.getElementById('chat-auth-status');
        status.replaceChildren(document.createTextNode(`Signed in as ${data.username || 'visitor'}. `));
        const logout = document.createElement('button'); logout.type = 'button'; logout.textContent = 'Sign out';
        logout.addEventListener('click', () => {
            visitorToken = null; localStorage.removeItem('visitorToken'); clearInterval(chatPollInterval);
            currentConversationId = null;
            document.getElementById('chat-input').disabled = true;
            document.getElementById('chat-send').disabled = true;
            chatMessages.textContent = 'Signed out. Login to continue your conversation.';
            status.replaceChildren();
            const login = document.createElement('button'); login.textContent = 'Login to chat'; login.addEventListener('click', () => openAuthModal('login')); status.append(login);
        });
        status.append(logout);
    } catch (error) {
        if ([401, 403].includes(error.status)) {
            visitorToken = null; localStorage.removeItem('visitorToken'); clearInterval(chatPollInterval);
            document.getElementById('chat-input').disabled = true;
            document.getElementById('chat-send').disabled = true;
            document.getElementById('chat-auth-status').textContent = 'Your session expired. Please sign in again.';
            const login = document.createElement('button'); login.textContent = 'Login'; login.addEventListener('click', () => openAuthModal('login')); document.getElementById('chat-auth-status').append(login);
        }
        PortfolioApp.announce(error.message);
    } finally { chatLoading = false; }
}

function renderChatMessages(messages) {
    const chatMessages = document.getElementById('chat-messages');
    if (!chatMessages) return;

    chatMessages.innerHTML = '';
    if (!messages || messages.length === 0) {
        chatMessages.innerHTML = '<p style="color:var(--text-light);text-align:center;padding:1rem;">No messages yet</p>';
        return;
    }

    messages.forEach(msg => {
        const div = document.createElement('div');
        div.className = `chat-message ${msg.sender_type === 'visitor' ? 'visitor' : 'admin'}`;
        div.textContent = msg.message;
        chatMessages.appendChild(div);
    });

    chatMessages.scrollTop = chatMessages.scrollHeight;
}

async function sendChatMessage() {
    const input = document.getElementById('chat-input');
    const send = document.getElementById('chat-send');
    const message = input.value.trim();
    if (!message || !visitorToken || send.disabled) return;
    send.disabled = true;
    try {
        const response = await PortfolioAPI.fetch(`${API_BASE}/api/chat/send`, {
            method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${visitorToken}` }, body: JSON.stringify({ message })
        });
        const data = await response.json();
        if (!data.success) throw new Error(data.error || 'Unable to send message.');
        input.value = '';
        await loadConversation();
    } catch (error) { PortfolioApp.announce(error.message); }
    finally { send.disabled = !visitorToken; }
}

// ============================================
// THEME, MOBILE, SMOOTH SCROLL
// ============================================

const themeToggle = document.getElementById('theme-toggle');
if (themeToggle) {
    themeToggle.addEventListener('click', () => {
        document.body.classList.toggle('dark');
        const isDark = document.body.classList.contains('dark');
        themeToggle.querySelector('i').className = isDark ? 'fas fa-sun' : 'fas fa-moon';
        localStorage.setItem('theme', isDark ? 'dark' : 'light');
    });
}
if (localStorage.getItem('theme') === 'dark') {
    document.body.classList.add('dark');
    if (themeToggle) themeToggle.querySelector('i').className = 'fas fa-sun';
}

const hamburger = document.getElementById('hamburger');
const navLinks = document.getElementById('navLinks');
const navBackdrop = document.getElementById('nav-backdrop');
function setNavigationOpen(open, restoreFocus = false) {
    hamburger?.classList.toggle('active', open);
    hamburger?.setAttribute('aria-expanded', String(open));
    hamburger?.setAttribute('aria-label', open ? 'Close navigation' : 'Open navigation');
    navLinks?.classList.toggle('active', open);
    const overlay = open && window.matchMedia('(max-width: 1200px)').matches;
    document.body.classList.toggle('navigation-open', overlay);
    navBackdrop.hidden = !overlay;
    if (overlay) navLinks?.querySelector('a')?.focus();
    if (restoreFocus) hamburger?.focus();
}
navBackdrop.addEventListener('click', () => setNavigationOpen(false, true));
window.matchMedia('(max-width: 1200px)').addEventListener('change', () => setNavigationOpen(false));
if (hamburger) {
    hamburger.addEventListener('click', () => {
        setNavigationOpen(hamburger.getAttribute('aria-expanded') !== 'true');
    });
}
document.querySelectorAll('.nav-links a, .app-dock a').forEach(link => {
    link.addEventListener('click', () => {
        setNavigationOpen(false);
    });
});

document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', function(e) {
        const href = this.getAttribute('href');
        if (href && href !== '#') {
            e.preventDefault();
            if (href === '#projects') showGroups(false);
            history.pushState(null, '', href);
            const target = document.getElementById(href.slice(1));
            if (target) target.scrollIntoView({ behavior: 'smooth' });
        }
    });
});

function restoreProjectRoute() {
    const parts = location.hash.slice(1).split('/').map(part => {
        try { return decodeURIComponent(part); } catch { return part; }
    });
    if (parts[0] !== 'projects') {
        if (!parts[0]) { currentGroup = null; currentProject = null; PortfolioApp.resetView(); renderProjectGroups(portfolioData); }
        document.getElementById(parts[0])?.scrollIntoView(); return;
    }
    const groups = portfolioData.projectGroups || [];
    const group = parts[1] === 'group' ? groups.find(g => String(g.id) === parts[2]) : null;
    const project = group && parts[3] === 'project' ? (group.projects || []).find(p => String(p.id) === parts[4]) : null;
    if (project) showProjectDetail(group.id, project.id, false);
    else if (group) showGroup(group.id, false);
    else showGroups(false);
}
window.addEventListener('popstate', restoreProjectRoute);
document.addEventListener('keydown', event => {
    if (event.key === 'Tab' && document.body.classList.contains('navigation-open')) {
        const controls = [...navLinks.querySelectorAll('a'), hamburger];
        if (event.shiftKey && document.activeElement === controls[0]) { event.preventDefault(); hamburger.focus(); }
        else if (!event.shiftKey && document.activeElement === hamburger) { event.preventDefault(); controls[0].focus(); }
    }
    const card = event.target.closest?.('.project-card[role="button"]');
    if (card && ['Enter', ' '].includes(event.key)) { event.preventDefault(); card.click(); }
    if (event.key === 'Escape') closeAuthModal();
    if (event.key === 'Tab' && document.getElementById('authModal').classList.contains('active')) {
        const controls = [...document.getElementById('authModal').querySelectorAll('button, input')].filter(element => element.getClientRects().length && !element.disabled);
        const first = controls[0], last = controls.at(-1);
        if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
        else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    }
    if (event.key === 'Escape' && hamburger) {
        if (hamburger.getAttribute('aria-expanded') === 'true') setNavigationOpen(false, true);
    }
});
if ('IntersectionObserver' in window) {
    const observer = new IntersectionObserver(entries => {
        entries.forEach(entry => {
            if (!entry.isIntersecting) return;
            document.querySelectorAll('.nav-links a, .app-dock a').forEach(link => {
                const active = link.hash === `#${entry.target.id}`;
                link.classList.toggle('active', active);
                if (active) link.setAttribute('aria-current', 'location');
                else link.removeAttribute('aria-current');
            });
        });
    }, { rootMargin: '-15% 0px -55% 0px' });
    document.querySelectorAll('section[id]').forEach(section => observer.observe(section));
}

// ============================================
// INIT
// ============================================

document.addEventListener('DOMContentLoaded', () => {
    initContactModes(); initChat(); initAuthModal(); publicUIReady = true;
    loadPublicData();
});
console.log('✅ main.js loaded and ready!');
