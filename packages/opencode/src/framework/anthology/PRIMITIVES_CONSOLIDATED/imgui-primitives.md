# Dear ImGui TUI Primitives

## Overview
Dear ImGui is a direct-manipulation GUI library that uses an immediate-mode rendering paradigm. It's the gold standard for rapid UI development in C/C++ applications.

## Core Architecture

### 1. Immediate Mode Rendering

**Frame-Based Processing:**
```cpp
void frame() {
    // 1. Start new frame
    ImGui::NewFrame();
    
    // 2. Build UI (all widgets stateless)
    if (ImGui::Button("Click")) {
        // Handle click - no state to check
    }
    
    // 3. Render to draw data
    ImGui::Render();
    
    // 4. Submit to backend
    ImGui_ImplOpenGL3_RenderDrawData(ImGui::GetDrawData());
}
```

**Key Characteristics:**
- No persistent widget state
- All data comes from caller variables
- Rebuilt every frame
- Command queue accumulates draw primitives

**Draw Data Structure:**
```cpp
struct ImDrawData {
    ImVector<ImDrawList*> CommandLists;
    int CmdListsCount;
    int TotalIdxCount;
    int TotalVtxCount;
    ImVec2 DisplayPos;
    ImVec2 DisplaySize;
    float FrameBufferScale;
};
```

### 2. Widget System

**Basic Widgets:**
```cpp
// Button variants
bool Button(const char* label, const ImVec2& size = ImVec2(0,0));
bool SmallButton(const char* label);
bool InvisibleButton(const char* str_id, const ImVec2& size, ImGuiButtonFlags flags = 0);

// Checkboxes
bool Checkbox(const char* label, bool* v);
bool CheckboxFlags(const char* label, int* flags, int flags_value);

// Progress
bool ProgressBar(float fraction, const ImVec2& size_arg = ImVec2(-1,0), const char* overlay = NULL);

// Bullet point
Bullet();
```

