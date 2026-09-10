// Background service worker for UniquePass.
// Handles extension installation/update events.

chrome.runtime.onInstalled.addListener(() => {
    console.log("UniquePass Generator installed and ready.");
});
