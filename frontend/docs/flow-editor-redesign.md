# Conversation flow editor

The create/build routes now use `WAFlowEditor` for canvas and workspace interactions. `whatsappFlows.jsx` retains API persistence, step configuration forms, validation, simulation and versions. The inbox is not changed.

## Design direction

Keep the Madhura navy, paper and yellow selection palette. Energy 2, rhythm 2, motion 1. Workflow interaction conventions inform the editor; the product retains its own palette and WhatsApp configuration model. Compact action tiles replace large message-preview cards. Customer message content is edited in the inspector and reviewed in the conversation preview. The dot grid supports placement and snapping. Icons distinguish message, data, input, routing and terminal actions; user-selected step colors support visual grouping.

## Editing

- Add a step from the searchable library by clicking or dragging it onto the canvas.
- Click an output, then a destination input or tile to connect them. An output can also add a connected step directly.
- Select a wire to change its destination or remove it. Connection selectors in the inspector provide a keyboard and touch alternative to canvas ports.
- Drag tiles to reposition them. Shift-select or drag a selection rectangle for group movement, duplication and deletion.
- Alt-drag or choose the hand tool to pan. Use the zoom controls, fit action, arrange action and minimap for navigation.
- Customize display names, notes and step colors. Configure behavior with the existing action-specific forms or apply validated configuration JSON.
- Copy/paste operates within the editor. Duplicate operations remap connections between copied steps and clear links to steps outside the copied selection. Deletion clears incoming connections.
- Export/import flow JSON. Imports validate node types, unique keys, metadata shape and connection targets, then remain unsaved until explicitly saved.
- Save a draft or publish through the existing APIs. Blocking issues open the validation panel. Failed graph loads prevent saving over an existing conversation.
- Preview starts with the current graph when opened. Simulation errors are visible. Loading another flow cannot overwrite the newer graph with an older response.

## Validation

Runtime server rendering covers the editor shell, graph tiles, connections and minimap. Graph checks cover copied internal links, deletion cleanup and valid JSON import. The reported `Map` constructor crash was caused by importing the Lucide icon with the same name as the JavaScript constructor; the icon is now named `MapIcon`.

Production compilation and lint are checked separately. An interactive browser tool is unavailable in this session, so pointer gestures, narrow-screen rendering and authenticated backend execution are not claimed as browser-verified. No live WhatsApp messages were sent during validation.
