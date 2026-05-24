// Compatibility shim for server-side visible rebrand.
// The core v2 app still lives at /v2/kinspan-app.js. The HTML branding pass may
// rewrite the visible script path to /v2/longevitree-app.js, so this file loads
// the real app script synchronously while the document is still parsing.
document.write('<script src="/v2/kinspan-app.js"><\/script>');