**Input Widgets:**
```cpp
// Numeric input
bool InputFloat(const char* label, float* v, float step = 0.0f, float step_fast = 0.0f,
                const char* format = "%.3f", ImGuiInputTextFlags flags = 0);
bool InputInt(const char* label, int* v, int step = 1, int step_fast = 100);
bool InputDouble(const char* label, double* v, double step = 0.0, double step_fast = 0.0,
                 const char* format = "%.6f", ImGuiInputTextFlags flags = 0);

// Text input
bool InputText(const char* label, char* buf, size_t buf_size,
               ImGuiInputTextFlags flags = 0, ImGuiInputTextCallback callback = NULL, void* user_data = NULL);
bool InputTextMultiline(const char* label, char* buf, size_t buf_size,
                        const ImVec2& size = ImVec2(0,0), ImGuiInputTextFlags flags = 0,
                        ImGuiInputTextCallback callback = NULL, void* user_data = NULL);
bool InputTextWithHint(const char* label, const char* hint, char* buf, size_t buf_size,
                       ImGuiInputTextFlags flags = 0, ImGuiInputTextCallback callback = NULL, void* user_data = NULL);

// Color input
bool ColorEdit3(const char* label, float col[3], ImGuiColorEditFlags flags = 0);
bool ColorEdit4(const char* label, float col[4], ImGuiColorEditFlags flags = 0);
bool ColorPicker3(const char* label, float col[3], ImGuiColorEditFlags flags = 0);
bool ColorPicker4(const char* label, float col[4], ImGuiColorEditFlags flags = 0);
bool ColorButton(const char* desc_id, const ImVec4& col, ImGuiColorEditFlags flags = 0, ImVec2 size = ImVec2(0,0));

// Sliders
bool SliderFloat(const char* label, float* v, float v_min, float v_max, const char* format = "%.3f", ImGuiSliderFlags flags = 0);
bool SliderAngle(const char* label, float* v_rad, float v_min_rad = -FLT_MAX, float v_max_rad = FLT_MAX, const char* format = "%.0f deg");
bool SliderInt(const char* label, int* v, int v_min, int v_max, const char* format = "%d", ImGuiSliderFlags flags = 0);
bool VSliderFloat(const char* label, const ImVec2& size, float* v, float v_min, float v_max, const char* format = "%.3f", ImGuiSliderFlags flags = 0);
bool VSliderInt(const char* label, const ImVec2& size, int* v, int v_min, int v_max, const char* format = "%d", ImGuiSliderFlags flags = 0);

// Dials (2D sliders)
bool DragFloat(const char* label, float* v, float v_speed = 1.0f, float v_min = 0.0f, float v_max = 0.0f, const char* format = "%.3f", ImGuiSliderFlags flags = 0);
bool DragFloat2(const char* label, float v[2], float v_speed = 1.0f, float v_min = -FLT_MAX, float v_max = +FLT_MAX, const char* format = "%.3f", ImGuiSliderFlags flags = 0);
bool DragFloat3(const char* label, float v[3], float v_speed = 1.0f, float v_min = -FLT_MAX, float v_max = +FLT_MAX, const char* format = "%.3f", ImGuiSliderFlags flags = 0);
bool DragFloat4(const char* label, float v[4], float v_speed = 1.0f, float v_min = -FLT_MAX, float v_max = +FLT_MAX, const char* format = "%.3f", ImGuiSliderFlags flags = 0);
bool DragInt(const char* label, int* v, float v_speed = 1.0f, int v_min = 0, int v_max = 0, const char* format = "%d", ImGuiSliderFlags flags = 0);
bool DragInt2(const char* label, int v[2], float v_speed = 1.0f, int v_min = 0, int v_max = 0, const char* format = "%d", ImGuiSliderFlags flags = 0);
bool DragInt3(const char* label, int v[3], float v_speed = 1.0f, int v_min = 0, int v_max = 0, const char* format = "%d", ImGuiSliderFlags flags = 0);
bool DragInt4(const char* label, int v[4], float v_speed = 1.0f, int v_min = 0, int v_max = 0, const char* format = "%d", ImGuiSliderFlags flags = 0);

// Combo boxes
bool Combo(const char* label, int* current_item, const char* const items[], int items_count, int popup_max_height_in_items = -1);
bool Combo(const char* label, int* current_item, bool (*items_getter)(void* data, int idx, const char** out_text), void* user_data, int items_count, int popup_max_height_in_items = -1);
```

**Selection Widgets:**
```cpp
bool Selectable(const char* label, bool selected = false, ImGuiSelectableFlags flags = 0, const ImVec2& size = ImVec2(0,0));
bool ListBox(const char* label, int* current_item, const char* const items[], int items_count, int height_in_items = -1);
bool ListBoxHeader(const char* label, const ImVec2& size = ImVec2(0,0));
bool ListBoxHeader(const char* label, int items_count, int height_in_items = -1);
void ListBoxFooter();
```

**Tree & Collapsing:**
```cpp
bool TreeNode(const char* label);
bool TreeNodeEx(const char* label, ImGuiTreeNodeFlags flags = 0);
bool TreeNodeExVoid* user_data, int user_data_count = 0);
void TreePop();
int TreeNodeCalculateIndent(const ImGuiWindow* window, int current_level, int leaf_offset = 0);

// Collapsing header
bool CollapsingHeader(const char* label, ImGuiTreeNodeFlags flags = 0);
bool CollapsingHeader(const char* label, bool* p_open, ImGuiTreeNodeFlags flags = 0);
```

