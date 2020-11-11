var s = document.createElement('script');
s.src = chrome.extension.getURL('js/pageInject.js');
(document.head||document.documentElement).appendChild(s);
s.onload = function() {
    s.remove();
};

document.addEventListener('MediaSpyy_Listener', function(e: any) {

    console.log(`Received message from page: ${JSON.stringify(e.detail)}`);
    
    chrome.runtime.sendMessage({title: e.detail});
});
