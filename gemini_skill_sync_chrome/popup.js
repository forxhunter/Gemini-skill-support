let registry = { skills: [], groups: {} };

chrome.storage.local.get("registry", (data) => {
    if (data.registry) registry = data.registry;
    render();
});

document.getElementById('import-input').addEventListener('change', async (e) => {
    const files = Array.from(e.target.files);
    const skillFiles = files.filter(f => f.name === 'SKILL.md');

    for (const file of skillFiles) {
        const text = await file.text();
        const folderName = file.webkitRelativePath.split('/')[0];
        if (!registry.skills.find(s => s.name === folderName)) {
            registry.skills.push({ name: folderName, content: text, category: 'General' });
        }
    }
    save();
});

function render() {
    const container = document.getElementById('skill-list');
    container.innerHTML = '';

    registry.skills.forEach((skill, index) => {
        const card = document.createElement('div');
        card.className = 'skill-card';
        card.innerHTML = `
      <div class="skill-header">
        <strong>${skill.name}</strong>
        <button class="btn-use" style="padding: 2px 8px; cursor:pointer;">🚀 Use</button>
      </div>
      <div style="display:flex; justify-content: space-between; align-items:center;">
        <span class="cat-tag">${skill.category}</span>
        <select class="cat-select" data-index="${index}">
          <option value="General">General</option>
          <option value="Biology">Biology</option>
          <option value="Finance">Finance</option>
          <option value="Code">Code</option>
        </select>
      </div>
    `;

        card.querySelector('.btn-use').onclick = () => activateInGemini(skill);
        card.querySelector('.cat-select').value = skill.category;
        card.querySelector('.cat-select').onchange = (e) => {
            registry.skills[index].category = e.target.value;
            save();
        };
        container.appendChild(card);
    });
}

async function activateInGemini(skill) {
    chrome.tabs.query({ url: "*://gemini.google.com/*" }, (tabs) => {
        let targetTab = tabs[0];
        if (!targetTab) {
            chrome.tabs.create({ url: "https://gemini.google.com" }, (newTab) => {
                // Must wait for load, simple timeout for MVP
                setTimeout(() => {
                    chrome.tabs.sendMessage(newTab.id, { action: "inject", content: skill.content });
                }, 4000);
            });
        } else {
            chrome.tabs.update(targetTab.id, { active: true });
            chrome.tabs.sendMessage(targetTab.id, { action: "inject", content: skill.content });
        }
    });
}

document.getElementById('export-btn').onclick = () => {
    const blob = new Blob([JSON.stringify(registry)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'skill_registry_backup.json';
    a.click();
};

function save() {
    chrome.storage.local.set({ registry }, () => {
        render();
    });
}
