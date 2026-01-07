// ---------------------------------------------------------
// STATE & INIT
// ---------------------------------------------------------
let registry = { skills: [] };

// Initialize
(async () => {
    // Load existing registry from storage using Chrome API
    const data = await getStorage("registry");
    if (data.registry) registry = data.registry;

    // Inject UI
    injectFloatingButton();
})();

// Helper for Chrome Storage (Callback to Promise)
function getStorage(key) {
    return new Promise(resolve => chrome.storage.local.get(key, resolve));
}
function setStorage(obj) {
    return new Promise(resolve => chrome.storage.local.set(obj, resolve));
}

// ---------------------------------------------------------
// UI INJECTION
// ---------------------------------------------------------
function injectFloatingButton() {
    if (document.getElementById('gemini-skill-btn')) return;

    const btn = document.createElement('button');
    btn.id = 'gemini-skill-btn';
    btn.innerHTML = `<span>📂</span> Skills`;
    btn.onclick = openModal;
    document.body.appendChild(btn);
}

// ---------------------------------------------------------
// UI GENERATION
// ---------------------------------------------------------
function renderSkills() {
    const container = document.getElementById('skill-list-container');
    container.innerHTML = '';

    if (registry.skills.length === 0) {
        container.innerHTML = '<div style="text-align:center; color:#aaa; margin-top:20px;">No skills loaded. Click Import to add your Claude folders.</div>';
        return;
    }

    // Group by category
    const grouped = {};
    registry.skills.forEach((skill, index) => {
        const cat = skill.category || 'General';
        if (!grouped[cat]) grouped[cat] = [];
        grouped[cat].push({ ...skill, originalIndex: index });
    });

    // Get all unique categories for the datalist
    const allCategories = Object.keys(grouped).sort();

    // Render Groups
    Object.keys(grouped).sort().forEach(cat => {
        // Category Header
        const catHeader = document.createElement('div');
        catHeader.className = 'skill-category-header';
        catHeader.textContent = cat;
        container.appendChild(catHeader);

        // Skills in this category
        grouped[cat].forEach(skill => {
            const el = document.createElement('div');
            el.className = 'skill-item';

            el.innerHTML = `
        <div class="skill-info">
          <strong>${skill.name}</strong>
          <div class="skill-cat-edit">
            <input type="text" value="${skill.category}" list="cat-options" class="cat-input" data-index="${skill.originalIndex}">
          </div>
        </div>
        <div class="skill-actions">
          <button class="delete-btn" title="Delete Skill">🗑️</button>
          <button class="use-btn" data-content="${encodeURIComponent(skill.content)}">🚀 Use</button>
        </div>
      `;

            // Bind Use Button
            el.querySelector('.use-btn').onclick = () => {
                injectText(skill.content);
                closeModal();
            };

            // Bind Delete Button
            el.querySelector('.delete-btn').onclick = () => deleteSkill(skill.originalIndex);

            // Bind Category Change
            const input = el.querySelector('.cat-input');
            input.onchange = (e) => updateCategory(skill.originalIndex, e.target.value);

            container.appendChild(el);
        });
    });

    // Update/Create Datalist for autocomplete
    let datalist = document.getElementById('cat-options');
    if (!datalist) {
        datalist = document.createElement('datalist');
        datalist.id = 'cat-options';
        document.body.appendChild(datalist);
    }
    datalist.innerHTML = allCategories.map(c => `<option value="${c}">`).join('');
}

async function deleteSkill(index) {
    if (confirm(`Are you sure you want to delete "${registry.skills[index].name}"?`)) {
        registry.skills.splice(index, 1);
        await saveRegistry();
        renderSkills();
    }
}

async function updateCategory(index, newCat) {
    if (!newCat.trim()) newCat = 'General';
    registry.skills[index].category = newCat.trim();
    await saveRegistry();
    renderSkills();
}

function openModal() {
    if (document.getElementById('gemini-skill-modal')) return;

    const modal = document.createElement('div');
    modal.id = 'gemini-skill-modal';
    modal.innerHTML = `
    <div class="skill-modal-content">
      <div class="skill-modal-header">
        <h2>Skill Manager</h2>
        <button class="close-btn">&times;</button>
      </div>
      
      <div id="skill-list-container"></div>

      <div class="skill-modal-footer">
        <label for="skill-import-input" class="skill-btn primary">📂 Import Folder</label>
        <input type="file" id="skill-import-input" webkitdirectory directory multiple>
        
        <button id="skill-export-btn" class="skill-btn">💾 Export JSON</button>
        <div style="flex:1"></div>
        <button id="skill-clear-btn" class="skill-btn bg-red">Clear All</button>
      </div>
    </div>
  `;

    document.body.appendChild(modal);

    // Event Listeners
    modal.querySelector('.close-btn').onclick = closeModal;
    modal.addEventListener('click', (e) => {
        if (e.target === modal) closeModal();
    });

    const importInput = document.getElementById('skill-import-input');
    importInput.addEventListener('change', handleImport);

    document.getElementById('skill-clear-btn').onclick = async () => {
        if (confirm('Clear all skills?')) {
            registry.skills = [];
            await saveRegistry();
            renderSkills();
        }
    };

    document.getElementById('skill-export-btn').onclick = () => {
        const blob = new Blob([JSON.stringify(registry, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'gemini_skills_backup.json';
        a.click();
    };

    renderSkills();
}

function closeModal() {
    const modal = document.getElementById('gemini-skill-modal');
    if (modal) modal.remove();
}

// ---------------------------------------------------------
// LOGIC
// ---------------------------------------------------------
async function handleImport(e) {
    const files = Array.from(e.target.files);
    const skillFiles = files.filter(f => f.name === 'SKILL.md');

    if (skillFiles.length === 0) {
        alert('No SKILL.md files found in this folder!');
        return;
    }

    let addedCount = 0;
    for (const file of skillFiles) {
        const text = await file.text();
        const parts = file.webkitRelativePath.split('/');
        const folderName = parts.length > 1 ? parts[parts.length - 2] : 'Unknown';
        const category = parts.length > 2 ? parts[0] : 'General';

        if (!registry.skills.find(s => s.name === folderName)) {
            registry.skills.push({
                name: folderName,
                content: text,
                category: category
            });
            addedCount++;
        }
    }

    await saveRegistry();
    renderSkills();
    alert(`Imported ${addedCount} new skills!`);
}

async function saveRegistry() {
    await setStorage({ registry });
}

function injectText(text) {
    const inputField = document.querySelector('div[contenteditable="true"]') ||
        document.querySelector('textarea[aria-label="Prompt"]');

    if (inputField) {
        inputField.focus();
        const formattedText = `[Activating Skill Instructions]\n\n${text}\n\n[Skill Loaded. Please acknowledge.]`;
        document.execCommand('insertText', false, formattedText);
    } else {
        alert('Could not find the chat input box! Please make sure you are in a chat.');
    }
}
