/* Public website integration for the Silvateralink content API.
   Set window.SILVERALINK_API_BASE before this file if the API has another origin. */
(() => {
  const configuredBase = window.SILVERALINK_API_BASE || document.querySelector('meta[name="silvateralink-api-base"]')?.content || window.location.origin;
  const base = configuredBase.replace(/\/$/, '');
  const api = path => base + path;
  const setText = (selector, value) => {
    const node = document.querySelector(selector);
    if (node && typeof value === 'string' && value.trim()) node.textContent = value;
  };
  async function loadContent() {
    try {
      const response = await fetch(api('/api/public/content'));
      if (!response.ok) return;
      const data = await response.json();
      const c = data.content || {};
      setText('#home > div > div > div:first-child > p:nth-of-type(1)', c.hero_subtitle);
      setText('#home > div > div > div:first-child > p:nth-of-type(2)', c.hero_description);
      setText('#home .font-heading.font-bold.text-lg', c.company_slogan);
      setText('#projects blockquote', c.project_intro);
      const pageFields = [
        ['#about h2', c.about_heading],
        ['#about .grid.lg\\:grid-cols-12 > div:first-child > p.text-lg', c.about_intro],
        ['#about .grid.lg\\:grid-cols-12 > div:first-child > p.text-slate-600', c.about_detail],
        ['#about h4', c.about_highlight_title],
        ['#about .grid.lg\\:grid-cols-12 > div:first-child > div p', c.about_highlight_text],
        ['#services h2', c.services_heading], ['#services h2 + p', c.services_intro],
        ['#expertise h2', c.expertise_heading], ['#expertise h2 + p', c.expertise_intro],
        ['#approach h2', c.approach_heading], ['#approach h2 + p', c.approach_intro],
        ['#team h2', c.team_heading], ['#team h3', c.director_name],
        ['#team .text-brand-400.text-xs.font-semibold', c.director_role],
        ['#team blockquote', c.director_bio], ['#team h4', c.team_notice_title],
        ['#team .max-w-4xl.bg-slate-50 p', c.team_notice_text],
        ['#profile h2', c.profile_heading],
        ['footer .md\\:col-span-5 p.text-slate-400.text-sm', c.footer_description]
      ];
      pageFields.forEach(([selector, value]) => setText(selector, value));
      if (typeof c.seo_title === 'string' && c.seo_title) document.title = c.seo_title;
      if (typeof c.seo_description === 'string' && c.seo_description) {
        let meta = document.querySelector('meta[name="description"]');
        if (!meta) { meta = document.createElement('meta'); meta.name = 'description'; document.head.appendChild(meta); }
        meta.content = c.seo_description;
      }
      if (typeof c.seo_keywords === 'string' && c.seo_keywords) {
        let meta = document.querySelector('meta[name="keywords"]');
        if (!meta) { meta = document.createElement('meta'); meta.name = 'keywords'; document.head.appendChild(meta); }
        meta.content = c.seo_keywords;
      }
      if (typeof c.og_image === 'string' && c.og_image) {
        let meta = document.querySelector('meta[property="og:image"]');
        if (!meta) { meta = document.createElement('meta'); meta.setAttribute('property', 'og:image'); document.head.appendChild(meta); }
        meta.content = c.og_image;
      }
      if (c.contact && typeof c.contact === 'object') {
        if (c.contact.phone) document.querySelectorAll('a[href^="tel:"]').forEach(node => { node.href = 'tel:' + c.contact.phone.replace(/[^+0-9]/g, ''); node.textContent = c.contact.phone; });
        if (c.contact.email) document.querySelectorAll('a[href^="mailto:"]').forEach(node => { node.href = 'mailto:' + c.contact.email; node.textContent = c.contact.email; });
        if (c.contact.location) {
          const location = document.querySelector('#contact .text-slate-600.text-sm');
          if (location) location.textContent = c.contact.location;
        }
      }
      if (typeof c.welcome_message === 'string' && c.welcome_message) {
        let banner = document.getElementById('sl-welcome-message');
        if (!banner) {
          banner = document.createElement('div');
          banner.id = 'sl-welcome-message';
          banner.className = 'bg-emerald-50 text-emerald-900 text-center px-4 py-3 text-sm font-medium border-b border-emerald-100';
          document.querySelector('#navbar')?.insertAdjacentElement('afterend', banner);
        }
        banner.textContent = c.welcome_message;
      }
      if (Array.isArray(data.activities) && data.activities.length) {
        const grid = document.querySelector('#projects .grid.md\\:grid-cols-2.lg\\:grid-cols-4');
        if (grid) {
          const cards = data.activities.map(item => {
            const card = document.createElement('article');
            card.className = 'bg-white rounded-3xl overflow-hidden border border-slate-200 shadow-sm hover:shadow-md transition group';
            const wrap = document.createElement('div'); wrap.className = 'h-40 overflow-hidden';
            const img = document.createElement('img');
            img.src = item.image_url || 'https://images.unsplash.com/photo-1441974231531-c6227db76b6e?q=80&w=800&auto=format&fit=crop';
            img.alt = item.title; img.className = 'w-full h-full object-cover';
            wrap.appendChild(img);
            const body = document.createElement('div'); body.className = 'p-6';
            const title = document.createElement('h3'); title.className = 'font-heading font-bold text-slate-900 text-lg mb-2'; title.textContent = item.title;
            const summary = document.createElement('p'); summary.className = 'text-slate-600 text-xs leading-relaxed'; summary.textContent = item.summary;
            body.append(title, summary); card.append(wrap, body); return card;
          });
          grid.replaceChildren(...cards);
        }
      }
    } catch (error) { console.warn('Silvateralink content could not be loaded:', error.message); }
  }
  window.handleFormSubmit = async function(event) {
    event.preventDefault();
    const form = document.getElementById('inquiry-form');
    const button = form?.querySelector('button[type="submit"]');
    const val = id => document.getElementById(id)?.value?.trim() || '';
    const payload = { full_name:val('form-name'),organization:val('form-org'),email:val('form-email'),phone:val('form-phone'),service:val('form-service'),message:val('form-message') };
    if (button) { button.disabled = true; button.querySelector('span').textContent = 'Sending...'; }
    try {
      const response = await fetch(api('/api/public/inquiries'), { method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload) });
      const data = await response.json().catch(()=>({}));
      if (!response.ok) throw new Error(data.error || 'Your inquiry could not be sent.');
      document.getElementById('modal-backdrop')?.classList.remove('hidden'); form.reset();
    } catch (error) { alert(error.message + ' You can also contact us directly by phone or email.'); }
    finally { if (button) { button.disabled = false; button.querySelector('span').textContent = 'Send Inquiry'; } }
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', loadContent);
  else loadContent();
})();