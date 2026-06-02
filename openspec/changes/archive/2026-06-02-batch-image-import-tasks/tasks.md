## 1. Batch Import Infrastructure

- [x] 1.1 Define shared batch/task types for imported images, task records, and storage metadata.
- [x] 1.2 Add Electron preload/main APIs for saving imported files, saving generated outputs, and reading/writing persisted task records.
- [x] 1.3 Implement shared batch import utilities or hooks that support drag-and-drop, focused paste, multi-file selection, and a 4-image limit.

## 2. Page Integration

- [x] 2.1 Replace single-image upload state in `StickerGen` with current-batch image collections across all upload areas.
- [x] 2.2 Replace single-image upload state in `ProductProcessing` with current-batch image collections across all upload areas.
- [x] 2.3 Ensure each page renders all imported images for the active batch and validates required inputs before generation starts.

## 3. Task Tracking

- [x] 3.1 Expand task creation so clicking "开始生成" creates a persisted task with batch ID, pending/running status, and import records.
- [x] 3.2 Update simulated generation completion/failure flows to save output records locally and transition task status to completed or failed.
- [x] 3.3 Update the Profile task manager to read persisted task data and display batch-aware task records.

## 4. Validation

- [x] 4.1 Add or update tests for batch import limits, task creation timing, and task state transitions where practical.
- [x] 4.2 Run renderer validation and verify Electron code compiles with the new preload/main APIs.