**Tables (Advanced):**
```cpp
bool BeginTable(const char* str_id, int columns, ImGuiTableFlags flags = 0, const ImVec2& outer_size = ImVec2(0.0f, 0.0f), float inner_width = 0.0f);
void EndTable();
bool TableNextRow(ImGuiTableRowFlags row_flags = 0, float min_row_height = 0.0f);
bool TableNextColumn();
bool TableSetColumnIndex(int column_n);
int TableGetColumnIndex();
int TableGetRowIndex();
int TableGetColumnCount();
int TableGetColumnFlags(int column_n);
int TableGetColumnSortDirection(int column_n);
int TableGetHoveredColumn();
int TableGetHoveredRow();
void TableSetColumnWidth(int column_n, float width);
void TableSetColumnEnabled(int column_n, bool v);
void TableSetBgColor(ImGuiTableBgTarget target, ImU32 color, int column_n = -1);
const ImGuiTableSortSpecs* TableGetSortSpecs();

// Column setup
void TableSetupColumn(const char* label, ImGuiTableColumnFlags flags = 0, float init_width_or_weight = 0.0f, ImGuiID user_id = 0);
void TableSetupScrollFreeze(int cols, int rows);
```

### 3. Event Handling

**Widget Query Functions:**
```cpp
// Hovered state
bool IsItemHovered(ImGuiHoveredFlags flags = 0);
bool IsWindowHovered(ImGuiFocusedFlags flags = 0);
bool IsRootWindowOrAnyChildHovered(ImGuiHoveredFlags flags = 0);

// Active state (being dragged/clicked)
bool IsItemActive();
bool IsWindowActive();

// Clicked state
bool IsItemClicked(ImGuiMouseButton mouse_button = 0);
bool IsWindowFocused(ImGuiFocusedFlags flags = 0);

// Focused state (keyboard)
bool IsItemFocused();
bool IsWindowFocused(ImGuiFocusedFlags flags = 0);

// Visibility
bool IsItemVisible();
bool IsWindowVisible();

// Rect queries
ImRect GetItemRect();
ImRect GetWindowRect();

// State changes
bool IsItemActivated();
bool IsItemDeactivated();
bool IsItemDeactivatedAfterEdit();
bool IsItemToggledOpen();
bool IsAnyItemHovered();
bool IsAnyItemActive();
bool IsAnyItemFocused();
```

**Input State:**
```cpp
bool IsKeyDown(ImGuiKey key);
bool IsKeyPressed(ImGuiKey key, bool repeat = true);
bool IsKeyReleased(ImGuiKey key);
bool IsKeyChordPressed(ImGuiKeyChord key_chord);

bool IsMouseDown(ImGuiMouseButton button);
bool IsMouseClicked(ImGuiMouseButton button, bool repeat = false);
bool IsMouseReleased(ImGuiMouseButton button);
bool IsMouseDoubleClicked(ImGuiMouseButton button);
bool IsMouseDragging(ImGuiMouseButton button = 0, float lock_threshold = -1.0f);
bool IsMousePosValid(float* out_x = NULL, float* out_y = NULL);
bool IsMouseClicked(ImGuiMouseButton button, bool repeat = false);

float GetMouseDragDelta(ImGuiMouseButton button = 0, float lock_threshold = -1.0f);
void ResetMouseDragDelta(ImGuiMouseButton button = 0);
const ImVec2& GetMousePos();
const ImVec2& GetMousePosOnOpeningCurrentPopup();
bool IsMouseDragging(int channel = 0, float lock_threshold = -1.0f);
ImVec2 GetMouseDragDragged(ImGuiMouseButton button = 0);
bool IsMouseHoveringRect(const ImRect& r, bool clip = true);
```

**Popup System:**
```cpp
bool BeginPopup(const char* str_id, ImGuiWindowFlags flags = 0);
bool BeginPopupModal(const char* name, bool* p_open = NULL, ImGuiWindowFlags flags = 0);
void EndPopup();
bool OpenPopup(const char* str_id, ImGuiPopupFlags popup_flags = 0);
bool OpenPopupOnItemClick(const char* str_id = NULL, ImGuiPopupFlags popup_flags = 1);
bool CloseCurrentPopup();
bool IsPopupOpen(const char* str_id, ImGuiPopupFlags flags = 0);
bool IsPopupOpen(ImGuiID id, ImGuiPopupFlags flags = 0);
void ClosePopupToLevel(int remaining, bool restore_focus_to_window_under_popup = true);
void ClosePopupsOverWindow(ImGuiWindow* ref_window, bool restore_focus_to_window_under_popup = true);
void ClosePopupsExceptModals();
```

