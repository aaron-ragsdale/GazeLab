# GazeLab

[**Launch GazeLab →**](https://aaron-ragsdale.github.io/GazeLab/)

An experimental, browser-based eye tracking and gaze estimation playground. Uses MediaPipe Face Landmarker to extract eye and iris features locally, then fits a personalized ridge regression for screen gaze.

## Quick start

1. Open the app in desktop Chrome or Edge and start the camera and model. Allow camera access.
2. Choose 1080p initially and sit at a comfortable laptop distance with even lighting.
3. Explore raw iris position and eye openness in the live plots.
4. Run 9-point fullscreen calibration, then validate using separate target positions. Keep the camera and display arrangement unchanged.
5. Start recording and choose the same full display used for calibration when prompted. Browser-tab and window captures may not align with screen coordinates.
6. Stop recording and download the desired files.
7. For replay, load the original screen video and session JSON, then adjust the overlay time offset if needed.

## Exports

- Screen, webcam, green-screen gaze overlay, and combined screen/gaze videos (optional, silent; WebM or MP4 depending on browser support).
- gaze_data.csv: timestamped raw eye features, head orientation proxies, validity, and estimated gaze.
- session.json: samples, calibration, display dimensions and recorder start offsets.
- calibration.json: fitted calibration coefficients.

The green overlay can be chroma-keyed in a video editor. The replay panel can render the gaze directly over the original screen video. Recordings use a common performance clock but are not hardware synchronized; validate timing for research.

## Privacy and limitations

Camera frames and recordings are processed on-device and are not uploaded by the app. Initial use fetches the MediaPipe runtime and model from external CDNs. Calibration is stored in localStorage. Recording data stays in browser memory until downloaded; use short initial sessions.

Gaze estimates are experimental, not research-grade fixation measurements. Calibration depends on camera placement, display geometry, lighting and posture. The app rejects closed eyes and very small irises using simple heuristics. A missing prediction means no valid estimate, not absence of attention. Validate accuracy and timing independently, and obtain informed consent before recording participants.

## Hosting

Static HTML/JavaScript, no server or API key. GitHub Pages serves index.html from the main branch root. Camera and screen capture require HTTPS, browser support and explicit permission.


## GazeLab Desktop (Electron preview)

The existing GitHub Pages app remains available. The desktop application shares its interface, calibration, MediaPipe worker and export code. It disables Chromium background throttling, uses explicit camera permissions and a desktop screen/window selection dialog, and prevents app suspension while open (not system sleep).

### Run on macOS

Install a supported Node.js LTS release from https://nodejs.org/ (Intel/x64 for an Intel Mac). In Terminal:

```sh
git clone https://github.com/aaron-ragsdale/GazeLab.git
cd GazeLab
npm install
npm run check
npm start
```

If you already cloned the repo, use git pull instead of cloning. Allow camera and screen recording under System Settings > Privacy & Security if prompted; macOS may require restarting GazeLab after changing screen recording permissions. The app uses a private loopback-only static asset server on port 47831 internally to provide a stable local origin for calibration storage. No separate web server command is needed. The port must be free.

### First test: background reliability

Start camera/model, then click Start 30-second test in Desktop background benchmark. Spend about 10 seconds with GazeLab focused, 10 seconds working in a different app, and 10 seconds with GazeLab minimized. Restore the app and compare foreground/background sample rates, valid sample percentage and observed inter-sample gaps. Export the benchmark CSV for analysis. Minimized and unfocused samples are combined in the background group. Compare both worker and main-thread processing. These results measure delivery of landmark samples, not gaze accuracy or recording synchronization.

Next, calibrate in fullscreen, validate on separate targets, and try a short screen + webcam recording while switching apps. Check actual video duration and CSV timestamp gaps before longer sessions.

### Package for macOS

```sh
npm run build:mac       # Intel x64
npm run build:mac:arm   # Apple Silicon arm64
```

Build output goes to dist/. The preview is not signed or notarized for public distribution; use npm start for development. No DMG has been built or tested yet. The runtime and model still download from external hosts; fully offline assets, native file/session management, a system-wide gaze overlay, and native Swift capture are later work. Recording stays in memory until downloaded. Electron does not make the gaze estimator inherently more accurate.

### Desktop architecture

- desktop/main.cjs: local asset delivery, secure renderer, media permissions, desktop source picker, background settings.
- package.json: Electron dependencies, startup and packaging scripts.
- index.html and gaze-worker.js: shared gaze estimation pipeline and recording interface.
- Next: native SwiftUI / AVFoundation / Core ML prototype, measured against this Electron baseline.
