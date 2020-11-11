chrome.runtime.onMessage.addListener(msg => 
                                     console.log(`Message received ${JSON.stringify(msg)}`));
