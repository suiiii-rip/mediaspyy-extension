setTimeout(function() {
  console.log("Hello pageInject.js");
  const title = (<any> navigator).mediaSession?.metadata?.title;
  document.dispatchEvent(new CustomEvent('MediaSpyy_Listener', {
      detail: title
  }));
}, 5000);