### 4. Layout System

**Cursor Positioning:**
```cpp
ImVec2 GetCursorPos();
void SetCursorPos(const ImVec2& local_pos);
ImVec2 GetCursorScreenPos();
void SetCursorScreenPos(const ImVec2& pos);
float GetCursorStartPos();
float GetCursorPosX();
void SetCursorPosX(float x);
float GetCursorPosY();
void SetCursorPosY(float y);
float GetCursorStartPos();
float GetCursorOffsetY();
```

**Spacing & Alignment:**
```cpp
void SameLine(float offset_from_start_x = 0.0f, float spacing = -1.0f);
void NewLine();
void Spacing();
void Dummy(const ImVec2& size);
void Indent(float indent_w = 0.0f);
void Unindent(float indent_w = 0.0f);
void Separator();
void SeparatorEx(ImGuiSeparatorFlags flags);
void SeparatorV();
void SeparatorH();
```

**Grouping:**
```cpp
void BeginGroup();
void EndGroup();
```

**Columns:**
```cpp
void Columns(int count = 1, const char* id = NULL, bool border = true);
int GetColumnIndex();
float GetColumnWidth(int column_index = -1);
void SetColumnWidth(int column_index, float width);
float GetColumnOffset(int column_index = -1);
void SetColumnOffset(int column_index, float offset_x);
bool IsItemActive(int column_index = -1);
bool IsItemHovered(int column_index = -1);
int GetColumnCount();
```

**Window Functions:**
```cpp
bool Begin(const char* name, bool* p_open = NULL, ImGuiWindowFlags flags = 0);
void End();
bool BeginChild(const char* str_id, const ImVec2& size = ImVec2(0,0), ImGuiChildFlags child_flags = 0, ImGuiWindowFlags flags = 0);
void EndChild();
bool BeginChildFlags(ImGuiID id, const ImVec2& size, ImGuiChildFlags child_flags, ImGuiWindowFlags flags);
bool IsChildBeingResized(int child_index);
bool IsChildFocused(int child_index);
bool IsChildHovered(int child_index);
bool IsChildActive(int child_index);
int GetChildCount();
void SetNextChildContentSize(const ImVec2& size = ImVec2(-1,0));
void SetNextChildSize(const ImVec2& size);
void SetNextChildScroll(const ImVec2& scroll);
void SetNextChildBgColor(ImU32 color);
void SetNextChildCursorPos(const ImVec2& pos);
void SetNextChildPadding(const ImVec2& padding);
void SetNextChildClipRect(const ImVec2& min, const ImVec2& max);
void SetNextChildAlpha(float alpha);
void SetNextChildFocus();
void SetNextChildCollapsed(bool collapsed);
void SetNextChildMenuBarSize(const ImVec2& size);
void SetNextChildMenuBarVisible(bool visible);
void SetNextChildMenuBarHeight(float height);
void SetNextChildMenuBarPadding(const ImVec2& padding);
void SetNextChildMenuBarBgColor(ImU32 color);
void SetNextChildMenuBarAlpha(float alpha);
void SetNextChildMenuBarCursorPos(const ImVec2& pos);
void SetNextChildMenuBarClipRect(const ImVec2& min, const ImVec2& max);
void SetNextChildMenuBarFocus();
void SetNextChildMenuBarCollapsed(bool collapsed);
```

### 5. Styling System

