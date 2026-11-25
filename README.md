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
