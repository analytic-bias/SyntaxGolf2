
```bash
npm i
sudo npm i -g watchify
watchify index.js -p esmify -o bundle.js --debug
```

then serve index.html

TODO
https://github.com/cytoscape/cytoscape.js-compound-drag-and-drop
Do drag and drop with multi-selection (mouse and touch), with dragging out of parent to form next step.

```javascript
minZoom: 1e-50,
maxZoom: 1e50,
zoomingEnabled: true,
userZoomingEnabled: true,
panningEnabled: true,
userPanningEnabled: true,
boxSelectionEnabled: true,
selectionType: 'single',
touchTapThreshold: 8,
desktopTapThreshold: 4,
autolock: false,
autoungrabify: false,
autounselectify: false,
multiClickDebounceTime: 250,
```
