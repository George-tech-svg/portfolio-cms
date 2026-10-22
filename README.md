Current deployment: [Vercel frontend](https://portfolio-cms-seven-blush.vercel.app/) + [Render API](https://portfolio-0umz.onrender.com). See [DEPLOYMENT.md](DEPLOYMENT.md) for the current build, environment, and verification instructions.

# 🚀 Personal Portfolio CMS

A **full‑stack portfolio website** with a built‑in Content Management System (CMS).  
It allows you to showcase your projects, skills, experience, certifications, and contact information – all updatable through a clean admin panel.  
The public view is beautifully designed, fully responsive, and optimised for all devices.

🔗 **Live Demo:** [ochiengportfolio.netlify.app](https://ochiengportfolio.netlify.app)

---

## ✨ Features

- **Dynamic Portfolio** – All content (profile, projects, skills, experience, education, certifications, social links) is stored in a database and rendered on the public site.
- **Admin Panel** – Manage every section of your portfolio from a dedicated dashboard – no coding required.
- **Project Management** – Organise projects into groups. Each project can have:
  - Multiple images and videos (uploaded via Cloudinary).
  - A detailed README written in Markdown.
  - File attachments (PDFs, documents, etc.).
  - GitHub and live demo links.
- **Contact System** with two modes:
  - **Out Conversation** – Visitors can send a message via their preferred channel (Email, WhatsApp, or Phone).
  - **In Conversation** – Real‑time chat inside the website (visitors register/login to chat).
- **Skills Management** – Easily add/edit/delete skill categories and individual skills.
- **Modern UI** – Green/blue theme, glassmorphism, animated blobs, dark/light mode toggle.
- **Fully Responsive** – Works perfectly on phones, tablets, and desktops.
- **SEO Friendly** – Meta tags, sitemap, and semantic HTML to help search engines index your portfolio.

---

## 🛠️ Tech Stack

### Frontend
- HTML5, CSS3, JavaScript (vanilla)
- [Font Awesome](https://fontawesome.com/) – Icons
- [Marked](https://marked.js.org/) – Markdown rendering for project READMEs
- Hosted on **Netlify**

### Backend
- Node.js / Express
- PostgreSQL (via Neon)
- Cloudinary – image/video storage
- Hosted on **Render**

---

## 📁 Project Structure

```plaintext
portfolio-cms/
├── css/                 # Stylesheets
├── js/                  # Frontend JavaScript
├── uploads/             # Local uploads (if any)
├── index.html           # Public portfolio
├── admin.html           # Admin panel
├── login.html           # Admin login page
├── register.html        # Admin registration page
├── terms.html           # Terms & Conditions
├── privacy.html         # Privacy Policy
├── server.js            # Backend server
├── package.json         # Node dependencies
└── README.md            # This file