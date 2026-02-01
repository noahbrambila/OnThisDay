let allEvents = [];
let currentEvents = [];

function pickRandomFive() {
  const shuffled = [...allEvents].sort(() => 0.5 - Math.random());
  return shuffled.slice(0, 5);
}

function render(events) {
  const list = events.map(event => {
    let textContent = `<strong>${event.year}</strong> — ${event.text}`;
    let imageHTML = '';
    let linkUrl = '';
    
    // Get image and link from the event's pages
    if (event.pages && event.pages[0]) {
      const page = event.pages[0];
      
      // Get the Wikipedia page URL
      if (page.content_urls && page.content_urls.desktop) {
        linkUrl = page.content_urls.desktop.page;
      }
      
      // Get the thumbnail image
      if (page.thumbnail && page.thumbnail.source) {
        imageHTML = `
          <div class="event-image-container">
            <img src="${page.thumbnail.source}" alt="${page.title || 'Historical image'}">
            <button class="expand-btn" title="${chrome.i18n.getMessage("expandImage")}">+</button>
          </div>
        `;
      }
    }
    
    // Wrap text in link if available
    if (linkUrl) {
      textContent = `<a href="${linkUrl}" target="_blank" rel="noopener noreferrer">${textContent}</a>`;
    }
    
    return `
      <li title="${event.text}">
        <div class="event-content">
          <div class="event-text">${textContent}</div>
          ${imageHTML}
        </div>
      </li>
    `;
  }).join("");

  const today = new Date();
  const dateStr = new Intl.DateTimeFormat(chrome.i18n.getUILanguage(), {
    month: 'long',
    day: 'numeric'
  }).format(today);

  document.getElementById("content").innerHTML = `
    <h2>${chrome.i18n.getMessage("onThisDay")} (${dateStr})</h2>
    <ul>${list}</ul>
    <small>${chrome.i18n.getMessage("source")}</small>
  `;
  
  // Add expand button functionality for all images
  const expandBtns = document.querySelectorAll(".expand-btn");
  expandBtns.forEach(btn => {
    btn.onclick = (e) => {
      e.preventDefault();
      e.stopPropagation();
      const container = btn.closest(".event-image-container");
      container.classList.toggle("expanded");
      btn.textContent = container.classList.contains("expanded") ? "−" : "+";
      btn.title = container.classList.contains("expanded") ? chrome.i18n.getMessage("collapseImage") : chrome.i18n.getMessage("expandImage");
    };
  });
}

async function saveCurrentState() {
  try {
    if (!chrome?.storage?.local) {
      console.log("Storage API not available");
      return;
    }
    
    const today = new Date();
    const dateKey = `${today.getMonth()}-${today.getDate()}`;
    
    await chrome.storage.local.set({
      [`events_${dateKey}`]: currentEvents,
      [`allEvents_${dateKey}`]: allEvents
    });
  } catch (error) {
    console.error("Error saving state:", error);
  }
}

async function loadSavedState() {
  try {
    if (!chrome?.storage?.local) {
      console.log("Storage API not available");
      return { events: null, allEvents: null };
    }
    
    const today = new Date();
    const dateKey = `${today.getMonth()}-${today.getDate()}`;
    
    const result = await chrome.storage.local.get([
      `events_${dateKey}`,
      `allEvents_${dateKey}`
    ]);
    
    return {
      events: result[`events_${dateKey}`],
      allEvents: result[`allEvents_${dateKey}`]
    };
  } catch (error) {
    console.error("Error loading state:", error);
    return { events: null, allEvents: null };
  }
}

(async function () {
  const container = document.getElementById("content");
  const regenBtn = document.getElementById("regen");

  try {
    console.log("Starting extension load...");
    
    // Dynamic date (works every day)
    const today = new Date();
    const month = today.getMonth() + 1; // 1–12
    const day = today.getDate();        // 1–31
    console.log(`Date: ${month}/${day}`);

    // Check if we have saved data for today
    console.log("Checking for saved state...");
    const saved = await loadSavedState();
    console.log("Saved state:", saved);
    
    if (saved.events && saved.allEvents) {
      // Use saved data
      console.log("Using saved data");
      currentEvents = saved.events;
      allEvents = saved.allEvents;
      
      render(currentEvents);
      regenBtn.disabled = false;
    } else {
      // Fetch fresh data
      console.log("Fetching fresh data...");
      const url = `https://api.wikimedia.org/feed/v1/wikipedia/en/onthisday/events/${month}/${day}`;
      console.log("URL:", url);

      const response = await fetch(url);
      console.log("Response status:", response.status);
      if (!response.ok) throw new Error(`Fetch failed with status ${response.status}`);

      const data = await response.json();
      console.log("Data received:", data);
      if (!data.events || data.events.length === 0)
        throw new Error("No events returned");

      allEvents = data.events;
      console.log("All events count:", allEvents.length);

      currentEvents = pickRandomFive();
      console.log("Current events selected:", currentEvents.length);
      render(currentEvents);
      
      // Save the initial state
      console.log("Saving state...");
      await saveCurrentState();
      console.log("State saved");
      
      regenBtn.disabled = false;
    }

    // Fade effect on regenerate
    regenBtn.onclick = async () => {
      const ul = document.querySelector("ul");
      if (!ul) return;

      ul.classList.add("fade");

      setTimeout(async () => {
        currentEvents = pickRandomFive();
        render(currentEvents);
        
        // Save new selection
        await saveCurrentState();
        
        const newUl = document.querySelector("ul");
        newUl.classList.remove("fade");
      }, 250);
    };

  } catch (error) {
    console.error("ERROR:", error);
    console.error("Error stack:", error.stack);
    container.innerHTML = `<div class="error">${chrome.i18n.getMessage("errorLoading")}<br><small>${error.message}</small></div>`;
  }
})();