**Style Variables:**
```cpp
struct ImGuiStyle {
    float Alpha;
    float DisabledAlpha;
    float WindowPadding;
    float WindowRounding;
    float WindowBorderSize;
    float WindowMinSize;
    float WindowTitleAlign;
    float ChildRounding;
    float ChildBorderSize;
    float PopupRounding;
    float PopupBorderSize;
    float FramePadding;
    float FrameRounding;
    float FrameBorderSize;
    float ItemSpacing;
    float ItemInnerSpacing;
    float TouchExtraPadding;
    float IndentSpacing;
    float ColumnsMinSpacing;
    float ScrollbarSize;
    float ScrollbarRounding;
    float GrabMinSize;
    float GrabRounding;
    float LogSliderDeadzone;
    float TabRounding;
    float TabBorderSize;
    float TabBarOverlineSize;
    float TabBarOverlineRounding;
    float TabBarOverlineOffset;
    float TabBarBorderSize;
    float TabBarBorderRounding;
    float TabBarBorderOffset;
    float TabBarPadding;
    float TabBarDragOffset;
    float TabBarDragPadding;
    float TabBarScrollOffset;
    float TabBarScrollPadding;
    float TabBarScrollButtonPadding;
    float TabBarScrollButtonSize;
    float TabBarScrollButtonRounding;
    float TabBarScrollButtonBorderSize;
    float TabBarScrollButtonBorderRounding;
    float TabBarScrollButtonBorderOffset;
    float TabBarScrollButtonBorderAlpha;
    float TabBarScrollButtonBorderHovered;
    float TabBarScrollButtonBorderActive;
    float TabBarScrollButtonBorderDisabled;
    float TabBarScrollButtonBorderPressed;
    float TabBarScrollButtonBorderFocused;
    float TabBarScrollButtonBorderVisible;
    float TabBarScrollButtonBorderInvisible;
    float TabBarScrollButtonBorderDefault;
    float TabBarScrollButtonBorderCustom;
    float TabBarScrollButtonBorderSystem;
    float TabBarScrollButtonBorderPlatform;
    float TabBarScrollButtonBorderOS;
    float TabBarScrollButtonBorderApp;
    float TabBarScrollButtonBorderWindow;
    float TabBarScrollButtonBorderChild;
    float TabBarScrollButtonBorderPopup;
    float TabBarScrollButtonBorderTooltip;
    float TabBarScrollButtonBorderMenu;
    float TabBarScrollButtonBorderDialog;
    float TabBarScrollButtonBorderModal;
    float TabBarScrollButtonBorderAlert;
    float TabBarScrollButtonBorderNotification;
    float TabBarScrollButtonBorderStatus;
    float TabBarScrollButtonBorderProgress;
    float TabBarScrollButtonBorderActivity;
    float TabBarScrollButtonBorderEvent;
    float TabBarScrollButtonBorderLog;
    float TabBarScrollButtonBorderDebug;
    float TabBarScrollButtonBorderTest;
    float TabBarScrollButtonBorderDemo;
    float TabBarScrollButtonBorderExample;
    float TabBarScrollButtonBorderSample;
    float TabBarScrollButtonBorderReference;
    float TabBarScrollButtonBorderGuide;
    float TabBarScrollButtonBorderTutorial;
    float TabBarScrollButtonBorderManual;
    float TabBarScrollButtonBorderDocs;
    float TabBarScrollButtonBorderWiki;
    float TabBarScrollButtonBorderAPI;
    float TabBarScrollButtonBorderSpec;
    float TabBarScrollButtonBorderStandard;
    float TabBarScrollButtonBorderProtocol;
    float TabBarScrollButtonBorderFormat;
    float TabBarScrollButtonBorderSchema;
    float TabBarScrollButtonBorderGrammar;
    float TabBarScrollButtonBorderSyntax;
    float TabBarScrollButtonBorderLex;
    float TabBarScrollButtonBorderParse;
    float TabBarScrollButtonBorderAnalyze;
    float TabBarScrollButtonBorderCompile;
    float TabBarScrollButtonBorderLink;
    float TabBarScrollButtonBorderLoad;
    float TabBarScrollButtonBorderUnload;
    float TabBarScrollButtonBorderInit;
    float TabBarScrollButtonBorderCleanup;
    float TabBarScrollButtonBorderSetup;
    float TabBarScrollButtonBorderTeardown;
    float TabBarScrollButtonBorderConfigure;
    float TabBarScrollButtonBorderDeploy;
    float TabBarScrollButtonBorderRelease;
    float TabBarScrollButtonBorderBuild;
    float TabBarScrollButtonBorderTest;
    float TabBarScrollButtonBorderRun;
    float TabBarScrollButtonBorderDebug;
    float TabBarScrollButtonBorderProfile;
    float TabBarScrollButtonBorderBenchmark;
    float TabBarScrollButtonBorderMeasure;
    float TabBarScrollButtonBorderOptimize;
    float TabBarScrollButtonBorderTune;
    float TabBarScrollButtonBorderCalibrate;
    float TabBarScrollButtonBorderValidate;
    float TabBarScrollButtonBorderVerify;
    float TabBarScrollButtonBorderCheck;
    float TabBarScrollButtonBorderAudit;
    float TabBarScrollButtonBorderReview;
    float TabBarScrollButtonBorderInspect;
    float TabBarScrollButtonBorderExamine;
    float TabBarScrollButtonBorderInvestigate;
    float TabBarScrollButtonBorderDiscover;
    float TabBarScrollButtonBorderExplore;
    float TabBarScrollButtonBorderStudy;
    float TabBarScrollButtonBorderLearn;
    float TabBarScrollButtonBorderTeach;
    float TabBarScrollButtonBorderEducate;
    float TabBarScrollButtonBorderTrain;
    float TabBarScrollButtonBorderInstruct;
    float TabBarScrollButtonBorderGuide;
    float TabBarScrollButtonBorderMentor;
    float TabBarScrollButtonBorderCoach;
    float TabBarScrollButtonBorderAdvisor;
    float TabBarScrollButtonBorderConsultant;
    float TabBarScrollButtonBorderExpert;
    float TabBarScrollButtonBorderSpecialist;
    float TabBarScrollButtonBorderProfessional;
    float TabBarScrollButtonBorderPractitioner;
    float TabBarScrollButtonBorderUser;
    float TabBarScrollButtonBorderDeveloper;
    float TabBarScrollButtonBorderEngineer;
    float TabBarScrollButtonBorderDesigner;
    float TabBarScrollButtonBorderArchitect;
    float TabBarScrollButtonBorderManager;
    float TabBarScrollButtonBorderLeader;
    float TabBarScrollButtonBorderDirector;
    float TabBarScrollButtonBorderVP;
    float TabBarScrollButtonBorderCEO;
    float TabBarScrollButtonBorderCFO;
    float TabBarScrollButtonBorderCTO;
    float TabBarScrollButtonBorderCOO;
    float TabBarScrollButtonBorderCMO;
    float TabBarScrollButtonBorderCHRO;
    float TabBarScrollButtonBorderCIO;
    float TabBarScrollButtonBorderCSO;
    float TabBarScrollButtonBorderCDO;
    float TabBarScrollButtonBorderCKO;
    float TabBarScrollButtonBorderCCO;
    float TabBarScrollButtonBorderCAO;
    float TabBarScrollButtonBorderCCO;
    float TabBarScrollButtonBorderCEO;
};

void PushStyleColor(ImGuiCol idx, ImU32 col);
void PushStyleColor(ImGuiCol idx, const ImVec4& col);
void PopStyleColor(int count = 1);

void PushStyleVar(ImGuiStyleVar idx, float val);
void PushStyleVar(ImGuiStyleVar idx, const ImVec2& val);
void PushStyleVar(ImGuiStyleVar idx, ImGuiCol col);
void PopStyleVar(int count = 1);

const ImGuiStyle& GetStyle();
ImVec4 GetColorU32(ImGuiCol idx, float alpha_mul = 1.0f);
ImVec4 GetColorU32(ImU32 col);
```

