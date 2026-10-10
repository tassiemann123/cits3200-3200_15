const { app, BrowserWindow, protocol, net, shell } = require('electron');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

if (app.isPackaged) {
  app.setPath("userData", path.join(path.dirname(process.execPath), "data"));
}

protocol.registerSchemesAsPrivileged([
  { scheme: 'app', privileges: { standard: true, secure: true, supportFetchAPI: true } },
]);

const dist = path.join(__dirname, '..', 'dist');

function createWindow() {
  const win = new BrowserWindow({
    width: 1440,
    height: 900,
    autoHideMenuBar: true,
    minWidth: 1000,
    minHeight: 700,
    webPreferences: { contextIsolation: true },
  });
  win.loadURL('app://osteoplot/index.html');
  win.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });
}

app.whenReady().then(() => {
  protocol.handle('app', (request) => {
    const { pathname } = new URL(request.url);
    const requested = pathname === '/' ? '/index.html' : decodeURIComponent(pathname);
    const file = path.normalize(path.join(dist, requested));
    if (!file.startsWith(dist)) return new Response('Forbidden', { status: 403 });
    return net.fetch(pathToFileURL(file).toString());
  });
  createWindow();
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
