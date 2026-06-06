## MODIFIED Requirements

### Requirement: Tasks are created only when generation starts
The system SHALL create an image task record via `desktop.imageTask.submit()` only after the user explicitly starts a generation flow, not when images are merely imported. The task lifecycle is managed by the Main Process image task controller.

#### Scenario: Import images without starting generation
- **WHEN** the user imports one or more images into a page
- **THEN** no image task is created
- **AND** the imported batch (with persisted disk paths) remains available as the current page input

#### Scenario: Start generation with an imported batch
- **WHEN** the user clicks the generation start action for a feature with a valid persisted batch
- **THEN** the system calls `desktop.imageTask.submit()` with the feature, image paths, and parameters
- **AND** the Main Process creates a task in the image task controller queue
- **AND** the frontend receives a task ID and subscribes to status updates via `desktop.imageTask.onStatus()`

### Requirement: Task records include import and output history
The system SHALL track image task status through real-time events and persist output artifacts via the Main Process artifact store. The frontend SHALL display task progress and results based on status events.

#### Scenario: Complete generation successfully
- **WHEN** the image task controller reports a completed task via `image-task:status` event
- **THEN** the frontend updates the task status to completed
- **AND** the generated output images (from the artifact store) are displayed in the result component
- **AND** the user can download individual output images

#### Scenario: Generation fails after task creation
- **WHEN** the image task controller reports a failed task via `image-task:status` event
- **THEN** the frontend updates the task status to failed
- **AND** the error message from the status event is displayed to the user
- **AND** the task retains its input image references for retry

#### Scenario: Task is still running
- **WHEN** the image task is in progress (queued or running)
- **THEN** the frontend displays an appropriate progress indicator
- **AND** the status updates in real-time as events arrive
