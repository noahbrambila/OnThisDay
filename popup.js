let allEvents = [];
let imageHTML = "";
let currentEvents = [];

function pickRandomFive() {
  const shuffled = [...allEvents].sort(() => 0.5 - Math.random());
  return shuffled.slice(0, 5);
}

function render(events) {
  const list = events.map(event => {
    // Link to the first related Wikipedia page if available
    let content = `<strong>${event.year}</strong> — ${event.text}`;
    
    if (event.pages && event.pages[0] && event.pages[0].content_urls && event.pages[0].content_urls.desktop) {
      const url = event.pages[0].content_urls.desktop.page;
      content = `<a href="${url}" target="_blank" rel="noopener noreferrer">${content}</a>`;
    }
    
    return `<li title="${event.text}">${content}</li>`;
  }).join("");

  const today = new Date();
  const monthNames = ["January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December"];
  const dateStr = `${monthNames[today.getMonth()]} ${today.getDate()}`;

  document.getElementById("content").innerHTML = `
    <h2>On this day (${dateStr})</h2>
    ${imageHTML}
    <ul>${list}</ul>
    <small>Source: Wikipedia (CC BY-SA)</small>
  `;
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
      [`image_${dateKey}`]: imageHTML,
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
      return { events: null, image: null, allEvents: null };
    }
    
    const today = new Date();
    const dateKey = `${today.getMonth()}-${today.getDate()}`;
    
    const result = await chrome.storage.local.get([
      `events_${dateKey}`,
      `image_${dateKey}`,
      `allEvents_${dateKey}`
    ]);
    
    return {
      events: result[`events_${dateKey}`],
      image: result[`image_${dateKey}`],
      allEvents: result[`allEvents_${dateKey}`]
    };
  } catch (error) {
    console.error("Error loading state:", error);
    return { events: null, image: null, allEvents: null };
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
      imageHTML = saved.image || "";
      
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

      // Optional thumbnail image
      const withImage = allEvents.find(
        e => e.pages && e.pages[0] && e.pages[0].thumbnail
      );

      if (withImage) {
        imageHTML = `<img src="${withImage.pages[0].thumbnail.source}" alt="Historical image">`;
        console.log("Image found");
      }

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
    container.innerHTML = `<div class="error">Unable to load On This Day content.<br><small>${error.message}</small></div>`;
  }
})();
