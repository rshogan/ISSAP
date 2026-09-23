// Desktop wrapper for the ISSAP Cyber Redemption web app.
//
// The web app under web/ is untouched by this: it is still a plain static site
// that runs from run.bat in a browser. Electron just gives it its own window,
// a native menu, and an Exit button that can actually close the application.
const { app, BrowserWindow, Menu, protocol, net, shell } = require("electron");
const path = require("node:path");
const { pathToFileURL } = require("node:url");

// Everything the app loads (web/, data/) is served from here. In development
// that is the repo root, one level up from electron/; in an installed build
// electron-builder has copied both folders into resources/ (see extraResources
// in package.json), which is what process.resourcesPath points at.
const ROOT = app.isPackaged ? process.resourcesPath : path.resolve(__dirname, "..");

// The app fetch()es its JSON, which file:// blocks as a cross-origin request,
// and it keeps save slots in localStorage, which needs a real origin. So rather
// than loosening webSecurity, serve the project over a custom scheme that is
// registered as standard + secure -- the renderer then behaves exactly as it
// does under the Python dev server.
const SCHEME = "issap";
const START_URL = `${SCHEME}://app/web/index.html`;

protocol.registerSchemesAsPrivileged([
  {
    scheme: SCHEME,
    privileges: { standard: true, secure: true, supportFetchAPI: true, stream: true },
  },
]);

function registerProtocol() {
  protocol.handle(SCHEME, (request) => {
    const { pathname } = new URL(request.url);
    const filePath = path.join(ROOT, decodeURIComponent(pathname));
    // Anything that resolves outside the project root is somebody walking up
    // the tree with ../ -- refuse it rather than hand back an arbitrary file.
    const relative = path.relative(ROOT, filePath);
    if (relative.startsWith("..") || path.isAbsolute(relative)) {
      return new Response("Forbidden", { status: 403 });
    }
    return net.fetch(pathToFileURL(filePath).toString());
  });
}

function buildMenu(isDev) {
  const viewItems = [
    { role: "reload" },
    { role: "forceReload" },
    { type: "separator" },
    // The quiz frame is sized in vh, so fullscreen and zoom are genuinely
    // useful here rather than boilerplate.
    { role: "togglefullscreen" },
    { type: "separator" },
    { role: "zoomIn", accelerator: "CommandOrControl+=" },
    { role: "zoomOut" },
    { role: "resetZoom" },
  ];
  if (isDev) {
    viewItems.push({ type: "separator" }, { role: "toggleDevTools" });
  }

  return Menu.buildFromTemplate([
    {
      label: "&File",
      submenu: [{ role: "quit", accelerator: "CommandOrControl+Q" }],
    },
    { label: "&View", submenu: viewItems },
  ]);
}

function createWindow() {
  const win = new BrowserWindow({
    width: 1280,
    height: 860,
    minWidth: 900,
    // Below this the quiz frame (72vh, 440px floor) starts losing its sky.
    minHeight: 640,
    title: "ISSAP Cyber Redemption",
    backgroundColor: "#0a0e1c",
    show: false,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  // Painting the first frame before showing avoids a white flash against the
  // app's very dark background.
  win.once("ready-to-show", () => win.show());

  // Nothing in the app opens a window, so treat any attempt as an external
  // link and hand it to the real browser.
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith("http:") || url.startsWith("https:")) shell.openExternal(url);
    return { action: "deny" };
  });

  win.loadURL(START_URL);
  return win;
}

// Two copies of the app would share one localStorage and fight over save slots.
if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on("second-instance", () => {
    const [win] = BrowserWindow.getAllWindows();
    if (!win) return;
    if (win.isMinimized()) win.restore();
    win.focus();
  });

  app.whenReady().then(() => {
    registerProtocol();
    Menu.setApplicationMenu(buildMenu(!app.isPackaged));
    createWindow();

    app.on("activate", () => {
      if (BrowserWindow.getAllWindows().length === 0) createWindow();
    });
  });

  app.on("window-all-closed", () => {
    if (process.platform !== "darwin") app.quit();
  });
}
