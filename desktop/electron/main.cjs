/** FILE DEVELOPED FOR THE UWA CITS3200 PROFESSIONAL COMPUTING PROJECT
 * AS UNDERTAKEN BY GROUP 15:
 * HOGAN TAN, IVY QI, SUHRID MAHMOOD PUSHAN, TASVEER MANN, WENBO ZHONG,
 * RUAN VAN ZYL
 *
 * File Function:
 * Electron main process for the Windows desktop build. When packaged, it
 * stores all app data in a data folder next to OsteoPlot.exe so the app can run
 * from a USB stick or shared folder. It serves the built dist folder through a
 * privileged app:// scheme (with a path check so nothing outside dist is read),
 * opens the main window, and sends external links to the default browser.
 *
 * Plain CommonJS, not bundled: Electron loads this file directly.
 */

const { app, BrowserWindow, protocol, net, shell } = require('electron');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

if (app.isPackaged) {
  app.setPath("userData", path.join(path.dirname(process.execPath), "data"));
}

protocol.registerSchemesAsPrivileged([
  { scheme: 'app', privileges: { standard: true, secure: true, supportFetchAPI: true } },
]);

/** Folder holding the built web app (output of vite build). */
const dist = path.join(__dirname, '..', 'dist');

/** Opens the main OsteoPlot window and routes external links to the system browser. */
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
