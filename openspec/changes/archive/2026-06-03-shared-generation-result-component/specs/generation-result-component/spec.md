## ADDED Requirements

### Requirement: GenerationResult component renders header with title and optional count
The `GenerationResult` component SHALL render a header section displaying the title text and an optional completion count.

#### Scenario: Default title display
- **WHEN** `GenerationResult` is rendered with no `title` prop
- **THEN** the header displays "生成结果"

#### Scenario: Custom title with count
- **WHEN** `GenerationResult` is rendered with `title="生成结果"` and `count={4}` and `showCount={true}`
- **THEN** the header displays "生成结果 (4)"

#### Scenario: Download all button visible
- **WHEN** `GenerationResult` is rendered with `showDownloadAll={true}` and `state="completed"` and `results.length > 0`
- **THEN** a "全部下载" button appears in the header right area

### Requirement: GenerationResult renders empty state with description
The `GenerationResult` component SHALL render an empty state area when `state` is `"empty"`, showing only the description text.

#### Scenario: Empty state with description
- **WHEN** `GenerationResult` is rendered with `state="empty"` and `emptyDescription="请在左侧上传图片"`
- **THEN** the content area displays the text "请在左侧上传图片" centered

#### Scenario: Empty state without description
- **WHEN** `GenerationResult` is rendered with `state="empty"` and no `emptyDescription`
- **THEN** the content area is empty

### Requirement: GenerationResult renders multi-image grid in multi mode
The `GenerationResult` component SHALL render a 2-column grid of result cards when `mode` is `"multi"` and `state` is `"completed"`.

#### Scenario: Multi-image grid display
- **WHEN** `GenerationResult` is rendered with `mode="multi"`, `state="completed"`, and `results` containing 4 items
- **THEN** a 2-column grid is rendered with 4 image cards, each with `aspect-square` aspect ratio

#### Scenario: Multi-image card hover shows download button
- **WHEN** the user hovers over a result card in multi mode
- **THEN** a download overlay appears on the card

### Requirement: GenerationResult renders single large image in single mode
The `GenerationResult` component SHALL render a single large centered image when `mode` is `"single"` and `state` is `"completed"`.

#### Scenario: Single image display
- **WHEN** `GenerationResult` is rendered with `mode="single"`, `state="completed"`, and `results` containing 1 item
- **THEN** a single image is rendered in a `max-w-lg aspect-video` container, centered

#### Scenario: Single image shows badge
- **WHEN** a result item has a `badge` property set to `"Completed"`
- **THEN** the badge "Completed" is displayed on the image card

### Requirement: GenerationResult supports headerRight custom content
The `GenerationResult` component SHALL accept a `headerRight` prop to render custom content in the header right area.

#### Scenario: Custom header content
- **WHEN** `GenerationResult` is rendered with `headerRight={<button>历史记录</button>}`
- **THEN** the button "历史记录" appears in the header right area

### Requirement: GenerationResult fires download callback
The `GenerationResult` component SHALL call the `onDownload` callback when a user clicks the download action on a result card.

#### Scenario: Download single result
- **WHEN** the user clicks the download button on a result card
- **THEN** `onDownload` is called with the corresponding `ResultItem`