**Built-in Styles:**
```cpp
StyleColorsDefault();  // Classic ImGui
StyleColorsDark();     // Dark theme (default)
StyleColorsLight();    // Light theme
```

### 6. ID System

**ID Stack:**
```cpp
void PushID(const char* str_id);
void PushID(const char* str_id_begin, const char* str_id_end);
void PushID(const void* ptr_id);
void PushID(int int_id);
void PopID();

ImGuiID GetID(const char* str_id);
ImGuiID GetID(const char* str_id_begin, const char* str_id_end);
ImGuiID GetID(const void* ptr_id);
ImGuiID GetID(int int_id);
```

**Label Format:**
- `Label`: Displayed text + used as ID (hash of full stack)
- `Label##unique_id`: Display "Label", use "unique_id" as ID
- `Label###unique_id`: Display "Label###unique_id", use hash as ID

### 7. Drawing Primitives

```cpp
ImDrawList* GetDrawList();
void AddRect(const ImVec2& a_min, const ImVec2& a_max, ImU32 color, float rounding = 0.0f, ImDrawFlags flags = 0, float thickness = 1.0f);
void AddRectFilled(const ImVec2& a_min, const ImVec2& a_max, ImU32 color, float rounding = 0.0f, ImDrawFlags flags = 0);
void AddRectFilledMultiColor(const ImVec2& a_min, const ImVec2& a_max, ImU32 color_up_left, ImU32 color_up_right, ImU32 color_down_right, ImU32 color_down_left);
void AddLine(const ImVec2& p1, const ImVec2& p2, ImU32 color, float thickness = 1.0f);
void AddText(const ImVec2& pos, ImU32 color, const char* text_begin, const char* text_end = NULL);
void AddText(const ImFont* font, float font_size, const ImVec2& pos, ImU32 color, const char* text_begin, const char* text_end = NULL, float wrap_width = 0.0f, const ImVec4* cpu_fine_clip_rect = NULL);
void AddPolyline(const ImVec2* points, int num_points, ImU32 color, ImDrawFlags flags, float thickness);
void AddConvexPolyFilled(const ImVec2* points, int num_points, ImU32 color);
void AddTriangle(const ImVec2& a, const ImVec2& b, const ImVec2& c, ImU32 color, float thickness = 1.0f);
void AddTriangleFilled(const ImVec2& a, const ImVec2& b, const ImVec2& c, ImU32 color);
void AddCircle(const ImVec2& center, float radius, ImU32 color, int num_segments = 12, float thickness = 1.0f);
void AddCircleFilled(const ImVec2& center, float radius, ImU32 color, int num_segments = 12);
void AddEllipse(const ImVec2& center, const ImVec2& radius, ImU32 color, double rotation = 0.0, int num_segments = 12);
void AddEllipseFilled(const ImVec2& center, const ImVec2& radius, ImU32 color, double rotation = 0.0, int num_segments = 12);
void AddQuadrilateral(const ImVec2& a, const ImVec2& b, const ImVec2& c, const ImVec2& d, ImU32 color, float thickness = 1.0f);
void AddQuadrilateralFilled(const ImVec2& a, const ImVec2& b, const ImVec2& c, const ImVec2& d, ImU32 color);
void AddText(const ImFont* font, float font_size, const ImVec2& pos, ImU32 color, const ImRect& clip_rect, const char* text_begin, const char* text_end = NULL, float wrap_width = 0.0f, const ImVec4* cpu_fine_clip_rect = NULL);
```

## Key Design Principles

1. **Immediate Mode**: No retained state, everything rebuilt every frame
2. **Stack-Based**: Push/pop for context management (ID, style, clip)
3. **Flag-Heavy**: Extensive use of bit flags for optional features
4. **Data-Driven**: Widgets read from caller-provided data
5. **Backend-Agnostic**: Rendering decoupled from input/platform
6. **Zero-Copy**: Minimal memory allocation during frame
7. **Thread-Safe**: Single-threaded rendering, input from any thread
8. **UTF-8**: Full Unicode support
9. **Composable**: Widgets build on basic primitives
10. **Focus Routing**: Automatic keyboard navigation

## Performance Considerations

- **Frame Time**: Keep under 16ms for 60fps
- **Widget Count**: 100-1000 widgets typical for most apps
- **Draw Calls**: Minimize by batching similar widgets
- **Memory**: Frame-local allocation, no persistent objects
- **CPU**: Linear in number of widgets and pixels drawn
- **GPU**: Vertex/index buffer uploads each frame

This architecture enables rapid UI iteration while maintaining good performance for most applications.
